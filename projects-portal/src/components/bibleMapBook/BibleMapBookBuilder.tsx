import React, { useCallback, useEffect, useState } from 'react';
import {
    BookOpen,
    ImagePlus,
    Loader2,
    Plus,
    Save,
    Sparkles,
    Trash2,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import BookPageEditor from './BookPageEditor';
import {
    emptyReadingPage,
    pageFromApi,
    type ReadingLevelKey,
    type ReadingPageDraft,
} from './types';

interface BibleMapBookBuilderProps {
    storyId: string;
    bookId: string | null;
    packTitle: string;
    scriptureRef: string;
    verse: string;
    onBookLinked: (bookId: string, book?: { _id: string; title: string; status: string }) => void;
    onCreateBook: () => Promise<void>;
    creatingBook: boolean;
}

interface PortalCharacter {
    _id: string;
    displayName: string;
    referenceImageUrl?: string;
    status?: string;
}

const BibleMapBookBuilder: React.FC<BibleMapBookBuilderProps> = ({
    storyId,
    bookId,
    packTitle,
    scriptureRef,
    verse,
    onBookLinked,
    onCreateBook,
    creatingBook,
}) => {
    const [sourceText, setSourceText] = useState(verse || '');
    const [pageCount, setPageCount] = useState(5);
    const [pages, setPages] = useState<ReadingPageDraft[]>([]);
    const [activePage, setActivePage] = useState(0);
    const [level, setLevel] = useState<ReadingLevelKey>('ages_3_5');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [saving, setSaving] = useState(false);
    const [characters, setCharacters] = useState<PortalCharacter[]>([]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
    const [autoImages, setAutoImages] = useState(true);
    const [imageStatus, setImageStatus] = useState<string | null>(null);

    const loadPages = useCallback(async () => {
        if (!storyId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/api/bible-map/stories/${storyId}/reading-pages`);
            if (res.data.bookId && !bookId) {
                onBookLinked(res.data.bookId, res.data.book);
            }
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : [];
            setPages(list.length ? list : []);
            setActivePage(0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [storyId, bookId, onBookLinked]);

    useEffect(() => {
        void loadPages();
    }, [loadPages]);

    useEffect(() => {
        if (verse && !sourceText) setSourceText(verse);
    }, [verse, sourceText]);

    useEffect(() => {
        const loadChars = async () => {
            try {
                const [charsRes, storyRes] = await Promise.all([
                    apiClient.get('/api/bible-map/characters'),
                    apiClient.get(`/api/bible-map/stories/${storyId}`),
                ]);
                const list = Array.isArray(charsRes.data?.characters)
                    ? charsRes.data.characters
                    : Array.isArray(charsRes.data)
                      ? charsRes.data
                      : [];
                setCharacters(
                    list.filter(
                        (c: PortalCharacter) =>
                            c.referenceImageUrl && String(c.referenceImageUrl).trim(),
                    ),
                );
                const saved = Array.isArray(storyRes.data?.referenceCharacterIds)
                    ? storyRes.data.referenceCharacterIds.map((id: string) => String(id))
                    : [];
                if (saved.length) setSelectedCharacterIds(saved);
            } catch (err) {
                console.error(err);
            }
        };
        void loadChars();
    }, [storyId]);

    const toggleCharacter = (id: string) => {
        setSelectedCharacterIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4),
        );
    };

    const handleGenerate = async () => {
        if (!sourceText.trim()) {
            alert('Paste a source story or scripture first');
            return;
        }
        setGenerating(true);
        setImageStatus(null);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-reading-levels`,
                {
                    sourceText: sourceText.trim(),
                    pageCount,
                    scriptureRef,
                    title: packTitle,
                    referenceCharacterIds: selectedCharacterIds,
                    generateImages: autoImages,
                    onlyMissingImages: true,
                },
                // Image gen can take several minutes
                { timeout: 600000 },
            );
            if (res.data.bookId) {
                onBookLinked(res.data.bookId);
            }
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : [];
            setPages(list);
            setActivePage(0);

            const images = Array.isArray(res.data.images) ? res.data.images : null;
            if (autoImages && images) {
                const ok = images.filter((r: { backgroundUrl?: string; skipped?: boolean }) =>
                    r.backgroundUrl && !r.skipped,
                ).length;
                const skipped = images.filter((r: { skipped?: boolean }) => r.skipped).length;
                const failed = images.filter((r: { error?: string }) => r.error).length;
                setImageStatus(
                    `Images: ${ok} generated${skipped ? `, ${skipped} kept` : ''}${
                        failed ? `, ${failed} failed` : ''
                    }`,
                );
            }

            alert(
                autoImages
                    ? `Generated ${list.length} age-leveled pages + page images`
                    : `Generated ${list.length} pages for all age levels`,
            );
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Generation failed';
            alert(msg);
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateImages = async (onlyMissing: boolean) => {
        if (!bookId && pages.length === 0) {
            alert('Generate age scripts first');
            return;
        }
        setGeneratingImages(true);
        setImageStatus(null);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-page-images`,
                {
                    referenceCharacterIds: selectedCharacterIds,
                    onlyMissing,
                },
                { timeout: 600000 },
            );
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : pages;
            setPages(list);
            const results = Array.isArray(res.data.results) ? res.data.results : [];
            const ok = results.filter((r: { backgroundUrl?: string; error?: string }) =>
                r.backgroundUrl && !r.error,
            ).length;
            const failed = results.filter((r: { error?: string }) => r.error).length;
            setImageStatus(`Images: ${ok} ready${failed ? `, ${failed} failed` : ''}`);
            alert(`Page images updated (${ok} ok${failed ? `, ${failed} failed` : ''})`);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Image generation failed';
            alert(msg);
        } finally {
            setGeneratingImages(false);
        }
    };

    const handleSave = async () => {
        if (!bookId && pages.length === 0) {
            alert('Create a book or generate pages first');
            return;
        }
        setSaving(true);
        try {
            const res = await apiClient.put(`/api/bible-map/stories/${storyId}/reading-pages`, {
                pages: pages.map((p, i) => ({
                    ...p,
                    pageNumber: i + 1,
                })),
            });
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : pages;
            setPages(list);
            if (res.data.bookId) onBookLinked(res.data.bookId);
            alert('Reading pages saved');
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Save failed';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const addPage = () => {
        setPages((prev) => [...prev, emptyReadingPage(prev.length + 1)]);
        setActivePage(pages.length);
    };

    const removePage = (idx: number) => {
        if (pages.length <= 1) {
            setPages([]);
            setActivePage(0);
            return;
        }
        const next = pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, pageNumber: i + 1 }));
        setPages(next);
        setActivePage(Math.min(idx, next.length - 1));
    };

    const characterPicker = (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-violet-900">
                    Character references (for page images)
                </label>
                <label className="text-xs text-violet-800 flex items-center gap-1.5">
                    <input
                        type="checkbox"
                        checked={autoImages}
                        onChange={(e) => setAutoImages(e.target.checked)}
                        className="rounded border-violet-300"
                    />
                    Auto-generate images after scripts
                </label>
            </div>
            {characters.length === 0 ? (
                <p className="text-[11px] text-violet-700/80">
                    No character reference images found. Add them under Kids Monthly character
                    library (reference photo required).
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {characters.map((c) => {
                        const selected = selectedCharacterIds.includes(c._id);
                        return (
                            <button
                                key={c._id}
                                type="button"
                                onClick={() => toggleCharacter(c._id)}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
                                    selected
                                        ? 'border-violet-600 bg-violet-100 text-violet-900'
                                        : 'border-violet-200 bg-white text-gray-700 hover:bg-violet-50'
                                }`}
                            >
                                {c.referenceImageUrl ? (
                                    <img
                                        src={getMediaUrl(c.referenceImageUrl)}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="w-8 h-8 rounded-full bg-violet-200 inline-block" />
                                )}
                                {c.displayName}
                            </button>
                        );
                    })}
                </div>
            )}
            <p className="text-[11px] text-violet-700/80">
                Uses Vertex Gemini flash-image with these reference photos (same path as Kids
                Monthly). Pick up to 4 characters (e.g. Jesus, Noah).
            </p>
            {imageStatus && (
                <p className="text-[11px] text-emerald-800 font-medium">{imageStatus}</p>
            )}
        </div>
    );

    const current = pages[activePage];

    if (!bookId) {
        return (
            <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                    Create a Bible Map book for this story pack, then build age-leveled pages here
                    (shared art, different text for ages 3–5 / 6–7 / 8+).
                </div>
                <button
                    type="button"
                    disabled={creatingBook}
                    onClick={() => void onCreateBook()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                    {creatingBook ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <BookOpen className="w-4 h-4" />
                    )}
                    Create draft Bible Map book
                </button>
                <div className="border-t border-gray-200 pt-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        Or paste a source story and generate — a book will be created automatically,
                        then page images from character references.
                    </p>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        rows={5}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Paste the Bible story or scripture passage…"
                    />
                    {characterPicker}
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs text-gray-600 flex items-center gap-1">
                            Pages
                            <input
                                type="number"
                                min={3}
                                max={12}
                                value={pageCount}
                                onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                                className="w-16 border border-gray-300 rounded px-2 py-1"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={generating}
                            onClick={() => void handleGenerate()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"
                        >
                            {generating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {autoImages ? 'Generate scripts + images' : 'Generate age scripts'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900">Age-leveled book builder</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Shared image/scroll/video per page · text differs for ages 3–5, 6–7, and 8+
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={generatingImages || pages.length === 0}
                        onClick={() => void handleGenerateImages(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-300 text-violet-800 text-xs hover:bg-violet-50 disabled:opacity-50"
                    >
                        {generatingImages ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        Regenerate all images
                    </button>
                    <button
                        type="button"
                        disabled={saving || pages.length === 0}
                        onClick={() => void handleSave()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        Save pages
                    </button>
                </div>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-violet-900">
                    Source story / scripture
                </label>
                <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={4}
                    className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Paste once, then generate all three age scripts…"
                />
                {characterPicker}
                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-violet-800 flex items-center gap-1">
                        Pages
                        <input
                            type="number"
                            min={3}
                            max={12}
                            value={pageCount}
                            onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                            className="w-16 border border-violet-200 rounded px-2 py-1 bg-white"
                        />
                    </label>
                    <button
                        type="button"
                        disabled={generating}
                        onClick={() => void handleGenerate()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"
                    >
                        {generating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {autoImages ? 'Generate scripts + images' : 'Generate age scripts'}
                    </button>
                    <button
                        type="button"
                        disabled={generatingImages || pages.length === 0}
                        onClick={() => void handleGenerateImages(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-300 text-violet-800 text-sm hover:bg-white disabled:opacity-50"
                    >
                        {generatingImages ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ImagePlus className="w-4 h-4" />
                        )}
                        Fill missing images
                    </button>
                </div>
                {(generating || generatingImages) && (
                    <p className="text-xs text-violet-800">
                        {generating
                            ? 'Generating age scripts' +
                              (autoImages ? ', then page images (this can take a few minutes)…' : '…')
                            : 'Generating page images with character references…'}
                    </p>
                )}
            </div>

            {loading ? (
                <div className="text-sm text-gray-500 py-8 text-center">Loading pages…</div>
            ) : pages.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-lg">
                    No pages yet — generate from a source story or add a blank page.
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={addPage}
                            className="inline-flex items-center gap-1 text-indigo-600 text-sm"
                        >
                            <Plus className="w-4 h-4" /> Add page
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        {pages.map((p, i) => (
                            <button
                                key={p._id || i}
                                type="button"
                                onClick={() => setActivePage(i)}
                                className={`px-2.5 py-1 rounded-lg text-xs border ${
                                    i === activePage
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {p.pageNumber}
                                {p.backgroundUrl ? ' · img' : ''}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={addPage}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Page
                        </button>
                        <button
                            type="button"
                            onClick={() => removePage(activePage)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                    </div>

                    {current && (
                        <BookPageEditor
                            page={current}
                            level={level}
                            onLevelChange={setLevel}
                            onChange={(next) =>
                                setPages((prev) =>
                                    prev.map((p, i) => (i === activePage ? next : p)),
                                )
                            }
                            bookId={bookId}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default BibleMapBookBuilder;
