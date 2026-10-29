import { ENGLISH_UI, EXPANDED_UI } from './expandedLanguages';
import { INDONESIAN_UI } from './indonesian';

// Shared by keyed menus and literal labels, so short words retain their UI meaning.
const bySource = Object.fromEntries(
  Object.entries({ id: INDONESIAN_UI, ...EXPANDED_UI }).map(([language, catalog]) => [
    language,
    Object.fromEntries(Object.entries(ENGLISH_UI).map(([key, source]) => [source, catalog[key]])),
  ]),
);
export function staticTranslation(source: string, language: string): string | undefined {
  return bySource[language]?.[source];
}
