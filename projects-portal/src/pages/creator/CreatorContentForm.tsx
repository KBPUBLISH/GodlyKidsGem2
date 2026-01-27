import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Upload, 
  Music2, 
  Plus, 
  Trash2, 
  GripVertical,
  ArrowLeft,
  Save,
  DollarSign,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface AudioItem {
  _id?: string;
  title: string;
  description: string;
  coverImage: string;
  audioUrl: string;
  duration?: number;
  order: number;
}

interface PlaylistData {
  title: string;
  description: string;
  type: 'Audiobook' | 'Song';
  priceTokens: number;
  priceUSD: number | null;
  usdPurchaseEnabled: boolean;
  coverImage: string;
  categories: string[];
  minAge?: number;
  items: AudioItem[];
}

const CreatorContentForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [data, setData] = useState<PlaylistData>({
    title: '',
    description: '',
    type: 'Audiobook',
    priceTokens: 10,
    priceUSD: null,
    usdPurchaseEnabled: false,
    coverImage: '',
    categories: ['Godly Hub'],
    items: [],
  });

  useEffect(() => {
    if (isEditing) {
      fetchPlaylist();
    }
  }, [id]);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/api/hub/my-playlists/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const playlist = res.data.playlist;
      setData({
        title: playlist.title,
        description: playlist.description || '',
        type: playlist.type,
        priceTokens: playlist.priceTokens,
        priceUSD: playlist.priceUSD || null,
        usdPurchaseEnabled: playlist.usdPurchaseEnabled || false,
        coverImage: playlist.coverImage || '',
        categories: playlist.categories || ['Godly Hub'],
        minAge: playlist.minAge,
        items: playlist.items || [],
      });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      alert('Failed to load content');
      navigate('/creator/content');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'cover' | 'item', itemIndex?: number) => {
    const uploadKey = type === 'cover' ? 'cover' : `item-${itemIndex}`;
    setUploading(uploadKey);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await axios.post(
        `${API_URL}/api/upload/image?bookId=hub-content&type=${type}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const imageUrl = res.data.url;

      if (type === 'cover') {
        setData(prev => ({ ...prev, coverImage: imageUrl }));
      } else if (itemIndex !== undefined) {
        setData(prev => ({
          ...prev,
          items: prev.items.map((item, i) => 
            i === itemIndex ? { ...item, coverImage: imageUrl } : item
          ),
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  const handleAudioUpload = async (file: File, itemIndex: number) => {
    setUploading(`audio-${itemIndex}`);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const res = await axios.post(
        `${API_URL}/api/upload/audio?bookId=hub-content&type=episode`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const audioUrl = res.data.url;

      setData(prev => ({
        ...prev,
        items: prev.items.map((item, i) => 
          i === itemIndex ? { ...item, audioUrl, duration: res.data.duration } : item
        ),
      }));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload audio');
    } finally {
      setUploading(null);
    }
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          title: `Episode ${prev.items.length + 1}`,
          description: '',
          coverImage: '',
          audioUrl: '',
          order: prev.items.length,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof AudioItem, value: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSave = async (submit = false) => {
    if (!data.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (data.priceTokens < 1 || data.priceTokens > 500) {
      alert('Token price must be between 1 and 500 tokens');
      return;
    }

    if (data.usdPurchaseEnabled && (!data.priceUSD || data.priceUSD < 0.99 || data.priceUSD > 99.99)) {
      alert('USD price must be between $0.99 and $99.99');
      return;
    }

    if (submit && data.items.length === 0) {
      alert('Please add at least one episode');
      return;
    }

    if (submit && data.items.some(item => !item.audioUrl)) {
      alert('All episodes must have audio files');
      return;
    }

    setSaving(true);

    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      let playlistId = id;

      if (isEditing) {
        await axios.put(`${API_URL}/api/hub/my-playlists/${id}`, data, { headers });
      } else {
        const res = await axios.post(`${API_URL}/api/hub/my-playlists`, data, { headers });
        playlistId = res.data.playlist._id;
      }

      if (submit && playlistId) {
        await axios.post(
          `${API_URL}/api/hub/my-playlists/${playlistId}/submit`,
          {},
          { headers }
        );
        alert('Content submitted for review!');
      }

      navigate('/creator/content');
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const estimatedEarnings = (data.priceTokens * 0.54).toFixed(2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/creator/content')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Content' : 'Create New Content'}
          </h1>
          <p className="text-gray-500">Fill in the details below</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cover Image
          </label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {data.coverImage ? (
                <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-10 h-10 text-gray-300" />
                </div>
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading === 'cover' ? 'Uploading...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'cover')}
                  disabled={uploading === 'cover'}
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">Recommended: 1000x1000px, JPG or PNG</p>
            </div>
          </div>
        </div>

        {/* Title & Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={data.type}
              onChange={(e) => setData(prev => ({ ...prev, type: e.target.value as 'Audiobook' | 'Song' }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="Audiobook">Audiobook</option>
              <option value="Song">Song Album</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Describe your content..."
          />
        </div>

        {/* Pricing Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Pricing Options
          </h3>

          {/* Token Price */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Price (in-app purchases) *
            </label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="number"
                  value={data.priceTokens}
                  onChange={(e) => setData(prev => ({ ...prev, priceTokens: parseInt(e.target.value) || 0 }))}
                  min={1}
                  max={500}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">tokens</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-green-700">
                  ~${estimatedEarnings} your earnings
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Token purchases: After fees (Apple 15% + GodlyKids 20%), you earn ~$0.54 per token.
            </p>
          </div>

          {/* USD Price (Stripe) */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                USD Price (Stripe checkout)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.usdPurchaseEnabled}
                  onChange={(e) => setData(prev => ({ 
                    ...prev, 
                    usdPurchaseEnabled: e.target.checked,
                    priceUSD: e.target.checked && !prev.priceUSD ? 4.99 : prev.priceUSD
                  }))}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">Enable USD purchases</span>
              </label>
            </div>
            
            {data.usdPurchaseEnabled && (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={data.priceUSD || ''}
                      onChange={(e) => setData(prev => ({ ...prev, priceUSD: parseFloat(e.target.value) || null }))}
                      min={0.99}
                      max={99.99}
                      step={0.01}
                      placeholder="4.99"
                      className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    />
                  </div>
                  {data.priceUSD && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-700">
                        ~${(data.priceUSD * 0.70).toFixed(2)} your earnings
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Stripe purchases: After fees (Stripe 3% + GodlyKids 27%), you earn ~70% of the price.
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  💡 USD purchases bypass Apple's IAP, allowing direct credit card payments via Stripe.
                </p>
              </>
            )}
            
            {!data.usdPurchaseEnabled && (
              <p className="text-xs text-gray-500">
                Enable this to allow parents to purchase directly with credit card (higher creator earnings).
              </p>
            )}
          </div>
        </div>

        {/* Age Recommendation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Age (optional)
          </label>
          <select
            value={data.minAge || ''}
            onChange={(e) => setData(prev => ({ ...prev, minAge: e.target.value ? parseInt(e.target.value) : undefined }))}
            className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All ages</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
            <option value="7">7+</option>
            <option value="10">10+</option>
            <option value="13">13+</option>
          </select>
        </div>
      </div>

      {/* Episodes/Songs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {data.type === 'Audiobook' ? 'Episodes' : 'Songs'}
          </h2>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add {data.type === 'Audiobook' ? 'Episode' : 'Song'}
          </button>
        </div>

        <div className="space-y-4">
          {data.items.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-700">
                    {data.type === 'Audiobook' ? `Episode ${index + 1}` : `Track ${index + 1}`}
                  </span>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(index, 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Episode title"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Audio File *</label>
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-sm w-full justify-center">
                    <Upload className="w-4 h-4" />
                    {uploading === `audio-${index}` 
                      ? 'Uploading...' 
                      : item.audioUrl 
                        ? 'Replace Audio' 
                        : 'Upload Audio'
                    }
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], index)}
                      disabled={uploading === `audio-${index}`}
                    />
                  </label>
                  {item.audioUrl && (
                    <p className="text-xs text-green-600 mt-1">✓ Audio uploaded</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Brief description"
                />
              </div>
            </div>
          ))}

          {data.items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No {data.type === 'Audiobook' ? 'episodes' : 'songs'} yet</p>
              <button
                onClick={addItem}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2"
              >
                Add your first {data.type === 'Audiobook' ? 'episode' : 'song'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button
          onClick={() => navigate('/creator/content')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || data.items.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatorContentForm;
