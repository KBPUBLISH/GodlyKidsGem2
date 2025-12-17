import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Category {
    _id: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
}

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#6366f1',
        icon: '',
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/api/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                color: category.color,
                icon: category.icon || '',
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                description: '',
                color: '#6366f1',
                icon: '',
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setFormData({
            name: '',
            description: '',
            color: '#6366f1',
            icon: '',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingCategory) {
                await apiClient.put(`/api/categories/${editingCategory._id}`, formData);
            } else {
                await apiClient.post('/api/categories', formData);
            }
            await fetchCategories();
            handleCloseModal();
        } catch (error: any) {
            console.error('Error saving category:', error);
            alert(error.response?.data?.error || 'Failed to save category');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        setDeleting(id);
        try {
            await apiClient.delete(`/api/categories/${id}`);
            await fetchCategories();
        } catch (error: any) {
            console.error('Error deleting category:', error);
            alert(error.response?.data?.error || 'Failed to delete category');
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return <div className="p-6 text-center">Loading categories...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Categories</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Category
                </button>
            </div>

            {categories.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No categories found. Create your first one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((category) => (
                        <div
                            key={category._id}
                            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl"
                                        style={{ backgroundColor: category.color }}
                                    >
                                        {category.icon || <Tag className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800">{category.name}</h3>
                                        {category.description && (
                                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => handleOpenModal(category)}
                                    className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(category._id)}
                                    disabled={deleting === category._id}
                                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {deleting === category._id ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {editingCategory ? 'Edit Category' : 'Create Category'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="#6366f1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Icon (emoji or text)
                                </label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="📖 or book"
                                    maxLength={2}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;

