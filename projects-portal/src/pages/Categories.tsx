import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Tag, BookOpen, Headphones, Upload, Image, X } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Category {
    _id: string;
    name: string;
    description?: string;
    color: string;
    gradientFrom?: string;
    gradientTo?: string;
    icon?: string;
    image?: string;
    contentType: 'Book' | 'Audio';
}

// Preset gradient options
const GRADIENT_PRESETS = [
    { name: 'Purple', from: '#8b5cf6', to: '#6366f1' },
    { name: 'Blue', from: '#3b82f6', to: '#1d4ed8' },
    { name: 'Sky', from: '#38bdf8', to: '#0284c7' },
    { name: 'Green', from: '#22c55e', to: '#16a34a' },
    { name: 'Emerald', from: '#10b981', to: '#059669' },
    { name: 'Yellow', from: '#facc15', to: '#eab308' },
    { name: 'Orange', from: '#f97316', to: '#ea580c' },
    { name: 'Red', from: '#ef4444', to: '#dc2626' },
    { name: 'Pink', from: '#ec4899', to: '#db2777' },
    { name: 'Indigo', from: '#6366f1', to: '#4f46e5' },
    { name: 'Teal', from: '#14b8a6', to: '#0d9488' },
    { name: 'Amber', from: '#f59e0b', to: '#d97706' },
];

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#6366f1',
        gradientFrom: '#6366f1',
        gradientTo: '#8b5cf6',
        icon: '',
        image: '',
        contentType: 'Book' as 'Book' | 'Audio',
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

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
                gradientFrom: category.gradientFrom || category.color || '#6366f1',
                gradientTo: category.gradientTo || '#8b5cf6',
                icon: category.icon || '',
                image: category.image || '',
                contentType: category.contentType || 'Book',
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                description: '',
                color: '#6366f1',
                gradientFrom: '#6366f1',
                gradientTo: '#8b5cf6',
                icon: '',
                image: '',
                contentType: 'Book',
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
            gradientFrom: '#6366f1',
            gradientTo: '#8b5cf6',
            icon: '',
            image: '',
            contentType: 'Book',
        });
    };

    // Handle image upload
    const handleImageUpload = async (file: File) => {
        setUploading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await apiClient.post('/api/upload/image?bookId=categories&type=cover', formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setFormData(prev => ({ ...prev, image: response.data.url }));
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
        }
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
                            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                        >
                            {/* Category Preview Card */}
                            <div 
                                className="relative h-24 flex items-center px-4 overflow-hidden"
                                style={{ 
                                    background: `linear-gradient(to right, ${category.gradientFrom || category.color}, ${category.gradientTo || category.color})` 
                                }}
                            >
                                {/* Category Name */}
                                <h3 className="text-xl font-bold text-white drop-shadow-md z-10">{category.name}</h3>
                                
                                {/* Category Image or Icon */}
                                {category.image ? (
                                    <img 
                                        src={category.image} 
                                        alt={category.name}
                                        className="absolute right-0 top-0 h-full w-1/2 object-cover object-left"
                                        style={{ maskImage: 'linear-gradient(to right, transparent, black 30%)' }}
                                    />
                                ) : (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-5xl">
                                        {category.icon || <Tag className="w-12 h-12" />}
                                    </div>
                                )}
                            </div>
                            
                            {/* Card Content */}
                            <div className="p-4">
                                {category.description && (
                                    <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                                )}
                                
                                {/* Type Badge */}
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${
                                    category.contentType === 'Audio' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                    {category.contentType === 'Audio' ? (
                                        <><Headphones className="w-3.5 h-3.5" /> Listen Page</>
                                    ) : (
                                        <><BookOpen className="w-3.5 h-3.5" /> Read Page</>
                                    )}
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenModal(category)}
                                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category._id)}
                                        disabled={deleting === category._id}
                                        className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {deleting === category._id ? '...' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
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
                                    Type * <span className="text-gray-500 font-normal">(Where will this category appear?)</span>
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contentType: 'Book' })}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                                            formData.contentType === 'Book'
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-300 hover:border-gray-400 text-gray-600'
                                        }`}
                                    >
                                        <BookOpen className="w-5 h-5" />
                                        <div className="text-left">
                                            <div className="font-semibold">Book</div>
                                            <div className="text-xs opacity-70">Read Page</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contentType: 'Audio' })}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                                            formData.contentType === 'Audio'
                                                ? 'border-green-600 bg-green-50 text-green-700'
                                                : 'border-gray-300 hover:border-gray-400 text-gray-600'
                                        }`}
                                    >
                                        <Headphones className="w-5 h-5" />
                                        <div className="text-left">
                                            <div className="font-semibold">Audio</div>
                                            <div className="text-xs opacity-70">Listen Page</div>
                                        </div>
                                    </button>
                                </div>
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
                            {/* Gradient Color Picker */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Gradient Color
                                </label>
                                {/* Preset Gradients */}
                                <div className="grid grid-cols-6 gap-2 mb-3">
                                    {GRADIENT_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() => setFormData({ 
                                                ...formData, 
                                                gradientFrom: preset.from, 
                                                gradientTo: preset.to,
                                                color: preset.from 
                                            })}
                                            className={`h-8 rounded-lg transition-all ${
                                                formData.gradientFrom === preset.from && formData.gradientTo === preset.to
                                                    ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                                                    : 'hover:scale-105'
                                            }`}
                                            style={{ background: `linear-gradient(to right, ${preset.from}, ${preset.to})` }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                                {/* Custom Color Pickers */}
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">From</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.gradientFrom}
                                                onChange={(e) => setFormData({ ...formData, gradientFrom: e.target.value, color: e.target.value })}
                                                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={formData.gradientFrom}
                                                onChange={(e) => setFormData({ ...formData, gradientFrom: e.target.value, color: e.target.value })}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                                placeholder="#6366f1"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">To</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.gradientTo}
                                                onChange={(e) => setFormData({ ...formData, gradientTo: e.target.value })}
                                                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={formData.gradientTo}
                                                onChange={(e) => setFormData({ ...formData, gradientTo: e.target.value })}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                                placeholder="#8b5cf6"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Category Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category Image <span className="text-gray-400 font-normal">(ultra-wide format recommended)</span>
                                </label>
                                <div className="flex gap-4 items-start">
                                    <label className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-indigo-500 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                                <span className="text-xs text-gray-600">{formData.image ? 'Change image' : 'Upload image'}</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                    </label>
                                    {formData.image && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, image: '' })}
                                            className="text-red-500 hover:text-red-600 text-sm"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* APP PREVIEW - Full width card preview */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    📱 App Preview
                                </label>
                                <div className="bg-gradient-to-b from-blue-900 to-blue-800 p-4 rounded-xl">
                                    {/* Category Card Preview */}
                                    <div 
                                        className="relative overflow-hidden rounded-2xl h-20"
                                        style={{ background: `linear-gradient(to right, ${formData.gradientFrom}, ${formData.gradientTo})` }}
                                    >
                                        {/* Image on right side */}
                                        {formData.image && (
                                            <>
                                                <img 
                                                    src={formData.image} 
                                                    alt="" 
                                                    className="absolute right-0 top-0 h-full w-2/3 object-cover object-center"
                                                />
                                                {/* Gradient overlay - solid on left, transparent on right */}
                                                <div 
                                                    className="absolute inset-0"
                                                    style={{ background: `linear-gradient(to right, ${formData.gradientFrom} 0%, ${formData.gradientFrom} 30%, transparent 70%)` }}
                                                />
                                            </>
                                        )}
                                        
                                        {/* Category name */}
                                        <div className="relative z-10 h-full flex items-center px-4">
                                            <h3 className="text-white text-xl font-bold drop-shadow-lg">
                                                {formData.name || 'Category Name'}
                                            </h3>
                                        </div>
                                        
                                        {/* Fallback icon if no image */}
                                        {!formData.image && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 text-5xl">
                                                {formData.icon || '📚'}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-white/50 text-xs text-center mt-2">This is how it will appear in the app</p>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Icon (emoji)
                                </label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="📖 🎵 🌿"
                                    maxLength={4}
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

