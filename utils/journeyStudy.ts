/**
 * First-run tutorial study. One session starts when Perry's voyage begins
 * and stays open for a week so the ending offer and trial still attach
 * to the same family after the onboarding flag is cleared.
 */

const STORAGE_KEY = 'gk_journey_study_v1';
const STUDY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type JourneyStep =
  | 'journey_started'
  | 'map_guide'
  | 'island_tapped'
  | 'genesis_video'
  | 'sail_deck'
  | 'story_map'
  | 'story_pack'
  | 'read_tapped'
  | 'lesson_hub'
  | 'story_opened'
  | 'quiz_started'
  | 'quiz_done'
  | 'reward_tapped'
  | 'treasure'
  | 'crew'
  | 'adam_tour'
  | 'basement_tour'
  | 'library'
  | 'offer_shown'
  | 'offer_challenge'
  | 'offer_book'
  | 'offer_trial'
  | 'paywall_shown'
  | 'paywall_clicked'
  | 'paywall_dismissed'
  | 'trial_started';

type Session = {
  id: string;
  startedAt: number;
  fired: string[];
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.id || !parsed.startedAt) return null;
    return {
      id: parsed.id,
      startedAt: parsed.startedAt,
      fired: Array.isArray(parsed.fired) ? parsed.fired : [],
    };
  } catch {
    return null;
  }
}

function writeSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode */
  }
}

export function isJourneyStudyOpen(): boolean {
  const session = readSession();
  if (!session) return false;
  return Date.now() - session.startedAt < STUDY_WINDOW_MS;
}

function currentUserId(): string {
  try {
    const email = localStorage.getItem('godlykids_user_email');
    if (email) return email;
    let deviceId = localStorage.getItem('godlykids_device_id');
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('godlykids_device_id', deviceId);
    }
    return deviceId;
  } catch {
    return `anon_${Date.now()}`;
  }
}

function platform(): string {
  try {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('despia')) {
      return ua.includes('iphone') || ua.includes('ipad') ? 'ios' : 'android';
    }
  } catch {
    /* ignore */
  }
  return 'web';
}

function apiUrl(): string {
  let base = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL
    || 'https://backendgk2-0.onrender.com';
  base = base.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${base}/api/analytics/journey/event`;
}

async function postStep(session: Session, step: JourneyStep, source?: string): Promise<void> {
  const response = await fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId(),
      sessionId: session.id,
      step,
      elapsedMs: Math.max(0, Date.now() - session.startedAt),
      metadata: {
        platform: platform(),
        ...(source ? { source } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`journey study ${response.status}`);
}

function send(session: Session, step: JourneyStep, source?: string): void {
  if (session.fired.includes(step)) return;
  session.fired.push(step);
  writeSession(session);
  void postStep(session, step, source).catch(() => {
    const current = readSession();
    if (!current || current.id !== session.id) return;
    current.fired = current.fired.filter((item) => item !== step);
    writeSession(current);
  });
}

/** Opens a fresh study. Called when the first-run voyage starts. */
export function beginJourneyStudy(): void {
  const session: Session = {
    id: `jrn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    startedAt: Date.now(),
    fired: [],
  };
  writeSession(session);
  send(session, 'journey_started');
}

/** Records a beat once per voyage. No-ops when this device is not in a study. */
export function noteJourneyStep(step: JourneyStep, metadata?: { source?: string }): void {
  const session = readSession();
  if (!session) return;
  if (Date.now() - session.startedAt >= STUDY_WINDOW_MS) return;
  send(session, step, metadata?.source);
}

export type JourneyActivity = 'boat_session' | 'character_talk' | 'story_pack_done';

const ACTIVITY_KEY = 'gk_journey_activity_v1';
const BOAT_GAP_MS = 30 * 60 * 1000;
const BOAT_STAMP_KEY = 'gk_boat_session_at';

function readActivityIds(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeActivityIds(ids: string[]): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* private mode */
  }
}

/**
 * A repeatable beat: another boat visit, a talk with a character, or a
 * finished story pack. Kept apart from the once-per-voyage funnel.
 */
export function noteJourneyActivity(
  step: JourneyActivity,
  metadata?: { source?: string; label?: string; eventId?: string },
  onFail?: () => void,
): void {
  const eventId = (metadata?.eventId || `${step}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).slice(0, 120);
  const fired = readActivityIds();
  if (fired.includes(eventId)) return;
  fired.push(eventId);
  writeActivityIds(fired);
  void postActivity(step, eventId, metadata).catch(() => {
    const current = readActivityIds().filter((item) => item !== eventId);
    writeActivityIds(current);
    onFail?.();
  });
}

async function postActivity(
  step: JourneyActivity,
  eventId: string,
  metadata?: { source?: string; label?: string },
): Promise<void> {
  const response = await fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId(),
      sessionId: eventId,
      step,
      elapsedMs: 0,
      metadata: {
        platform: platform(),
        ...(metadata?.source ? { source: metadata.source } : {}),
        ...(metadata?.label ? { label: metadata.label } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`journey activity ${response.status}`);
}

/** One boat session per half hour, whether they land on the deck or the crew. */
export function noteBoatSession(): void {
  let last = 0;
  try {
    last = Number(localStorage.getItem(BOAT_STAMP_KEY) || 0);
  } catch {
    last = 0;
  }
  const now = Date.now();
  if (now - last < BOAT_GAP_MS) return;
  try {
    localStorage.setItem(BOAT_STAMP_KEY, String(now));
  } catch {
    /* private mode */
  }
  noteJourneyActivity('boat_session', { eventId: `boat_${now}` }, () => {
    try {
      if (localStorage.getItem(BOAT_STAMP_KEY) === String(now)) {
        localStorage.removeItem(BOAT_STAMP_KEY);
      }
    } catch {
      /* ignore */
    }
  });
}
