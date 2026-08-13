/**
 * Despia native audio player (Android lock screen + background playback).
 *
 * HTML <audio> + Media Session works on iOS WKWebView (Now Playing / Control Center).
 * Android WebView does not host a MediaSessionService, so:
 *  - no Spotify-style notification / lock-screen widget
 *  - the process is killed after a few minutes in the background
 *
 * Despia's native player (ExoPlayer + MediaSession) owns playback, artwork,
 * play/pause, and keeps audio alive after the WebView suspends.
 *
 * Docs: https://setup.despia.com/native-features/audio-player
 *
 * Requires the Native Audio feature enabled in the Despia Editor and a fresh
 * Android build. If the scheme is missing, we fall back to HTML audio.
 */

import despia from 'despia-native';
import { isDespiaAndroid } from './despiaService';

type PlaylistLike = {
    _id: string;
    title: string;
    author?: string;
    coverImage?: string;
    type?: string;
    items: Array<{
        _id?: string;
        title: string;
        author?: string;
        coverImage?: string;
        audioUrl: string;
        duration?: number;
    }>;
};

export type NativeAudioTrack = {
    id: string;
    url: string;
    title: string;
    author?: string;
    poster?: string;
    duration_seconds?: number;
    metadata?: Record<string, unknown>;
};

export type NativeAudioState = {
    status?: 'stopped' | 'playing' | 'paused' | 'buffering';
    mode?: 'inline' | 'feed';
    current_index?: number;
    position_seconds?: number;
    duration_seconds?: number | null;
    loop?: boolean;
    skip_interval?: number;
    speed_rate?: number;
    feed_exhausted?: boolean;
    queue?: NativeAudioTrack[];
};

export type NativeAudioEvent = {
    type: string;
    state?: NativeAudioState;
    positionSeconds?: number;
    durationSeconds?: number | null;
    status?: string;
    error?: string;
    skipSeconds?: number;
};

type Handler = (evt: NativeAudioEvent) => void;

const handlers = new Set<Handler>();
let installed = false;

/** Native player only accepts publicly fetchable HTTPS URLs (no blob/data/file). */
export function toPublicHttps(url?: string | null): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
        return null;
    }
    if (trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (trimmed.startsWith('/') && typeof location !== 'undefined' && location.origin.startsWith('https')) {
        return `${location.origin}${trimmed}`;
    }
    return null;
}

/**
 * Android Despia only. iOS already maps HTML Media Session to lock-screen
 * controls; switching that path risks a regression if native audio is not
 * in the current iOS binary.
 */
export function isNativeAudioAvailable(): boolean {
    return isDespiaAndroid();
}

export function isUnknownNativeAudioCommand(error?: string): boolean {
    return typeof error === 'string' && error.startsWith('unknown_command');
}

export function toNativeTracks(playlist: PlaylistLike, order?: number[]): NativeAudioTrack[] {
    const items = playlist.items || [];
    const indices =
        order && order.length === items.length
            ? order
            : items.map((_, i) => i);

    const tracks: NativeAudioTrack[] = [];
    for (const originalIndex of indices) {
        const item = items[originalIndex];
        if (!item) continue;
        const url = toPublicHttps(item.audioUrl);
        if (!url || !item.title) continue;
        const poster = toPublicHttps(item.coverImage || playlist.coverImage);
        tracks.push({
            id: String(item._id || `${playlist._id}_${originalIndex}`),
            url,
            title: item.title,
            author: item.author || playlist.author || 'GodlyKids',
            ...(poster ? { poster } : {}),
            ...(typeof item.duration === 'number' && item.duration > 0
                ? { duration_seconds: item.duration }
                : {}),
            metadata: {
                playlistId: playlist._id,
                playlistTitle: playlist.title,
                playlistAuthor: playlist.author,
                playlistCover: playlist.coverImage,
                playlistType: playlist.type,
                originalIndex,
                itemId: item._id,
            },
        });
    }
    return tracks;
}

function command(scheme: string): void {
    try {
        void despia(scheme);
    } catch (e) {
        console.warn('🎵 Native audio command failed:', scheme, e);
    }
}

export function installNativeAudioListener(): void {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    const previous = (window as unknown as { onAudioEvent?: Handler }).onAudioEvent;
    (window as unknown as { onAudioEvent: Handler }).onAudioEvent = (evt: NativeAudioEvent) => {
        try {
            previous?.(evt);
        } catch {
            /* ignore prior handler errors */
        }
        handlers.forEach((handler) => {
            try {
                handler(evt);
            } catch (e) {
                console.warn('🎵 Native audio handler error:', e);
            }
        });
    };
}

export function subscribeNativeAudio(handler: Handler): () => void {
    installNativeAudioListener();
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
    };
}

export const despiaAudioPlayer = {
    setQueue(
        tracks: NativeAudioTrack[],
        opts?: {
            startIndex?: number;
            controls?: string;
            skipInterval?: number;
            loop?: boolean;
        }
    ): void {
        const params = new URLSearchParams({
            tracks: JSON.stringify(tracks),
            start_index: String(opts?.startIndex ?? 0),
            controls: opts?.controls ?? 'next,prev,skipforward,skipback,seek',
            skip_interval: String(opts?.skipInterval ?? 15),
            loop: opts?.loop ? 'true' : 'false',
        });
        command(`audio://setqueue?${params.toString()}`);
    },

    play(): void {
        command('audio://play');
    },

    pause(): void {
        command('audio://pause');
    },

    next(): void {
        command('audio://next');
    },

    prev(): void {
        command('audio://prev');
    },

    playAt(index: number): void {
        command(`audio://playat?index=${index}`);
    },

    seek(positionSeconds: number): void {
        const pos = Math.max(0, Number(positionSeconds) || 0);
        command(`audio://seek?position=${pos}`);
    },

    terminate(): void {
        command('audio://terminate');
    },

    sync(): void {
        command('audio://sync');
    },
};
