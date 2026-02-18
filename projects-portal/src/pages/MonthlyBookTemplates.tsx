import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, User, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface SavedCharacter {
    _id: string;
    internalTag: string;
    displayName: string;
    styleId?: string | null;
    order: number;
    status: string;
    scriptureReference?: string;
}

const STYLE_LABELS: Record<string, string> = {
    pixar: 'Pixar',
    minecraft: 'Minecraft',
    disney: 'Disney 2D',
    anime: 'Disney 2D',
    lego: 'LEGO',
    cartoon: 'Cartoon',
    illustrated: 'Illustrated',
};

const MonthlyBookTemplates: React.FC = () => {
    const [characters, setCharacters] = useState<SavedCharacter[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchCharacters();
    }, [statusFilter]);

    const fetchCharacters = async () => {
        try {
            const response = await apiClient.get('/api/monthly-book/admin/characters?status=all');
            let list = response.data.characters || [];
            if (statusFilter !== 'all') {
                list = list.filter((c: SavedCharacter) => c.status === statusFilter);
            }
            setCharacters(list);
        } catch (error) {
            console.error('Error fetching characters:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, displayName: string) => {
        if (!window.confirm(`Delete character "${displayName}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await apiClient.delete(`/api/monthly-book/admin/characters/${id}`);
            setCharacters(characters.filter((c) => c._id !== id));
        } catch (error) {
            console.error('Error deleting character:', error);
            alert('Failed to delete. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'archived':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Kids Monthly Book Character Design</h1>
                    <p className="text-gray-600 mt-1">
                        Create and edit Bible characters (e.g. Noah, David) with a style tag. These characters can be referenced when building a Kids Monthly Book in the Book Builder.
                    </p>
                </div>
                <Link
                    to="/monthly-books/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Character
                </Link>
            </div>

            <div className="mb-6 flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : characters.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No characters yet</h3>
                    <p className="text-gray-500 mb-4">
                        Create characters (e.g. Noah, David) with a style (Pixar, Minecraft, Disney, etc.) so you can assign them to Kids Monthly Books in the Book Builder.
                    </p>
                    <Link
                        to="/monthly-books/new"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5" />
                        Create Character
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Character</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Internal tag</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Style</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {characters.map((c) => (
                                <tr key={c._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-100 rounded-lg">
                                                <User className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{c.displayName}</div>
                                                {c.scriptureReference && (
                                                    <div className="text-sm text-gray-500">{c.scriptureReference}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{c.internalTag}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {c.styleId ? STYLE_LABELS[c.styleId] || c.styleId : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{c.order}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(c.status)}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/monthly-books/edit/${c._id}`}
                                            className="text-indigo-600 hover:text-indigo-800 mr-4 inline-flex items-center gap-1"
                                        >
                                            <Edit className="w-4 h-4" /> Edit
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(c._id, c.displayName)}
                                            disabled={deletingId === c._id}
                                            className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MonthlyBookTemplates;
