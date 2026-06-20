/**
 * @file authConfig.js
 * @description Auth Session Persistence & Token Utilities
 *
 * Provides helpers for reading/writing the BookVibe auth session to
 * localStorage ('bv_session' key), checking JWT expiry, and building the
 * Axios request config object that includes the Authorization header.
 *
 * The stored session shape is:
 *   { user: {...}, accessToken: string, token: string, ... }
 */

const AUTH_STORAGE_KEY = "bv_session";

// --- Session Read/Write ---

/**
 * @function getStoredAuthSession
 * @description Retrieves the stored auth session from localStorage.
 * Returns null if nothing is stored or the JSON is corrupted.
 * @returns {Object|null} The stored session object or null.
 */
export const getStoredAuthSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    } else {
      return null;
    }
  } catch {
    return null;
  }
};

/**
 * @function persistStoredAuthSession
 * @description Persists the provided session object to localStorage.
 * Silently ignores write errors (e.g. private-browsing storage limits).
 * @param {Object} session - The session object to persist.
 */
export const persistStoredAuthSession = (session) => {
  if (!session) {
    return;
  }
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
};

/**
 * @function clearStoredAuthUser
 * @description Removes the stored auth session (used on logout or token invalidation).
 */
export const clearStoredAuthUser = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

// --- Token Helpers ---

/**
 * @function getStoredAuthToken
 * @description Returns the raw access-token string from the stored session, or null if no session exists.
 * @returns {string|null} The raw access token or null.
 */
export const getStoredAuthToken = () => {
  const session = getStoredAuthSession();
  if (session) {
    return session.accessToken || session.token || null;
  } else {
    return null;
  }
};

/**
 * @function updateStoredAccessToken
 * @description Replaces the access token inside the stored session with a new value.
 * Used by the Axios interceptor after a silent token refresh.
 * @param {string} newToken - The new access token.
 * @returns {Object|null} The updated session object, or null if no session was stored.
 */
export const updateStoredAccessToken = (newToken) => {
  const session = getStoredAuthSession();
  if (!session || !newToken) {
    return null;
  }

  const updated = {
    ...session,
    accessToken: newToken,
    token: newToken,
  };

  persistStoredAuthSession(updated);
  return updated;
};

// --- JWT Expiry Check ---

/**
 * @function parseJwt
 * @description Decodes a JWT without verifying its signature (client-side only).
 * Returns the payload object, or null if the token is malformed.
 * @param {string} token - The JWT string to parse.
 * @returns {Object|null} The decoded JWT payload or null.
 */
const parseJwt = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Base64url -> Base64 -> decode
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    base64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

/**
 * @function isStoredTokenExpired
 * @description Returns true if the stored access token is absent or within 30 seconds of expiry.
 * The 30-second buffer prevents edge-case 401 errors when the token expires.
 * @returns {boolean} True if the token is expired or absent.
 */
export const isStoredTokenExpired = () => {
  const token = getStoredAuthToken();
  if (!token) {
    return true;
  }

  const payload = parseJwt(token);
  if (!payload) {
    return true;
  }

  // Tokens without an 'exp' claim are treated as non-expiring
  if (!payload.exp) {
    return false;
  }

  const expiryMs = payload.exp * 1000;
  return expiryMs <= Date.now() + 30000;
};

// --- Axios Config Builder ---

/**
 * @function getAuthConfig
 * @description Builds an Axios request config object.
 *  - sets withCredentials: true (for httpOnly refresh-token cookie)
 *  - merges any extra headers the caller provides
 *  - appends Authorization: Bearer <token> when a token is stored
 * @param {Object} extra - Optional extra config (e.g. { timeout: 60000 }).
 *   Do NOT pass a 'Content-Type': 'multipart/form-data' override when sending a
 *   FormData body — axios/the browser must compute that header themselves so the
 *   multipart boundary matches the actual body. An explicit, boundary-less value
 *   here silently breaks the upload (the server receives an unparseable request).
 * @returns {Object} The Axios request configuration object.
 */
export const getAuthConfig = (extra = {}) => {
  const token = getStoredAuthToken();

  const config = {
    ...extra,
    withCredentials: true,
    headers: {
      ...(extra.headers || {}),
    },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Admin second-factor: after PIN verification the gate token is stored in
  // sessionStorage. Attach it so the backend `requireAdminGate` middleware can
  // enforce the PIN server-side. Harmless on non-admin requests (absent → no header).
  try {
    const gateToken = sessionStorage.getItem("bv_admin_gate");
    if (gateToken) {
      config.headers["X-Admin-Gate"] = gateToken;
    }
  } catch {
    // sessionStorage unavailable (e.g. SSR/private mode) — skip silently.
  }

  return config;
};
