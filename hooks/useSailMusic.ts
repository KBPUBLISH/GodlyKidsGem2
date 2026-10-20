import { useCallback, useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';

const SAIL_MUSIC_SRC = '/sounds/sail-tiny-trail-adventures.mp3';
const STORAGE_KEY = 'godlykids_sail_music_on';
/** Mixed against Settings volume so the ocean bed stays under dialogue later. */
const VOLUME_SCALE = 0.45;

function readSailMusicOn(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    /* private mode */
  }
  return true;
}

type SharedSail = {
  el: HTMLAudioElement;
  listeners: number;
};

let shared: SharedSail | null = null;
let soundOnValue = readSailMusicOn();
const soundSubs = new Set<(on: boolean) => void>();
let playlistPlaying = false;
let musicVolumeValue = 0.5;

function persistSoundOn(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    /* private mode */
  }
}

function applyPlayPause() {
  const el = shared?.el;
  if (!el) return;
  el.volume = Math.min(1, Math.max(0, VOLUME_SCALE * musicVolumeValue));
  if (!soundOnValue || playlistPlaying) {
    el.pause();
    return;
  }
  void el.play().catch(() => {
    /* wait for a gesture */
  });
}

function writeSoundOn(next: boolean) {
  if (soundOnValue === next) {
    applyPlayPause();
    return;
  }
  soundOnValue = next;
  persistSoundOn(next);
  soundSubs.forEach((fn) => fn(next));
  applyPlayPause();
}

function onGesture() {
  applyPlayPause();
}

function onVisibility() {
  if (document.hidden) {
    shared?.el.pause();
    return;
  }
  applyPlayPause();
}

function acquireShared(): HTMLAudioElement {
  if (!shared) {
    const el = document.createElement('audio');
    el.src = SAIL_MUSIC_SRC;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('data-gk-role', 'sail-music');
    document.body.appendChild(el);
    shared = { el, listeners: 0 };
    window.addEventListener('pointerdown', onGesture);
    document.addEventListener('visibilitychange', onVisibility);
  }
  shared.listeners += 1;
  applyPlayPause();
  return shared.el;
}

function releaseShared() {
  if (!shared) return;
  shared.listeners -= 1;
  if (shared.listeners > 0) return;
  // Delay teardown so sail → map → scene remounts keep the same element.
  window.setTimeout(() => {
    if (!shared || shared.listeners > 0) return;
    window.removeEventListener('pointerdown', onGesture);
    document.removeEventListener('visibilitychange', onVisibility);
    shared.el.pause();
    shared.el.removeAttribute('src');
    shared.el.remove();
    shared = null;
  }, 250);
}

/**
 * Loop Tiny Trail Adventures across sail → island map → story scene.
 * Shared singleton so the track does not restart on navigation.
 * Independent of Explore's Settings toggle. Yields to the playlist MiniPlayer.
 */
export function useSailMusic() {
  const { musicVolume, currentPlaylist } = useAudio();
  const [soundOn, setSoundOn] = useState(soundOnValue);

  useEffect(() => {
    musicVolumeValue = musicVolume;
    applyPlayPause();
  }, [musicVolume]);

  useEffect(() => {
    playlistPlaying = Boolean(currentPlaylist);
    applyPlayPause();
  }, [currentPlaylist]);

  useEffect(() => {
    const sub = (on: boolean) => setSoundOn(on);
    soundSubs.add(sub);
    acquireShared();
    return () => {
      soundSubs.delete(sub);
      releaseShared();
    };
  }, []);

  const toggleSound = useCallback(() => {
    writeSoundOn(!soundOnValue);
  }, []);

  const setSoundOnShared = useCallback((next: boolean) => {
    writeSoundOn(next);
  }, []);

  return { soundOn, toggleSound, setSoundOn: setSoundOnShared };
}
