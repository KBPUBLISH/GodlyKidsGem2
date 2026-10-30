import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NameTrialPaywall from '../components/onboarding/NameTrialPaywall';
import PassPhoneHandoff from '../components/onboarding/PassPhoneHandoff';
import PerryFlyIn from '../components/onboarding/PerryFlyIn';
import WoodBackButton from '../components/WoodBackButton';
import { useUser } from '../context/UserContext';
import { activityTrackingService } from '../services/activityTrackingService';
import { noteJourneyStep } from '../utils/journeyStudy';
import { LIVING_TEST_BUILD } from '../utils/livingTestMode';
import { warmPreviewNextScreen } from '../utils/previewWarmup';
import ChooseAvatar from '../components/onboarding/ChooseAvatar';
import {getLivingAvatar,livingAvatarForProfile} from '../shared/livingAvatars.mjs';
import {
  ONBOARDING_FAMILY_BG_POSTER,
  ONBOARDING_FAMILY_BG_VIDEO,
  markDiscoverShipPending,
  startOnboardingJourney,
} from '../utils/onboardingJourney';
import {
  PERRY_ASK_KID_LINE,
  PERRY_ASK_KID_TTS,
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

type Phase = 'handoff' | 'ask' | 'avatar' | 'paywall' | 'ready' | 'depart';
type Holder = 'parent' | 'kid';

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
  useEffect(() => LIVING_TEST_BUILD ? warmPreviewNextScreen('ship') : undefined, []);
  const navigate = useNavigate();
  const { addKid, kids, currentProfileId, switchProfile, updateKid, setEquippedAvatar } = useUser();
  const initialKid = useRef(kids.find(kid=>kid.id===currentProfileId) || kids[0]);
  const targetKidId = useRef(initialKid.current?.id || crypto.randomUUID?.() || Date.now().toString());
  const [selectedAvatarId,setSelectedAvatarId] = useState(()=>livingAvatarForProfile(initialKid.current).id);
  const [pendingProfile,setPendingProfile] = useState<string|null>(null);
  const savedKid = useRef(false);
  const [phase, setPhase] = useState<Phase>('handoff');
  const [holder, setHolder] = useState<Holder | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [savedName, setSavedName] = useState('');
  const [departing, setDeparting] = useState(false);
  const paywallChoice = useRef<'trial' | 'tour' | null>(null);
  const [formVisible, setFormVisible] = useState(false);

  const readyCopy = useMemo(() => buildPerryReadyCopy(savedName), [savedName]);

  useEffect(()=>{
    if(!pendingProfile || !kids.some(kid=>kid.id===pendingProfile))return;
    // Switch after the new profile exists; a timeout would capture the old kids array.
    if(currentProfileId!==pendingProfile) switchProfile(pendingProfile);
    else if(LIVING_TEST_BUILD) setEquippedAvatar(getLivingAvatar(selectedAvatarId).portrait);
    setPendingProfile(null);
  },[pendingProfile,kids,currentProfileId,switchProfile,setEquippedAvatar,selectedAvatarId]);

  useEffect(() => {
    if (LIVING_TEST_BUILD) return; // Speak the current line only; don't queue the entire tour.
    preloadPerrySpeech(PERRY_HELLO_TTS);
    preloadPerrySpeech(PERRY_ASK_TTS);
    preloadPerrySpeech(PERRY_ASK_KID_TTS);
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
        ? holder === 'kid'
          ? PERRY_ASK_KID_LINE
          : PERRY_ASK_LINE
        : phase === 'ready' || phase === 'paywall'
            ? readyCopy.line
            : phase === 'depart'
              ? PERRY_WOOHOO_LINE
              : null;

  const tts =
    phase === 'handoff'
      ? PERRY_HELLO_TTS
      : phase === 'ask'
        ? holder === 'kid'
          ? PERRY_ASK_KID_TTS
          : PERRY_ASK_TTS
        : phase === 'ready' || phase === 'paywall'
            ? readyCopy.tts
            : phase === 'depart'
              ? PERRY_WOOHOO_TTS
              : null;

  const canSubmit = name.trim().length > 0 && Number(age) >= 1 && Number(age) <= 17;

  const saveKid = () => {
    const trimmed = name.trim();
    if (!canSubmit || savedKid.current) return;
    savedKid.current=true;
    const parsedAge = parseInt(age, 10);
    const existing = kids.find(kid=>kid.id===targetKidId.current);
    const id = targetKidId.current;
    const chosen = getLivingAvatar(selectedAvatarId);
    const portrait = LIVING_TEST_BUILD ? chosen.portrait : DEFAULT_HEAD;
    if (!existing) {
      addKid({
        id,
        name: trimmed,
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        avatarSeed: portrait,
        ...(LIVING_TEST_BUILD ? {worldAvatarId:chosen.id} : {}),
        coins: 500,
        coinTransactions: [],
        ownedItems: ['f1', 'anim1'],
        unlockedVoices: [],
        avatar: portrait,
        frame: 'border-[#8B4513]',
        hat: null,
        body: null,
        leftArm: null,
        rightArm: null,
        legs: null,
        animation: 'anim-breathe',
      });
    } else {
      updateKid(id, {
        name: trimmed,
        age: Number.isFinite(parsedAge) ? parsedAge : existing.age,
        ...(LIVING_TEST_BUILD ? {worldAvatarId:chosen.id,avatarSeed:portrait,avatar:portrait} : {}),
      });
    }
    setSavedName(trimmed);
    setPendingProfile(id);
    preloadPerrySpeech(buildPerryReadyCopy(trimmed).tts);
    preloadPerrySpeech(buildPerryIslandCopy(trimmed).tts);
    activityTrackingService.trackOnboardingEvent('perry_name_entered', {
      kidsCount: 1,
    });
    setPhase('paywall');
  };

  const submitDetails = () => {
    if(!canSubmit)return;
    if(LIVING_TEST_BUILD) setPhase('avatar');
    else saveKid();
  };

  const flyToMap = () => {
    if (phase === 'depart') return;
    setPhase('depart');
    activityTrackingService.trackOnboardingEvent('perry_woohoo');
    window.setTimeout(() => setDeparting(true), 720);
  };

  const goToMap = () => {
    startOnboardingJourney();
    const choice = paywallChoice.current;
    if (choice) {
      noteJourneyStep('paywall_shown', { source: 'child-name' });
      noteJourneyStep(choice === 'trial' ? 'paywall_clicked' : 'paywall_dismissed', {
        source: 'child-name',
      });
      if (choice === 'trial') noteJourneyStep('trial_started', { source: 'child-name' });
    }
    markDiscoverShipPending();
    navigate('/crew', {
      replace: true,
      state: {
        onboardingJourney: true,
        discoverShip: true,
        kidName: savedName || name.trim(),
      },
    });
  };

  if(phase==='avatar') return <ChooseAvatar selectedId={selectedAvatarId} onSelect={setSelectedAvatarId} onBack={()=>setPhase('ask')} onConfirm={saveKid}/>;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#7EC8E8]">
      <img
        src={ONBOARDING_FAMILY_BG_POSTER}
        alt=""
        aria-hidden
        className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none select-none"
      />
      {!LIVING_TEST_BUILD && <video
        src={ONBOARDING_FAMILY_BG_VIDEO}
        poster={ONBOARDING_FAMILY_BG_POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none select-none"
        aria-hidden
      />}

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
        holdY={phase === 'handoff' ? 0.55 : phase === 'ready' || phase === 'paywall' ? 0.48 : 0.32}
        bubbleNearBird={phase === 'handoff'}
        motion="meet"
        onReady={() => setReady(true)}
        onDeparted={goToMap}
        underlay={
          phase === 'handoff' ? (
            <div className="flex flex-col items-center justify-end h-full pb-[max(1.5rem,var(--safe-area-bottom,0px))]">
              <PassPhoneHandoff
                variant="underlay"
                onSelect={(who) => {
                  setHolder(who);
                  activityTrackingService.trackOnboardingEvent(
                    who === 'parent' ? 'perry_holder_parent' : 'perry_holder_kid',
                  );
                  setPhase('ask');
                }}
              />
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
                  submitDetails();
                }}
              >
                <input
                  autoFocus={holder !== 'kid'}
                  type="text"
                  value={name}
                  maxLength={18}
                  autoComplete="given-name"
                  placeholder={holder === 'kid' ? 'Your name' : "Child's name"}
                  aria-label={holder === 'kid' ? 'Your name' : "Child's name"}
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
                  placeholder={holder === 'kid' ? 'Your age' : "Child's age"}
                  aria-label={holder === 'kid' ? 'Your age' : "Child's age"}
                  className={FIELD}
                  style={{ fontFamily: BUBBLE }}
                  onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                />
                <GoldButton onClick={submitDetails} disabled={!canSubmit}>
                  {holder === 'kid' ? "That's me!" : 'Continue →'}
                </GoldButton>
              </form>
            )}
            {phase === 'ready' && <GoldButton onClick={flyToMap}>Continue →</GoldButton>}
          </div>
        }
      />
      {phase === 'paywall' && (
        <NameTrialPaywall
          childName={savedName || name}
          onTakeTour={() => {
            paywallChoice.current = 'tour';
            activityTrackingService.trackOnboardingEvent('perry_name_paywall_tour');
            flyToMap();
          }}
          onTrialStarted={(plan) => {
            paywallChoice.current = 'trial';
            activityTrackingService.trackOnboardingEvent('perry_name_paywall_trial', { planType: plan });
            flyToMap();
          }}
        />
      )}
    </div>
  );
};

export default PerryMeetPage;
