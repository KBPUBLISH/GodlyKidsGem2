import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SelfieCapture from '../components/features/SelfieCapture';
import CharacterStyleSelector, { CHARACTER_STYLES } from '../components/features/CharacterStyleSelector';
import { getApiBaseUrl, getMonthlyBookBaseUrl, ApiService } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import { authService } from '../services/authService';
import { activityTrackingService } from '../services/activityTrackingService';
import { NotificationService } from '../services/notificationService';
import { DespiaService } from '../services/despiaService';
import { BookOpen, Sparkles, RotateCcw, Volume2, Mic, ChevronLeft, ChevronRight, Loader2, Compass, Check, Plus, Music } from 'lucide-react';

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
  const { isPremium, getPremiumStatusStrict } = useSubscription();
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
  const [narratorCarouselPage, setNarratorCarouselPage] = useState(0);
  const narratorCarouselTouchStart = useRef<number | null>(null);
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
  const [creatingBook, setCreatingBook] = useState<{ customMonthlyBookId: string; title: string; coverImageUrl: string | null } | null>(null);
  const [creatingProgress, setCreatingProgress] = useState<{ progressPage: number; progressTotalPages: number } | null>(null);
  const [notifyWhenDone, setNotifyWhenDone] = useState(false);
  const [notifyToggleLoading, setNotifyToggleLoading] = useState(false);
  const [step1HeaderImageError, setStep1HeaderImageError] = useState(false);
  const [step1NextImageError, setStep1NextImageError] = useState(false);
  const [storiesRetryKey, setStoriesRetryKey] = useState(0);
  const characterGenerationIdRef = useRef(0);
  const bookBuildingStartedTrackedRef = useRef(false);
  const bookCompletedTrackedRef = useRef(false);
  // Extra characters (2nd and 3rd); max 2 items so total characters <= 3
  const [extraCharacters, setExtraCharacters] = useState<Array<{ name: string; imageUrl: string | null; selfieBase64: string | null; generating?: boolean }>>([]);
  const [editingExtraIndex, setEditingExtraIndex] = useState<number | null>(null);
  const [bookAudioTracks, setBookAudioTracks] = useState<Array<{ url: string; filename: string }>>([]);
  const [selectedBackgroundMusicIndex, setSelectedBackgroundMusicIndex] = useState<number>(0);
  const [monthlyCreditsUsed, setMonthlyCreditsUsed] = useState<number | null>(null);
  const [monthlyCreditsLimit, setMonthlyCreditsLimit] = useState<number | null>(null);

  const currentKid = kids.find((k) => k.id === currentProfileId);
  const hasTrialOrPaid = isPremium;

  // Hide bottom nav wheel for the entire Create Your Story flow
  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true');
    return () => document.body.removeAttribute('data-modal-open');
  }, []);

  // Track Dive into the Bible / book building started (once per visit)
  useEffect(() => {
    if (bookBuildingStartedTrackedRef.current) return;
    bookBuildingStartedTrackedRef.current = true;
    activityTrackingService.trackOnboardingEvent('book_building_started').catch(() => {});
  }, []);

  // Pre-fill name from kid profile once; don't repopulate when user clears the field
  const hasInitializedNameFromKidRef = useRef(false);
  useEffect(() => {
    if (currentKid?.name && !hasInitializedNameFromKidRef.current) {
      setChildName(currentKid.name);
      hasInitializedNameFromKidRef.current = true;
    }
  }, [currentKid?.name]);

  // Pre-fill character style from kid profile (how they created their avatar) when present
  useEffect(() => {
    if (currentKid?.characterStyle && !selectedStyleId) setSelectedStyleId(currentKid.characterStyle);
  }, [currentKid?.characterStyle]);

  useEffect(() => {
    let cancelled = false;
    setStoriesLoaded(false);
    setError(null);
    (async () => {
      try {
        const base = getApiRoot();
        const url = `${base}/api/books?bookType=kids_monthly&status=published`;
        if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
          console.log('Create Your Story: fetching stories from', url);
        }
        const res = await fetch(url);
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
  }, [storiesRetryKey]);

  useEffect(() => {
    return () => {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
    };
  }, []);

  // Fetch monthly credits when on step 4 (Ready to Create) so we can show "X of Y monthly credits available"
  useEffect(() => {
    if (step !== 4) return;
    ApiService.getMonthlyBookCredits().then((data) => {
      if (data) {
        setMonthlyCreditsUsed(data.usedThisMonth);
        setMonthlyCreditsLimit(typeof data.limit === 'number' ? data.limit : null);
      } else {
        setMonthlyCreditsUsed(null);
        setMonthlyCreditsLimit(null);
      }
    });
  }, [step]);

  // Fetch selected book's audio tracks when a story is selected (for background music picker)
  useEffect(() => {
    if (!selectedBookId) {
      setBookAudioTracks([]);
      setSelectedBackgroundMusicIndex(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = getApiRoot();
        const res = await fetch(`${base}/api/books/${selectedBookId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const audio = data?.files?.audio;
        const tracks = Array.isArray(audio) ? audio.slice(0, 3).filter((t: { url?: string }) => t?.url) : [];
        setBookAudioTracks(tracks);
        const defaultIdx = Math.max(0, Math.min(data?.files?.defaultAudioIndex ?? 0, tracks.length - 1));
        setSelectedBackgroundMusicIndex(defaultIdx);
      } catch {
        if (!cancelled) setBookAudioTracks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBookId]);

  // Fetch narrator voices from ElevenLabs voice manager (for step 3)
  useEffect(() => {
    let cancelled = false;
    ApiService.getVoices()
      .then((voices) => {
        if (cancelled) return;
        const showInApp = (voices as any[]).filter((v: any) => v.showInApp !== false);
        // Replace "Dr Bananas" with the next voice in the list (exclude Dr Bananas, take first 9)
        const withoutDrBananas = showInApp.filter(
          (v: any) => (v.name || '').toLowerCase() !== 'dr bananas'
        );
        const forNarrator = withoutDrBananas.slice(0, 18);
        setNarratorVoices(forNarrator);
        setSelectedNarratorVoiceId((prev) => prev || (forNarrator[0]?.voice_id ?? null));
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
    const previewText = `Hey, ${childName || 'there'}, are you excited?!`;
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
        if (audioUrl) voicePreviewCacheRef.current[voiceId] = audioUrl;
      }
      if (!audioUrl) throw new Error('No audio URL');
      // Use Blob URL for base64 on first play (more reliable on iOS/some browsers than long data URLs)
      let playUrl = audioUrl;
      let revokeUrl: string | null = null;
      if (audioUrl.startsWith('data:audio/mpeg;base64,')) {
        try {
          const base64 = audioUrl.slice(audioUrl.indexOf(',') + 1);
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          revokeUrl = playUrl = URL.createObjectURL(blob);
        } catch {
          // fallback to data URL
        }
      }
      const audio = new Audio(playUrl);
      voiceAudioRef.current = audio;
      audio.volume = 1;
      audio.onended = () => {
        if (revokeUrl) URL.revokeObjectURL(revokeUrl);
        setPreviewingVoiceId(null);
        voiceAudioRef.current = null;
      };
      audio.onerror = () => {
        if (revokeUrl) URL.revokeObjectURL(revokeUrl);
        setPreviewingVoiceId(null);
        voiceAudioRef.current = null;
      };
      await audio.play();
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  const handleSelfieCapture = async (imageBase64: string) => {
    setShowSelfieModal(false);
    setError(null);
    const extraIndex = editingExtraIndex;
    setEditingExtraIndex(null);
    if (extraIndex !== null) {
      setExtraCharacters((prev) => {
        const next = [...prev];
        if (next[extraIndex]) {
          next[extraIndex] = { ...next[extraIndex], selfieBase64: imageBase64, generating: true };
        }
        return next;
      });
      if (selectedStyleId) await generateExtraCharacterAvatar(extraIndex, imageBase64);
      return;
    }
    setSelfieBase64(imageBase64);
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
          settingId: 'shipDeck',
          childId: currentProfileId || currentKid?.id,
          childName: childName || currentKid?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl;
      if (url) {
        setAvatarUrl(url);
        setError(null);
        // Track character generated (including fallback) so funnel matches: user got a character to proceed
        activityTrackingService.trackOnboardingEvent('book_building_character_generated').catch(() => {});
      } else {
        setError(data.error || data.message || 'Could not create your character. Try again.');
      }
    } catch (e) {
      setError('Could not create your character. Try again.');
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const generateExtraCharacterAvatar = async (index: number, imageBase64: string) => {
    const base = getApiRoot();
    if (!selectedStyleId) return;
    setExtraCharacters((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], generating: true };
      return next;
    });
    try {
      const name = extraCharacters[index]?.name || `Character ${index + 2}`;
      const res = await fetch(`${base}/api/character/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          styleId: selectedStyleId,
          settingId: 'shipDeck',
          childId: currentProfileId || currentKid?.id,
          childName: name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl;
      setExtraCharacters((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], imageUrl: url || null, generating: false };
        return next;
      });
      if (!url) setError(data.error || data.message || 'Could not create character. Try again.');
    } catch (e) {
      setError('Could not create character. Try again.');
      setExtraCharacters((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], generating: false };
        return next;
      });
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
          settingId: 'shipDeck',
          childId: currentProfileId || currentKid?.id,
          childName: childName || currentKid?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.characterAvatarUrl || data.imageUrl;
      if (url) {
        setAvatarUrl(url);
        setError(null);
        // Track character generated (including fallback) so funnel matches: user got a character to proceed
        activityTrackingService.trackOnboardingEvent('book_building_character_generated').catch(() => {});
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
    activityTrackingService.trackOnboardingEvent('book_building_step_4_complete').catch(() => {});
    const userId = authService.getUserIdForBackend();
    const kidId = currentProfileId || currentKid?.id || (kids[0]?.id ?? '');
    if (!userId || !kidId) {
      navigate('/paywall', { state: { from: 'create-your-story' }, replace: true });
      return;
    }
    // Gate only the actual book creation: non-subscribers can complete the full flow up to here
    // (pick story, create character, see their character) as a hook; they hit paywall when they tap Create.
    if (!isPremium) {
      console.log('Create my story: not premium (app state) → showing paywall');
      navigate('/paywall', { state: { from: 'create-your-story' }, replace: true });
      return;
    }
    // 2) App says premium — double-check with backend so stale cache can't bypass.
    console.log('Create my story: verifying subscription with backend...');
    let hasPremium = false;
    try {
      hasPremium = await getPremiumStatusStrict();
    } catch (e) {
      console.warn('Create my story: backend check failed', e);
      hasPremium = false;
    }
    if (!hasPremium) {
      console.log('Create my story: not premium (backend) → showing paywall');
      navigate('/paywall', { state: { from: 'create-your-story' }, replace: true });
      return;
    }
    console.log('Create my story: premium verified → creating story');
    setLoading(true);
    setError(null);
    const characterList = [
      { name: childName.trim(), characterImageUrl: avatarUrl || undefined },
      ...extraCharacters
        .filter((c) => c.name.trim())
        .map((c) => ({ name: c.name.trim(), characterImageUrl: c.imageUrl || undefined })),
    ];
    const useCharacters = characterList.length >= 1;
    const body: Record<string, unknown> = {
      userId,
      kidId,
      bookId: selectedBookId,
      childName: childName.trim(),
      childCharacterImageUrl: avatarUrl || undefined,
      characterStyleId: selectedStyleId || currentKid?.characterStyle || 'illustrated',
      bookStyleId: selectedStyleId || currentKid?.characterStyle || 'illustrated',
      hasTrialOrPaid,
      narratorVoiceId: selectedNarratorVoiceId || undefined,
      backgroundMusicIndex: bookAudioTracks.length >= 2 ? selectedBackgroundMusicIndex : 0,
    };
    if (useCharacters && characterList.length <= 3) {
      body.characters = characterList.slice(0, 3);
    }
    if (selfieBase64) {
      body.childSelfieBase64 = selfieBase64;
    }
    try {
      const res = await fetch(`${getMonthlyBookBaseUrl()}/monthly-book/create-from-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.customMonthlyBookId) {
        activityTrackingService.trackOnboardingEvent('book_building_book_created').catch(() => {});
        const coverImageUrl = selectedStory?.coverImage
          ? (selectedStory.coverImage.startsWith('http') ? selectedStory.coverImage : `${getApiRoot()}${selectedStory.coverImage.startsWith('/') ? '' : '/'}${selectedStory.coverImage}`)
          : null;
        const payload = {
          customMonthlyBookId: data.customMonthlyBookId,
          title: selectedStory?.title ?? 'Your story',
          coverImageUrl,
        };
        setCreatingBook(payload);
        try {
          sessionStorage.setItem('godlykids_last_creating_book', JSON.stringify({
            ...payload,
            createdAt: Date.now(),
          }));
        } catch (_) {}
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

  // Poll status while a book is being created so we can show "Page X of Y".
  useEffect(() => {
    if (!creatingBook?.customMonthlyBookId) {
      setCreatingProgress(null);
      return;
    }
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${getMonthlyBookBaseUrl()}/monthly-book/status/${creatingBook.customMonthlyBookId}`);
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          if (data.status === 'completed' && data.bookId) {
            if (!bookCompletedTrackedRef.current) {
              bookCompletedTrackedRef.current = true;
              activityTrackingService.trackOnboardingEvent('book_building_book_completed').catch(() => {});
            }
            navigate(`/book/${typeof data.bookId === 'object' ? data.bookId?._id : data.bookId}`, { replace: true });
            return;
          }
          setCreatingProgress({
            progressPage: data.progressPage ?? 0,
            progressTotalPages: data.progressTotalPages ?? 0,
          });
        }
      } catch {
        // ignore
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [creatingBook?.customMonthlyBookId, navigate]);

  const isScreenOne = !submitted && step === 1;
  const isStyleStep = !submitted && step === 2;
  const isPickStoryStep = !submitted && step === 3;
  const isStep4 = !submitted && step === 4;
  const pageBg = isScreenOne
    ? { backgroundImage: 'url(/assets/images/create-story-screen1-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }
    : isStyleStep || isPickStoryStep
      ? { backgroundImage: 'url(/assets/images/create-story-style-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }
      : isStep4
        ? { backgroundImage: 'url(/assets/images/create-story-stage-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined;
  return (
    <div
      className={`flex flex-col h-[100dvh] min-h-screen relative ${isScreenOne || isStyleStep || isPickStoryStep || isStep4 ? '' : 'bg-gradient-to-b from-[#1a1a2e] to-[#16213e]'}`}
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
        @keyframes curtain-close {
          0% { transform: translateY(-66%); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
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
            activityTrackingService.trackOnboardingEvent('book_building_step_1_complete').catch(() => {});
            activityTrackingService.trackOnboardingEvent('book_building_step_2_started').catch(() => {});
            setIsFlashTransition(false);
            setStep(2);
          }}
          aria-hidden
        />
      )}
      <div className="flex-1 min-h-0 px-4 pt-8 pb-12 overflow-y-auto relative z-10" style={{ paddingTop: 'max(2rem, var(--safe-area-top, 0px))' }}>
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="absolute top-4 left-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Back to Library"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
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
                <div className="flex-shrink-0 pt-2 w-full flex justify-center mb-1">
                  {step1HeaderImageError ? (
                    <h2 className="text-lg sm:text-xl font-bold text-white text-center px-4 max-w-[280px]">
                      Jump into the Bible! Create your own Story!
                    </h2>
                  ) : (
                    <img
                      src="/assets/images/create-story-header.webp"
                      alt="Jump into the Bible! Create your own Story!"
                      className="max-w-[280px] w-full block"
                      onError={() => setStep1HeaderImageError(true)}
                    />
                  )}
                </div>
                <div
                  className="relative w-full max-w-7xl mx-auto bg-no-repeat bg-center bg-contain min-h-[280px] flex items-center justify-center py-8 px-6 sm:px-10 flex-shrink-0 -mt-12"
                  style={{ backgroundImage: 'url(/assets/images/create-story-cloud-input.webp)' }}
                >
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="What is your name"
                    className="w-full min-w-0 bg-transparent border-0 text-center text-xl sm:text-2xl font-medium text-[#2c1810] placeholder:text-gray-400 focus:outline-none focus:ring-0 px-6"
                    aria-label="Your name for the book"
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
                  {step1NextImageError ? (
                    <span
                      className="inline-block px-8 py-4 rounded-xl bg-amber-500 text-white font-bold text-lg"
                      style={{
                        animation: isFlashTransition
                          ? 'chest-pop-click 0.32s ease-out forwards'
                          : 'chest-jiggle 5s ease-in-out infinite',
                      }}
                    >
                      Next
                    </span>
                  ) : (
                    <img
                      src="/assets/images/create-story-next-button.webp"
                      alt="Next"
                      className="max-w-[210px] w-full h-auto object-contain"
                      onError={() => setStep1NextImageError(true)}
                      style={{
                        animation: isFlashTransition
                          ? 'chest-pop-click 0.32s ease-out forwards'
                          : 'chest-jiggle 5s ease-in-out infinite',
                      }}
                    />
                  )}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center min-h-[100dvh] w-full pt-6 -mb-12">
                <div className="flex justify-center flex-shrink-0">
                  <img
                    src="/assets/images/create-story-you-are-the-character.webp"
                    alt=""
                    aria-hidden
                    className="max-w-[340px] w-full h-auto block"
                  />
                </div>
                <h2 className="text-xl font-bold text-white flex-shrink-0 mb-6 mt-2">{selectedStyleId ? `You're Ready to Transform ${childName || 'you'}!` : '1. Choose your character style'}</h2>
                {selectedStyleId && !avatarUrl && (
                  <>
                    <p className="text-white/70 text-xs flex-shrink-0 min-w-0 text-center px-2 mb-6">
                      Take a Selfie and Create your Character for the Book
                    </p>
                    <div className="flex-shrink-0 flex items-end justify-center gap-2 sm:gap-3 mt-2 mb-4">
                      <img
                        src="/assets/images/create-story-kid-photo.webp"
                        alt=""
                        aria-hidden
                        className="max-h-[100px] sm:max-h-[120px] w-auto object-contain -rotate-6"
                      />
                      <img
                        src="/assets/images/create-story-arrow.webp"
                        alt=""
                        aria-hidden
                        className="max-h-[64px] sm:max-h-[80px] w-auto object-contain flex-shrink-0"
                      />
                      <img
                        src="/assets/images/create-story-port-character.webp"
                        alt=""
                        aria-hidden
                        className="max-h-[100px] sm:max-h-[120px] w-auto object-contain rotate-6"
                      />
                    </div>
                  </>
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
                          src={`/assets/images/create-story-style-${style.id}.webp`}
                          alt={style.name}
                          className="w-full h-auto aspect-[3/4] object-contain object-top block"
                        />
                        <span className="block text-center text-white font-semibold text-sm mt-1">{style.name}</span>
                      </button>
                    ))}
                  </div>
                ) : selectedStyleId && (
                  <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0 flex-grow -mt-4">
                    {avatarUrl ? (
                      <div className="space-y-3 w-full flex flex-col items-center">
                        <div className="w-full max-w-[320px] mx-auto space-y-2">
                          <p className="text-white/80 text-xs font-medium">Character 1</p>
                          <input
                            type="text"
                            value={childName}
                            onChange={(e) => setChildName(e.target.value)}
                            placeholder="Your name for the book"
                            className="w-full px-3 py-2.5 rounded-xl bg-white/10 text-white placeholder:text-white/40 text-sm font-medium border border-white/20"
                            aria-label="Character 1 name"
                          />
                        </div>
                        {/* Before & after: selfie → wood arrow → generated character (same as story creation teaser) */}
                        {selfieBase64 && (
                          <div className="flex items-end justify-center gap-2 sm:gap-3 w-full max-w-[320px] mx-auto">
                            <div className="rounded-xl overflow-hidden border-2 border-white/40 shadow-lg flex-shrink-0 -rotate-6 max-h-[100px] sm:max-h-[120px] aspect-square">
                              <img
                                src={selfieBase64.startsWith('data:') ? selfieBase64 : `data:image/jpeg;base64,${selfieBase64}`}
                                alt="Your selfie"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <img
                              src="/assets/images/create-story-arrow.webp"
                              alt=""
                              aria-hidden
                              className="max-h-[64px] sm:max-h-[80px] w-auto object-contain flex-shrink-0"
                            />
                            <div className="relative rounded-xl overflow-hidden border-2 border-white/40 shadow-lg flex-shrink-0 rotate-6 max-h-[100px] sm:max-h-[120px] aspect-square bg-[#2A1810]">
                              <img
                                src={avatarUrl}
                                alt="Your character"
                                className="w-full h-full object-cover object-center"
                              />
                              {isGeneratingCharacter && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center" aria-hidden>
                                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                          <img
                            src="/assets/images/create-story-selfie-frame.webp"
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-[86%] h-[86%] rounded-full overflow-hidden bg-[#2A1810] flex items-center justify-center border-2 border-white">
                              <img src={avatarUrl} alt="Your character" className="w-full h-full object-cover object-center" />
                              {isGeneratingCharacter && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full" aria-hidden>
                                  <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExtraIndex(null);
                            setShowSelfieModal(true);
                          }}
                          disabled={isGeneratingCharacter}
                          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {isGeneratingCharacter ? 'Creating character...' : 'Retake selfie'}
                        </button>
                        {extraCharacters.length < 2 && (
                          <button
                            type="button"
                            onClick={() => setExtraCharacters((prev) => [...prev, { name: '', imageUrl: null, selfieBase64: null }])}
                            className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-medium flex items-center justify-center gap-2 border border-amber-400/40"
                          >
                            <Plus className="w-4 h-4" /> Add another character (up to 3)
                          </button>
                        )}
                        {extraCharacters.map((extra, idx) => (
                          <div key={idx} className="w-full max-w-[320px] rounded-xl bg-white/10 border border-white/20 p-3 space-y-3">
                            <p className="text-white/80 text-xs font-medium">Character {idx + 2}</p>
                            <input
                              type="text"
                              value={extra.name}
                              onChange={(e) => setExtraCharacters((prev) => {
                                const n = [...prev];
                                if (n[idx]) n[idx] = { ...n[idx], name: e.target.value };
                                return n;
                              })}
                              placeholder="Name"
                              className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder:text-white/40 text-sm border border-white/20"
                            />
                            {extra.imageUrl ? (
                              <>
                                <div className="relative w-full max-w-[200px] aspect-square mx-auto">
                                  <img
                                    src="/assets/images/create-story-selfie-frame.webp"
                                    alt=""
                                    aria-hidden
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-[86%] h-[86%] rounded-full overflow-hidden bg-[#2A1810] flex items-center justify-center border-2 border-white">
                                      <img src={extra.imageUrl} alt="" className="w-full h-full object-cover object-center" />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-center flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => generateExtraCharacterAvatar(idx, extra.selfieBase64 || '')}
                                    disabled={extra.generating || !extra.selfieBase64}
                                    className="py-1.5 px-3 rounded-lg bg-white/10 text-white/90 text-xs disabled:opacity-50"
                                  >
                                    {extra.generating ? 'Generating...' : 'Regenerate'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExtraCharacters((prev) => prev.filter((_, i) => i !== idx))}
                                    className="py-1.5 px-3 rounded-lg bg-red-500/20 text-red-200 text-xs"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExtraIndex(idx);
                                  setShowSelfieModal(true);
                                }}
                                disabled={extra.generating}
                                className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {extra.generating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" /> 
                                ) : (
                                  <BookOpen className="w-4 h-4" />
                                )}
                                {extra.generating ? 'Creating...' : 'Take selfie'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="w-full max-w-[320px] mx-auto space-y-2 mb-3">
                          <p className="text-white/80 text-xs font-medium">Character 1</p>
                          <input
                            type="text"
                            value={childName}
                            onChange={(e) => setChildName(e.target.value)}
                            placeholder="Your name for the book"
                            className="w-full px-3 py-2.5 rounded-xl bg-white/10 text-white placeholder:text-white/40 text-sm font-medium border border-white/20"
                            aria-label="Character 1 name"
                          />
                        </div>
                        <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                        <img
                          src="/assets/images/create-story-selfie-frame.webp"
                          alt=""
                          aria-hidden
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExtraIndex(null);
                            setShowSelfieModal(true);
                          }}
                          disabled={isGeneratingCharacter}
                          className="absolute inset-0 flex items-center justify-center focus:outline-none focus:ring-0"
                        >
                          <div className="w-[86%] h-[86%] rounded-full overflow-hidden bg-amber-500/10 border-2 border-dashed border-amber-400/50 flex flex-col items-center justify-center gap-3 text-amber-200">
                            {isGeneratingCharacter ? (
                              <>
                                <div className="relative flex items-center justify-center">
                                  <Loader2 className="w-12 h-12 text-amber-400 animate-spin" aria-hidden />
                                  <span className="sr-only">Loading</span>
                                </div>
                                <span className="text-sm font-medium">Creating your character...</span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-10 h-10" />
                                <span className="text-sm">Tap to take selfie</span>
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                      </>
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
                      onClick={() => {
                        activityTrackingService.trackOnboardingEvent('book_building_step_2_complete').catch(() => {});
                        activityTrackingService.trackOnboardingEvent('book_building_step_3_started').catch(() => {});
                        setStep(3);
                      }}
                      disabled={!avatarUrl}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl bg-white/10 text-white shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      aria-label="Next"
                    >
                      Next <ChevronRight className="w-4 h-4" />
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
                <div className="flex flex-col items-center pt-8 pb-8">
                  {!storiesLoaded && !error && <p className="text-white/70">Loading stories...</p>}
                  {storiesLoaded && stories.length === 0 && !error && (
                    <div className="text-white/80 text-sm text-center px-4 space-y-3">
                      <p>
                        No Kids Monthly stories showing. This list does not require sign-in—it comes from the backend.
                      </p>
                      <p>
                        If you&apos;ve seen &quot;Once was a Carpenter&quot; here before: the app may be pointing at a different backend (e.g. check .env <code className="bg-white/10 px-1 rounded">VITE_API_BASE_URL</code> or try the production app). Or refresh and tap Retry.
                      </p>
                      <p>
                        To add templates: create a book in the portal, set its type to &quot;Kids Monthly Book&quot;, and publish it.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStoriesRetryKey((k) => k + 1)}
                        className="mt-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium text-white"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {storiesLoaded && stories.length > 0 && (
                    <>
                      <div className="flex flex-wrap justify-center gap-4 w-full max-w-md mx-auto px-2 flex-shrink-0">
                        {stories.map((s) => {
                          const coverUrl = s.coverImage?.startsWith('http') ? s.coverImage : s.coverImage ? `${getApiRoot()}${s.coverImage.startsWith('/') ? '' : '/'}${s.coverImage}` : null;
                          const isSelected = selectedBookId === s._id;
                          return (
                            <button
                              key={s._id}
                              onClick={() => setSelectedBookId(s._id)}
                              className={`flex flex-col items-center transition-all focus:outline-none focus:ring-0 ${
                                isSelected ? 'ring-2 ring-white rounded-2xl ring-offset-2 ring-offset-transparent' : ''
                              }`}
                            >
                              {/* Widget behind book cover - solid white when selected */}
                              <div className={`relative rounded-2xl px-3 pt-3 pb-2 shadow-lg transition-colors ${
                                isSelected ? 'bg-white border-2 border-white' : 'bg-white/10 border border-white/20'
                              }`}>
                                <div className="w-full max-w-[160px] aspect-[3/4] rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-white/5">
                                  {coverUrl ? (
                                    <img src={coverUrl} alt="" className="w-full h-full object-cover object-top" />
                                  ) : (
                                    <BookOpen className="w-12 h-12 text-white/40" aria-hidden />
                                  )}
                                </div>
                                {/* Selection circle indicator */}
                                <div
                                  className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                                    isSelected ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white/20 border-white/40'
                                  }`}
                                  aria-hidden
                                >
                                  {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                </div>
                              </div>
                              <span className="text-white font-medium text-sm text-center px-2 py-2 block">{s.title}</span>
                              {s.bibleCharacter?.displayName && (
                                <span className="text-amber-200/90 text-xs pb-2">{s.bibleCharacter.displayName}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex-shrink-0 w-full max-w-md mx-auto px-2 mt-6">
                        <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 sm:p-5">
                          <p className="text-white/80 text-sm font-medium mb-3 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" aria-hidden />
                            Choose narrator voice
                          </p>
                          {narratorVoices.length === 0 ? (
                            <p className="text-white/50 text-sm">Loading voices...</p>
                          ) : (
                            <>
                              <div
                                className="overflow-x-hidden touch-pan-y select-none"
                                style={{ touchAction: 'pan-y' }}
                                onTouchStart={(e) => { narratorCarouselTouchStart.current = e.targetTouches[0].clientX; }}
                                onTouchEnd={(e) => {
                                  const start = narratorCarouselTouchStart.current;
                                  if (start == null) return;
                                  const end = e.changedTouches[0].clientX;
                                  const delta = start - end;
                                  const pageCount = Math.ceil(narratorVoices.length / 9);
                                  if (delta > 40 && narratorCarouselPage < pageCount - 1) setNarratorCarouselPage((p) => p + 1);
                                  else if (delta < -40 && narratorCarouselPage > 0) setNarratorCarouselPage((p) => p - 1);
                                  narratorCarouselTouchStart.current = null;
                                }}
                              >
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                  {narratorVoices.slice(narratorCarouselPage * 9, narratorCarouselPage * 9 + 9).map((v) => {
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
                              </div>
                              {Math.ceil(narratorVoices.length / 9) > 1 && (
                                <div className="flex justify-center gap-2 mt-3">
                                  {Array.from({ length: Math.ceil(narratorVoices.length / 9) }).map((_, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setNarratorCarouselPage(i)}
                                      className={`w-2.5 h-2.5 rounded-full transition-colors focus:outline-none focus:ring-0 ${
                                        i === narratorCarouselPage ? 'bg-amber-400' : 'bg-white/40'
                                      }`}
                                      aria-label={`Page ${i + 1}`}
                                    />
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {/* Background music picker - only when book has 2+ tracks */}
                        {bookAudioTracks.length >= 2 && (
                          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 sm:p-5 mt-4">
                            <p className="text-white/80 text-sm font-medium mb-3 flex items-center gap-2">
                              <Music className="w-4 h-4" aria-hidden />
                              Choose background music
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {bookAudioTracks.map((track, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedBackgroundMusicIndex(idx)}
                                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    selectedBackgroundMusicIndex === idx
                                      ? 'bg-amber-500 text-white ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent'
                                      : 'bg-white/20 text-white hover:bg-white/30'
                                  }`}
                                >
                                  Track {idx + 1}
                                  {track.filename && (
                                    <span className="block text-xs opacity-90 truncate max-w-[120px]" title={track.filename}>
                                      {track.filename.replace(/\.[^.]+$/, '')}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
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
                    onClick={() => {
                      activityTrackingService.trackOnboardingEvent('book_building_step_3_complete').catch(() => {});
                      activityTrackingService.trackOnboardingEvent('book_building_step_4_started').catch(() => {});
                      setStep(4);
                    }}
                    disabled={!selectedBookId}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 text-white shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    aria-label="Next"
                  >
                    Next <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="relative">
                {!creatingBook && (
                  <>
                    <div
                      className="fixed left-0 right-0 z-[2] flex flex-col gap-2 px-4 py-3"
                      style={{
                        bottom: 0,
                        paddingBottom: 'max(0.75rem, var(--safe-area-bottom, 0px))',
                        paddingTop: '0.75rem',
                      }}
                    >
                      {(() => {
                        const userEmail = (authService.getUser()?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('godlykids_user_email') : null) || '').trim().toLowerCase();
                        const limit = monthlyCreditsLimit ?? (userEmail === 'michealbouchard7@gmail.com' ? 100 : (hasTrialOrPaid ? 1 : 0));
                        const used = monthlyCreditsUsed ?? 0;
                        const remaining = Math.max(0, limit - used);
                        const creditsLabel = limit === 0 ? '0 of 1 monthly credits available' : `${remaining} of ${limit} monthly credit${limit === 1 ? '' : 's'} available`;
                        return (
                          <p className="text-center text-white/90 text-sm px-2">
                            {creditsLabel}
                          </p>
                        );
                      })()}
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
                    <div
                      className="fixed inset-0 z-[5] bg-cover bg-center pointer-events-none"
                      style={{
                        backgroundImage: 'url(/assets/images/create-story-curtain.webp)',
                        backgroundPosition: 'center 28%',
                        animation: 'curtain-reveal 1.4s ease-out forwards',
                      }}
                      aria-hidden
                    />
                    <div
                      className="relative z-20 space-y-4 pt-2"
                      style={{ animation: 'curtain-content-fade 1.4s ease-out forwards', paddingTop: 'max(0.5rem, var(--safe-area-top, 0px))' }}
                    >
                      <p className="text-white/90 text-center px-4 text-lg">
                        {(() => {
                          const names = [childName, ...extraCharacters.map((c) => c.name)].filter(Boolean);
                          const namesDisplay =
                            names.length === 1
                              ? <strong className="text-amber-200">{names[0]}</strong>
                              : names.length === 2
                                ? <><strong className="text-amber-200">{names[0]}</strong> and <strong className="text-amber-200">{names[1]}</strong></>
                                : <><strong className="text-amber-200">{names[0]}</strong>, <strong className="text-amber-200">{names[1]}</strong> and <strong className="text-amber-200">{names[2]}</strong></>;
                          return <>{namesDisplay} will star in <strong className="text-amber-200">{selectedStory?.title}</strong>.</>;
                        })()}
                      </p>
                      <div className="flex justify-center w-full">
                        <img
                          src="/assets/images/create-story-ready-text.webp"
                          alt="Ready to create your story!"
                          className="max-w-[min(320px,85vw)] w-full h-auto"
                        />
                      </div>
                    </div>
                  </>
                )}
                {creatingBook && (
                  <>
                    <div
                      key="curtain-close"
                      className="fixed inset-0 z-[5] bg-cover bg-center pointer-events-none"
                      style={{
                        backgroundImage: 'url(/assets/images/create-story-curtain.webp)',
                        animation: 'curtain-close 1s ease-out forwards',
                      }}
                      aria-hidden
                    />
                    <div
                      className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 pt-8 pb-24"
                      style={{ paddingTop: 'max(2rem, var(--safe-area-top, 0px))', paddingBottom: 'max(6rem, var(--safe-area-bottom, 0px))' }}
                    >
                      <div className="relative w-full max-w-[200px] aspect-[3/4] rounded-xl overflow-hidden border-2 border-amber-400/50 bg-amber-900/30 shadow-xl flex items-center justify-center">
                        {creatingBook.coverImageUrl ? (
                          <img src={creatingBook.coverImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-16 h-16 text-amber-200/60" />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-2">
                          <Loader2 className="w-10 h-10 text-amber-300 animate-spin" aria-hidden />
                          <span className="text-amber-200 text-sm font-bold text-center px-2">Creating your story...</span>
                          {creatingProgress?.progressTotalPages ? (
                            <span className="text-amber-300 text-sm font-medium">
                              Page {creatingProgress.progressPage + 1} of {creatingProgress.progressTotalPages}
                            </span>
                          ) : (
                            <span className="text-amber-300/90 text-sm">Starting…</span>
                          )}
                        </div>
                      </div>
                      {/* Progress: pages done out of total - always visible below the card */}
                      <div className="w-full max-w-[260px] mt-4 mx-auto">
                        {creatingProgress && creatingProgress.progressTotalPages > 0 ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-amber-200 font-medium">Progress</span>
                              <span className="text-amber-300 font-bold">
                                Page {creatingProgress.progressPage + 1} of {creatingProgress.progressTotalPages}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                                style={{
                                  width: `${((creatingProgress.progressPage + 1) / creatingProgress.progressTotalPages) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-amber-200/90 text-sm text-center">
                            {creatingProgress ? 'Starting…' : 'Preparing…'} Usually ready in 5–10 minutes.
                          </p>
                        )}
                      </div>
                      <p className="text-white font-medium text-center mt-4 px-2">{creatingBook.title}</p>
                      <label className="flex items-center gap-3 mt-6 text-white/90 cursor-pointer">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notifyWhenDone}
                          disabled={notifyToggleLoading}
                          onClick={async () => {
                            if (notifyWhenDone) {
                              setNotifyWhenDone(false);
                              return;
                            }
                            setNotifyToggleLoading(true);
                            try {
                              const userId = authService.getUserIdForBackend();
                              const isDespia = DespiaService.isNative();

                              if (isDespia) {
                                // Despia: open app settings so user can enable notifications, then register
                                DespiaService.openSettings();
                                if (userId) await NotificationService.registerPushWithBackend(userId);
                                setNotifyWhenDone(true);
                              } else {
                                // Web: request permission; if denied, guide to browser settings
                                if (typeof Notification !== 'undefined') {
                                  if (Notification.permission === 'denied') {
                                    alert('Notifications are blocked. Please enable them in your browser settings.');
                                    setNotifyToggleLoading(false);
                                    return;
                                  }
                                  if (Notification.permission === 'default') {
                                    const permission = await Notification.requestPermission();
                                    if (permission !== 'granted') {
                                      setNotifyToggleLoading(false);
                                      return;
                                    }
                                  }
                                  if (userId) await NotificationService.registerPushWithBackend(userId);
                                }
                                setNotifyWhenDone(true);
                              }
                            } catch (e) {
                              console.error('Notify toggle error:', e);
                            } finally {
                              setNotifyToggleLoading(false);
                            }
                          }}
                          className={`relative w-12 h-7 rounded-full transition-colors ${notifyWhenDone ? 'bg-amber-500' : 'bg-white/20'}`}
                        >
                          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyWhenDone ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-sm">Get notified when done</span>
                        {notifyToggleLoading && <Loader2 className="w-4 h-4 animate-spin text-amber-300" />}
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/library', {
                          state: {
                            fromCreateYourStory: true,
                            fromCreating: true,
                            creatingBook: creatingBook ? { customMonthlyBookId: creatingBook.customMonthlyBookId, title: creatingBook.title, coverImageUrl: creatingBook.coverImageUrl } : undefined,
                          },
                        })}
                        className="mt-6 w-full max-w-[240px] py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98]"
                      >
                        <Compass className="w-5 h-5" />
                        See in Library
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <SelfieCapture
        isOpen={showSelfieModal}
        onCapture={handleSelfieCapture}
        onClose={() => {
          setShowSelfieModal(false);
          setEditingExtraIndex(null);
        }}
        childName={editingExtraIndex !== null ? (extraCharacters[editingExtraIndex]?.name || 'Character') : (childName || 'there')}
        frameOverlayImageUrl="/assets/images/create-story-selfie-porthole-overlay.webp"
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
