import React, { useState, useEffect, useCallback } from 'react';
import { Star, GripVertical, BookOpen, Music, Save, Loader2, ChevronDown, ChevronRight, Headphones } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Book {
  _id: string;
  title: string;
  author: string;
  coverImage?: string;
  files?: { coverImage?: string };
  status: string;
  isFeatured?: boolean;
  featuredOrder?: number;
}

interface PlaylistItem {
  _id: string;
  title: string;
  artist?: string;
  coverImage?: string;
  audioUrl?: string;
  duration?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
}

interface Playlist {
  _id: string;
  title: string;
  author: string;
  coverImage?: string;
  type: string;
  status: string;
  isFeatured?: boolean;
  featuredOrder?: number;
  items?: PlaylistItem[];
}

interface FeaturedEpisode {
  _id: string;
  playlistId: string;
  itemId: string;
  title: string;
  artist?: string;
  coverImage?: string;
  playlistTitle: string;
  playlistType: string;
  isFeatured?: boolean;
  featuredOrder?: number;
}

type FeaturedItem = (Book | Playlist | FeaturedEpisode) & { itemType: 'book' | 'playlist' | 'episode' };

type ActiveTab = 'books-carousel' | 'audio-carousel' | 'add-books' | 'add-audio';

const FeaturedContent: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [featuredBooks, setFeaturedBooks] = useState<FeaturedItem[]>([]);
  const [featuredAudio, setFeaturedAudio] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('books-carousel');
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());

  const fetchAllPages = useCallback(async <T,>(endpoint: string): Promise<T[]> => {
    const pageSize = 100;
    let page = 1;
    let results: T[] = [];
    while (true) {
      const res = await apiClient.get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=${pageSize}`);
      const payload = res.data;
      const pageItems: T[] = Array.isArray(payload) ? payload : (payload.data || payload.playlists || payload.books || []);
      results = results.concat(pageItems);
      const hasMore = Array.isArray(payload) ? false : Boolean(payload.pagination?.hasMore);
      if (!hasMore) break;
      page += 1;
    }
    return results;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [booksArray, playlistsArray] = await Promise.all([
        fetchAllPages<Book>('/api/books?status=all'),
        fetchAllPages<Playlist>('/api/playlists?status=all'),
      ]);

      const booksData = booksArray.filter((b: Book) => b.status === 'published');
      const playlistsData = playlistsArray.filter((p: Playlist) => p.status === 'published');

      setBooks(booksData);
      setPlaylists(playlistsData);

      const bookItems: FeaturedItem[] = [];
      const audioItems: FeaturedItem[] = [];

      booksData.forEach((book: Book) => {
        if (book.isFeatured) {
          bookItems.push({ ...book, itemType: 'book' });
        }
      });

      playlistsData.forEach((playlist: Playlist) => {
        if (playlist.isFeatured) {
          audioItems.push({ ...playlist, itemType: 'playlist' });
        }
        if (playlist.items) {
          playlist.items.forEach((item: PlaylistItem) => {
            if (item.isFeatured) {
              audioItems.push({
                _id: `${playlist._id}_${item._id}`,
                playlistId: playlist._id,
                itemId: item._id,
                title: item.title,
                artist: item.artist,
                coverImage: item.coverImage || playlist.coverImage,
                playlistTitle: playlist.title,
                playlistType: playlist.type,
                isFeatured: true,
                featuredOrder: item.featuredOrder || 0,
                itemType: 'episode',
              });
            }
          });
        }
      });

      bookItems.sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
      audioItems.sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
      setFeaturedBooks(bookItems);
      setFeaturedAudio(audioItems);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchAllPages]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCoverImage = (item: Book | Playlist): string => {
    if ('files' in item && item.files?.coverImage) return item.files.coverImage;
    return item.coverImage || '';
  };

  const togglePlaylistExpanded = (playlistId: string) => {
    setExpandedPlaylists(prev => {
      const next = new Set(prev);
      next.has(playlistId) ? next.delete(playlistId) : next.add(playlistId);
      return next;
    });
  };

  // --- Add / Remove / Move helpers ---
  const addBookToFeatured = (book: Book) => {
    if (featuredBooks.some(f => f._id === book._id)) return;
    setFeaturedBooks(prev => [...prev, { ...book, itemType: 'book', isFeatured: true, featuredOrder: prev.length }]);
  };

  const addPlaylistToFeatured = (playlist: Playlist) => {
    if (featuredAudio.some(f => f._id === playlist._id && f.itemType === 'playlist')) return;
    setFeaturedAudio(prev => [...prev, { ...playlist, itemType: 'playlist', isFeatured: true, featuredOrder: prev.length }]);
  };

  const addEpisodeToFeatured = (playlist: Playlist, episode: PlaylistItem) => {
    const compositeId = `${playlist._id}_${episode._id}`;
    if (featuredAudio.some(f => f._id === compositeId && f.itemType === 'episode')) return;
    const item: FeaturedItem = {
      _id: compositeId,
      playlistId: playlist._id,
      itemId: episode._id,
      title: episode.title,
      artist: episode.artist,
      coverImage: episode.coverImage || playlist.coverImage,
      playlistTitle: playlist.title,
      playlistType: playlist.type,
      isFeatured: true,
      featuredOrder: featuredAudio.length,
      itemType: 'episode',
    };
    setFeaturedAudio(prev => [...prev, item]);
  };

  const removeItem = (list: FeaturedItem[], setList: React.Dispatch<React.SetStateAction<FeaturedItem[]>>, itemId: string, itemType: string) => {
    setList(list.filter(f => !(f._id === itemId && f.itemType === itemType)));
  };

  const moveItem = (list: FeaturedItem[], setList: React.Dispatch<React.SetStateAction<FeaturedItem[]>>, index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === list.length - 1)) return;
    const next = [...list];
    const target = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
  };

  const isBookFeatured = (bookId: string) => featuredBooks.some(f => f._id === bookId);
  const isPlaylistFeatured = (playlistId: string) => featuredAudio.some(f => f._id === playlistId && f.itemType === 'playlist');
  const isEpisodeFeatured = (playlistId: string, itemId: string) => featuredAudio.some(f => f._id === `${playlistId}_${itemId}` && f.itemType === 'episode');

  // --- Save ---
  const saveAll = async () => {
    setSaving(true);
    try {
      // Unfeatured books no longer in the list
      for (const book of books.filter(b => b.isFeatured)) {
        if (!featuredBooks.some(f => f._id === book._id)) {
          await apiClient.put(`/api/books/${book._id}`, { isFeatured: false, featuredOrder: 0 });
        }
      }
      // Unfeatured playlists no longer in the list
      for (const pl of playlists.filter(p => p.isFeatured)) {
        if (!featuredAudio.some(f => f._id === pl._id && f.itemType === 'playlist')) {
          await apiClient.put(`/api/playlists/${pl._id}`, { isFeatured: false, featuredOrder: 0 });
        }
      }
      // Unfeatured episodes no longer in the list
      for (const pl of playlists) {
        if (pl.items) {
          for (const ep of pl.items) {
            if (ep.isFeatured && !featuredAudio.some(f => f._id === `${pl._id}_${ep._id}` && f.itemType === 'episode')) {
              await apiClient.put(`/api/playlists/${pl._id}/items/${ep._id}/featured`, { isFeatured: false, featuredOrder: 0 });
            }
          }
        }
      }
      // Save featured books order
      for (let i = 0; i < featuredBooks.length; i++) {
        await apiClient.put(`/api/books/${featuredBooks[i]._id}`, { isFeatured: true, featuredOrder: i });
      }
      // Save featured audio order
      for (let i = 0; i < featuredAudio.length; i++) {
        const item = featuredAudio[i];
        if (item.itemType === 'episode') {
          const ep = item as FeaturedEpisode & { itemType: 'episode' };
          await apiClient.put(`/api/playlists/${ep.playlistId}/items/${ep.itemId}/featured`, { isFeatured: true, featuredOrder: i });
        } else {
          await apiClient.put(`/api/playlists/${item._id}`, { isFeatured: true, featuredOrder: i });
        }
      }

      alert('Featured content saved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error saving featured items:', error);
      alert('Failed to save featured content. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- Renderers ---
  const renderCarouselList = (items: FeaturedItem[], setItems: React.Dispatch<React.SetStateAction<FeaturedItem[]>>, emptyLabel: string) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No featured {emptyLabel} yet.</p>
          <p className="text-sm">Go to the Add {emptyLabel} tab to add items.</p>
        </div>
      );
    }
    return (
      <ul className="divide-y divide-gray-200">
        {items.map((item, index) => {
          const isEp = item.itemType === 'episode';
          const ep = isEp ? (item as FeaturedEpisode & { itemType: 'episode' }) : null;
          return (
            <li key={`${item.itemType}-${item._id}`} className="p-4 flex items-center gap-4 hover:bg-gray-50">
              <div className="flex flex-col gap-1">
                <button onClick={() => moveItem(items, setItems, index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">▲</button>
                <button onClick={() => moveItem(items, setItems, index, 'down')} disabled={index === items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">▼</button>
              </div>
              <GripVertical className="w-5 h-5 text-gray-400" />
              <span className="w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full font-semibold text-sm">{index + 1}</span>
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {(isEp ? ep?.coverImage : getCoverImage(item as Book | Playlist)) ? (
                  <img src={isEp ? ep?.coverImage : getCoverImage(item as Book | Playlist)} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    {item.itemType === 'book' ? <BookOpen className="w-6 h-6" /> : item.itemType === 'episode' ? <Headphones className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.title}</p>
                {isEp && ep ? (
                  <p className="text-sm text-gray-500">from <span className="font-medium">{ep.playlistTitle}</span>{ep.artist && <span> &bull; {ep.artist}</span>}</p>
                ) : (
                  <p className="text-sm text-gray-500">{(item as Book | Playlist).author}</p>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                  item.itemType === 'book' ? 'bg-blue-100 text-blue-800' : item.itemType === 'episode' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {item.itemType === 'book' ? '📚 Book' : item.itemType === 'episode' ? '🎧 Episode' : '🎵 Playlist'}
                </span>
              </div>
              <button onClick={() => removeItem(items, setItems, item._id, item.itemType)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Remove</button>
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Featured Content
          </h1>
          <p className="text-gray-600 mt-1">
            Manage separate featured carousels for the Books (Read) page and Audiobooks (Listen) page.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : (<><Save className="w-4 h-4" /> Save Changes</>)}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('books-carousel')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${activeTab === 'books-carousel' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <BookOpen className="w-4 h-4" />
            Books Carousel ({featuredBooks.length})
          </button>
          <button
            onClick={() => setActiveTab('audio-carousel')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${activeTab === 'audio-carousel' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <Headphones className="w-4 h-4" />
            Audio Carousel ({featuredAudio.length})
          </button>
          <button
            onClick={() => setActiveTab('add-books')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'add-books' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            + Add Books
          </button>
          <button
            onClick={() => setActiveTab('add-audio')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'add-audio' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            + Add Audio
          </button>
        </nav>
      </div>

      {/* Books Carousel Tab */}
      {activeTab === 'books-carousel' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Featured Books — Read Page</h2>
            <p className="text-sm text-gray-500">These books appear in the carousel on the Read (Scholar Island) page.</p>
          </div>
          {renderCarouselList(featuredBooks, setFeaturedBooks, 'books')}
        </div>
      )}

      {/* Audio Carousel Tab */}
      {activeTab === 'audio-carousel' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Featured Audiobooks — Listen Page</h2>
            <p className="text-sm text-gray-500">These playlists and episodes appear in the carousel on the Listen (Audio Adventure Island) page.</p>
          </div>
          {renderCarouselList(featuredAudio, setFeaturedAudio, 'audio')}
        </div>
      )}

      {/* Add Books Tab */}
      {activeTab === 'add-books' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Published Books</h2>
            <p className="text-sm text-gray-500">Click "Add to Featured" to include a book in the Read page carousel.</p>
          </div>
          {books.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No published books available.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {books.map((book) => (
                <li key={book._id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {getCoverImage(book) ? (
                      <img src={getCoverImage(book)} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><BookOpen className="w-6 h-6" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{book.title}</p>
                    <p className="text-sm text-gray-500">{book.author}</p>
                  </div>
                  {isBookFeatured(book._id) ? (
                    <span className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-1"><Star className="w-4 h-4" /> Featured</span>
                  ) : (
                    <button onClick={() => addBookToFeatured(book)} className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Add to Featured</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add Audio Tab */}
      {activeTab === 'add-audio' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Published Playlists</h2>
            <p className="text-sm text-gray-500">Click "Add to Featured" to include in the Listen page carousel, or expand to feature individual episodes.</p>
          </div>
          {playlists.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Music className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No published playlists available.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {playlists.map((playlist) => (
                <li key={playlist._id} className="border-b border-gray-100 last:border-b-0">
                  <div className="p-4 flex items-center gap-4 hover:bg-gray-50">
                    {playlist.items && playlist.items.length > 0 ? (
                      <button onClick={() => togglePlaylistExpanded(playlist._id)} className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title={expandedPlaylists.has(playlist._id) ? 'Collapse' : 'Expand'}>
                        {expandedPlaylists.has(playlist._id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {playlist.coverImage ? (
                        <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {playlist.type === 'Audiobook' ? <Headphones className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{playlist.title}</p>
                      <p className="text-sm text-gray-500">{playlist.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${playlist.type === 'Audiobook' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                          {playlist.type === 'Audiobook' ? '📖 Audiobook' : '🎵 Music'}
                        </span>
                        {playlist.items && playlist.items.length > 0 && (
                          <span className="text-xs text-gray-500">{playlist.items.length} {playlist.type === 'Audiobook' ? 'episodes' : 'songs'}</span>
                        )}
                      </div>
                    </div>
                    {isPlaylistFeatured(playlist._id) ? (
                      <span className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-1"><Star className="w-4 h-4" /> Featured</span>
                    ) : (
                      <button onClick={() => addPlaylistToFeatured(playlist)} className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Add to Featured</button>
                    )}
                  </div>
                  {expandedPlaylists.has(playlist._id) && playlist.items && playlist.items.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{playlist.type === 'Audiobook' ? 'Episodes' : 'Songs'} ({playlist.items.length})</p>
                      </div>
                      <ul className="divide-y divide-gray-200">
                        {playlist.items.map((episode, idx) => (
                          <li key={episode._id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-100">
                            <span className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">{idx + 1}</span>
                            <div className="w-12 h-12 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                              {(episode.coverImage || playlist.coverImage) ? (
                                <img src={episode.coverImage || playlist.coverImage} alt={episode.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  {playlist.type === 'Audiobook' ? <Headphones className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate text-sm">{episode.title}</p>
                              {episode.artist && <p className="text-xs text-gray-500">{episode.artist}</p>}
                            </div>
                            {isEpisodeFeatured(playlist._id, episode._id) ? (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded flex items-center gap-1"><Star className="w-3 h-3" /> Featured</span>
                            ) : (
                              <button onClick={() => addEpisodeToFeatured(playlist, episode)} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors">Feature Episode</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FeaturedContent;
