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