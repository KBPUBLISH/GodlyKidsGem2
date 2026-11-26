import { getApiBaseUrl } from './apiService';

const TOKEN_KEY = 'gk_church_token';

export interface ChurchPlan {
  id: string;
  name: string;
  priceUsd: number;
  interval: string;
  seatLimit: number;
  seatsUsed: number;
  seatsLeft: number;
  charged: boolean;
}

export interface ChurchAccount {
  id: string;
  name: string;
  contactName?: string;
  email: string;
  city?: string;
  joinCode: string;
  subscriptionStatus: string;
  entitled: boolean;
  plan: ChurchPlan;
  bibleGap?: string;
  testMarkPaid?: boolean;
}

export interface KidBible {
  creationWeek: { finished: number; total: number; daysFinished: string[] } | null;
  weeks: Array<{ id: string; title: string; finished: number; total: number; daysFinished: string[] }>;
  bibleMapStoriesRead: string[];
  nothingStored: boolean;
  gap: string;
}

export interface ChurchSeatRow {
  id: string;
  familyName: string;
  email: string | null;
  apps: string[];
  joinedAt: string;
  kids: Array<{ id?: string; name: string; age?: number; bible: KidBible }>;
  kidsStored: boolean;
  bibleGap: string;
}

export interface ChurchBoard {
  church: ChurchAccount;
  seatsUsed: number;
  seatLimit: number;
  bibleGap: string;
  seats: ChurchSeatRow[];
}

export const churchToken = () => localStorage.getItem(TOKEN_KEY);

export const setChurchToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

const churchUrl = (path: string) => {
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/church${path}`;
};

async function call<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) {
    const token = churchToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(churchUrl(path), {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'The church service could not complete that.');
  }
  return data as T;
}

export const registerChurch = (body: {
  name: string;
  contactName: string;
  email: string;
  password: string;
  city: string;
}) => call<{ token: string; church: ChurchAccount }>('/register', { method: 'POST', body, auth: false });

export const loginChurch = (email: string, password: string) =>
  call<{ token: string; church: ChurchAccount }>('/login', { method: 'POST', body: { email, password }, auth: false });

export const loadChurchSeats = () => call<ChurchBoard>('/seats');

export const markTestChurchPaid = () => call<{ church: ChurchAccount; testOnly: boolean }>('/test/mark-paid', { method: 'POST' });
