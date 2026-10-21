import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Image as ImageIcon } from 'lucide-react';
import { getMediaUrl } from '../services/apiClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
const getApiBase = () => {
  let base = (API_BASE || '').replace(/\/$/, '');
  if (!base.endsWith('/api')) base = base.endsWith('/') ? `${base}api` : `${base}/api`;
  return base;
};

interface Character {
  name: string;
  imageUrl: string;
  selfieUrl: string | null;
  bookId: string;
  createdAt: string;
  type: 'main' | 'extra';
}

const KidsMonthlyCharactersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const daysParam = searchParams.get('days') || '30';
  const days = parseInt(daysParam) || 30;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBase()}/analytics/onboarding/kids-characters?days=${days}`);
        const data = await res.json();
        if (data.success) {
          setCharacters(data.characters || []);
          setTotal(data.total || 0);
        } else {
          setError(data.message || 'Failed to load characters');
        }
      } catch (e) {
        setError('Failed to load characters');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, [days]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/onboarding-analytics')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Onboarding Analytics
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Kids Monthly Characters</h1>
        <p className="text-gray-500 text-sm mb-6">
          Characters created in Create Your Story books (last {days} days). Main kid + story characters.
        </p>

        {loading && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 mb-6">{error}</div>
        )}
        {!loading && !error && (
          <>
            <div className="text-gray-600 text-sm mb-4">
              {total} character{total !== 1 ? 's' : ''} total
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {characters.map((c, idx) => (
                <div
                  key={`${c.bookId}-${c.name}-${idx}`}
                  className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2 relative">
                    {c.imageUrl ? (
                      <img
                        src={getMediaUrl(c.imageUrl)}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {c.type === 'extra' && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Story
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 truncate text-sm" title={c.name}>
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                </div>
              ))}
            </div>
            {characters.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No characters created in this period.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default KidsMonthlyCharactersPage;
