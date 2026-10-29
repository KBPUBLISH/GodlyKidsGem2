import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, SlidersHorizontal, Volume2, Bell, Shield, FileText, LogOut, Crown, HelpCircle, Mic, Trash2, RefreshCw, CheckCircle, AlertCircle, Globe, Check, ChevronRight, UserPlus, LogIn, Paintbrush, Music } from 'lucide-react';
import './ProfileSelectionPage.css';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import { ApiService } from '../services/apiService';
import { getHiddenVoices, isVoiceHidden, toggleVoiceVisibility } from '../services/voiceManagementService';
import { cleanVoiceDescription } from '../utils/voiceUtils';
import { authService } from '../services/authService';
import { clearLocalStoragePreservingIslandProgress } from '../services/islandStoryProgressService';
import { getApiBaseUrl } from '../services/apiService';
import { applyDevResetPremium } from '../utils/devPremium';
import WebViewModal from '../components/features/WebViewModal';
import ParentGateModal from '../components/features/ParentGateModal';
import DespiaService from '../services/despiaService';
const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSubscribed, isVoiceUnlocked, setIsSubscribed, resetUser } = useUser();
  const { sfxEnabled, toggleSfx, musicEnabled, toggleMusic, musicVolume, setMusicVolume, playBack } = useAudio();
  const { currentLanguage, setLanguage, supportedLanguages, isTranslating, t } = useLanguage();
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [unlockedVoices, setUnlockedVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('godlykids_notifications') !== 'false';
  });
  
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
  
  // Parent gate for Help Center
  const [showHelpCenterGate, setShowHelpCenterGate] = useState(false);
  const [showDeleteAccountGate, setShowDeleteAccountGate] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  
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

  const runDeleteAccountAfterParentGate = async () => {
    const token = authService.getToken();
    if (!token) {
      alert('Please sign in again, then try deleting your account.');
      return;
    }
    setDeleteAccountBusy(true);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        alert(json.message || 'Failed to delete account');
        return;
      }
      authService.signOut();
      try {
        localStorage.clear();
      } catch {
        Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      }
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      window.location.replace(
        `${window.location.origin}${window.location.pathname}?account-deleted=${Date.now()}`
      );
    } catch (e) {
      console.error(e);
      alert('Failed to delete account');
    } finally {
      setDeleteAccountBusy(false);
    }
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

  // Handle restore purchases - checks RevenueCat/backend first, then migration API for old app
  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreResult(null);

    try {
      // Get user email from auth service
      const user = authService.getUser();
      console.log('🔄 Restore: Current user from auth:', user);
      
      if (!user?.email) {
        setRestoreResult({
          type: 'error',
          message: 'Please sign in first with the email you used in the old app.',
        });
        return;
      }

      const userEmail = user.email.toLowerCase().trim();
      console.log('🔄 Restore: Checking for email:', userEmail);
      const baseUrl = getApiBaseUrl();
      
      // FIRST: Check RevenueCat/backend subscription status
      console.log('🔄 Restore: Checking backend purchase-status...');
      try {
        const purchaseStatusResponse = await fetch(`${baseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userEmail)}`);
        if (purchaseStatusResponse.ok) {
          const purchaseData = await purchaseStatusResponse.json();
          console.log('🔄 Restore: Purchase status response:', purchaseData);
          
          if (purchaseData.isPremium) {
            // Found active subscription in backend!
            localStorage.setItem('godlykids_premium', 'true');
            setIsSubscribed(true);
            setRestoreResult({
              type: 'success',
              message: 'Your subscription has been restored! Welcome back! 🎉',
            });
            return;
          }
        }
      } catch (purchaseError) {
        console.log('⚠️ Purchase status check failed:', purchaseError);
      }
      
      // SECOND: Try migration API for old Godly Kids 1.0 users
      console.log('🔄 Restore: Checking migration API for old app subscription...');
      const response = await fetch(`${baseUrl}/api/migration/restore-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();
      console.log('🔄 Restore: Migration API response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to restore purchases');
      }

      if (data.subscriptionRestored) {
        // Successfully restored subscription from old app
        localStorage.setItem('godlykids_premium', 'true');
        setIsSubscribed(true);
        setRestoreResult({
          type: 'success',
          message: 'Your subscription has been restored! Welcome back! 🎉',
        });
      } else if (data.found && data.subscriptionFound && !data.subscriptionRestored) {
        // Subscription found in old app but user needs to create account in new app first
        setRestoreResult({
          type: 'info',
          message: data.message || 'Subscription found! Please make sure you\'re signed in with the same email.',
        });
      } else if (data.found && !data.subscriptionRestored) {
        // Account found but subscription expired or not active
        setRestoreResult({
          type: 'info',
          message: data.message || 'Account found but subscription has expired.',
        });
      } else {
        // No account found
        setRestoreResult({
          type: 'info',
          message: data.message || 'No previous subscription found with this email.',
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
    <main className="explorer-page">
      <div className="explorer-shell explorer-settings">
        <header className="explorer-topbar">
          <button className="explorer-icon-button" aria-label="Go Back" onClick={handleBack}><ChevronLeft size={24}/></button>
          <span><SlidersHorizontal size={20}/>{t('settings')}</span>
          <span className="explorer-topbar-spacer" aria-hidden="true" />
        </header>
        <div className="w-full space-y-4">
            
            {/* Audio Settings */}
            <section className="explorer-section">
                <h3 className="explorer-section-title mb-4">{t('audioNotifications')}</h3>
                
                <div className="space-y-5">
                    {/* Sound Effects Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[#244750]">
                            <div className="w-8 h-8 rounded-full bg-[#fff0cf] flex items-center justify-center text-[#c7811a]">
                                <Volume2 size={18} />
                            </div>
                            <span className="font-bold">{t('soundEffects')}</span>
                        </div>
                        <button 
                            onClick={toggleSfx}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-200 border-2 ${sfxEnabled ? 'bg-[#287b68] border-[#1f6354]' : 'bg-[#d5dcd6] border-[#c3ccc5]'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${sfxEnabled ? 'left-5' : 'left-0.5'}`}></div>
                        </button>
                    </div>

                    {/* App background music (API: Music target app-background; plays on Explore when enabled) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[#244750] flex-1 min-w-0 pr-2">
                                <div className="w-8 h-8 rounded-full bg-[#e9e3f6] flex items-center justify-center text-[#6a4fb3] shrink-0">
                                    <Music size={18} />
                                </div>
                                <div className="min-w-0">
                                    <span className="font-bold block">{t('backgroundMusic')}</span>
                                    <span className="text-xs text-[#5e7a7f] leading-tight block">
                                        Soft loop on Explore. Off during books, playlists, and lessons.
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    playBack();
                                    toggleMusic();
                                }}
                                className={`w-12 h-7 shrink-0 rounded-full relative transition-colors duration-200 border-2 ${musicEnabled ? 'bg-[#287b68] border-[#1f6354]' : 'bg-[#d5dcd6] border-[#c3ccc5]'}`}
                                aria-pressed={musicEnabled}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${musicEnabled ? 'left-5' : 'left-0.5'}`}></div>
                            </button>
                        </div>
                        <div className={`flex items-center gap-3 pl-11 pr-2 ${musicEnabled ? '' : 'opacity-50'}`}>
                            <span className="text-xs font-bold text-[#5e7a7f] w-14 shrink-0">Volume</span>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(musicVolume * 100)}
                                disabled={!musicEnabled}
                                onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                                className="flex-1 h-2 bg-[#dfe6e0] rounded-lg appearance-none cursor-pointer accent-[#287b68] disabled:cursor-not-allowed"
                                aria-label="Background music volume"
                            />
                            <span className="text-xs font-bold text-[#5e7a7f] w-10 text-right tabular-nums">
                                {Math.round(musicVolume * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Notifications Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[#244750]">
                            <div className="w-8 h-8 rounded-full bg-[#fff0cf] flex items-center justify-center text-[#c7811a]">
                                <Bell size={18} />
                            </div>
                            <span className="font-bold">{t('notifications')}</span>
                        </div>
                        <button 
                            onClick={() => {
                                const newValue = !notificationsEnabled;
                                setNotificationsEnabled(newValue);
                                localStorage.setItem('godlykids_notifications', String(newValue));
                                
                                // Try to communicate with native app for push notification permissions
                                if (newValue) {
                                    // Request notification permission via DeSpia bridge if available
                                    if ((window as any).webkit?.messageHandlers?.despia) {
                                        try {
                                            (window as any).webkit.messageHandlers.despia.postMessage({
                                                action: 'requestNotificationPermission'
                                            });
                                        } catch (e) {
                                            console.log('📱 DeSpia notification request not available');
                                        }
                                    }
                                    // Also try standard web notification API as fallback
                                    if ('Notification' in window && Notification.permission === 'default') {
                                        Notification.requestPermission();
                                    }
                                }
                            }}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-200 border-2 ${notificationsEnabled ? 'bg-[#287b68] border-[#1f6354]' : 'bg-[#d5dcd6] border-[#c3ccc5]'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${notificationsEnabled ? 'left-5' : 'left-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </section>

            {/* Language Settings */}
            {true && <section className="explorer-section">
                <h3 className="explorer-section-title mb-4">{t('language')}</h3>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                        className="w-full flex items-center justify-between bg-white rounded-xl p-4 border border-[#e4e6d9] hover:bg-white/80 transition-colors"
                    >
                        <div className="flex items-center gap-3 text-[#244750]">
                            <div className="w-8 h-8 rounded-full bg-[#dcefee] flex items-center justify-center text-[#267482]">
                                <Globe size={18} />
                            </div>
                            <div className="text-left">
                                <span className="font-bold block">{t('appLanguage')}</span>
                                <span className="text-sm text-[#5e7a7f]">
                                    {supportedLanguages[currentLanguage]?.flag} {supportedLanguages[currentLanguage]?.nativeName || 'English'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isTranslating && (
                                <div className="w-4 h-4 border-2 border-[#287b68] border-t-transparent rounded-full animate-spin"></div>
                            )}
                            <ChevronRight className={`w-5 h-5 text-[#8aa0a4] transition-transform ${showLanguageSelector ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {/* Language Selector Dropdown */}
                    {showLanguageSelector && (
                        <div className="bg-white rounded-xl border border-[#e4e6d9] overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                                {Object.entries(supportedLanguages).filter(([code]) => ['en','tl','pt','fr','de','it','ko','es','pl'].includes(code)).map(([code, lang]) => (
                                    <button
                                        key={code}
                                        onClick={() => {
                                            setLanguage(code);
                                            setShowLanguageSelector(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#eef5ef] transition-colors border-b border-[#e4e6d9] last:border-b-0 ${
                                            currentLanguage === code ? 'bg-[#e8f5ee]' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{lang.flag}</span>
                                            <div className="text-left">
                                                <div className={`font-medium text-[#244750] ${currentLanguage === code ? 'font-bold' : ''}`}>
                                                    {lang.nativeName}
                                                </div>
                                                <div className="text-xs text-[#6b8489]">{lang.name}</div>
                                            </div>
                                        </div>
                                        {currentLanguage === code && (
                                            <Check className="w-5 h-5 text-[#287b68]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-[#6b8489] px-2">
                        Changes the language of the app interface and automatically translates book text.
                    </p>
                </div>
            </section>}

            {/* Voice Library - Hidden */}
            {false && clonedVoices.length > 0 && (
              <section className="explorer-section">
                <h3 className="explorer-section-title mb-4">Voice Library</h3>
                
                <div className="space-y-3">
                  {clonedVoices.map((voice) => (
                    <div
                      key={voice.voice_id}
                      className="bg-white rounded-xl p-4 border border-[#e4e6d9] flex items-center justify-between group hover:bg-white/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#ffb300] flex items-center justify-center border border-[#B8860B] shadow-sm shrink-0">
                          <Mic size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#244750] text-sm truncate">{voice.name}</div>
                          {cleanVoiceDescription(voice.description) && (
                            <div className="text-xs text-[#5e7a7f] truncate">{cleanVoiceDescription(voice.description)}</div>
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
            <section className="explorer-section">
                <h3 className="explorer-section-title mb-4">Your Voices</h3>
                <p className="text-[#244750] text-sm mb-4 opacity-70">Manage voices you've unlocked. Hide voices you don't want to see in the reader.</p>
                
                {loadingVoices ? (
                    <div className="text-center text-[#244750] py-4">Loading voices...</div>
                ) : unlockedVoices.length === 0 ? (
                    <div className="text-center text-[#244750] py-4">
                        <p className="mb-2">No voices unlocked yet</p>
                        <button
                            onClick={() => navigate('/profile', { state: { openShop: true, shopTab: 'voices' } })}
                            className="text-[#287b68] font-bold underline"
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
                                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#e4e6d9] hover:bg-white/80 transition-colors"
                                >
                                    {voice.characterImage ? (
                                        <img 
                                            src={voice.characterImage} 
                                            alt={voice.name}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-[#e4e6d9]"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-[#e7f0e7] flex items-center justify-center border-2 border-[#d2e0d2]">
                                            <Mic size={20} className="text-[#3f6a70]" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="text-[#244750] font-bold text-sm">{voice.name}</div>
                                        {cleanVoiceDescription(voice.description) && (
                                            <div className="text-[#244750]/60 text-xs">{cleanVoiceDescription(voice.description)}</div>
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

            {/* Account Info - Check multiple sources for email */}
            {(() => {
                const userEmail = authService.getUser()?.email || localStorage.getItem('godlykids_user_email');
                return userEmail ? (
                    <section className="explorer-section">
                        <h3 className="explorer-section-title mb-3">Account</h3>
                        <div className="bg-white rounded-xl p-4 border border-[#e4e6d9]">
                            <p className="text-[#244750] text-sm font-semibold">Signed in as:</p>
                            <p className="text-[#3f6a70] text-base font-bold truncate">{userEmail}</p>
                        </div>
                        <button
                            type="button"
                            disabled={deleteAccountBusy}
                            onClick={() => {
                                if (
                                    !window.confirm(
                                        'Permanently delete your Godly Kids account and server-side profile data? This cannot be undone. If you have a subscription, cancel it in the App Store or Play Store — we do not manage billing here.'
                                    )
                                ) {
                                    return;
                                }
                                setShowDeleteAccountGate(true);
                            }}
                            className="mt-4 w-full text-center text-sm font-semibold text-[#a4382b] underline underline-offset-2 disabled:opacity-50"
                        >
                            {deleteAccountBusy ? 'Deleting…' : 'Delete my account'}
                        </button>
                    </section>
                ) : (
                    /* Sign In / Sign Up Section - Show when NOT signed in */
                    <section className="explorer-section">
                        <h3 className="explorer-section-title mb-3">Account</h3>
                        <p className="text-[#244750] text-sm mb-4 opacity-70">
                            Optional. An account lets your family use one membership on several devices and restores purchases on a new phone or tablet.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/signin')}
                                className="explorer-action explorer-teal w-full"
                            >
                                <LogIn size={20} />
                                <span>Sign in</span>
                            </button>
                            <button
                                onClick={() => navigate('/onboarding')}
                                className="explorer-action explorer-shop w-full"
                            >
                                <UserPlus size={20} />
                                <span>Create account</span>
                            </button>
                        </div>
                    </section>
                );
            })()}

            {/* Subscription */}
            <section className="explorer-section">
                <h3 className="explorer-section-title mb-4">Membership</h3>
                
                {isSubscribed ? (
                    <div className="bg-[#fff4d6] border border-[#f0d9a0] rounded-xl p-4 flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#ffb300] rounded-full flex items-center justify-center border border-[#B8860B] shadow-md">
                                <Crown size={20} className="text-white" fill="white" />
                            </div>
                            <div>
                                <div className="font-extrabold text-[#856404] text-sm font-display">Premium Active</div>
                                <div className="text-xs text-[#856404]/70 font-bold">Manage in {navigator.userAgent.toLowerCase().includes('android') ? 'Play Store' : 'App Store'}</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                // Open subscription management
                                // iOS: Opens App Store subscriptions page
                                // Android: Opens Play Store subscriptions
                                // Prefer DespiaService for native app (handles WebView UA correctly)
                                const ua = navigator.userAgent.toLowerCase();
                                const isIOS = DespiaService.isIOS || /ipad|iphone|ipod/.test(ua);
                                const isAndroid = DespiaService.isAndroid || ua.includes('android');
                                
                                if (isAndroid) {
                                    // Android: Open native Play Store subscription management
                                    window.open('https://play.google.com/store/account/subscriptions', '_blank');
                                } else if (isIOS) {
                                    // iOS: Open native App Store subscription management (window.open hands off to system)
                                    window.open('itms-apps://apps.apple.com/account/subscriptions', '_blank');
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
                    <div className="bg-white rounded-xl p-4 border border-[#e4e6d9] mb-4 text-center">
                        <p className="text-[#244750] text-sm mb-3 font-semibold">Unlock the full library and exclusives!</p>
                        <button
                            type="button"
                            onClick={() => navigate('/onboarding/welcome', { state: { returnTo: '/settings' } })}
                            className="explorer-action explorer-shop w-full"
                        >
                            <Crown size={18} />
                            <span>Upgrade to Premium</span>
                        </button>
                    </div>
                )}
                
                {/* Restore Purchases Button with Status */}
                <div className="space-y-1">
                    <button 
                        onClick={handleRestorePurchases}
                        disabled={isRestoring}
                        className="w-full text-left px-3 py-3 text-[#244750] font-bold text-sm bg-white hover:bg-[#f2f8f3] rounded-xl border border-[#e4e6d9] hover:border-[#a4c7bc] transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="flex items-center gap-2">
                            {isRestoring && <RefreshCw size={16} className="animate-spin" />}
                            {!isRestoring && t('restorePurchases')}
                            {isRestoring && `${t('loading')}`}
                        </span>
                        <ChevronLeft size={16} className="rotate-180 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                    {/* Show current email if signed in */}
                    {authService.getUser()?.email && (
                        <p className="text-xs text-[#6b8489] px-3">
                            Using: {authService.getUser()?.email}
                        </p>
                    )}
                </div>
                
                {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                    <button
                        type="button"
                        onClick={() => {
                            applyDevResetPremium();
                            window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: false } }));
                            window.location.reload();
                        }}
                        className="w-full text-left px-3 py-3 text-[#244750] font-bold text-sm bg-amber-100/80 hover:bg-amber-100 rounded-lg border border-amber-300/60 mt-2"
                    >
                        Turn off premium (testing)
                    </button>
                )}
                
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
            <section className="explorer-section space-y-2">
                <h3 className="explorer-section-title mb-2">{t('support')}</h3>
                
                <button 
                    onClick={() => {
                        setWebViewUrl('https://www.godlykids.com/privacy');
                        setWebViewTitle(t('privacyPolicy'));
                        setShowWebView(true);
                    }}
                    className="w-full text-left px-3 py-3 text-[#244750] font-bold text-sm bg-white hover:bg-[#f2f8f3] rounded-xl border border-[#e4e6d9] hover:border-[#a4c7bc] transition-all flex items-center gap-3 group"
                >
                    <div className="w-6 h-6 rounded-full bg-[#e7f0e7] flex items-center justify-center text-[#34786b] group-hover:bg-[#287b68] group-hover:text-white transition-colors">
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
                    className="w-full text-left px-3 py-3 text-[#244750] font-bold text-sm bg-white hover:bg-[#f2f8f3] rounded-xl border border-[#e4e6d9] hover:border-[#a4c7bc] transition-all flex items-center gap-3 group"
                >
                    <div className="w-6 h-6 rounded-full bg-[#e7f0e7] flex items-center justify-center text-[#34786b] group-hover:bg-[#287b68] group-hover:text-white transition-colors">
                        <FileText size={12} />
                    </div>
                    <span>{t('termsAndConditions')}</span>
                </button>
                <button 
                    onClick={() => setShowHelpCenterGate(true)}
                    className="w-full text-left px-3 py-3 text-[#244750] font-bold text-sm bg-white hover:bg-[#f2f8f3] rounded-xl border border-[#e4e6d9] hover:border-[#a4c7bc] transition-all flex items-center gap-3 group"
                >
                    <div className="w-6 h-6 rounded-full bg-[#e7f0e7] flex items-center justify-center text-[#34786b] group-hover:bg-[#287b68] group-hover:text-white transition-colors">
                        <HelpCircle size={12} />
                    </div>
                    <span>{t('helpCenter')}</span>
                </button>
            </section>

            {/* Logout - Only show when signed in */}
            {(authService.getUser()?.email || localStorage.getItem('godlykids_user_email')) && (
                <button 
                    onClick={() => {
                        console.log('🚪 LOGOUT: Starting clean logout...');
                        
                        // STEP 1: Sign out from auth service FIRST (clears tokens)
                        authService.signOut();
                        
                        // STEP 2: Clear session keys but keep Bible Map story completions
                        try {
                          clearLocalStoragePreservingIslandProgress();
                        } catch (e) {
                          const allKeys = Object.keys(localStorage);
                          allKeys.forEach(k => localStorage.removeItem(k));
                        }
                        
                        // STEP 3: Clear sessionStorage
                        try {
                          sessionStorage.clear();
                        } catch (e) {
                          console.log('sessionStorage clear failed');
                        }
                        
                        // STEP 4: DON'T call resetUser() - it sets default values that cause ghost state
                        // The page reload will handle fresh state
                        
                        // STEP 5: Force hard navigation with cache bust
                        // Use replace to prevent back button from returning here
                        const logoutUrl = window.location.origin + window.location.pathname + '?logout=' + Date.now();
                        console.log('🚪 LOGOUT: Redirecting to:', logoutUrl);
                        
                        // Force immediate redirect
                        window.location.replace(logoutUrl);
                    }}
                    className="explorer-action explorer-danger w-full"
                >
                    <LogOut size={20} />
                    <span>Log out</span>
                </button>
            )}
            
            <div className="text-center text-white/70 text-[11px] font-bold font-mono pt-2 pb-6 drop-shadow">
                Version 1.0.3 (Build 52) • ID: 8F29A
            </div>
        </div>
      </div>

      {/* WebView Modal for Privacy/Terms - Hide external link for legal pages */}
      <WebViewModal
        isOpen={showWebView}
        onClose={() => setShowWebView(false)}
        url={webViewUrl}
        title={webViewTitle}
        hideExternalLink={true}
      />
      
      {/* Parent Gate Modal for Help Center */}
      <ParentGateModal
        isOpen={showHelpCenterGate}
        onClose={() => setShowHelpCenterGate(false)}
        onSuccess={() => {
          // Open godlykids.com in a new tab
          window.open('https://www.godlykids.com', '_blank');
        }}
      />

      <ParentGateModal
        isOpen={showDeleteAccountGate}
        onClose={() => !deleteAccountBusy && setShowDeleteAccountGate(false)}
        onSuccess={() => {
          void runDeleteAccountAfterParentGate();
        }}
      />
    </main>
  );
};

export default SettingsPage;