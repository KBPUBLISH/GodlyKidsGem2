/**
 * Per-character crew chat memory — lets a character "pick up where we left
 * off" when the kid taps them again. Conversation turns are persisted in
 * localStorage per character id and sent with the greeting request so the
 * backend generates a welcome-back opener instead of a cold introduction.
 * Memory auto-expires after 24h to keep conversations fresh.
 */
import type { ChatTurn } from '../../services/characterChatService';

const KEY_PREFIX = 'crewChatHistory:';
/** Keep the tail of the conversation only — enough for continuity. */
const MAX_SAVED_TURNS = 10;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

type StoredChat = { turns: ChatTurn[]; savedAt: number };

/** Saved turns for a character, or [] when absent/expired/corrupt. */
export function loadChatHistory(characterId: string): ChatTurn[] {
  const key = KEY_PREFIX + characterId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChat;
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.turns) ||
      Date.now() - parsed.savedAt > EXPIRY_MS
    ) {
      localStorage.removeItem(key);
      return [];
    }
    return parsed.turns.filter(
      (t): t is ChatTurn =>
        !!t &&
        (t.role === 'user' || t.role === 'character') &&
        typeof t.text === 'string' &&
        t.text.length > 0,
    );
  } catch {
    return [];
  }
}

/** Persist the trimmed conversation tail; best-effort (storage may be full). */
export function saveChatHistory(characterId: string, turns: ChatTurn[]): void {
  try {
    const record: StoredChat = {
      turns: turns.slice(-MAX_SAVED_TURNS),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY_PREFIX + characterId, JSON.stringify(record));
  } catch {
    /* memory is a nice-to-have — chat works without it */
  }
}

/* ------------------------------------------------------------------------ *
 * Suggestion freshness — cached backend responses carry fixed suggestion
 * sets, so a kid revisiting a character would see pills for questions they
 * already asked. We track asked questions per character (outliving the
 * 10-turn history trim) plus a small pool of suggestions the kid has SEEN
 * but never tapped, and pick 3 fresh pills from those. Same 24h expiry as
 * the chat history.
 * ------------------------------------------------------------------------ */

const ASKED_KEY_PREFIX = 'crewChatAsked:';
/** Asked questions remembered per character (beyond the 10-turn history). */
const MAX_ASKED = 25;
/** Seen-but-unasked suggestions kept around as backfill candidates. */
const MAX_POOL = 15;
/** Pills shown under the speech bubble — always aim for exactly this many. */
const SUGGESTION_COUNT = 3;

type AskedEntry = { text: string; at: number };
type StoredSuggestions = { asked: AskedEntry[]; pool: string[]; savedAt: number };

/** Case/punctuation-insensitive key so "Was it fun?!" matches "was it fun". */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function emptySuggestionRecord(): StoredSuggestions {
  return { asked: [], pool: [], savedAt: Date.now() };
}

function loadSuggestionRecord(characterId: string): StoredSuggestions {
  const key = ASKED_KEY_PREFIX + characterId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptySuggestionRecord();
    const parsed = JSON.parse(raw) as StoredSuggestions;
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > EXPIRY_MS
    ) {
      localStorage.removeItem(key);
      return emptySuggestionRecord();
    }
    return {
      asked: Array.isArray(parsed.asked)
        ? parsed.asked.filter(
            (a): a is AskedEntry =>
              !!a && typeof a.text === 'string' && a.text.length > 0 && typeof a.at === 'number',
          )
        : [],
      pool: Array.isArray(parsed.pool)
        ? parsed.pool.filter((q): q is string => typeof q === 'string' && q.length > 0)
        : [],
      savedAt: parsed.savedAt,
    };
  } catch {
    return emptySuggestionRecord();
  }
}

function saveSuggestionRecord(characterId: string, rec: StoredSuggestions): void {
  try {
    rec.savedAt = Date.now();
    localStorage.setItem(ASKED_KEY_PREFIX + characterId, JSON.stringify(rec));
  } catch {
    /* best-effort, like the chat history */
  }
}

/** The kid tapped a question — remember it (and drop it from the unasked pool). */
export function recordAskedQuestion(characterId: string, question: string): void {
  const norm = normalizeQuestion(question);
  if (!norm) return;
  const rec = loadSuggestionRecord(characterId);
  rec.asked = rec.asked.filter((a) => normalizeQuestion(a.text) !== norm);
  rec.asked.push({ text: question, at: Date.now() });
  rec.asked = rec.asked.slice(-MAX_ASKED);
  rec.pool = rec.pool.filter((q) => normalizeQuestion(q) !== norm);
  saveSuggestionRecord(characterId, rec);
}

/**
 * Backfill the asked-list from persisted history's user turns — covers
 * histories saved before asked-tracking existed. Only adds questions not
 * already tracked; seeded entries get slightly-past timestamps so their
 * relative order survives for least-recently-asked picking.
 */
export function seedAskedFromHistory(characterId: string, turns: ChatTurn[]): void {
  const questions = turns.filter((t) => t.role === 'user').map((t) => t.text);
  if (questions.length === 0) return;
  const rec = loadSuggestionRecord(characterId);
  const known = new Set(rec.asked.map((a) => normalizeQuestion(a.text)));
  const now = Date.now();
  let added = false;
  questions.forEach((q, i) => {
    const norm = normalizeQuestion(q);
    if (!norm || known.has(norm)) return;
    known.add(norm);
    rec.asked.push({ text: q, at: now - (questions.length - i) });
    added = true;
  });
  if (!added) return;
  rec.asked.sort((a, b) => a.at - b.at);
  rec.asked = rec.asked.slice(-MAX_ASKED);
  rec.pool = rec.pool.filter((q) => !known.has(normalizeQuestion(q)));
  saveSuggestionRecord(characterId, rec);
}

/**
 * Pick the 3 question pills to render for a fresh backend response:
 *  1. the response's own suggestions the kid hasn't asked yet,
 *  2. backfill with seen-but-unasked suggestions from earlier responses
 *     (most recently seen first),
 *  3. last resort — allow a repeat, choosing the LEAST-recently-asked
 *     question ("okay to repeat every now and then").
 * Also folds the response's unasked suggestions into the backfill pool.
 */
export function selectSuggestions(characterId: string, fresh: string[]): string[] {
  const rec = loadSuggestionRecord(characterId);
  const askedNorms = new Set(rec.asked.map((a) => normalizeQuestion(a.text)));

  const chosen: string[] = [];
  const chosenNorms = new Set<string>();
  const pick = (q: string): void => {
    const norm = normalizeQuestion(q);
    if (!norm || chosenNorms.has(norm)) return;
    chosen.push(q);
    chosenNorms.add(norm);
  };

  // 1) Fresh suggestions the kid hasn't asked.
  for (const q of fresh) {
    if (chosen.length >= SUGGESTION_COUNT) break;
    if (!askedNorms.has(normalizeQuestion(q))) pick(q);
  }

  // Fold unasked fresh suggestions into the pool (deduped, recent at the end).
  const poolNorms = new Set(rec.pool.map(normalizeQuestion));
  for (const q of fresh) {
    const norm = normalizeQuestion(q);
    if (!norm || askedNorms.has(norm) || poolNorms.has(norm)) continue;
    rec.pool.push(q);
    poolNorms.add(norm);
  }
  rec.pool = rec.pool.slice(-MAX_POOL);

  // 2) Backfill from seen-but-unasked, newest first.
  for (let i = rec.pool.length - 1; i >= 0 && chosen.length < SUGGESTION_COUNT; i--) {
    if (!askedNorms.has(normalizeQuestion(rec.pool[i]))) pick(rec.pool[i]);
  }

  // 3) Everything's been asked — repeat the least-recently-asked ones.
  if (chosen.length < SUGGESTION_COUNT) {
    const oldestFirst = [...rec.asked].sort((a, b) => a.at - b.at);
    for (const entry of oldestFirst) {
      if (chosen.length >= SUGGESTION_COUNT) break;
      pick(entry.text);
    }
  }

  saveSuggestionRecord(characterId, rec);
  return chosen.slice(0, SUGGESTION_COUNT);
}
