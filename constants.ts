import { Book } from './types';

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Level 1 Christian',
    coverUrl: 'https://picsum.photos/seed/minecraft/400/400', 
    level: '5+',
    category: 'Activity Books',
    description: 'Journey into a game like adventure book! Help our main character discover the path to the pixel Kingdom.',
    author: 'Kingdom Builders Publishing',
    isRead: false
  },
  {
    id: '2',
    title: 'The Prince of the Hollow Kingdom',
    coverUrl: 'https://picsum.photos/seed/prince/400/400',
    level: '5+',
    category: 'Books Gone Free',
    isAudio: true
  },
  {
    id: '3',
    title: "Paul's Worst Day Ever",
    coverUrl: 'https://picsum.photos/seed/paul/400/400',
    level: '4+',
    category: 'Bible Stories',
    isRead: true
  },
  {
    id: '4',
    title: 'The Boy Who Almost Had Everything',
    coverUrl: 'https://picsum.photos/seed/boy/400/400',
    level: '4+',
    category: 'Young Readers'
  },
  {
    id: '5',
    title: 'Grace and Lazar',
    coverUrl: 'https://picsum.photos/seed/grace/400/500',
    level: '6+',
    category: 'New Arrivals Books'
  },
  {
    id: '6',
    title: 'Noah and the Never-Ending Promise',
    coverUrl: 'https://picsum.photos/seed/noah/400/400',
    level: '2+',
    category: 'Young Readers'
  },
  {
    id: '7',
    title: 'Go Tales',
    coverUrl: 'https://picsum.photos/seed/gotales/400/400',
    level: '0+',
    category: 'Activity Books'
  }
];

export const API_BASE_URL = "https://api.devgodlykids.kbpublish.org/";