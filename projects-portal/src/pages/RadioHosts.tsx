import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Play, Pause, Volume2, RefreshCw, Save, X, Mic2, User } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

interface GoogleVoice {
    name: string;
    gender: string;
    description: string;
    languageCode: string;
}

interface RadioHost {
    _id: string;
    name: string;
    personality: string;
    googleVoice: {
        name: string;
        languageCode: string;
        pitch: number;
        speakingRate: number;
    };
    samplePhrases: string[];
    avatarUrl?: string;
    enabled: boolean;
    order: number;
}

const RadioHosts: React.FC = () => {
    const [hosts, setHosts] = useState<RadioHost[]>([]);
    const [availableVoices, setAvailableVoices] = useState<GoogleVoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingHost, setEditingHost] = useState<RadioHost | null>(null);
    
    // Form state
    const [formName, setFormName] = useState('');
    const [formPersonality, setFormPersonality] = useState('');
    const [formVoiceName, setFormVoiceName] = useState('en-US-Studio-O');
    const [formPitch, setFormPitch] = useState(0);
    const [formSpeakingRate, setFormSpeakingRate] = useState(1.0);
    const [formEnabled, setFormEnabled] = useState(true);
    
    // Audio preview
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [hostsRes, voicesRes] = await Promise.all([
                axios.get(`${API_URL}/radio/hosts`),
                axios.get(`${API_URL}/google-tts/voices`),
            ]);
            setHosts(hostsRes.data);
            setAvailableVoices(voicesRes.data.voices || []);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingHost(null);
        setFormName('');
        setFormPersonality('Warm, friendly, and encouraging Christian radio host who loves sharing God\'s love through music.');
        setFormVoiceName('en-US-Studio-O');
        setFormPitch(0);
        setFormSpeakingRate(1.0);
        setFormEnabled(true);
        setShowModal(true);
    };

    const openEditModal = (host: RadioHost) => {
        setEditingHost(host);
        setFormName(host.name);
        setFormPersonality(host.personality);
        setFormVoiceName(host.googleVoice?.name || 'en-US-Studio-O');
        setFormPitch(host.googleVoice?.pitch || 0);
        setFormSpeakingRate(host.googleVoice?.speakingRate || 1.0);
        setFormEnabled(host.enabled);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingHost(null);
        stopPreview();
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            setError('Host name is required');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                name: formName.trim(),
                personality: formPersonality,
                googleVoice: {
                    name: formVoiceName,
                    languageCode: 'en-US',
                    pitch: formPitch,
                    speakingRate: formSpeakingRate,
                },
                enabled: formEnabled,
            };

            if (editingHost) {
                await axios.put(`${API_URL}/radio/hosts/${editingHost._id}`, payload);
            } else {
                await axios.post(`${API_URL}/radio/hosts`, payload);
            }

            await fetchData();
            closeModal();
        } catch (err: any) {
            console.error('Error saving host:', err);
            setError(err.response?.data?.message || 'Failed to save host');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (host: RadioHost) => {
        if (!confirm(`Are you sure you want to delete "${host.name}"?`)) return;

        try {
            await axios.delete(`${API_URL}/radio/hosts/${host._id}`);
            await fetchData();
        } catch (err: any) {
            console.error('Error deleting host:', err);
            setError(err.response?.data?.message || 'Failed to delete host');
        }
    };

    const previewVoice = async () => {
        try {
            setPreviewLoading(true);
            stopPreview();

            const testText = `Hello! I'm ${formName || 'your radio host'}. Welcome to Praise Station Radio, where we lift up your spirit with uplifting music and encouraging words. God bless you today!`;

            const response = await axios.post(`${API_URL}/google-tts/preview`, {
                text: testText,
                voiceName: formVoiceName,
                languageCode: 'en-US',
                pitch: formPitch,
                speakingRate: formSpeakingRate,
            });

            if (response.data.audioBase64) {
                const audio = new Audio(`data:audio/mpeg;base64,${response.data.audioBase64}`);
                audioRef.current = audio;
                
                audio.onplay = () => setPreviewPlaying(true);
                audio.onended = () => setPreviewPlaying(false);
                audio.onpause = () => setPreviewPlaying(false);
                
                await audio.play();
            }
        } catch (err: any) {
            console.error('Error previewing voice:', err);
            setError(err.response?.data?.message || 'Failed to preview voice. Make sure GOOGLE_TTS_API_KEY is set.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const stopPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPreviewPlaying(false);
    };

    const getVoiceInfo = (voiceName: string) => {
        return availableVoices.find(v => v.name === voiceName);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/radio"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Radio Hosts</h1>
                        <p className="text-gray-500">Configure AI voices for your radio hosts</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Host
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                </div>
            )}

            {/* Hosts Grid */}
            {hosts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <Mic2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-600 mb-2">No Hosts Yet</h3>
                    <p className="text-gray-500 mb-6">Create your first radio host to get started</p>
                    <button
                        onClick={openCreateModal}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Create First Host
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hosts.map((host) => {
                        const voiceInfo = getVoiceInfo(host.googleVoice?.name);
                        return (
                            <div
                                key={host._id}
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${!host.enabled ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                            <User className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800">{host.name}</h3>
                                            <p className="text-sm text-gray-500">
                                                {voiceInfo?.description || host.googleVoice?.name}
                                            </p>
                                        </div>
                                    </div>
                                    {!host.enabled && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                            Disabled
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                    {host.personality}
                                </p>

                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                    <Volume2 className="w-4 h-4" />
                                    <span>Pitch: {host.googleVoice?.pitch || 0}</span>
                                    <span>•</span>
                                    <span>Speed: {host.googleVoice?.speakingRate || 1.0}x</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(host)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(host)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingHost ? 'Edit Host' : 'Create New Host'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Host Name *
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g., Pastor Mike, Sister Joy"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* Personality */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Personality Description
                                </label>
                                <textarea
                                    value={formPersonality}
                                    onChange={(e) => setFormPersonality(e.target.value)}
                                    rows={3}
                                    placeholder="Describe the host's personality for AI script generation..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This description helps the AI generate scripts in the host's voice
                                </p>
                            </div>

                            {/* Voice Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Voice
                                </label>
                                <select
                                    value={formVoiceName}
                                    onChange={(e) => setFormVoiceName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    {availableVoices.map((voice) => (
                                        <option key={voice.name} value={voice.name}>
                                            {voice.description} ({voice.gender})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Voice Adjustments */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Pitch: {formPitch}
                                    </label>
                                    <input
                                        type="range"
                                        min="-10"
                                        max="10"
                                        step="0.5"
                                        value={formPitch}
                                        onChange={(e) => setFormPitch(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Lower</span>
                                        <span>Higher</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Speed: {formSpeakingRate}x
                                    </label>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="1.5"
                                        step="0.1"
                                        value={formSpeakingRate}
                                        onChange={(e) => setFormSpeakingRate(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Slower</span>
                                        <span>Faster</span>
                                    </div>
                                </div>
                            </div>

                            {/* Voice Preview */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Test Voice</span>
                                    <button
                                        onClick={previewPlaying ? stopPreview : previewVoice}
                                        disabled={previewLoading}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                            previewPlaying
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                    >
                                        {previewLoading ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : previewPlaying ? (
                                            <Pause className="w-4 h-4" />
                                        ) : (
                                            <Play className="w-4 h-4" />
                                        )}
                                        {previewLoading ? 'Loading...' : previewPlaying ? 'Stop' : 'Preview'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Click to hear how this voice sounds with your settings
                                </p>
                            </div>

                            {/* Enabled Toggle */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="enabled"
                                    checked={formEnabled}
                                    onChange={(e) => setFormEnabled(e.target.checked)}
                                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="enabled" className="text-sm text-gray-700">
                                    Host is active and available for rotation
                                </label>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formName.trim()}
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {editingHost ? 'Update Host' : 'Create Host'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadioHosts;

