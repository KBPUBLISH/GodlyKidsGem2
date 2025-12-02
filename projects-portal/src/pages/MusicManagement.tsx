import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../services/apiClient';

interface MusicTarget {
  value: string;
  label: string;
  description: string;
}

interface MusicEntry {
  _id: string;
  target: string;
  name: string;
  description?: string;
  audioUrl: string;
  originalFilename?: string;
  fileSize?: number;
  duration?: number;
  defaultVolume: number;
  loop: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const MusicManagement: React.FC = () => {
  const [musicEntries, setMusicEntries] = useState<MusicEntry[]>([]);
  const [targets, setTargets] = useState<MusicTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [selectedTarget, setSelectedTarget] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultVolume, setDefaultVolume] = useState(0.5);
  const [loop, setLoop] = useState(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  // Audio preview
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [musicRes, targetsRes] = await Promise.all([
        apiClient.get('/api/music'),
        apiClient.get('/api/music/targets')
      ]);
      setMusicEntries(musicRes.data);
      setTargets(targetsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load music data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      // Auto-fill name from filename if empty
      if (!name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setName(nameWithoutExt);
      }
    }
  };

  const handleTargetChange = (value: string) => {
    setSelectedTarget(value);
    // Auto-fill name and description from target
    const target = targets.find(t => t.value === value);
    if (target) {
      if (!name) setName(target.label);
      if (!description) setDescription(target.description);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTarget || !name || !audioFile) {
      setError('Please fill in all required fields and select an audio file');
      return;
    }
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('target', selectedTarget);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('defaultVolume', defaultVolume.toString());
      formData.append('loop', loop.toString());
      
      await apiClient.post('/api/music/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess(`Music uploaded successfully for "${name}"`);
      
      // Reset form
      setSelectedTarget('');
      setName('');
      setDescription('');
      setDefaultVolume(0.5);
      setLoop(true);
      setAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh list
      fetchData();
    } catch (err: any) {
      console.error('Error uploading music:', err);
      setError(err.response?.data?.error || 'Failed to upload music');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (entry: MusicEntry) => {
    try {
      await apiClient.put(`/api/music/${entry._id}`, {
        isActive: !entry.isActive
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling active state:', err);
      setError('Failed to update music');
    }
  };

  const handleDelete = async (entry: MusicEntry) => {
    if (!confirm(`Are you sure you want to delete "${entry.name}"?`)) {
      return;
    }
    
    try {
      await apiClient.delete(`/api/music/${entry._id}`);
      setSuccess(`"${entry.name}" deleted successfully`);
      fetchData();
    } catch (err) {
      console.error('Error deleting music:', err);
      setError('Failed to delete music');
    }
  };

  const handlePlay = (entry: MusicEntry) => {
    if (playingId === entry._id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
    } else {
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Start new playback
      const audio = new Audio(entry.audioUrl);
      audio.volume = entry.defaultVolume;
      audio.loop = false; // Don't loop in preview
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(entry._id);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTargetLabel = (targetValue: string) => {
    const target = targets.find(t => t.value === targetValue);
    return target?.label || targetValue;
  };

  // Check which targets already have music assigned
  const assignedTargets = musicEntries.map(m => m.target);
  const availableTargets = targets.filter(t => !assignedTargets.includes(t.value));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Music Management</h1>
        <p className="text-gray-600 mt-1">
          Upload and manage background music and sound effects for different parts of the app.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New Music</h2>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Location *
              </label>
              <select
                value={selectedTarget}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Select where this music plays...</option>
                {availableTargets.map(target => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
                {/* Also show assigned targets for replacement */}
                {assignedTargets.length > 0 && (
                  <optgroup label="Replace Existing">
                    {targets.filter(t => assignedTargets.includes(t.value)).map(target => (
                      <option key={target.value} value={target.value}>
                        {target.label} (Replace)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Peaceful Background Music"
                required
              />
            </div>
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Brief description of when/where this plays"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Audio File */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audio File * (MP3, WAV, OGG)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                onChange={handleFileChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {audioFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {audioFile.name} ({formatFileSize(audioFile.size)})
                </p>
              )}
            </div>

            {/* Default Volume */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Volume: {Math.round(defaultVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={defaultVolume}
                onChange={(e) => setDefaultVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Loop */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Loop Audio</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedTarget || !name || !audioFile}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload Music'}
          </button>
        </form>
      </div>

      {/* Current Music List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current Music Assignments</h2>
        </div>
        
        {musicEntries.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No music uploaded yet. Use the form above to add music.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {musicEntries.map(entry => (
              <div key={entry._id} className="p-4 flex items-center gap-4">
                {/* Play Button */}
                <button
                  onClick={() => handlePlay(entry)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    playingId === entry._id
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  {playingId === entry._id ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{entry.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      entry.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {entry.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {getTargetLabel(entry.target)} • {formatFileSize(entry.fileSize)} • Vol: {Math.round(entry.defaultVolume * 100)}%
                    {entry.loop && ' • Loops'}
                  </p>
                  {entry.description && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{entry.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(entry)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      entry.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {entry.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">📝 How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>App Background</strong>: Main music that plays throughout the app (home, library, etc.)</li>
          <li>• <strong>Game Strength Modal</strong>: Music for the game strength/power-up selection screen</li>
          <li>• Upload MP3, WAV, OGG, M4A, or AAC files (max 50MB)</li>
          <li>• Set default volume (users can still adjust in-app)</li>
          <li>• Enable/disable music without deleting it</li>
          <li>• The app will automatically fetch and play the assigned music</li>
        </ul>
      </div>
    </div>
  );
};

export default MusicManagement;

