import { getBibleMapApiRoot } from './bibleMapApi';
import type { ApiIslandRow } from './oceanMapIslands';

type Snapshot = {version: number; islands: ApiIslandRow[]};
let snapshot: Promise<Snapshot | null> | undefined;
let live: Promise<ApiIslandRow[]> | undefined;
let recent: ApiIslandRow[] | undefined;
let refreshedAt = 0;
const loadSnapshot = () => snapshot ||= fetch('/preview-islands.json', {signal:AbortSignal.timeout(2000)})
  .then(r => r.ok ? r.json() : null)
  .then(data => data?.version === 1 && Array.isArray(data.islands) ? data as Snapshot : null)
  .catch(() => null);

function refresh() {
  if (recent && Date.now()-refreshedAt < 60000) return Promise.resolve(recent);
  return live ||= fetch(`${getBibleMapApiRoot()}/bible-map/islands?status=all`, {signal:AbortSignal.timeout(15000)})
    .then(async response => {
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) throw Error('No story islands available');
      const built = await loadSnapshot();
      recent = data.map(row => {
        const cached = built?.islands.find(i => (i.slug || i._id) === (row.slug || row._id));
        return cached && (cached.mapArtUrl || cached.sailArtUrl) === (row.mapArtUrl || row.sailArtUrl)
          ? {...row, previewArtUrl:cached.previewArtUrl} : row;
      });
      refreshedAt = Date.now();
      return recent;
    }).finally(() => { live = undefined; });
}

export async function fetchPreviewIslandRows(): Promise<ApiIslandRow[]> {
  const built = await loadSnapshot();
  if (recent?.length || built?.islands.length) {
    void refresh().catch(() => {});
    return recent || built!.islands;
  }
  return refresh();
}

/** Read the packaged destination without waiting for a cold content server. */
export async function getFirstStoryIslandArt(): Promise<string | undefined> {
  const built = await loadSnapshot();
  void refresh().catch(() => {});
  return built?.islands[0]?.previewArtUrl;
}
