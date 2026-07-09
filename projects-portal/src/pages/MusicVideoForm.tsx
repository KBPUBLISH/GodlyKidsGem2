import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Save, Video, Image as ImageIcon, Star, Lock, Unlock } from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

interface MusicVideoFormData {
    title: string;
    author: string;
    description: string;
    thumbnailUrl: string;
    videoUrl: string;
    duration: number;
    status: 'draft' | 'published';
    isFeatured: boolean;
    featuredOrder: number;
    order: number;
    isMembersOnly: boolean;
    minAge?: number;
}

const MusicVideoForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploadingThumb, setUploadingThumb] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [formData, setFormData] = useState<MusicVideoFormData>({
        title: '',
        author: 'Kingdom Builders Publishing',
        description: '',
        thumbnailUrl: '',
        videoUrl: '',
        duration: 0,
        status: 'draft',
        isFeatured: false,
        featuredOrder: 0,
        order: 0,
        isMembersOnly: true,
        minAge: undefined,
    });

    useEffect(() => {
        if (id) {
            (async () => {
                try {
                    const res = await apiClient.get(`/api/music-videos/${id}`);
                    setFormData({
                        title: res.data.title || '',
                        author: res.data.author || 'Kingdom Builders Publishing',
                        description: res.data.description || '',
                        thumbnailUrl: res.data.thumbnailUrl || '',
                        videoUrl: res.data.videoUrl || '',
                        duration: res.data.duration || 0,
                        status: res.data.status || 'draft',
                        isFeatured: !!res.data.isFeatured,
                        featuredOrder: res.data.featuredOrder || 0,
                        order: res.data.order || 0,
                        isMembersOnly: res.data.isMembersOnly !== false,
                        minAge: res.data.minAge,
                    });
                } catch (err) {
                    console.error('Error loading music video:', err);
                    alert('Failed to load music video');
                }
            })();
        }
    }, [id]);

    const handleThumbnailUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image (16:9 recommended)');
            return;
        }
        setUploadingThumb(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post(
                `/api/upload/image?bookId=music-videos&type=cover`,
                fd,
                { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
            );
            setFormData(prev => ({ ...prev, thumbnailUrl: res.data.url }));
        } catch (err: any) {
            console.error('Thumbnail upload failed:', err);
            alert(`Failed to upload thumbnail: ${err.response?.data?.message || err.message}`);
        } finally {
            setUploadingThumb(false);
        }
    };

    const handleVideoUpload = async (file: File) => {
        if (!file.type.startsWith('video/')) {
            alert('Please upload a video file (MP4 recommended)');
            return;
        }
        setUploadingVideo(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post(
                `/api/upload/video?bookId=music-videos&type=video`,
                fd,
                { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000 }
            );
            const url = res.data.url;

            // Read duration from the uploaded video's metadata
            let duration = 0;
            try {
                const probe = document.createElement('video');
                probe.src = url;
                await new Promise<void>((resolve) => {
                    probe.onloadedmetadata = () => { duration = Math.floor(probe.duration) || 0; resolve(); };
                    probe.onerror = () => resolve();
                    setTimeout(resolve, 8000);
                });
            } catch { /* ignore */ }

            setFormData(prev => ({ ...prev, videoUrl: url, duration: duration || prev.duration }));
        } catch (err: any) {
            console.error('Video upload failed:', err);
            alert(`Failed to upload video: ${err.response?.data?.message || err.message}`);
        } finally {
            setUploadingVideo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent, status?: 'draft' | 'published') => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Please enter a title.');
            return;
        }
        if (!formData.videoUrl) {
            alert('Please upload a video.');
            return;
        }
        const payload = { ...formData, status: status || formData.status };
        setLoading(true);
        try {
            if (id) {
                await apiClient.put(`/api/music-videos/${id}`, payload);
            } else {
                await apiClient.post('/api/music-videos', payload);
            }
            navigate('/music-videos');
        } catch (err: any) {
            console.error('Error saving music video:', err);
            alert(`Failed to save: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const busy = loading || uploadingThumb || uploadingVideo;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/music-videos')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">{id ? 'Edit Music Video' : 'Create Music Video'}</h1>
            </div>

            <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
                {/* Basic info */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Brave Together"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Artist / Author</label>
                            <input
                                type="text"
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="A short description of the music video..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                            <input
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Age</label>
                            <input
                                type="number"
                                min={0}
                                max={18}
                                value={formData.minAge ?? ''}
                                onChange={(e) => setFormData({ ...formData, minAge: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="3"
                            />
                        </div>
                    </div>
                </div>

                {/* Media */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-5">
                    <h2 className="text-xl font-semibold text-gray-800">Media</h2>

                    {/* Video */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Video className="w-4 h-4 text-indigo-500" /> Video File (MP4) *
                        </label>
                        {formData.videoUrl && (
                            <video src={getMediaUrl(formData.videoUrl)} controls className="w-full max-w-md rounded-lg border border-gray-200 bg-black mb-2" />
                        )}
                        <label className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer transition-colors">
                            <Upload className="w-4 h-4" />
                            {uploadingVideo ? 'Uploading…' : formData.videoUrl ? 'Replace Video' : 'Upload Video'}
                            <input
                                type="file"
                                accept="video/mp4,video/quicktime,video/*"
                                disabled={uploadingVideo}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ''; }}
                                className="hidden"
                            />
                        </label>
                        {formData.duration > 0 && (
                            <span className="ml-3 text-sm text-gray-500">Duration: {Math.floor(formData.duration / 60)}:{String(formData.duration % 60).padStart(2, '0')}</span>
                        )}
                    </div>

                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-indigo-500" /> Thumbnail (16:9 recommended)
                        </label>
                        <div className="flex items-start gap-4">
                            {formData.thumbnailUrl && (
                                <img src={getMediaUrl(formData.thumbnailUrl)} alt="Thumbnail" className="w-48 aspect-video object-cover rounded-lg border border-gray-300" />
                            )}
                            <label className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer transition-colors">
                                <Upload className="w-4 h-4" />
                                {uploadingThumb ? 'Uploading…' : formData.thumbnailUrl ? 'Replace Thumbnail' : 'Upload Thumbnail'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingThumb}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); e.target.value = ''; }}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Settings</h2>

                    {/* Featured */}
                    <div
                        onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                        className={`w-full rounded-lg border px-3 py-2 transition cursor-pointer flex items-center justify-between ${formData.isFeatured ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : 'bg-gray-50 border-gray-300 text-gray-600'}`}
                    >
                        <span className="font-medium flex items-center gap-2">
                            <Star className={`w-4 h-4 ${formData.isFeatured ? 'fill-yellow-500' : ''}`} />
                            {formData.isFeatured ? 'Featured — appears in the rotating hero carousel' : 'Not featured'}
                        </span>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isFeatured ? 'bg-yellow-400' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.isFeatured ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </div>
                    {formData.isFeatured && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Featured Order (lower shows first in carousel)</label>
                            <input
                                type="number"
                                value={formData.featuredOrder}
                                onChange={(e) => setFormData({ ...formData, featuredOrder: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {/* Members only */}
                    <div
                        onClick={() => setFormData({ ...formData, isMembersOnly: !formData.isMembersOnly })}
                        className={`w-full rounded-lg border px-3 py-2 transition cursor-pointer flex items-center justify-between ${formData.isMembersOnly ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-green-50 border-green-300 text-green-800'}`}
                    >
                        <span className="font-medium flex items-center gap-2">
                            {formData.isMembersOnly ? <><Lock className="w-4 h-4" /> 👑 Members Only</> : <><Unlock className="w-4 h-4" /> 🆓 Free for Everyone</>}
                        </span>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isMembersOnly ? 'bg-amber-400' : 'bg-green-400'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.isMembersOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                    <button type="button" onClick={() => navigate('/music-videos')} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e as any, 'draft')}
                            disabled={busy}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Save as Draft
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e as any, 'published')}
                            disabled={busy}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save & Publish'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default MusicVideoForm;
