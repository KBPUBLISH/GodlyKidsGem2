/**
 * MongoDB ObjectIds are 24 hex characters.
 * Mock/placeholder ids (e.g. "1", "2", "3") cannot be used to load pages from the API.
 */
export function isValidBookId(bookId: string | undefined | null): boolean {
  if (!bookId || typeof bookId !== 'string') return false;
  const s = bookId.trim();
  return s.length === 24 && /^[a-f0-9]{24}$/i.test(s);
}
