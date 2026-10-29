import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import { rewardsService, type UnlockedCharacter } from '../services/rewardsService';
import { fetchTtsAudioUrl } from '../services/characterChatService';
import CrewChatPopup from '../components/crew/CrewChatPopup';
import { readPlayersWorldResidents, type PlayersWorldResident } from '../utils/playersWorld';
import type { WorldBrief } from '../utils/islandIntents';
import HomeOnboarding, { writeHomeOnboarding } from '../components/home/HomeOnboarding';
import { ensureLegacyMigration, getProfileScopeKey, onProfileScopeChange } from '../utils/profileScope';
import { useUser } from '../context/UserContext';
import { ISLAND_ANIMAL_PRICES } from '../utils/islandShop';

const HOMEWORLD_URL = '/homeworld/index.html?v=players152&players=1';
/** The island namespaces its localStorage by this (homeworld/src/storage-scope.mjs). */
const homeworldUrlFor = (scope: string) => `${HOMEWORLD_URL}&profile=${encodeURIComponent(scope)}`;

/** Loading screen art — the same sea and wheel as the ship deck. */
const LOADING_SEA = '/assets/images/crew-voyage-sea-pano.webp?v=1';
const LOADING_WHEEL = '/assets/images/sail-voyage-wheel.webp?v=1';
const LOADING_HOME_ICON = '/assets/images/sail-voyage-tab-home.webp?v=2';
const LOADING_WOOD = '/assets/images/wheel-background-wood.png';
const LOADING_FADE_MS = 520;
/** Give up waiting for the island's ready message this long after the frame loads. */
const LOADING_FALLBACK_MS = 12000;
const LOADING_LINES = ['Setting sail…', 'Rowing ashore…', 'Waking up your island…', 'Almost home…'];

const CARVED = '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)';

/** Toggled on <html> and <body> while My Home is mounted (CSS lives in index.html). */
const NO_PULL_REFRESH_CLASS = 'gk-no-pull-refresh';

/**
 * True when the touch landed inside an element that can scroll vertically on
 * its own (the Friends sheet list, chat transcript, …), so a downward drag
 * there must stay a normal scroll rather than being swallowed by the guard.
 */
function touchInsideScrollable(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.matches('[data-scrollable], .overflow-y-auto, .overflow-y-scroll, .overflow-auto')) return true;
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * On-brand "sailing home" screen: the deck's sea panorama drifting by, the
 * ship's wheel turning, and a wood plaque with the status. Fades in from
 * white (the ship fades to white on the way out) and fades out over the
 * island once it reports ready.
 */
const MyHomeLoading: React.FC<{ hiding: boolean; frameLoaded: boolean }> = ({ hiding, frameLoaded }) => {
  const [line, setLine] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setLine((n) => Math.min(n + 1, LOADING_LINES.length - 1)), 1700);
    return () => window.clearInterval(id);
  }, []);

  const status = hiding ? 'Welcome home!' : frameLoaded ? LOADING_LINES[Math.max(line, 2)] : LOADING_LINES[Math.min(line, 1)];

  return (
    <div
      className="absolute inset-0 z-[80] overflow-hidden"
      role="status"
      aria-live="polite"
      style={{
        opacity: hiding ? 0 : 1,
        transition: `opacity ${LOADING_FADE_MS}ms ease-in-out`,
        pointerEvents: hiding ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes gk-home-sea { from { background-position-x: 0; } to { background-position-x: -1600px; } }
        @keyframes gk-home-wheel { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes gk-home-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes gk-home-track { from { transform: translateX(-100%); } to { transform: translateX(280%); } }
      `}</style>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundColor: '#91dff9',
          backgroundImage: `url(${LOADING_SEA})`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
          backgroundPosition: '0 0',
          animation: 'gk-home-sea 90s linear infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(10,40,60,0.35) 100%)' }}
      />
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          paddingTop: 'var(--safe-area-top, 0px)',
          paddingBottom: 'var(--safe-area-bottom, 0px)',
        }}
      >
        <div className="relative" style={{ width: 'min(46vw, 220px)', height: 'min(46vw, 220px)', animation: 'gk-home-bob 3s ease-in-out infinite' }}>
          <img
            src={LOADING_WHEEL}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-contain"
            style={{
              animation: 'gk-home-wheel 2.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              filter: 'drop-shadow(0 8px 10px rgba(20,10,0,0.45))',
            }}
          />
          <img
            src={LOADING_HOME_ICON}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
            style={{ filter: 'drop-shadow(0 3px 4px rgba(20,10,0,0.4))' }}
          />
        </div>
        <div
          className="mt-7 flex w-[min(86vw,340px)] flex-col items-center rounded-[22px] px-5 pb-4 pt-3 text-center"
          style={{
            backgroundImage: `url(${LOADING_WOOD})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '3px solid #6B4423',
            boxShadow: '0 3px 0 #5c3a1a, 0 14px 36px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,230,180,0.35), inset 0 -4px 10px rgba(0,0,0,0.35)',
          }}
        >
          <span
            className="rounded-full px-3 py-0.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#7A3E12]"
            style={{
              background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)',
              boxShadow: '0 3px 0 #E09020',
              fontFamily: "'Baloo 2', 'Fredoka', sans-serif",
            }}
          >
            My Friends
          </span>
          <p
            className="mt-2.5 text-[20px] font-black leading-tight text-[#F5E6C8]"
            style={{ fontFamily: "'Baloo 2', 'Fredoka', sans-serif", textShadow: CARVED }}
          >
            {status}
          </p>
          <div
            className="mt-3 h-2.5 w-[72%] overflow-hidden rounded-full"
            style={{ background: 'rgba(42,22,12,0.6)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}
          >
            <i
              className="block h-full w-[36%] rounded-full"
              style={{
                background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)',
                animation: 'gk-home-track 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
      {/* White veil: the ship fades to white before this page, so we start white. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white"
        style={{ opacity: shown ? 0 : 1, transition: 'opacity 560ms ease-out' }}
      />
    </div>
  );
};

type DropCharacter = {
  id: string;
  name: string;
  modelUrl?: string;
  imageUrl?: string;
  sourceStoryId?: string;
};

/**
 * Players World. Opened from My Home on the ship.
 * Bible characters collected from stories can be dropped onto the island.
 */
const MyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { coins, spendCoins, addCoins } = useUser();
  const coinsRef = useRef(coins);
  const spendRef = useRef(spendCoins);
  const addRef = useRef(addCoins);
  const pendingBuyRef = useRef<{ id: string; cost: number; at: number } | null>(null);
  coinsRef.current = coins;
  spendRef.current = spendCoins;
  addRef.current = addCoins;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  /** The prayer currently being spoken in the character's ElevenLabs voice (one at a time). */
  const prayerAudioRef = useRef<{ id: string; audio: HTMLAudioElement | null; url: string | null } | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  // Native safe-area variables live on the parent document, outside the island iframe.
  useEffect(() => {
    if (!frameLoaded) return;
    const syncSafeArea = () => {
      const islandRoot = frameRef.current?.contentDocument?.documentElement;
      if (!islandRoot) return;
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top')) || 0;
      islandRoot.style.setProperty('--host-safe-area-top', `${Math.max(0, top)}px`);
    };
    syncSafeArea();
    const observer = new MutationObserver(syncSafeArea);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', syncSafeArea);
    return () => { observer.disconnect(); window.removeEventListener('resize', syncSafeArea); };
  }, [frameLoaded]);
  const [ready, setReady] = useState(false);
  // The on-brand loading screen covers both the iframe fetch and the island
  // build (the island posts gk-players-ready); a fallback timer keeps a slow
  // or silent island from hiding behind it forever.
  const [loading, setLoading] = useState(true);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [placing, setPlacing] = useState<DropCharacter | null>(null);
  /** Beds on the island vs friends living there (posted by the island as `gk-beds`). */
  const [beds, setBeds] = useState<{ beds: number; residents: number; canDrop: boolean; need: number } | null>(null);
  const [bedNotice, setBedNotice] = useState<string | null>(null);
  // Each kid profile owns its own island. The legacy (unscoped) island is handed to
  // the first profile that opens My Home after the per-profile change (copy, not move).
  const [profileScope, setProfileScope] = useState<string>(() => ensureLegacyMigration().scope);
  const [residents, setResidents] = useState<PlayersWorldResident[]>(() => readPlayersWorldResidents());
  const [collected, setCollected] = useState<UnlockedCharacter[]>(() => rewardsService.getUnlockedCharacters());
  // A profile switch while this page is open: re-read this profile's data and reload the island.
  useEffect(
    () =>
      onProfileScopeChange((scope) => {
        ensureLegacyMigration(scope);
        setProfileScope(scope);
        setCollected(rewardsService.getUnlockedCharacters());
        setResidents(readPlayersWorldResidents());
        setPlacing(null);
      }),
    [],
  );
  // The island reads saved resident models the moment it boots. Wait until
  // the CMS model refresh has copied a newly uploaded GLB onto those saves.
  const [modelsReady, setModelsReady] = useState(false);
  const [chatCharacter, setChatCharacter] = useState<UnlockedCharacter | null>(null);
  const [chatWorld, setChatWorld] = useState<WorldBrief | null>(null);

  usePreventPullToRefresh(true);

  // Disable the browser's swipe-down refresh while on My Home: lock the top
  // document (html/body overscroll none + overflow hidden via a scoped class)
  // and, as a belt-and-braces guard for iOS/WKWebView, cancel downward
  // touchmoves that start with the document at the top — except inside
  // elements that scroll on their own (Friends list, chat transcript).
  useEffect(() => {
    const root = rootRef.current;
    document.documentElement.classList.add(NO_PULL_REFRESH_CLASS);
    document.body.classList.add(NO_PULL_REFRESH_CLASS);
    if (!root) {
      return () => {
        document.documentElement.classList.remove(NO_PULL_REFRESH_CLASS);
        document.body.classList.remove(NO_PULL_REFRESH_CLASS);
      };
    }
    let startY: number | null = null;
    let inScrollable = false;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
      inScrollable = touchInsideScrollable(event.target, root);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (startY === null || inScrollable || !event.cancelable) return;
      const dy = event.touches[0].clientY - startY;
      if (dy > 0 && window.scrollY <= 0) event.preventDefault();
    };
    const onTouchEnd = () => {
      startY = null;
      inScrollable = false;
    };
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      document.documentElement.classList.remove(NO_PULL_REFRESH_CLASS);
      document.body.classList.remove(NO_PULL_REFRESH_CLASS);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const post = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    let cancel = false;
    const refresh = rewardsService.refreshUnlockedCharactersFromCms().catch(() => false);
    const cap = new Promise((resolve) => window.setTimeout(resolve, 8000));
    const apply = () => {
      if (cancel) return;
      setCollected(rewardsService.getUnlockedCharacters());
      setResidents(readPlayersWorldResidents());
      setModelsReady(true);
      post({ type: 'gk-residents-sync' });
    };
    void Promise.race([refresh, cap]).finally(apply);
    void refresh.finally(apply);
    return () => {
      cancel = true;
    };
  }, [post]);

  const stopPrayerAudio = useCallback((id?: string) => {
    const current = prayerAudioRef.current;
    if (!current || (id && current.id !== id)) return;
    prayerAudioRef.current = null;
    try {
      current.audio?.pause();
    } catch {
      /* already stopped */
    }
    if (current.url) URL.revokeObjectURL(current.url);
  }, []);

  /**
   * Speak a prayer in the praying character's own ElevenLabs voice (the same voice as crew chat)
   * and keep the island informed so the kneeling lasts as long as the words do.
   */
  const speakPrayer = useCallback(
    async (req: { id: string; characterId: string; text: string; tts: string }) => {
      const reply = (status: 'playing' | 'ended' | 'failed', duration?: number) =>
        post({ type: 'gk-prayer-voice', id: req.id, status, duration });
      stopPrayerAudio();
      const voiceId = rewardsService.getUnlockedCharacters().find((c) => c.id === req.characterId)?.voiceId;
      if (!voiceId) {
        reply('failed');
        return;
      }
      prayerAudioRef.current = { id: req.id, audio: null, url: null };
      const url = await fetchTtsAudioUrl(voiceId, req.tts || req.text);
      if (!url || prayerAudioRef.current?.id !== req.id) {
        if (url) URL.revokeObjectURL(url);
        if (prayerAudioRef.current?.id === req.id) prayerAudioRef.current = null;
        reply('failed');
        return;
      }
      const audio = new Audio(url);
      prayerAudioRef.current = { id: req.id, audio, url };
      let announced = false;
      const announce = () => {
        if (announced || prayerAudioRef.current?.id !== req.id) return;
        announced = true;
        reply('playing', Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
      };
      audio.addEventListener('loadedmetadata', announce, { once: true });
      audio.addEventListener('playing', announce, { once: true });
      audio.addEventListener('ended', () => {
        if (prayerAudioRef.current?.id === req.id) {
          stopPrayerAudio(req.id);
          reply('ended');
        }
      }, { once: true });
      audio.addEventListener('error', () => {
        if (prayerAudioRef.current?.id === req.id) {
          stopPrayerAudio(req.id);
          reply(announced ? 'ended' : 'failed');
        }
      }, { once: true });
      try {
        await audio.play();
        announce();
      } catch {
        // Autoplay blocked (no gesture yet) → let the island fall back to the browser voice.
        stopPrayerAudio(req.id);
        reply('failed');
      }
    },
    [post, stopPrayerAudio],
  );

  useEffect(() => () => stopPrayerAudio(), [stopPrayerAudio]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; residents?: PlayersWorldResident[]; world?: WorldBrief | null; character?: { id?: string; name?: string; imageUrl?: string; sourceStoryId?: string }; beds?: number; canDrop?: boolean; need?: number; denied?: string } | null;
      if (!data?.type) return;
      if (data.type === 'gk-back-to-ship') navigate('/crew');
      if (data.type === 'gk-resident-pray') {
        const pray = data as { id?: unknown; text?: unknown; tts?: unknown };
        if (typeof pray.id === 'string' && data.character?.id && typeof pray.text === 'string') {
          void speakPrayer({ id: pray.id, characterId: data.character.id, text: pray.text, tts: typeof pray.tts === 'string' ? pray.tts : pray.text });
        }
      }
      if (data.type === 'gk-prayer-stop') stopPrayerAudio(typeof (data as { id?: unknown }).id === 'string' ? (data as { id: string }).id : undefined);
      if (data.type === 'gk-beds' && typeof data.beds === 'number') {
        setBeds({ beds: data.beds, residents: Number((data as { residents?: unknown }).residents) || 0, canDrop: !!data.canDrop, need: Number(data.need) || 0 });
        if (data.denied) {
          setPlacing(null);
          setBedNotice(`${data.denied} needs a bed first. Build or upgrade a home on the island, then come back.`);
        }
      }
      if (data.type === 'gk-open-friends') {
        setCollected(rewardsService.getUnlockedCharacters());
        setFriendsOpen(true);
      }
      if (data.type === 'gk-resident-talk' && data.character?.id && data.character.name) {
        setChatWorld(data.world ?? null);
        const known = rewardsService.getUnlockedCharacters().find((c) => c.id === data.character?.id);
        setChatCharacter(known || {
          id: data.character.id,
          name: data.character.name,
          imageUrl: data.character.imageUrl || '',
          sourceStoryId: data.character.sourceStoryId,
        });
      }
      if (data.type === 'gk-players-ready' || data.type === 'gk-resident-placed') {
        setReady(true);
        setResidents(Array.isArray(data.residents) ? data.residents : readPlayersWorldResidents());
        if (data.type === 'gk-resident-placed') setPlacing(null);
        post({ type: 'gk-coins', balance: coinsRef.current });
      }
      if (data.type === 'gk-coins-please') post({ type: 'gk-coins', balance: coinsRef.current });
      if (data.type === 'gk-buy') {
        const buy = data as { id?: unknown; cost?: unknown; item?: unknown };
        const id = typeof buy.id === 'string' ? buy.id : '';
        const price = ISLAND_ANIMAL_PRICES[id];
        const cost = Number(buy.cost);
        if (!id || price == null || cost !== price) {
          post({ type: 'gk-buy-result', ok: false, id, balance: coinsRef.current, reason: 'That animal is not for sale.' });
          return;
        }
        if (!spendRef.current(price, `Island ${typeof buy.item === 'string' ? buy.item : id}`)) {
          post({ type: 'gk-buy-result', ok: false, id, balance: coinsRef.current, reason: `Need ${price - coinsRef.current} coins.` });
          return;
        }
        pendingBuyRef.current = { id, cost: price, at: Date.now() };
        post({ type: 'gk-buy-result', ok: true, id, balance: coinsRef.current - price });
      }
      if (data.type === 'gk-refund') {
        const refund = data as { id?: unknown; cost?: unknown };
        const pending = pendingBuyRef.current;
        if (pending && pending.id === refund.id && pending.cost === Number(refund.cost) && Date.now() - pending.at < 120000) {
          pendingBuyRef.current = null;
          addRef.current(pending.cost, 'Island purchase cancelled', 'other');
          post({ type: 'gk-coins', balance: coinsRef.current + pending.cost });
        }
      }
      if (data.type === 'gk-buy-commit') pendingBuyRef.current = null;
      if (data.type === 'gk-dev-grant') {
        const host = window.location.hostname;
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        const amount = Math.max(0, Math.min(100000, Math.floor(Number((data as { amount?: unknown }).amount) || 0)));
        if (amount > 0) addRef.current(amount, 'Island test grant', 'other');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, speakPrayer, stopPrayerAudio]);

  useEffect(() => {
    if (!ready) return;
    // Belt and braces: the island already got the scope from its URL; if it ever
    // disagrees (stale frame) it reloads itself under the right profile.
    post({ type: 'gk-profile', scope: profileScope });
    post({ type: 'gk-residents-sync' });
  }, [post, ready, profileScope]);

  useEffect(() => {
    if (!ready) return;
    post({ type: 'gk-coins', balance: coins });
  }, [post, ready, coins]);

  useEffect(() => {
    if (ready) {
      setLoading(false);
      return;
    }
    if (!frameLoaded) return;
    const id = window.setTimeout(() => setLoading(false), LOADING_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [frameLoaded, ready]);

  useEffect(() => {
    if (loading) return;
    const id = window.setTimeout(() => setOverlayMounted(false), LOADING_FADE_MS);
    return () => window.clearTimeout(id);
  }, [loading]);

  const residentIds = useMemo(() => new Set(residents.map((r) => r.id)), [residents]);
  /** Collected story friends not yet living on the island. */
  const waiting = useMemo(() => collected.filter((c) => !residentIds.has(c.id)), [collected, residentIds]);
  const waitingCount = waiting.length;
  const nextFriend = waiting[0];
  useEffect(() => {
    if (!ready) return;
    post({ type: 'gk-friends-waiting', count: waitingCount, name: nextFriend?.name || '' });
  }, [post, ready, waitingCount, nextFriend?.name]);

  const startDrop = (character: UnlockedCharacter) => {
    const payload: DropCharacter = {
      id: character.id,
      name: character.name,
      modelUrl: character.modelUrl,
      imageUrl: character.imageUrl,
      sourceStoryId: character.sourceStoryId,
    };
    setFriendsOpen(false);
    setPlacing(payload);
    post({ type: 'gk-resident-drop', character: payload });
  };

  const cancelDrop = () => {
    setPlacing(null);
    post({ type: 'gk-resident-drop', character: null });
  };

  const bringBack = (id: string) => {
    post({ type: 'gk-resident-remove', id });
  };

  const goToFriend = (id: string) => {
    post({ type: 'gk-resident-select', id });
    setFriendsOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 h-[100dvh] min-h-0 bg-[#315d41] flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {chatCharacter && (
        <CrewChatPopup
          variant="island"
          character={chatCharacter}
          world={chatWorld}
          onClose={() => setChatCharacter(null)}
          // Chat is just for talking. Jobs are given with the Task button beside the character on the island.
        />
      )}

      {/* "Back To Ship" lives inside the island's own HUD (homeworld main.jsx)
          so it hides with the rest of the controls; the island posts
          gk-back-to-ship and we navigate. While the island is still loading
          there is a plain fallback so the kid is never stuck. */}
      {!ready && (
        <button
          type="button"
          onClick={() => navigate('/crew')}
          className="fixed z-[60] flex items-center gap-1 border-0 bg-transparent p-0 active:scale-95"
          style={{
            bottom: 'max(14px, calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 10px))',
            left: 'max(10px, env(safe-area-inset-left, 0px))',
          }}
          aria-label="Back to the ship"
        >
          <img src="/assets/images/sail-tab-ship.png" alt="" draggable={false} className="h-16 w-16 object-contain pointer-events-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }} />
          <span className="pointer-events-none select-none text-[15px] font-black leading-tight tracking-wide text-[#fff6df]" style={{ textShadow: '0 2px 0 #1d3d28, 0 3px 6px rgba(0,0,0,0.45)' }}>Back To Ship</span>
        </button>
      )}

      {/* The Friends button lives in the island's side buttons (homeworld main.jsx);
          the island posts gk-open-friends and we open the sheet. */}

      {placing && (
        <div
          className="fixed z-[60] left-1/2 -translate-x-1/2 rounded-2xl bg-[#3d2414]/95 px-4 py-3 text-center text-white shadow-lg"
          style={{ bottom: 'max(18px, calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 72px))' }}
          role="status"
        >
          <p className="font-bold">Tap the grass to drop off {placing.name}</p>
          <button type="button" className="mt-2 underline" onClick={cancelDrop}>
            Cancel
          </button>
        </div>
      )}

      {friendsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" onClick={() => setFriendsOpen(false)}>
          <section
            className="w-full max-w-md rounded-t-3xl bg-[#fff8ee] p-5 text-[#3d2414] shadow-2xl"
            style={{ paddingBottom: 'max(20px, calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 16px))' }}
            role="dialog"
            aria-label="Story friends"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8a5a32]">Players World</p>
                <h2 className="text-xl font-bold">Story friends</h2>
              </div>
              <button type="button" className="text-sm font-bold text-[#8a5a32]" onClick={() => setFriendsOpen(false)}>
                Close
              </button>
            </div>
            <p className="mb-2 text-sm text-[#6b4423]">
              Characters you meet in stories can live here. Drop one off on the grass.
            </p>
            {beds && (
              <p className={`mb-3 rounded-2xl px-4 py-2 text-sm font-bold ${beds.canDrop ? 'bg-[#e7f1d9] text-[#2f5a32]' : 'bg-[#fbe3c9] text-[#8a4b1e]'}`}>
                🛏 {beds.beds} bed{beds.beds === 1 ? '' : 's'} for {beds.residents} friend{beds.residents === 1 ? '' : 's'}
                {beds.canDrop ? ' · room for one more' : ' · everyone needs a bed · build or upgrade a home first'}
              </p>
            )}
            {bedNotice && (
              <p className="mb-3 rounded-2xl bg-[#fbe3c9] px-4 py-2 text-sm text-[#8a4b1e]" role="status">
                {bedNotice}
              </p>
            )}
            {collected.length === 0 ? (
              <p className="rounded-2xl bg-[#f4e2c4] px-4 py-3 text-sm">
                Finish a story to meet a Bible friend, then come back and drop them off.
              </p>
            ) : (
              <ul className="max-h-[46vh] space-y-2 overflow-y-auto">
                {collected.map((character) => {
                  const home = residentIds.has(character.id);
                  return (
                    <li key={character.id} className="flex items-center gap-3 rounded-2xl bg-[#f7efe2] px-3 py-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        disabled={!home}
                        aria-label={home ? `Go to ${character.name}` : character.name}
                        onClick={() => home && goToFriend(character.id)}
                      >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7c99a] text-lg font-bold">
                        {character.imageUrl ? (
                          <img src={character.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          character.name.slice(0, 1)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate">{character.name}</strong>
                        <small className="text-[#8a5a32]">{home ? 'On your island · tap to go to them' : 'From your stories'}</small>
                      </span>
                      </button>
                      {home ? (
                        <button type="button" className="rounded-full bg-white px-3 py-2 text-sm font-bold" onClick={() => bringBack(character.id)}>
                          Bring to Ship
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full bg-[#e4534a] px-3 py-2 text-sm font-bold text-white disabled:bg-[#cdb9a0] disabled:text-white/80"
                          disabled={!!beds && !beds.canDrop}
                          title={beds && !beds.canDrop ? `Needs a bed · ${beds.beds} bed${beds.beds === 1 ? '' : 's'} for ${beds.residents} friend${beds.residents === 1 ? '' : 's'}` : undefined}
                          onClick={() => startDrop(character)}
                          data-gk-dropoff={character.id}
                        >
                          {beds && !beds.canDrop ? 'Needs a bed' : 'Drop off'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {residents.length > 0 && (
              <button
                type="button"
                className="mt-3 min-h-[40px] w-full text-center text-xs font-bold text-[#8a5a32] underline underline-offset-4"
                onClick={() => {
                  writeHomeOnboarding({ step: 'tour', done: false, tourStep: 0 });
                  setFriendsOpen(false);
                  post({ type: 'gk-onboarding', phase: 'tour', replay: true });
                }}
              >
                Replay the island tour
              </button>
            )}
          </section>
        </div>
      )}

      {overlayMounted && <MyHomeLoading hiding={!loading} frameLoaded={frameLoaded} />}

      {/* First visit: read a story → drop off a friend → the island runs its tour (components/home/HomeOnboarding.tsx).
          Nothing pops up until the island has reported ready — loading screens stay clear. */}
      {modelsReady && ready && (
        <HomeOnboarding
          ready={ready}
          collected={collected}
          residents={residents}
          placing={placing}
          friendsOpen={friendsOpen}
          onOpenFriends={() => {
            setCollected(rewardsService.getUnlockedCharacters());
            setFriendsOpen(true);
          }}
          post={post}
        />
      )}

      {/* touch-action none: a finger on the frame wrapper never starts a vertical document pan (pull-to-refresh). */}
      <div className="flex-1 relative min-h-0 overscroll-none" style={{ overscrollBehavior: 'none', touchAction: 'none' }}>
        {modelsReady && (
        <iframe
          ref={frameRef}
          src={homeworldUrlFor(profileScope)}
          title="Players World"
          className="w-full h-full border-0 overscroll-none"
          allow="autoplay; fullscreen; pointer-lock"
          onLoad={() => setFrameLoaded(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overscrollBehavior: 'none',
          }}
        />
        )}
      </div>
    </div>
  );
};

export default MyHomePage;
