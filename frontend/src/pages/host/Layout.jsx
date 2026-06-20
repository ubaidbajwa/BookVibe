/**
 * Layout.jsx
 *
 * Root shell for the host panel. Composes the sidebar, top navbar, and
 * a main content area where child routes are rendered via <Outlet />.
 *
 * Responsibilities:
 *   - Apply the host's chosen appearance theme on mount by reading the
 *     stored preference and calling applyHostTheme.
 *   - Re-apply the theme when the OS colour scheme changes (for "system"
 *     mode) by listening to the prefers-color-scheme media query.
 *   - Mount the EmergencySOSReceiver so SOS alerts are handled globally
 *     for all host sub-pages without needing per-page setup.
 *   - Manage the mobile sidebar open/close state and pass it to both
 *     HostSidebar (to control its visibility) and HostNavbar (to provide
 *     the toggle button).
 *
 * @module HostLayout
 */

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import HostNavbar from './HostNavbar';
import HostSidebar from './HostSidebar';
import { applyHostTheme, getStoredHostTheme } from '../../utils/hostTheme';
import EmergencySOSReceiver from '../../components/EmergencySOSReceiver';

/**
 * Host Layout Component
 * Provides the overall structure for the host dashboard including navigation and global receivers.
 *
 * @returns {JSX.Element}
 */
const Layout = () => {
  // ─── STATE ───

  /** @type {[boolean, Function]} Controls sidebar visibility on mobile screens. */
  const [open, setOpen] = useState(false);

  // ─── SIDE EFFECTS ───

  /**
   * Apply the stored host theme on mount and register a media-query
   * listener so the theme re-applies automatically when the OS switches
   * between light/dark while the "system" mode is active.
   *
   * Cleanup removes the listener to prevent memory leaks.
   */
  useEffect(
    () => {
      // Setup: Apply theme and add listener
      applyHostTheme(getStoredHostTheme());

      // Listen for OS colour-scheme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleSchemeChange = () => {
        // Only re-apply when the host has selected "system" mode;
        // explicit light/dark choices should not be overridden by the OS.
        if (getStoredHostTheme() === 'system') {
          applyHostTheme('system');
        }
      };

      mediaQuery.addEventListener('change', handleSchemeChange);

      // Cleanup: Remove listener
      return () => {
        mediaQuery.removeEventListener('change', handleSchemeChange);
      };
    },
    [
      // Dependencies: None
    ]
  );

  // ─── RENDER ───

  return (
    <div className="host-shell flex min-h-screen bg-[var(--bv-bg)]">
      {/* Global SOS alert receiver — must be present on every host page */}
      <EmergencySOSReceiver />

      {/* Sidebar — fixed at lg+, overlay on mobile */}
      <HostSidebar open={open} setOpen={setOpen} />

      {/* Main area: navbar + routed page content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[260px] transition-all duration-300">
        <HostNavbar setOpenSidebar={setOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
