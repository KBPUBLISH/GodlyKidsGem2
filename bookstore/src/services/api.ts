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
  amazonUrl?: string;
  asin?: string;
  price?: string;
  stripePaymentLinkUrl?: string;
  stripePriceId?: string;
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
  stripeClickCount?: number;
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

/**
 * Ask the backend for a Stripe checkout URL for this book.
 *  - If the book has a Payment Link, we get that URL back directly.
 *  - Otherwise, the backend creates a Checkout Session on the fly.
 * Either way, the caller should redirect the browser to `url`.
 */
export async function createBookCheckoutSession(
  bookId: string
): Promise<{ url: string; mode: 'payment_link' | 'checkout_session' }> {
  const res = await fetch(`${API_BASE_URL}/api/amazon-books/${bookId}/checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    }),
  });
  if (!res.ok) {
    let message = `Failed to start checkout (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = await res.json();
  if (!body?.url) throw new Error('Checkout session did not return a URL');
  return { url: body.url as string, mode: (body.mode as 'payment_link' | 'checkout_session') ?? 'checkout_session' };
}
