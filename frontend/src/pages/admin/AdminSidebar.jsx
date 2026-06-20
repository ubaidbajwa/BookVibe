/**
 * AdminSidebar.jsx
 *
 * This component provides the persistent side navigation for the Admin Panel.
 * It features a responsive design that functions as a sliding drawer on mobile
 * and a fixed sidebar on larger screens. It uses NavLink for automatic active
 * route highlighting and includes logical sectioning for easy navigation.
 *
 * @module AdminSidebar
 */

import {
  LayoutDashboard, Users, Building2, ShieldCheck,
  AlertCircle, Settings, UserCircle, BarChart3,
  X, Sparkles, Home, CalendarDays, Bell, Ban, Undo2,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';

/* ── CONSTANTS ── */

const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

/**
 * AdminSidebar Component.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.open - Whether the sidebar is open on mobile.
 * @param {Function} props.setOpen - State setter for sidebar visibility.
 * @returns {JSX.Element}
 */
const AdminSidebar = ({ open, setOpen }) => {
  /* ── HELPERS ── */

  /**
   * Close the sidebar on mobile when a link is activated.
   */
  const close = () => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  };

  /**
   * Returns the correct CSS classes for a NavLink based on its active state.
   *
   * @param {Object} params - NavLink state parameters.
   * @param {boolean} params.isActive - Whether the link is currently active.
   * @returns {string} Tailwind CSS classes.
   */
  const navCls = ({ isActive }) => {
    const base = 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200';
    if (isActive) {
      return `${base} bg-[var(--bv-gold)]/10 text-[var(--bv-gold)] border border-[var(--bv-gold-border)] shadow-sm`;
    }
    return `${base} text-[var(--bv-text-muted)] hover:bg-[var(--bv-surface)] hover:text-[var(--bv-text)]`;
  };

  /* ── RENDER ── */

  return (
    <>
      {/* Mobile backdrop — tapping it closes the drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => {
            return setOpen(false);
          }}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] z-50 bg-[var(--bv-bg-raised)] border-r border-[var(--bv-border)] flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo / brand area */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--bv-border)] flex-shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center shadow-[var(--bv-shadow-gold)]">
              <Sparkles size={14} className="text-[var(--bv-text-inverse)]" />
            </div>
            <div>
              <h1 className="font-display text-lg text-[var(--bv-text)] leading-none">
                Book<span className="text-[var(--bv-gold)]">Vibe</span>
              </h1>
              <p className="text-[10px] text-[var(--bv-danger)] mt-0.5 font-bold tracking-wider uppercase">
                Admin
              </p>
            </div>
          </Link>
          <button
            onClick={() => {
              return setOpen(false);
            }}
            className="lg:hidden text-[var(--bv-text-dim)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          {/* Overview section */}
          <p className="bv-label px-4 mb-3">Overview</p>
          <NavLink to={`/${P}/dashboard`} end onClick={close} className={navCls}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to={`/${P}/analytics`} onClick={close} className={navCls}>
            <BarChart3 size={18} /> Analytics
          </NavLink>

          {/* Management section */}
          <p className="bv-label px-4 mb-3 mt-6">Management</p>
          <NavLink to={`/${P}/bookings`} onClick={close} className={navCls}>
            <CalendarDays size={18} /> Bookings
          </NavLink>
          <NavLink to={`/${P}/management/users`} onClick={close} className={navCls}>
            <Users size={18} /> Users
          </NavLink>
          <NavLink to={`/${P}/management/hosts`} onClick={close} className={navCls}>
            <Building2 size={18} /> Hosts
          </NavLink>
          <NavLink to={`/${P}/host-verification`} onClick={close} className={navCls}>
            <ShieldCheck size={18} /> Verification
          </NavLink>
          <NavLink to={`/${P}/complaints`} onClick={close} className={navCls}>
            <AlertCircle size={18} /> Complaints
          </NavLink>
          <NavLink to={`/${P}/blacklist`} onClick={close} className={navCls}>
            <Ban size={18} /> Blacklist
          </NavLink>
          <NavLink to={`/${P}/payouts`} onClick={close} className={navCls}>
            <Building2 size={18} /> Payouts
          </NavLink>
          <NavLink to={`/${P}/refunds`} onClick={close} className={navCls}>
            <Undo2 size={18} /> Refunds
          </NavLink>

          {/* Account section */}
          <p className="bv-label px-4 mb-3 mt-6">Account</p>
          <NavLink to={`/${P}/notifications`} onClick={close} className={navCls}>
            <Bell size={18} /> Notifications
          </NavLink>
          <NavLink to={`/${P}/profile`} onClick={close} className={navCls}>
            <UserCircle size={18} /> Profile
          </NavLink>
          <NavLink to={`/${P}/settings`} onClick={close} className={navCls}>
            <Settings size={18} /> Settings
          </NavLink>
        </nav>

        {/* Footer: back-to-website link */}
        <div className="px-4 pb-5 border-t border-[var(--bv-border)] pt-4 flex-shrink-0">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] hover:text-[var(--bv-text)] text-sm transition"
          >
            <Home size={17} /> Back to Website
          </Link>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
