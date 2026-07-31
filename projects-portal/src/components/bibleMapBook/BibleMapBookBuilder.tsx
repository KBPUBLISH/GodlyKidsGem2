import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    ExternalLink,
    Loader2,
    Plus,
    Save,
    Sparkles,
    Trash2,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
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
    const [saving, setSaving] = useState(false);

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

    const handleGenerate = async () => {
        if (!sourceText.trim()) {
            alert('Paste a source story or scripture first');
            return;
        }
        setGenerating(true);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-reading-levels`,
                {
                    sourceText: sourceText.trim(),
                    pageCount,
                    scriptureRef,
                    title: packTitle,
                },
            );
            if (res.data.bookId) {
                onBookLinked(res.data.bookId);
            }
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : [];
            setPages(list);
            setActivePage(0);
            alert(`Generated ${list.length} pages for all age levels`);
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
                <div className="border-t border-gray-200 pt-4 space-y-2">
                    <p className="text-xs text-gray-500">
                        Or paste a source story and generate — a book will be created automatically.
                    </p>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        rows={5}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Paste the Bible story or scripture passage…"
                    />
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
                            Generate age scripts
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
                    <Link
                        to={`/pages/new/${bookId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50"
                    >
                        Advanced editor
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                        to={`/books/read/${bookId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50"
                    >
                        Full preview
                        <ExternalLink className="w-3 h-3" />
                    </Link>
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
                        Generate age scripts
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-sm text-gray-500 py-8 text-center">Loading pages…</div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        {pages.map((p, i) => (
                            <button
                                key={p._id || i}
                                type="button"
                                onClick={() => setActivePage(i)}
                                className={`px-3 py-1.5 rounded-lg text-xs border ${
                                    activePage === i
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Page {i + 1}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={addPage}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add page
                        </button>
                        {pages.length > 0 && (
                            <button
                                type="button"
                                onClick={() => removePage(activePage)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                            </button>
                        )}
                    </div>

                    {current ? (
                        <BookPageEditor
                            page={current}
                            bookId={bookId}
                            level={level}
                            onLevelChange={setLevel}
                            onChange={(next) =>
                                setPages((prev) =>
                                    prev.map((p, i) => (i === activePage ? next : p)),
                                )
                            }
                        />
                    ) : (
                        <p className="text-sm text-gray-500 py-6 text-center">
                            No pages yet — generate from a source story or add a page.
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default BibleMapBookBuilder;
