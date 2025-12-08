import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import { getApiBaseUrl } from '../services/apiService';

// Pre-translated UI strings for all supported languages
// This ensures instant language switching without API calls
const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
    en: {
        // Navigation
        home: 'Home',
        explore: 'Explore',
        read: 'Read',
        listen: 'Listen',
        settings: 'Settings',
        profile: 'Profile',
        library: 'Library',
        
        // Actions
        play: 'Play',
        pause: 'Pause',
        stop: 'Stop',
        continue: 'Continue',
        next: 'Next',
        back: 'Back',
        skip: 'Skip',
        retry: 'Retry',
        save: 'Save',
        cancel: 'Cancel',
        close: 'Close',
        done: 'Done',
        signIn: 'Sign In',
        signOut: 'Sign Out',
        logOut: 'LOG OUT',
        
        // Sections
        dailyLessons: 'Daily Lessons',
        featuredBooks: 'Featured Books',
        recentlyRead: 'Recently Read',
        favorites: 'Favorites',
        categories: 'Categories',
        allBooks: 'All Books',
        audioBooks: 'Audio Books',
        
        // Book Reader
        readAloud: 'Read Aloud',
        autoPlay: 'Auto Play',
        voice: 'Voice',
        language: 'Language',
        selectLanguage: 'Select Language',
        
        // Lessons
        watchVideo: 'Watch Video',
        devotional: 'Devotional',
        activity: 'Activity',
        quiz: 'Quiz',
        takeQuiz: 'Take Quiz',
        episode: 'Episode',
        
        // Settings
        account: 'Account',
        notifications: 'Notifications',
        appearance: 'Appearance',
        privacy: 'Privacy',
        help: 'Help',
        about: 'About',
        audioNotifications: 'Audio & Notifications',
        backgroundMusic: 'Background Music',
        soundEffects: 'Sound Effects',
        appLanguage: 'App Language',
        
        // Common
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        noResults: 'No results found',
        searchPlaceholder: 'Search...',
        
        // Messages
        welcome: 'Welcome',
        greatJob: 'Great job!',
        keepGoing: 'Keep going!',
        theEnd: 'The End!',
        whatNext: "Great reading! What's next?",
        readAgain: 'Read Again',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites',
        adventureAwaits: 'Adventure Awaits!',
        termsConditions: 'By continuing you agree to our Terms & Conditions',
        appDisplayLanguage: 'The app will be displayed in your selected language',
        changesLanguageInterface: 'Changes the language of the app interface and automatically translates book text.',
        // Profile Page
        profiles: 'Profiles',
        chooseExplorer: 'Choose Explorer',
        whosPlayingToday: "Who's playing today?",
        addProfile: 'Add Profile',
        parent: 'Parent',
        // Home Page
        hiExplorer: 'Hi Explorer!',
        letsDiveIn: "Let's Dive in.",
        thisWeeksProgress: "This Week's Progress",
        days: 'Days',
        dailyTasksIQGames: 'Daily Tasks & IQ Games',
        restPlayDay: 'Rest & Play Day!',
        noLessonsToday: 'No lessons today. Enjoy reading stories or playing games with family!',
        tapAnotherDay: 'Tap another day above to view those lessons.',
        // Book details
        byAuthor: 'by',
        readNow: 'Read Now',
        listenNow: 'Listen Now',
        pages: 'pages',
        minutes: 'minutes',
        // Categories
        allCategories: 'All Categories',
        bibleStories: 'Bible Stories',
        faithValues: 'Faith & Values',
        prayerDevotional: 'Prayer & Devotional',
        // Common actions
        seeAll: 'See All',
        viewAll: 'View All',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
    },
    es: {
        // Navigation
        home: 'Inicio',
        explore: 'Explorar',
        read: 'Leer',
        listen: 'Escuchar',
        settings: 'Ajustes',
        profile: 'Perfil',
        library: 'Biblioteca',
        
        // Actions
        play: 'Reproducir',
        pause: 'Pausar',
        stop: 'Detener',
        continue: 'Continuar',
        next: 'Siguiente',
        back: 'Atrás',
        skip: 'Omitir',
        retry: 'Reintentar',
        save: 'Guardar',
        cancel: 'Cancelar',
        close: 'Cerrar',
        done: 'Listo',
        signIn: 'Iniciar sesión',
        signOut: 'Cerrar sesión',
        logOut: 'CERRAR SESIÓN',
        
        // Sections
        dailyLessons: 'Lecciones Diarias',
        featuredBooks: 'Libros Destacados',
        recentlyRead: 'Leídos Recientemente',
        favorites: 'Favoritos',
        categories: 'Categorías',
        allBooks: 'Todos los Libros',
        audioBooks: 'Audiolibros',
        
        // Book Reader
        readAloud: 'Leer en Voz Alta',
        autoPlay: 'Reproducción Automática',
        voice: 'Voz',
        language: 'Idioma',
        selectLanguage: 'Seleccionar Idioma',
        
        // Lessons
        watchVideo: 'Ver Video',
        devotional: 'Devocional',
        activity: 'Actividad',
        quiz: 'Cuestionario',
        takeQuiz: 'Hacer Cuestionario',
        episode: 'Episodio',
        
        // Settings
        account: 'Cuenta',
        notifications: 'Notificaciones',
        appearance: 'Apariencia',
        privacy: 'Privacidad',
        help: 'Ayuda',
        about: 'Acerca de',
        audioNotifications: 'Audio y Notificaciones',
        backgroundMusic: 'Música de Fondo',
        soundEffects: 'Efectos de Sonido',
        appLanguage: 'Idioma de la App',
        
        // Common
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        noResults: 'No se encontraron resultados',
        searchPlaceholder: 'Buscar...',
        
        // Messages
        welcome: 'Bienvenido',
        greatJob: '¡Buen trabajo!',
        keepGoing: '¡Sigue así!',
        theEnd: '¡El Fin!',
        whatNext: '¡Excelente lectura! ¿Qué sigue?',
        readAgain: 'Leer de Nuevo',
        addToFavorites: 'Añadir a Favoritos',
        removeFromFavorites: 'Quitar de Favoritos',
        adventureAwaits: '¡La Aventura Te Espera!',
        termsConditions: 'Al continuar aceptas nuestros Términos y Condiciones',
        appDisplayLanguage: 'La aplicación se mostrará en el idioma seleccionado',
        changesLanguageInterface: 'Cambia el idioma de la interfaz de la aplicación y traduce automáticamente el texto de los libros.',
        // Profile Page
        profiles: 'Perfiles',
        chooseExplorer: 'Elige Explorador',
        whosPlayingToday: '¿Quién juega hoy?',
        addProfile: 'Añadir Perfil',
        parent: 'Padre',
        // Home Page
        hiExplorer: '¡Hola Explorador!',
        letsDiveIn: 'Vamos a sumergirnos.',
        thisWeeksProgress: 'Progreso de Esta Semana',
        days: 'Días',
        dailyTasksIQGames: 'Tareas Diarias y Juegos de IQ',
        restPlayDay: '¡Día de Descanso y Juego!',
        noLessonsToday: 'No hay lecciones hoy. ¡Disfruta leyendo historias o jugando con la familia!',
        tapAnotherDay: 'Toca otro día arriba para ver esas lecciones.',
        // Book details
        byAuthor: 'por',
        readNow: 'Leer Ahora',
        listenNow: 'Escuchar Ahora',
        pages: 'páginas',
        minutes: 'minutos',
        // Categories
        allCategories: 'Todas las Categorías',
        bibleStories: 'Historias Bíblicas',
        faithValues: 'Fe y Valores',
        prayerDevotional: 'Oración y Devocional',
        // Common actions
        seeAll: 'Ver Todo',
        viewAll: 'Ver Todo',
        search: 'Buscar',
        filter: 'Filtrar',
        sort: 'Ordenar',
    },
    pt: {
        home: 'Início',
        explore: 'Explorar',
        read: 'Ler',
        listen: 'Ouvir',
        settings: 'Configurações',
        profile: 'Perfil',
        library: 'Biblioteca',
        play: 'Reproduzir',
        pause: 'Pausar',
        stop: 'Parar',
        continue: 'Continuar',
        next: 'Próximo',
        back: 'Voltar',
        skip: 'Pular',
        retry: 'Tentar novamente',
        save: 'Salvar',
        cancel: 'Cancelar',
        close: 'Fechar',
        done: 'Concluído',
        signIn: 'Entrar',
        signOut: 'Sair',
        logOut: 'SAIR',
        dailyLessons: 'Lições Diárias',
        featuredBooks: 'Livros em Destaque',
        recentlyRead: 'Lidos Recentemente',
        favorites: 'Favoritos',
        categories: 'Categorias',
        allBooks: 'Todos os Livros',
        audioBooks: 'Audiolivros',
        readAloud: 'Ler em Voz Alta',
        autoPlay: 'Reprodução Automática',
        voice: 'Voz',
        language: 'Idioma',
        selectLanguage: 'Selecionar Idioma',
        watchVideo: 'Assistir Vídeo',
        devotional: 'Devocional',
        activity: 'Atividade',
        quiz: 'Quiz',
        takeQuiz: 'Fazer Quiz',
        episode: 'Episódio',
        account: 'Conta',
        notifications: 'Notificações',
        appearance: 'Aparência',
        privacy: 'Privacidade',
        help: 'Ajuda',
        about: 'Sobre',
        audioNotifications: 'Áudio e Notificações',
        backgroundMusic: 'Música de Fundo',
        soundEffects: 'Efeitos Sonoros',
        appLanguage: 'Idioma do App',
        loading: 'Carregando...',
        error: 'Erro',
        success: 'Sucesso',
        noResults: 'Nenhum resultado encontrado',
        searchPlaceholder: 'Pesquisar...',
        welcome: 'Bem-vindo',
        greatJob: 'Ótimo trabalho!',
        keepGoing: 'Continue assim!',
        theEnd: 'Fim!',
        whatNext: 'Ótima leitura! O que vem a seguir?',
        readAgain: 'Ler Novamente',
        addToFavorites: 'Adicionar aos Favoritos',
        removeFromFavorites: 'Remover dos Favoritos',
        adventureAwaits: 'A Aventura Espera!',
        termsConditions: 'Ao continuar, você concorda com nossos Termos e Condições',
        appDisplayLanguage: 'O aplicativo será exibido no idioma selecionado',
        changesLanguageInterface: 'Altera o idioma da interface do aplicativo e traduz automaticamente o texto dos livros.',
    },
    fr: {
        home: 'Accueil',
        explore: 'Explorer',
        read: 'Lire',
        listen: 'Écouter',
        settings: 'Paramètres',
        profile: 'Profil',
        library: 'Bibliothèque',
        play: 'Lecture',
        pause: 'Pause',
        stop: 'Arrêter',
        continue: 'Continuer',
        next: 'Suivant',
        back: 'Retour',
        skip: 'Passer',
        retry: 'Réessayer',
        save: 'Enregistrer',
        cancel: 'Annuler',
        close: 'Fermer',
        done: 'Terminé',
        signIn: 'Se connecter',
        signOut: 'Se déconnecter',
        logOut: 'DÉCONNEXION',
        dailyLessons: 'Leçons Quotidiennes',
        featuredBooks: 'Livres en Vedette',
        recentlyRead: 'Lus Récemment',
        favorites: 'Favoris',
        categories: 'Catégories',
        allBooks: 'Tous les Livres',
        audioBooks: 'Livres Audio',
        readAloud: 'Lire à Haute Voix',
        autoPlay: 'Lecture Automatique',
        voice: 'Voix',
        language: 'Langue',
        selectLanguage: 'Sélectionner la Langue',
        watchVideo: 'Regarder la Vidéo',
        devotional: 'Dévotion',
        activity: 'Activité',
        quiz: 'Quiz',
        takeQuiz: 'Faire le Quiz',
        episode: 'Épisode',
        account: 'Compte',
        notifications: 'Notifications',
        appearance: 'Apparence',
        privacy: 'Confidentialité',
        help: 'Aide',
        about: 'À propos',
        audioNotifications: 'Audio et Notifications',
        backgroundMusic: 'Musique de Fond',
        soundEffects: 'Effets Sonores',
        appLanguage: "Langue de l'App",
        loading: 'Chargement...',
        error: 'Erreur',
        success: 'Succès',
        noResults: 'Aucun résultat trouvé',
        searchPlaceholder: 'Rechercher...',
        welcome: 'Bienvenue',
        greatJob: 'Excellent travail!',
        keepGoing: 'Continuez!',
        theEnd: 'Fin!',
        whatNext: 'Super lecture! Et maintenant?',
        readAgain: 'Relire',
        addToFavorites: 'Ajouter aux Favoris',
        removeFromFavorites: 'Retirer des Favoris',
        adventureAwaits: "L'Aventure Vous Attend!",
        termsConditions: 'En continuant, vous acceptez nos Conditions Générales',
        appDisplayLanguage: "L'application sera affichée dans la langue sélectionnée",
        changesLanguageInterface: "Change la langue de l'interface de l'application et traduit automatiquement le texte des livres.",
    },
    de: {
        home: 'Startseite',
        explore: 'Entdecken',
        read: 'Lesen',
        listen: 'Hören',
        settings: 'Einstellungen',
        profile: 'Profil',
        library: 'Bibliothek',
        play: 'Abspielen',
        pause: 'Pause',
        stop: 'Stoppen',
        continue: 'Weiter',
        next: 'Nächste',
        back: 'Zurück',
        skip: 'Überspringen',
        retry: 'Erneut versuchen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        close: 'Schließen',
        done: 'Fertig',
        signIn: 'Anmelden',
        signOut: 'Abmelden',
        logOut: 'ABMELDEN',
        dailyLessons: 'Tägliche Lektionen',
        featuredBooks: 'Empfohlene Bücher',
        recentlyRead: 'Kürzlich Gelesen',
        favorites: 'Favoriten',
        categories: 'Kategorien',
        allBooks: 'Alle Bücher',
        audioBooks: 'Hörbücher',
        readAloud: 'Vorlesen',
        autoPlay: 'Automatische Wiedergabe',
        voice: 'Stimme',
        language: 'Sprache',
        selectLanguage: 'Sprache Auswählen',
        watchVideo: 'Video Ansehen',
        devotional: 'Andacht',
        activity: 'Aktivität',
        quiz: 'Quiz',
        takeQuiz: 'Quiz Machen',
        episode: 'Episode',
        account: 'Konto',
        notifications: 'Benachrichtigungen',
        appearance: 'Aussehen',
        privacy: 'Datenschutz',
        help: 'Hilfe',
        about: 'Über',
        audioNotifications: 'Audio & Benachrichtigungen',
        backgroundMusic: 'Hintergrundmusik',
        soundEffects: 'Soundeffekte',
        appLanguage: 'App-Sprache',
        loading: 'Laden...',
        error: 'Fehler',
        success: 'Erfolg',
        noResults: 'Keine Ergebnisse gefunden',
        searchPlaceholder: 'Suchen...',
        welcome: 'Willkommen',
        greatJob: 'Tolle Arbeit!',
        keepGoing: 'Weiter so!',
        theEnd: 'Ende!',
        whatNext: 'Toll gelesen! Was kommt als nächstes?',
        readAgain: 'Nochmal Lesen',
        addToFavorites: 'Zu Favoriten Hinzufügen',
        removeFromFavorites: 'Aus Favoriten Entfernen',
        adventureAwaits: 'Abenteuer Wartet!',
        termsConditions: 'Durch Fortfahren stimmst du unseren AGB zu',
        appDisplayLanguage: 'Die App wird in der ausgewählten Sprache angezeigt',
        changesLanguageInterface: 'Ändert die Sprache der App-Oberfläche und übersetzt automatisch den Buchtext.',
    },
    tl: {
        home: 'Home',
        explore: 'Mag-explore',
        read: 'Magbasa',
        listen: 'Makinig',
        settings: 'Mga Setting',
        profile: 'Profile',
        library: 'Aklatan',
        play: 'I-play',
        pause: 'I-pause',
        stop: 'Itigil',
        continue: 'Magpatuloy',
        next: 'Susunod',
        back: 'Bumalik',
        skip: 'Laktawan',
        retry: 'Subukan Muli',
        save: 'I-save',
        cancel: 'Kanselahin',
        close: 'Isara',
        done: 'Tapos',
        signIn: 'Mag-sign In',
        signOut: 'Mag-sign Out',
        logOut: 'MAG-LOG OUT',
        dailyLessons: 'Mga Araw-araw na Aralin',
        featuredBooks: 'Mga Tampok na Libro',
        recentlyRead: 'Kamakailang Binasa',
        favorites: 'Mga Paborito',
        categories: 'Mga Kategorya',
        allBooks: 'Lahat ng Libro',
        audioBooks: 'Mga Audio Book',
        readAloud: 'Basahin Nang Malakas',
        autoPlay: 'Auto Play',
        voice: 'Boses',
        language: 'Wika',
        selectLanguage: 'Pumili ng Wika',
        watchVideo: 'Manood ng Video',
        devotional: 'Debosyonal',
        activity: 'Aktibidad',
        quiz: 'Pagsusulit',
        takeQuiz: 'Kumuha ng Pagsusulit',
        episode: 'Episode',
        account: 'Account',
        notifications: 'Mga Notification',
        appearance: 'Hitsura',
        privacy: 'Privacy',
        help: 'Tulong',
        about: 'Tungkol Sa',
        audioNotifications: 'Audio at Mga Notification',
        backgroundMusic: 'Background Music',
        soundEffects: 'Mga Sound Effect',
        appLanguage: 'Wika ng App',
        loading: 'Naglo-load...',
        error: 'Error',
        success: 'Tagumpay',
        noResults: 'Walang nakitang resulta',
        searchPlaceholder: 'Maghanap...',
        welcome: 'Maligayang Pagdating',
        greatJob: 'Magaling!',
        keepGoing: 'Ituloy mo!',
        theEnd: 'Wakas!',
        whatNext: 'Mahusay na pagbabasa! Ano ang susunod?',
        readAgain: 'Basahin Muli',
        addToFavorites: 'Idagdag sa Paborito',
        removeFromFavorites: 'Alisin sa Paborito',
        adventureAwaits: 'Naghihintay ang Pakikipagsapalaran!',
        termsConditions: 'Sa pagpapatuloy, sumasang-ayon ka sa aming Mga Tuntunin at Kundisyon',
        appDisplayLanguage: 'Ipapakita ang app sa napiling wika',
        changesLanguageInterface: 'Binabago ang wika ng interface ng app at awtomatikong isinasalin ang teksto ng libro.',
    },
};

// For languages not pre-translated, we'll use the backend API
const getTranslationForLanguage = (lang: string, key: string): string | null => {
    return UI_TRANSLATIONS[lang]?.[key] || null;
};

// Cache for dynamically translated content
const translationCache = new Map<string, string>();

interface LanguageContextType {
    currentLanguage: string;
    setLanguage: (lang: string) => void;
    t: (key: string) => string; // Translate UI text
    translateText: (text: string) => Promise<string>; // Translate dynamic content
    translateTexts: (texts: string[]) => Promise<string[]>; // Batch translate
    isTranslating: boolean;
    supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'godlykids_app_language';

interface LanguageProviderProps {
    children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
    });
    const [isTranslating, setIsTranslating] = useState(false);
    const [apiTranslations, setApiTranslations] = useState<Record<string, Record<string, string>>>({});

    // Save language preference and sync with book reader
    const setLanguage = useCallback((lang: string) => {
        setCurrentLanguage(lang);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        // Also sync with book reader language preference
        localStorage.setItem('godlykids_reader_language', lang);
    }, []);

    // Translate static UI text - instant for pre-translated languages
    const t = useCallback((key: string): string => {
        // First check pre-translated strings
        const preTranslated = getTranslationForLanguage(currentLanguage, key);
        if (preTranslated) {
            return preTranslated;
        }

        // Check API-fetched translations
        if (apiTranslations[currentLanguage]?.[key]) {
            return apiTranslations[currentLanguage][key];
        }

        // Return English as fallback
        return UI_TRANSLATIONS.en[key] || key;
    }, [currentLanguage, apiTranslations]);

    // Fetch translations from API for languages not pre-translated
    useEffect(() => {
        const fetchMissingTranslations = async () => {
            // Skip if we have pre-translated strings for this language
            if (UI_TRANSLATIONS[currentLanguage]) return;
            if (currentLanguage === 'en') return;
            if (apiTranslations[currentLanguage]) return; // Already fetched

            setIsTranslating(true);
            try {
                const englishStrings = UI_TRANSLATIONS.en;
                const keys = Object.keys(englishStrings);
                const texts = Object.values(englishStrings);

                const response = await fetch(`${getApiBaseUrl()}translate/ui`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texts, lang: currentLanguage }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const translated: Record<string, string> = {};
                    keys.forEach((key, index) => {
                        translated[key] = data.translations[index] || englishStrings[key];
                    });

                    setApiTranslations(prev => ({
                        ...prev,
                        [currentLanguage]: translated,
                    }));
                }
            } catch (error) {
                console.error('Failed to translate UI strings:', error);
            } finally {
                setIsTranslating(false);
            }
        };

        fetchMissingTranslations();
    }, [currentLanguage, apiTranslations]);

    // Translate dynamic content (book titles, descriptions, etc.)
    const translateText = useCallback(async (text: string): Promise<string> => {
        if (!text || currentLanguage === 'en') return text;

        const cacheKey = `${currentLanguage}_${text}`;
        if (translationCache.has(cacheKey)) {
            return translationCache.get(cacheKey)!;
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}translate/text?lang=${currentLanguage}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                }
            );

            if (response.ok) {
                const data = await response.json();
                translationCache.set(cacheKey, data.translatedText);
                return data.translatedText;
            }
        } catch (error) {
            console.error('Translation error:', error);
        }

        return text;
    }, [currentLanguage]);

    // Batch translate multiple texts
    const translateTexts = useCallback(async (texts: string[]): Promise<string[]> => {
        if (currentLanguage === 'en') return texts;

        const results: string[] = [];
        const uncachedTexts: string[] = [];
        const uncachedIndices: number[] = [];

        texts.forEach((text, index) => {
            const cacheKey = `${currentLanguage}_${text}`;
            if (translationCache.has(cacheKey)) {
                results[index] = translationCache.get(cacheKey)!;
            } else {
                uncachedTexts.push(text);
                uncachedIndices.push(index);
            }
        });

        if (uncachedTexts.length === 0) {
            return results;
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}translate/texts?lang=${currentLanguage}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texts: uncachedTexts }),
                }
            );

            if (response.ok) {
                const data = await response.json();
                data.translations.forEach((translated: string, i: number) => {
                    const originalIndex = uncachedIndices[i];
                    const originalText = uncachedTexts[i];
                    const cacheKey = `${currentLanguage}_${originalText}`;
                    translationCache.set(cacheKey, translated);
                    results[originalIndex] = translated;
                });
            }
        } catch (error) {
            console.error('Batch translation error:', error);
            uncachedIndices.forEach((index, i) => {
                if (!results[index]) results[index] = uncachedTexts[i];
            });
        }

        return results;
    }, [currentLanguage]);

    const value: LanguageContextType = {
        currentLanguage,
        setLanguage,
        t,
        translateText,
        translateTexts,
        isTranslating,
        supportedLanguages: SUPPORTED_LANGUAGES,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export default LanguageContext;
