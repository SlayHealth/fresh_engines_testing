import { API_URL } from '../config/api';

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Single-flight refresh. Coalesces every concurrent caller — apiFetch's 401
 * handler, the CompatibilityContext mount silentRefresh, a React StrictMode
 * double-mounted effect — onto ONE /api/auth/refresh call.
 *
 * Why this matters: the backend rotates AND immediately revokes the refresh
 * token on every use. If two code paths each POST the same token (they used
 * to: apiFetch had its own isRefreshing guard, but silentRefresh did a totally
 * separate raw fetch that didn't share it), the first rotates+revokes it and
 * the second then hits a now-revoked token → 401 → the app logs the user out
 * spuriously. One in-flight promise shared across the app removes that race.
 *
 * Resolves to the refresh response ({ success, accessToken, refreshToken,
 * user }); rejects if the refresh genuinely fails. Callers own the
 * consequences of failure (redirect / logout).
 */
export function refreshAuthSession() {
  if (refreshPromise) return refreshPromise;
  const p = (async () => {
    const savedRefreshToken = localStorage.getItem('slayhealth_refresh_token');
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: savedRefreshToken })
    });
    if (!res.ok) {
      // Carry the HTTP status so callers can tell an EXPECTED auth outcome
      // (401 = no or expired session — the normal state for a logged-out
      // visitor) apart from a GENUINE failure (network down, backend 5xx).
      // Without this every caller error-logs a plain not-signed-in state.
      const err = new Error('Refresh token expired or invalid');
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!(data.success && data.accessToken)) throw new Error('Refresh response invalid');
    setAccessToken(data.accessToken);
    if (data.refreshToken) localStorage.setItem('slayhealth_refresh_token', data.refreshToken);
    return data;
  })();
  refreshPromise = p;
  // Clear the slot once this refresh settles (success OR failure) so a later
  // genuinely new refresh can start. Uses then(clear, clear) rather than
  // .finally() so a rejection here doesn't spawn an *unhandled* rejection on
  // the finally-chain — the real rejection is owned by callers, which await
  // `p` directly inside their own try/catch.
  const clearSlot = () => { if (refreshPromise === p) refreshPromise = null; };
  p.then(clearSlot, clearSlot);
  return p;
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

    // 401 → attempt a single-flight refresh, then retry the original request
    // once with the fresh token. Concurrent 401s all await the same refresh.
    if (response.status === 401) {
      try {
        const data = await refreshAuthSession();
        options.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return await fetch(url, options);
      } catch (refreshErr) {
        console.error('[API Client] Silent refresh failed:', refreshErr.message);
        setAccessToken(null);
        // Clear local cache of user to trigger redirect to login page.
        // Note: the profile draft is intentionally NOT cleared here (nor in the
        // context's clearAllSessionStates) so a spurious/transient logout no
        // longer destroys in-progress work — see CompatibilityContext.
        localStorage.removeItem('slayhealth_user');
        localStorage.removeItem('slayhealth_refresh_token');
        window.dispatchEvent(new Event('auth_session_expired'));
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}
