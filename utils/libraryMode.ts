export type LibraryMode = 'listen' | 'read' | 'creators';

const STORAGE_KEY = 'godlykids_library_mode';

export function getLibraryMode(): LibraryMode {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (stored === 'read' || stored === 'creators' || stored === 'listen') return stored;
    return 'listen';
  } catch {
    return 'listen';
  }
}

export function setLibraryMode(mode: LibraryMode): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}
