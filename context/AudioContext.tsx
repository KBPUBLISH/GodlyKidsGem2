
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


    const musicForcePausedRef = useRef(musicForcePaused);
    useEffect(() => {
        musicForcePausedRef.current = musicForcePaused;
    }, [musicForcePaused]);

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

        // MASTER CONTROL LOOP
        // This loop runs periodically to ENFORCE the desired music state.
        // It handles autoplay blocking, resuming, and force pausing.
        const masterLoop = setInterval(() => {
            // 1. FORCE PAUSED? Kill everything IMMEDIATELY and DO NOT resume.
            if (musicForcePausedRef.current) {
                if (!bg.paused) {
                    bg.pause();
                    bg.currentTime = 0; // Reset to beginning
                }
                if (!game.paused) {
                    game.pause();
                    game.currentTime = 0;
                }
                if (!workout.paused) {
                    workout.pause();
                    workout.currentTime = 0;
                }
                // CRITICAL: Return early - DO NOT continue to resume logic
                return;
            }

            // 2. Music Disabled? Kill everything.
            if (!musicEnabled) {
                if (!bg.paused) bg.pause();
                if (!game.paused) game.pause();
                if (!workout.paused) workout.pause();
                return;
            }

            // 3. Music Enabled & Not Paused -> Ensure correct track is playing
            // We use .catch() to ignore "Autoplay failed" errors, as the user interaction will eventually trigger it.

            if (musicMode === 'bg') {
                // Target: BG playing, others paused
                if (bg.paused && bg.readyState >= 2) bg.play().catch(() => { });
                bg.volume = musicVolume * 0.25; // Set volume directly

                if (!game.paused) game.pause();
                if (!workout.paused) workout.pause();
            }
            else if (musicMode === 'game') {
                // Target: Game playing, others paused
                if (game.paused && game.readyState >= 2) game.play().catch(() => { });
                game.volume = musicVolume * 0.3;

                if (!bg.paused) bg.pause();
                if (!workout.paused) workout.pause();
            }
            else if (musicMode === 'workout') {
                // Target: Workout playing, others paused
                if (workout.paused && workout.readyState >= 2) workout.play().catch(() => { });
                workout.volume = musicVolume * 0.4;

                if (!bg.paused) bg.pause();
                if (!game.paused) game.pause();
            }
        }, 50); // Check every 50ms for MORE aggressive enforcement

        // One-time unlock listener for initial browser autoplay policy
        // ONLY add if music is NOT force paused
        const unlockAudio = () => {
            // DO NOT unlock if music is force paused
            if (musicForcePausedRef.current) {
                console.log('🚫 Music force paused - blocking unlock');
                return;
            }
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
            // The master loop will pick up the playing, we just need to trigger a resume context
        };

        // BLOCKING LISTENER: Capture phase to prevent music from playing
        const blockMusicOnInteraction = (e: Event) => {
            if (musicForcePausedRef.current) {
                console.log('🚫 Blocking music on interaction - force paused');
                // Immediately pause all music
                if (bgAudioRef.current && !bgAudioRef.current.paused) {
                    bgAudioRef.current.pause();
                }
                if (gameAudioRef.current && !gameAudioRef.current.paused) {
                    gameAudioRef.current.pause();
                }
                if (workoutAudioRef.current && !workoutAudioRef.current.paused) {
                    workoutAudioRef.current.pause();
                }
            }
        };

        // Only add unlock listeners if music is NOT force paused
        if (!musicForcePaused) {
            window.addEventListener('click', unlockAudio, { once: true });
            window.addEventListener('touchstart', unlockAudio, { once: true });
            window.addEventListener('keydown', unlockAudio, { once: true });
        }

        // ALWAYS add blocking listener in capture phase to prevent music
        window.addEventListener('click', blockMusicOnInteraction, { capture: true });
        window.addEventListener('touchstart', blockMusicOnInteraction, { capture: true });

        return () => {
            clearInterval(masterLoop);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('click', blockMusicOnInteraction, { capture: true });
            window.removeEventListener('touchstart', blockMusicOnInteraction, { capture: true });
        };
    }, [musicEnabled, musicMode, musicVolume, musicForcePaused]); // Re-create loop if config changes

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