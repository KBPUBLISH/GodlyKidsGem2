import { IslandSfx } from './island-sfx.js';

/** Two gentle tracks, played one after the other, then again. */
const TRACKS = [
  '/assets/music/gentle-gameplay.mp3',
  '/assets/music/gentle-gameplay-2.mp3',
];
const KEY = 'gk_island_music_v1';
const HALF = 0.5;

function wanted() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}

/**
 * Island gameplay music. Half volume through a gain node so phones that
 * ignore element.volume still play quietly. Starts on the first tap if the
 * browser blocks autoplay.
 */
export class IslandMusic {
  constructor() {
    this.on = wanted();
    this.index = 0;
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.volume = HALF;
    this.ctx = null;
    this.gain = null;
    this.audio.addEventListener('ended', () => this.advance());
    // Action effects share this speaker switch. Their context is separate,
    // so a chop does not restart the music element.
    this.sfx = new IslandSfx(() => this.on);
  }

  remember() {
    try { localStorage.setItem(KEY, this.on ? '1' : '0'); } catch { /* keep the choice for this visit */ }
  }

  graph() {
    if (this.ctx || !window.AudioContext && !window.webkitAudioContext) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      this.ctx = new Ctx();
      const source = this.ctx.createMediaElementSource(this.audio);
      this.gain = this.ctx.createGain();
      this.gain.gain.value = HALF;
      source.connect(this.gain).connect(this.ctx.destination);
      // The gain node is the half-volume control. Leave the element at full
      // so the two don't stack into a quarter.
      this.audio.volume = 1;
    } catch {
      this.ctx = null;
      this.audio.volume = HALF;
    }
  }

  async start() {
    if (!this.on || this.audio.src) {
      if (this.on) await this.play();
      return;
    }
    this.audio.src = TRACKS[this.index];
    await this.play();
  }

  async play() {
    if (!this.on) return;
    this.graph();
    try { if (this.ctx?.state === 'suspended') await this.ctx.resume(); } catch { /* still locked */ }
    try { await this.audio.play(); } catch { /* waiting for a tap */ }
  }

  advance() {
    this.index = (this.index + 1) % TRACKS.length;
    this.audio.src = TRACKS[this.index];
    if (this.on) this.audio.play().catch(() => {});
  }

  /** First tap on the island, or coming back to the page. */
  unlock() {
    this.sfx?.unlock();
    if (this.on) this.start();
  }

  setOn(on) {
    this.on = !!on;
    this.remember();
    this.sfx?.setAudible(this.on);
    if (this.on) {
      if (!this.audio.src) this.audio.src = TRACKS[this.index];
      this.play();
    } else {
      this.audio.pause();
    }
  }

  dispose() {
    this.audio.pause();
    this.audio.src = '';
    this.sfx?.dispose();
    this.ctx?.close?.();
  }
}
