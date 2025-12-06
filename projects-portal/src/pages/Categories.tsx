import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Category {
    _id: string;
    name: string;
    type: 'book' | 'audio';
    description?: string;
    color: string;
    icon?: string;
    showOnExplore?: boolean;
}

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'book' as 'book' | 'audio',
        description: '',
        color: '#6366f1',
        icon: '',
        showOnExplore: false,
    });
    const [filterType, setFilterType] = useState<'all' | 'book' | 'audio' | 'explore'>('all');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const url = filterType === 'all' 
                ? '/api/categories'
                : filterType === 'explore'
                    ? '/api/categories?explore=true'
                    : `/api/categories?type=${filterType}`;
            const response = await apiClient.get(url);
            // Handle paginated response or direct array
            const categoriesData = Array.isArray(response.data) 
                ? response.data 
                : (response.data.data || response.data.categories || []);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [filterType]);

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                type: category.type,
                description: category.description || '',
                color: category.color,
                icon: category.icon || '',
                showOnExplore: Boolean(category.showOnExplore),
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                type: 'book' as 'book' | 'audio',
                description: '',
                color: '#6366f1',
                icon: '',
                showOnExplore: false,
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setFormData({
            name: '',
            type: 'book' as 'book' | 'audio',
            description: '',
            color: '#6366f1',
            icon: '',
            showOnExplore: false,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Ensure showOnExplore is always included as a boolean
            const payload = {
                ...formData,
                showOnExplore: Boolean(formData.showOnExplore), // Explicitly convert to boolean
            };
            console.log('Submitting category form data:', payload);
            console.log('showOnExplore value:', formData.showOnExplore, 'type:', typeof formData.showOnExplore);
            if (editingCategory) {
                const response = await apiClient.put(`/api/categories/${editingCategory._id}`, payload);
                console.log('Update response full:', JSON.stringify(response.data, null, 2));
                console.log('showOnExplore in response:', response.data.showOnExplore, 'type:', typeof response.data.showOnExplore);
                
                // Verify by fetching the category again
                const verifyResponse = await apiClient.get(`/api/categories/${editingCategory._id}`);
                console.log('Verified category after update:', JSON.stringify(verifyResponse.data, null, 2));
                console.log('Verified showOnExplore:', verifyResponse.data.showOnExplore);
            } else {
                const response = await apiClient.post('/api/categories', payload);
                console.log('Create response:', response.data);
                console.log('showOnExplore in response:', response.data.showOnExplore);
            }
            await fetchCategories();
            handleCloseModal();
        } catch (error: any) {
            console.error('Error saving category:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to save category';
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                message: errorMessage
            });
            alert(errorMessage);
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
                <div className="flex items-center gap-4">
                    <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 rounded transition-colors ${
                                filterType === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('book')}
                            className={`px-3 py-1 rounded transition-colors ${
                                filterType === 'book' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'
                            }`}
                        >
                            Books
                        </button>
                        <button
                            onClick={() => setFilterType('audio')}
                            className={`px-3 py-1 rounded transition-colors ${
                                filterType === 'audio' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'
                            }`}
                        >
                            Audio
                        </button>
                        <button
                            onClick={() => setFilterType('explore')}
                            className={`px-3 py-1 rounded transition-colors ${
                                filterType === 'explore' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'
                            }`}
                        >
                            Explore
                        </button>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Category
                    </button>
                </div>
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
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-semibold text-gray-800">{category.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    category.type === 'book' 
                                                        ? 'bg-blue-100 text-blue-700' 
                                                        : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {category.type === 'book' ? 'Book' : 'Audio'}
                                                </span>
                                                {category.showOnExplore && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                                                        Explore
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
                                    Type *
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'book' | 'audio' })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    required
                                >
                                    <option value="book">Book</option>
                                    <option value="audio">Audio</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.showOnExplore === true}
                                        onChange={(e) => {
                                            const newValue = e.target.checked;
                                            console.log('Checkbox changed:', newValue, 'Current formData:', formData.showOnExplore);
                                            setFormData({ ...formData, showOnExplore: newValue });
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Show on Explore Page</span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                    When enabled, this category will appear on the explore page for organizing content
                                </p>
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
