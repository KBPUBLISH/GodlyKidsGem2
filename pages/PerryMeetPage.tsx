import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PassPhoneHandoff from '../components/onboarding/PassPhoneHandoff';
import PerryFlyIn from '../components/onboarding/PerryFlyIn';
import WoodBackButton from '../components/WoodBackButton';
import { useUser } from '../context/UserContext';
import { activityTrackingService } from '../services/activityTrackingService';
import {
  ONBOARDING_FAMILY_BG_POSTER,
  ONBOARDING_FAMILY_BG_VIDEO,
  startOnboardingJourney,
} from '../utils/onboardingJourney';
import {
  PERRY_ASK_LINE,
  PERRY_ASK_TTS,
  PERRY_HELLO_LINE,
  PERRY_HELLO_TTS,
  PERRY_WOOHOO_LINE,
  PERRY_WOOHOO_TTS,
  buildPerryIslandCopy,
  buildPerryReadyCopy,
  preloadPerrySpeech,
} from '../utils/perrySpeech';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";
const DEFAULT_HEAD = '/avatars/heads/head-1.png';

type Phase = 'handoff' | 'ask' | 'ready' | 'depart';

const FIELD =
  'w-full bg-[#FFF8E7] border-2 border-[#8B5A24] rounded-2xl px-4 py-3 text-[#3E1F07] font-extrabold text-[1.15rem] placeholder:text-[#8B4513]/35 placeholder:font-semibold focus:outline-none focus:border-[#E8C43D] focus:ring-2 focus:ring-[#E8C43D]/35';

const GoldButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  flush?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, flush, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="pointer-events-auto w-full max-w-sm px-10 py-3.5 rounded-full font-extrabold text-[1.55rem] leading-none active:scale-[0.97] transition-transform disabled:opacity-45 disabled:active:scale-100"
    style={{
      fontFamily: BUBBLE,
      background: GOLD,
      color: NAVY,
      boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
      marginBottom: flush
        ? 0
        : 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 4.25rem)',
    }}
  >
    {children}
  </button>
);

const PerryMeetPage: React.FC = () => {
  const navigate = useNavigate();
  const { addKid, kids, switchProfile, updateKid, setEquippedAvatar } = useUser();
  const [phase, setPhase] = useState<Phase>('handoff');
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [savedName, setSavedName] = useState('');
  const [departing, setDeparting] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  const readyCopy = useMemo(() => buildPerryReadyCopy(savedName), [savedName]);

  useEffect(() => {
    preloadPerrySpeech(PERRY_HELLO_TTS);
    preloadPerrySpeech(PERRY_ASK_TTS);
    preloadPerrySpeech(PERRY_WOOHOO_TTS);
  }, []);

  useEffect(() => {
    if (phase !== 'ask') {
      setFormVisible(false);
      return;
    }
    const id = window.setTimeout(() => setFormVisible(true), 420);
    return () => window.clearTimeout(id);
  }, [phase]);

  const bubble =
    phase === 'handoff'
      ? PERRY_HELLO_LINE
      : phase === 'ask'
        ? PERRY_ASK_LINE
        : phase === 'ready'
            ? readyCopy.line
            : phase === 'depart'
              ? PERRY_WOOHOO_LINE
              : null;

  const tts =
    phase === 'handoff'
      ? PERRY_HELLO_TTS
      : phase === 'ask'
        ? PERRY_ASK_TTS
        : phase === 'ready'
            ? readyCopy.tts
            : phase === 'depart'
              ? PERRY_WOOHOO_TTS
              : null;

  const canSubmit = name.trim().length > 0 && Number(age) >= 1 && Number(age) <= 17;

  const saveKid = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedAge = parseInt(age, 10);
    const existing = kids[0];
    const id = existing?.id || Date.now().toString();
    if (!existing) {
      addKid({
        id,
        name: trimmed,
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        avatarSeed: DEFAULT_HEAD,
        coins: 500,
        coinTransactions: [],
        ownedItems: ['f1', 'anim1'],
        unlockedVoices: [],
        avatar: DEFAULT_HEAD,
        frame: 'border-[#8B4513]',
        hat: null,
        body: null,
        leftArm: null,
        rightArm: null,
        legs: null,
        animation: 'anim-breathe',
      });
      window.setTimeout(() => switchProfile(id), 80);
    } else if (existing.name !== trimmed || existing.age !== parsedAge) {
      updateKid(id, {
        name: trimmed,
        age: Number.isFinite(parsedAge) ? parsedAge : existing.age,
      });
    }
    setSavedName(trimmed);
    if (!existing) setEquippedAvatar(DEFAULT_HEAD);
    preloadPerrySpeech(buildPerryReadyCopy(trimmed).tts);
    preloadPerrySpeech(buildPerryIslandCopy(trimmed).tts);
    activityTrackingService.trackOnboardingEvent('perry_name_entered', {
      kidsCount: 1,
    });
    setPhase('ready');
  };

  const flyToMap = () => {
    if (phase === 'depart') return;
    setPhase('depart');
    activityTrackingService.trackOnboardingEvent('perry_woohoo');
    window.setTimeout(() => setDeparting(true), 720);
  };

  const goToMap = () => {
    startOnboardingJourney();
    navigate('/map', {
      replace: true,
      state: {
        onboardingJourney: true,
        perryArrive: true,
        kidName: savedName || name.trim(),
      },
    });
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#7EC8E8]">
      <img
        src={ONBOARDING_FAMILY_BG_POSTER}
        alt=""
        aria-hidden
        className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none select-none"
      />
      <video
        src={ONBOARDING_FAMILY_BG_VIDEO}
        poster={ONBOARDING_FAMILY_BG_POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none select-none"
        aria-hidden
      />

      {!departing && (
        <WoodBackButton
          onClick={() => navigate('/', { replace: true, state: { replaySplash: true } })}
          className="fixed z-[50] w-12 h-12 pointer-events-auto"
          style={{
            top: 'max(12px, calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 8px))',
            left: 'max(10px, env(safe-area-inset-left, 0px))',
          }}
          aria-label="Back to splash"
        />
      )}

      <PerryFlyIn
        bubble={bubble}
        tts={ready ? tts : null}
        departing={departing}
        holdY={phase === 'handoff' ? 0.55 : phase === 'ready' ? 0.48 : 0.32}
        bubbleNearBird={phase === 'handoff'}
        motion="meet"
        onReady={() => setReady(true)}
        onDeparted={goToMap}
        underlay={
          phase === 'handoff' ? (
            <div className="flex flex-col items-center justify-end h-full pb-[11rem]">
              <PassPhoneHandoff variant="underlay" direction="to-parent" />
            </div>
          ) : undefined
        }
        footer={
          <div className="w-full max-w-sm flex flex-col items-center">
            {phase === 'ask' && (
              <form
                className="w-full mb-3 space-y-2.5 transition-all duration-500 ease-out"
                style={{
                  pointerEvents: formVisible ? 'auto' : 'none',
                  opacity: formVisible ? 1 : 0,
                  transform: formVisible ? 'translateY(0)' : 'translateY(18px)',
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) saveKid();
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={name}
                  maxLength={18}
                  autoComplete="given-name"
                  placeholder="Child's name"
                  aria-label="Child's name"
                  className={FIELD}
                  style={{ fontFamily: BUBBLE }}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={age}
                  min={1}
                  max={17}
                  placeholder="Your age"
                  aria-label="Your age"
                  className={FIELD}
                  style={{ fontFamily: BUBBLE }}
                  onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                />
                <GoldButton onClick={saveKid} disabled={!canSubmit}>
                  That&apos;s me!
                </GoldButton>
              </form>
            )}
            {phase === 'handoff' && (
              <GoldButton
                onClick={() => {
                  activityTrackingService.trackOnboardingEvent('pass_phone_continue');
                  setPhase('ask');
                }}
              >
                Continue →
              </GoldButton>
            )}
            {phase === 'ready' && <GoldButton onClick={flyToMap}>Continue →</GoldButton>}
          </div>
        }
      />
    </div>
  );
};

export default PerryMeetPage;
