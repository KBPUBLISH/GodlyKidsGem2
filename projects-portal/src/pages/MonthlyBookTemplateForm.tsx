import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import apiClient from '../services/apiClient';

const STYLE_OPTIONS = [
    { id: '', label: '— None —' },
    { id: 'pixar', label: 'Pixar' },
    { id: 'minecraft', label: 'Minecraft' },
    { id: 'disney', label: 'Disney' },
    { id: 'lego', label: 'LEGO' },
    { id: 'cartoon', label: 'Cartoon' },
    { id: 'illustrated', label: 'Illustrated' },
];

const MonthlyBookTemplateForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [internalTag, setInternalTag] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [scriptureReference, setScriptureReference] = useState('');
    const [styleId, setStyleId] = useState('');
    const [stylePrompt, setStylePrompt] = useState('');
    const [referenceImageUrl, setReferenceImageUrl] = useState('');
    const [order, setOrder] = useState(0);
    const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('active');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const res = await apiClient.get(`/api/monthly-book/admin/characters/${id}`);
                const c = res.data;
                setInternalTag(c.internalTag || '');
                setDisplayName(c.displayName || '');
                setScriptureReference(c.scriptureReference || '');
                setStyleId(c.styleId || '');
                setStylePrompt(c.stylePrompt || '');
                setReferenceImageUrl(c.referenceImageUrl || '');
                setOrder(c.order ?? 0);
                setStatus(c.status || 'active');
            } catch (e) {
                console.error(e);
                setError('Failed to load character.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const payload = {
                internalTag: internalTag.trim(),
                displayName: displayName.trim(),
                scriptureReference: scriptureReference.trim() || undefined,
                styleId: styleId || undefined,
                stylePrompt: stylePrompt.trim() || '',
                referenceImageUrl: referenceImageUrl.trim() || undefined,
                order: Number(order),
                status,
            };
            if (isEdit) {
                await apiClient.put(`/api/monthly-book/admin/characters/${id}`, payload);
            } else {
                await apiClient.post('/api/monthly-book/admin/characters', payload);
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
            <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? 'Edit character' : 'New character'}</h1>

            {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal tag *</label>
                    <input
                        type="text"
                        value={internalTag}
                        onChange={(e) => setInternalTag(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 font-mono"
                        placeholder="e.g. bible_noah, bible_david"
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique ID; avoid bare first names (e.g. use bible_noah not noah).</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Noah, David"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scripture reference</label>
                    <input
                        type="text"
                        value={scriptureReference}
                        onChange={(e) => setScriptureReference(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Genesis 6-9"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                    <select
                        value={styleId}
                        onChange={(e) => setStyleId(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    >
                        {STYLE_OPTIONS.map((opt) => (
                            <option key={opt.id || 'none'} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Same styles as in the app (Pixar, Minecraft, Disney, etc.).</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style prompt (optional override)</label>
                    <textarea
                        value={stylePrompt}
                        onChange={(e) => setStylePrompt(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Detailed description for image generation; leave blank to use style default."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference image URL</label>
                    <input
                        type="url"
                        value={referenceImageUrl}
                        onChange={(e) => setReferenceImageUrl(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="https://..."
                    />
                </div>
                <div className="flex gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                        <input
                            type="number"
                            value={order}
                            onChange={(e) => setOrder(Number(e.target.value))}
                            className="border rounded-lg px-3 py-2 w-24"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                        </select>
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
