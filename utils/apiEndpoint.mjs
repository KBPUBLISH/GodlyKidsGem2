const LOCAL = 'http://localhost:5001/api/';
const LIVE = 'https://backendgk2-0.onrender.com/api/';
export function resolveApiEndpoint(configured, hostname = 'localhost') {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (configured) {
    try {
      const url = new URL(configured);
      if (['http:', 'https:'].includes(url.protocol) && (local || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return configured;
    } catch { /* use the app's existing environment default */ }
  }
  return local ? LOCAL : LIVE;
}
