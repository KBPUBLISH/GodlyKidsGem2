import React, { useEffect, useState, useRef } from 'react';
import { Gamepad2, Play, Pause, RefreshCw, Edit2, Save, X, Plus, Globe, Upload, Coins } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Game {
    _id?: string;
    gameId: string;
    name: string;
    enabled: boolean;
    description?: string;
    url?: string;
    coverImage?: string;
    showInDailyTasks?: boolean;
    gameType?: 'modal' | 'webview';
    settings?: any;
    rewards?: {
        threeStars: number;
        twoStars: number;
        oneStar: number;
    };
    isPurchasable?: boolean;
    goldCoinPrice?: number;
}

const Games: React.FC = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [formData, setFormData] = useState<any>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGame, setNewGame] = useState({
        gameId: '',
        name: '',
        description: '',
        url: '',
        coverImage: '',
        gameType: 'webview' as 'modal' | 'webview',
        enabled: true,
        showInDailyTasks: true,
        rewards: {
            threeStars: 50,
            twoStars: 25,
            oneStar: 10,
        },
        isPurchasable: false,
        goldCoinPrice: 0,
    });
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadingEditCover, setUploadingEditCover] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const editCoverInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        try {
            const response = await apiClient.get('/api/games');
            setGames(response.data || []);
        } catch (error: any) {
            console.error('Error fetching games:', error);
            // If it's a 404 or empty response, just set empty array
            if (error.response?.status === 404) {
                setGames([]);
            } else {
                // For other errors, show empty array
                setGames([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const initializeDefaultGames = async () => {
        const defaultGames = [
            {
                gameId: 'prayer',
                name: 'Prayer Game',
                enabled: true,
                description: 'Interactive prayer experience with voice recognition',
            },
            {
                gameId: 'challenge',
                name: 'Memory Challenge',
                enabled: true,
                description: 'Match biblical symbols in this memory game',
            },
            {
                gameId: 'strength',
                name: 'Strength Game',
                enabled: true,
                description: 'Physical activities and exercises',
            },
        ];

        try {
            for (const game of defaultGames) {
                await apiClient.post('/api/games', game);
            }
            await fetchGames();
        } catch (error) {
            console.error('Error initializing games:', error);
        }
    };

    const handleToggleEnabled = async (game: Game) => {
        try {
            await apiClient.put(`/api/games/${game.gameId}/toggle`);
            await fetchGames();
        } catch (error: any) {
            console.error('Error toggling game:', error);
            alert(error.response?.data?.message || 'Failed to update game');
        }
    };

    const handleEdit = (game: Game) => {
        setEditingGame(game);
        setFormData({
            name: game.name,
            description: game.description || '',
            enabled: game.enabled,
            showInDailyTasks: game.showInDailyTasks !== false, // Default to true
            url: game.url || '',
            coverImage: game.coverImage || '',
            gameType: game.gameType || 'modal',
            rewards: game.rewards || {
                threeStars: 50,
                twoStars: 25,
                oneStar: 10,
            },
            settings: game.settings || {},
            isPurchasable: game.isPurchasable || false,
            goldCoinPrice: game.goldCoinPrice || 0,
        });
    };

    const handleSave = async () => {
        if (!editingGame) return;

        try {
            await apiClient.put(`/api/games/${editingGame.gameId}`, formData);
            await fetchGames();
            setEditingGame(null);
            setFormData(null);
        } catch (error: any) {
            console.error('Error saving game:', error);
            alert(error.response?.data?.message || 'Failed to save game');
        }
    };

    const handleCancel = () => {
        setEditingGame(null);
        setFormData(null);
    };

    const handleCreateGame = async () => {
        if (!newGame.gameId || !newGame.name) {
            alert('Please fill in Game ID and Name');
            return;
        }

        if (newGame.gameType === 'webview' && !newGame.url) {
            alert('Please provide a URL for webview games');
            return;
        }

        try {
            await apiClient.post('/api/games', newGame);
            await fetchGames();
            setShowCreateModal(false);
            setNewGame({
                gameId: '',
                name: '',
                description: '',
                url: '',
                coverImage: '',
                gameType: 'webview',
                enabled: true,
                showInDailyTasks: true,
                rewards: {
                    threeStars: 50,
                    twoStars: 25,
                    oneStar: 10,
                },
                isPurchasable: false,
                goldCoinPrice: 0,
            });
        } catch (error: any) {
            console.error('Error creating game:', error);
            alert(error.response?.data?.message || 'Failed to create game');
        }
    };

    if (loading) {
        return <div className="p-6 text-center">Loading games...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Gamepad2 className="w-8 h-8 text-indigo-600" />
                        Games Management
                    </h1>
                    <p className="text-gray-600 mt-2">Manage and configure games available in the app</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create New Game
                    </button>
                    <button
                        onClick={initializeDefaultGames}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Initialize Games
                    </button>
                </div>
            </div>

            {games.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center border-2 border-dashed border-gray-300">
                    <Gamepad2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Games Found</h3>
                    <p className="text-gray-500 mb-6">
                        Click "Initialize Games" to create the default games (Prayer, Memory Challenge, and Strength).
                    </p>
                    <button
                        onClick={initializeDefaultGames}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 mx-auto"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Initialize Games
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {games.map((game) => (
                    <div
                        key={game._id || game.gameId}
                        className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${
                            game.enabled ? 'border-green-500' : 'border-gray-300'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{game.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">ID: {game.gameId}</p>
                            </div>
                            <button
                                onClick={() => handleToggleEnabled(game)}
                                className={`p-2 rounded-full transition ${
                                    game.enabled
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={game.enabled ? 'Disable game' : 'Enable game'}
                            >
                                {game.enabled ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                            </button>
                        </div>

                        {game.description && (
                            <p className="text-gray-600 text-sm mb-2">{game.description}</p>
                        )}

                        {/* Show Daily Tasks indicator */}
                        {game.showInDailyTasks !== false && (
                            <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                <span>✅</span>
                                <span>Daily Tasks & IQ Games</span>
                            </div>
                        )}
                        
                        {/* Show Purchasable indicator */}
                        {game.isPurchasable && (
                            <div className="mb-2 ml-2 inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                <Coins className="w-3 h-3" />
                                <span>{game.goldCoinPrice} Gold Coins</span>
                            </div>
                        )}
                        
                        {game.gameType === 'webview' && game.url && (
                            <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 text-sm">
                                    <Globe className="w-4 h-4 text-blue-600" />
                                    <span className="text-blue-800 font-medium">Webview Game</span>
                                </div>
                                <p className="text-xs text-blue-600 mt-1 truncate">{game.url}</p>
                            </div>
                        )}

                        {game.rewards && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Coin Rewards</p>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span>3 Stars:</span>
                                        <span className="font-bold text-yellow-600">{game.rewards.threeStars} coins</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>2 Stars:</span>
                                        <span className="font-bold text-yellow-600">{game.rewards.twoStars} coins</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>1 Star:</span>
                                        <span className="font-bold text-yellow-600">{game.rewards.oneStar} coins</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleEdit(game)}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit
                            </button>
                        </div>
                    </div>
                ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingGame && formData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Edit {editingGame.name}</h2>
                            <button
                                onClick={handleCancel}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Game Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    rows={3}
                                />
                            </div>

                            {formData.gameType === 'webview' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Game URL
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.url}
                                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Cover Image
                                        </label>
                                        {formData.coverImage && (
                                            <div className="mb-2 relative inline-block">
                                                <img
                                                    src={formData.coverImage}
                                                    alt="Game cover"
                                                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, coverImage: '' });
                                                        if (editCoverInputRef.current) {
                                                            editCoverInputRef.current.value = '';
                                                        }
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors">
                                            <input
                                                ref={editCoverInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploadingEditCover(true);
                                                        const uploadFormData = new FormData();
                                                        uploadFormData.append('file', file);
                                                        try {
                                                            const response = await apiClient.post(
                                                                `/api/upload/image?bookId=games&type=game-cover`,
                                                                uploadFormData,
                                                                { headers: { 'Content-Type': 'multipart/form-data' } }
                                                            );
                                                            setFormData({ ...formData, coverImage: response.data.url });
                                                        } catch (error) {
                                                            console.error('Failed to upload cover image:', error);
                                                            alert('Failed to upload cover image');
                                                        } finally {
                                                            setUploadingEditCover(false);
                                                        }
                                                    }
                                                }}
                                                className="hidden"
                                                id="cover-upload-edit"
                                            />
                                            <label
                                                htmlFor="cover-upload-edit"
                                                className="cursor-pointer flex flex-col items-center gap-2"
                                            >
                                                <Upload className={`w-6 h-6 ${uploadingEditCover ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                                <span className="text-xs text-gray-600">
                                                    {uploadingEditCover ? 'Uploading...' : 'Upload cover image'}
                                                </span>
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Or enter a URL: <input
                                                type="url"
                                                value={formData.coverImage || ''}
                                                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                                                placeholder="https://example.com/game-cover.jpg"
                                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-64"
                                            />
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="enabled"
                                    checked={formData.enabled}
                                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="enabled" className="text-sm font-semibold text-gray-700">
                                    Enabled in App
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showInDailyTasks"
                                    checked={formData.showInDailyTasks}
                                    onChange={(e) => setFormData({ ...formData, showInDailyTasks: e.target.checked })}
                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                />
                                <label htmlFor="showInDailyTasks" className="text-sm font-semibold text-gray-700">
                                    Show in "Daily Tasks & IQ Games" category
                                </label>
                            </div>

                            {/* Purchase with Gold Coins Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Coins className="w-5 h-5 text-yellow-500" />
                                    Purchase with Gold Coins
                                </h3>
                                
                                <div className="flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        id="isPurchasable"
                                        checked={formData.isPurchasable}
                                        onChange={(e) => setFormData({ ...formData, isPurchasable: e.target.checked })}
                                        className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                    />
                                    <label htmlFor="isPurchasable" className="text-sm font-semibold text-gray-700">
                                        User can purchase this game with gold coins
                                    </label>
                                </div>
                                
                                {formData.isPurchasable && (
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Gold Coin Price
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.goldCoinPrice}
                                                onChange={(e) => setFormData({ ...formData, goldCoinPrice: parseInt(e.target.value) || 0 })}
                                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                            />
                                            <span className="text-sm text-gray-600 flex items-center gap-1">
                                                <Coins className="w-4 h-4 text-yellow-500" />
                                                gold coins to unlock
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Users will need to spend this amount of gold coins to unlock and play this game.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Coin Rewards</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            3 Stars
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.rewards.threeStars}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                rewards: { ...formData.rewards, threeStars: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            2 Stars
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.rewards.twoStars}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                rewards: { ...formData.rewards, twoStars: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            1 Star
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.rewards.oneStar}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                rewards: { ...formData.rewards, oneStar: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Game Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Create New Game</h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewGame({
                                        gameId: '',
                                        name: '',
                                        description: '',
                                        url: '',
                                        coverImage: '',
                                        gameType: 'webview',
                                        enabled: true,
                                        showInDailyTasks: true,
                                        rewards: {
                                            threeStars: 50,
                                            twoStars: 25,
                                            oneStar: 10,
                                        },
                                        isPurchasable: false,
                                        goldCoinPrice: 0,
                                    });
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Game Type *
                                </label>
                                <select
                                    value={newGame.gameType}
                                    onChange={(e) => setNewGame({ ...newGame, gameType: e.target.value as 'modal' | 'webview' })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="webview">Webview (External URL)</option>
                                    <option value="modal">Modal (Built-in)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Game ID * <span className="text-xs text-gray-500">(unique identifier, lowercase, no spaces)</span>
                                </label>
                                <input
                                    type="text"
                                    value={newGame.gameId}
                                    onChange={(e) => setNewGame({ ...newGame, gameId: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    placeholder="e.g., memory-match"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Game Name *
                                </label>
                                <input
                                    type="text"
                                    value={newGame.name}
                                    onChange={(e) => setNewGame({ ...newGame, name: e.target.value })}
                                    placeholder="e.g., Memory Match Game"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={newGame.description}
                                    onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
                                    placeholder="Describe the game"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    rows={3}
                                />
                            </div>

                            {newGame.gameType === 'webview' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Game URL * <span className="text-xs text-gray-500">(webview link)</span>
                                        </label>
                                        <input
                                            type="url"
                                            value={newGame.url}
                                            onChange={(e) => setNewGame({ ...newGame, url: e.target.value })}
                                            placeholder="https://example.com/game"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Cover Image <span className="text-xs text-gray-500">(optional)</span>
                                        </label>
                                        {newGame.coverImage && (
                                            <div className="mb-2 relative inline-block">
                                                <img
                                                    src={newGame.coverImage}
                                                    alt="Game cover"
                                                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewGame({ ...newGame, coverImage: '' });
                                                        if (coverInputRef.current) {
                                                            coverInputRef.current.value = '';
                                                        }
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors">
                                            <input
                                                ref={coverInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploadingCover(true);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const response = await apiClient.post(
                                                                `/api/upload/image?bookId=games&type=game-cover`,
                                                                formData,
                                                                { headers: { 'Content-Type': 'multipart/form-data' } }
                                                            );
                                                            setNewGame({ ...newGame, coverImage: response.data.url });
                                                        } catch (error) {
                                                            console.error('Failed to upload cover image:', error);
                                                            alert('Failed to upload cover image');
                                                        } finally {
                                                            setUploadingCover(false);
                                                        }
                                                    }
                                                }}
                                                className="hidden"
                                                id="cover-upload-new"
                                            />
                                            <label
                                                htmlFor="cover-upload-new"
                                                className="cursor-pointer flex flex-col items-center gap-2"
                                            >
                                                <Upload className={`w-6 h-6 ${uploadingCover ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                                <span className="text-xs text-gray-600">
                                                    {uploadingCover ? 'Uploading...' : 'Upload cover image'}
                                                </span>
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Or enter a URL: <input
                                                type="url"
                                                value={newGame.coverImage}
                                                onChange={(e) => setNewGame({ ...newGame, coverImage: e.target.value })}
                                                placeholder="https://example.com/game-cover.jpg"
                                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-64"
                                            />
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="enabled-new"
                                    checked={newGame.enabled}
                                    onChange={(e) => setNewGame({ ...newGame, enabled: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="enabled-new" className="text-sm font-semibold text-gray-700">
                                    Enabled in App
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showInDailyTasks-new"
                                    checked={newGame.showInDailyTasks}
                                    onChange={(e) => setNewGame({ ...newGame, showInDailyTasks: e.target.checked })}
                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                />
                                <label htmlFor="showInDailyTasks-new" className="text-sm font-semibold text-gray-700">
                                    Show in "Daily Tasks & IQ Games" category
                                </label>
                            </div>

                            {/* Purchase with Gold Coins Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Coins className="w-5 h-5 text-yellow-500" />
                                    Purchase with Gold Coins
                                </h3>
                                
                                <div className="flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        id="isPurchasable-new"
                                        checked={newGame.isPurchasable}
                                        onChange={(e) => setNewGame({ ...newGame, isPurchasable: e.target.checked })}
                                        className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                    />
                                    <label htmlFor="isPurchasable-new" className="text-sm font-semibold text-gray-700">
                                        User can purchase this game with gold coins
                                    </label>
                                </div>
                                
                                {newGame.isPurchasable && (
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Gold Coin Price
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={newGame.goldCoinPrice}
                                                onChange={(e) => setNewGame({ ...newGame, goldCoinPrice: parseInt(e.target.value) || 0 })}
                                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                            />
                                            <span className="text-sm text-gray-600 flex items-center gap-1">
                                                <Coins className="w-4 h-4 text-yellow-500" />
                                                gold coins to unlock
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Users will need to spend this amount of gold coins to unlock and play this game.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Coin Rewards</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            3 Stars
                                        </label>
                                        <input
                                            type="number"
                                            value={newGame.rewards.threeStars}
                                            onChange={(e) => setNewGame({
                                                ...newGame,
                                                rewards: { ...newGame.rewards, threeStars: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            2 Stars
                                        </label>
                                        <input
                                            type="number"
                                            value={newGame.rewards.twoStars}
                                            onChange={(e) => setNewGame({
                                                ...newGame,
                                                rewards: { ...newGame.rewards, twoStars: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            1 Star
                                        </label>
                                        <input
                                            type="number"
                                            value={newGame.rewards.oneStar}
                                            onChange={(e) => setNewGame({
                                                ...newGame,
                                                rewards: { ...newGame.rewards, oneStar: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewGame({
                                        gameId: '',
                                        name: '',
                                        description: '',
                                        url: '',
                                        coverImage: '',
                                        gameType: 'webview',
                                        enabled: true,
                                        showInDailyTasks: true,
                                        rewards: {
                                            threeStars: 50,
                                            twoStars: 25,
                                            oneStar: 10,
                                        },
                                        isPurchasable: false,
                                        goldCoinPrice: 0,
                                    });
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGame}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Create Game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Games;
