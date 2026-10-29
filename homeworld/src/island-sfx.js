/**
 * Short island action effects. Most are synthesized here so the kids' app
 * does not ship a downloaded sound pack; the Dining Hall bell is a small
 * recorded clip (CLIPS). Each clip is one shot and quiet. Playback follows the speaker toggle on IslandMusic: sound off
 * means nothing starts, and a clip already playing is ducked at once.
 * This uses its own AudioContext, so a chop never restarts the music bed
 * or the prayer voice.
 */

const MASTER = 0.3;
const GAP = 0.08;

/**
 * Recorded one-shots, fetched once the context exists. Paths use the same
 * "/assets/" prefix as the music tracks; the build rewrites it to
 * "/homeworld/assets/" so files resolve from public/homeworld.
 */
const CLIPS = {
  bell: '/assets/sfx/dinner-bell.mp3',
};

function noiseAt(i) {
  const s = Math.imul(i + 1, 16807) % 2147483647;
  return (s / 2147483647) * 2 - 1;
}

function fadeOut(seconds, t) {
  return Math.max(0, Math.min(1, (seconds - t) / 0.012));
}

function limit(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.5) {
    const g = 0.5 / peak;
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
  return data;
}

function render(rate, seconds, fill) {
  const n = Math.max(1, Math.floor(rate * seconds));
  const data = new Float32Array(n);
  fill(data, rate, seconds);
  for (let i = 0; i < n; i++) data[i] *= fadeOut(seconds, i / rate);
  return limit(data);
}

/** Distinct one-shots. Same sample rate in, different timbre out. */
export function effectSamples(rate) {
  const chop = render(rate, 0.16, (data) => {
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const knock = Math.sin(2 * Math.PI * 168 * t) * Math.exp(-t * 22);
      const body = Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 14) * 0.4;
      const grit = noiseAt(i) * Math.exp(-t * 46) * 0.18;
      data[i] = (knock + body + grit) * 0.85;
    }
  });
  const rock = render(rate, 0.13, (data) => {
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const clink = Math.sin(2 * Math.PI * 1040 * t) * Math.exp(-t * 34);
      const partial = Math.sin(2 * Math.PI * 1570 * t) * Math.exp(-t * 42) * 0.38;
      const tick = t < 0.007 ? noiseAt(i + 40) * 0.12 : 0;
      data[i] = (clink + partial + tick) * 0.62;
    }
  });
  const harvest = render(rate, 0.28, (data) => {
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const white = noiseAt(i + 90);
      low += (white - low) * 0.16;
      const air = white - low;
      const rustle = Math.exp(-((t - 0.03) ** 2) / 0.0009) * 0.75 + Math.exp(-((t - 0.11) ** 2) / 0.004) * 0.5;
      const snip = Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t * 36) * 0.12;
      data[i] = (air * rustle * 0.5 + snip) * 3.4;
    }
  });
  const dig = render(rate, 0.24, (data) => {
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const white = noiseAt(i + 200);
      low += (white - low) * 0.07;
      const scoop = Math.sin(Math.PI * Math.min(1, t / 0.22));
      data[i] = low * scoop * 0.9;
    }
  });
  const plant = render(rate, 0.14, (data) => {
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      low += (noiseAt(i + 300) - low) * 0.12;
      const pat = Math.sin(2 * Math.PI * 68 * t) * Math.exp(-t * 26);
      data[i] = pat * 0.75 + low * Math.exp(-t * 18) * 0.22;
    }
  });
  const place = render(rate, 0.11, (data) => {
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const tap = Math.sin(2 * Math.PI * 430 * t) * Math.exp(-t * 38);
      const wood = noiseAt(i + 400) * Math.exp(-t * 62) * 0.1;
      data[i] = (tap + wood) * 0.7;
    }
  });
  const brick = render(rate, 0.09, (data) => {
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const tick = Math.sin(2 * Math.PI * 1720 * t) * Math.exp(-t * 50);
      const edge = Math.sin(2 * Math.PI * 2280 * t) * Math.exp(-t * 58) * 0.28;
      data[i] = (tick + edge) * 0.55;
    }
  });
  return { chop, rock, harvest, dig, plant, place, brick };
}

export class IslandSfx {
  /** @param {() => boolean} audible speaker toggle; false plays nothing */
  constructor(audible) {
    this.audible = audible;
    this.ctx = null;
    this.master = null;
    this.buffers = null;
    this.loading = {};
    this.recent = {};
  }

  ensure() {
    if (this.ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.audible?.() ? MASTER : 0;
      this.master.connect(this.ctx.destination);
      const samples = effectSamples(this.ctx.sampleRate);
      this.buffers = {};
      for (const [name, data] of Object.entries(samples)) {
        const buffer = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
        buffer.copyToChannel(data, 0);
        this.buffers[name] = buffer;
      }
      this.loading = {};
      for (const [name, url] of Object.entries(CLIPS)) this.loadClip(name, url);
      return true;
    } catch {
      this.ctx = null;
      this.master = null;
      this.buffers = null;
      return false;
    }
  }

  /** Fetch and decode a recorded clip into the buffer table. Missing files just stay silent. */
  loadClip(name, url) {
    const ctx = this.ctx;
    if (!ctx || this.buffers?.[name] || this.loading?.[name]) return this.loading?.[name] || null;
    const job = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => { if (this.ctx === ctx && this.buffers) this.buffers[name] = buffer; })
      .catch(() => {})
      .finally(() => { if (this.loading) delete this.loading[name]; });
    this.loading[name] = job;
    return job;
  }

  /** First tap, or coming back to the page. Does not start the music. */
  unlock() {
    try {
      if (!this.ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* browser blocked audio */ }
  }

  /** Speaker flipped. Cuts a note that is already going, and stays quiet while off. */
  setAudible(on) {
    if (!this.master || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(on ? MASTER : 0, now);
    } catch { /* ignore */ }
  }

  play(name) {
    try {
      if (!this.audible?.()) return;
      if (!this.ensure()) return;
      const start = () => {
        try {
          if (!this.audible?.() || !this.ctx || this.ctx.state !== 'running' || !this.buffers?.[name]) return;
          const now = this.ctx.currentTime;
          if (this.recent[name] != null && now - this.recent[name] < GAP) return;
          this.recent[name] = now;
          const src = this.ctx.createBufferSource();
          src.buffer = this.buffers[name];
          src.loop = false;
          src.connect(this.master);
          src.start(now);
          src.onended = () => { try { src.disconnect(); } catch { /* already stopped */ } };
        } catch { /* audio cannot start */ }
      };
      // A recorded clip asked for before its first decode finished plays as soon as it lands.
      const pending = !this.buffers?.[name] && (this.loading?.[name] || (CLIPS[name] && this.loadClip(name, CLIPS[name])));
      const go = () => { if (pending) pending.then(start); else start(); };
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(go).catch(() => {});
        return;
      }
      go();
    } catch { /* audio cannot start */ }
  }

  dispose() {
    try { this.ctx?.close?.(); } catch { /* already closed */ }
    this.ctx = null;
    this.master = null;
    this.buffers = null;
    this.loading = null;
  }
}
