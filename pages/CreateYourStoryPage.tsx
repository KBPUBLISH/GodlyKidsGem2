import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SelfieCapture from '../components/features/SelfieCapture';
import CharacterStyleSelector, { CHARACTER_STYLES } from '../components/features/CharacterStyleSelector';
import { getApiBaseUrl } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import { authService } from '../services/authService';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';

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
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    (async () => {
      try {
        const base = getApiRoot();
        const res = await fetch(`${base}/api/books?bookType=kids_monthly`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (!res.ok) setError(data.error || data.message || 'Could not load stories.');
          else {
            const list = Array.isArray(data.data) ? data.data : [];
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
        if (!cancelled) setError('Could not load stories.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
    setShowStyleSelector(false);
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSubmitted(true);
        setTimeout(() => navigate('/library'), 4000);
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

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
      <div className="flex-1 px-4 pt-8 pb-12 overflow-y-auto" style={{ paddingTop: 'max(2rem, var(--safe-area-top, 0px))' }}>
        {submitted ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/30 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-amber-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Creating your story{selectedStory?.title ? `: ${selectedStory.title}` : ''}...</h2>
            <p className="text-white/80 mb-2">Your story is being written by angels.</p>
            <p className="text-amber-200/90">We'll notify you in ~5 minutes when it's ready!</p>
            <p className="text-white/50 text-sm mt-6">Taking you back to your library...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/50 text-red-200 text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">What name should we use in your story?</h2>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={() => setStep(2)}
                  disabled={!childName.trim()}
                  className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">{selectedStyleId ? 'Now take your selfie' : '1. Choose your character style'}</h2>
                <p className="text-white/70 text-sm">
                  {selectedStyleId
                    ? "2. We'll turn your photo into a full-body character in a scene."
                    : "Pick a style below (Pixar, Minecraft, Disney…). Then you'll take a selfie and we'll place you full-body in a fun scene."}
                </p>
                {!selectedStyleId ? (
                  <div className="grid grid-cols-2 gap-3">
                    {CHARACTER_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`p-4 rounded-2xl text-left border-2 transition-all bg-[#3A2A1A] hover:bg-[#4A3A2A] border-white/20 hover:border-amber-400/50`}
                      >
                        <span className="text-3xl block mb-2">{style.previewEmoji}</span>
                        <span className="font-bold text-[#FFD700] block">{style.name}</span>
                        <span className="text-xs text-white/70">{style.description}</span>
                      </button>
                    ))}
                  </div>
                ) : selectedStyleId && (
                  avatarUrl ? (
                    <div className="rounded-2xl overflow-hidden border-2 border-amber-400/50">
                      <img src={avatarUrl} alt="Your character" className="w-full aspect-square object-cover" />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSelfieModal(true)}
                      disabled={isGeneratingCharacter}
                      className="w-full aspect-square max-w-[280px] mx-auto rounded-2xl border-2 border-dashed border-amber-400/50 bg-amber-500/10 flex flex-col items-center justify-center gap-2 text-amber-200"
                    >
                      {isGeneratingCharacter ? <span>Creating your character...</span> : <><BookOpen className="w-12 h-12" /> Tap to take selfie</>}
                    </button>
                  )
                )}
                <div className="flex gap-3">
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
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white"
                  >
                    Back
                  </button>
                  {selectedStyleId && (
                    <button
                      onClick={() => setStep(3)}
                      disabled={!avatarUrl}
                      className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      Next <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">Pick your story</h2>
                <p className="text-white/70 text-sm">Choose which story you want to star in.</p>
                <div className="grid grid-cols-2 gap-3">
                  {stories.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => setSelectedBookId(s._id)}
                      className={`p-4 rounded-xl text-left border-2 transition-all ${
                        selectedBookId === s._id
                          ? 'border-amber-400 bg-amber-500/20'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <span className="text-white font-medium block">{s.title}</span>
                      {s.bibleCharacter?.displayName && (
                        <span className="text-amber-200/90 text-sm">{s.bibleCharacter.displayName}</span>
                      )}
                    </button>
                  ))}
                </div>
                {stories.length === 0 && !error && <p className="text-white/50">Loading stories...</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-white/10 text-white">
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!selectedBookId}
                    className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Next <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">Ready to create your story!</h2>
                <p className="text-white/70">
                  <strong className="text-amber-200">{childName}</strong> will star in <strong className="text-amber-200">{selectedStory?.title}</strong>.
                </p>
                <p className="text-white/50 text-sm">We'll build your book and notify you when it's ready (~5 min).</p>
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
            )}
          </>
        )}
      </div>

      <SelfieCapture
        isOpen={showSelfieModal}
        onCapture={handleSelfieCapture}
        onClose={() => setShowSelfieModal(false)}
        childName={childName || 'there'}
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
