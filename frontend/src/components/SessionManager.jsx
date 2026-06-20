/**
 * @file SessionManager.jsx
 * @description Global Auth Session Lifecycle Manager
 *
 * A null-rendering component mounted inside the router that handles:
 *   1. App-boot session hydration via `initializeAuth`
 *   2. Global Axios 401 response interceptor for silent token refresh
 *   3. Graceful session expiry (logout + redirect) when refresh fails
 *   4. Anti-fraud/debt error surfacing (HOST_DEBT_LIMIT, KYC_REQUIRED)
 */

import { useEffect, useRef } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  initializeAuth,
  logout,
  refreshSession,
  reset,
} from "../redux/slices/authSlice";

// --- Constants ---

// Error message substrings that indicate an auth failure from the server
const AUTH_ERROR_MESSAGES = [
  "authentication token missing",
  "token has expired",
  "invalid or expired token",
  "unauthorized",
];

// Endpoints that should never trigger a refresh attempt
const PUBLIC_ENDPOINTS = [
  "/user/register-user",
  "/user/send-email-otp",
  "/user/verify-email-otp",
  "/user/login",
  "/user/forgot-password",
  "/user/reset-password",
  "/user/refresh",
  "/verify/",
];

// --- Helper Functions ---

/**
 * @function isPublicEndpoint
 * @description Returns true if the request URL matches a known public endpoint.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if it is a public endpoint.
 */
const isPublicEndpoint = (url = "") => {
  return PUBLIC_ENDPOINTS.some((pattern) => {
    return url.includes(pattern);
  });
};

/**
 * @function isAuthError
 * @description Returns true if the error message indicates an authentication failure.
 * @param {string} message - The error message to check.
 * @returns {boolean} True if it is an auth error.
 */
const isAuthError = (message = "") => {
  return AUTH_ERROR_MESSAGES.some((pattern) => {
    return message.toLowerCase().includes(pattern);
  });
};

// --- Component ---

/**
 * @function SessionManager
 * @description Component that manages the global authentication session.
 * @returns {null} This component does not render anything.
 */
// Pages exempt from the verification-status redirect
const VERIFICATION_EXEMPT_PATHS = [
  '/under-review',
  '/resubmit-verification',
  '/login',
  '/signup',
  '/verify-otp',
  '/forgot-password',
  '/unauthorized',
];

const SessionManager = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { user: sessionUser, isLogin, authReady } = useSelector((s) => s.auth);
  const verifiedStatus = sessionUser?.user?.isVerified;

  // --- Refs ---

  // Guards against firing the session-expired toast/redirect multiple times
  const handled = useRef(false);

  // Holds a reference to the in-flight refresh Promise
  const refreshRef = useRef(null);

  // Stable refs for navigate and location so the interceptor effect does not
  // re-register on every route change (which would create a gap window where
  // 401 errors go unhandled during eject/re-add).
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { locationRef.current = location; }, [location]);

  // --- Effects ---

  /**
   * @description Boot-time auth initialization effect.
   */
  useEffect(
    () => {
      dispatch(initializeAuth());
    },
    // Dependency Array:
    [
      dispatch, // Stable reference
    ]
  );

  /**
   * @description Redirect pending/rejected users to their status page on every navigation.
   */
  useEffect(() => {
    if (!authReady || !isLogin || !verifiedStatus) return;
    if (sessionUser?.user?.role === 'admin') return; // Admins bypass verification check
    if (VERIFICATION_EXEMPT_PATHS.some((p) => location.pathname.startsWith(p))) return;

    if (verifiedStatus === 'pending') {
      navigate('/under-review', { replace: true });
    } else if (verifiedStatus === 'rejected') {
      navigate('/resubmit-verification', { replace: true });
    }
  }, [authReady, isLogin, verifiedStatus, location.pathname, navigate]);

  /**
   * @description Global Axios 401 interceptor effect.
   */
  useEffect(
    () => {
      // Setup:

      /**
       * @function expireSession
       * @description Expires the current session and redirects to login.
       */
      const expireSession = () => {
        if (handled.current) {
          return;
        }
        handled.current = true;

        dispatch(logout());
        dispatch(reset());

        if (locationRef.current.pathname !== "/login") {
          navigateRef.current("/login", { replace: true });
        }

        // Allow the guard to reset after 1 s
        setTimeout(() => {
          handled.current = false;
        }, 1000);
      };

      const interceptorId = axios.interceptors.response.use(
        // Pass successful responses straight through
        (response) => {
          return response;
        },

        // Handle error responses
        async (error) => {
          const req = error?.config;
          const status = error?.response?.status;
          const msg = String(error?.response?.data?.message || "");
          const code = String(error?.response?.data?.code || "");
          const url = String(req?.url || "");

          // --- Anti-fraud / business logic 403s ---
          if (
            status === 403 &&
            (code === "HOST_DEBT_LIMIT" || msg.toLowerCase().includes("debt"))
          ) {
            return Promise.reject(error);
          }

          if (
            status === 403 &&
            (code === "KYC_REQUIRED" || msg.toLowerCase().includes("verification"))
          ) {
            return Promise.reject(error);
          }

          // --- Admin gate expired/missing: clear the stale gate token and send
          // the admin back to the PIN gate so they can re-verify. ---
          if (status === 403 && code === "ADMIN_GATE_REQUIRED") {
            try {
              sessionStorage.removeItem("bv_admin_gate");
            } catch {
              // ignore storage errors
            }
            const adminPath = import.meta.env.VITE_ADMIN_PATH || "ctrl-bv5ap6";
            const gatePath = `/${adminPath}/gate`;
            if (locationRef.current.pathname !== gatePath) {
              navigateRef.current(gatePath, { replace: true });
            }
            return Promise.reject(error);
          }

          // --- Skip non-auth errors ---
          if (
            isPublicEndpoint(url) || // public endpoint — never refresh
            status !== 401 || // not an auth error status
            !isAuthError(msg) || // not an auth-related message
            !req || // no config to replay
            url.includes("/user/login") // login itself returned 401
          ) {
            return Promise.reject(error);
          }

          // --- Refresh already failed or already retried ---
          if (url.includes("/user/refresh") || req._retry) {
            expireSession();
            return Promise.reject(error);
          }

          // --- Attempt silent token refresh ---
          req._retry = true;
          try {
            // Deduplicate: multiple concurrent 401s share one refresh call
            if (!refreshRef.current) {
              refreshRef.current = dispatch(refreshSession())
                .unwrap()
                .finally(() => {
                  refreshRef.current = null;
                });
            }

            const session = await refreshRef.current;
            const newToken = session?.accessToken || session?.token;

            if (newToken) {
              req.headers = {
                ...(req.headers || {}),
                Authorization: `Bearer ${newToken}`,
              };
            }

            // Replay the original request with the refreshed token
            return axios(req);
          } catch (refreshError) {
            expireSession();
            return Promise.reject(refreshError);
          }
        }
      );

      // Cleanup: Eject the interceptor when this component unmounts
      return () => {
        axios.interceptors.response.eject(interceptorId);
      };
    },
    // Only depends on dispatch (stable). navigate and location are accessed
    // via refs so the interceptor is registered exactly once per mount.
    [dispatch]
  );

  // Null-rendering — this component exists only for its side effects
  return null;
};

export default SessionManager;
