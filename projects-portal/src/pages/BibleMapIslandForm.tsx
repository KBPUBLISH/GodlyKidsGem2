import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    Upload,
    X,
    Image as ImageIcon,
    Rocket,
    Check,
    AlertTriangle,
    Video,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

interface IslandFormState {
    slug: string;
    title: string;
    bookLabel: string;
    description: string;
    mapArtUrl: string;
    sailArtUrl: string;
    mapPositionX: number;
    mapPositionY: number;
    order: number;
    status: 'draft' | 'published' | 'archived';
    unlockRule: 'always' | 'previous_complete';
    introVideoUrl: string;
    sceneBgVideoUrl: string;
}

interface LaunchReadiness {
    ready: boolean;
    alreadyPublished?: boolean;
    blockers: string[];
    warnings: string[];
    checklist: Array<{ id: string; label: string; ok: boolean }>;
    stories?: Array<{
        storyId: string;
        title: string;
        book: boolean;
        puzzle: boolean;
        coloring: boolean;
        quiz: boolean;
        game: boolean;
    }>;
}

const empty: IslandFormState = {
    slug: '',
    title: '',
    bookLabel: '',
    description: '',
    mapArtUrl: '',
    sailArtUrl: '',
    mapPositionX: 50,
    mapPositionY: 50,
    order: 0,
    status: 'draft',
    unlockRule: 'previous_complete',
    introVideoUrl: '',
    sceneBgVideoUrl: '',
};

const BibleMapIslandForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();

    const [form, setForm] = useState<IslandFormState>(empty);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [storyCount, setStoryCount] = useState(0);
    const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
    const [launching, setLaunching] = useState(false);
    const [uploadingMap, setUploadingMap] = useState(false);
    const [uploadingSail, setUploadingSail] = useState(false);
    const [uploadingIntro, setUploadingIntro] = useState(false);
    const [uploadingSceneBg, setUploadingSceneBg] = useState(false);
    const [previewMode, setPreviewMode] = useState<'scene' | 'intro'>('scene');
    const mapInputRef = useRef<HTMLInputElement>(null);
    const sailInputRef = useRef<HTMLInputElement>(null);
    const introVideoInputRef = useRef<HTMLInputElement>(null);
    const sceneBgVideoInputRef = useRef<HTMLInputElement>(null);

    const loadIsland = async () => {
        if (isNew || !id) return;
        const res = await apiClient.get(`/api/bible-map/islands/${id}`);
        const island = res.data.island;
        setStoryCount(Array.isArray(res.data.stories) ? res.data.stories.length : 0);
        setReadiness(res.data.readiness || null);
        setForm({
            slug: island.slug || '',
            title: island.title || '',
            bookLabel: island.bookLabel || '',
            description: island.description || '',
            mapArtUrl: island.mapArtUrl || '',
            sailArtUrl: island.sailArtUrl || '',
            mapPositionX: island.mapPosition?.x ?? 50,
            mapPositionY: island.mapPosition?.y ?? 50,
            order: island.order ?? 0,
            status: island.status || 'draft',
            unlockRule: island.unlockRule || 'previous_complete',
            introVideoUrl: island.introVideoUrl || '',
            sceneBgVideoUrl: island.sceneBgVideoUrl || '',
        });
    };

    useEffect(() => {
        if (isNew) return;
        const load = async () => {
            try {
                await loadIsland();
            } catch (err) {
                console.error(err);
                alert('Failed to load island');
                navigate('/bible-map');
            } finally {
                setLoading(false);
            }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isNew, navigate]);

    const update = <K extends keyof IslandFormState>(key: K, value: IslandFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleTitleBlur = () => {
        if (!form.slug && form.title) {
            update(
                'slug',
                form.title
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, ''),
            );
        }
        if (!form.bookLabel && form.title) {
            update('bookLabel', form.title);
        }
    };

    const uploadIslandImage = async (
        file: File,
        kind: 'map-art' | 'sail-art',
    ): Promise<string> => {
        const islandKey = form.slug || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/image?bookId=bible-map&type=${kind}&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const handleMapArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingMap(true);
        try {
            const url = await uploadIslandImage(file, 'map-art');
            update('mapArtUrl', url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload map island image');
        } finally {
            setUploadingMap(false);
        }
    };

    const handleSailArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingSail(true);
        try {
            const url = await uploadIslandImage(file, 'sail-art');
            update('sailArtUrl', url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload sail carousel image');
        } finally {
            setUploadingSail(false);
        }
    };

    const uploadIslandVideo = async (
        file: File,
        kind: 'intro' | 'scene-bg',
    ): Promise<string> => {
        const islandKey = form.slug || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/video?bookId=bible-map&type=${kind}&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const handleIntroVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingIntro(true);
        try {
            const url = await uploadIslandVideo(file, 'intro');
            update('introVideoUrl', url);
            setPreviewMode('intro');
        } catch (err) {
            console.error(err);
            alert('Failed to upload intro video');
        } finally {
            setUploadingIntro(false);
        }
    };

    const handleSceneBgVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingSceneBg(true);
        try {
            const url = await uploadIslandVideo(file, 'scene-bg');
            update('sceneBgVideoUrl', url);
            setPreviewMode('scene');
        } catch (err) {
            console.error(err);
            alert('Failed to upload scene background video');
        } finally {
            setUploadingSceneBg(false);
        }
    };

    const previewVideoUrl =
        previewMode === 'intro'
            ? getMediaUrl(form.introVideoUrl)
            : getMediaUrl(form.sceneBgVideoUrl);
    const hasPreviewVideo = Boolean(previewVideoUrl);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.slug.trim()) {
            alert('Title and slug are required');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                slug: form.slug.trim().toLowerCase(),
                title: form.title.trim(),
                bookLabel: form.bookLabel.trim() || form.title.trim(),
                description: form.description.trim(),
                mapArtUrl: form.mapArtUrl.trim() || undefined,
                sailArtUrl: form.sailArtUrl.trim() || undefined,
                mapPosition: { x: form.mapPositionX, y: form.mapPositionY },
                order: form.order,
                status: form.status,
                unlockRule: form.unlockRule,
                introVideoUrl: form.introVideoUrl.trim() || undefined,
                sceneBgVideoUrl: form.sceneBgVideoUrl.trim() || undefined,
            };
            if (isNew) {
                const res = await apiClient.post('/api/bible-map/islands', payload);
                navigate(`/bible-map/islands/${res.data._id}`);
            } else {
                await apiClient.put(`/api/bible-map/islands/${id}`, payload);
                await loadIsland();
                alert('Island saved. Use Launch when the checklist is complete.');
            }
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to save island';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleLaunch = async (force = false) => {
        if (isNew || !id) return;
        // Save first so checklist uses latest form values on next load;
        // launch uses DB state, so persist now.
        setLaunching(true);
        try {
            const payload = {
                slug: form.slug.trim().toLowerCase(),
                title: form.title.trim(),
                bookLabel: form.bookLabel.trim() || form.title.trim(),
                description: form.description.trim(),
                mapArtUrl: form.mapArtUrl.trim() || undefined,
                sailArtUrl: form.sailArtUrl.trim() || undefined,
                mapPosition: { x: form.mapPositionX, y: form.mapPositionY },
                order: form.order,
                unlockRule: form.unlockRule,
                introVideoUrl: form.introVideoUrl.trim() || undefined,
                sceneBgVideoUrl: form.sceneBgVideoUrl.trim() || undefined,
            };
            await apiClient.put(`/api/bible-map/islands/${id}`, payload);

            try {
                const res = await apiClient.post(`/api/bible-map/islands/${id}/launch`, { force });
                setReadiness(res.data.readiness || null);
                setForm((prev) => ({ ...prev, status: 'published' }));
                alert('Island launched (published in CMS). App map wiring comes later — content is ready.');
            } catch (err: unknown) {
                const data = (err as { response?: { data?: {
                    error?: string;
                    readiness?: LaunchReadiness;
                    needsForce?: boolean;
                } } })?.response?.data;
                if (data?.readiness) setReadiness(data.readiness);
                if (data?.needsForce) {
                    const proceed = window.confirm(
                        `${data.error || 'Launch warnings'}\n\nLaunch anyway?`,
                    );
                    if (proceed) {
                        await handleLaunch(true);
                        return;
                    }
                } else {
                    alert(data?.error || 'Cannot launch island yet — check the checklist.');
                }
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save before launch');
        } finally {
            setLaunching(false);
        }
    };

    const handleUnpublish = async () => {
        if (isNew || !id) return;
        if (!window.confirm('Unpublish this island back to draft?')) return;
        try {
            await apiClient.post(`/api/bible-map/islands/${id}/unpublish`);
            setForm((prev) => ({ ...prev, status: 'draft' }));
            await loadIsland();
        } catch (err) {
            console.error(err);
            alert('Failed to unpublish');
        }
    };

    if (loading) {
        return <div className="text-gray-500 py-12 text-center">Loading island…</div>;
    }

    return (
        <div className="max-w-5xl">
            <Link
                to="/bible-map"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 mb-4"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Bible Map
            </Link>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isNew ? 'New Island' : form.title || 'Edit Island'}
                    </h1>
                    {!isNew && (
                        <p className="text-sm text-gray-500 mt-1">
                            {storyCount} stor{storyCount === 1 ? 'y' : 'ies'} on this island ·{' '}
                            <Link
                                to={`/bible-map/stories/new?islandId=${id}`}
                                className="text-emerald-700 hover:underline"
                            >
                                Add story pack
                            </Link>
                        </p>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                            value={form.title}
                            onChange={(e) => update('title', e.target.value)}
                            onBlur={handleTitleBlur}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Slug (app route)
                        </label>
                        <input
                            value={form.slug}
                            onChange={(e) => update('slug', e.target.value.toLowerCase())}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                            placeholder="genesis"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Used as /sail/{'{slug}'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Book label
                        </label>
                        <input
                            value={form.bookLabel}
                            onChange={(e) => update('bookLabel', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Genesis"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                        <input
                            type="number"
                            value={form.order}
                            onChange={(e) => update('order', parseInt(e.target.value, 10) || 0)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Short description / adventure title
                    </label>
                    <textarea
                        value={form.description}
                        onChange={(e) => update('description', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Creation — shown under the book label on the map"
                    />
                </div>

                {/* Image uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Map island image
                        </label>
                        <p className="text-xs text-gray-500">
                            Shown on the voyage map. PNG with transparent water/sky works best.
                        </p>
                        {form.mapArtUrl ? (
                            <div className="relative rounded-xl border border-gray-200 bg-sky-50 p-3">
                                <img
                                    src={getMediaUrl(form.mapArtUrl)}
                                    alt="Map island"
                                    className="max-h-40 mx-auto object-contain"
                                />
                                <button
                                    type="button"
                                    onClick={() => update('mapArtUrl', '')}
                                    className="absolute top-2 right-2 p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-red-600"
                                    aria-label="Remove map image"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 h-36 flex flex-col items-center justify-center text-gray-400">
                                <ImageIcon className="w-8 h-8 mb-1" />
                                <span className="text-xs">No image yet</span>
                            </div>
                        )}
                        <input
                            ref={mapInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleMapArtUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingMap}
                            onClick={() => mapInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingMap ? 'Uploading…' : form.mapArtUrl ? 'Replace image' : 'Upload image'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Sail carousel image
                        </label>
                        <p className="text-xs text-gray-500">
                            Shown when steering the boat. Falls back to map image if empty.
                        </p>
                        {form.sailArtUrl ? (
                            <div className="relative rounded-xl border border-gray-200 bg-sky-50 p-3">
                                <img
                                    src={getMediaUrl(form.sailArtUrl)}
                                    alt="Sail island"
                                    className="max-h-40 mx-auto object-contain"
                                />
                                <button
                                    type="button"
                                    onClick={() => update('sailArtUrl', '')}
                                    className="absolute top-2 right-2 p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-red-600"
                                    aria-label="Remove sail image"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 h-36 flex flex-col items-center justify-center text-gray-400">
                                <ImageIcon className="w-8 h-8 mb-1" />
                                <span className="text-xs">No image yet</span>
                            </div>
                        )}
                        <input
                            ref={sailInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSailArtUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingSail}
                            onClick={() => sailInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingSail ? 'Uploading…' : form.sailArtUrl ? 'Replace image' : 'Upload image'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={form.status}
                            onChange={(e) =>
                                update('status', e.target.value as IslandFormState['status'])
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="draft">Draft (content work — not launched)</option>
                            <option value="published">Published / launched (CMS ready)</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unlock rule
                        </label>
                        <select
                            value={form.unlockRule}
                            onChange={(e) =>
                                update(
                                    'unlockRule',
                                    e.target.value as IslandFormState['unlockRule'],
                                )
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="always">Always unlocked</option>
                            <option value="previous_complete">After previous island complete</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Map position X %
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.mapPositionX}
                            onChange={(e) =>
                                update('mapPositionX', parseFloat(e.target.value) || 0)
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Map position Y %
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.mapPositionY}
                            onChange={(e) =>
                                update('mapPositionY', parseFloat(e.target.value) || 0)
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-gray-100">
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 mb-1">
                                Island scene videos
                            </h2>
                            <p className="text-xs text-gray-500">
                                Intro plays after sail / on lesson entry. Scene background loops
                                behind activities. Upload or paste a URL.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Intro video
                            </label>
                            {form.introVideoUrl ? (
                                <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <video
                                        key={form.introVideoUrl}
                                        src={getMediaUrl(form.introVideoUrl)}
                                        className="w-full max-h-28 rounded object-cover bg-black"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        controls
                                    />
                                    <button
                                        type="button"
                                        onClick={() => update('introVideoUrl', '')}
                                        className="absolute top-3 right-3 p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-red-600"
                                        aria-label="Remove intro video"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : null}
                            <input
                                value={form.introVideoUrl}
                                onChange={(e) => update('introVideoUrl', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="https://… or upload below"
                            />
                            <input
                                ref={introVideoInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={handleIntroVideoUpload}
                            />
                            <button
                                type="button"
                                disabled={uploadingIntro}
                                onClick={() => introVideoInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {uploadingIntro
                                    ? 'Uploading…'
                                    : form.introVideoUrl
                                      ? 'Replace video'
                                      : 'Upload video'}
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Scene background video (loop)
                            </label>
                            {form.sceneBgVideoUrl ? (
                                <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <video
                                        key={form.sceneBgVideoUrl}
                                        src={getMediaUrl(form.sceneBgVideoUrl)}
                                        className="w-full max-h-28 rounded object-cover bg-black"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        controls
                                    />
                                    <button
                                        type="button"
                                        onClick={() => update('sceneBgVideoUrl', '')}
                                        className="absolute top-3 right-3 p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-red-600"
                                        aria-label="Remove scene background video"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : null}
                            <input
                                value={form.sceneBgVideoUrl}
                                onChange={(e) => update('sceneBgVideoUrl', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="https://… or upload below"
                            />
                            <input
                                ref={sceneBgVideoInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={handleSceneBgVideoUpload}
                            />
                            <button
                                type="button"
                                disabled={uploadingSceneBg}
                                onClick={() => sceneBgVideoInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {uploadingSceneBg
                                    ? 'Uploading…'
                                    : form.sceneBgVideoUrl
                                      ? 'Replace video'
                                      : 'Upload video'}
                            </button>
                        </div>
                    </div>

                    {/* Lightweight phone preview — framing only; hotspot editor later */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-gray-900">
                                Scene preview
                            </h2>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('scene')}
                                    className={`px-2.5 py-1.5 ${
                                        previewMode === 'scene'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Loop BG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('intro')}
                                    className={`px-2.5 py-1.5 border-l border-gray-200 ${
                                        previewMode === 'intro'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Intro
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Phone frame uses <code className="text-[11px]">object-fit: cover</code>{' '}
                            like the kid app. Full hotspot editor comes later.
                        </p>
                        <div className="flex justify-center">
                            <div
                                className="relative bg-black shadow-xl"
                                style={{
                                    width: 220,
                                    height: 440,
                                    borderRadius: 28,
                                    border: '10px solid #1f2937',
                                    boxShadow:
                                        '0 12px 40px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Notch */}
                                <div
                                    className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                                    style={{ width: 88, height: 18 }}
                                    aria-hidden
                                />
                                {hasPreviewVideo ? (
                                    <video
                                        key={`${previewMode}-${previewVideoUrl}`}
                                        src={previewVideoUrl}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        muted
                                        loop={previewMode === 'scene'}
                                        playsInline
                                        autoPlay
                                        preload="auto"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a4a28] text-white/70 px-4 text-center">
                                        <Video className="w-8 h-8 opacity-60" />
                                        <p className="text-xs leading-snug">
                                            {previewMode === 'intro'
                                                ? 'Add an intro video to preview framing'
                                                : 'Add a scene background to preview framing'}
                                        </p>
                                    </div>
                                )}
                                <div className="absolute bottom-3 left-3 right-3 z-10 rounded-md bg-black/55 px-2 py-1.5 text-[10px] leading-snug text-white/90 text-center">
                                    Hotspot editor coming later — framing check only
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : isNew ? 'Create Island' : 'Save Island'}
                    </button>
                    <Link
                        to="/bible-map"
                        className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </Link>
                </div>
            </form>

            {/* Launch panel — CMS publish when content is ready (app wiring separate) */}
            {!isNew && (
                <div className="mt-6 bg-white rounded-xl border border-emerald-200 p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-emerald-600" />
                                Launch island
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Marks this island + story packs as published in the CMS so content is
                                ready. The kid app still uses the current map until you wire it later.
                            </p>
                        </div>
                        <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                form.status === 'published'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                        >
                            {form.status}
                        </span>
                    </div>

                    {readiness && (
                        <div className="space-y-3">
                            <ul className="space-y-1.5">
                                {readiness.checklist.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex items-center gap-2 text-sm text-gray-700"
                                    >
                                        {item.ok ? (
                                            <Check className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                            <X className="w-4 h-4 text-red-500" />
                                        )}
                                        {item.label}
                                    </li>
                                ))}
                            </ul>
                            {readiness.stories && readiness.stories.length > 0 && (
                                <div className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-3">
                                    {readiness.stories.map((s) => (
                                        <div key={s.storyId} className="flex flex-wrap gap-2">
                                            <span className="font-medium text-gray-800">{s.title}:</span>
                                            <span className={s.book ? 'text-emerald-700' : 'text-red-600'}>
                                                Read {s.book ? '✓' : '✗'}
                                            </span>
                                            <span className={s.puzzle ? 'text-emerald-700' : 'text-amber-600'}>
                                                Puzzle
                                            </span>
                                            <span className={s.coloring ? 'text-emerald-700' : 'text-amber-600'}>
                                                Color
                                            </span>
                                            <span className={s.quiz ? 'text-emerald-700' : 'text-amber-600'}>
                                                Quiz
                                            </span>
                                            <span className={s.game ? 'text-emerald-700' : 'text-amber-600'}>
                                                Game
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {readiness.blockers.length > 0 && (
                                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                                    <p className="font-medium mb-1">Must fix before launch:</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {readiness.blockers.map((b) => (
                                            <li key={b}>{b}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {readiness.warnings.length > 0 && (
                                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium mb-1">Optional gaps (can force-launch):</p>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            {readiness.warnings.map((w) => (
                                                <li key={w}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {form.status !== 'published' ? (
                            <button
                                type="button"
                                disabled={launching}
                                onClick={() => void handleLaunch(false)}
                                className="inline-flex items-center gap-2 bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-800 disabled:opacity-50"
                            >
                                <Rocket className="w-4 h-4" />
                                {launching ? 'Launching…' : 'Launch island'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void handleUnpublish()}
                                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50"
                            >
                                Unpublish to draft
                            </button>
                        )}
                        <Link
                            to={`/bible-map/stories/new?islandId=${id}`}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-sm"
                        >
                            Add / edit story packs
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BibleMapIslandForm;
