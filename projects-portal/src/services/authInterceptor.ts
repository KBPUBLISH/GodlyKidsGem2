import axios from 'axios';
import apiClient from './apiClient';

/**
 * Endpoints where a 401 means "these credentials are wrong", not "your session
 * died". The login forms surface those inline, so they must never trigger a
 * session-expired redirect. Church accounts keep a separate session entirely
 * (see churchApi), so their 401s are none of our business either.
 */
const IGNORED_PATHS = ['/api/auth/login', '/api/creator/login', '/api/church/'];

const isIgnored = (url?: string): boolean =>
  !!url && IGNORED_PATHS.some((path) => url.includes(path));

/**
 * Calls onUnauthorized whenever an API request comes back 401. A 403 is left
 * alone: it means the backend knows who we are and is refusing the action (the
 * admin email allowlist returns 403), so clearing a working session would be wrong.
 *
 * Admin and creator pages call bare `axios` rather than `apiClient`, and
 * axios.create() instances do not inherit the default instance's interceptors,
 * so both need the handler. Returns a cleanup function that ejects them.
 */
export const installUnauthorizedHandler = (onUnauthorized: () => void): (() => void) => {
  const handler = (error: any) => {
    if (error?.response?.status === 401 && !isIgnored(error?.config?.url)) {
      onUnauthorized();
    }
    return Promise.reject(error);
  };

  const globalId = axios.interceptors.response.use(undefined, handler);
  const clientId = apiClient.interceptors.response.use(undefined, handler);

  return () => {
    axios.interceptors.response.eject(globalId);
    apiClient.interceptors.response.eject(clientId);
  };
};
