/**
 * @file WishlistButton.jsx
 * @description Property Wishlist Toggle Component
 *
 * This component provides a button to add or remove a property from the user's wishlist.
 * It handles authenticated checks, optimistic UI updates (via loading state), and
 * surfaces success/error feedback via toasts.
 */

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Heart, Loader2 } from 'lucide-react';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';

// --- Constants ---

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @function WishlistButton
 * @description Renders a heart button that toggles the wishlist status of a property.
 * @param {Object} props - Component properties.
 * @param {string} props.propertyId - The ID of the property to toggle.
 * @param {string} [props.className=''] - Additional CSS classes.
 * @returns {JSX.Element} The rendered button.
 */
const WishlistButton = ({ propertyId, className = '' }) => {
  // --- State & Redux ---
  const { user } = useSelector((state) => {
    return state.auth;
  });

  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- Effects ---

  /**
   * @description Effect to check the initial wishlist status for the property.
   */
  useEffect(
    () => {
      // Setup:
      if (!user || !propertyId) {
        return;
      }

      axios
        .get(`${BASE}/wishlist/check/${propertyId}`, getAuthConfig())
        .then((response) => {
          return setWishlisted(response.data.wishlisted);
        })
        .catch(() => {
          // Silent failure for status check
        });
    },
    // Dependency Array:
    [
      user, // Re-check if user logs in/out
      propertyId, // Re-check if viewing a different property
    ]
  );

  // --- Handlers ---

  /**
   * @function toggle
   * @description Toggles the property in the user's wishlist.
   * @param {Event} e - Click event.
   */
  const toggle = async (e) => {
    e.stopPropagation();

    if (!user) {
      return;
    }

    if (!propertyId) {
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${BASE}/wishlist/toggle`,
        { propertyId },
        getAuthConfig()
      );

      setWishlisted(response.data.wishlisted);
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`p-2 rounded-full transition-all ${
        wishlisted
          ? 'bg-red-500/20 text-red-400'
          : 'bg-black/40 text-white/80 hover:text-red-400'
      } backdrop-blur-sm ${className}`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
      )}
    </button>
  );
};

export default WishlistButton;
