import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Heart, Upload } from 'lucide-react';
import apiClient from '../services/apiClient';

interface CampaignData {
    title: string;
    description: string;
    image: string;
    goalCoins: number;
    isRecurring: boolean;
    isActive: boolean;
    category: string;
    sortOrder: number;
    partnerName: string;
    partnerLogo: string;
}

const CampaignForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<CampaignData>({
        title: '',
        description: '',
        image: '',
        goalCoins: 500,
        isRecurring: true,
        isActive: true,
        category: 'other',
        sortOrder: 0,
        partnerName: '',
        partnerLogo: '',
    });

    useEffect(() => {
        if (isEditing) {
            fetchCampaign();
        }
    }, [id]);

    const fetchCampaign = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/api/campaigns/${id}`);
            const campaign = response.data;
            setFormData({
                title: campaign.title || '',
                description: campaign.description || '',
                image: campaign.image || '',
                goalCoins: campaign.goalCoins || 500,
                isRecurring: campaign.isRecurring !== false,
                isActive: campaign.isActive !== false,
                category: campaign.category || 'other',
                sortOrder: campaign.sortOrder || 0,
                partnerName: campaign.partnerName || '',
                partnerLogo: campaign.partnerLogo || '',
            });
        } catch (error) {
            console.error('Error fetching campaign:', error);
            alert('Failed to load campaign');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            alert('Please enter a campaign title');
            return;
        }
        
        if (!formData.description.trim()) {
            alert('Please enter a campaign description');
            return;
        }

        setSaving(true);
        try {
            if (isEditing) {
                await apiClient.put(`/api/campaigns/${id}`, formData);
            } else {
                await apiClient.post('/api/campaigns', formData);
            }
            navigate('/campaigns');
        } catch (error) {
            console.error('Error saving campaign:', error);
            alert('Failed to save campaign');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await apiClient.post('/api/upload/image?bookId=campaigns&type=cover', formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setFormData(prev => ({ ...prev, image: response.data.url }));
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. You can paste a URL instead.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/campaigns')}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isEditing ? 'Edit Campaign' : 'New Campaign'}
                    </h1>
                    <p className="text-gray-500">
                        {isEditing ? 'Update campaign details' : 'Create a new giving campaign'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Campaign Details</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g., Pair of Socks"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description *
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Help keep someone warm this winter!"
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campaign Image
                            </label>
                            <div className="flex items-center gap-4">
                                {formData.image ? (
                                    <img 
                                        src={formData.image} 
                                        alt="Campaign" 
                                        className="w-24 h-24 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-lg bg-pink-100 flex items-center justify-center">
                                        <Heart className="w-8 h-8 text-pink-400" />
                                    </div>
                                )}
                                <div>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                                        <Upload className="w-4 h-4" />
                                        <span>Upload Image</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                    <p className="text-xs text-gray-400 mt-1">or paste URL below</p>
                                    <input
                                        type="text"
                                        value={formData.image}
                                        onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                        placeholder="https://..."
                                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-200 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Goal Settings */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Goal Settings</h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Goal (Gold Coins)
                            </label>
                            <input
                                type="number"
                                value={formData.goalCoins}
                                onChange={(e) => setFormData(prev => ({ ...prev, goalCoins: parseInt(e.target.value) || 500 }))}
                                min={1}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            >
                                <option value="clothing">Clothing</option>
                                <option value="food">Food</option>
                                <option value="hygiene">Hygiene</option>
                                <option value="shelter">Shelter</option>
                                <option value="education">Education</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sort Order
                            </label>
                            <input
                                type="number"
                                value={formData.sortOrder}
                                onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-400 mt-1">Lower numbers appear first</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isRecurring}
                                onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                                className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                            />
                            <div>
                                <span className="font-medium text-gray-700">Recurring Campaign</span>
                                <p className="text-xs text-gray-400">Automatically resets when goal is reached</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                            />
                            <div>
                                <span className="font-medium text-gray-700">Active</span>
                                <p className="text-xs text-gray-400">Show this campaign in the app</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Partner Info (Optional) */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Partner Info (Optional)</h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Partner Name
                            </label>
                            <input
                                type="text"
                                value={formData.partnerName}
                                onChange={(e) => setFormData(prev => ({ ...prev, partnerName: e.target.value }))}
                                placeholder="e.g., Local Food Bank"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Partner Logo URL
                            </label>
                            <input
                                type="text"
                                value={formData.partnerLogo}
                                onChange={(e) => setFormData(prev => ({ ...prev, partnerLogo: e.target.value }))}
                                placeholder="https://..."
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/campaigns')}
                        className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {isEditing ? 'Update Campaign' : 'Create Campaign'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CampaignForm;
