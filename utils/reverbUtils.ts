/**
 * Reverb effect for karaoke voice using Web Audio API.
 * Generates a simple impulse response for ConvolverNode.
 */

export type ReverbLevel = 0 | 1 | 2 | 3; // None, Light, Medium, Heavy

/** Generate a simple reverb impulse response (room simulation) */
function createImpulseResponse(
  ctx: AudioContext,
  durationSeconds: number,
  decay: number,
  tone: number
): AudioBuffer {
  const length = ctx.sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const sampleRate = ctx.sampleRate;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * decay) * (1 - i / length);
    const noise = (Math.random() * 2 - 1) * envelope;
    const toneMultiplier = Math.exp(-t * tone);
    const s = noise * toneMultiplier * 0.5;
    left[i] = s;
    right[i] = s * 0.9; // slight stereo spread
  }
  return buffer;
}

export const REVERB_PRESETS: Record<ReverbLevel, { label: string; duration: number; decay: number; tone: number; wet: number } | null> = {
  0: null,
  1: { label: 'Light', duration: 0.8, decay: 3, tone: 2, wet: 0.25 },
  2: { label: 'Medium', duration: 1.5, decay: 2, tone: 1.5, wet: 0.45 },
  3: { label: 'Heavy', duration: 2.2, decay: 1.2, tone: 1, wet: 0.65 },
};

export function getReverbLabel(level: ReverbLevel): string {
  return REVERB_PRESETS[level]?.label ?? 'None';
}

/**
 * Create an AudioContext inside a user gesture so iOS allows playback later.
 * Call this synchronously in the click handler, then pass the ctx to prepareVoicePlayback.
 */
export function createVoiceAudioContext(): AudioContext {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // iOS requires resume() inside a user gesture to unlock the context
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Prepares voice playback (decode + setup). Call start() when ready to play in sync with music.
 * 
 * IMPORTANT for iOS: Pass a pre-created AudioContext (from createVoiceAudioContext) that was
 * created inside the user gesture. iOS blocks AudioContext and Audio.play() when created
 * after async gaps (fetch, decodeAudioData, etc.).
 */
export async function prepareVoicePlayback(
  blobUrl: string,
  reverbLevel: ReverbLevel,
  volume: number,
  onEnded: () => void,
  existingCtx?: AudioContext
): Promise<{ start: () => void; stop: () => void; duration: number }> {
  const preset = REVERB_PRESETS[reverbLevel];
  if (!preset || reverbLevel === 0) {
    // For no-reverb: use AudioContext too (more reliable on iOS than Audio element)
    const ctx = existingCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const res = await fetch(blobUrl);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);

    let source: AudioBufferSourceNode | null = null;
    return {
      duration: audioBuffer.duration,
      start: () => {
        source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.onended = onEnded;
        source.connect(gainNode);
        source.start(0);
      },
      stop: () => {
        try { source?.stop(); } catch {}
      },
    };
  }

  const ctx = existingCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  const res = await fetch(blobUrl);
  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(
    ctx,
    preset.duration,
    preset.decay,
    preset.tone
  );

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - preset.wet;
  wetGain.gain.value = preset.wet;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;

  dryGain.connect(masterGain);
  wetGain.connect(masterGain);
  masterGain.connect(ctx.destination);
  convolver.connect(wetGain);

  let source: AudioBufferSourceNode | null = null;
  return {
    duration: audioBuffer.duration,
    start: () => {
      source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.onended = onEnded;
      source.connect(dryGain);
      source.connect(convolver);
      source.start(0);
    },
    stop: () => {
      try { source?.stop(); } catch {}
    },
  };
}

/** @deprecated Use prepareVoicePlayback for synced start */
export async function playWithReverb(
  blobUrl: string,
  reverbLevel: ReverbLevel,
  volume: number,
  onEnded: () => void
): Promise<{ stop: () => void }> {
  const ctrl = await prepareVoicePlayback(blobUrl, reverbLevel, volume, onEnded);
  ctrl.start();
  return { stop: ctrl.stop };
}
