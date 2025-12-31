import React, { useEffect, useState } from 'react';
import { Volume2, Play, Pause, RefreshCw, XCircle, Image, Edit2, Save, X, Crown } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface Voice {
    _id?: string;
    voiceId: string;
    name: string;
    customName?: string;
    category: string;
    previewUrl?: string;
    characterImage?: string;
    enabled: boolean;
    showInApp: boolean;
    description?: string;
    ageGroup?: string;
    language?: string;
    displayOrder?: number;
    isPremium?: boolean;
}

const Voices: React.FC = () => {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);
    const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
    const [editingVoice, setEditingVoice] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ customName: string; characterImage: string; isPremium: boolean }>({
        customName: '',
        characterImage: '',
        isPremium: false
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        fetchVoices();
        return () => {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio.src = '';
            }
        };
    }, []);

    const fetchVoices = async () => {
        try {
            const response = await apiClient.get('/api/voices');
            setVoices(response.data);
        } catch (error) {
            console.error('Error fetching voices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await apiClient.get('/api/voices/sync');
            alert(`Synced ${response.data.synced} voices (${response.data.created} new, ${response.data.updated} updated)`);
            await fetchVoices();
        } catch (error: any) {
            console.error('Error syncing voices:', error);
            alert(error.response?.data?.message || 'Failed to sync voices');
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleEnabled = async (voice: Voice) => {
        try {
            const endpoint = voice.enabled 
                ? `/api/voices/${voice.voiceId}/disable`
                : `/api/voices/${voice.voiceId}/enable`;
            
            await apiClient.put(endpoint);
            await fetchVoices();
        } catch (error: any) {
            console.error('Error toggling voice:', error);
            alert(error.response?.data?.message || 'Failed to update voice');
        }
    };

    const handleToggleShowInApp = async (voice: Voice) => {
        try {
            await apiClient.put(`/api/voices/${voice.voiceId}`, {
                showInApp: !voice.showInApp
            });
            await fetchVoices();
        } catch (error: any) {
            console.error('Error toggling showInApp:', error);
            alert(error.response?.data?.message || 'Failed to update voice');
        }
    };

    const handleDeselectAll = async () => {
        if (!confirm('Are you sure you want to disable all voices? This will remove all voices from app use.')) {
            return;
        }

        try {
            const enabledVoices = voices.filter(v => v.enabled);
            if (enabledVoices.length === 0) {
                alert('No voices are currently enabled.');
                return;
            }

            const disablePromises = enabledVoices.map(voice =>
                apiClient.put(`/api/voices/${voice.voiceId}/disable`)
            );

            await Promise.all(disablePromises);
            await fetchVoices();
            alert(`Disabled ${enabledVoices.length} voice(s)`);
        } catch (error: any) {
            console.error('Error deselecting all voices:', error);
            alert(error.response?.data?.message || 'Failed to disable all voices');
        }
    };

    const handlePlayPreview = async (voice: Voice) => {
        if (previewAudio) {
            previewAudio.pause();
            previewAudio.src = '';
            setPreviewAudio(null);
        }

        if (playingPreview === voice.voiceId) {
            setPlayingPreview(null);
            return;
        }

        try {
            const sampleText = `Hello! This is ${voice.customName || voice.name}, a ${voice.category} voice. I can help bring stories to life for children.`;
            
            setPlayingPreview(voice.voiceId);
            
            const response = await apiClient.post('/api/tts/generate', {
                text: sampleText,
                voiceId: voice.voiceId
            });

            if (response.data && response.data.audioUrl) {
                const audio = new Audio(response.data.audioUrl);
                
                audio.onended = () => {
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                };
                
                audio.onerror = (e) => {
                    console.error('Audio playback error:', e);
                    if (audio.error && audio.error.code !== 0) {
                        setPlayingPreview(null);
                        setPreviewAudio(null);
                        alert(`Failed to play preview: ${audio.error.message || 'Unknown error'}`);
                    }
                };
                
                setPreviewAudio(audio);
                
                try {
                    await audio.play();
                } catch (playError: any) {
                    console.error('Play error:', playError);
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                    if (playError.name !== 'NotAllowedError') {
                        alert(`Failed to play preview: ${playError.message || 'Unknown error'}`);
                    }
                }
            } else {
                setPlayingPreview(null);
                alert('No audio URL returned from server');
            }
        } catch (error: any) {
            console.error('Error generating preview:', error);
            setPlayingPreview(null);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to generate preview';
            alert(errorMessage);
        }
    };

    const handleStartEdit = (voice: Voice) => {
        setEditingVoice(voice.voiceId);
        setEditForm({
            customName: voice.customName || '',
            characterImage: voice.characterImage || '',
            isPremium: voice.isPremium || false
        });
    };

    const handleCancelEdit = () => {
        setEditingVoice(null);
        setEditForm({ customName: '', characterImage: '', isPremium: false });
    };

    const handleSaveEdit = async (voiceId: string) => {
        try {
            await apiClient.put(`/api/voices/${voiceId}`, {
                customName: editForm.customName || undefined,
                characterImage: editForm.characterImage || undefined,
                isPremium: editForm.isPremium
            });
            await fetchVoices();
            setEditingVoice(null);
            setEditForm({ customName: '', characterImage: '', isPremium: false });
        } catch (error: any) {
            console.error('Error saving voice:', error);
            alert(error.response?.data?.message || 'Failed to save voice');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, voiceId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Use the correct image upload endpoint with type=voices for organized storage
            const response = await apiClient.post(
                `/api/upload/image?type=voices&voiceId=${voiceId}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            if (response.data?.url) {
                setEditForm(prev => ({ ...prev, characterImage: response.data.url }));
            } else {
                alert('Failed to upload image: No URL returned');
            }
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert(error.response?.data?.message || 'Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const enabledCount = voices.filter(v => v.enabled).length;
    const showInAppCount = voices.filter(v => v.showInApp).length;
    const disabledCount = voices.filter(v => !v.enabled).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading voices...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Voice Management</h1>
                    <p className="text-gray-600 mt-1">
                        Manage which voices are available in the app and customize their appearance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDeselectAll}
                        disabled={voices.filter(v => v.enabled).length === 0}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <XCircle className="w-4 h-4" />
                        Deselect All
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync from ElevenLabs'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Total Voices</div>
                    <div className="text-2xl font-bold text-gray-800">{voices.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-green-600">Enabled</div>
                    <div className="text-2xl font-bold text-green-700">{enabledCount}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-blue-600">Visible in Shop</div>
                    <div className="text-2xl font-bold text-blue-700">{showInAppCount}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Disabled</div>
                    <div className="text-2xl font-bold text-gray-700">{disabledCount}</div>
                </div>
            </div>

            {/* Voices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {voices.length === 0 ? (
                    <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
                        No voices found. Click "Sync from ElevenLabs" to load voices.
                    </div>
                ) : (
                    voices.map((voice) => (
                        <div 
                            key={voice.voiceId} 
                            className={`bg-white rounded-lg shadow overflow-hidden ${
                                voice.enabled ? 'ring-2 ring-green-500' : ''
                            }`}
                        >
                            {/* Voice Card Header */}
                            <div className="relative h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {voice.characterImage ? (
                                    <img 
                                        src={voice.characterImage} 
                                        alt={voice.customName || voice.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Volume2 className="w-16 h-16 text-white/50" />
                                )}
                                
                                {/* Premium Badge */}
                                {voice.isPremium && (
                                    <div className="absolute top-2 right-2 bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <Crown className="w-3 h-3" />
                                        Premium
                                    </div>
                                )}
                                
                                {/* Status Badges */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                        voice.enabled 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-gray-500 text-white'
                                    }`}>
                                        {voice.enabled ? 'Enabled' : 'Disabled'}
                                    </div>
                                    {voice.showInApp && (
                                        <div className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">
                                            In Shop
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Voice Card Body */}
                            <div className="p-4">
                                {editingVoice === voice.voiceId ? (
                                    // Edit Mode
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Display Name</label>
                                            <input
                                                type="text"
                                                value={editForm.customName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, customName: e.target.value }))}
                                                placeholder={voice.name}
                                                className="w-full border rounded px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Character Image URL</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={editForm.characterImage}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, characterImage: e.target.value }))}
                                                    placeholder="Image URL"
                                                    className="flex-1 border rounded px-2 py-1 text-sm"
                                                />
                                                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                                                    <Image className="w-4 h-4 text-gray-600" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleImageUpload(e, voice.voiceId)}
                                                        disabled={uploadingImage}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`premium-${voice.voiceId}`}
                                                checked={editForm.isPremium}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, isPremium: e.target.checked }))}
                                                className="rounded"
                                            />
                                            <label htmlFor={`premium-${voice.voiceId}`} className="text-sm text-gray-700">
                                                Premium Only
                                            </label>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => handleSaveEdit(voice.voiceId)}
                                                className="flex-1 bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
                                            >
                                                <Save className="w-3 h-3" />
                                                Save
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex-1 bg-gray-300 text-gray-700 py-1 rounded text-sm hover:bg-gray-400 flex items-center justify-center gap-1"
                                            >
                                                <X className="w-3 h-3" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-bold text-gray-900">
                                                    {voice.customName || voice.name}
                                                </h3>
                                                {voice.customName && (
                                                    <p className="text-xs text-gray-500">{voice.name}</p>
                                                )}
                                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {voice.category}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleStartEdit(voice)}
                                                className="text-gray-400 hover:text-indigo-600"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Preview Button */}
                                        <button
                                            onClick={() => handlePlayPreview(voice)}
                                            className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition text-sm mb-3 ${
                                                playingPreview === voice.voiceId
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                            }`}
                                        >
                                            {playingPreview === voice.voiceId ? (
                                                <>
                                                    <Pause className="w-4 h-4" />
                                                    Playing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4" />
                                                    Preview Voice
                                                </>
                                            )}
                                        </button>

                                        {/* Toggle Controls */}
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={voice.enabled}
                                                    onChange={() => handleToggleEnabled(voice)}
                                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                                                />
                                                <span className="text-xs text-gray-600">Enable</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={voice.showInApp}
                                                    onChange={() => handleToggleShowInApp(voice)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="text-xs text-gray-600">Show in Shop</span>
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Voices;
