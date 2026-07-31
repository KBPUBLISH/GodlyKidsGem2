import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2, VolumeX } from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import {
    playInteractiveWordDing,
    splitInteractiveWords,
    toggleInteractiveWordIndex,
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
    const tapSet = new Set(levelData?.interactiveWordIndices || []);

    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [videoSoundOn, setVideoSoundOn] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const tickerRef = useRef<number | null>(null);

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
    }, [page.pageNumber, level, text, stopPlayback]);

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

    const playTts = async () => {
        if (!text.trim()) return;
        if (playing) {
            stopPlayback();
            return;
        }
        setLoading(true);
        try {
            const voicesRes = await apiClient.get('/api/tts/voices');
            const voices = Array.isArray(voicesRes.data)
                ? voicesRes.data
                : voicesRes.data?.voices || [];
            const voiceId =
                voices.find((v: { voice_id?: string; voiceId?: string }) => v.voice_id || v.voiceId)
                    ?.voice_id ||
                voices[0]?.voice_id ||
                voices[0]?.voiceId;
            if (!voiceId) {
                alert('No TTS voices available');
                return;
            }
            const res = await apiClient.post('/api/tts/generate', {
                text: text.trim(),
                voiceId,
                pageNumber: page.pageNumber,
                textBoxIndex: 0,
            });
            if (!res.data?.audioUrl) {
                alert('TTS failed');
                return;
            }
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

            const audio = new Audio(getMediaUrl(res.data.audioUrl));
            audioRef.current = audio;
            audio.onended = () => stopPlayback();
            await audio.play();
            setPlaying(true);
            if (timings.length) {
                tickerRef.current = window.setInterval(() => {
                    if (!audioRef.current) return;
                    setHighlightIdx(findWordIndexAtTime(audioRef.current.currentTime, timings));
                }, 50);
            }
        } catch (err) {
            console.error(err);
            alert('TTS playback failed');
        } finally {
            setLoading(false);
        }
    };

    const onWordClick = (wordIndex: number) => {
        if (!editTapWords || !onChangeLevelText) return;
        const next = toggleInteractiveWordIndex(levelData.interactiveWordIndices, wordIndex);
        onChangeLevelText(level, { interactiveWordIndices: next });
        playInteractiveWordDing();
    };

    const bgUrl = page.backgroundUrl ? getMediaUrl(page.backgroundUrl) : '';
    const scrollUrl = page.scrollUrl ? getMediaUrl(page.scrollUrl) : '';
    const levelLabel = READING_LEVELS.find((l) => l.key === level)?.label || level;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600">Phone preview · {levelLabel}</p>
                <div className="flex items-center gap-1.5">
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
                        disabled={!text.trim() || loading}
                        onClick={() => void playTts()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {playing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {loading ? 'Loading…' : playing ? 'Stop' : 'Play TTS'}
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
                {bgUrl ? (
                    page.backgroundType === 'video' ? (
                        <video
                            ref={videoRef}
                            src={bgUrl}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted={!videoSoundOn}
                            loop
                            playsInline
                            autoPlay
                        />
                    ) : (
                        <img
                            src={bgUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )
                ) : (
                    <div className="absolute inset-0 bg-[#2d5a3d]" />
                )}
                {scrollUrl && (
                    <img
                        src={scrollUrl}
                        alt=""
                        className="absolute left-1/2 -translate-x-1/2 bottom-[8%] w-[88%] max-h-[42%] object-contain pointer-events-none"
                        style={{ opacity: (page.scrollOpacity ?? 100) / 100 }}
                    />
                )}
                <div className="absolute left-[10%] right-[10%] bottom-[12%] z-10 max-h-[38%] overflow-y-auto px-2 py-2">
                    <p className="text-center text-[13px] leading-snug text-[#4a3b2a] font-medium whitespace-pre-wrap">
                        {words.length === 0 ? (
                            <span className="text-gray-400 italic text-xs">No text for this age</span>
                        ) : (
                            words.map((w, i) => {
                                const isTap = tapSet.has(i);
                                const isHi = highlightIdx === i;
                                return (
                                    <button
                                        key={`${i}-${w}`}
                                        type="button"
                                        disabled={!editTapWords}
                                        onClick={() => onWordClick(i)}
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
                            })
                        )}
                    </p>
                </div>
            </div>
            {editTapWords && (
                <p className="text-[11px] text-gray-500 text-center">
                    Tap words to mark interactive (highlighted amber).
                </p>
            )}
        </div>
    );
};

export default BookPhonePreview;
