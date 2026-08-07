/**
 * Background music for the crew jukebox dance party (CrewDeck3D / CrewPage).
 *
 * Plays a small bundled chiptune loop (public/sounds/dance-loop.mp3, generated
 * by scripts/make-dance-loop.mjs) while a character's dance clip runs, looping
 * if the clip outlasts the 8s tune. `stop()` fades out over ~300ms.
 *
 * While dancing, any OTHER audio already playing (playlist player / app
 * ambient loop from AudioContext) is ducked to 25% of its volume and restored
 * on stop, so a story doesn't fight the dance tune.
 */

const SRC = '/sounds/dance-loop.mp3';
const VOLUME = 0.5;
const FADE_MS = 300;
const DUCK_FACTOR = 0.25;

let el: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
/** Audio elements we ducked, with their original volumes. */
let ducked: Array<{ el: HTMLAudioElement; volume: number }> = [];

function clearFade() {
  if (fadeTimer != null) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function duckOthers() {
  restoreOthers(); // never double-duck
  try {
    document.querySelectorAll('audio').forEach((other) => {
      if (other === el || other.paused || other.muted) return;
      ducked.push({ el: other, volume: other.volume });
      other.volume = other.volume * DUCK_FACTOR;
    });
  } catch {
    /* non-critical */
  }
}

function restoreOthers() {
  for (const { el: other, volume } of ducked) {
    try {
      other.volume = volume;
    } catch {
      /* element may be gone */
    }
  }
  ducked = [];
}

export const danceMusic = {
  /** Start (or restart) the dance tune and duck other playing audio. */
  start(): void {
    try {
      clearFade();
      if (!el) {
        el = new Audio(SRC);
        el.loop = true;
        el.setAttribute('data-gk-role', 'dance-music');
        // In the DOM (invisible — no controls) so it's inspectable/duckable
        document.body.appendChild(el);
      }
      el.volume = VOLUME;
      el.currentTime = 0;
      duckOthers();
      el.play()
        .then(() => console.info('danceMusic: playing'))
        .catch(() => {
          // Autoplay rejected (shouldn't happen — Dance is a user gesture)
          restoreOthers();
        });
    } catch {
      /* audio unavailable — dance continues silently */
    }
  },

  /** Fade out over ~300ms, then pause; restores ducked audio immediately. */
  stop(): void {
    const audio = el;
    restoreOthers();
    if (!audio || audio.paused) return;
    clearFade();
    const step = 30;
    const dropPerStep = (audio.volume * step) / FADE_MS;
    fadeTimer = window.setInterval(() => {
      const v = audio.volume - dropPerStep;
      if (v <= 0.01) {
        clearFade();
        audio.pause();
        audio.volume = VOLUME;
        console.info('danceMusic: stopped');
      } else {
        audio.volume = v;
      }
    }, step);
  },
};
