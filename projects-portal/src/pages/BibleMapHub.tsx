import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Plus,
    Map as MapIcon,
    BookOpen,
    Trash2,
    Edit,
    Sparkles,
    CheckCircle2,
    Circle,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

interface StoryCounts {
    total: number;
    published: number;
}

interface MapIsland {
    _id: string;
    slug: string;
    title: string;
    bookLabel?: string;
    status: 'draft' | 'published' | 'archived';
    order: number;
    unlockRule?: string;
    mapArtUrl?: string;
    storyCounts?: StoryCounts;
}

interface MapStory {
    _id: string;
    title: string;
    displayTitle?: string;
    status: 'draft' | 'published' | 'archived';
    order: number;
    scriptureRef?: string;
    islandId?: { _id: string; slug: string; title: string } | string;
    bookId?: { _id: string; title: string; status: string } | null;
    puzzle?: { enabled?: boolean };
    game?: { enabled?: boolean; kind?: string };
    quizMode?: string;
    coloringPageIds?: string[];
}

type HubTab = 'islands' | 'stories';

const statusBadge = (status: string) => {
    switch (status) {
        case 'published':
            return 'bg-green-100 text-green-800';
        case 'archived':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const activityDot = (ready: boolean, label: string) => (
    <span
        className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
            ready ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'
        }`}
        title={label}
    >
        {ready ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
        {label}
    </span>
);

const BibleMapHub: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = (searchParams.get('tab') as HubTab) || 'islands';

    const [islands, setIslands] = useState<MapIsland[]>([]);
    const [stories, setStories] = useState<MapStory[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [islandFilter, setIslandFilter] = useState<string>('all');

    const setTab = (next: HubTab) => {
        setSearchParams(next === 'islands' ? {} : { tab: next });
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [islandsRes, storiesRes] = await Promise.all([
                apiClient.get('/api/bible-map/islands?status=all'),
                apiClient.get('/api/bible-map/stories?status=all'),
            ]);
            setIslands(Array.isArray(islandsRes.data) ? islandsRes.data : []);
            setStories(Array.isArray(storiesRes.data) ? storiesRes.data : []);
        } catch (err) {
            console.error('Failed to load Bible Map data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSeedDefaults = async () => {
        setSeeding(true);
        try {
            const res = await apiClient.post('/api/bible-map/seed-defaults');
            if (res.data.seeded) {
                alert('Default islands created (Genesis → 1 Samuel).');
            } else {
                alert(res.data.message || 'Islands already exist.');
            }
            await load();
        } catch (err) {
            console.error(err);
            alert('Failed to seed default islands.');
        } finally {
            setSeeding(false);
        }
    };

    const handleDeleteIsland = async (island: MapIsland) => {
        if (
            !window.confirm(
                `Delete island "${island.title}" and all of its stories? This cannot be undone.`,
            )
        ) {
            return;
        }
        try {
            await apiClient.delete(`/api/bible-map/islands/${island._id}`);
            await load();
        } catch (err) {
            console.error(err);
            alert('Failed to delete island.');
        }
    };

    const handleDeleteStory = async (story: MapStory) => {
        if (!window.confirm(`Delete story pack "${story.title}"?`)) return;
        try {
            await apiClient.delete(`/api/bible-map/stories/${story._id}`);
            await load();
        } catch (err) {
            console.error(err);
            alert('Failed to delete story.');
        }
    };

    const filteredStories =
        islandFilter === 'all'
            ? stories
            : stories.filter((s) => {
                  const id = typeof s.islandId === 'object' ? s.islandId?._id : s.islandId;
                  return id === islandFilter;
              });

    const islandTitle = (story: MapStory) => {
        if (typeof story.islandId === 'object' && story.islandId) {
            return story.islandId.title;
        }
        return islands.find((i) => i._id === story.islandId)?.title || '—';
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <MapIcon className="w-8 h-8 text-emerald-600" />
                        Bible Map
                    </h1>
                    <p className="text-gray-600 mt-1 max-w-2xl">
                        Manage voyage islands and story packs. Each pack bundles Read, Puzzle,
                        Coloring, Quiz, and Game unlocks for the map adventure.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {islands.length === 0 && (
                        <button
                            type="button"
                            onClick={handleSeedDefaults}
                            disabled={seeding}
                            className="bg-white border border-emerald-300 text-emerald-800 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-50 transition disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4" />
                            {seeding ? 'Seeding…' : 'Seed default islands'}
                        </button>
                    )}
                    {tab === 'islands' ? (
                        <Link
                            to="/bible-map/islands/new"
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition"
                        >
                            <Plus className="w-5 h-5" />
                            New Island
                        </Link>
                    ) : (
                        <Link
                            to="/bible-map/stories/new"
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition"
                        >
                            <Plus className="w-5 h-5" />
                            New Story Pack
                        </Link>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => setTab('islands')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                        tab === 'islands'
                            ? 'border-emerald-600 text-emerald-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    Islands ({islands.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTab('stories')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                        tab === 'stories'
                            ? 'border-emerald-600 text-emerald-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    Story Packs ({stories.length})
                </button>
            </div>

            {loading ? (
                <div className="text-gray-500 py-16 text-center">Loading Bible Map…</div>
            ) : tab === 'islands' ? (
                islands.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                        <MapIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h2 className="text-lg font-semibold text-gray-800 mb-1">No islands yet</h2>
                        <p className="text-gray-500 mb-4">
                            Seed Genesis → 1 Samuel defaults, or create your first island.
                        </p>
                        <button
                            type="button"
                            onClick={handleSeedDefaults}
                            disabled={seeding}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                        >
                            Seed default islands
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {islands.map((island) => (
                            <div
                                key={island._id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col"
                            >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        {island.mapArtUrl && (
                                            <img
                                                src={getMediaUrl(island.mapArtUrl)}
                                                alt=""
                                                className="w-14 h-14 object-contain rounded-lg bg-sky-50 border border-gray-100 shrink-0"
                                            />
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-xs text-gray-400 font-medium">
                                                #{island.order} · /{island.slug}
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {island.title}
                                            </h3>
                                            {island.bookLabel && island.bookLabel !== island.title && (
                                                <p className="text-sm text-gray-500">{island.bookLabel}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusBadge(island.status)}`}
                                    >
                                        {island.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-4">
                                    {island.storyCounts?.total ?? 0} stor
                                    {(island.storyCounts?.total ?? 0) === 1 ? 'y' : 'ies'}
                                    {island.storyCounts?.published
                                        ? ` · ${island.storyCounts.published} published`
                                        : ''}
                                </p>
                                    <div className="mt-auto flex flex-wrap gap-2">
                                    <Link
                                        to={`/bible-map/islands/${island._id}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                        Edit
                                    </Link>
                                    {island.status !== 'published' && (
                                        <Link
                                            to={`/bible-map/islands/${island._id}`}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-800"
                                        >
                                            Launch…
                                        </Link>
                                    )}
                                    <Link
                                        to={`/bible-map/stories/new?islandId=${island._id}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-sm border border-emerald-200 hover:bg-emerald-100"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add story
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteIsland(island)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 text-sm hover:bg-red-50"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div>
                    <div className="mb-4">
                        <label className="text-sm text-gray-600 mr-2">Filter by island</label>
                        <select
                            value={islandFilter}
                            onChange={(e) => setIslandFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                            <option value="all">All islands</option>
                            {islands.map((i) => (
                                <option key={i._id} value={i._id}>
                                    {i.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filteredStories.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                No story packs yet
                            </h2>
                            <p className="text-gray-500 mb-4">
                                Create a pack to link a Bible Map book and its unlockables.
                            </p>
                            <Link
                                to="/bible-map/stories/new"
                                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4" />
                                New Story Pack
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Story</th>
                                        <th className="px-4 py-3 font-medium">Island</th>
                                        <th className="px-4 py-3 font-medium">Activities</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStories.map((story) => {
                                        const hasBook = !!story.bookId;
                                        const hasQuiz = story.quizMode !== 'none';
                                        const hasPuzzle = !!story.puzzle?.enabled;
                                        const hasColoring = (story.coloringPageIds?.length ?? 0) > 0;
                                        const hasGame =
                                            !!story.game?.enabled && story.game?.kind !== 'none';
                                        return (
                                            <tr
                                                key={story._id}
                                                className="border-b border-gray-100 hover:bg-gray-50/80"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-900">
                                                        {story.displayTitle || story.title}
                                                    </div>
                                                    {story.scriptureRef && (
                                                        <div className="text-xs text-gray-500">
                                                            {story.scriptureRef}
                                                        </div>
                                                    )}
                                                    {hasBook &&
                                                        typeof story.bookId === 'object' &&
                                                        story.bookId && (
                                                            <div className="text-xs text-indigo-600 mt-0.5">
                                                                Book: {story.bookId.title}
                                                            </div>
                                                        )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {islandTitle(story)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {activityDot(hasBook, 'Read')}
                                                        {activityDot(hasQuiz, 'Quiz')}
                                                        {activityDot(hasPuzzle, 'Puzzle')}
                                                        {activityDot(hasColoring, 'Color')}
                                                        {activityDot(hasGame, 'Game')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(story.status)}`}
                                                    >
                                                        {story.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <Link
                                                        to={`/bible-map/stories/${story._id}`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 mr-2"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                        Edit pack
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteStory(story)}
                                                        className="inline-flex items-center p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BibleMapHub;
