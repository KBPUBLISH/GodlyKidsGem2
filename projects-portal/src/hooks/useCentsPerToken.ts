import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

/** Fallback used before the real rate arrives, or if the request fails. */
export const DEFAULT_CENTS_PER_TOKEN = 54;

// Cached across pages: the rate only changes when an admin renegotiates it.
let cachedRate: number | null = null;
let inFlight: Promise<number> | null = null;

function loadRate(token: string | null): Promise<number> {
  if (cachedRate !== null) return Promise.resolve(cachedRate);
  if (!inFlight) {
    inFlight = axios
      .get(`${API_URL}/api/creator/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        const rate = Number(res.data?.centsPerToken);
        cachedRate = rate > 0 ? rate : DEFAULT_CENTS_PER_TOKEN;
        return cachedRate;
      })
      .catch(() => DEFAULT_CENTS_PER_TOKEN)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * What this creator earns per token spent on their content, in cents.
 * The rate is set per creator on the backend, so the portal must never
 * hardcode it into the "you'll earn ~$X" estimates.
 */
export function useCentsPerToken(): number {
  const { getToken } = useAuth();
  const [rate, setRate] = useState<number>(cachedRate ?? DEFAULT_CENTS_PER_TOKEN);

  useEffect(() => {
    let active = true;
    loadRate(getToken()).then((value) => {
      if (active) setRate(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return rate;
}

/** Convenience for the common "N tokens is about $X" line. */
export function tokensToDollars(tokens: number, centsPerToken: number): string {
  return ((tokens * centsPerToken) / 100).toFixed(2);
}
