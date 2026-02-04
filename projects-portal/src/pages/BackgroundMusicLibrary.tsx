import React, { useState, useEffect, useRef } from 'react';
import { 
    Music, Upload, Play, Pause, Trash2, Star, StarOff, 
    Plus, Search, Filter, Clock, BarChart3
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface MusicTrack {
    _id: string;
    name: string;
    description?: string;
    audioUrl: string;
    goalTags: string[];
    moodTags: string[];
    duration?: number;
    isDefault: boolean;
    isActive: boolean;
    usageCount: number;
    createdAt: string;
}

const GOAL_TAGS = ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'];
const MOOD_TAGS = ['peaceful', 'uplifting', 'adventurous', 'gentle', 'joyful', 'reflective', 'hopeful', 'triumphant'];

const GOAL_COLORS: Record<string, string> = {
    courage: 'bg-orange-100 text-orange-700 border-orange-200',
    faith: 'bg-purple-100 text-purple-700 border-purple-200',
    gratitude: 'bg-pink-100 text-pink-700 border-pink-200',
    love: 'bg-red-100 text-red-700 border-red-200',
    obedience: 'bg-blue-100 text-blue-700 border-blue-200',
    'self-control': 'bg-green-100 text-green-700 border-green-200',
    theology: 'bg-amber-100 text-amber-700 border-amber-200',
    wisdom: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const BackgroundMusicLibrary: React.FC = () => {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterGoal, setFilterGoal] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchTracks();
    }, [filterGoal]);

    const fetchTracks = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterGoal) params.append('goalTag', filterGoal);
            
            const response = await apiClient.get(`/api/background-music?${params}`);
            setTracks(response.data.tracks);
        } catch (error) {
            console.error('Error fetching tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (track: MusicTrack) => {
        if (audioRef.current) {
            audioRef.current.pause();
        }

        if (playingId === track._id) {
            setPlayingId(null);
            return;
        }

        const audio = new Audio(track.audioUrl);
        audioRef.current = audio;
        audio.play();
        setPlayingId(track._id);

        audio.onended = () => setPlayingId(null);
    };

    const handleSetDefault = async (trackId: string) => {
        try {
            await apiClient.post(`/api/background-music/${trackId}/set-default`);
            fetchTracks();
        } catch (error) {
            console.error('Error setting default:', error);
        }
    };

    const handleToggleActive = async (track: MusicTrack) => {
        try {
            await apiClient.put(`/api/background-music/${track._id}`, {
                isActive: !track.isActive
            });
            fetchTracks();
        } catch (error) {
            console.error('Error toggling active:', error);
        }
    };

    const handleDelete = async (trackId: string) => {
        if (!confirm('Are you sure you want to delete this track?')) return;
        
        try {
            await apiClient.delete(`/api/background-music/${trackId}`);
            fetchTracks();
        } catch (error) {
            console.error('Error deleting track:', error);
        }
    };

    const filteredTracks = tracks.filter(track => 
        !searchQuery || 
        track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Music className="w-8 h-8 text-indigo-600" />
                        Background Music Library
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Upload music and tag it to learning goals for automatic selection in stories
                    </p>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5" />
                    Upload Music
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tracks..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg"
                        />
                    </div>

                    {/* Goal Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-400" />
                        <select
                            value={filterGoal}
                            onChange={(e) => setFilterGoal(e.target.value)}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="">All Goals</option>
                            {GOAL_TAGS.map(goal => (
                                <option key={goal} value={goal} className="capitalize">{goal}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Goal Tags Quick Filters */}
                <div className="flex flex-wrap gap-2 mt-4">
                    <button
                        onClick={() => setFilterGoal('')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            !filterGoal ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        All
                    </button>
                    {GOAL_TAGS.map(goal => (
                        <button
                            key={goal}
                            onClick={() => setFilterGoal(goal)}
                            className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                                filterGoal === goal 
                                    ? 'bg-indigo-600 text-white' 
                                    : `${GOAL_COLORS[goal]} border`
                            }`}
                        >
                            {goal}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tracks List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredTracks.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <Music className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600">No tracks found</h3>
                    <p className="text-gray-400 mt-1">
                        {filterGoal ? `No music for "${filterGoal}" goal` : 'Upload your first background music track'}
                    </p>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        Upload Music
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Track</th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Goals</th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    Duration
                                </th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                                    <BarChart3 className="w-4 h-4 inline mr-1" />
                                    Usage
                                </th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredTracks.map((track) => (
                                <tr key={track._id} className={`hover:bg-gray-50 ${!track.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handlePlay(track)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                                    playingId === track._id 
                                                        ? 'bg-indigo-600 text-white' 
                                                        : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'
                                                }`}
                                            >
                                                {playingId === track._id ? (
                                                    <Pause className="w-5 h-5" />
                                                ) : (
                                                    <Play className="w-5 h-5 ml-0.5" />
                                                )}
                                            </button>
                                            <div>
                                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                                    {track.name}
                                                    {track.isDefault && (
                                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                {track.description && (
                                                    <div className="text-sm text-gray-500">{track.description}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {track.goalTags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${GOAL_COLORS[tag]}`}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {formatDuration(track.duration)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {track.usageCount} times
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            track.isActive 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {track.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleSetDefault(track._id)}
                                                title={track.isDefault ? 'Default for goals' : 'Set as default'}
                                                className={`p-2 rounded hover:bg-gray-100 ${
                                                    track.isDefault ? 'text-yellow-500' : 'text-gray-400'
                                                }`}
                                            >
                                                {track.isDefault ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(track)}
                                                title={track.isActive ? 'Deactivate' : 'Activate'}
                                                className={`p-2 rounded hover:bg-gray-100 ${
                                                    track.isActive ? 'text-green-600' : 'text-gray-400'
                                                }`}
                                            >
                                                <Music className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(track._id)}
                                                className="p-2 rounded hover:bg-red-50 text-red-600"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadMusicModal
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => {
                        setShowUploadModal(false);
                        fetchTracks();
                    }}
                />
            )}
        </div>
    );
};

// Upload Modal Component
interface UploadMusicModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const UploadMusicModal: React.FC<UploadMusicModalProps> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
    const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
    const [isDefault, setIsDefault] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            
            // Get audio duration
            const audio = new Audio();
            audio.src = URL.createObjectURL(selectedFile);
            audio.onloadedmetadata = () => {
                setDuration(Math.round(audio.duration));
            };
        }
    };

    const toggleGoal = (goal: string) => {
        setSelectedGoals(prev => 
            prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
        );
    };

    const toggleMood = (mood: string) => {
        setSelectedMoods(prev => 
            prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
        );
    };

    const handleUpload = async () => {
        if (!name.trim()) {
            alert('Please enter a track name');
            return;
        }
        if (!file) {
            alert('Please select an audio file');
            return;
        }
        if (selectedGoals.length === 0) {
            alert('Please select at least one learning goal');
            return;
        }

        setUploading(true);

        try {
            // Convert file to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });

            await apiClient.post('/api/background-music', {
                name,
                description,
                audioBase64: base64,
                filename: file.name,
                goalTags: selectedGoals,
                moodTags: selectedMoods,
                duration,
                isDefault,
            });

            onSuccess();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload music');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Upload Background Music</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Add music to the library and tag it to learning goals
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Audio File
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {file ? (
                            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                                <Music className="w-8 h-8 text-indigo-600" />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-800">{file.name}</div>
                                    <div className="text-sm text-gray-500">
                                        {duration ? `Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : 'Loading...'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setFile(null)}
                                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                            >
                                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                                <div className="text-gray-600">Click to upload audio file</div>
                                <div className="text-gray-400 text-sm">MP3, WAV, or other audio formats</div>
                            </button>
                        )}
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Track Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border rounded-lg px-4 py-2"
                            placeholder="e.g., Peaceful Morning"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border rounded-lg px-4 py-2"
                            placeholder="e.g., Gentle piano with soft strings"
                        />
                    </div>

                    {/* Goal Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Learning Goals * <span className="font-normal text-gray-400">(select at least one)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {GOAL_TAGS.map(goal => (
                                <button
                                    key={goal}
                                    onClick={() => toggleGoal(goal)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                                        selectedGoals.includes(goal)
                                            ? 'bg-indigo-600 text-white'
                                            : `${GOAL_COLORS[goal]} border hover:opacity-80`
                                    }`}
                                >
                                    {goal}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mood Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mood Tags <span className="font-normal text-gray-400">(optional)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {MOOD_TAGS.map(mood => (
                                <button
                                    key={mood}
                                    onClick={() => toggleMood(mood)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                                        selectedMoods.includes(mood)
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {mood}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Default Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                            <div className="font-medium text-gray-800">Set as default</div>
                            <div className="text-sm text-gray-500">
                                This track will be automatically selected for stories with these goals
                            </div>
                        </div>
                    </label>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || !file || !name.trim() || selectedGoals.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {uploading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-5 h-5" />
                                Upload Track
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackgroundMusicLibrary;
