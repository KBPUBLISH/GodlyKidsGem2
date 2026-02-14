import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SelfieCapture from '../components/features/SelfieCapture';
import CharacterStyleSelector, { CHARACTER_STYLES } from '../components/features/CharacterStyleSelector';
import { getApiBaseUrl, ApiService } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import { authService } from '../services/authService';
import { BookOpen, Sparkles, RotateCcw, Volume2, Mic } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

/** Story option for Create Your Story (from Books with bookType kids_monthly) */
interface Story {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string | null;
  bibleCharacter?: { displayName: string; internalTag?: string };
}

// Base URL for API calls (no double /api when env ends with /api/)
function getApiRoot(): string {
  const raw = (getApiBaseUrl() || '').replace(/\/$/, '');
  const withoutApi = raw.replace(/\/api\/?$/, '');
  return withoutApi || raw;
}

const CreateYourStoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { kids, currentProfileId } = useUser();
  const { isPremium, reverseTrial } = useSubscription();
  const [step, setStep] = useState<Step>(1);
  const [childName, setChildName] = useState('');
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [narratorVoices, setNarratorVoices] = useState<Array<{ voice_id: string; name: string; characterImage?: string }>>([]);
  const [selectedNarratorVoiceId, setSelectedNarratorVoiceId] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const voicePreviewCacheRef = useRef<Record<string, string>>({});
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isFlashTransition, setIsFlashTransition] = useState(false);
  const characterGenerationIdRef = useRef(0);

  const currentKid = kids.find((k) => k.id === currentProfileId);
  const hasTrialOrPaid = isPremium || (reverseTrial?.isActive ?? false);

  // Hide bottom nav wheel for the entire Create Your Story flow
  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true');
    return () => document.body.removeAttribute('data-modal-open');
  }, []);

  useEffect(() => {
    if (currentKid?.name && !childName) setChildName(currentKid.name);
  }, [currentKid?.name, childName]);

  useEffect(() => {
    let cancelled = false;
    setStoriesLoaded(false);
    (async () => {
      try {
        const base = getApiRoot();
        const res = await fetch(`${base}/api/books?bookType=kids_monthly&status=published`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setStoriesLoaded(true);
          if (!res.ok) setError(data.error || data.message || 'Could not load stories.');
          else {
            const list = Array.isArray(data.data)
              ? data.data
              : Array.isArray(data)
                ? data
                : [];
            setStories(list.map((b: any) => ({
              _id: b._id,
              title: b.title,
              description: b.description,
              coverImage: b.files?.coverImage || b.coverImage || null,
              bibleCharacter: b.featuredCharacterId ? { displayName: b.featuredCharacterId.displayName } : undefined,
            })));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStoriesLoaded(true);
          setError('Could not load stories.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
    };
  }, []);

  // Fetch narrator voices from ElevenLabs voice manager (for step 3)
  useEffect(() => {
    let cancelled = false;
    ApiService.getVoices()
      .then((voices) => {
        if (cancelled) return;
        const showInApp = (voices as any[]).filter((v: any) => v.showInApp !== false);
        setNarratorVoices(showInApp);
        setSelectedNarratorVoiceId((prev) => prev || (showInApp[0]?.voice_id ?? null));
      })
      .catch(() => { if (!cancelled) setNarratorVoices([]); });
    return () => { cancelled = true; };
  }, []);

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
    setShowStyleSelector(false);
  };

  const handleNarratorVoiceClick = async (voiceId: string) => {
    setSelectedNarratorVoiceId(voiceId);
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    if (previewingVoiceId === voiceId) {
      setPreviewingVoiceId(null);
      return;
    }
    setPreviewingVoiceId(voiceId);
    const previewText = `Hello ${childName || 'there'}, are you excited!?`;
    try {
      let audioUrl = voicePreviewCacheRef.current[voiceId];
      if (!audioUrl) {
        const base = getApiRoot();
        const res = await fetch(`${base}/api/devotional-stories/preview-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId, text: previewText }),
        });
        if (!res.ok) throw new Error('Preview failed');
        const data = await res.json().catch(() => ({}));
        audioUrl = data.audioUrl ?? (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : undefined);
        if (audioUrl) voicePreviewCacheRef.current[cacheKey] = audioUrl;
      }
      if (!audioUrl) throw new Error('No audio URL');
      const audio = new Audio(audioUrl);
      voiceAudioRef.current = audio;
      audio.onended = () => { setPreviewingVoiceId(null); voiceAudioRef.current = null; };
      audio.onerror = () => { setPreviewingVoiceId(null); voiceAudioRef.current = null; };
      await audio.play();
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  const handleSelfieCapture = async (imageBase64: string) => {
    setSelfieBase64(imageBase64);
    setShowSelfieModal(false);
    setError(null);
    if (!selectedStyleId) return;
    setIsGeneratingCharacter(true);
    try {
      const base = getApiRoot();
      const res = await fetch(`${base}/api/character/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          styleId: selectedStyleId,
          settingId: 'forest',
          childId: currentProfileId || currentKid?.id,
          childName: childName || currentKid?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl;
      if (url) {
        setAvatarUrl(url);
        if (!data.fallback) setError(null);
      } else {
        setError(data.error || data.message || 'Could not create your character. Try again.');
      }
    } catch (e) {
      setError('Could not create your character. Try again.');
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const handleRegenerateCharacter = async () => {
    if (!selfieBase64 || !selectedStyleId) return;
    setError(null);
    setIsGeneratingCharacter(true);
    try {
      const base = getApiRoot();
      const res = await fetch(`${base}/api/character/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selfieBase64,
          styleId: selectedStyleId,
          settingId: 'forest',
          childId: currentProfileId || currentKid?.id,
          childName: childName || currentKid?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl;
      if (url) {
        setAvatarUrl(url);
        if (!data.fallback) setError(null);
      } else {
        setError(data.error || data.message || 'Could not create your character. Try again.');
      }
    } catch (e) {
      setError('Could not create your character. Try again.');
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBookId || !childName.trim()) return;
    const user = authService.getUser();
    const userId = (user as any)?._id || (user as any)?.id || user?.email || localStorage.getItem('godlykids_user_email') || localStorage.getItem('device_id');
    const kidId = currentProfileId || currentKid?.id || (kids[0]?.id ?? '');
    if (!userId || !kidId) {
      setError('Please sign in and select a kid profile.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = getApiRoot();
      const res = await fetch(`${base}/api/monthly-book/create-from-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          kidId,
          bookId: selectedBookId,
          childName: childName.trim(),
          childCharacterImageUrl: avatarUrl || undefined,
          hasTrialOrPaid,
          narratorVoiceId: selectedNarratorVoiceId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.customMonthlyBookId) {
        navigate(`/library/creating/${data.customMonthlyBookId}`, { replace: true });
        return;
      }
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || data.message || (res.ok ? 'Something went wrong.' : `Request failed (${res.status}). Try again.`));
      }
    } catch (e) {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedStory = stories.find((s) => s._id === selectedBookId);
  const bibleCharacterName = selectedStory?.bibleCharacter?.displayName || 'your hero';

  const isScreenOne = !submitted && step === 1;
  const isStyleStep = !submitted && step === 2;
  const isPickStoryStep = !submitted && step === 3;
  const isStep4 = !submitted && step === 4;
  const pageBg = isScreenOne
    ? { backgroundImage: 'url(/assets/images/create-story-screen1-background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }
    : isStyleStep || isPickStoryStep
      ? { backgroundImage: 'url(/assets/images/create-story-style-background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }
      : isStep4
        ? { backgroundImage: 'url(/assets/images/create-story-stage-background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined;
  return (
    <div
      className={`flex flex-col min-h-full relative ${isScreenOne || isStyleStep || isPickStoryStep || isStep4 ? '' : 'bg-gradient-to-b from-[#1a1a2e] to-[#16213e]'}`}
      style={pageBg}
    >
      <style>{`
        @keyframes screen-flash {
          0% { opacity: 0; }
          12% { opacity: 1; }
          45% { opacity: 1; }
          80% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes chest-pop-click {
          0% { transform: scale(1); }
          35% { transform: scale(1.18); }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes curtain-reveal {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-66%); opacity: 1; }
        }
        @keyframes curtain-content-fade {
          0% { opacity: 0; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
      {isFlashTransition && (
        <div
          className="fixed inset-0 z-[100] pointer-events-none bg-white"
          style={{ animation: 'screen-flash 0.55s ease-out forwards' }}
          onAnimationEnd={() => {
            setIsFlashTransition(false);
            setStep(2);
          }}
          aria-hidden
        />
      )}
      <div className="flex-1 px-4 pt-8 pb-12 overflow-y-auto relative z-10" style={{ paddingTop: 'max(2rem, var(--safe-area-top, 0px))' }}>
        {submitted ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/30 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-amber-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Creating your story{selectedStory?.title ? `: ${selectedStory.title}` : ''}...</h2>
            <p className="text-white/80 mb-2">Your story is being written by angels.</p>
            <p className="text-amber-200/90">Usually ready in 5–10 minutes. Go explore — we’ll notify you when it’s ready!</p>
            <button
              onClick={() => navigate('/library', { state: { fromCreateYourStory: true } })}
              className="mt-6 px-6 py-3 rounded-xl bg-amber-500 text-white font-bold"
            >
              Go to My Library
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/50 text-red-200 text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col min-h-[100dvh] min-h-[100vh]">
                <div className="flex-shrink-0 pt-2 w-full flex justify-center">
                  <img
                    src="/assets/images/create-story-header.png"
                    alt="Jump into the Bible! Create your own Story!"
                    className="max-w-[320px] w-full block"
                  />
                </div>
                <div
                  className="relative w-full max-w-4xl mx-auto bg-no-repeat bg-center bg-contain min-h-[280px] flex items-center justify-center py-8 px-12 flex-shrink-0 -mt-14"
                  style={{ backgroundImage: 'url(/assets/images/create-story-cloud-input.png)' }}
                >
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="What is your captain's name?"
                    className="w-full min-w-0 bg-transparent border-0 text-center text-xl sm:text-2xl font-medium text-[#2c1810] placeholder:text-[#2c1810]/70 focus:outline-none focus:ring-0 px-4"
                    aria-label="Captain's name"
                  />
                </div>
                <div className="flex-1 min-h-[2rem]" />
                <style>{`
                  @keyframes chest-jiggle {
                    0%, 18%, 22%, 48%, 52%, 78%, 82%, 100% { transform: rotate(0deg); }
                    19% { transform: rotate(-4deg); }
                    20% { transform: rotate(4deg); }
                    21% { transform: rotate(-2deg); }
                    49% { transform: rotate(-4deg); }
                    50% { transform: rotate(4deg); }
                    51% { transform: rotate(-2deg); }
                    79% { transform: rotate(-4deg); }
                    80% { transform: rotate(4deg); }
                    81% { transform: rotate(-2deg); }
                  }
                `}</style>
                <button
                  type="button"
                  onClick={() => {
                    if (!childName.trim()) return;
                    setIsFlashTransition(true);
                  }}
                  disabled={!childName.trim()}
                  className="flex justify-center items-end disabled:opacity-50 focus:outline-none focus:ring-0 rounded-lg flex-shrink-0 pb-4 mb-20"
                  aria-label="Next"
                >
                  <img
                    src="/assets/images/create-story-next-button.png"
                    alt="Next"
                    className="max-w-[210px] w-full h-auto object-contain"
                    style={{
                      animation: isFlashTransition
                        ? 'chest-pop-click 0.32s ease-out forwards'
                        : 'chest-jiggle 5s ease-in-out infinite',
                    }}
                  />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center min-h-[100dvh] w-full pt-6 -mb-12">
                <div className="flex justify-center flex-shrink-0">
                  <img
                    src="/assets/images/create-story-you-are-the-character.png"
                    alt="You are the Character!"
                    className="max-w-[340px] w-full h-auto block"
                  />
                </div>
                <h2 className="text-xl font-bold text-white flex-shrink-0 mb-6 mt-2">{selectedStyleId ? `You're Ready to Transform ${childName || 'you'}!` : '1. Choose your character style'}</h2>
                {selectedStyleId && (
                  <p className="text-white/70 text-xs flex-shrink-0 min-w-0 text-center px-2">
                    Take a Selfie and Create your Character for the Book
                  </p>
                )}
                {!selectedStyleId ? (
                  <div className="grid grid-cols-2 gap-4 max-w-[280px] mx-auto flex-1 min-h-0 content-center bg-transparent">
                    {CHARACTER_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyleId(style.id)}
                        className="block w-full focus:outline-none focus:ring-0 active:opacity-90 shadow-lg bg-transparent border-0 p-0"
                        type="button"
                      >
                        <img
                          src={`/assets/images/create-story-style-${style.id}.png`}
                          alt={style.name}
                          className="w-full h-auto aspect-[3/4] object-contain object-top block"
                        />
                      </button>
                    ))}
                  </div>
                ) : selectedStyleId && (
                  <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0 flex-grow -mt-8">
                    <div className="flex-shrink-0 mb-3 -mt-4 flex items-end justify-center gap-2 sm:gap-3">
                      <img
                        src="/assets/images/create-story-kid-photo.png"
                        alt=""
                        aria-hidden
                        className="max-h-[100px] sm:max-h-[120px] w-auto object-contain -rotate-6"
                      />
                      <img
                        src="/assets/images/create-story-arrow.png"
                        alt=""
                        aria-hidden
                        className="max-h-[64px] sm:max-h-[80px] w-auto object-contain flex-shrink-0"
                      />
                      <img
                        src="/assets/images/create-story-port-character.png"
                        alt=""
                        aria-hidden
                        className="max-h-[100px] sm:max-h-[120px] w-auto object-contain rotate-6"
                      />
                    </div>
                    {avatarUrl ? (
                      <div className="space-y-3 w-full flex flex-col items-center">
                        <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                          <img
                            src="/assets/images/create-story-selfie-frame.png"
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-[72%] h-[72%] rounded-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
                              <img src={avatarUrl} alt="Your character" className="w-full h-full object-cover object-top" />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRegenerateCharacter}
                          disabled={isGeneratingCharacter}
                          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {isGeneratingCharacter ? 'Regenerating...' : 'Regenerate character'}
                        </button>
                      </div>
                    ) : (
                      <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                        <img
                          src="/assets/images/create-story-selfie-frame.png"
                          alt=""
                          aria-hidden
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSelfieModal(true)}
                          disabled={isGeneratingCharacter}
                          className="absolute inset-0 flex items-center justify-center focus:outline-none focus:ring-0"
                        >
                          <div className="w-[72%] h-[72%] rounded-full overflow-hidden bg-amber-500/10 border-2 border-dashed border-amber-400/50 flex flex-col items-center justify-center gap-2 text-amber-200">
                            {isGeneratingCharacter ? <span className="text-sm">Creating your character...</span> : <><BookOpen className="w-10 h-10" /> <span className="text-sm">Tap to take selfie</span></>}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-shrink-0 items-center w-full mt-auto pt-4 mb-6 pb-2" style={{ paddingBottom: 'max(1rem, var(--safe-area-bottom, 0px))' }}>
                  <button
                    onClick={() => {
                    if (selectedStyleId) {
                      setSelectedStyleId(null);
                      setSelfieBase64(null);
                    } else {
                      setShowStyleSelector(false);
                      setStep(1);
                    }
                  }}
                    className="flex-1 py-2.5 text-sm rounded-xl bg-white/10 text-white shadow-md"
                  >
                    Back
                  </button>
                  {selectedStyleId && (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!avatarUrl}
                      className="flex-1 flex justify-center disabled:opacity-50 focus:outline-none focus:ring-0 rounded-lg"
                      aria-label="Next"
                    >
                      <img src="/assets/images/create-story-next-button.png" alt="Next" className="max-h-9 w-auto object-contain" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col min-h-0">
                <div className="flex-shrink-0 pt-2 text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">Pick your story</h2>
                  <p className="text-white/80 text-base mt-1">Choose which story you want to star in.</p>
                </div>
                <div className="flex flex-col items-center py-4 pb-8">
                  {!storiesLoaded && !error && <p className="text-white/70">Loading stories...</p>}
                  {storiesLoaded && stories.length === 0 && !error && (
                    <p className="text-white/80 text-sm text-center px-4">
                      No Kids Monthly stories yet. Create a book in the portal, set its type to &quot;Kids Monthly Book&quot;, and publish it—then it will appear here.
                    </p>
                  )}
                  {storiesLoaded && stories.length > 0 && (
                    <>
                      <div className="flex flex-wrap justify-center gap-4 w-full max-w-md mx-auto px-2 flex-shrink-0 -mt-4">
                        {stories.map((s) => {
                          const coverUrl = s.coverImage?.startsWith('http') ? s.coverImage : s.coverImage ? `${getApiRoot()}${s.coverImage.startsWith('/') ? '' : '/'}${s.coverImage}` : null;
                          return (
                            <button
                              key={s._id}
                              onClick={() => setSelectedBookId(s._id)}
                              className={`flex flex-col items-center transition-all focus:outline-none focus:ring-0 ${
                                selectedBookId === s._id ? 'ring-2 ring-amber-400 rounded-xl ring-offset-2 ring-offset-transparent' : ''
                              }`}
                            >
                              <div className="w-full max-w-[160px] aspect-[3/4] rounded-xl overflow-hidden shadow-lg bg-white/5 flex items-center justify-center">
                                {coverUrl ? (
                                  <img src={coverUrl} alt="" className="w-full h-full object-cover object-top" />
                                ) : (
                                  <BookOpen className="w-12 h-12 text-white/40" aria-hidden />
                                )}
                              </div>
                              <span className="text-white font-medium text-sm text-center px-2 py-2 block">{s.title}</span>
                              {s.bibleCharacter?.displayName && (
                                <span className="text-amber-200/90 text-xs pb-2">{s.bibleCharacter.displayName}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex-shrink-0 w-full max-w-md mx-auto px-2 mt-4">
                        <p className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                          <Volume2 className="w-4 h-4" aria-hidden />
                          Choose narrator voice
                        </p>
                        {narratorVoices.length === 0 ? (
                          <p className="text-white/50 text-sm">Loading voices...</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {narratorVoices.slice(0, 9).map((v) => {
                              const isSelected = selectedNarratorVoiceId === v.voice_id;
                              const imgUrl = v.characterImage?.startsWith('http')
                                ? v.characterImage
                                : v.characterImage
                                  ? `${getApiRoot()}${v.characterImage.startsWith('/') ? '' : '/'}${v.characterImage}`
                                  : null;
                              const isPreviewing = previewingVoiceId === v.voice_id;
                              return (
                                <button
                                  key={v.voice_id}
                                  type="button"
                                  onClick={() => handleNarratorVoiceClick(v.voice_id)}
                                  disabled={isPreviewing}
                                  className={`flex flex-col items-center gap-1.5 focus:outline-none focus:ring-0 ${isPreviewing ? 'opacity-80' : ''}`}
                                  aria-label={`Preview ${v.name}`}
                                >
                                  <div
                                    className={`relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center transition-all border-2 border-white/40 ${
                                      isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent' : ''
                                    }`}
                                  >
                                    {imgUrl ? (
                                      <img src={imgUrl} alt={v.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                        <Mic className="w-6 h-6 text-white/60" aria-hidden />
                                      </div>
                                    )}
                                    {isPreviewing && (
                                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-white font-medium text-xs text-center truncate max-w-full px-0.5">{v.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-3 flex-shrink-0 mt-auto pt-4 mb-6" style={{ paddingBottom: 'max(1rem, var(--safe-area-bottom, 0px))' }}>
                  <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-white/10 text-white shadow-md">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    disabled={!selectedBookId}
                    className="flex-1 flex justify-center disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded-lg"
                    aria-label="Next"
                  >
                    <img src="/assets/images/create-story-next-button.png" alt="Next" className="max-h-12 w-auto object-contain" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="relative">
                <div
                  className="fixed inset-0 z-[5] bg-cover bg-center pointer-events-none"
                  style={{
                    backgroundImage: 'url(/assets/images/create-story-curtain.png)',
                    animation: 'curtain-reveal 1.4s ease-out forwards',
                  }}
                  aria-hidden
                />
                <div
                  className="relative z-20 space-y-6"
                  style={{ animation: 'curtain-content-fade 1.4s ease-out forwards' }}
                >
                <h2 className="text-xl font-bold text-white">Ready to create your story!</h2>
                <p className="text-white/70">
                  <strong className="text-amber-200">{childName}</strong> will star in <strong className="text-amber-200">{selectedStory?.title}</strong>.
                </p>
                <p className="text-white/50 text-sm">We’ll build your book in the background (usually 5–10 min). Go explore — we’ll notify you when it’s ready.</p>
                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-white/10 text-white">
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create my story'}
                  </button>
                </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SelfieCapture
        isOpen={showSelfieModal}
        onCapture={handleSelfieCapture}
        onClose={() => setShowSelfieModal(false)}
        childName={childName || 'there'}
        frameOverlayImageUrl="/assets/images/create-story-selfie-porthole-overlay.png"
      />

      <CharacterStyleSelector
        isOpen={showStyleSelector}
        selfiePreview={selfieBase64 || undefined}
        onSelect={handleStyleSelect}
        onBack={() => {
          if (selfieBase64) {
            setShowStyleSelector(false);
            setShowSelfieModal(true);
          } else {
            setShowStyleSelector(false);
            setStep(1);
          }
        }}
        onClose={() => setShowStyleSelector(false)}
        isGenerating={isGeneratingCharacter}
        childName={childName || currentKid?.name || 'there'}
        confirmLabel={!selfieBase64 ? 'Next: take selfie' : undefined}
      />
    </div>
  );
};

export default CreateYourStoryPage;
