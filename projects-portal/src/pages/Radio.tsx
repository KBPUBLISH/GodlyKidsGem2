import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Radio as RadioIcon, Users, Music, Settings, Play, Pause, Mic2, RefreshCw, AlertCircle, CheckCircle, Clock, ListMusic } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

interface RadioStats {
    stationName: string;
    isLive: boolean;
    hostsCount: number;
    playlistsCount: number;
    segmentsCount: number;
    pendingSegments: number;
    readySegments: number;
}

interface RadioStation {
    _id: string;
    name: string;
    tagline: string;
    hosts: any[];
    playlists: any[];
    hostBreakDuration: number;
    hostBreakFrequency: number;
    isLive: boolean;
    coverImageUrl?: string;
    settings: {
        shuffleSongs: boolean;
        rotateHosts: boolean;
        introJingleUrl?: string;
        outroJingleUrl?: string;
    };
}

const Radio: React.FC = () => {
    const [stats, setStats] = useState<RadioStats | null>(null);
    const [station, setStation] = useState<RadioStation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable station fields
    const [editName, setEditName] = useState('');
    const [editTagline, setEditTagline] = useState('');
    const [editBreakDuration, setEditBreakDuration] = useState(30);
    const [editBreakFrequency, setEditBreakFrequency] = useState(1);
    const [editShuffleSongs, setEditShuffleSongs] = useState(true);
    const [editRotateHosts, setEditRotateHosts] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, stationRes] = await Promise.all([
                axios.get(`${API_URL}/radio/stats`),
                axios.get(`${API_URL}/radio/station`),
            ]);
            
            setStats(statsRes.data);
            setStation(stationRes.data);
            
            // Initialize edit fields
            if (stationRes.data) {
                setEditName(stationRes.data.name || 'Praise Station Radio');
                setEditTagline(stationRes.data.tagline || '');
                setEditBreakDuration(stationRes.data.hostBreakDuration || 30);
                setEditBreakFrequency(stationRes.data.hostBreakFrequency || 1);
                setEditShuffleSongs(stationRes.data.settings?.shuffleSongs ?? true);
                setEditRotateHosts(stationRes.data.settings?.rotateHosts ?? true);
            }
        } catch (err: any) {
            console.error('Error fetching radio data:', err);
            setError(err.response?.data?.message || 'Failed to load radio data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveStation = async () => {
        try {
            setSaving(true);
            await axios.put(`${API_URL}/radio/station`, {
                name: editName,
                tagline: editTagline,
                hostBreakDuration: editBreakDuration,
                hostBreakFrequency: editBreakFrequency,
                settings: {
                    shuffleSongs: editShuffleSongs,
                    rotateHosts: editRotateHosts,
                },
            });
            await fetchData();
        } catch (err: any) {
            console.error('Error saving station:', err);
            setError(err.response?.data?.message || 'Failed to save station');
        } finally {
            setSaving(false);
        }
    };

    const toggleLive = async () => {
        try {
            setSaving(true);
            await axios.put(`${API_URL}/radio/station`, {
                isLive: !station?.isLive,
            });
            await fetchData();
        } catch (err: any) {
            console.error('Error toggling live status:', err);
            setError(err.response?.data?.message || 'Failed to update live status');
        } finally {
            setSaving(false);
        }
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
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                        <RadioIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Praise Station Radio</h1>
                        <p className="text-gray-500">Manage your Christian family radio station</p>
                    </div>
                </div>
                <button
                    onClick={toggleLive}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
                        station?.isLive 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : 'bg-green-500 hover:bg-green-600'
                    }`}
                >
                    {station?.isLive ? (
                        <>
                            <Pause className="w-5 h-5" />
                            Go Offline
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            Go Live
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Radio Hosts</p>
                            <p className="text-2xl font-bold text-gray-800">{stats?.hostsCount || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Music className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Playlists</p>
                            <p className="text-2xl font-bold text-gray-800">{stats?.playlistsCount || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ready Segments</p>
                            <p className="text-2xl font-bold text-gray-800">{stats?.readySegments || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Clock className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pending Generation</p>
                            <p className="text-2xl font-bold text-gray-800">{stats?.pendingSegments || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    to="/radio/hosts"
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                            <Mic2 className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Manage Hosts</h3>
                            <p className="text-sm text-gray-500">Configure radio host voices and personalities</p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/radio/show-builder"
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                            <ListMusic className="w-8 h-8 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Show Builder</h3>
                            <p className="text-sm text-gray-500">Build and preview your radio show</p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/radio/library"
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-xl group-hover:bg-orange-200 transition-colors">
                            <ListMusic className="w-8 h-8 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Music Library</h3>
                            <p className="text-sm text-gray-500">Manage individual songs for your station</p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/radio/preview"
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                            <Play className="w-8 h-8 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Preview Station</h3>
                            <p className="text-sm text-gray-500">Listen to how your station sounds</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Station Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Settings className="w-6 h-6 text-gray-600" />
                    <h2 className="text-xl font-bold text-gray-800">Station Settings</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Station Name
                        </label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Praise Station Radio"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tagline
                        </label>
                        <input
                            type="text"
                            value={editTagline}
                            onChange={(e) => setEditTagline(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Uplifting music for the whole family"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Host Break Duration (seconds)
                        </label>
                        <input
                            type="number"
                            value={editBreakDuration}
                            onChange={(e) => setEditBreakDuration(parseInt(e.target.value) || 30)}
                            min={10}
                            max={120}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">How long each host segment should be (10-120 seconds)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Host Break Frequency
                        </label>
                        <select
                            value={editBreakFrequency}
                            onChange={(e) => setEditBreakFrequency(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value={1}>After every song</option>
                            <option value={2}>Every 2 songs</option>
                            <option value={3}>Every 3 songs</option>
                            <option value={5}>Every 5 songs</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editShuffleSongs}
                                onChange={(e) => setEditShuffleSongs(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">Shuffle songs</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editRotateHosts}
                                onChange={(e) => setEditRotateHosts(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">Rotate between hosts</span>
                        </label>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSaveStation}
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Settings'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Radio;

