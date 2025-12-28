export interface Book {
  id: string;
  title: string;
  coverUrl: string;
  level: string; // e.g., "5+", "4+"
  category: string;
  isAudio?: boolean;
  isRead?: boolean;
  description?: string;
  author?: string;
  isMembersOnly?: boolean; // Premium/locked content for subscribers only
}

export interface Playlist {
  _id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  type: 'Song' | 'Audiobook';
  items?: PlaylistItem[];
  status?: string;
  isMembersOnly?: boolean;
  isFeatured?: boolean;
  featuredOrder?: number;
}

export interface PlaylistItem {
  _id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  audioUrl: string;
  duration?: number;
  order?: number;
  isMembersOnly?: boolean;
  isFeatured?: boolean;
  featuredOrder?: number;
}

export interface FeaturedEpisode {
  _id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  audioUrl: string;
  duration?: number;
  isMembersOnly?: boolean;
  featuredOrder?: number;
  playCount?: number;
  // Parent playlist info
  playlist: {
    _id: string;
    title: string;
    type: 'Song' | 'Audiobook';
    coverImage?: string;
  };
  itemIndex: number;
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
}

export enum NavTab {
  EXPLORE = 'explore',
  LISTEN = 'listen',
  READ = 'read',
  LIBRARY = 'library'
}