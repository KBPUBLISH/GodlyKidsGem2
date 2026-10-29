import { getApiBaseUrl } from './apiService';

// Supported languages with their display names and flag emojis
export const SUPPORTED_LANGUAGES: Record<string, { name: string; flag: string; nativeName: string }> = {
    'en': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
    'es': { name: 'Latin American Spanish', flag: '🌎', nativeName: 'Español (Latinoamérica)' },
    'pt': { name: 'Brazilian Portuguese', flag: '🇧🇷', nativeName: 'Português (Brasil)' },
    'fr': { name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    'de': { name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    'it': { name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    'nl': { name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    'pl': { name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
    'ru': { name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    'zh': { name: 'Chinese (Simplified)', flag: '🇨🇳', nativeName: '简体中文' },
    'ja': { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
    'ko': { name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
    'tl': { name: 'Filipino', flag: '🇵🇭', nativeName: 'Filipino' },
    'id': { name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
    'hi': { name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
    'ta': { name: 'Tamil', flag: '🇮🇳', nativeName: 'தமிழ்' },
    'ml': { name: 'Malayalam', flag: '🇮🇳', nativeName: 'മലയാളം' },
    'ar': { name: 'Arabic', flag: '🌍', nativeName: 'العربية' },
    'sw': { name: 'Swahili', flag: '🌍', nativeName: 'Kiswahili' },
    'zh-TW': { name: 'Chinese (Traditional)', flag: '🌏', nativeName: '繁體中文' },
};

// Keep onboarding and Settings on the same language list.
export const LAUNCH_LANGUAGES = ['en', 'tl', 'pt', 'fr', 'de', 'it', 'ko', 'es', 'pl', 'id', 'hi', 'ta', 'ml', 'ar', 'sw', 'zh-TW'];

// ElevenLabs multilingual voice IDs for different languages
export const LANGUAGE_VOICES: Record<string, string> = {
    'en': '21m00Tcm4TlvDq8ikWAM', // Rachel (English)
    'es': 'ThT5KcBeYPX3keUQqHPh', // Spanish voice
    'pt': 'ThT5KcBeYPX3keUQqHPh', // Portuguese (use multilingual)
    'fr': 'ThT5KcBeYPX3keUQqHPh', // French
    'de': 'ThT5KcBeYPX3keUQqHPh', // German
    'it': 'ThT5KcBeYPX3keUQqHPh', // Italian
    'nl': 'ThT5KcBeYPX3keUQqHPh', // Dutch
    'pl': 'ThT5KcBeYPX3keUQqHPh', // Polish
    'ru': 'ThT5KcBeYPX3keUQqHPh', // Russian
    'zh': 'ThT5KcBeYPX3keUQqHPh', // Chinese
    'ja': 'ThT5KcBeYPX3keUQqHPh', // Japanese
    'ko': 'ThT5KcBeYPX3keUQqHPh', // Korean
    'tl': 'ThT5KcBeYPX3keUQqHPh', // Filipino (use multilingual)
    'id': 'ThT5KcBeYPX3keUQqHPh', // Indonesian (use multilingual)
    'hi': 'ThT5KcBeYPX3keUQqHPh', // Hindi (multilingual)
    'ta': 'ThT5KcBeYPX3keUQqHPh', // Tamil (multilingual)
    'ml': 'ThT5KcBeYPX3keUQqHPh', // Malayalam (multilingual)
    'ar': 'ThT5KcBeYPX3keUQqHPh', // Arabic (multilingual)
    'sw': 'ThT5KcBeYPX3keUQqHPh', // Swahili (multilingual)
    'zh-TW': 'ThT5KcBeYPX3keUQqHPh', // Chinese (Traditional) (multilingual)
};

interface TranslatedTextBox {
    textBoxIndex: number;
    originalText: string;
    translatedText: string;
}

interface TranslationResult {
    pageId: string;
    languageCode: string;
    translatedText: string;
    translatedTextBoxes: TranslatedTextBox[];
    isOriginal?: boolean;
}

// Local cache for translations during session
const translationCache = new Map<string, TranslationResult>();

// Storage key for language preference
const LANGUAGE_PREF_KEY = 'godlykids_reader_language';

export const translationService = {
    // Get user's preferred language
    getPreferredLanguage(): string {
        return localStorage.getItem(LANGUAGE_PREF_KEY) || 'en';
    },

    // Set user's preferred language
    setPreferredLanguage(languageCode: string): void {
        localStorage.setItem(LANGUAGE_PREF_KEY, languageCode);
    },

    // Get cache key
    getCacheKey(pageId: string, languageCode: string): string {
        return `${pageId}_${languageCode}`;
    },

    // Get translated page content
    async getTranslatedPage(pageId: string, languageCode: string): Promise<TranslationResult | null> {
        // Check local cache first
        const cacheKey = this.getCacheKey(pageId, languageCode);
        if (translationCache.has(cacheKey)) {
            console.log(`📚 Translation from session cache: ${pageId} (${languageCode})`);
            return translationCache.get(cacheKey)!;
        }

        // If English, return null (use original)
        if (languageCode === 'en') {
            return null;
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}translate/page/${pageId}?lang=${languageCode}`
            );

            if (!response.ok) {
                throw new Error(`Translation failed: ${response.status}`);
            }

            const result: TranslationResult = await response.json();
            
            // Cache in session
            translationCache.set(cacheKey, result);
            console.log(`🌐 Translation fetched and cached: ${pageId} (${languageCode})`);
            
            return result;
        } catch (error) {
            console.error('Translation service error:', error);
            return null;
        }
    },

    // Preload translations for multiple pages
    async preloadTranslations(pageIds: string[], languageCode: string): Promise<void> {
        if (languageCode === 'en') return;

        // Filter out already cached pages
        const uncachedIds = pageIds.filter(
            id => !translationCache.has(this.getCacheKey(id, languageCode))
        );

        if (uncachedIds.length === 0) return;

        try {
            const response = await fetch(
                `${getApiBaseUrl()}translate/bulk`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pageIds: uncachedIds, lang: languageCode }),
                }
            );

            if (!response.ok) {
                throw new Error(`Bulk translation failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Cache results
            for (const result of data.results) {
                if (result.status === 'cached' || result.status === 'translated') {
                    const cacheKey = this.getCacheKey(result.pageId, languageCode);
                    translationCache.set(cacheKey, result.translation);
                }
            }

            console.log(`🌐 Preloaded ${data.results.length} translations for ${languageCode}`);
        } catch (error) {
            console.error('Bulk translation error:', error);
        }
    },

    // Clear session cache (when changing books)
    clearCache(): void {
        translationCache.clear();
    },

    // Get list of supported languages
    getSupportedLanguages(): typeof SUPPORTED_LANGUAGES {
        return SUPPORTED_LANGUAGES;
    },

    // Check if language is supported
    isSupported(languageCode: string): boolean {
        return languageCode in SUPPORTED_LANGUAGES;
    },
};

export default translationService;

