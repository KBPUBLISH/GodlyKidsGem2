import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Plus, Trash2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { getMediaUrl } from '../services/apiClient';

const MAX_VIDEO_SIZE_MB = 80;
const MAX_VIDEO_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_AUDIO_SIZE_MB = 30;
const MAX_AUDIO_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;

const API_BASE = () => import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';

async function uploadViaFetch(endpoint: string, body: globalThis.FormData, timeoutMs = 120000): Promise<{ url: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE()}${endpoint}`, {
        method: 'POST',
        body,
        signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(await res.text().catch(() => `Upload failed: ${res.status}`));
    const data = await res.json();
    if (!data?.url) throw new Error('No URL in response');
    return data;
}

/** Get video duration from local file (avoids re-fetching 30MB+ after upload) */
function getVideoDurationFromFile(file: File): Promise<number> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            const dur = Math.round(video.duration);
            video.src = '';
            video.load();
            resolve(dur > 0 ? dur : 0);
        };
        video.onerror = () => {
            URL.revokeObjectURL(url);
            video.src = '';
            resolve(0);
        };
        video.src = url;
    });
}

/** Direct browser-to-GCS upload via signed URL - bypasses backend, avoids Chrome resource limits */
async function uploadViaSignedUrl(
    bookId: string,
    type: 'video' | 'audio',
    file: File,
    songId?: string,
    timeoutMs = 300000
): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE()}/api/upload/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bookId,
            type,
            contentType: file.type || 'application/octet-stream',
            filename: file.name,
            songId: songId || undefined,
        }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => `Failed to get upload URL: ${res.status}`));
    const { uploadUrl, publicUrl } = await res.json();
    if (!uploadUrl || !publicUrl) throw new Error('Invalid signed URL response');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
        signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status} ${await putRes.text().catch(() => '')}`);
    return { url: publicUrl };
}

interface LyricLine {
    text: string;
    startTime: number;
    endTime: number;
}

interface KaraokeFormData {
    title: string;
    description: string;
    coverImage: string;
    videoUrl: string;
    backgroundAudioUrl: string;
    duration: number;
    lyrics: LyricLine[];
    status: 'draft' | 'published';
    order: number;
    minAge?: number;
    isMembersOnly: boolean;
    goalTags: string[];
}

/** Resize/compress image to avoid ERR_INSUFFICIENT_RESOURCES with large uploads */
async function resizeImageForUpload(file: File, maxSize = 600, quality = 0.75): Promise<File> {
    if (file.size < 200 * 1024) return file; // Skip if already under 200KB
    return new Promise<File>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const w = img.width;
            const h = img.height;
            if (w <= maxSize && h <= maxSize) {
                resolve(file);
                return;
            }
            const scale = maxSize / Math.max(w, h);
            const cw = Math.round(w * scale);
            const ch = Math.round(h * scale);
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }
            ctx.drawImage(img, 0, 0, cw, ch);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
}

const GOAL_TAGS = [
    { id: 'courage', label: '🦁 Courage' },
    { id: 'faith', label: '🙏 Faith' },
    { id: 'gratitude', label: '💝 Gratitude' },
    { id: 'love', label: '❤️ Love' },
    { id: 'obedience', label: '👂 Obedience' },
    { id: 'self-control', label: '🎯 Self-Control' },
    { id: 'theology', label: '✝️ Theology' },
    { id: 'wisdom', label: '🦉 Wisdom' },
];

const KaraokeForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(!!id);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const uploadLockRef = useRef(false); // Prevent concurrent uploads (causes ERR_INSUFFICIENT_RESOURCES)
    const coverInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<KaraokeFormData>({
        title: '',
        description: '',
        coverImage: '',
        videoUrl: '',
        backgroundAudioUrl: '',
        duration: 0,
        lyrics: [],
        status: 'draft',
        order: 0,
        isMembersOnly: false,
        goalTags: [],
    });

    const songId = id && id !== 'new' ? id : 'temp';
    const bookIdForUpload = id && id !== 'new' ? `karaoke/${id}` : 'karaoke';

    useEffect(() => {
        if (id && id !== 'new') {
            fetchSong();
        } else {
            setFetching(false);
        }
    }, [id]);

    const fetchSong = async () => {
        try {
            const response = await apiClient.get(`/api/karaoke/${id}`);
            const s = response.data;
            setFormData({
                title: s.title || '',
                description: s.description || '',
                coverImage: s.coverImage || '',
                videoUrl: s.videoUrl || '',
                backgroundAudioUrl: s.backgroundAudioUrl || '',
                duration: s.duration || 0,
                lyrics: Array.isArray(s.lyrics) ? s.lyrics : [],
                status: s.status || 'draft',
                order: s.order ?? 0,
                minAge: s.minAge,
                isMembersOnly: s.isMembersOnly || false,
                goalTags: Array.isArray(s.goalTags) ? s.goalTags : [],
            });
        } catch (error) {
            console.error('Error fetching song:', error);
            alert('Failed to load song');
            navigate('/karaoke');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'duration' || name === 'order' || name === 'minAge' ? (value ? Number(value) : undefined) : value),
        }));
    };

    const showUploadError = (type: string, err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const isResources = msg.includes('ERR_INSUFFICIENT_RESOURCES') || msg.includes('Failed to fetch') || msg.includes('AbortError');
        alert(isResources
            ? `Upload failed (browser ran out of resources). Try: 1) Close other tabs and refresh, 2) Upload one file at a time, 3) Use smaller/compressed files.`
            : `Failed to upload ${type}: ${msg}`
        );
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file?.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (uploadLockRef.current) {
            alert('Please wait for the current upload to finish.');
            e.target.value = '';
            return;
        }
        uploadLockRef.current = true;
        setUploadingCover(true);
        try {
            const resized = await resizeImageForUpload(file);
            const fd = new FormData();
            fd.append('file', resized);
            const data = await uploadViaFetch(`/api/upload/image?bookId=${bookIdForUpload}&type=cover&songId=${songId}`, fd, 60000);
            setFormData(prev => ({ ...prev, coverImage: data.url }));
        } catch (err) {
            console.error('Cover upload failed:', err);
            showUploadError('cover image', err);
        } finally {
            setUploadingCover(false);
            uploadLockRef.current = false;
            if (coverInputRef.current) coverInputRef.current.value = '';
            e.target.value = '';
        }
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file?.type.startsWith('video/')) {
            alert('Please select a video file');
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            alert(`Video must be under ${MAX_VIDEO_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Please compress it first.`);
            e.target.value = '';
            return;
        }
        if (uploadLockRef.current) {
            alert('Please wait for the current upload to finish.');
            e.target.value = '';
            return;
        }
        uploadLockRef.current = true;
        setUploadingVideo(true);
        // Get duration from local file first (avoids re-fetching 30MB+ after upload)
        const duration = await getVideoDurationFromFile(file);
        // Always use direct-to-GCS for video: browser uploads to storage.googleapis.com, not through backend.
        // This avoids ERR_INSUFFICIENT_RESOURCES when proxying 30MB+ through Render.
        try {
            const data = await uploadViaSignedUrl(bookIdForUpload, 'video', file, songId, 300000);
            setFormData(prev => ({ ...prev, videoUrl: data.url, duration: duration || prev.duration }));
        } catch (err) {
            console.error('Video upload failed:', err);
            showUploadError('video', err);
        } finally {
            setUploadingVideo(false);
            uploadLockRef.current = false;
            if (videoInputRef.current) videoInputRef.current.value = '';
            e.target.value = '';
        }
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = (file.name || '').toLowerCase().slice(-4);
        if (!file.type.startsWith('audio/') && !['.mp3', '.wav', '.m4a', '.ogg'].includes(ext) && !file.name?.toLowerCase().endsWith('.mp3')) {
            alert('Please select an audio file (MP3, WAV, M4A, OGG)');
            return;
        }
        if (file.size > MAX_AUDIO_BYTES) {
            alert(`Audio must be under ${MAX_AUDIO_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
            e.target.value = '';
            return;
        }
        if (uploadLockRef.current) {
            alert('Please wait for the current upload to finish.');
            e.target.value = '';
            return;
        }
        uploadLockRef.current = true;
        setUploadingAudio(true);
        // Always use direct-to-GCS for audio (same as video) - avoids ERR_INSUFFICIENT_RESOURCES
        try {
            const data = await uploadViaSignedUrl(bookIdForUpload, 'audio', file, songId, 120000);
            setFormData(prev => ({ ...prev, backgroundAudioUrl: data.url }));
        } catch (err) {
            console.error('Audio upload failed:', err);
            showUploadError('audio', err);
        } finally {
            setUploadingAudio(false);
            uploadLockRef.current = false;
            if (audioInputRef.current) audioInputRef.current.value = '';
            e.target.value = '';
        }
    };

    const addLyric = () => {
        setFormData(prev => ({
            ...prev,
            lyrics: [...prev.lyrics, { text: '', startTime: 0, endTime: 0 }],
        }));
    };

    const updateLyric = (index: number, field: keyof LyricLine, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            lyrics: prev.lyrics.map((l, i) =>
                i === index ? { ...l, [field]: value } : l
            ),
        }));
    };

    const removeLyric = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lyrics: prev.lyrics.filter((_, i) => i !== index),
        }));
    };

    const handleGoalTagToggle = (tagId: string) => {
        setFormData(prev => ({
            ...prev,
            goalTags: prev.goalTags.includes(tagId)
                ? prev.goalTags.filter(t => t !== tagId)
                : [...prev.goalTags, tagId],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Please enter a title');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                coverImage: formData.coverImage || undefined,
                videoUrl: formData.videoUrl || undefined,
                backgroundAudioUrl: formData.backgroundAudioUrl || undefined,
                duration: formData.duration || 0,
                lyrics: formData.lyrics,
                status: formData.status,
                order: formData.order,
                minAge: formData.minAge,
                isMembersOnly: formData.isMembersOnly,
                goalTags: formData.goalTags,
            };
            if (id && id !== 'new') {
                await apiClient.put(`/api/karaoke/${id}`, payload);
            } else {
                await apiClient.post('/api/karaoke', payload);
            }
            navigate('/karaoke');
        } catch (error) {
            console.error('Error saving song:', error);
            alert('Failed to save song');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/karaoke')}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                    {id && id !== 'new' ? 'Edit Karaoke Song' : 'Create Karaoke Song'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Basic Info</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Song title"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            rows={2}
                            placeholder="Optional description"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                            <input
                                type="number"
                                name="order"
                                value={formData.order}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                min={0}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isMembersOnly"
                            name="isMembersOnly"
                            checked={formData.isMembersOnly}
                            onChange={handleChange}
                            className="rounded"
                        />
                        <label htmlFor="isMembersOnly" className="text-sm text-gray-700">Members only</label>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Media</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                        <div className="flex items-center gap-4">
                            {formData.coverImage && (
                                <img src={getMediaUrl(formData.coverImage)} alt="Cover" className="w-24 h-24 object-cover rounded-lg" />
                            )}
                            <div>
                                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" id="cover-upload" disabled={uploadingCover || uploadingVideo || uploadingAudio} />
                                <label
                                    htmlFor={uploadingCover || uploadingVideo || uploadingAudio ? undefined : 'cover-upload'}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 ${uploadingCover || uploadingVideo || uploadingAudio ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploadingCover ? 'Uploading...' : 'Upload cover'}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Video (karaoke-style with lyric prompts)</label>
                        <div className="flex items-center gap-4">
                            {formData.videoUrl && (
                                <video src={getMediaUrl(formData.videoUrl)} controls className="max-w-xs max-h-32 rounded" />
                            )}
                            <div>
                                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" id="video-upload" disabled={uploadingCover || uploadingVideo || uploadingAudio} />
                                <label
                                    htmlFor={uploadingCover || uploadingVideo || uploadingAudio ? undefined : 'video-upload'}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 ${uploadingCover || uploadingVideo || uploadingAudio ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploadingVideo ? 'Uploading...' : 'Upload video'}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Background Audio (for recording/mix)</label>
                        <div className="flex items-center gap-4">
                            {formData.backgroundAudioUrl && (
                                <audio src={getMediaUrl(formData.backgroundAudioUrl)} controls className="max-w-md" />
                            )}
                            <div>
                                <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" id="audio-upload" disabled={uploadingCover || uploadingVideo || uploadingAudio} />
                                <label
                                    htmlFor={uploadingCover || uploadingVideo || uploadingAudio ? undefined : 'audio-upload'}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 ${uploadingCover || uploadingVideo || uploadingAudio ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploadingAudio ? 'Uploading...' : 'Upload audio'}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                        <input
                            type="number"
                            name="duration"
                            value={formData.duration || ''}
                            onChange={handleChange}
                            className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                            min={0}
                            placeholder="Auto from video"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800">Lyrics</h2>
                        <button type="button" onClick={addLyric} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 text-sm">
                            <Plus className="w-4 h-4" />
                            Add line
                        </button>
                    </div>
                    <p className="text-sm text-gray-500">Lyrics with start/end times in seconds for karaoke highlighting.</p>
                    {formData.lyrics.length === 0 ? (
                        <p className="text-gray-400 text-sm">No lyrics yet. Add lines with text and timing.</p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {formData.lyrics.map((lyric, i) => (
                                <div key={i} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                                    <input
                                        type="text"
                                        value={lyric.text}
                                        onChange={e => updateLyric(i, 'text', e.target.value)}
                                        placeholder="Lyric text"
                                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
                                    />
                                    <input
                                        type="number"
                                        value={lyric.startTime}
                                        onChange={e => updateLyric(i, 'startTime', Number(e.target.value) || 0)}
                                        placeholder="Start"
                                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                                        step={0.1}
                                        min={0}
                                    />
                                    <input
                                        type="number"
                                        value={lyric.endTime}
                                        onChange={e => updateLyric(i, 'endTime', Number(e.target.value) || 0)}
                                        placeholder="End"
                                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                                        step={0.1}
                                        min={0}
                                    />
                                    <button type="button" onClick={() => removeLyric(i)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Goal Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {GOAL_TAGS.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleGoalTagToggle(t.id)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${formData.goalTags.includes(t.id)
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/karaoke')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default KaraokeForm;
