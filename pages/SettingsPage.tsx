import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2, Bell, Shield, FileText, LogOut, Crown, HelpCircle, Mic, Trash2, RefreshCw, CheckCircle, AlertCircle, Music, Globe, Check, ChevronRight } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import { ApiService } from '../services/apiService';
import { getHiddenVoices, isVoiceHidden, toggleVoiceVisibility } from '../services/voiceManagementService';
import { cleanVoiceDescription } from '../utils/voiceUtils';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiService';
import WebViewModal from '../components/features/WebViewModal';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSubscribed, isVoiceUnlocked, setIsSubscribed } = useUser();
  const { sfxEnabled, toggleSfx, playBack, musicEnabled, toggleMusic, musicVolume, setMusicVolume } = useAudio();
  const { currentLanguage, setLanguage, supportedLanguages, isTranslating, t } = useLanguage();
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [unlockedVoices, setUnlockedVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  
  // Restore purchases state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  // WebView modal state
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewTitle, setWebViewTitle] = useState('');
  
  // Load cloned voices
  useEffect(() => {
    const voices = voiceCloningService.getClonedVoices();
    setClonedVoices(voices);
  }, []);
  
  // Load available voices for management - only show unlocked voices
  useEffect(() => {
    setLoadingVoices(true);
    ApiService.getVoices()
      .then(voices => {
        setAvailableVoices(voices);
        // Filter to only show unlocked voices
        const unlocked = voices.filter((v: any) => isVoiceUnlocked(v.voice_id));
        setUnlockedVoices(unlocked);
        console.log(`🎤 Settings: ${unlocked.length} unlocked voices out of ${voices.length} total`);
      })
      .catch(error => {
        console.error('Error loading voices:', error);
      })
      .finally(() => {
        setLoadingVoices(false);
      });
  }, [isVoiceUnlocked]);
  
  // Robust back handler - Explicitly goes to Profile as requested
  const handleBack = () => {
      playBack();
      navigate('/profile');
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm(`Are you sure you want to delete this voice? This action cannot be undone.`)) {
      return;
    }

    setDeletingVoiceId(voiceId);
    try {
      // Delete from ElevenLabs API
      const success = await ApiService.deleteClonedVoice(voiceId);
      
      if (success) {
        // Remove from local storage
        voiceCloningService.removeClonedVoice(voiceId);
        // Update state
        setClonedVoices(voiceCloningService.getClonedVoices());
      } else {
        alert('Failed to delete voice. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting voice:', error);
      alert('Failed to delete voice. Please try again.');
    } finally {
      setDeletingVoiceId(null);
    }
  };

  // Handle restore purchases from old Godly Kids app
  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreResult(null);

    try {
      // Get user email from auth service
      const user = authService.getUser();
      if (!user?.email) {
        setRestoreResult({
          type: 'error',
          message: 'Please sign in with the same email you used in the old app.',
        });
        return;
      }

      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}migration/restore-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to restore purchases');
      }

      if (data.subscriptionRestored) {
        // Successfully restored subscription
        setIsSubscribed(true);
        setRestoreResult({
          type: 'success',
          message: 'Your subscription has been restored! Welcome back! 🎉',
        });
      } else if (data.found && !data.subscriptionRestored) {
        // Account found but subscription expired or not active
        setRestoreResult({
          type: 'info',
          message: data.message || 'Account found but no active subscription.',
        });
      } else {
        // No account found
        setRestoreResult({
          type: 'info',
          message: 'No previous subscription found with this email.',
        });
      }
    } catch (error: any) {
      console.error('Restore purchases error:', error);
      setRestoreResult({
        type: 'error',
        message: error.message || 'Unable to restore purchases. Please try again later.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#fdf6e3]">
      
      {/* Fixed Wood Header */}
      <div className="relative z-30 pt-8 pb-4 px-6 bg-[#CD853F] shadow-md border-b border-[#8B4513] shrink-0">
        {/* Wood Texture */}
         <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
        
        <div className="relative flex items-center justify-between z-10">
            <button 
                onClick={handleBack}
                className="w-12 h-12 bg-[#8B4513] hover:bg-[#A0522D] rounded-full flex items-center justify-center text-[#f3e5ab] border-2 border-[#eecaa0] active:scale-95 transition-transform shadow-md"
                aria-label="Go Back"
            >
                <ChevronLeft size={28} strokeWidth={3} />
            </button>
            
            <h1 className="flex-1 text-center font-display font-extrabold text-[#5c2e0b] text-2xl tracking-widest drop-shadow-sm uppercase">
                {t('settings')}
            </h1>
            
            <div className="w-12" /> {/* Spacer to balance header */}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10">
        <div className="max-w-md mx-auto w-full space-y-6 pt-6">
            
            {/* Audio Settings */}
            <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-4 uppercase tracking-wide opacity-80">{t('audioNotifications')}</h3>
                
                <div className="space-y-5">
                    {/* Background Music Toggle */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[#5c2e0b]">
                                <div className="w-8 h-8 rounded-full bg-[#e1bee7] flex items-center justify-center text-[#8e24aa]">
                                    <Music size={18} />
                                </div>
                                <span className="font-bold">{t('backgroundMusic')}</span>
                            </div>
                            <button 
                                onClick={toggleMusic}
                                className={`w-12 h-7 rounded-full relative transition-colors duration-200 border-2 ${musicEnabled ? 'bg-[#8bc34a] border-[#689f38]' : 'bg-gray-300 border-gray-400'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${musicEnabled ? 'left-5' : 'left-0.5'}`}></div>
                            </button>
                        </div>
                        
                        {/* Volume Slider - Only show when music is enabled */}
                        {musicEnabled && (
                            <div className="ml-11 pr-1">
                                <div className="flex items-center gap-3">
                                    <Volume2 size={14} className="text-[#8B4513]/50 shrink-0" />
                                    <input 
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={musicVolume * 100}
                                        onChange={(e) => setMusicVolume(parseInt(e.target.value) / 100)}
                                        className="flex-1 h-2 bg-[#eecaa0] rounded-full appearance-none cursor-pointer accent-[#8e24aa] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8e24aa] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
                                    />
                                    <span className="text-xs font-bold text-[#8B4513]/60 w-8 text-right">{Math.round(musicVolume * 100)}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sound Effects Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[#5c2e0b]">
                            <div className="w-8 h-8 rounded-full bg-[#ffe0b2] flex items-center justify-center text-[#f57c00]">
                                <Volume2 size={18} />
                            </div>
                            <span className="font-bold">{t('soundEffects')}</span>
                        </div>
                        <button 
                            onClick={toggleSfx}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-200 border-2 ${sfxEnabled ? 'bg-[#8bc34a] border-[#689f38]' : 'bg-gray-300 border-gray-400'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${sfxEnabled ? 'left-5' : 'left-0.5'}`}></div>
                        </button>
                    </div>

                    {/* Notifications - Coming Soon */}
                    <div className="flex items-center justify-between opacity-50 pointer-events-none grayscale">
                        <div className="flex items-center gap-3 text-[#5c2e0b]">
                            <div className="w-8 h-8 rounded-full bg-[#ffe0b2] flex items-center justify-center text-[#f57c00]">
                                <Bell size={18} />
                            </div>
                            <span className="font-bold">{t('notifications')}</span>
                        </div>
                        <button 
                            className="w-12 h-7 rounded-full relative transition-colors duration-200 border-2 bg-[#8bc34a] border-[#689f38]"
                        >
                            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm left-5"></div>
                        </button>
                    </div>
                </div>
            </section>

            {/* Language Settings */}
            <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-4 uppercase tracking-wide opacity-80">{t('language')}</h3>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                        className="w-full flex items-center justify-between bg-white/60 rounded-xl p-4 border border-[#eecaa0] hover:bg-white/80 transition-colors"
                    >
                        <div className="flex items-center gap-3 text-[#5c2e0b]">
                            <div className="w-8 h-8 rounded-full bg-[#bbdefb] flex items-center justify-center text-[#1976d2]">
                                <Globe size={18} />
                            </div>
                            <div className="text-left">
                                <span className="font-bold block">{t('appLanguage')}</span>
                                <span className="text-sm text-[#8B4513]/70">
                                    {supportedLanguages[currentLanguage]?.flag} {supportedLanguages[currentLanguage]?.nativeName || 'English'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isTranslating && (
                                <div className="w-4 h-4 border-2 border-[#8B4513] border-t-transparent rounded-full animate-spin"></div>
                            )}
                            <ChevronRight className={`w-5 h-5 text-[#8B4513]/50 transition-transform ${showLanguageSelector ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {/* Language Selector Dropdown */}
                    {showLanguageSelector && (
                        <div className="bg-white/80 rounded-xl border border-[#eecaa0] overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                                {Object.entries(supportedLanguages).map(([code, lang]) => (
                                    <button
                                        key={code}
                                        onClick={() => {
                                            setLanguage(code);
                                            setShowLanguageSelector(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#fff8e1] transition-colors border-b border-[#eecaa0]/30 last:border-b-0 ${
                                            currentLanguage === code ? 'bg-[#fff8e1]' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{lang.flag}</span>
                                            <div className="text-left">
                                                <div className={`font-medium text-[#5c2e0b] ${currentLanguage === code ? 'font-bold' : ''}`}>
                                                    {lang.nativeName}
                                                </div>
                                                <div className="text-xs text-[#8B4513]/60">{lang.name}</div>
                                            </div>
                                        </div>
                                        {currentLanguage === code && (
                                            <Check className="w-5 h-5 text-[#8bc34a]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-[#8B4513]/60 px-2">
                        Changes the language of the app interface and automatically translates book text.
                    </p>
                </div>
            </section>

            {/* Voice Library - Hidden */}
            {false && clonedVoices.length > 0 && (
              <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-4 uppercase tracking-wide opacity-80">Voice Library</h3>
                
                <div className="space-y-3">
                  {clonedVoices.map((voice) => (
                    <div
                      key={voice.voice_id}
                      className="bg-white/60 rounded-xl p-4 border border-[#eecaa0] flex items-center justify-between group hover:bg-white/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#ffb300] flex items-center justify-center border border-[#B8860B] shadow-sm shrink-0">
                          <Mic size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#5c2e0b] text-sm truncate">{voice.name}</div>
                          {cleanVoiceDescription(voice.description) && (
                            <div className="text-xs text-[#8B4513]/70 truncate">{cleanVoiceDescription(voice.description)}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteVoice(voice.voice_id)}
                        disabled={deletingVoiceId === voice.voice_id}
                        className="ml-3 w-10 h-10 rounded-full bg-red-100 hover:bg-red-200 border-2 border-red-300 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        title="Delete voice"
                      >
                        {deletingVoiceId === voice.voice_id ? (
                          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 size={16} className="text-red-600" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Voice Management - Only show unlocked voices */}
            <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-4 uppercase tracking-wide opacity-80">Your Voices</h3>
                <p className="text-[#5c2e0b] text-sm mb-4 opacity-70">Manage voices you've unlocked. Hide voices you don't want to see in the reader.</p>
                
                {loadingVoices ? (
                    <div className="text-center text-[#5c2e0b] py-4">Loading voices...</div>
                ) : unlockedVoices.length === 0 ? (
                    <div className="text-center text-[#5c2e0b] py-4">
                        <p className="mb-2">No voices unlocked yet</p>
                        <button
                            onClick={() => navigate('/profile', { state: { openShop: true, shopTab: 'voices' } })}
                            className="text-[#FFD700] font-bold underline"
                        >
                            Unlock voices in the Shop
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {unlockedVoices.map((voice) => {
                            const isHidden = isVoiceHidden(voice.voice_id);
                            return (
                                <div
                                    key={voice.voice_id}
                                    className="flex items-center gap-3 p-3 bg-white/50 rounded-lg border border-[#eecaa0]/50 hover:bg-white/80 transition-colors"
                                >
                                    {voice.characterImage ? (
                                        <img 
                                            src={voice.characterImage} 
                                            alt={voice.name}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-[#eecaa0]"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-[#eecaa0] flex items-center justify-center border-2 border-[#8B4513]/20">
                                            <Mic size={20} className="text-[#8B4513]" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="text-[#5c2e0b] font-bold text-sm">{voice.name}</div>
                                        {cleanVoiceDescription(voice.description) && (
                                            <div className="text-[#5c2e0b]/60 text-xs">{cleanVoiceDescription(voice.description)}</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            toggleVoiceVisibility(voice.voice_id);
                                            setUnlockedVoices([...unlockedVoices]); // Trigger re-render
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            isHidden
                                                ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                    >
                                        {isHidden ? 'Hidden' : 'Visible'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Account / Subscription */}
            <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-4 uppercase tracking-wide opacity-80">Membership</h3>
                
                {isSubscribed ? (
                    <div className="bg-[#fff3cd] border border-[#ffeeba] rounded-xl p-4 flex items-center justify-between mb-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#ffb300] rounded-full flex items-center justify-center border border-[#B8860B] shadow-md">
                                <Crown size={20} className="text-white" fill="white" />
                            </div>
                            <div>
                                <div className="font-extrabold text-[#856404] text-sm font-display">Premium Active</div>
                                <div className="text-xs text-[#856404]/70 font-bold">Manage in App Store</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                // Open subscription management
                                // iOS: Opens App Store subscriptions page
                                // Android: Opens Play Store subscriptions
                                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                const isAndroid = /Android/.test(navigator.userAgent);
                                
                                if (isIOS) {
                                    // iOS App Store subscription management
                                    window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
                                } else if (isAndroid) {
                                    // Google Play subscription management
                                    window.location.href = 'https://play.google.com/store/account/subscriptions';
                                } else {
                                    // Web fallback - open Apple subscriptions page
                                    window.open('https://apps.apple.com/account/subscriptions', '_blank');
                                }
                            }}
                            className="text-xs font-bold text-[#856404] bg-white/50 hover:bg-white px-3 py-1.5 rounded-lg border border-[#856404]/20 transition-colors active:scale-95"
                        >
                            Manage
                        </button>
                    </div>
                ) : (
                    <div className="bg-white/50 rounded-xl p-4 border border-white/60 mb-4 text-center">
                        <p className="text-[#5c2e0b] text-sm mb-3 font-semibold">Unlock the full library and exclusives!</p>
                        <WoodButton 
                            variant="gold" 
                            fullWidth 
                            onClick={() => navigate('/paywall')}
                            className="flex items-center justify-center gap-2 text-sm py-3"
                        >
                            <Crown size={18} />
                            <span>UPGRADE TO PREMIUM</span>
                        </WoodButton>
                    </div>
                )}
                
                {/* Restore Purchases Button with Status */}
                <button 
                    onClick={handleRestorePurchases}
                    disabled={isRestoring}
                    className="w-full text-left px-3 py-3 text-[#5c2e0b] font-bold text-sm bg-white/40 hover:bg-white/80 rounded-lg border border-transparent hover:border-[#eecaa0] transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="flex items-center gap-2">
                        {isRestoring && <RefreshCw size={16} className="animate-spin" />}
                        {!isRestoring && t('restorePurchases')}
                        {isRestoring && `${t('loading')}`}
                    </span>
                    <ChevronLeft size={16} className="rotate-180 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
                
                {/* Restore Result Message */}
                {restoreResult && (
                    <div className={`mt-2 p-3 rounded-lg flex items-start gap-2 text-sm ${
                        restoreResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                        restoreResult.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                        {restoreResult.type === 'success' && <CheckCircle size={18} className="shrink-0 mt-0.5" />}
                        {restoreResult.type === 'error' && <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                        {restoreResult.type === 'info' && <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                        <span>{restoreResult.message}</span>
                    </div>
                )}
            </section>

            {/* Legal & Support */}
            <section className="bg-[#fff8e1] rounded-2xl p-5 border-2 border-[#eecaa0] shadow-sm space-y-2">
                <h3 className="font-display font-bold text-[#8B4513] text-lg mb-2 uppercase tracking-wide opacity-80">{t('support')}</h3>
                
                <button 
                    onClick={() => {
                        setWebViewUrl('https://www.godlykids.com/privacy');
                        setWebViewTitle(t('privacyPolicy'));
                        setShowWebView(true);
                    }}
                    className="w-full text-left px-3 py-3 text-[#5c2e0b] font-bold text-sm bg-white/40 hover:bg-white/80 rounded-lg border border-transparent hover:border-[#eecaa0] transition-all flex items-center gap-3 group"
                >
                    <div className="w-6 h-6 rounded-full bg-[#d7ccc8] flex items-center justify-center text-[#5d4037] group-hover:bg-[#8d6e63] group-hover:text-white transition-colors">
                        <Shield size={12} />
                    </div>
                    <span>{t('privacyPolicy')}</span>
                </button>
                <button 
                    onClick={() => {
                        setWebViewUrl('https://www.godlykids.com/end-user-license-agreement');
                        setWebViewTitle(t('termsAndConditions'));
                        setShowWebView(true);
                    }}
                    className="w-full text-left px-3 py-3 text-[#5c2e0b] font-bold text-sm bg-white/40 hover:bg-white/80 rounded-lg border border-transparent hover:border-[#eecaa0] transition-all flex items-center gap-3 group"
                >
                    <div className="w-6 h-6 rounded-full bg-[#d7ccc8] flex items-center justify-center text-[#5d4037] group-hover:bg-[#8d6e63] group-hover:text-white transition-colors">
                        <FileText size={12} />
                    </div>
                    <span>{t('termsAndConditions')}</span>
                </button>
                <button className="w-full text-left px-3 py-3 text-[#5c2e0b] font-bold text-sm bg-white/40 hover:bg-white/80 rounded-lg border border-transparent hover:border-[#eecaa0] transition-all flex items-center gap-3 group">
                    <div className="w-6 h-6 rounded-full bg-[#d7ccc8] flex items-center justify-center text-[#5d4037] group-hover:bg-[#8d6e63] group-hover:text-white transition-colors">
                        <HelpCircle size={12} />
                    </div>
                    <span>{t('helpCenter')}</span>
                </button>
            </section>

            {/* Logout */}
            <button 
                onClick={() => {
                    // Clear all user data
                    localStorage.removeItem('godly_kids_data_v6');
                    localStorage.removeItem('godlykids_app_language');
                    localStorage.removeItem('godlykids_reader_language');
                    // Sign out from auth service
                    authService.signOut();
                    // Navigate to landing page
                    navigate('/', { replace: true });
                }}
                className="w-full bg-[#ffcdd2] hover:bg-[#ef9a9a] text-[#c62828] font-bold py-4 rounded-xl border-b-4 border-[#e57373] active:border-b-0 active:translate-y-1 shadow-sm flex items-center justify-center gap-2 transition-all"
            >
                <LogOut size={20} />
                <span>LOG OUT</span>
            </button>
            
            <div className="text-center text-[#8B4513]/40 text-[10px] font-bold font-mono pt-4 pb-8">
                Version 1.0.3 (Build 52) • ID: 8F29A
            </div>
        </div>
      </div>

      {/* WebView Modal for Privacy/Terms */}
      <WebViewModal
        isOpen={showWebView}
        onClose={() => setShowWebView(false)}
        url={webViewUrl}
        title={webViewTitle}
      />
    </div>
  );
};

export default SettingsPage;