const KEY = 'godlykids_library_from_basement';

export function markLibraryFromBasement(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearLibraryFromBasement(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function isLibraryFromBasement(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
