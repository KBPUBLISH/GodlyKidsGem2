export interface Review {
  _id?: string;
  author: string;
  rating: number;
  text?: string;
  date?: string;
}

export interface AmazonBook {
  _id: string;
  title: string;
  author: string;
  description?: string;
  amazonUrl: string;
  asin?: string;
  price?: string;
  coverImage: string;
  images?: string[];
  promoVideoUrl?: string;
  reviews?: Review[];
  category?: string;
  categories?: string[];
  minAge?: number;
  maxAge?: number;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  featuredOrder: number;
  badgeText?: string;
  badgeColor?: string;
  clickCount?: number;
  createdAt?: string;
}

const DEFAULT_API_BASE = 'https://backendgk2-0.onrender.com';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || DEFAULT_API_BASE;

interface ListResponse {
  data?: AmazonBook[];
  pagination?: { page: number; limit: number; total: number; pages: number; hasMore: boolean };
}

export async function fetchPublishedBooks(): Promise<AmazonBook[]> {
  const url = `${API_BASE_URL}/api/amazon-books?status=published&limit=100`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to load books (${res.status})`);
  const body = (await res.json()) as ListResponse | AmazonBook[];
  if (Array.isArray(body)) return body;
  return body.data ?? [];
}

export async function trackBookClick(bookId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/amazon-books/${bookId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch {
    // non-blocking — do not prevent the user from reaching Amazon
  }
}
