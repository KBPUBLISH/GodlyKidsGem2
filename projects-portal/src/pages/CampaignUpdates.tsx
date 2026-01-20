import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Image, MapPin, Gift, Pin, Eye, EyeOff, Upload, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';

interface CampaignUpdate {
    _id: string;
    campaignId: string;
    type: 'photo' | 'video' | 'milestone' | 'thankyou';
    caption: string;
    images: { url: string; caption?: string }[];
    videoUrl?: string;
    location?: string;
    itemsDonated: number;
    likes: number;
    isPinned: boolean;
    isActive: boolean;
    createdAt: string;
}

interface Campaign {
    _id: string;
    title: string;
}

const CampaignUpdates: React.FC = () => {
    const { campaignId } = useParams();
    const navigate = useNavigate();
    
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        type: 'photo' as const,
        caption: '',
        images: [] as { url: string; caption?: string }[],
        location: '',
        itemsDonated: 0,
        isPinned: false
    });
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (campaignId) {
            fetchCampaign();
            fetchUpdates();
        }
    }, [campaignId]);

    const fetchCampaign = async () => {
        try {
            const response = await apiClient.get(`/api/campaigns/${campaignId}`);
            setCampaign(response.data);
        } catch (error) {
            console.error('Error fetching campaign:', error);
        }
    };

    const fetchUpdates = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/api/campaign-updates/campaign/${campaignId}?limit=50`);
            setUpdates(response.data.updates || []);
        } catch (error) {
            console.error('Error fetching updates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddImage = () => {
        if (imageUrl.trim()) {
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, { url: imageUrl.trim() }]
            }));
            setImageUrl('');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }

        setUploading(true);
        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const response = await apiClient.post('/api/upload/image?bookId=campaign-updates&type=photo', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            
            if (response.data.url) {
                setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, { url: response.data.url }]
                }));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. You can paste a URL instead.');
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.caption.trim()) {
            alert('Please enter a caption');
            return;
        }

        setSaving(true);
        try {
            await apiClient.post('/api/campaign-updates', {
                campaignId,
                ...formData
            });
            
            // Reset form
            setFormData({
                type: 'photo',
                caption: '',
                images: [],
                location: '',
                itemsDonated: 0,
                isPinned: false
            });
            setShowForm(false);
            fetchUpdates();
        } catch (error) {
            console.error('Error creating update:', error);
            alert('Failed to create update');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (update: CampaignUpdate) => {
        try {
            await apiClient.put(`/api/campaign-updates/${update._id}`, {
                isActive: !update.isActive
            });
            fetchUpdates();
        } catch (error) {
            console.error('Error toggling active:', error);
        }
    };

    const handleTogglePin = async (update: CampaignUpdate) => {
        try {
            await apiClient.put(`/api/campaign-updates/${update._id}`, {
                isPinned: !update.isPinned
            });
            fetchUpdates();
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleDelete = async (updateId: string) => {
        if (!confirm('Are you sure you want to delete this update?')) return;
        
        try {
            await apiClient.delete(`/api/campaign-updates/${updateId}`);
            fetchUpdates();
        } catch (error) {
            console.error('Error deleting update:', error);
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => navigate('/campaigns')}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Campaign Updates</h1>
                    {campaign && (
                        <p className="text-gray-500">{campaign.title}</p>
                    )}
                </div>
            </div>

            {/* Add Update Button */}
            <button
                onClick={() => setShowForm(true)}
                className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                <Plus className="w-5 h-5" />
                Post Update
            </button>

            {/* Create Update Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-4">Post Update</h2>
                            
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Caption */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Caption *
                                    </label>
                                    <textarea
                                        value={formData.caption}
                                        onChange={(e) => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                                        placeholder="Share what's happening..."
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        maxLength={500}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{formData.caption.length}/500</p>
                                </div>

                                {/* Images */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Image className="w-4 h-4 inline mr-1" />
                                        Photos
                                    </label>
                                    
                                    {/* Upload Button */}
                                    <div className="mb-3">
                                        <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                                    <span className="text-sm text-gray-600">Uploading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-5 h-5 text-gray-500" />
                                                    <span className="text-sm text-gray-600">Upload Photo</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={uploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>

                                    {/* Or paste URL */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1 h-px bg-gray-200"></div>
                                        <span className="text-xs text-gray-400">or paste URL</span>
                                        <div className="flex-1 h-px bg-gray-200"></div>
                                    </div>
                                    
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={imageUrl}
                                            onChange={(e) => setImageUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddImage}
                                            disabled={!imageUrl.trim()}
                                            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {/* Image Preview Grid */}
                                    {formData.images.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2">
                                            {formData.images.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square group">
                                                    <img 
                                                        src={img.url} 
                                                        alt="" 
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(idx)}
                                                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <MapPin className="w-4 h-4 inline mr-1" />
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                        placeholder="e.g., Downtown LA"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                                    />
                                </div>

                                {/* Items Donated */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Gift className="w-4 h-4 inline mr-1" />
                                        Items Donated
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.itemsDonated}
                                        onChange={(e) => setFormData(prev => ({ ...prev, itemsDonated: parseInt(e.target.value) || 0 }))}
                                        min={0}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                                    />
                                </div>

                                {/* Pin option */}
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isPinned}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isPinned: e.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                    <Pin className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">Pin to top</span>
                                </label>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? 'Posting...' : 'Post Update'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Updates List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : updates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                    <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No updates yet</p>
                    <p className="text-gray-400 text-sm">Post your first update to share with supporters!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {updates.map((update) => (
                        <div 
                            key={update._id}
                            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                                !update.isActive ? 'opacity-50' : ''
                            } ${update.isPinned ? 'border-yellow-400' : 'border-gray-100'}`}
                        >
                            {/* Images */}
                            {update.images.length > 0 && (
                                <div className={`${update.images.length > 1 ? 'grid grid-cols-2' : ''}`}>
                                    {update.images.slice(0, 4).map((img, idx) => (
                                        <img 
                                            key={idx}
                                            src={img.url} 
                                            alt="" 
                                            className={`w-full object-cover ${
                                                update.images.length === 1 ? 'h-48' : 'h-32'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                            
                            <div className="p-4">
                                {/* Status badges */}
                                <div className="flex gap-2 mb-2">
                                    {update.isPinned && (
                                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                                            <Pin className="w-3 h-3" /> Pinned
                                        </span>
                                    )}
                                    {!update.isActive && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            Hidden
                                        </span>
                                    )}
                                </div>
                                
                                {/* Caption */}
                                <p className="text-gray-700 mb-2">{update.caption}</p>
                                
                                {/* Meta */}
                                <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                                    {update.location && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {update.location}
                                        </span>
                                    )}
                                    {update.itemsDonated > 0 && (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <Gift className="w-4 h-4" />
                                            {update.itemsDonated} donated
                                        </span>
                                    )}
                                    <span>❤️ {update.likes} likes</span>
                                    <span>{new Date(update.createdAt).toLocaleDateString()}</span>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleTogglePin(update)}
                                        className={`p-2 rounded-lg ${
                                            update.isPinned ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                        }`}
                                        title={update.isPinned ? 'Unpin' : 'Pin to top'}
                                    >
                                        <Pin className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleToggleActive(update)}
                                        className={`p-2 rounded-lg ${
                                            update.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}
                                        title={update.isActive ? 'Hide' : 'Show'}
                                    >
                                        {update.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(update._id)}
                                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CampaignUpdates;
