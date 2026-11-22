/** Content direction is independent of the book's authored art and swipe coordinates. */
export const languageDirection = (language: string): 'rtl' | 'ltr' =>
  language.toLowerCase().split('-')[0] === 'ar' ? 'rtl' : 'ltr';

export function applyDocumentLanguage(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = languageDirection(language);
}

/** Also runs in the separate home-island document, which has no LanguageProvider. */
export function observeDocumentLanguage() {
  if (typeof window === 'undefined') return;
  const sync = () => applyDocumentLanguage(localStorage.getItem('godlykids_app_language') || 'en');
  sync();
  window.addEventListener('gk:language', sync);
  window.addEventListener('storage', event => {
    if (event.key === 'godlykids_app_language' || event.key === null) sync();
  });
}
