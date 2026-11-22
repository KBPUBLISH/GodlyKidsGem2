/** Start Try It audio in the same tap that opens the player. */

let primed: HTMLVideoElement | null = null;

const applyInlineAttrs = (video: HTMLVideoElement): void => {
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.controls = false;
  video.removeAttribute('controls');
  video.crossOrigin = 'anonymous';
};

export const applyUnmutedPlayback = (video: HTMLVideoElement): Promise<void> => {
  applyInlineAttrs(video);
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;
  return video.play().then(() => undefined);
};

/** Call from the Try it! tap — play() must run in that user gesture. */
export const primeTryItVideoFromTap = (url: string): void => {
  const src = String(url || '').trim();
  if (!src) return;
  const reuse =
    primed &&
    (primed.getAttribute('data-tryit-src') === src ||
      primed.currentSrc === src ||
      primed.src === src);
  const video = reuse && primed ? primed : document.createElement('video');
  if (primed && primed !== video) {
    try {
      primed.pause();
    } catch {
      /* ignore */
    }
  }
  video.setAttribute('data-tryit-src', src);
  if (video.getAttribute('src') !== src) video.src = src;
  applyUnmutedPlayback(video).catch(() => undefined);
  primed = video;
};

export const takePrimedTryItVideo = (url: string): HTMLVideoElement | null => {
  const src = String(url || '').trim();
  if (!primed || !src) return null;
  const match =
    primed.getAttribute('data-tryit-src') === src ||
    primed.currentSrc === src ||
    primed.src === src;
  if (!match) return null;
  const video = primed;
  primed = null;
  return video;
};

/** Show the first English captions/subtitles track, else the first available. */
export const enableFirstCaptionTrack = (video: HTMLVideoElement): void => {
  const tracks = video.textTracks;
  if (!tracks || tracks.length < 1) return;
  let chosen: TextTrack | null = null;
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track.kind !== 'captions' && track.kind !== 'subtitles') continue;
    const lang = String(track.language || '').toLowerCase();
    if (lang.startsWith('en')) {
      chosen = track;
      break;
    }
    if (!chosen) chosen = track;
  }
  if (!chosen) {
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      if (track.kind === 'captions' || track.kind === 'subtitles') {
        chosen = track;
        break;
      }
    }
  }
  if (!chosen) chosen = tracks[0] || null;
  if (!chosen) return;
  for (let i = 0; i < tracks.length; i += 1) {
    tracks[i].mode = tracks[i] === chosen ? 'showing' : 'disabled';
  }
};
