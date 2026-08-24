import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, Loader2, Play, Pause, Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { ApiService } from '../services/apiService';
import { activityTrackingService } from '../services/activityTrackingService';
import { filterVisibleVoices } from '../services/voiceManagementService';
import { cleanVoiceDescription } from '../utils/voiceUtils';

/**
 * Voice Selection for New Users
 * Shows after account creation, before landing in content
 * Let them pick their preferred narrator voice
 */
const NewUserVoiceSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { unlockVoice } = useUser();
  
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Load available voices on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        setLoadingVoices(true);
        const voices = await ApiService.getVoices();
        const filtered = filterVisibleVoices(voices || []);
        
        // Sort by priority (lower number = higher priority)
        const sorted = filtered.sort((a: any, b: any) => {
          const aPriority = a.priority ?? 999;
          const bPriority = b.priority ?? 999;
          return aPriority - bPriority;
        });
        
        setAvailableVoices(sorted);
        
        // Auto-select the first voice
        if (sorted.length > 0) {
          setSelectedVoiceId(sorted[0].id);
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    loadVoices();

    // Track voice selection shown
    activityTrackingService.trackOnboardingEvent('new_user_voice_selection_shown');
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const handlePreviewVoice = (voice: any) => {
    if (!voice.previewUrl) return;

    // If already previewing this voice, stop it
    if (previewingVoiceId === voice.id && previewAudio) {
      previewAudio.pause();
      setPreviewingVoiceId(null);
      return;
    }

    // Stop any existing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
    }

    // Create new audio and play
    const audio = new Audio(voice.previewUrl);
    audio.addEventListener('ended', () => setPreviewingVoiceId(null));
    audio.addEventListener('error', () => setPreviewingVoiceId(null));
    
    setPreviewAudio(audio);
    setPreviewingVoiceId(voice.id);
    audio.play().catch((err) => {
      console.error('Failed to play voice preview:', err);
      setPreviewingVoiceId(null);
    });
  };

  const handleContinue = () => {
    if (!selectedVoiceId) return;

    // Save selected voice as default
    localStorage.setItem('godlykids_default_voice', selectedVoiceId);
    
    // Unlock the voice for the user
    const selectedVoice = availableVoices.find(v => v.id === selectedVoiceId);
    if (selectedVoice && unlockVoice) {
      unlockVoice(selectedVoice);
    }

    activityTrackingService.trackOnboardingEvent('new_user_voice_selected', {
      voiceId: selectedVoiceId,
      voiceName: selectedVoice?.name || 'unknown'
    });

    // Stop any playing audio
    if (previewAudio) {
      previewAudio.pause();
    }

    // Navigate to first story
    navigate('/first-story', { replace: true });
  };

  const handleSkip = () => {
    activityTrackingService.trackOnboardingEvent('new_user_voice_selection_skipped');
    
    // Stop any playing audio
    if (previewAudio) {
      previewAudio.pause();
    }

    // Navigate to first story with default voice
    navigate('/first-story', { replace: true });
  };

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-10 overflow-y-auto">
        <div className="w-full max-w-md">
          
          {/* Icon and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-300/40">
              <Volume2 className="text-white w-8 h-8" />
            </div>
            <h1 className="font-display font-extrabold text-3xl text-[#1e1b4b] mb-2">
              Choose Your Narrator
            </h1>
            <p className="text-[#64748b] text-lg">
              Pick your favorite voice for the stories
            </p>
          </div>

          {/* Voice List */}
          {loadingVoices ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#6366f1]" />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {availableVoices.slice(0, 6).map((voice) => (
                <div
                  key={voice.id}
                  className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                    selectedVoiceId === voice.id
                      ? 'bg-[#eef2ff] border-[#6366f1] shadow-md'
                      : 'bg-white border-gray-200 hover:border-[#6366f1]/50'
                  }`}
                >
                  <button
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedVoiceId === voice.id ? 'bg-[#6366f1] border-[#6366f1]' : 'border-gray-300'
                    }`}>
                      {selectedVoiceId === voice.id && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1e1b4b] mb-0.5">{voice.name}</p>
                      <p className="text-xs text-gray-500">{cleanVoiceDescription(voice.description)}</p>
                    </div>
                  </button>

                  {/* Preview Button */}
                  {voice.previewUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(voice);
                      }}
                      className="absolute top-3 right-3 w-10 h-10 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] flex items-center justify-center transition-colors shadow-md"
                    >
                      {previewingVoiceId === voice.id ? (
                        <Pause className="w-5 h-5 text-white" strokeWidth={2.5} />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" strokeWidth={2.5} />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedVoiceId || loadingVoices}
            className="w-full py-4 bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold text-lg rounded-2xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3"
          >
            Continue
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="w-full py-3 text-[#6366f1] font-semibold hover:text-[#4f46e5] transition-colors"
          >
            Skip for now
          </button>

          <p className="text-center text-[#94a3b8] text-xs mt-4 leading-relaxed">
            You can change this anytime in settings
          </p>
        </div>
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default NewUserVoiceSelectionPage;
