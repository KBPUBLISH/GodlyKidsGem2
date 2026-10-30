/**
 * IslandNotices — small top-left pop-ups on the Crew page telling the kid what
 * their island friends have been up to ("Abel tilled a new garden plot.").
 *
 * The island (homeworld bundle, see homeworld/src/island-feed.mjs) appends an
 * entry to localStorage `godlykids_island_feed:<profile scope>` whenever a
 * friend finishes something notable. This component shows the entries newer
 * than the last-seen marker, oldest first, a few at a time, each fading in,
 * lingering, then fading out — and advances the marker so nothing repeats.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Axe,
  Fish,
  Flame,
  Hammer,
  Moon,
  Pickaxe,
  Shield,
  Shovel,
  Sparkles,
  Sprout,
  Sunrise,
  UtensilsCrossed,
} from 'lucide-react';
import { getProfileScopeKey, onProfileScopeChange } from '../../utils/profileScope';
import './IslandNotices.css';

export type IslandFeedEntry = {
  id: string;
  /** Wall-clock ms when the friend did it. */
  at: number;
  text: string;
  kind?: string;
  who?: string;
};

export const ISLAND_FEED_KEY_BASE = 'godlykids_island_feed';
export const ISLAND_FEED_SEEN_KEY_BASE = 'godlykids_island_feed_seen';
/** CustomEvent / postMessage type the island uses to announce a new entry. */
const FEED_EVENT = 'gk-island-feed';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SHOW_MS = 4500;
const STAGGER_MS = 600;
const LEAVE_MS = 400;
const MAX_VISIBLE = 3;
/** A busy island can log dozens of lines a day; one visit replays only the newest few. */
const MAX_PER_BATCH = 6;

type Shown = IslandFeedEntry & { leaving: boolean };

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>> = {
  garden: Sprout,
  dig: Shovel,
  chop: Axe,
  mine: Pickaxe,
  fish: Fish,
  fire: Flame,
  guard: Shield,
  meal: UtensilsCrossed,
  night: Moon,
  dawn: Sunrise,
  build: Hammer,
};

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function parseFeed(raw: string | null): IslandFeedEntry[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter(
          (e): e is IslandFeedEntry =>
            !!e && typeof e.text === 'string' && typeof e.at === 'number' && e.id != null,
        )
      : [];
  } catch {
    return [];
  }
}

/** Feed under the active profile, plus the unscoped key (standalone island / older bundles), oldest first. */
function readFeed(scope: string): IslandFeedEntry[] {
  const store = storage();
  if (!store) return [];
  const seen = new Set<string>();
  const out: IslandFeedEntry[] = [];
  for (const key of [`${ISLAND_FEED_KEY_BASE}:${scope}`, ISLAND_FEED_KEY_BASE]) {
    for (const e of parseFeed(store.getItem(key))) {
      const id = String(e.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...e, id });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function readSeenAt(scope: string): number {
  try {
    const raw = storage()?.getItem(`${ISLAND_FEED_SEEN_KEY_BASE}:${scope}`);
    if (!raw) return 0;
    const v = JSON.parse(raw);
    return typeof v?.at === 'number' ? v.at : 0;
  } catch {
    return 0;
  }
}

function writeSeen(scope: string, entry: IslandFeedEntry): void {
  try {
    const prev = readSeenAt(scope);
    if (entry.at <= prev) return;
    storage()?.setItem(`${ISLAND_FEED_SEEN_KEY_BASE}:${scope}`, JSON.stringify({ at: entry.at, id: entry.id }));
  } catch {
    /* private mode / quota: the notice may show again next visit */
  }
}

function isFeedKey(key: string | null): boolean {
  return key === null || key.startsWith(ISLAND_FEED_KEY_BASE);
}

/** "Abel tilled a plot." → bold name + rest, when the line starts with the friend's name. */
function renderText(e: IslandFeedEntry): React.ReactNode {
  const who = (e.who || '').trim();
  if (who && e.text.startsWith(who)) {
    return (
      <>
        <b>{who}</b>
        {e.text.slice(who.length).replace(/^\s+/, '')}
      </>
    );
  }
  return e.text;
}

const IslandNotices: React.FC = () => {
  const [scope, setScope] = useState<string>(() => getProfileScopeKey());
  const [shown, setShown] = useState<Shown[]>([]);
  /** Set by the scheduler effect; tap-to-dismiss calls through it. */
  const dismissRef = useRef<(id: string) => void>(() => {});

  // Follow profile switches: a different kid has a different island.
  useEffect(() => onProfileScopeChange((next) => setScope(next)), []);

  useEffect(() => {
    // One scheduler per profile scope, so one kid's notices never show for another.
    const queue: IslandFeedEntry[] = [];
    const known = new Set<string>();
    const visible = new Set<string>();
    const leaving = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let pumpTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
      return t;
    };
    const pumpIn = (ms: number) => {
      if (pumpTimer) return;
      pumpTimer = later(() => {
        pumpTimer = null;
        pump();
      }, ms);
    };

    const dismiss = (id: string) => {
      if (!visible.has(id) || leaving.has(id)) return;
      leaving.add(id);
      setShown((list) => list.map((s) => (s.id === id ? { ...s, leaving: true } : s)));
      later(() => {
        visible.delete(id);
        leaving.delete(id);
        setShown((list) => list.filter((s) => s.id !== id));
        if (queue.length) pumpIn(120); // a slot freed up: keep the queue moving
      }, LEAVE_MS);
    };
    dismissRef.current = dismiss;

    /** Show the next queued entry if a slot is free; stagger the following one. */
    const pump = () => {
      if (pumpTimer || !queue.length) return;
      if (visible.size >= MAX_VISIBLE) {
        pumpIn(500);
        return;
      }
      const entry = queue.shift()!;
      visible.add(entry.id);
      writeSeen(scope, entry);
      setShown((list) => [...list, { ...entry, leaving: false }]);
      later(() => dismiss(entry.id), SHOW_MS);
      if (queue.length) pumpIn(STAGGER_MS);
    };

    /** Pull anything new from storage into the queue and start showing it. */
    const refresh = () => {
      const seenAt = readSeenAt(scope);
      const cutoff = Date.now() - MAX_AGE_MS;
      const fresh = readFeed(scope).filter((e) => e.at > seenAt && e.at >= cutoff && !known.has(e.id));
      if (!fresh.length) return;
      // Oldest → newest, but only the newest few; anything older is skipped and
      // counts as seen once the newest one has shown.
      const batch = fresh.slice(-MAX_PER_BATCH);
      for (const e of fresh) known.add(e.id);
      queue.push(...batch);
      queue.sort((a, b) => a.at - b.at);
      pump();
    };

    // A beat after mount, so a StrictMode double-mount or an instant route
    // bounce never marks an entry seen before anyone could read it.
    later(refresh, 400);

    const onStorage = (ev: StorageEvent) => {
      if (isFeedKey(ev.key)) refresh();
    };
    const onCustom = () => refresh();
    const onMessage = (ev: MessageEvent) => {
      if (ev?.data && typeof ev.data === 'object' && ev.data.type === FEED_EVENT) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(FEED_EVENT, onCustom);
    window.addEventListener('message', onMessage);
    return () => {
      alive = false;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(FEED_EVENT, onCustom);
      window.removeEventListener('message', onMessage);
      for (const t of timers) clearTimeout(t);
      timers.clear();
      dismissRef.current = () => {};
      setShown([]);
    };
  }, [scope]);

  if (!shown.length) return null;

  return (
    <div className="island-notices" role="status" aria-live="polite" aria-label="Island news">
      {shown.map((e) => {
        const Icon = ICONS[e.kind || ''] || Sparkles;
        return (
          <button
            key={e.id}
            type="button"
            className={`island-notice${e.leaving ? ' is-leaving' : ''}`}
            onClick={() => dismissRef.current(e.id)}
            aria-label={`Dismiss: ${e.text}`}
          >
            <span className="island-notice-icon">
              <Icon size={16} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="island-notice-text">{renderText(e)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default IslandNotices;
