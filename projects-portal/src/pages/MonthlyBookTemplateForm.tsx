import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import apiClient from '../services/apiClient';

interface SavedCharacter {
    _id: string;
    internalTag: string;
    displayName: string;
}

interface StoryPage {
    pageNumber: number;
    text: string;
    sceneDescription?: string;
}

const MonthlyBookTemplateForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bibleCharacterId, setBibleCharacterId] = useState('');
    const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
    const [order, setOrder] = useState(0);
    const [storyPages, setStoryPages] = useState<StoryPage[]>([]);
    const [characters, setCharacters] = useState<SavedCharacter[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const charsRes = await apiClient.get('/api/monthly-book/admin/characters');
                setCharacters(charsRes.data.characters || []);
                if (charsRes.data.characters?.length && !bibleCharacterId) {
                    setBibleCharacterId(charsRes.data.characters[0]._id);
                }
                if (id) {
                    const res = await apiClient.get(`/api/monthly-book/admin/templates/${id}`);
                    const t = res.data;
                    setTitle(t.title || '');
                    setDescription(t.description || '');
                    setBibleCharacterId(t.bibleCharacterId?._id || t.bibleCharacterId || '');
                    setStatus(t.status || 'draft');
                    setOrder(t.order ?? 0);
                    setStoryPages(Array.isArray(t.storyPages) && t.storyPages.length ? t.storyPages : [{ pageNumber: 1, text: `{childName} goes on an adventure.`, sceneDescription: '' }]);
                } else {
                    setStoryPages([{ pageNumber: 1, text: `{childName} goes on an adventure.`, sceneDescription: '' }]);
                }
            } catch (e) {
                console.error(e);
                setError('Failed to load data.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const addPage = () => {
        setStoryPages((prev) => [
            ...prev,
            { pageNumber: prev.length + 1, text: `Page ${prev.length + 1} with {childName}.`, sceneDescription: '' },
        ]);
    };

    const updatePage = (index: number, field: 'text' | 'sceneDescription', value: string) => {
        setStoryPages((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value, pageNumber: index + 1 };
            return next;
        });
    };

    const removePage = (index: number) => {
        if (storyPages.length <= 1) return;
        setStoryPages((prev) => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, pageNumber: i + 1 })));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const payload = {
                title,
                description,
                bibleCharacterId,
                status,
                order,
                storyPages: storyPages.map((p, i) => ({ pageNumber: i + 1, text: p.text, sceneDescription: p.sceneDescription || undefined })),
            };
            if (isEdit) {
                await apiClient.put(`/api/monthly-book/admin/templates/${id}`, payload);
            } else {
                await apiClient.post('/api/monthly-book/admin/templates', payload);
            }
            navigate('/monthly-books');
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6 flex items-center gap-4">
                <button
                    onClick={() => navigate('/monthly-books')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="w-5 h-5" /> Back
                </button>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? 'Edit template' : 'New template'}</h1>

            {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Journey with Noah"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Short description for the app"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bible character</label>
                    <select
                        value={bibleCharacterId}
                        onChange={(e) => setBibleCharacterId(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        required
                    >
                        <option value="">Select…</option>
                        {characters.map((c) => (
                            <option key={c._id} value={c._id}>{c.displayName} ({c.internalTag})</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                        <input
                            type="number"
                            value={order}
                            onChange={(e) => setOrder(Number(e.target.value))}
                            className="border rounded-lg px-3 py-2 w-24"
                        />
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Story pages</label>
                        <button type="button" onClick={addPage} className="text-sm text-indigo-600 hover:text-indigo-800">
                            + Add page
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Use {'{childName}'} in text to insert the kid’s name.</p>
                    <div className="space-y-4">
                        {storyPages.map((page, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-600">Page {index + 1}</span>
                                    {storyPages.length > 1 && (
                                        <button type="button" onClick={() => removePage(index)} className="text-red-600 text-sm">
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={page.text}
                                    onChange={(e) => updatePage(index, 'text', e.target.value)}
                                    className="w-full border rounded px-3 py-2 text-sm mb-2"
                                    rows={2}
                                    placeholder="Page text (use {childName})"
                                />
                                <input
                                    type="text"
                                    value={page.sceneDescription || ''}
                                    onChange={(e) => updatePage(index, 'sceneDescription', e.target.value)}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder="Scene description (optional, for image generation)"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => navigate('/monthly-books')} className="px-4 py-2 border rounded-lg">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MonthlyBookTemplateForm;
