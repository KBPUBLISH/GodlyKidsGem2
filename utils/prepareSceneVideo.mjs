/** Native streaming only: no Blob downloads or service-worker media cache. */
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'];

export function prepareSceneVideo(video, { onLoading, onReady, onFailure }, win = globalThis) {
  let disposed = false;
  let ready = false;
  let generation = 0;
  let timer;
  let poll;
  let armed = false;
  const clear = () => { clearTimeout(timer); clearInterval(poll); };
  const disarm = () => {
    if (!armed) return;
    armed = false;
    for (const name of GESTURES) win.removeEventListener?.(name, onGesture, true);
  };
  const check = () => {
    if (disposed || ready || video.readyState < 2) return;
    ready = true;
    clear();
    disarm();
    onReady();
  };
  const fail = () => {
    if (disposed || ready) return;
    clear();
    onFailure();
  };
  // WKWebView drops a muted autoplay once the tap that opened the scene is
  // stale (the CMS fetch outruns it). Replay inside the very next gesture.
  const onGesture = () => {
    if (disposed || ready) return disarm();
    if (video.paused) {
      try { Promise.resolve(video.play()).then(check, () => {}); } catch {}
    }
    check();
  };
  const arm = () => {
    if (armed || disposed || ready) return;
    armed = true;
    for (const name of GESTURES) win.addEventListener?.(name, onGesture, true);
  };
  const start = (reload) => {
    if (disposed) return;
    const attempt = ++generation;
    clear();
    ready = false;
    onLoading();
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = true;
    // Keep load() and play() synchronous with a Retry tap on iOS.
    if (reload) video.load();
    timer = setTimeout(() => { check(); if (!ready) fail(); }, 15000);
    // Some WebViews suppress loadeddata; inspect the decoded-frame state too.
    poll = setInterval(check, 250);
    arm();
    try {
      Promise.resolve(video.play()).then(check, (error) => {
        if (disposed || attempt !== generation) return;
        check();
        if (!ready && error?.name !== 'AbortError' && error?.name !== 'NotAllowedError') fail();
      });
    } catch { fail(); }
    check();
  };
  video.addEventListener('loadeddata', check);
  video.addEventListener('canplay', check);
  video.addEventListener('playing', check);
  video.addEventListener('error', fail);
  start(false);
  return {
    retry: () => start(true),
    dispose() {
      disposed = true;
      generation++;
      clear();
      disarm();
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('playing', check);
      video.removeEventListener('error', fail);
    },
  };
}
