import React, { useState } from 'react';
import { BarChart3, BookOpen, Music } from 'lucide-react';
import BooksAnalytics from '../components/BooksAnalytics';
import PlaylistsAnalytics from '../components/PlaylistsAnalytics';

const AnalyticsDashboard: React.FC = () => {
  const [tab, setTab] = useState<'books' | 'playlists'>('books');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Content performance across the app.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-2 flex gap-2">
        <button
          onClick={() => setTab('books')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
            tab === 'books' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Books
        </button>
        <button
          onClick={() => setTab('playlists')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
            tab === 'playlists' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Music className="w-4 h-4" />
          Playlists
        </button>
      </div>

      {tab === 'books' ? <BooksAnalytics /> : <PlaylistsAnalytics />}
    </div>
  );
};

export default AnalyticsDashboard;



