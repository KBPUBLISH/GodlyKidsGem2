/**
 * AI chat + TTS for crew deck characters.
 *
 * Backend contract:
 * - POST {API}/api/ai/character-chat
 *   body { characterName, persona?, storyId?, storyTitle?, userName?, question, history? }
 *   → { reply: string, suggestedQuestions: string[] }
 *   userName (the kid's first name) lets the character address the child by
 *   name; the backend keys its response cache on it too.
 *   Send question "__greeting__" on popup open to get the greeting + initial
 *   suggestions.
 * - POST {API}/api/tts body { voiceId, text } → audio/mpeg stream.
 */

import { getApiBaseUrl } from './apiService';

export type ChatTurn = { role: 'user' | 'character'; text: string };

export const GREETING_QUESTION = '__greeting__';

/** Keep the conversation payload small — last ~8 turns. */
const MAX_HISTORY_TURNS = 8;

export type CharacterChatResponse = {
  reply: string;
  suggestedQuestions: string[];
};

export async function fetchCharacterChat(params: {
  characterName: string;
  persona?: string;
  storyId?: string;
  storyTitle?: string;
  /** Kid's first name from the active profile — omitted when unavailable. */
  userName?: string;
  question: string;
  history?: ChatTurn[];
}): Promise<CharacterChatResponse> {
  const base = getApiBaseUrl(); // ends with ".../api/"
  const body: Record<string, unknown> = {
    characterName: params.characterName,
    question: params.question,
  };
  if (params.persona) body.persona = params.persona;
  if (params.storyId) body.storyId = params.storyId;
  if (params.storyTitle) body.storyTitle = params.storyTitle;
  if (params.userName) body.userName = params.userName;
  if (params.history && params.history.length > 0) {
    body.history = params.history.slice(-MAX_HISTORY_TURNS);
  }

  const res = await fetch(`${base}ai/character-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`character-chat failed: ${res.status}`);
  }
  const data = await res.json();
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  if (!reply) throw new Error('character-chat: empty reply');
  const suggestedQuestions = Array.isArray(data?.suggestedQuestions)
    ? data.suggestedQuestions
        .map((q: unknown) => String(q ?? '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  return { reply, suggestedQuestions };
}

/**
 * Fetch spoken audio for a reply. Returns an object URL for an <audio> src,
 * or null on any failure — voice degrades silently, chat keeps working.
 * Caller must URL.revokeObjectURL() when done with it.
 */
export async function fetchTtsAudioUrl(
  voiceId: string,
  text: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, text }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
