import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Cache for translated content to avoid re-fetching
const translationCache = new Map<string, string>();

/**
 * Hook to translate a single text string
 */
export function useTranslatedText(originalText: string | undefined | null): string {
    const { currentLanguage, translateText } = useLanguage();
    const [translatedText, setTranslatedText] = useState(originalText || '');

    useEffect(() => {
        if (!originalText) {
            setTranslatedText('');
            return;
        }

        if (currentLanguage === 'en') {
            setTranslatedText(originalText);
            return;
        }

        const cacheKey = `${currentLanguage}_${originalText}`;
        if (translationCache.has(cacheKey)) {
            setTranslatedText(translationCache.get(cacheKey)!);
            return;
        }

        // Translate asynchronously
        translateText(originalText).then(translated => {
            translationCache.set(cacheKey, translated);
            setTranslatedText(translated);
        });
    }, [originalText, currentLanguage, translateText]);

    return translatedText;
}

/**
 * Hook to translate multiple text strings (batch)
 */
export function useTranslatedTexts(originalTexts: string[]): string[] {
    const { currentLanguage, translateTexts } = useLanguage();
    const [translatedTexts, setTranslatedTexts] = useState<string[]>(originalTexts);

    useEffect(() => {
        if (originalTexts.length === 0) {
            setTranslatedTexts([]);
            return;
        }

        if (currentLanguage === 'en') {
            setTranslatedTexts(originalTexts);
            return;
        }

        // Check cache first
        const results: string[] = [];
        const needsTranslation: { index: number; text: string }[] = [];

        originalTexts.forEach((text, index) => {
            const cacheKey = `${currentLanguage}_${text}`;
            if (translationCache.has(cacheKey)) {
                results[index] = translationCache.get(cacheKey)!;
            } else {
                results[index] = text; // Placeholder
                needsTranslation.push({ index, text });
            }
        });

        if (needsTranslation.length === 0) {
            setTranslatedTexts(results);
            return;
        }

        // Translate missing ones
        translateTexts(needsTranslation.map(item => item.text)).then(translated => {
            const newResults = [...results];
            translated.forEach((trans, i) => {
                const { index, text } = needsTranslation[i];
                const cacheKey = `${currentLanguage}_${text}`;
                translationCache.set(cacheKey, trans);
                newResults[index] = trans;
            });
            setTranslatedTexts(newResults);
        });
    }, [originalTexts.join('|'), currentLanguage, translateTexts]);

    return translatedTexts;
}

/**
 * Hook to translate a book object's title and description
 */
export function useTranslatedBook<T extends { title?: string; description?: string }>(book: T | null | undefined): T | null {
    const { currentLanguage, translateTexts } = useLanguage();
    const [translatedBook, setTranslatedBook] = useState<T | null>(book || null);

    useEffect(() => {
        if (!book) {
            setTranslatedBook(null);
            return;
        }

        if (currentLanguage === 'en') {
            setTranslatedBook(book);
            return;
        }

        const textsToTranslate: string[] = [];
        const fields: ('title' | 'description')[] = [];

        if (book.title) {
            const cacheKey = `${currentLanguage}_${book.title}`;
            if (!translationCache.has(cacheKey)) {
                textsToTranslate.push(book.title);
                fields.push('title');
            }
        }

        if (book.description) {
            const cacheKey = `${currentLanguage}_${book.description}`;
            if (!translationCache.has(cacheKey)) {
                textsToTranslate.push(book.description);
                fields.push('description');
            }
        }

        // If all cached, return immediately
        if (textsToTranslate.length === 0) {
            const translated = { ...book };
            if (book.title) {
                const cacheKey = `${currentLanguage}_${book.title}`;
                (translated as any).title = translationCache.get(cacheKey) || book.title;
            }
            if (book.description) {
                const cacheKey = `${currentLanguage}_${book.description}`;
                (translated as any).description = translationCache.get(cacheKey) || book.description;
            }
            setTranslatedBook(translated);
            return;
        }

        // Translate missing fields
        translateTexts(textsToTranslate).then(translations => {
            const translated = { ...book };
            translations.forEach((trans, i) => {
                const field = fields[i];
                const original = field === 'title' ? book.title : book.description;
                const cacheKey = `${currentLanguage}_${original}`;
                translationCache.set(cacheKey, trans);
                (translated as any)[field] = trans;
            });
            setTranslatedBook(translated);
        });
    }, [book?.title, book?.description, currentLanguage, translateTexts]);

    return translatedBook;
}

/**
 * Hook to translate an array of books
 */
export function useTranslatedBooks<T extends { title?: string; description?: string }>(books: T[]): T[] {
    const { currentLanguage, translateTexts } = useLanguage();
    const [translatedBooks, setTranslatedBooks] = useState<T[]>(books);

    useEffect(() => {
        if (books.length === 0) {
            setTranslatedBooks([]);
            return;
        }

        if (currentLanguage === 'en') {
            setTranslatedBooks(books);
            return;
        }

        // Collect all texts that need translation
        const textsToTranslate: string[] = [];
        const textMapping: { bookIndex: number; field: 'title' | 'description' }[] = [];

        books.forEach((book, bookIndex) => {
            if (book.title) {
                const cacheKey = `${currentLanguage}_${book.title}`;
                if (!translationCache.has(cacheKey)) {
                    textsToTranslate.push(book.title);
                    textMapping.push({ bookIndex, field: 'title' });
                }
            }
            if (book.description) {
                const cacheKey = `${currentLanguage}_${book.description}`;
                if (!translationCache.has(cacheKey)) {
                    textsToTranslate.push(book.description);
                    textMapping.push({ bookIndex, field: 'description' });
                }
            }
        });

        // Apply cached translations first
        const result = books.map(book => {
            const translated = { ...book };
            if (book.title) {
                const cacheKey = `${currentLanguage}_${book.title}`;
                if (translationCache.has(cacheKey)) {
                    (translated as any).title = translationCache.get(cacheKey);
                }
            }
            if (book.description) {
                const cacheKey = `${currentLanguage}_${book.description}`;
                if (translationCache.has(cacheKey)) {
                    (translated as any).description = translationCache.get(cacheKey);
                }
            }
            return translated;
        });

        if (textsToTranslate.length === 0) {
            setTranslatedBooks(result);
            return;
        }

        // Translate missing texts
        translateTexts(textsToTranslate).then(translations => {
            const newResult = [...result];
            translations.forEach((trans, i) => {
                const { bookIndex, field } = textMapping[i];
                const original = field === 'title' ? books[bookIndex].title : books[bookIndex].description;
                const cacheKey = `${currentLanguage}_${original}`;
                translationCache.set(cacheKey, trans);
                (newResult[bookIndex] as any)[field] = trans;
            });
            setTranslatedBooks(newResult);
        });
    }, [books.map(b => b.title).join('|'), currentLanguage, translateTexts]);

    return translatedBooks;
}

/**
 * Hook to translate category names
 */
export function useTranslatedCategories(categories: Array<{ name: string; [key: string]: any }>): Array<{ name: string; [key: string]: any }> {
    const { currentLanguage, translateTexts } = useLanguage();
    const [translatedCategories, setTranslatedCategories] = useState(categories);

    useEffect(() => {
        if (categories.length === 0) {
            setTranslatedCategories([]);
            return;
        }

        if (currentLanguage === 'en') {
            setTranslatedCategories(categories);
            return;
        }

        const names = categories.map(c => c.name);
        const needsTranslation: string[] = [];
        const needsTranslationIndices: number[] = [];

        names.forEach((name, index) => {
            const cacheKey = `${currentLanguage}_${name}`;
            if (!translationCache.has(cacheKey)) {
                needsTranslation.push(name);
                needsTranslationIndices.push(index);
            }
        });

        // Apply cached first
        const result = categories.map(cat => {
            const cacheKey = `${currentLanguage}_${cat.name}`;
            return {
                ...cat,
                name: translationCache.get(cacheKey) || cat.name
            };
        });

        if (needsTranslation.length === 0) {
            setTranslatedCategories(result);
            return;
        }

        translateTexts(needsTranslation).then(translations => {
            const newResult = [...result];
            translations.forEach((trans, i) => {
                const originalIndex = needsTranslationIndices[i];
                const originalName = categories[originalIndex].name;
                const cacheKey = `${currentLanguage}_${originalName}`;
                translationCache.set(cacheKey, trans);
                newResult[originalIndex] = { ...newResult[originalIndex], name: trans };
            });
            setTranslatedCategories(newResult);
        });
    }, [categories.map(c => c.name).join('|'), currentLanguage, translateTexts]);

    return translatedCategories;
}

// Clear translation cache (useful when user logs out)
export function clearTranslationCache(): void {
    translationCache.clear();
}

