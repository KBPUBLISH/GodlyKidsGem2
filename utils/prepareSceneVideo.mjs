/** Native streaming only: no Blob downloads or service-worker media cache. */
export function prepareSceneVideo(video, { onLoading, onReady, onFailure }) {
  let disposed = false;
  let ready = false;
  let generation = 0;
  let timer;
  let poll;
  const clear = () => { clearTimeout(timer); clearInterval(poll); };
  const check = () => {
    if (disposed || ready || video.readyState < 2) return;
    ready = true;
    clear();
    onReady();
  };
  const fail = () => {
    if (disposed || ready) return;
    clear();
    onFailure();
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
    try {
      Promise.resolve(video.play()).then(check, (error) => {
        if (disposed || attempt !== generation) return;
        check();
        if (!ready && error?.name !== 'AbortError') fail();
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
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('playing', check);
      video.removeEventListener('error', fail);
    },
  };
}
