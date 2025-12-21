import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Save, 
  Loader2, 
  BookOpen, 
  Music, 
  Video, 
  Plus, 
  X, 
  GripVertical,
  Eye,
  Settings,
  Search
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface ContentItem {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: 'book' | 'playlist' | 'lesson';
  order?: number;
}

interface WelcomeConfig {
  section: string;
  title: string;
  subtitle: string;
  maxItems: number;
  skipButtonText: string;
  showSkipButton: boolean;
}

const NewUserWelcome: React.FC = () => {
  const [config, setConfig] = useState<WelcomeConfig>({
    section: 'new-user-welcome',
    title: 'Welcome to Godly Kids!',
    subtitle: 'Pick something to start your adventure.',
    maxItems: 6,
    skipButtonText: 'Skip for now',
    showSkipButton: true,
  });
  const [selectedItems, setSelectedItems] = useState<ContentItem[]>([]);
  const [availableContent, setAvailableContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'content' | 'preview'>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'book' | 'playlist' | 'lesson'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, contentRes] = await Promise.all([
        apiClient.get('/api/featured/config/new-user-welcome'),
        apiClient.get('/api/featured/available-content'),
      ]);

      if (configRes.data.success && configRes.data.config) {
        const cfg = configRes.data.config;
        setConfig({
          section: cfg.section || 'new-user-welcome',
          title: cfg.title || 'Welcome to Godly Kids!',
          subtitle: cfg.subtitle || 'Pick something to start your adventure.',
          maxItems: cfg.maxItems || 6,
          skipButtonText: cfg.skipButtonText || 'Skip for now',
          showSkipButton: cfg.showSkipButton !== false,
        });
        setSelectedItems(cfg.items || []);
      }

      if (contentRes.data.success) {
        setAvailableContent(contentRes.data.content || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/featured/config/new-user-welcome', {
        ...config,
        items: selectedItems,
      });
      alert('New User Welcome screen saved successfully!');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (item: ContentItem) => {
    if (selectedItems.length >= config.maxItems) {
      alert(`Maximum ${config.maxItems} items allowed`);
      return;
    }
    if (selectedItems.some(i => i._id === item._id)) {
      return; // Already added
    }
    setSelectedItems([...selectedItems, { ...item, order: selectedItems.length }]);
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(i => i._id !== itemId));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedItems.length - 1)
    ) {
      return;
    }
    const newItems = [...selectedItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setSelectedItems(newItems);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen className="w-4 h-4" />;
      case 'playlist': return <Music className="w-4 h-4" />;
      case 'lesson': return <Video className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'book': return 'bg-blue-100 text-blue-700';
      case 'playlist': return 'bg-purple-100 text-purple-700';
      case 'lesson': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredContent = availableContent.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const notAlreadySelected = !selectedItems.some(s => s._id === item._id);
    return matchesSearch && matchesType && notAlreadySelected;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            New User Welcome Screen
          </h1>
          <p className="text-gray-600 mt-1">
            Configure the welcome screen shown to new users on their first visit
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'content'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Content ({selectedItems.length}/{config.maxItems})
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Welcome Title
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Welcome to Godly Kids!"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle
            </label>
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Pick something to start your adventure."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Items to Display
              </label>
              <select
                value={config.maxItems}
                onChange={(e) => setConfig({ ...config, maxItems: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[3, 4, 5, 6, 8, 10, 12].map(n => (
                  <option key={n} value={n}>{n} items</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skip Button Text
              </label>
              <input
                type="text"
                value={config.skipButtonText}
                onChange={(e) => setConfig({ ...config, skipButtonText: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Skip for now"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="showSkipButton"
              checked={config.showSkipButton}
              onChange={(e) => setConfig({ ...config, showSkipButton: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="showSkipButton" className="text-sm font-medium text-gray-700">
              Show skip button (allow users to skip the welcome screen)
            </label>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Selected Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Selected Content</h2>
              <p className="text-sm text-gray-500">
                {selectedItems.length} of {config.maxItems} items selected
              </p>
            </div>

            {selectedItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No content selected yet.</p>
                <p className="text-sm">Add items from the right panel.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {selectedItems.map((item, index) => (
                  <li key={item._id} className="p-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === selectedItems.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >
                        ▼
                      </button>
                    </div>

                    <GripVertical className="w-4 h-4 text-gray-300" />

                    <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full font-semibold text-xs">
                      {index + 1}
                    </span>

                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {getTypeIcon(item.type)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </div>

                    <button
                      onClick={() => removeItem(item._id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Available Content */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Available Content</h2>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="book">Books</option>
                  <option value="playlist">Playlists</option>
                  <option value="lesson">Lessons</option>
                </select>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {filteredContent.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No content available.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredContent.map((item) => (
                    <li key={item._id} className="p-3 flex items-center gap-3 hover:bg-gray-50">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            {getTypeIcon(item.type)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(item.type)}`}>
                          {item.type}
                        </span>
                      </div>

                      <button
                        onClick={() => addItem(item)}
                        disabled={selectedItems.length >= config.maxItems}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-8">
            {/* Simulated App Screen */}
            <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-2xl max-w-md mx-auto shadow-lg overflow-hidden">
              {/* Header */}
              <div className="pt-12 pb-6 px-6 text-center">
                <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">{config.title}</h2>
                <p className="text-gray-600 mt-2">{config.subtitle}</p>
              </div>

              {/* Content Grid */}
              <div className="px-4 pb-6">
                {selectedItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>Add content to see preview</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedItems.slice(0, config.maxItems).map((item) => (
                      <div
                        key={item._id}
                        className="bg-white rounded-xl shadow-md overflow-hidden transform hover:scale-105 transition-transform cursor-pointer"
                      >
                        <div className="aspect-square bg-gray-100">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              {getTypeIcon(item.type)}
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skip Button */}
              {config.showSkipButton && (
                <div className="px-6 pb-6">
                  <button className="w-full py-3 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors">
                    {config.skipButtonText}
                  </button>
                </div>
              )}
            </div>

            {/* Caption */}
            <p className="text-center text-white/60 text-sm mt-4">
              Preview of how the welcome screen will appear to new users
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewUserWelcome;

