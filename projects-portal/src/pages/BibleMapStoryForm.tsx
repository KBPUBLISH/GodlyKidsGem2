import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    BookOpen,
    Puzzle,
    Palette,
    HelpCircle,
    Gamepad2,
    LayoutDashboard,
    ExternalLink,
    Plus,
    Unlink,
    Check,
    Clapperboard,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';
import SlidingPuzzlePreview from '../components/SlidingPuzzlePreview';
import TapFillColoringPreview from '../components/TapFillColoringPreview';
import BibleMapQuizPanel, { emptyQuizLevels } from '../components/BibleMapQuizPanel';
import type { QuizLevel, QuizLevelsState, QuizQuestion } from '../components/BibleMapQuizPanel';
import SceneStudio from '../components/sceneStudio/SceneStudio';
import {
    emptySceneLayout,
    normalizeLoadedLayout,
    type SceneAnimation,
    type SceneLayout,
    type SceneTrigger,
} from '../components/sceneStudio/types';
import BibleMapBookBuilder from '../components/bibleMapBook/BibleMapBookBuilder';

type PackTab = 'overview' | 'scene' | 'book' | 'puzzle' | 'coloring' | 'quiz' | 'game';

interface IslandOption {
    _id: string;
    title: string;
    slug: string;
}

interface BookOption {
    _id: string;
    title: string;
    status: string;
    bookType?: string;
    coverImage?: string;
    files?: { coverImage?: string };
}

interface ColoringTapFill {
    enabled?: boolean;
    regionMapUrl?: string;
    regionPreviewUrl?: string;
    regionCount?: number;
    width?: number;
    height?: number;
    palette?: string[];
}

interface ColoringPage {
    _id: string;
    pageNumber: number;
    bookId?: string | null;
    isColoringPage?: boolean;
    backgroundUrl?: string;
    files?: { background?: { url?: string } };
    tapFill?: ColoringTapFill;
}

const DEFAULT_COLORING_PALETTE = [
    '#E74C3C', // red
    '#E67E22', // orange
    '#F1C40F', // yellow
    '#2ECC71', // green
    '#3498DB', // blue
    '#9B59B6', // purple
    '#E91E63', // magenta
    '#1ABC9C', // teal
    '#87CEEB', // light blue
    '#FFB6C1', // pink
    '#8BC34A', // lime
    '#1B4F72', // navy
    '#FFAB91', // peach
    '#95A5A6', // gray
    '#2C3E50', // black
    '#FFFFFF', // white
    '#8D6E63', // brown
    '#D4AF37', // gold
    '#C0C0C0', // silver
    '#CD7F32', // bronze
];

interface StoryFormState {
    islandId: string;
    order: number;
    title: string;
    displayTitle: string;
    scriptureRef: string;
    verse: string;
    verseRef: string;
    heroImageUrl: string;
    introVideoUrl: string;
    sceneBgVideoUrl: string;
    sceneMusicUrl: string;
    status: 'draft' | 'published' | 'archived';
    bookId: string | null;
    quizMode: 'book_quiz' | 'custom' | 'none';
    quizLevels: QuizLevelsState;
    quizDefaultLevel: QuizLevel;
    coloringPageIds: string[];
    puzzleEnabled: boolean;
    puzzleType: 'sliding_image' | 'scripture_words' | 'none';
    puzzleImageUrl: string;
    puzzleDifficulties: Array<'easy' | 'medium' | 'hard'>;
    puzzleDefaultDifficulty: 'easy' | 'medium' | 'hard';
    puzzleVerseText: string;
    puzzleVerseRef: string;
    gameEnabled: boolean;
    gameKind: 'catalog' | 'webview' | 'none';
    gameId: string;
    gameWebviewTitle: string;
    gameWebviewUrl: string;
    gameWebviewCover: string;
    gameWebviewDescription: string;
    sceneLayout: SceneLayout;
    sceneAnimations: SceneAnimation[];
    sceneTriggers: SceneTrigger[];
}

interface CatalogGame {
    _id: string;
    gameId: string;
    name: string;
    enabled?: boolean;
}

const TABS: { id: PackTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'scene', label: 'Scene', icon: Clapperboard },
    { id: 'book', label: 'Book', icon: BookOpen },
    { id: 'puzzle', label: 'Puzzle', icon: Puzzle },
    { id: 'coloring', label: 'Coloring', icon: Palette },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'game', label: 'Game', icon: Gamepad2 },
];

const emptyForm = (islandId = ''): StoryFormState => ({
    islandId,
    order: 1,
    title: '',
    displayTitle: '',
    scriptureRef: '',
    verse: '',
    verseRef: '',
    heroImageUrl: '',
    introVideoUrl: '',
    sceneBgVideoUrl: '',
    sceneMusicUrl: '',
    status: 'draft',
    bookId: null,
    quizMode: 'book_quiz',
    quizLevels: emptyQuizLevels(),
    quizDefaultLevel: 'easy',
    coloringPageIds: [],
    puzzleEnabled: false,
    puzzleType: 'sliding_image',
    puzzleImageUrl: '',
    puzzleDifficulties: ['easy', 'medium', 'hard'],
    puzzleDefaultDifficulty: 'easy',
    puzzleVerseText: '',
    puzzleVerseRef: '',
    gameEnabled: false,
    gameKind: 'none',
    gameId: '',
    gameWebviewTitle: '',
    gameWebviewUrl: '',
    gameWebviewCover: '',
    gameWebviewDescription: '',
    sceneLayout: emptySceneLayout(),
    sceneAnimations: [],
    sceneTriggers: [],
});

const BibleMapStoryForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();

    const initialTab = (searchParams.get('tab') as PackTab | null) || 'overview';
    const [tab, setTab] = useState<PackTab>(
        TABS.some((t) => t.id === initialTab) ? initialTab : 'overview',
    );
    const [form, setForm] = useState<StoryFormState>(() =>
        emptyForm(searchParams.get('islandId') || ''),
    );
    const [islands, setIslands] = useState<IslandOption[]>([]);
    const [bibleMapBooks, setBibleMapBooks] = useState<BookOption[]>([]);
    const [coloringPages, setColoringPages] = useState<ColoringPage[]>([]);
    const [games, setGames] = useState<CatalogGame[]>([]);
    const [linkedBook, setLinkedBook] = useState<BookOption | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [creatingBook, setCreatingBook] = useState(false);
    const [uploadingPuzzleImage, setUploadingPuzzleImage] = useState(false);
    const [uploadingColoring, setUploadingColoring] = useState(false);
    const [previewColoringId, setPreviewColoringId] = useState<string | null>(null);
    const [savingPalette, setSavingPalette] = useState(false);

    const update = <K extends keyof StoryFormState>(key: K, value: StoryFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const togglePuzzleDifficulty = (level: 'easy' | 'medium' | 'hard') => {
        setForm((prev) => {
            const has = prev.puzzleDifficulties.includes(level);
            let next = has
                ? prev.puzzleDifficulties.filter((d) => d !== level)
                : [...prev.puzzleDifficulties, level];
            if (next.length === 0) next = [level];
            const defaultDifficulty = next.includes(prev.puzzleDefaultDifficulty)
                ? prev.puzzleDefaultDifficulty
                : next[0];
            return { ...prev, puzzleDifficulties: next, puzzleDefaultDifficulty: defaultDifficulty };
        });
    };

    const handlePuzzleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/i) && !/\.(png|jpe?g)$/i.test(file.name)) {
            alert('Please upload a PNG or JPG image');
            return;
        }
        setUploadingPuzzleImage(true);
        try {
            const island = islands.find((i) => i._id === form.islandId);
            const islandKey = island?.slug || form.islandId || id || 'temp';
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post(
                `/api/upload/image?bookId=bible-map&type=puzzle-image&islandId=${encodeURIComponent(islandKey)}`,
                formData,
            );
            update('puzzleImageUrl', res.data.url as string);
            if (!form.puzzleEnabled) update('puzzleEnabled', true);
            if (form.puzzleType === 'none') update('puzzleType', 'sliding_image');
        } catch (err) {
            console.error(err);
            alert('Failed to upload puzzle image');
        } finally {
            setUploadingPuzzleImage(false);
        }
    };

    const uploadSceneVideo = async (
        file: File,
        kind: 'intro' | 'scene-bg' | 'scene-anim',
    ): Promise<string> => {
        const island = islands.find((i) => i._id === form.islandId);
        const islandKey = island?.slug || form.islandId || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/video?bookId=bible-map&type=${kind}&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const uploadSceneMusic = async (file: File): Promise<string> => {
        const island = islands.find((i) => i._id === form.islandId);
        const islandKey = island?.slug || form.islandId || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/audio?bookId=bible-map&type=scene-music&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const handleColoringLineArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
            alert('Please upload a PNG, JPG, or WebP line-art image');
            return;
        }
        setUploadingColoring(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            // Optional: attach to linked book when present; otherwise standalone pack page
            if (form.bookId) {
                formData.append('bookId', form.bookId);
            }
            const res = await apiClient.post('/api/bible-map/coloring/preprocess', formData);
            const page = res.data.page as ColoringPage;
            setColoringPages((prev) => {
                const without = prev.filter((p) => p._id !== page._id);
                return [...without, page].sort((a, b) => a.pageNumber - b.pageNumber);
            });
            setForm((prev) => ({
                ...prev,
                coloringPageIds: prev.coloringPageIds.includes(page._id)
                    ? prev.coloringPageIds
                    : [...prev.coloringPageIds, page._id],
            }));
            setPreviewColoringId(page._id);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to preprocess coloring page';
            alert(msg);
        } finally {
            setUploadingColoring(false);
        }
    };

    const updatePreviewPalette = async (pageId: string, palette: string[]) => {
        setSavingPalette(true);
        try {
            const res = await apiClient.patch(`/api/bible-map/coloring/pages/${pageId}`, {
                palette,
            });
            const page = res.data.page as ColoringPage;
            setColoringPages((prev) =>
                prev.map((p) => (p._id === pageId ? { ...p, tapFill: page.tapFill } : p)),
            );
        } catch (err) {
            console.error(err);
            alert('Failed to save palette');
        } finally {
            setSavingPalette(false);
        }
    };

    const loadMeta = useCallback(async () => {
        const [islandsRes, booksRes, gamesRes] = await Promise.all([
            apiClient.get('/api/bible-map/islands?status=all'),
            apiClient.get('/api/books?status=all&bookType=bible_map&limit=200'),
            apiClient.get('/api/games'),
        ]);
        setIslands(Array.isArray(islandsRes.data) ? islandsRes.data : []);
        const booksPayload = booksRes.data;
        const booksList = Array.isArray(booksPayload)
            ? booksPayload
            : booksPayload?.books || booksPayload?.data || [];
        setBibleMapBooks(booksList);
        const gamesData = Array.isArray(gamesRes.data)
            ? gamesRes.data
            : gamesRes.data?.data || gamesRes.data?.games || [];
        setGames(gamesData);
    }, []);

    useEffect(() => {
        void loadMeta().catch((err) => console.error('Failed to load meta', err));
    }, [loadMeta]);

    useEffect(() => {
        if (isNew) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const res = await apiClient.get(`/api/bible-map/stories/${id}`);
                const story = res.data.story;
                setColoringPages(res.data.coloringPages || []);
                const book =
                    story.bookId && typeof story.bookId === 'object' ? story.bookId : null;
                setLinkedBook(book);
                setForm({
                    islandId:
                        typeof story.islandId === 'object'
                            ? story.islandId._id
                            : story.islandId || '',
                    order: story.order ?? 1,
                    title: story.title || '',
                    displayTitle: story.displayTitle || '',
                    scriptureRef: story.scriptureRef || '',
                    verse: story.verse || '',
                    verseRef: story.verseRef || '',
                    heroImageUrl: story.heroImageUrl || '',
                    introVideoUrl: story.introVideoUrl || '',
                    sceneBgVideoUrl: story.sceneBgVideoUrl || '',
                    sceneMusicUrl: story.sceneMusicUrl || '',
                    status: story.status || 'draft',
                    bookId: book?._id || (typeof story.bookId === 'string' ? story.bookId : null),
                    quizMode: story.quizMode || 'book_quiz',
                    quizLevels: (() => {
                        const fromLevels = story.quiz?.levels;
                        const normalize = (list: QuizQuestion[] | undefined): QuizQuestion[] =>
                            (Array.isArray(list) ? list : []).map((q) => ({
                                question: q.question || '',
                                options:
                                    Array.isArray(q.options) && q.options.length
                                        ? [...q.options, '', '', '', ''].slice(0, 4)
                                        : ['', '', '', ''],
                                correctIndex:
                                    typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                                explanation: q.explanation || '',
                            }));
                        const easy = normalize(fromLevels?.easy);
                        const medium = normalize(fromLevels?.medium);
                        const hard = normalize(fromLevels?.hard);
                        if (easy.length || medium.length || hard.length) {
                            return { easy, medium, hard };
                        }
                        // Legacy flat customQuestions → easy
                        return {
                            easy: normalize(story.customQuestions),
                            medium: [],
                            hard: [],
                        };
                    })(),
                    quizDefaultLevel:
                        story.quiz?.defaultLevel === 'medium' ||
                        story.quiz?.defaultLevel === 'hard'
                            ? story.quiz.defaultLevel
                            : 'easy',
                    coloringPageIds: (story.coloringPageIds || []).map((p: { _id?: string } | string) =>
                        typeof p === 'object' && p?._id ? p._id : String(p),
                    ),
                    puzzleEnabled: !!story.puzzle?.enabled,
                    puzzleType:
                        story.puzzle?.type === 'scripture_words'
                            ? 'scripture_words'
                            : story.puzzle?.type === 'none'
                              ? 'none'
                              : 'sliding_image',
                    puzzleImageUrl: story.puzzle?.imageUrl || '',
                    puzzleDifficulties:
                        Array.isArray(story.puzzle?.difficulties) &&
                        story.puzzle.difficulties.length > 0
                            ? story.puzzle.difficulties
                            : ['easy', 'medium', 'hard'],
                    puzzleDefaultDifficulty: story.puzzle?.defaultDifficulty || 'easy',
                    puzzleVerseText: story.puzzle?.verseText || '',
                    puzzleVerseRef: story.puzzle?.verseRef || '',
                    gameEnabled: !!story.game?.enabled,
                    gameKind: story.game?.kind || 'none',
                    gameId: story.game?.gameId || '',
                    gameWebviewTitle: story.game?.webview?.title || '',
                    gameWebviewUrl: story.game?.webview?.url || '',
                    gameWebviewCover: story.game?.webview?.coverImage || '',
                    gameWebviewDescription: story.game?.webview?.description || '',
                    sceneLayout: normalizeLoadedLayout(story.sceneLayout),
                    sceneAnimations: Array.isArray(story.sceneAnimations)
                        ? story.sceneAnimations
                              .filter(
                                  (a: SceneAnimation) =>
                                      a && typeof a === 'object' && a.id && a.videoUrl,
                              )
                              .map((a: SceneAnimation) => ({
                                  id: String(a.id),
                                  label: String(a.label || ''),
                                  videoUrl: String(a.videoUrl),
                              }))
                        : [],
                    sceneTriggers: Array.isArray(story.sceneTriggers)
                        ? story.sceneTriggers
                              .filter(
                                  (t: SceneTrigger) =>
                                      t && typeof t === 'object' && t.id && t.fromButtonId,
                              )
                              .map((t: SceneTrigger) => ({
                                  id: String(t.id),
                                  fromButtonId: String(t.fromButtonId),
                                  animationId: String(t.animationId || ''),
                                  after: t.after === 'stay' ? 'stay' : 'navigate',
                                  navigateTo:
                                      t.navigateTo === 'read' ||
                                      t.navigateTo === 'quiz' ||
                                      t.navigateTo === 'puzzle' ||
                                      t.navigateTo === 'coloring' ||
                                      t.navigateTo === 'game'
                                          ? t.navigateTo
                                          : '',
                              }))
                        : [],
                });
            } catch (err) {
                console.error(err);
                alert('Failed to load story pack');
                navigate('/bible-map?tab=stories');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [id, isNew, navigate]);

    // When book link changes, merge that book's coloring pages with pack-attached ones
    useEffect(() => {
        const bookId = form.bookId;
        if (!bookId) {
            // Keep standalone / pack-attached coloring pages; do not wipe
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                const pages = Array.isArray(res.data) ? res.data : [];
                if (!cancelled) {
                    const fromBook = pages.filter((p: ColoringPage) => p.isColoringPage);
                    setColoringPages((prev) => {
                        const bookIds = new Set(fromBook.map((p) => p._id));
                        const extras = prev.filter((p) => !bookIds.has(p._id));
                        return [...extras, ...fromBook].sort(
                            (a, b) => a.pageNumber - b.pageNumber,
                        );
                    });
                    const book = bibleMapBooks.find((b) => b._id === bookId) || linkedBook;
                    if (book) setLinkedBook(book);
                }
            } catch (err) {
                console.error('Failed to load pages for coloring', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [form.bookId, bibleMapBooks, linkedBook]);

    const readiness = useMemo(
        () => ({
            book: !!form.bookId,
            puzzle:
                form.puzzleEnabled &&
                (form.puzzleType === 'sliding_image'
                    ? !!form.puzzleImageUrl.trim()
                    : form.puzzleType === 'scripture_words'
                      ? !!form.puzzleVerseText.trim()
                      : false),
            coloring: form.coloringPageIds.length > 0,
            quiz:
                form.quizMode === 'book_quiz'
                    ? !!form.bookId
                    : form.quizMode === 'custom'
                      ? ['easy', 'medium', 'hard'].some(
                            (l) =>
                                form.quizLevels[l as QuizLevel].filter((q) =>
                                    q.question.trim(),
                                ).length > 0,
                        )
                      : false,
            game: form.gameEnabled && form.gameKind !== 'none',
        }),
        [form],
    );

    const buildPayload = () => ({
        islandId: form.islandId,
        order: form.order,
        title: form.title.trim(),
        displayTitle:
            form.displayTitle.trim() ||
            `${form.order}. ${form.title.trim().toUpperCase()}`,
        scriptureRef: form.scriptureRef.trim(),
        verse: form.verse.trim(),
        verseRef: form.verseRef.trim(),
        heroImageUrl: form.heroImageUrl.trim() || undefined,
        introVideoUrl: form.introVideoUrl.trim() || undefined,
        sceneBgVideoUrl: form.sceneBgVideoUrl.trim() || undefined,
        sceneMusicUrl: form.sceneMusicUrl.trim() || null,
        status: form.status,
        bookId: form.bookId || null,
        quizMode: form.quizMode,
        quiz:
            form.quizMode === 'custom'
                ? {
                      defaultLevel: form.quizDefaultLevel,
                      levels: {
                          easy: form.quizLevels.easy.filter((q) => q.question.trim()),
                          medium: form.quizLevels.medium.filter((q) => q.question.trim()),
                          hard: form.quizLevels.hard.filter((q) => q.question.trim()),
                      },
                  }
                : { defaultLevel: form.quizDefaultLevel, levels: emptyQuizLevels() },
        customQuestions:
            form.quizMode === 'custom'
                ? form.quizLevels.easy.filter((q) => q.question.trim())
                : [],
        coloringPageIds: form.coloringPageIds,
        puzzle: {
            enabled: form.puzzleEnabled,
            type: form.puzzleEnabled
                ? form.puzzleType === 'scripture_words'
                    ? 'scripture_words'
                    : 'sliding_image'
                : 'none',
            imageUrl: form.puzzleImageUrl.trim() || undefined,
            difficulties: form.puzzleDifficulties,
            defaultDifficulty: form.puzzleDefaultDifficulty,
            verseText: form.puzzleVerseText,
            verseRef: form.puzzleVerseRef || form.verseRef,
        },
        sceneLayout: form.sceneLayout,
        sceneAnimations: form.sceneAnimations.filter((a) => a.id && a.videoUrl),
        sceneTriggers: form.sceneTriggers.filter((t) => t.id && t.fromButtonId),
        game: {
            enabled: form.gameEnabled,
            kind: form.gameEnabled ? form.gameKind : 'none',
            gameId: form.gameKind === 'catalog' ? form.gameId : undefined,
            webview:
                form.gameKind === 'webview'
                    ? {
                          title: form.gameWebviewTitle,
                          url: form.gameWebviewUrl,
                          coverImage: form.gameWebviewCover,
                          description: form.gameWebviewDescription,
                      }
                    : undefined,
        },
    });

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!form.islandId || !form.title.trim()) {
            alert('Island and title are required');
            setTab('overview');
            return;
        }
        setSaving(true);
        try {
            const payload = buildPayload();
            if (isNew) {
                const res = await apiClient.post('/api/bible-map/stories', payload);
                const tabQuery = tab !== 'overview' ? `?tab=${tab}` : '';
                navigate(`/bible-map/stories/${res.data._id}${tabQuery}`);
            } else {
                const res = await apiClient.put(`/api/bible-map/stories/${id}`, payload);
                const book =
                    res.data.bookId && typeof res.data.bookId === 'object'
                        ? res.data.bookId
                        : linkedBook;
                setLinkedBook(book);
                alert('Story pack saved');
            }
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to save story pack';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateBook = async () => {
        if (isNew) {
            alert('Save the story pack first, then create a book.');
            return;
        }
        setCreatingBook(true);
        try {
            const res = await apiClient.post(`/api/bible-map/stories/${id}/create-book`, {
                title: form.title,
            });
            const story = res.data.story;
            const book = res.data.book;
            setLinkedBook(book);
            update('bookId', book._id);
            setBibleMapBooks((prev) => [book, ...prev]);
            if (story) {
                // refresh linked book from populated story
            }
            alert('Draft Bible Map book created and linked.');
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to create book';
            alert(msg);
        } finally {
            setCreatingBook(false);
        }
    };

    const toggleColoringPage = (pageId: string) => {
        setForm((prev) => {
            const has = prev.coloringPageIds.includes(pageId);
            return {
                ...prev,
                coloringPageIds: has
                    ? prev.coloringPageIds.filter((x) => x !== pageId)
                    : [...prev.coloringPageIds, pageId],
            };
        });
    };

    if (loading) {
        return <div className="text-gray-500 py-12 text-center">Loading story pack…</div>;
    }

    const saveLabel = saving ? 'Saving…' : isNew ? 'Create Pack' : 'Save Pack';

    return (
        <div className="max-w-5xl">
            <Link
                to="/bible-map?tab=stories"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 mb-4"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Story Packs
            </Link>

            {/* Sticky so Save stays visible while scrolling tabs (main is overflow-y-auto). */}
            <div className="sticky top-0 z-20 -mx-2 px-2 py-3 mb-4 bg-gray-100/95 backdrop-blur-sm border-b border-gray-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isNew
                                ? 'New Story Pack'
                                : form.displayTitle || form.title || 'Edit Story Pack'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Bundle Read + Puzzle + Coloring + Quiz + Game for one map adventure.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0 shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {saveLabel}
                    </button>
                </div>
            </div>

            {/* Readiness strip */}
            <div className="flex flex-wrap gap-2 mb-4">
                {(
                    [
                        ['book', 'Read'],
                        ['puzzle', 'Puzzle'],
                        ['coloring', 'Coloring'],
                        ['quiz', 'Quiz'],
                        ['game', 'Game'],
                    ] as const
                ).map(([key, label]) => (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                            readiness[key]
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {readiness[key] && <Check className="w-3 h-3" />}
                        {label}
                    </span>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
                {TABS.map(({ id: tabId, label, icon: Icon }) => (
                    <button
                        key={tabId}
                        type="button"
                        onClick={() => setTab(tabId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                            tab === tabId
                                ? 'border-emerald-600 text-emerald-700'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
                {tab === 'overview' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Island
                                </label>
                                <select
                                    value={form.islandId}
                                    onChange={(e) => update('islandId', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                    required
                                >
                                    <option value="">Select island…</option>
                                    {islands.map((i) => (
                                        <option key={i._id} value={i._id}>
                                            {i.title} (/{i.slug})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Order on island
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.order}
                                    onChange={(e) =>
                                        update('order', parseInt(e.target.value, 10) || 1)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    value={form.title}
                                    onChange={(e) => update('title', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="The Beginning"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display title
                                </label>
                                <input
                                    value={form.displayTitle}
                                    onChange={(e) => update('displayTitle', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="1. THE BEGINNING"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Scripture ref
                                </label>
                                <input
                                    value={form.scriptureRef}
                                    onChange={(e) => update('scriptureRef', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="Genesis 1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={form.status}
                                    onChange={(e) =>
                                        update(
                                            'status',
                                            e.target.value as StoryFormState['status'],
                                        )
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Spotlight verse
                            </label>
                            <textarea
                                value={form.verse}
                                onChange={(e) => update('verse', e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                placeholder="In the beginning God created the heavens and the earth."
                            />
                            <input
                                value={form.verseRef}
                                onChange={(e) => update('verseRef', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2"
                                placeholder="Genesis 1:1"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hero image URL
                                </label>
                                <input
                                    value={form.heroImageUrl}
                                    onChange={(e) => update('heroImageUrl', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-end">
                                <button
                                    type="button"
                                    onClick={() => setTab('scene')}
                                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                                >
                                    <Clapperboard className="w-4 h-4" />
                                    Open Scene Studio to upload videos, place buttons, and wire
                                    animations
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'scene' && (
                    <SceneStudio
                        sceneTitle={form.displayTitle}
                        introVideoUrl={form.introVideoUrl}
                        sceneBgVideoUrl={form.sceneBgVideoUrl}
                        sceneMusicUrl={form.sceneMusicUrl}
                        sceneLayout={form.sceneLayout}
                        sceneAnimations={form.sceneAnimations}
                        sceneTriggers={form.sceneTriggers}
                        onSceneTitle={(title) => update('displayTitle', title)}
                        onIntroVideoUrl={(url) => update('introVideoUrl', url)}
                        onSceneBgVideoUrl={(url) => update('sceneBgVideoUrl', url)}
                        onSceneMusicUrl={(url) => update('sceneMusicUrl', url)}
                        onSceneLayout={(layout) => update('sceneLayout', layout)}
                        onSceneAnimations={(anims) => update('sceneAnimations', anims)}
                        onSceneTriggers={(triggers) => update('sceneTriggers', triggers)}
                        onUploadVideo={uploadSceneVideo}
                        onUploadMusic={uploadSceneMusic}
                    />
                )}

                {tab === 'book' && (
                    <div className="space-y-5">
                        {isNew ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900 space-y-4">
                                <div>
                                    <p className="font-medium">
                                        Create this story pack before building age-leveled pages.
                                    </p>
                                    <p className="mt-1 text-amber-800/90">
                                        Use <span className="font-semibold">Create Pack</span> in
                                        the sticky bar at the top, or create it here. Island and
                                        Title are required (Overview tab).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Creating…' : 'Create Pack'}
                                </button>
                            </div>
                        ) : (
                            <>
                                {form.bookId && linkedBook && (
                                    <div className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-900 truncate">
                                                {linkedBook.title}
                                            </div>
                                            <div className="text-xs text-gray-500 capitalize">
                                                {linkedBook.status} · bible_map
                                            </div>
                                        </div>
                                        <Link
                                            to={`/books/edit/${form.bookId}`}
                                            className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                                        >
                                            Book settings
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                update('bookId', null);
                                                setLinkedBook(null);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-600 text-xs hover:bg-red-50"
                                        >
                                            <Unlink className="w-3.5 h-3.5" />
                                            Unlink
                                        </button>
                                    </div>
                                )}

                                {!form.bookId && (
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Or link an existing Bible Map book
                                        </label>
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const val = e.target.value || null;
                                                if (!val) return;
                                                update('bookId', val);
                                                setLinkedBook(
                                                    bibleMapBooks.find((b) => b._id === val) ||
                                                        null,
                                                );
                                            }}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                        >
                                            <option value="">— Select book —</option>
                                            {bibleMapBooks.map((b) => (
                                                <option key={b._id} value={b._id}>
                                                    {b.title} ({b.status})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <BibleMapBookBuilder
                                    storyId={id!}
                                    bookId={form.bookId}
                                    packTitle={form.displayTitle || form.title}
                                    scriptureRef={form.scriptureRef}
                                    verse={form.verse}
                                    creatingBook={creatingBook}
                                    onCreateBook={handleCreateBook}
                                    onBookLinked={(bid, book) => {
                                        update('bookId', bid);
                                        if (book) {
                                            setLinkedBook({
                                                _id: book._id,
                                                title: book.title,
                                                status: book.status,
                                                bookType: 'bible_map',
                                            });
                                        } else {
                                            const found = bibleMapBooks.find((b) => b._id === bid);
                                            if (found) setLinkedBook(found);
                                        }
                                    }}
                                />
                            </>
                        )}
                    </div>
                )}

                {tab === 'puzzle' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.puzzleEnabled}
                                onChange={(e) => {
                                    update('puzzleEnabled', e.target.checked);
                                    if (e.target.checked && form.puzzleType === 'none') {
                                        update('puzzleType', 'sliding_image');
                                    }
                                }}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">
                                Enable sliding picture puzzle
                            </span>
                        </label>
                        <p className="text-sm text-gray-500">
                            Kids slide image tiles into place. Easy = 3×3, Medium = 4×4, Hard = 5×5.
                            App route: /sail/{'{island}'}/lesson/puzzle
                        </p>
                        {form.puzzleEnabled && (
                            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                                <div className="space-y-5 min-w-0">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Puzzle image (PNG / JPG)
                                        </label>
                                        {form.puzzleImageUrl ? (
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={getMediaUrl(form.puzzleImageUrl)}
                                                    alt="Puzzle thumbnail"
                                                    className="w-40 h-40 object-cover rounded-lg border border-gray-200"
                                                />
                                                <div className="space-y-2">
                                                    <label className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                                                            className="hidden"
                                                            onChange={(e) => void handlePuzzleImageUpload(e)}
                                                            disabled={uploadingPuzzleImage}
                                                        />
                                                        {uploadingPuzzleImage ? 'Uploading…' : 'Replace image'}
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="block text-xs text-red-600 hover:underline"
                                                        onClick={() => update('puzzleImageUrl', '')}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40">
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                                                    className="hidden"
                                                    onChange={(e) => void handlePuzzleImageUpload(e)}
                                                    disabled={uploadingPuzzleImage}
                                                />
                                                <span className="text-sm text-gray-600">
                                                    {uploadingPuzzleImage
                                                        ? 'Uploading…'
                                                        : 'Click to upload puzzle image'}
                                                </span>
                                                <span className="text-xs text-gray-400 mt-1">
                                                    Square images work best
                                                </span>
                                            </label>
                                        )}
                                        <input
                                            type="url"
                                            value={form.puzzleImageUrl}
                                            onChange={(e) => update('puzzleImageUrl', e.target.value)}
                                            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Or paste image URL…"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Available difficulties
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {(
                                                [
                                                    ['easy', 'Easy (3×3)'],
                                                    ['medium', 'Medium (4×4)'],
                                                    ['hard', 'Hard (5×5)'],
                                                ] as const
                                            ).map(([level, label]) => (
                                                <label
                                                    key={level}
                                                    className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={form.puzzleDifficulties.includes(level)}
                                                        onChange={() => togglePuzzleDifficulty(level)}
                                                        className="w-4 h-4 text-emerald-600 rounded"
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Default difficulty
                                        </label>
                                        <select
                                            value={form.puzzleDefaultDifficulty}
                                            onChange={(e) =>
                                                update(
                                                    'puzzleDefaultDifficulty',
                                                    e.target.value as 'easy' | 'medium' | 'hard',
                                                )
                                            }
                                            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2"
                                        >
                                            {form.puzzleDifficulties.map((d) => (
                                                <option key={d} value={d}>
                                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="lg:sticky lg:top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                                    <SlidingPuzzlePreview
                                        imageUrl={
                                            form.puzzleImageUrl
                                                ? getMediaUrl(form.puzzleImageUrl)
                                                : ''
                                        }
                                        title={form.displayTitle || form.title || 'PUZZLE'}
                                        difficulties={form.puzzleDifficulties}
                                        defaultDifficulty={form.puzzleDefaultDifficulty}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'coloring' && (
                    <div className="space-y-5">
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 space-y-1">
                            <p className="font-medium">Tap-to-fill line art guidelines</p>
                            <ul className="list-disc pl-5 text-xs text-sky-800 space-y-0.5">
                                <li>Closed black outlines with white interiors (no gaps in lines).</li>
                                <li>Avoid gray fills or open shapes — regions are auto-detected from white areas.</li>
                                <li>PNG preferred. Kids tap a region to fill; no freehand for this mode.</li>
                            </ul>
                            <p className="text-xs text-sky-700 pt-1">
                                App route: /sail/{'{island}'}/lesson/coloring
                            </p>
                        </div>

                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                            <div className="space-y-5 min-w-0">
                                <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                                    <label className="flex flex-col items-center gap-2 cursor-pointer">
                                        <span className="text-sm font-medium text-gray-800">
                                            {uploadingColoring
                                                ? 'Segmenting regions…'
                                                : 'Upload line art (auto-segment)'}
                                        </span>
                                        <span className="text-xs text-gray-500 text-center max-w-md">
                                            Creates a tap-fill coloring page with a region map +
                                            default palette, and adds it to this pack. No book
                                            link required.
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                                            className="hidden"
                                            disabled={uploadingColoring}
                                            onChange={(e) => void handleColoringLineArtUpload(e)}
                                        />
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                                            <Plus className="w-4 h-4" />
                                            {uploadingColoring ? 'Working…' : 'Choose image'}
                                        </span>
                                    </label>
                                </div>

                                {coloringPages.length === 0 ? (
                                    <p className="text-sm text-gray-600">
                                        No coloring pages yet. Upload line art above to create one.
                                    </p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {coloringPages.map((page) => {
                                            const selected = form.coloringPageIds.includes(
                                                page._id,
                                            );
                                            const tap =
                                                page.tapFill?.enabled && page.tapFill.regionMapUrl;
                                            const thumb =
                                                page.tapFill?.regionPreviewUrl ||
                                                page.files?.background?.url ||
                                                page.backgroundUrl;
                                            return (
                                                <div
                                                    key={page._id}
                                                    className={`rounded-lg border p-3 transition ${
                                                        selected
                                                            ? 'border-emerald-500 bg-emerald-50'
                                                            : 'border-gray-200'
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            toggleColoringPage(page._id);
                                                            if (tap) setPreviewColoringId(page._id);
                                                        }}
                                                        className="flex items-center gap-3 w-full text-left"
                                                    >
                                                        {thumb ? (
                                                            <img
                                                                src={getMediaUrl(thumb)}
                                                                alt=""
                                                                className="w-12 h-16 object-cover rounded"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                                                                P{page.pageNumber}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-gray-900">
                                                                {page.bookId
                                                                    ? `Page ${page.pageNumber}`
                                                                    : `Coloring ${page.pageNumber}`}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {tap
                                                                    ? `Tap-fill · ${page.tapFill?.regionCount ?? 0} regions`
                                                                    : 'Freehand (no region map)'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {selected
                                                                    ? 'Included in pack'
                                                                    : 'Click to include'}
                                                            </div>
                                                        </div>
                                                        {selected && (
                                                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                    {tap && (
                                                        <button
                                                            type="button"
                                                            className="mt-2 text-xs text-indigo-600 hover:underline"
                                                            onClick={() =>
                                                                setPreviewColoringId(page._id)
                                                            }
                                                        >
                                                            {previewColoringId === page._id
                                                                ? 'Showing in phone →'
                                                                : 'Show in phone / edit palette'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {(() => {
                                    const page =
                                        coloringPages.find((p) => p._id === previewColoringId) ||
                                        coloringPages.find(
                                            (p) =>
                                                form.coloringPageIds.includes(p._id) &&
                                                p.tapFill?.enabled &&
                                                p.tapFill.regionMapUrl,
                                        );
                                    if (!page?.tapFill?.regionMapUrl) return null;
                                    const palette =
                                        page.tapFill.palette && page.tapFill.palette.length > 0
                                            ? page.tapFill.palette
                                            : DEFAULT_COLORING_PALETTE;
                                    return (
                                        <div className="space-y-4 border-t border-gray-200 pt-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm font-medium text-gray-800">
                                                        Palette
                                                        {page.bookId
                                                            ? ` (page ${page.pageNumber})`
                                                            : ''}
                                                    </label>
                                                    {savingPalette && (
                                                        <span className="text-xs text-gray-500">
                                                            Saving…
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    {palette.map((c, i) => (
                                                        <label
                                                            key={`${page._id}-${i}`}
                                                            className="relative w-9 h-9 rounded-full border border-gray-300 overflow-hidden cursor-pointer"
                                                            style={{ backgroundColor: c }}
                                                            title={c}
                                                        >
                                                            <input
                                                                type="color"
                                                                value={
                                                                    /^#[0-9a-fA-F]{6}$/.test(c)
                                                                        ? c
                                                                        : '#E74C3C'
                                                                }
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                                onChange={(ev) => {
                                                                    const next = [...palette];
                                                                    next[i] = ev.target.value;
                                                                    void updatePreviewPalette(
                                                                        page._id,
                                                                        next,
                                                                    );
                                                                }}
                                                            />
                                                        </label>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                                        onClick={() =>
                                                            void updatePreviewPalette(
                                                                page._id,
                                                                [...palette, '#95A5A6'].slice(
                                                                    0,
                                                                    16,
                                                                ),
                                                            )
                                                        }
                                                        disabled={palette.length >= 16}
                                                    >
                                                        + color
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                                        onClick={() =>
                                                            void updatePreviewPalette(
                                                                page._id,
                                                                DEFAULT_COLORING_PALETTE,
                                                            )
                                                        }
                                                    >
                                                        Reset default
                                                    </button>
                                                </div>
                                            </div>
                                            {page.tapFill.regionPreviewUrl && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">
                                                        Detected regions (auto-colored)
                                                    </p>
                                                    <img
                                                        src={getMediaUrl(
                                                            page.tapFill.regionPreviewUrl,
                                                        )}
                                                        alt="Region preview"
                                                        className="max-w-xs w-full rounded border border-gray-200 bg-white"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="lg:sticky lg:top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                                {(() => {
                                    const page =
                                        coloringPages.find((p) => p._id === previewColoringId) ||
                                        coloringPages.find(
                                            (p) =>
                                                form.coloringPageIds.includes(p._id) &&
                                                p.tapFill?.enabled &&
                                                p.tapFill.regionMapUrl,
                                        );
                                    const lineArt = page
                                        ? page.files?.background?.url || page.backgroundUrl || ''
                                        : '';
                                    const regionMap = page?.tapFill?.regionMapUrl || '';
                                    const palette =
                                        page?.tapFill?.palette && page.tapFill.palette.length > 0
                                            ? page.tapFill.palette
                                            : DEFAULT_COLORING_PALETTE;
                                    return (
                                        <TapFillColoringPreview
                                            lineArtUrl={
                                                lineArt ? getMediaUrl(lineArt) : undefined
                                            }
                                            regionMapUrl={
                                                regionMap ? getMediaUrl(regionMap) : undefined
                                            }
                                            palette={palette}
                                            title={
                                                form.displayTitle || form.title || 'COLORING'
                                            }
                                            regionCount={page?.tapFill?.regionCount}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'quiz' && (
                    <BibleMapQuizPanel
                        quizMode={form.quizMode}
                        onQuizModeChange={(mode) => update('quizMode', mode)}
                        hasBook={!!form.bookId}
                        storyId={!isNew ? id : null}
                        bookId={form.bookId}
                        levels={form.quizLevels}
                        defaultLevel={form.quizDefaultLevel}
                        onLevelsChange={(levels) => update('quizLevels', levels)}
                        onDefaultLevelChange={(level) => update('quizDefaultLevel', level)}
                        packTitle={form.displayTitle || form.title}
                        scriptureRef={form.scriptureRef}
                        verse={form.verse}
                    />
                )}

                {tab === 'game' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.gameEnabled}
                                onChange={(e) => {
                                    update('gameEnabled', e.target.checked);
                                    if (e.target.checked && form.gameKind === 'none') {
                                        update('gameKind', 'catalog');
                                    }
                                }}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">Enable game unlock</span>
                        </label>

                        {form.gameEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Game type
                                    </label>
                                    <select
                                        value={form.gameKind}
                                        onChange={(e) =>
                                            update(
                                                'gameKind',
                                                e.target.value as StoryFormState['gameKind'],
                                            )
                                        }
                                        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                    >
                                        <option value="catalog">Catalog game</option>
                                        <option value="webview">Custom webview URL</option>
                                    </select>
                                </div>

                                {form.gameKind === 'catalog' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Select game
                                        </label>
                                        <select
                                            value={form.gameId}
                                            onChange={(e) => update('gameId', e.target.value)}
                                            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                        >
                                            <option value="">— Choose —</option>
                                            {games
                                                .filter((g) => g.enabled !== false)
                                                .map((g) => (
                                                    <option key={g._id} value={g.gameId}>
                                                        {g.name} ({g.gameId})
                                                    </option>
                                                ))}
                                        </select>
                                        <Link
                                            to="/games"
                                            className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                                        >
                                            Manage games catalog
                                        </Link>
                                    </div>
                                )}

                                {form.gameKind === 'webview' && (
                                    <div className="space-y-3 max-w-xl">
                                        <input
                                            value={form.gameWebviewTitle}
                                            onChange={(e) =>
                                                update('gameWebviewTitle', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Game title"
                                        />
                                        <input
                                            value={form.gameWebviewUrl}
                                            onChange={(e) =>
                                                update('gameWebviewUrl', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="https://game-url…"
                                        />
                                        <input
                                            value={form.gameWebviewCover}
                                            onChange={(e) =>
                                                update('gameWebviewCover', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Cover image URL"
                                        />
                                        <textarea
                                            value={form.gameWebviewDescription}
                                            onChange={(e) =>
                                                update('gameWebviewDescription', e.target.value)
                                            }
                                            rows={2}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Short description"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BibleMapStoryForm;
