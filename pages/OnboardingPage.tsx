import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Plus, Trash2, UserCircle, Mic, X } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';
import ParentGateModal from '../components/features/ParentGateModal';
import VoiceCloningModal from '../components/features/VoiceCloningModal';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import { ApiService } from '../services/apiService';
import { filterVisibleVoices } from '../services/voiceManagementService';
import { cleanVoiceDescription, cleanVoiceCategory } from '../utils/voiceUtils';

// Use Funny Heads instead of generic human seeds
const FUNNY_HEADS = [
  'head-toast',
  'head-burger',
  'head-cookie',
  'head-tv',
  'head-slime',
  'head-pumpkin',
  'head-earth',
  'head-moon',
  'head-bomb',
  'head-eye',
  'head-bear-brown',
  'head-bear-polar',
  'head-bear-aviator',
  'head-dog-pug',
  'head-dog-dalmatian',
  'head-cat-orange',
  'head-cat-black',
  'head-lizard'
];

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setParentName, setEquippedAvatar, addKid, kids, removeKid, subscribe, resetUser } = useUser();
  const { playClick, playSuccess } = useAudio();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // Steps: 1=Parent, 2=Family, 3=Voice Selection, 4=Unlock

  // Step 1 State (Parent)
  const [pName, setPName] = useState('');
  const [pAvatar, setPAvatar] = useState(FUNNY_HEADS[0]);

  // Step 2 State (Kid Entry)
  const [kidName, setKidName] = useState('');
  const [kidAge, setKidAge] = useState('');
  const [kidAvatar, setKidAvatar] = useState(FUNNY_HEADS[1]);
  
  // Step 3 State (Voice Selection)
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  
  // Step 4 State (Paywall)
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  
  // Voice Cloning (Optional - hidden)
  const [showVoiceCloningModal, setShowVoiceCloningModal] = useState(false);
  const [voiceCloned, setVoiceCloned] = useState(false);

  // Reset user data when entering onboarding to ensure a fresh start
  useEffect(() => {
    if (resetUser && typeof resetUser === 'function') {
      resetUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS ---

  const handleStep1Submit = () => {
    if (!pName.trim()) return;
    playClick();
    setParentName(pName);
    setEquippedAvatar(pAvatar);
    setStep(2);
  };

  const handleAddKid = () => {
    if (!kidName.trim()) return;
    playSuccess();
    addKid({
      id: Date.now().toString(),
      name: kidName,
      age: kidAge,
      avatarSeed: kidAvatar
    });
    // Reset inputs for next kid
    setKidName('');
    setKidAge('');
    setKidAvatar(FUNNY_HEADS[Math.floor(Math.random() * FUNNY_HEADS.length)]);
  };

  const handleStep2Continue = () => {
    playClick();
    setStep(3); // Go to voice selection step
  };
  
  // Load available voices for step 3
  useEffect(() => {
    if (step === 3) {
      setLoadingVoices(true);
      ApiService.getVoices()
        .then(voices => {
          const visibleVoices = filterVisibleVoices(voices);
          setAvailableVoices(visibleVoices);
          // Auto-select first voice if available
          if (visibleVoices.length > 0 && !selectedVoiceId) {
            setSelectedVoiceId(visibleVoices[0].voice_id);
          }
        })
        .catch(error => {
          console.error('Error loading voices:', error);
        })
        .finally(() => {
          setLoadingVoices(false);
        });
    }
  }, [step]);
  
  const handleStep3Continue = () => {
    if (!selectedVoiceId) return;
    playClick();
    // Stop any playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      setPreviewAudio(null);
    }
    // Save selected voice preference (could store in UserContext or localStorage)
    localStorage.setItem('godlykids_default_voice', selectedVoiceId);
    setStep(4); // Go to unlock/paywall step
  };
  
  const handleVoiceClick = async (voiceId: string) => {
    playClick();
    setSelectedVoiceId(voiceId);
    
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      setPreviewAudio(null);
    }
    
    // Generate and play preview
    setPreviewingVoiceId(voiceId);
    try {
      const previewText = "Hello Godly Kid! Are you ready for an adventure?[chuckle]";
      const result = await ApiService.generateTTS(previewText, voiceId);
      
      if (result && result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        
        audio.onended = () => {
          setPreviewingVoiceId(null);
          setPreviewAudio(null);
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e, 'URL:', result.audioUrl);
          setPreviewingVoiceId(null);
          setPreviewAudio(null);
        };
        
        // Wait for audio to be ready before playing
        audio.oncanplaythrough = async () => {
          try {
            await audio.play();
          } catch (playError: any) {
            console.error('Error playing audio:', playError);
            setPreviewingVoiceId(null);
            setPreviewAudio(null);
          }
        };
        
        audio.onloadstart = () => {
          // Audio is loading
        };
        
        setPreviewAudio(audio);
      } else {
        console.error('No audio URL returned from TTS generation');
        setPreviewingVoiceId(null);
      }
    } catch (error) {
      console.error('Error playing voice preview:', error);
      setPreviewingVoiceId(null);
    }
  };
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const handleSubscribeClick = () => {
    setShowParentGate(true);
  };

  const handleSkipVoiceCloning = () => {
    playClick();
    setStep(4); // Move to unlock/paywall step
  };

  const handleVoiceCloningContinue = () => {
    playClick();
    setStep(4); // Move to unlock/paywall step
  };

  const handleGateSuccess = () => {
    playSuccess();
    subscribe();
    navigate('/home');
  };

  const handleVoiceCloned = (voice: ClonedVoice) => {
    setVoiceCloned(true);
    playSuccess();
  };

  // --- RENDERERS ---

  const renderProgress = () => {
    const totalSteps = 4; // Parent, Family, Voice Selection, Unlock
    return (
    <div className="w-full max-w-md px-8 mb-8">
       <div className="flex justify-between mb-2 text-[#eecaa0] font-display font-bold text-xs uppercase tracking-widest">
          <span className={step >= 1 ? "text-[#FFD700]" : "opacity-50"}>Parent</span>
          <span className={step >= 2 ? "text-[#FFD700]" : "opacity-50"}>Family</span>
          <span className={step >= 3 ? "text-[#FFD700]" : "opacity-50"}>Voice</span>
          <span className={step >= 4 ? "text-[#FFD700]" : "opacity-50"}>Unlock</span>
       </div>
       <div className="h-3 bg-[#3E1F07] rounded-full overflow-hidden border border-[#5c2e0b] shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-[#FFD700] to-[#ffb300] transition-all duration-500 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
       </div>
    </div>
    );
  };

  // Helper for rendering internal avatar asset
  const renderAvatarAsset = (headKey: string) => {
    const isInternalHead = headKey.startsWith('head-');
    if (isInternalHead && AVATAR_ASSETS[headKey]) {
      return (
        <div className="w-[90%] h-[90%]">
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
            {AVATAR_ASSETS[headKey]}
          </svg>
        </div>
      );
    }
    return (
      <img src={headKey} alt="avatar" className="w-full h-full object-cover" />
    );
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar bg-[#0f172a]">
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
          <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-[#0ea5e9]/20 to-transparent"></div>
      </div>

      {/* HEADER */}
      <div className="relative z-20 pt-6 px-6 flex items-center justify-between">
         {step > 1 && (
           <button onClick={() => setStep(prev => (prev - 1) as any)} className="text-[#eecaa0] hover:text-white transition-colors">
              <ChevronLeft size={32} />
           </button>
         )}
         {step === 1 && <div className="w-8"></div>} {/* Spacer */}
         
         <div className="flex flex-col items-center">
             <h1 className="font-display font-extrabold text-2xl text-white tracking-wide drop-shadow-md">
                 SETUP
             </h1>
         </div>
         
         <div className="w-8"></div> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col items-center pt-6 pb-10 w-full relative z-10">
        
        {renderProgress()}

        {/* --- STEP 1: PARENT PROFILE --- */}
        {step === 1 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
             
             {/* Clarification Banner */}
             <div className="bg-[#eecaa0]/20 rounded-lg p-3 mb-6 flex items-center gap-3 border border-[#eecaa0]/30">
                 <div className="bg-[#FFD700] rounded-full p-1.5 text-[#5c2e0b]">
                     <UserCircle size={20} />
                 </div>
                 <p className="text-[#eecaa0] text-sm font-bold">
                     Step 1: Create the <span className="text-white">Parent Profile</span>
                 </p>
             </div>

             {/* Avatar Picker */}
             <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-[0_0_30px_rgba(255,255,255,0.2)] bg-[#f3e5ab] mb-6 relative overflow-hidden flex items-center justify-center">
                     <div className="w-[90%] h-[90%] flex items-center justify-center">
                         {renderAvatarAsset(pAvatar)}
                     </div>
                </div>
                
                <div className="w-full overflow-x-auto no-scrollbar pb-2">
                  <div className="flex gap-3 justify-center min-w-min px-2">
                    {FUNNY_HEADS.map((head) => (
                      <button
                        key={head}
                        onClick={() => setPAvatar(head)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 p-1 bg-[#f3e5ab] flex items-center justify-center ${pAvatar === head ? 'border-[#FFD700] scale-110 ring-2 ring-[#FFD700]/50' : 'border-white/20 opacity-60 hover:opacity-100'}`}
                      >
                          {renderAvatarAsset(head)}
                      </button>
                    ))}
                  </div>
                </div>
             </div>

             {/* Name Input */}
             <div className="bg-[#3E1F07] p-6 rounded-2xl border-2 border-[#5c2e0b] shadow-xl">
                 <label className="block text-[#eecaa0] font-display font-bold text-sm tracking-wide mb-2 uppercase">
                   Parent Name
                 </label>
                 <input 
                    type="text" 
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="e.g. Mom, Dad"
                    className="w-full bg-black/30 border-2 border-[#8B4513] rounded-xl px-4 py-3 text-white font-display text-lg placeholder:text-white/30 focus:outline-none focus:border-[#FFD700] transition-colors text-center"
                    autoFocus
                 />
             </div>

             <div className="mt-8">
                <WoodButton 
                  fullWidth 
                  onClick={handleStep1Submit} 
                  disabled={!pName.trim()}
                  className={`py-4 text-xl ${!pName.trim() ? 'opacity-50 grayscale' : ''}`}
                >
                   NEXT: FAMILY
                </WoodButton>
             </div>
          </div>
        )}

        {/* --- STEP 2: ADD KIDS --- */}
        {step === 2 && (
           <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500 flex flex-col h-full">
              
              <div className="text-center mb-6">
                 <h2 className="text-white font-display font-bold text-xl">Who is adventuring?</h2>
                 <p className="text-[#eecaa0] text-sm">Create profiles for your children.</p>
              </div>

              {/* Added Kids List */}
              <div className="space-y-3 mb-6">
                  {kids.map((kid) => (
                      <div key={kid.id} className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center justify-between border border-white/10 animate-in zoom-in">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-[#f3e5ab] overflow-hidden border-2 border-white/50 flex items-center justify-center p-1">
                                   {renderAvatarAsset(kid.avatarSeed)}
                              </div>
                              <div>
                                  <h3 className="text-white font-bold font-display text-lg">{kid.name}</h3>
                                  <span className="text-[#eecaa0] text-xs font-bold">{kid.age} years old</span>
                              </div>
                          </div>
                          <button onClick={() => removeKid(kid.id)} className="w-8 h-8 bg-red-500/20 text-red-300 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>

              {/* Add Kid Form */}
              <div className="bg-[#3E1F07] p-5 rounded-2xl border-2 border-[#5c2e0b] shadow-xl mb-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-[#FFD700] text-[#5c2e0b] text-[10px] font-bold px-2 py-1 rounded-bl-lg">NEW PROFILE</div>
                 
                 <div className="flex gap-4 mb-4">
                    <div className="w-20 shrink-0 flex flex-col gap-2">
                        <div 
                           className="w-20 h-20 rounded-xl bg-[#f3e5ab] border-2 border-[#8B4513] overflow-hidden relative cursor-pointer hover:opacity-90 flex items-center justify-center p-2"
                           onClick={() => setKidAvatar(FUNNY_HEADS[Math.floor(Math.random() * FUNNY_HEADS.length)])}
                        >
                             {renderAvatarAsset(kidAvatar)}
                             <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-0.5">TAP</div>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <input 
                            type="text" 
                            placeholder="Child's Name"
                            value={kidName}
                            onChange={(e) => setKidName(e.target.value)}
                            className="w-full bg-black/30 border border-[#8B4513] rounded-lg px-3 py-2 text-white font-display placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]"
                        />
                        <input 
                            type="number" 
                            placeholder="Age"
                            value={kidAge}
                            onChange={(e) => setKidAge(e.target.value)}
                            className="w-20 bg-black/30 border border-[#8B4513] rounded-lg px-3 py-2 text-white font-display placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]"
                        />
                    </div>
                 </div>
                 
                 <button 
                    onClick={handleAddKid}
                    disabled={!kidName.trim()}
                    className={`w-full bg-[#5c2e0b] hover:bg-[#70380d] text-[#eecaa0] font-display font-bold py-3 rounded-xl border border-[#8B4513] flex items-center justify-center gap-2 transition-colors ${!kidName.trim() ? 'opacity-50' : ''}`}
                 >
                    <Plus size={18} />
                    ADD CHILD
                 </button>
              </div>

              <div className="mt-auto">
                 <WoodButton 
                    fullWidth 
                    onClick={handleStep2Continue}
                    className="py-4 text-xl"
                 >
                    {kids.length > 0 ? "CONTINUE" : "SKIP FOR NOW"}
                 </WoodButton>
              </div>
           </div>
        )}

        {/* --- STEP 3: VOICE CLONING (DISABLED - ElevenLabs Limit Reached) --- */}
        {/* Voice cloning feature removed due to ElevenLabs 180 clone limit */}
        {false && step === 3 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-2xl border-4 border-[#8B4513]">
                <Mic className="text-[#8B4513]" size={48} />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">
                Create Your Own Voice!
              </h2>
              <p className="text-[#eecaa0] text-lg leading-relaxed">
                Record your voice (or a loved one's like Grandpa) to read books in a familiar voice
              </p>
            </div>

            {/* Feature Benefits */}
            <div className="bg-[#3E1F07]/50 rounded-xl p-6 mb-8 border-2 border-[#5D2E0E]">
              <h3 className="text-white font-bold mb-4 text-lg">Why create a voice?</h3>
              <ul className="space-y-3 text-white/90">
                <li className="flex items-start gap-3">
                  <Check className="text-[#FFD700] flex-shrink-0 mt-1" size={20} />
                  <span>Listen to books in <span className="font-bold text-white">Grandpa's voice</span> or any family member</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#FFD700] flex-shrink-0 mt-1" size={20} />
                  <span>Create up to <span className="font-bold text-white">5 custom voices</span> stored on your device</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#FFD700] flex-shrink-0 mt-1" size={20} />
                  <span>Make storytime more <span className="font-bold text-white">personal and engaging</span></span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <WoodButton
                onClick={() => {
                  playClick();
                  setShowVoiceCloningModal(true);
                }}
                className="w-full"
              >
                <div className="flex items-center justify-center gap-2">
                  <Mic size={20} />
                  <span className="text-lg font-bold">Create Voice Now</span>
                </div>
              </WoodButton>

              {voiceCloned && (
                <div className="bg-green-600/20 border-2 border-green-500 rounded-xl p-4 text-center">
                  <Check className="text-green-400 mx-auto mb-2" size={24} />
                  <p className="text-green-200 font-bold">Voice created successfully!</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSkipVoiceCloning}
                  className="flex-1 text-[#eecaa0] text-sm font-bold underline decoration-dotted opacity-70 hover:opacity-100 transition-opacity"
                >
                  Skip for now
                </button>
                {voiceCloned && (
                  <button
                    onClick={handleVoiceCloningContinue}
                    className="flex-1 px-6 py-3 bg-[#FFD700] hover:bg-[#ffed4e] border-2 border-[#B8860B] rounded-xl text-[#8B4513] font-bold transition-colors"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 3: VOICE SELECTION --- */}
        {step === 3 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-2xl border-4 border-[#8B4513]">
                <Mic className="text-[#8B4513]" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Choose Your First Voice!
              </h2>
              <p className="text-[#eecaa0] text-sm mb-1">
                Select a voice to read stories and devotionals
              </p>
              <p className="text-[#eecaa0]/70 text-xs">
                Don't worry, more voices can be unlocked in the shop!
              </p>
            </div>

            {loadingVoices ? (
              <div className="text-center text-[#eecaa0] py-8">Loading voices...</div>
            ) : availableVoices.length === 0 ? (
              <div className="text-center text-[#eecaa0] py-8">No voices available</div>
            ) : (
              <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
                {availableVoices.map((voice) => (
                  <button
                    key={voice.voice_id}
                    onClick={() => handleVoiceClick(voice.voice_id)}
                    disabled={previewingVoiceId === voice.voice_id}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      selectedVoiceId === voice.voice_id
                        ? 'bg-[#FFD700]/20 border-[#FFD700] shadow-lg'
                        : 'bg-[#3E1F07]/50 border-[#5c2e0b] hover:border-[#FFD700]/50'
                    } ${previewingVoiceId === voice.voice_id ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {voice.characterImage ? (
                        <img 
                          src={voice.characterImage} 
                          alt={voice.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#5c2e0b] flex items-center justify-center border-2 border-white/20">
                          <Mic className="text-[#eecaa0]" size={24} />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="text-white font-bold text-lg">{voice.name}</div>
                        {cleanVoiceDescription(voice.description) && (
                          <div className="text-[#eecaa0] text-sm mt-1">{cleanVoiceDescription(voice.description)}</div>
                        )}
                        {cleanVoiceCategory(voice.category) && (
                          <div className="text-[#eecaa0]/70 text-xs mt-1 capitalize">{cleanVoiceCategory(voice.category)}</div>
                        )}
                      </div>
                      {previewingVoiceId === voice.voice_id ? (
                        <div className="w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
                      ) : selectedVoiceId === voice.voice_id ? (
                        <Check className="text-[#FFD700]" size={24} />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <WoodButton
              fullWidth
              onClick={handleStep3Continue}
              disabled={!selectedVoiceId}
              className={`py-4 text-xl ${!selectedVoiceId ? 'opacity-50 grayscale' : ''}`}
            >
              CONTINUE
            </WoodButton>
          </div>
        )}

        {/* --- STEP 4: PAYWALL / DEAL --- */}
        {step === 4 && (
            <div className="w-full max-w-md px-4 animate-in slide-in-from-right-10 duration-500 pb-10">
                 
                 {/* Main Card */}
                <div className="bg-white/90 backdrop-blur-md rounded-[2rem] p-6 shadow-2xl border-4 border-[#FFD700] flex flex-col items-center text-center relative">
                    
                    {/* Best Value Badge */}
                    <div className="absolute -top-4 bg-gradient-to-r from-[#d32f2f] to-[#c62828] text-white px-4 py-1 rounded-full font-bold shadow-md text-xs uppercase tracking-widest border-2 border-white transform rotate-2">
                        Special Launch Offer
                    </div>

                    <h2 className="text-[#3E1F07] font-display font-extrabold text-3xl leading-none mb-2 mt-2">
                        Unlock Everything
                    </h2>
                    <p className="text-[#5c2e0b] font-sans font-medium text-sm mb-6 opacity-80">
                        Give your kids unlimited access to faith-filled adventures.
                    </p>

                    {/* Pricing Options */}
                    <div className="w-full space-y-3 mb-6">
                        {/* Annual Option */}
                        <div 
                            onClick={() => setSelectedPlan('annual')}
                            className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                                selectedPlan === 'annual' 
                                ? 'bg-[#fff8e1] border-[#FFD700] shadow-md scale-[1.02] ring-1 ring-[#FFD700]' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <div className="absolute top-0 right-0 bg-[#FFD700] text-[#3E1F07] text-[10px] font-extrabold px-3 py-1 rounded-bl-lg">
                                SAVE 70%
                            </div>
                            <div className="px-4 py-4 flex items-center justify-between">
                                <div className="flex flex-col text-left">
                                    <span className="font-display font-bold text-lg text-[#3E1F07]">Annual Plan</span>
                                    <span className="text-xs text-[#8B4513]">$0.55 / week</span>
                                </div>
                                <div className="flex flex-col items-end pr-2">
                                        <span className="font-display font-extrabold text-2xl text-[#3E1F07]">$29</span>
                                        <span className="text-[10px] text-red-500 line-through font-bold opacity-70">$99.99</span>
                                </div>
                            </div>
                            {selectedPlan === 'annual' && (
                                <div className="absolute top-1/2 -translate-y-1/2 left-3 bg-[#FFD700] rounded-full p-0.5">
                                    <Check size={12} className="text-[#3E1F07]" strokeWidth={4} />
                                </div>
                            )}
                        </div>

                        {/* Monthly Option */}
                        <div 
                            onClick={() => setSelectedPlan('monthly')}
                            className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                                selectedPlan === 'monthly' 
                                ? 'bg-[#fff8e1] border-[#FFD700] shadow-md scale-[1.02]' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                             <div className="px-4 py-4 flex items-center justify-between">
                                <div className="flex flex-col text-left pl-6">
                                    <span className="font-display font-bold text-lg text-[#3E1F07]">Monthly</span>
                                </div>
                                <div className="flex flex-col items-end">
                                     <span className="font-display font-extrabold text-2xl text-[#3E1F07]">$7.99</span>
                                </div>
                            </div>
                            {selectedPlan === 'monthly' && (
                                <div className="absolute top-1/2 -translate-y-1/2 left-3 bg-[#FFD700] rounded-full p-0.5">
                                    <Check size={12} className="text-[#3E1F07]" strokeWidth={4} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTA Button */}
                    <WoodButton 
                        fullWidth 
                        variant="gold"
                        onClick={handleSubscribeClick}
                        className="py-4 text-xl shadow-xl mb-4 border-b-4 border-[#B8860B]"
                    >
                        START FREE TRIAL
                    </WoodButton>

                    <button 
                        onClick={() => navigate('/home')}
                        className="text-[#8B4513] text-xs font-bold underline decoration-dotted opacity-70 hover:opacity-100"
                    >
                        No thanks, I'll continue with limited access
                    </button>
                </div>
            </div>
        )}

        {/* Make sure ParentGateModal is imported at the top of your file:
            import ParentGateModal from '../components/ParentGateModal';
        */}
        <ParentGateModal 
            isOpen={showParentGate} 
            onClose={() => setShowParentGate(false)} 
            onSuccess={handleGateSuccess} 
        />

        {/* Voice Cloning Modal - Hidden */}
        {false && (
          <VoiceCloningModal
            isOpen={showVoiceCloningModal}
            onClose={() => setShowVoiceCloningModal(false)}
            onVoiceCloned={handleVoiceCloned}
          />
        )}

      </div>
    </div>
  );
};

export default OnboardingPage;