import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, BookOpen, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface MonthlyBookTemplate {
    _id: string;
    title: string;
    description?: string;
    bibleCharacterId?: string;
    bibleCharacter?: { internalTag: string; displayName: string } | null;
    storyPages: { pageNumber: number; text: string; sceneDescription?: string }[];
    order: number;
    status: 'draft' | 'published' | 'archived';
    createdAt: string;
}

const MonthlyBookTemplates: React.FC = () => {
    const [templates, setTemplates] = useState<MonthlyBookTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, [statusFilter]);

    const fetchTemplates = async () => {
        try {
            const response = await apiClient.get('/api/monthly-book/admin/templates');
            let list = response.data.templates || [];
            if (statusFilter !== 'all') {
                list = list.filter((t: MonthlyBookTemplate) => t.status === statusFilter);
            }
            setTemplates(list);
        } catch (error) {
            console.error('Error fetching monthly book templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Delete template "${title}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await apiClient.delete(`/api/monthly-book/admin/templates/${id}`);
            setTemplates(templates.filter((t) => t._id !== id));
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Failed to delete. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published':
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
                    <h1 className="text-3xl font-bold text-gray-800">Kids Monthly Books</h1>
                    <p className="text-gray-600 mt-1">
                        Templates for the &quot;Create Your Story&quot; feature — kids pick a Bible character and get a custom book
                    </p>
                </div>
                <Link
                    to="/monthly-books/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Template
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
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
                    <p className="text-gray-500 mb-4">
                        Create templates so kids can choose a Bible character story in the app (e.g. Journey with Noah, Help David).
                    </p>
                    <Link
                        to="/monthly-books/new"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5" />
                        Create Template
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bible character</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {templates.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-100 rounded-lg">
                                                <BookOpen className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{t.title}</div>
                                                {t.description && (
                                                    <div className="text-sm text-gray-500 max-w-md truncate">{t.description}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {t.bibleCharacter ? t.bibleCharacter.displayName : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {(t.storyPages || []).length}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(t.status)}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/monthly-books/edit/${t._id}`}
                                            className="text-indigo-600 hover:text-indigo-800 mr-4 inline-flex items-center gap-1"
                                        >
                                            <Edit className="w-4 h-4" /> Edit
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(t._id, t.title)}
                                            disabled={deletingId === t._id}
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
