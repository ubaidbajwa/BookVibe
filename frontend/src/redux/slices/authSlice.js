/**
 * @file authSlice.js
 * @description Authentication Redux Slice
 *
 * Manages the complete authentication lifecycle:
 *   - Session hydration on app boot (initializeAuth)
 *   - Login / logout async flows
 *   - Silent access-token refresh (refreshSession)
 *   - In-memory user state update without a round-trip (setUser)
 *
 * The `authReady` flag is critical: ProtectedRoute waits for it before
 * deciding to redirect to /login, preventing false redirect flashes.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import {
  clearStoredAuthUser,
  getStoredAuthSession,
  isStoredTokenExpired,
  persistStoredAuthSession,
} from "../../utils/authConfig";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// --- Private Helpers ---

/**
 * @function normalize
 * @description Normalizes a server response so that both `accessToken` and `token` fields
 * always point to the same value regardless of which key the server returned.
 * @param {Object} session - The session object to normalize.
 * @returns {Object|null} The normalized session or null.
 */
const normalize = (session) => {
  if (!session) {
    return null;
  }
  const token = session.accessToken || session.token || null;
  return {
    ...session,
    accessToken: token,
    token: token
  };
};

/**
 * @function persist
 * @description Normalizes then persists the session to localStorage.
 * Returns the normalized session so callers can use it directly.
 * @param {Object} session - The session object to persist.
 * @returns {Object|null} The normalized and persisted session.
 */
const persist = (session) => {
  const normalized = normalize(session);
  if (!normalized) {
    return null;
  }
  persistStoredAuthSession(normalized);
  return normalized;
};

/**
 * @function clearState
 * @description Resets all auth-related state fields and clears localStorage.
 * Called on logout, token rejection, and failed refresh.
 * @param {Object} state - The current Redux state.
 */
const clearState = (state) => {
  clearStoredAuthUser();
  state.user = null;
  state.isLogin = false;
  state.loading = false;
  state.success = false;
  state.error = null;
  state.message = "";
  state.refreshing = false;
};

/**
 * @function doRefresh
 * @description Performs a silent token refresh by hitting the refresh-token endpoint.
 * The httpOnly refresh-token cookie is sent automatically via withCredentials.
 * @returns {Promise<Object>} The new normalized session.
 */
const doRefresh = async () => {
  const response = await axios.post(
    `${BASE_URL}/user/refresh`,
    {},
    { withCredentials: true }
  );
  return persist(response.data);
};

// --- Async Thunks ---

/**
 * @function initializeAuth
 * @description Runs once on app mount.
 * Algorithm:
 *  1. Read the stored session from localStorage.
 *  2. If nothing is stored -> clear + return null (unauthenticated).
 *  3. If the token is still valid -> return the stored session as-is.
 *  4. If the token is expired -> attempt a silent refresh.
 *  5. If the refresh fails -> clear localStorage and return null.
 * @returns {Promise<Object|null>} The initialized session or null.
 */
export const initializeAuth = createAsyncThunk(
  "auth/initializeAuth",
  async () => {
    const stored = normalize(getStoredAuthSession());

    if (!stored) {
      clearStoredAuthUser();
      return null;
    }

    // Token is still fresh — reuse without hitting the network
    if (!isStoredTokenExpired()) {
      return stored;
    }

    // Token is expired — try to silently refresh
    try {
      return await doRefresh();
    } catch {
      clearStoredAuthUser();
      return null;
    }
  }
);

/**
 * @function login
 * @description Submits credentials and stores the returned session.
 * @param {Object} credentials - User credentials (email/password).
 * @returns {Promise<Object>} The logged-in session.
 */
export const login = createAsyncThunk(
  "auth/login",
  async (credentials, thunkAPI) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/user/login`,
        credentials,
        {
          withCredentials: true
        }
      );
      return persist(response.data);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

/**
 * @function refreshSession
 * @description Silently exchanges the httpOnly refresh-token cookie for a new access token.
 * Called by the Axios response interceptor on 401 errors.
 * @returns {Promise<Object>} The refreshed session.
 */
export const refreshSession = createAsyncThunk(
  "auth/refreshSession",
  async (_, thunkAPI) => {
    try {
      return await doRefresh();
    } catch (error) {
      clearStoredAuthUser();
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

/**
 * @function logoutUser
 * @description Calls the server logout endpoint to invalidate the refresh-token cookie, then clears client-side state.
 * @returns {Promise<Object>} The server response data.
 */
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, thunkAPI) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/user/logout`,
        {},
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// --- Slice ---

// Hydrate initial state from localStorage so the UI is not blank on refresh
const stored = normalize(getStoredAuthSession());

const authSlice = createSlice({
  name: "auth",

  // --- State ---
  initialState: {
    user: stored,
    isLogin: Boolean(stored),
    loading: false,
    success: false,
    error: null,
    message: "",
    authReady: false, // true once initializeAuth resolves (prevents redirect flashes)
    refreshing: false, // true while a silent refresh is in flight
  },

  // --- Reducers ---
  reducers: {
    /**
     * @function reset
     * @description Clears transient UI state (loading / error / success) without touching the user session.
     */
    reset(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.message = "";
    },

    /**
     * @function logout
     * @description Immediately clears all auth state and localStorage.
     */
    logout(state) {
      clearState(state);
      state.authReady = true;
    },

    /**
     * @function setUser
     * @description Merges a partial user object into the stored session.
     * @param {Object} action - The action containing the partial user object.
     */
    setUser(state, action) {
      if (!state.user) {
        return;
      }

      // Deep-merge into the nested `user` sub-object while preserving
      // token fields at the top level of the session
      const updatedUser = {
        ...state.user.user,
        ...action.payload
      };
      state.user = {
        ...state.user,
        user: updatedUser
      };
      persistStoredAuthSession(state.user);
    },
  },

  // --- Extra Reducers ---
  extraReducers: (builder) => {
    // --- initializeAuth Cases ---
    builder.addCase(initializeAuth.pending, (state) => {
      state.authReady = false;
    });

    builder.addCase(initializeAuth.fulfilled, (state, action) => {
      state.authReady = true;
      state.error = null;

      if (action.payload) {
        state.user = action.payload;
        state.isLogin = true;
      } else {
        state.user = null;
        state.isLogin = false;
      }
    });

    builder.addCase(initializeAuth.rejected, (state) => {
      clearState(state);
      state.authReady = true;
    });

    // --- login Cases ---
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.authReady = true;
    });

    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.isLogin = true;
      state.user = action.payload;
      state.message = action.payload?.message;
      state.success = true;
      state.error = null;
      state.authReady = true;
    });

    builder.addCase(login.rejected, (state, action) => {
      clearState(state);
      state.error = action.payload;
      state.authReady = true;
    });

    // --- refreshSession Cases ---
    builder.addCase(refreshSession.pending, (state) => {
      state.refreshing = true;
    });

    builder.addCase(refreshSession.fulfilled, (state, action) => {
      state.refreshing = false;
      state.authReady = true;
      state.user = action.payload;
      state.isLogin = true;
      state.error = null;
    });

    builder.addCase(refreshSession.rejected, (state) => {
      clearState(state);
      state.authReady = true;
    });

    // --- logoutUser Cases ---
    builder.addCase(logoutUser.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(logoutUser.fulfilled, (state) => {
      clearState(state);
      state.success = true;
      state.authReady = true;
    });

    builder.addCase(logoutUser.rejected, (state, action) => {
      clearState(state);
      state.error = action.payload;
      state.authReady = true;
    });
  },
});

export const { reset, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
