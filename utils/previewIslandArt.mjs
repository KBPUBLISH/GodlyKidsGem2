/** Newly changed CMS art uses the hosting image service until the next build. */
export function previewIslandArt(source, hostname) {
  if (!source || !hostname?.endsWith('.netlify.app')) return source;
  if (!source.startsWith('/assets/') && !/^https:\/\/storage\.googleapis\.com\/productiongk\//.test(source)
      && !/^https:\/\/backendgk2-0\.onrender\.com\/uploads\//.test(source)) return source;
  const query = new URLSearchParams({url:source, w:'768', h:'768', fit:'contain', fm:'webp', q:'78'});
  return `/.netlify/images?${query}`;
}
