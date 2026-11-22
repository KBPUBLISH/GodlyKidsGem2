/** One background transfer at a time, shared across early screens. Never gates navigation. */
export function createAssetWarmupQueue(load, timeoutMs = 15000) {
  const settled = new Set(), listeners = new Set();
  let pending = [], active = null, running = false, started = false;
  const status = () => ({finished: started && !active && pending.length === 0});
  const notify = () => listeners.forEach(listener => listener(status()));

  async function run() {
    if (running) return;
    running = true;
    while (pending.length) {
      const url = pending.shift();
      const controller = new AbortController();
      const task = {url, controller, stopped: false};
      active = task;
      notify();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try { await load(url, controller.signal); }
      catch { /* A missing/slow asset is retried by its real screen when needed. */ }
      finally {
        clearTimeout(timer);
        if (!task.stopped) settled.add(url);
        active = null;
        notify();
      }
    }
    running = false;
  }

  return {
    start(urls) {
      started = true;
      // A later screen moves its remaining assets to the front, without refetching completed ones.
      pending = [...new Set(urls)].filter(url => !settled.has(url) && (active?.stopped || url !== active?.url));
      notify();
      void run();
    },
    stop() {
      pending = [];
      if (active) { active.stopped = true; active.controller.abort(); }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(status());
      return () => { listeners.delete(listener); };
    },
  };
}
