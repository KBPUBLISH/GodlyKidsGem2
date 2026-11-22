import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import SelfieCapture from '../features/SelfieCapture';
import { CHARACTER_STYLES } from '../features/CharacterStyleSelector';
import { getApiBaseUrl } from '../../services/apiService';
import { activityTrackingService } from '../../services/activityTrackingService';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";

type Props = {
  childName: string;
  childId: string;
  onComplete: (result: { url: string; styleId: string; selfie: string }) => void;
  onSkip: () => void;
};

function GoldButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full max-w-sm px-8 py-3.5 rounded-full font-extrabold text-[1.4rem] leading-none active:scale-[0.97] transition-transform disabled:opacity-45 disabled:active:scale-100"
      style={{
        fontFamily: BUBBLE,
        background: GOLD,
        color: NAVY,
        boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
      }}
    >
      {children}
    </button>
  );
}

const OnboardingCreateCharacter: React.FC<Props> = ({ childName, childId, onComplete, onSkip }) => {
  const [styleId, setStyleId] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [showSelfie, setShowSelfie] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateCharacter = async (image: string, chosenStyle: string) => {
    setGenerating(true);
    setError(null);
    try {
      const base = getApiBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/character/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image,
          styleId: chosenStyle,
          settingId: 'shipDeck',
          childId,
          childName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl || null;
      if (!url) {
        setError(data.error || data.message || 'Could not create your character. Try again.');
        return;
      }
      setAvatarUrl(url);
      activityTrackingService.trackOnboardingEvent('onboarding_character_created').catch(() => {});
    } catch {
      setError('Could not create your character. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 overflow-y-auto no-scrollbar px-5 flex flex-col items-center">
      <div
        className="w-full max-w-md flex flex-col items-center pt-16 pb-8"
        style={{ paddingBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 5rem)' }}
      >
        <h1
          className="text-center font-extrabold leading-[0.95] text-[2.1rem] sm:text-[2.4rem] mt-1"
          style={{ fontFamily: BUBBLE, color: NAVY, textShadow: '0 2px 0 #fff' }}
        >
          Create your character
        </h1>
        <p
          className="mt-2 mb-4 text-center text-[1.05rem] font-semibold leading-snug max-w-[20rem]"
          style={{ fontFamily: BUBBLE, color: NAVY }}
        >
          {avatarUrl
            ? `That's you, ${childName}!`
            : `Pick a style, then take a selfie — ${childName} will appear full-body on the Godly Ship!`}
        </p>

        {avatarUrl ? (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="relative w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden shadow-xl border-4 border-[#E8C43D] bg-[#FFF8E7]">
              <img src={avatarUrl} alt={`${childName}'s character`} className="w-full h-full object-cover object-center" />
            </div>
            <GoldButton
              onClick={() => {
                if (avatarUrl && styleId && selfie) {
                  onComplete({ url: avatarUrl, styleId, selfie });
                }
              }}
            >
              Continue →
            </GoldButton>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[300px] mb-4">
              {CHARACTER_STYLES.map((style) => {
                const selected = styleId === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setStyleId(style.id);
                      if (!selfie) setShowSelfie(true);
                    }}
                    className="relative w-full bg-transparent border-0 p-0 active:scale-[0.97] transition-transform"
                    aria-label={style.name}
                    aria-pressed={selected}
                  >
                    <img
                      src={`/assets/images/create-story-style-${style.id}.webp`}
                      alt=""
                      className="w-full h-auto object-contain drop-shadow-md pointer-events-none"
                    />
                    {selected && (
                      <span
                        className="absolute inset-[5%] rounded-full pointer-events-none"
                        style={{ boxShadow: `0 0 0 4px ${GOLD}, 0 0 0 7px ${NAVY}` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mb-3 text-center text-sm font-bold text-red-700 bg-white/80 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {error && selfie && styleId && (
              <GoldButton
                onClick={() => {
                  activityTrackingService.trackOnboardingEvent('onboarding_character_create_tapped').catch(() => {});
                  void generateCharacter(selfie, styleId);
                }}
              >
                Try again
              </GoldButton>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="mt-3 font-extrabold text-[1.05rem] underline-offset-4 hover:underline"
              style={{ fontFamily: BUBBLE, color: NAVY }}
            >
              Skip for now
            </button>
          </>
        )}
      </div>
      </div>

      {createPortal(
        <>
      <SelfieCapture
        isOpen={showSelfie}
        onCapture={(image) => {
          const data = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
          const chosenStyle = styleId;
          setSelfie(data);
          setShowSelfie(false);
          if (!chosenStyle) return;
          activityTrackingService.trackOnboardingEvent('onboarding_character_create_tapped').catch(() => {});
          void generateCharacter(data, chosenStyle);
        }}
        onClose={() => setShowSelfie(false)}
        childName={childName}
        frameOverlayImageUrl="/assets/images/create-story-selfie-porthole-overlay.webp"
      />

      {generating && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black/55 px-6">
          <div className="w-full max-w-xs rounded-3xl bg-[#FFF8E7] px-6 py-8 flex flex-col items-center text-center shadow-xl">
            <Loader2 className="w-12 h-12 animate-spin mb-3" color={NAVY} />
            <p className="font-extrabold text-xl" style={{ fontFamily: BUBBLE, color: NAVY }}>
              Creating your character...
            </p>
            <p className="mt-1 font-semibold" style={{ fontFamily: BUBBLE, color: NAVY }}>
              This takes about 10 seconds
            </p>
          </div>
        </div>
      )}
        </>,
        document.body,
      )}
    </div>
  );
};

export default OnboardingCreateCharacter;
