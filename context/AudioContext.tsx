
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

interface AudioContextType {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    toggleMusic: () => void;
    toggleSfx: () => void;
    setMusicVolume: (volume: number) => void;
    playClick: () => void;
    playBack: () => void;
    playSuccess: () => void;
    playTab: () => void;
    setGameMode: (active: boolean, type?: 'default' | 'workout') => void;
    setMusicPaused: (paused: boolean) => void;
}

const AudioContext = createContext<AudioContextType>({
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.5,
    toggleMusic: () => { },
    toggleSfx: () => { },
    setMusicVolume: () => { },
    playClick: () => { },
    playBack: () => { },
    playSuccess: () => { },
    playTab: () => { },
    setGameMode: () => { },
    setMusicPaused: () => { },
});

export const useAudio = () => useContext(AudioContext);

// Ambient Ocean Sound (Main App) - "Seaside Adventure" from Cloudinary
const BG_MUSIC_URL = "https://res.cloudinary.com/dxh8fuq7b/video/upload/v1763747567/Seaside_Adventure_2025-11-21T174503_i3p43n.mp3";

// Upbeat Game Music (Daily Verse, Challenge) - "Happy Pop"
const GAME_MUSIC_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";

// Energetic Workout Music (Strength Game) - "Jump and Spin" from Cloudinary
const WORKOUT_MUSIC_URL = "https://res.cloudinary.com/dxh8fuq7b/video/upload/v1763747567/Jump_and_Spin_pczce5.mp3";

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Load music volume from localStorage or default to 0.5 (half)
    const [musicVolume, setMusicVolumeState] = useState<number>(() => {
        const saved = localStorage.getItem('godly_kids_music_volume');
        return saved ? parseFloat(saved) : 0.5;
    });
    const [musicEnabled, setMusicEnabled] = useState(true);
    const [sfxEnabled, setSfxEnabled] = useState(true);
    const [musicMode, setMusicMode] = useState<'bg' | 'game' | 'workout'>('bg');
    const [musicForcePaused, setMusicForcePaused] = useState(false);

    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const gameAudioRef = useRef<HTMLAudioElement | null>(null);
    const workoutAudioRef = useRef<HTMLAudioElement | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context lazily
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    // --- SOUND GENERATORS (Synthesizers) ---

    const playTone = useCallback((freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    }, [sfxEnabled, getAudioContext]);

    const playClick = useCallback(() => {
        playTone(300, 'sine', 0.1, 0.15);
        playTone(400, 'triangle', 0.05, 0.05);
    }, [playTone]);

    const playBack = useCallback(() => {
        playTone(200, 'sine', 0.15, 0.1);
    }, [playTone]);

    const playTab = useCallback(() => {
        playTone(600, 'sine', 0.05, 0.05);
    }, [playTone]);

    const playSuccess = useCallback(() => {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.3);
        });
    }, [sfxEnabled, getAudioContext]);

    const setGameMode = useCallback((active: boolean, type: 'default' | 'workout' = 'default') => {
        if (!active) {
            setMusicMode('bg');
            // If explicitly stopping (e.g., for prayer), pause all music immediately
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (gameAudioRef.current) gameAudioRef.current.pause();
            if (workoutAudioRef.current) workoutAudioRef.current.pause();
        } else {
            setMusicMode(type === 'workout' ? 'workout' : 'game');
        }
    }, []);


    // --- BACKGROUND MUSIC LOGIC ---
    useEffect(() => {
        // Initialize audio elements with error handling
        if (!bgAudioRef.current) {
            bgAudioRef.current = new Audio(BG_MUSIC_URL);
            bgAudioRef.current.loop = true;
            bgAudioRef.current.volume = 0;
            bgAudioRef.current.preload = 'auto';
            bgAudioRef.current.addEventListener('error', (e) => {
                console.error('❌ BG Music load error:', e, BG_MUSIC_URL);
            });
            bgAudioRef.current.addEventListener('canplaythrough', () => {
                console.log('✅ BG Music loaded');
            });
        }

        if (!gameAudioRef.current) {
            gameAudioRef.current = new Audio(GAME_MUSIC_URL);
            gameAudioRef.current.loop = true;
            gameAudioRef.current.volume = 0;
            gameAudioRef.current.preload = 'auto';
            gameAudioRef.current.addEventListener('error', (e) => {
                console.error('❌ Game Music load error:', e, GAME_MUSIC_URL);
            });
            gameAudioRef.current.addEventListener('canplaythrough', () => {
                console.log('✅ Game Music loaded');
            });
        }

        if (!workoutAudioRef.current) {
            workoutAudioRef.current = new Audio(WORKOUT_MUSIC_URL);
            workoutAudioRef.current.loop = true;
            workoutAudioRef.current.volume = 0;
            workoutAudioRef.current.preload = 'auto';
            workoutAudioRef.current.addEventListener('error', (e) => {
                console.error('❌ Workout Music load error:', e, WORKOUT_MUSIC_URL);
            });
            workoutAudioRef.current.addEventListener('canplaythrough', () => {
                console.log('✅ Workout Music loaded');
            });
        }

        const bg = bgAudioRef.current;
        const game = gameAudioRef.current;
        const workout = workoutAudioRef.current;

        const fadeIntervals: number[] = [];

        const fadeTo = (audio: HTMLAudioElement, targetVol: number) => {
            if (!musicEnabled || musicForcePaused) {
                audio.pause();
                return;
            }
            // Check if audio is ready to play
            const isReady = audio.readyState >= 2; // HAVE_CURRENT_DATA or higher

            const tryPlay = async () => {
                // Check if audio has a valid source before trying to play
                if (audio.networkState === 3) { // NETWORK_NO_SOURCE
                    console.error('❌ Audio has no supported sources:', audio.src);
                    return;
                }

                // Wait for audio to be ready if not already
                if (!isReady) {
                    const waitForReady = () => {
                        return new Promise<void>((resolve) => {
                            if (audio.readyState >= 2) {
                                resolve();
                            } else {
                                const onCanPlay = () => {
                                    audio.removeEventListener('canplay', onCanPlay);
                                    resolve();
                                };
                                const onError = () => {
                                    audio.removeEventListener('error', onError);
                                    console.error('❌ Audio load error for:', audio.src);
                                    resolve(); // Resolve anyway to not block
                                };
                                audio.addEventListener('canplay', onCanPlay);
                                audio.addEventListener('error', onError);
                                // Timeout after 5 seconds
                                setTimeout(() => {
                                    audio.removeEventListener('canplay', onCanPlay);
                                    audio.removeEventListener('error', onError);
                                    resolve();
                                }, 5000);
                            }
                        });
                    };
                    await waitForReady();
                }

                // Final check before playing
                if (audio.networkState === 3 || audio.readyState === 0) {
                    console.error('❌ Audio not ready to play:', {
                        networkState: audio.networkState,
                        readyState: audio.readyState,
                        src: audio.src
                    });
                    return;
                }

                try {
                    if (targetVol > 0 && audio.paused) {
                        await audio.play();
                        console.log('✅ Music started:', audio.src.substring(0, 50) + '...');
                    }
                } catch (error) {
                    console.warn('⚠️ Music play failed, will retry on user interaction:', error);
                    // Store which audio needs to play
                    audio.dataset.needsPlay = 'true';
                }
            };

            tryPlay();

            const step = 0.05;
            const i = window.setInterval(() => {
                if (Math.abs(audio.volume - targetVol) < step) {
                    audio.volume = targetVol;
                    if (targetVol === 0) audio.pause();
                    clearInterval(i);
                    const index = fadeIntervals.indexOf(i);
                    if (index > -1) fadeIntervals.splice(index, 1);
                } else if (audio.volume < targetVol) {
                    audio.volume = Math.min(1, audio.volume + step);
                } else {
                    audio.volume = Math.max(0, audio.volume - step);
                }
            }, 100);
            fadeIntervals.push(i);
        };

        if (musicEnabled) {
            if (musicMode === 'bg') {
                fadeTo(bg, 0.25 * musicVolume);
                fadeTo(game, 0);
                fadeTo(workout, 0);
            } else if (musicMode === 'game') {
                fadeTo(bg, 0);
                fadeTo(game, 0.3 * musicVolume);
                fadeTo(workout, 0);
            } else if (musicMode === 'workout') {
                fadeTo(bg, 0);
                fadeTo(game, 0);
                fadeTo(workout, 0.4 * musicVolume); // Apply volume multiplier
            }
        } else {
            bg.pause();
            game.pause();
            workout.pause();
        }

        // Interaction unlock - retry playing audio that failed
        // BUT: If musicForcePaused is true, we NEVER add these listeners AND we block all music
        const unlockAudio = async (e?: Event) => {
            // TRIPLE CHECK: If musicForcePaused is true, immediately stop and return
            // This should never be called when musicForcePaused is true, but just in case:
            if (musicForcePaused) {
                bg.pause();
                game.pause();
                workout.pause();
                bg.currentTime = 0;
                game.currentTime = 0;
                workout.currentTime = 0;
                // Prevent any further attempts
                e?.stopPropagation();
                e?.preventDefault();
                return;
            }

            if (musicEnabled) {
                // Try to play the active music mode
                if (musicMode === 'bg' && bg.paused) {
                    try {
                        await bg.play();
                        console.log('✅ BG Music started via user interaction');
                    } catch (e) {
                        console.warn('Failed to play bg music:', e);
                    }
                }
                if (musicMode === 'game' && game.paused) {
                    try {
                        await game.play();
                        console.log('✅ Game Music started via user interaction');
                    } catch (e) {
                        console.warn('Failed to play game music:', e);
                    }
                }
                if (musicMode === 'workout' && workout.paused) {
                    try {
                        await workout.play();
                        console.log('✅ Workout Music started via user interaction');
                    } catch (e) {
                        console.warn('Failed to play workout music:', e);
                    }
                }
            }
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };

        // CRITICAL: When musicForcePaused is true, we:
        // 1. Force stop all music immediately
        // 2. DO NOT add any event listeners
        // 3. Add a blocking listener that prevents music from playing
        if (musicForcePaused) {
            // Force stop all music immediately
            bg.pause();
            game.pause();
            workout.pause();
            // bg.currentTime = 0;
            // game.currentTime = 0;
            // workout.currentTime = 0;

            // Add a BLOCKING listener that prevents music from playing on ANY interaction
            const blockMusic = (e: Event) => {
                bg.pause();
                game.pause();
                workout.pause();
                // bg.currentTime = 0;
                // game.currentTime = 0;
                // workout.currentTime = 0;
            };

            // Use capture phase to intercept events BEFORE anything else
            window.addEventListener('click', blockMusic, { capture: true });
            window.addEventListener('touchstart', blockMusic, { capture: true });

            return () => {
                // Cleanup intervals
                fadeIntervals.forEach(interval => clearInterval(interval));
                // Remove blocking listeners
                window.removeEventListener('click', blockMusic, { capture: true });
                window.removeEventListener('touchstart', blockMusic, { capture: true });
            };
        }

        // Only add unlock listeners if music is NOT force paused
        let cleanup: (() => void) | null = null;
        if (!musicForcePaused) {
            window.addEventListener('click', unlockAudio, { capture: false });
            window.addEventListener('touchstart', unlockAudio, { capture: false });
            cleanup = () => {
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio);
            };
        }

        return () => {
            // Cleanup intervals
            fadeIntervals.forEach(interval => clearInterval(interval));
            // Remove listeners if they were added
            if (cleanup) {
                cleanup();
            }
        };
    }, [musicEnabled, musicMode, musicVolume, musicForcePaused]);

    const toggleMusic = () => setMusicEnabled(prev => !prev);
    const toggleSfx = () => setSfxEnabled(prev => !prev);

    const setMusicVolume = useCallback((volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        setMusicVolumeState(clampedVolume);
        localStorage.setItem('godly_kids_music_volume', clampedVolume.toString());
    }, []);

    const setMusicPaused = useCallback((paused: boolean) => {
        console.log('🎵 setMusicPaused called:', paused);
        setMusicForcePaused(paused);
        if (paused) {
            // Immediately pause all music and ensure it stays paused
            if (bgAudioRef.current) {
                bgAudioRef.current.pause();
                // Do NOT reset to beginning so it can resume later
                // bgAudioRef.current.currentTime = 0; 
                // Remove any event listeners that might try to resume
                bgAudioRef.current.onplay = null;
            }
            if (gameAudioRef.current) {
                gameAudioRef.current.pause();
                // gameAudioRef.current.currentTime = 0;
                gameAudioRef.current.onplay = null;
            }
            if (workoutAudioRef.current) {
                workoutAudioRef.current.pause();
                // workoutAudioRef.current.currentTime = 0;
                workoutAudioRef.current.onplay = null;
            }
            console.log('🎵 All music paused and reset - listeners removed');
        }
    }, []);

    return (
        <AudioContext.Provider value={{
            musicEnabled,
            sfxEnabled,
            musicVolume,
            toggleMusic,
            toggleSfx,
            setMusicVolume,
            playClick,
            playBack,
            playSuccess,
            playTab,
            setGameMode,
            setMusicPaused
        }}>
            {children}
        </AudioContext.Provider>
    );
};