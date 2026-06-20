/**
 * @file ScrollToTop.jsx
 * @description Route Change Scroll Reset Component
 *
 * This component listens for React Router pathname changes and scrolls the window back to
 * the top on every navigation. It is rendered as a null component inside the
 * router so it can access the location hook without adding any DOM output.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * @function ScrollToTop
 * @description A utility component that resets the window scroll position to the top
 * whenever the route changes.
 * @returns {null} This component does not render any visible UI.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  /**
   * Scroll-reset effect.
   * Runs whenever the route pathname changes so the new page always
   * starts at the top rather than inheriting the previous page's scroll.
   */
  useEffect(
    () => {
      // Setup:
      window.scrollTo(0, 0);

      // Cleanup:
      return () => {
        // No cleanup required for scroll reset
      };
    },
    // Dependency Array:
    [
      pathname, // Re-run every time the user navigates to a new route
    ]
  );

  // This component renders nothing — it exists only for its side effect
  return null;
};

export default ScrollToTop;
