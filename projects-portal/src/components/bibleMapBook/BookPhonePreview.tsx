import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Play, Square, Volume2, VolumeX } from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import {
    blankSlotUnits,
    playInteractiveWordDing,
    splitInteractiveWords,
    toggleInteractiveWordIndex,
    wordForSpeech,
} from '../../utils/interactiveWords';
import type { ReadingLevelKey, ReadingPageDraft } from './types';
import { READING_LEVELS } from './types';

interface BookPhonePreviewProps {
    page: ReadingPageDraft;
    level: ReadingLevelKey;
    editTapWords?: boolean;
    onChangeLevelText?: (
        level: ReadingLevelKey,
        patch: { text?: string; interactiveWordIndices?: number[] },
    ) => void;
}

type PreviewMode = 'mark' | 'play';
type WordTiming = { word: string; start: number; end: number };

function findWordIndexAtTime(t: number, words: WordTiming[]): number {
    if (!words.length) return -1;
    for (let i = 0; i < words.length; i++) {
        if (t >= words[i].start && t < words[i].end) return i;
    }
    if (t >= words[words.length - 1].end) return words.length - 1;
    return 0;
}

const BookPhonePreview: React.FC<BookPhonePreviewProps> = ({
    page,
    level,
    editTapWords = false,
    onChangeLevelText,
}) => {
    const levelData = page.readingLevels[level];
    const text = levelData?.text || '';
    const words = splitInteractiveWords(text);
    const tapIndices = useMemo(
        () => levelData?.interactiveWordIndices || [],
        [levelData?.interactiveWordIndices],
    );
    const tapSet = useMemo(() => new Set(tapIndices), [tapIndices]);

    const [mode, setMode] = useState<PreviewMode>(editTapWords ? 'mark' : 'play');
    const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [videoSoundOn, setVideoSoundOn] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const tickerRef = useRef<number | null>(null);
    const voiceIdRef = useRef<string | null>(null);

    const allRevealed =
        tapIndices.length === 0 || tapIndices.every((i) => revealed.has(i));

    const stopPlayback = useCallback(() => {
        if (tickerRef.current != null) {
            window.clearInterval(tickerRef.current);
            tickerRef.current = null;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlaying(false);
        setHighlightIdx(-1);
    }, []);

    useEffect(() => () => stopPlayback(), [stopPlayback]);
    useEffect(() => {
        stopPlayback();
        setRevealed(new Set());
    }, [page.pageNumber, level, text, tapIndices.join(','), stopPlayback]);

    useEffect(() => {
        setVideoSoundOn(false);
    }, [page.backgroundUrl, page.backgroundType]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = !videoSoundOn;
        if (videoSoundOn && el.paused) {
            void el.play().catch(() => {
                /* ignore */
            });
        }
    }, [videoSoundOn]);

    const resolveVoiceId = async (): Promise<string | null> => {
        if (voiceIdRef.current) return voiceIdRef.current;
        const voicesRes = await apiClient.get('/api/tts/voices');
        const voices = Array.isArray(voicesRes.data)
            ? voicesRes.data
            : voicesRes.data?.voices || [];
        const voiceId =
            voices.find((v: { voice_id?: string; voiceId?: string }) => v.voice_id || v.voiceId)
                ?.voice_id ||
            voices[0]?.voice_id ||
            voices[0]?.voiceId ||
            null;
        voiceIdRef.current = voiceId;
        return voiceId;
    };

    const speakText = async (speak: string, withAlignment: boolean) => {
        const voiceId = await resolveVoiceId();
        if (!voiceId) {
            alert('No TTS voices available');
            return;
        }
        stopPlayback();
        setLoading(true);
        try {
            const res = await apiClient.post('/api/tts/generate', {
                text: speak,
                voiceId,
                pageNumber: page.pageNumber,
                textBoxIndex: 0,
            });
            if (!res.data?.audioUrl) {
                alert('TTS failed');
                return;
            }
            const audio = new Audio(getMediaUrl(res.data.audioUrl));
            audioRef.current = audio;
            audio.onended = () => stopPlayback();
            await audio.play();
            setPlaying(true);

            if (withAlignment) {
                const rawWords: unknown[] = Array.isArray(res.data?.alignment?.words)
                    ? res.data.alignment.words
                    : [];
                const timings: WordTiming[] = rawWords
                    .map((w): WordTiming | null => {
                        if (!w || typeof w !== 'object') return null;
                        const word = String((w as { word?: string }).word || '');
                        const start = Number((w as { start?: number }).start);
                        const end = Number((w as { end?: number }).end);
                        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
                        return { word, start, end };
                    })
                    .filter((x): x is WordTiming => !!x);
                if (timings.length) {
                    tickerRef.current = window.setInterval(() => {
                        if (!audioRef.current) return;
                        setHighlightIdx(
                            findWordIndexAtTime(audioRef.current.currentTime, timings),
                        );
                    }, 50);
                }
            }
        } catch (err) {
            console.error(err);
            alert('TTS playback failed');
        } finally {
            setLoading(false);
        }
    };

    const playFullPage = async () => {
        if (!text.trim()) return;
        if (playing) {
            stopPlayback();
            return;
        }
        if (mode === 'play' && tapIndices.length > 0 && !allRevealed) {
            alert('Tap the blanks first — then you can read the whole page.');
            return;
        }
        await speakText(text.trim(), true);
    };

    const onMarkWord = (wordIndex: number) => {
        if (!editTapWords || !onChangeLevelText || mode !== 'mark') return;
        const next = toggleInteractiveWordIndex(levelData.interactiveWordIndices, wordIndex);
        onChangeLevelText(level, { interactiveWordIndices: next });
        playInteractiveWordDing();
    };

    const onRevealWord = async (wordIndex: number) => {
        if (mode !== 'play' || !tapSet.has(wordIndex) || revealed.has(wordIndex)) return;
        setRevealed((prev) => {
            const next = new Set(prev);
            next.add(wordIndex);
            return next;
        });
        playInteractiveWordDing();
        const spoken = wordForSpeech(words[wordIndex] || '');
        if (spoken) {
            void speakText(spoken, false);
        }
    };

    const bgUrl = page.backgroundUrl ? getMediaUrl(page.backgroundUrl) : '';
    const scrollUrl = page.scrollUrl ? getMediaUrl(page.scrollUrl) : '';
    const levelLabel = READING_LEVELS.find((l) => l.key === level)?.label || level;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600">Phone preview · {levelLabel}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {editTapWords && (
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                            <button
                                type="button"
                                onClick={() => setMode('mark')}
                                className={`px-2.5 py-1.5 ${
                                    mode === 'mark'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                Mark
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('play');
                                    setRevealed(new Set());
                                    stopPlayback();
                                }}
                                className={`px-2.5 py-1.5 ${
                                    mode === 'play'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                Play
                            </button>
                        </div>
                    )}
                    {page.backgroundType === 'video' && bgUrl ? (
                        <button
                            type="button"
                            onClick={() => setVideoSoundOn((v) => !v)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700 text-white text-xs hover:bg-gray-800"
                            title={videoSoundOn ? 'Mute video' : 'Unmute video'}
                        >
                            {videoSoundOn ? (
                                <Volume2 className="w-3.5 h-3.5" />
                            ) : (
                                <VolumeX className="w-3.5 h-3.5" />
                            )}
                            {videoSoundOn ? 'Sound on' : 'Sound off'}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        disabled={
                            !text.trim() ||
                            loading ||
                            (mode === 'play' && tapIndices.length > 0 && !allRevealed && !playing)
                        }
                        onClick={() => void playFullPage()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                        title={
                            mode === 'play' && tapIndices.length > 0 && !allRevealed
                                ? 'Unlocks after all blanks are tapped'
                                : 'Read the full page'
                        }
                    >
                        {playing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {loading
                            ? 'Loading…'
                            : playing
                              ? 'Stop'
                              : mode === 'play' && tapIndices.length > 0
                                ? 'Read page'
                                : 'Play TTS'}
                    </button>
                </div>
            </div>
            <div
                className="relative bg-black shadow-xl mx-auto"
                style={{
                    width: 240,
                    height: 480,
                    borderRadius: 28,
                    border: '10px solid #1f2937',
                    overflow: 'hidden',
                }}
            >
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                    style={{ width: 80, height: 16 }}
                    aria-hidden
                />
                {/* Upper art region (3:4) — cropped above parchment so characters stay visible */}
                <div className="absolute top-0 left-0 right-0 h-[54%] overflow-hidden bg-[#2d5a3d]">
                    {bgUrl ? (
                        page.backgroundType === 'video' ? (
                            <video
                                ref={videoRef}
                                src={bgUrl}
                                className="absolute inset-0 w-full h-full object-cover object-top"
                                muted={!videoSoundOn}
                                loop
                                playsInline
                                autoPlay
                            />
                        ) : (
                            <img
                                src={bgUrl}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover object-top"
                            />
                        )
                    ) : (
                        <div className="absolute inset-0 bg-[#2d5a3d]" />
                    )}
                </div>
                {/* Lower parchment / scroll + text */}
                <div className="absolute left-0 right-0 bottom-0 h-[50%] bg-gradient-to-b from-[#e8d5b7]/90 to-[#f5ead4]" />
                <img
                    src={scrollUrl || '/assets/bible-map-default-scroll.png'}
                    alt=""
                    className="absolute left-1/2 -translate-x-1/2 bottom-[2%] w-[96%] h-[48%] object-fill pointer-events-none z-[5]"
                    style={{ opacity: (page.scrollOpacity ?? 100) / 100 }}
                />
                <div className="absolute left-[8%] right-[8%] bottom-[6%] z-10 max-h-[40%] overflow-y-auto px-2 py-2">
                    <p className="text-center text-[13px] leading-snug text-[#4a3b2a] font-medium whitespace-pre-wrap">
                        {words.length === 0 ? (
                            <span className="text-gray-400 italic text-xs">No text for this age</span>
                        ) : (
                            words.map((w, i) => {
                                const isTap = tapSet.has(i);
                                const isHi = highlightIdx === i;

                                if (mode === 'mark') {
                                    return (
                                        <button
                                            key={`${i}-${w}`}
                                            type="button"
                                            disabled={!editTapWords}
                                            onClick={() => onMarkWord(i)}
                                            className={`inline px-0.5 rounded transition ${
                                                isHi
                                                    ? 'bg-yellow-300 text-gray-900'
                                                    : isTap
                                                      ? 'bg-amber-200/90 underline decoration-2'
                                                      : editTapWords
                                                        ? 'hover:bg-white/50'
                                                        : ''
                                            } ${editTapWords ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            {w}{' '}
                                        </button>
                                    );
                                }

                                // Play mode — blanks until tapped
                                if (!isTap) {
                                    return (
                                        <span
                                            key={`${i}-${w}`}
                                            className={isHi ? 'bg-yellow-300 rounded px-0.5' : ''}
                                        >
                                            {w}{' '}
                                        </span>
                                    );
                                }

                                const isRevealed = revealed.has(i);
                                if (!isRevealed) {
                                    const units = blankSlotUnits(w);
                                    return (
                                        <button
                                            key={`${i}-${w}`}
                                            type="button"
                                            onClick={() => void onRevealWord(i)}
                                            className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.5 rounded-md border-2 border-dashed border-emerald-600/70 bg-white/80 align-baseline cursor-pointer hover:bg-emerald-50"
                                            style={{
                                                minWidth: `${Math.max(units * 0.55, 1.6)}em`,
                                                font: 'inherit',
                                                color: 'transparent',
                                            }}
                                            aria-label="Tap to reveal word"
                                        >
                                            <span className="block w-full border-b-2 border-emerald-700/80 leading-none">
                                                {'\u00A0'.repeat(units)}
                                            </span>
                                        </button>
                                    );
                                }

                                return (
                                    <button
                                        key={`${i}-${w}`}
                                        type="button"
                                        onClick={() => void speakText(wordForSpeech(w), false)}
                                        className={`inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded-md border-2 border-emerald-500 bg-white align-baseline ${
                                            isHi ? 'bg-yellow-200' : ''
                                        }`}
                                        style={{ font: 'inherit', color: 'inherit' }}
                                    >
                                        {w}
                                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white shrink-0">
                                            <Check className="w-2 h-2" strokeWidth={3} />
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </p>
                </div>
            </div>
            {editTapWords && mode === 'mark' && (
                <p className="text-[11px] text-gray-500 text-center">
                    Mark mode: tap words to make them blanks. Switch to Play to try the kid flow.
                </p>
            )}
            {mode === 'play' && (
                <p className="text-[11px] text-gray-500 text-center">
                    {tapIndices.length === 0
                        ? 'No tap words marked yet — use Mark mode to choose blanks.'
                        : allRevealed
                          ? 'All blanks filled — Read page is unlocked.'
                          : `Tap blanks to reveal (${revealed.size}/${tapIndices.length}). Each tap speaks that word.`}
                </p>
            )}
        </div>
    );
};

export default BookPhonePreview;
