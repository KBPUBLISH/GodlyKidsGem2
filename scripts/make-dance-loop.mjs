/**
 * Generates public/sounds/dance-loop.wav — a cheerful 8s chiptune dance loop
 * (square-wave lead, triangle bass, kick/snare/hat) for the crew Dance action.
 * Run: node scripts/make-dance-loop.mjs
 * Then encode: ffmpeg -i public/sounds/dance-loop.wav -codec:a libmp3lame -b:a 96k public/sounds/dance-loop.mp3
 */
import { writeFileSync } from 'node:fs';

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BARS = 4;
const DUR = BARS * 4 * BEAT; // 8s
const N = Math.round(SR * DUR);
const buf = new Float32Array(N);

const NOTE = (name) => {
  // name like 'C5', 'A4', 'F#4'
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const idx = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(m[1]);
  return 440 * Math.pow(2, (idx - 9) / 12 + (Number(m[2]) - 4));
};

/** Add a tone: square (lead) or triangle (bass) with quick decay envelope. */
function tone(startBeat, lenBeats, note, { wave = 'square', vol = 0.16 } = {}) {
  const f = NOTE(note);
  const s0 = Math.round(startBeat * BEAT * SR);
  const n = Math.round(lenBeats * BEAT * SR);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const t = i / SR;
    const ph = (t * f) % 1;
    const raw =
      wave === 'square'
        ? ph < 0.5
          ? 1
          : -1
        : 4 * Math.abs(ph - 0.5) - 1; // triangle
    // Snappy chip envelope: fast attack, gentle decay, hard gate at note end
    const env = Math.min(1, i / (0.005 * SR)) * Math.exp(-2.2 * t) * (i > n - 220 ? (n - i) / 220 : 1);
    buf[s0 + i] += raw * vol * env;
  }
}

/** Kick: sine pitch-sweep 150→50Hz. */
function kick(startBeat) {
  const s0 = Math.round(startBeat * BEAT * SR);
  const n = Math.round(0.16 * SR);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const t = i / SR;
    const f = 150 * Math.exp(-18 * t) + 50;
    buf[s0 + i] += Math.sin(2 * Math.PI * f * t) * 0.5 * Math.exp(-22 * t);
  }
}

/** Noise burst: snare (longer, band-ish) or hat (tiny tick). */
function noise(startBeat, len, vol) {
  const s0 = Math.round(startBeat * BEAT * SR);
  const n = Math.round(len * SR);
  let last = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const white = Math.random() * 2 - 1;
    const hp = white - last; // crude high-pass for a crisper snap
    last = white * 0.5;
    buf[s0 + i] += hp * vol * Math.exp((-i / n) * 6);
  }
}

// ---- Pattern: 4 bars, C-major pentatonic bounce -------------------------
// Lead melody (eighth notes, beats from 0)
const LEAD = [
  // bar 1
  [0, 0.5, 'C5'], [0.5, 0.5, 'E5'], [1, 0.5, 'G5'], [1.5, 0.5, 'E5'],
  [2, 0.5, 'A5'], [2.5, 0.5, 'G5'], [3, 1, 'E5'],
  // bar 2
  [4, 0.5, 'D5'], [4.5, 0.5, 'E5'], [5, 0.5, 'G5'], [5.5, 0.5, 'A5'],
  [6, 1, 'G5'], [7, 1, 'E5'],
  // bar 3
  [8, 0.5, 'C5'], [8.5, 0.5, 'D5'], [9, 0.5, 'E5'], [9.5, 0.5, 'G5'],
  [10, 0.5, 'A5'], [10.5, 0.5, 'C6'], [11, 1, 'A5'],
  // bar 4 — resolve
  [12, 0.5, 'G5'], [12.5, 0.5, 'E5'], [13, 0.5, 'D5'], [13.5, 0.5, 'E5'],
  [14, 1.5, 'C5'], [15.5, 0.5, 'G4'],
];
for (const [b, l, n] of LEAD) tone(b, l, n, { wave: 'square', vol: 0.13 });

// Bass: root-fifth bounce per bar (C - Am - F - G)
const BASS_ROOTS = ['C2', 'A1', 'F1', 'G1'];
const BASS_FIFTHS = ['G2', 'E2', 'C2', 'D2'];
for (let bar = 0; bar < 4; bar++) {
  for (let b = 0; b < 4; b++) {
    const beat = bar * 4 + b;
    tone(beat, 0.45, BASS_ROOTS[bar], { wave: 'triangle', vol: 0.3 });
    tone(beat + 0.5, 0.4, BASS_FIFTHS[bar], { wave: 'triangle', vol: 0.22 });
  }
}

// Drums: kick on every beat, snare on 2 & 4, hats on the off-beats
for (let beat = 0; beat < BARS * 4; beat++) {
  kick(beat);
  if (beat % 2 === 1) noise(beat, 0.09, 0.25); // snare
  noise(beat + 0.5, 0.03, 0.12); // hat
}

// ---- Normalize + write 16-bit PCM WAV ------------------------------------
let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const gain = 0.85 / peak;

const data = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * gain)) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

writeFileSync('public/sounds/dance-loop.wav', Buffer.concat([header, data]));
console.log(`Wrote public/sounds/dance-loop.wav (${DUR}s, ${((44 + data.length) / 1024).toFixed(0)} KB)`);
