/**
 * @file ProtectedRoute.jsx
 * @description Auth & Role Gate for React Router
 *
 * Wraps any route group that requires authentication or a specific role.
 * Uses the `authReady` flag to prevent false redirects while the app is rehydrating.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

/**
 * @function ProtectedRoute
 * @description Component that protects routes based on authentication and roles.
 * @param {Object} props - Component props.
 * @param {string[]} [props.allowedRoles] - Optional list of allowed roles.
 * @returns {JSX.Element} The rendered component.
 */
const ProtectedRoute = ({ allowedRoles }) => {
  // --- State & Selectors ---
  const { user, authReady } = useSelector((state) => {
    return state.auth;
  });

  // --- Auth Checks ---

  // While initializeAuth is still in flight, show a centered spinner
  if (!authReady) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bv-bg)" }}
      >
        <div
          className="w-10 h-10 border-2 border-transparent rounded-full animate-spin"
          style={{
            borderTopColor: "var(--bv-gold)",
            borderRightColor: "var(--bv-gold)",
          }}
        />
      </div>
    );
  }

  // Not logged in — redirect to the login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role — redirect to the unauthorized page
  if (allowedRoles && !allowedRoles.includes(user.user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // All checks passed — render the child route(s)
  return <Outlet />;
};

export default ProtectedRoute;
