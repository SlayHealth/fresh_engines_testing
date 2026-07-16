import { API_URL } from '../config/api';

let accessToken = null;
let isRefreshing = false;
let refreshSubscribers = [];

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

// UX1-01/UX7-01/UX8-09: every auth/invite call site did `await res.json()`
// straight into a try/catch and put the exception's own message on screen
// via `err.message`. That's fine when the server always answers with JSON —
// it doesn't when a rate limiter, dev-proxy hiccup, or unhandled backend
// exception replies with a plain-text/HTML body instead, in which case the
// user sees a raw SyntaxError like "Unexpected token 'I', "Internal S"...
// is not valid JSON." Route every response through this instead of a bare
// `res.json()` so a non-JSON body degrades to a normal, friendly error
// object rather than throwing mid-parse.
export async function safeJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: false, error: 'Something went wrong. Please try again in a moment.' };
  }
}

/**
 * Custom fetch wrapper that appends JWT Authorization header and handles silent token refreshes automatically.
 * @param {string} url - API target endpoint.
 * @param {Object} options - Standard fetch options.
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}) {
  // Ensure headers object exists
  options.headers = options.headers || {};
  
  // Set default content type if not uploading files (FormData)
  if (!(options.body instanceof FormData) && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }

  // Attach access token if present in memory
  if (accessToken) {
    options.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Enable cookies for credentials (HttpOnly refresh token)
  options.credentials = 'include';

  try {
    const response = await fetch(url, options);

    // If 401 Unauthorized, check if we can refresh
    if (response.status === 401) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            options.headers['Authorization'] = `Bearer ${token}`;
            resolve(fetch(url, options));
          });
        });
      }

      isRefreshing = true;

      try {
        console.log('[API Client] Access token expired, attempting silent token refresh...');
        const savedRefreshToken = localStorage.getItem('slayhealth_refresh_token');
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: savedRefreshToken })
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh token expired or invalid');
        }

        const data = await refreshResponse.json();
        if (data.success && data.accessToken) {
          console.log('[API Client] Refresh successful, retrying request.');
          setAccessToken(data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('slayhealth_refresh_token', data.refreshToken);
          }
          onRefreshed(data.accessToken);
          
          // Retry original request with new token
          options.headers['Authorization'] = `Bearer ${data.accessToken}`;
          return await fetch(url, options);
        } else {
          throw new Error('Refresh response invalid');
        }
      } catch (refreshErr) {
        console.error('[API Client] Silent refresh failed:', refreshErr.message);
        setAccessToken(null);
        // Clear local cache of user to trigger redirect to login page
        localStorage.removeItem('slayhealth_user');
        localStorage.removeItem('slayhealth_refresh_token');
        
        // Dispatch custom event so context/app knows to redirect
        window.dispatchEvent(new Event('auth_session_expired'));
        
        throw new Error('Session expired. Please log in again.');
      } finally {
        isRefreshing = false;
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}
