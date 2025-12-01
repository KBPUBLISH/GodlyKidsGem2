import React, { useEffect, useState } from 'react';
import { Volume2, Play, Pause, RefreshCw, XCircle } from 'lucide-react';
import axios from 'axios';

interface Voice {
    _id?: string;
    voiceId: string;
    name: string;
    customName?: string;
    category: string;
    previewUrl?: string;
    enabled: boolean;
    description?: string;
    ageGroup?: string;
    language?: string;
    characterImage?: string;
}

const Voices: React.FC = () => {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);
    const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
    const [editingVoice, setEditingVoice] = useState<Voice | null>(null);
    const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [customName, setCustomName] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

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
            const response = await axios.get('http://localhost:5001/api/voices');
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
            const response = await axios.get('http://localhost:5001/api/voices/sync');
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
                ? `http://localhost:5001/api/voices/${voice.voiceId}/disable`
                : `http://localhost:5001/api/voices/${voice.voiceId}/enable`;
            
            await axios.put(endpoint);
            await fetchVoices();
        } catch (error: any) {
            console.error('Error toggling voice:', error);
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

            // Disable all enabled voices
            const disablePromises = enabledVoices.map(voice =>
                axios.put(`http://localhost:5001/api/voices/${voice.voiceId}/disable`)
            );

            await Promise.all(disablePromises);
            await fetchVoices();
            alert(`Disabled ${enabledVoices.length} voice(s)`);
        } catch (error: any) {
            console.error('Error deselecting all voices:', error);
            alert(error.response?.data?.message || 'Failed to disable all voices');
        }
    };

    const handleEditVoice = (voice: Voice) => {
        setEditingVoice(voice);
        setCharacterImageFile(null);
        setCustomName(voice.customName || '');
    };
    
    const handleCloseEdit = () => {
        setEditingVoice(null);
        setCharacterImageFile(null);
        setCustomName('');
    };
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        setCharacterImageFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please drop an image file');
            return;
        }
        
        setCharacterImageFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };
    
    const handleSaveVoice = async () => {
        if (!editingVoice) return;
        
        setUploadingImage(true);
        try {
            let characterImageUrl = editingVoice.characterImage;
            
            // Upload character image if a new file was selected
            if (characterImageFile) {
                const formData = new FormData();
                formData.append('file', characterImageFile);
                
                // Pass bookId and type as query parameters, not form data
                const uploadResponse = await axios.post(
                    'http://localhost:5001/api/upload/image?bookId=voices&type=character',
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    }
                );
                
                characterImageUrl = uploadResponse.data.url;
            }
            
            // Update voice with character image and custom name
            await axios.put(`http://localhost:5001/api/voices/${editingVoice.voiceId}`, {
                characterImage: characterImageUrl,
                customName: customName.trim() || null // Clear if empty
            });
            
            await fetchVoices();
            handleCloseEdit();
        } catch (error: any) {
            console.error('Error saving voice:', error);
            alert(error.response?.data?.message || 'Failed to save voice');
        } finally {
            setUploadingImage(false);
        }
    };

    const handlePlayPreview = async (voice: Voice) => {
        // Stop any currently playing preview
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
            // Generate a test TTS audio with a sample text
            const sampleText = `Hello! This is ${voice.name}, a ${voice.category} voice. I can help bring stories to life for children.`;
            
            setPlayingPreview(voice.voiceId);
            
            const response = await axios.post('http://localhost:5001/api/tts/generate', {
                text: sampleText,
                voiceId: voice.voiceId
            });

            if (response.data && response.data.audioUrl) {
                const audio = new Audio(response.data.audioUrl);
                
                // Set up event handlers before playing
                audio.onended = () => {
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                };
                
                audio.onpause = () => {
                    // Only clear if paused (not if ended)
                    if (audio.ended) {
                        setPlayingPreview(null);
                    }
                };
                
                // Only show error if audio actually fails to load/play
                audio.onerror = (e) => {
                    console.error('Audio playback error:', e);
                    // Check if error is actually a real error
                    if (audio.error && audio.error.code !== 0) {
                        setPlayingPreview(null);
                        setPreviewAudio(null);
                        alert(`Failed to play preview: ${audio.error.message || 'Unknown error'}`);
                    }
                };
                
                setPreviewAudio(audio);
                
                // Try to play and catch any errors
                try {
                    await audio.play();
                } catch (playError: any) {
                    console.error('Play error:', playError);
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                    // Only show alert if it's a real error (not user interaction required)
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

    const enabledCount = voices.filter(v => v.enabled).length;
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
                        Manage which voices are available in the app
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
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Total Voices</div>
                    <div className="text-2xl font-bold text-gray-800">{voices.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-green-600">Enabled</div>
                    <div className="text-2xl font-bold text-green-700">{enabledCount}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Disabled</div>
                    <div className="text-2xl font-bold text-gray-700">{disabledCount}</div>
                </div>
            </div>

            {/* Voices List */}
            <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Character
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Voice
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {voices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No voices found. Click "Sync from ElevenLabs" to load voices.
                                    </td>
                                </tr>
                            ) : (
                                voices.map((voice) => (
                                    <tr key={voice.voiceId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {voice.characterImage ? (
                                                    <img 
                                                        src={voice.characterImage} 
                                                        alt={voice.name}
                                                        className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-gray-200"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                                        <Volume2 className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Volume2 className="w-5 h-5 text-indigo-600 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {voice.customName || voice.name}
                                                        {voice.customName && (
                                                            <span className="text-xs text-gray-400 ml-2">({voice.name})</span>
                                                        )}
                                                    </div>
                                                    {voice.description && (
                                                        <div className="text-sm text-gray-500">{voice.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {voice.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    voice.enabled
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {voice.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleEditVoice(voice)}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                                                    title="Edit character image"
                                                >
                                                    <span className="text-xs">Edit Image</span>
                                                </button>
                                                <button
                                                    onClick={() => handlePlayPreview(voice)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
                                                        playingPreview === voice.voiceId
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                    }`}
                                                    title="Preview voice"
                                                >
                                                    {playingPreview === voice.voiceId ? (
                                                        <>
                                                            <Pause className="w-4 h-4" />
                                                            <span className="text-xs">Playing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-4 h-4" />
                                                            <span className="text-xs">Preview</span>
                                                        </>
                                                    )}
                                                </button>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={voice.enabled}
                                                        onChange={() => handleToggleEnabled(voice)}
                                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span className="text-sm text-gray-700">In App Use</span>
                                                </label>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Edit Voice Modal */}
            {editingVoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Edit Voice - {editingVoice.name}</h2>
                        
                        {/* Custom Name Field */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Custom Name (optional)
                            </label>
                            <input
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder={editingVoice.name}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to use the original name from ElevenLabs. Custom names are preserved when syncing.
                            </p>
                        </div>
                        
                        {/* Current Image Preview */}
                        {editingVoice.characterImage && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Current Image</label>
                                <img 
                                    src={editingVoice.characterImage} 
                                    alt={editingVoice.name}
                                    className="w-32 h-32 rounded-full object-cover mx-auto border-2 border-gray-200"
                                />
                            </div>
                        )}
                        
                        {/* Image Upload */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {editingVoice.characterImage ? 'Replace Image' : 'Upload Character Image'}
                            </label>
                            
                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                    isDragging 
                                        ? 'border-indigo-500 bg-indigo-50' 
                                        : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
                                }`}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    id="character-image-upload"
                                    className="hidden"
                                />
                                <label
                                    htmlFor="character-image-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <svg
                                        className="w-12 h-12 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                        />
                                    </svg>
                                    <span className="text-sm text-gray-600">
                                        {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        PNG, JPG, GIF up to 10MB
                                    </span>
                                </label>
                            </div>
                            
                            {characterImageFile && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                                    <div className="flex justify-center">
                                        <img 
                                            src={URL.createObjectURL(characterImageFile)} 
                                            alt="Preview"
                                            className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setCharacterImageFile(null)}
                                        className="mt-2 text-sm text-red-600 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleCloseEdit}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveVoice}
                                disabled={uploadingImage}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploadingImage ? 'Uploading...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Voices;

