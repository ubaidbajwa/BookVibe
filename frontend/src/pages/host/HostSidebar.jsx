/**
 * @file HostSidebar.jsx
 * @description Fixed left-hand navigation sidebar for the host panel.
 * 
 * On mobile it slides in as an overlay controlled by the `open` prop;
 * on desktop (lg+) it is always visible.
 *
 * Contains collapsible sub-menus for Accommodations and Payments,
 * with their open state initialised from the current pathname.
 */

import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  PlusSquare,
  Wallet,
  RefreshCcw,
  Settings,
  X,
  ChevronDown,
  Sparkles,
  UserCircle,
  ArrowLeftRight,
  Bell,
  Home,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { NavLink, useLocation, Link } from 'react-router-dom';

/**
 * @component HostSidebar
 * @description Provides navigation links and sub-menus for the host dashboard.
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.open - Whether the sidebar is open on mobile
 * @param {Function} props.setOpen - Function to toggle sidebar visibility
 * @returns {JSX.Element} The rendered HostSidebar component.
 */
const HostSidebar = ({ open, setOpen }) => {
  /**
   * @section Hooks & Context
   */

  /** @type {Object} React Router location hook. */
  const loc = useLocation();

  /**
   * @section State Management
   */

  /**
   * @type {[boolean, Function]}
   * Initialise sub-menu open state from the current URL.
   */
  const [accom, setAccom] = useState(() => {
    return loc.pathname.includes('/host/accommodations');
  });

  /** 
   * @type {[boolean, Function]}
   * Initialise sub-menu open state from the current URL.
   */
  const [pay, setPay] = useState(() => {
    return loc.pathname.includes('/host/payments');
  });

  /**
   * @section Handlers
   */

  /** 
   * Close the sidebar on mobile after a nav item is clicked.
   * 
   * @function close
   * @returns {void}
   */
  const close = () => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  };

  /**
   * @section Helpers
   */

  /**
   * Active / inactive styles for top-level nav links.
   * 
   * @function navCls
   * @param {Object} params - NavLink parameters
   * @param {boolean} params.isActive - Whether the link is active
   * @returns {string} CSS classes
   */
  const navCls = ({ isActive }) => {
    if (isActive) {
      return 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-[var(--bv-gold)]/10 text-[var(--bv-gold)] border border-[var(--bv-gold-border)] shadow-sm';
    }
    return 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-[var(--bv-text-muted)] hover:bg-[var(--bv-surface)] hover:text-[var(--bv-text)]';
  };

  /**
   * Active / inactive styles for sub-menu nav links.
   * 
   * @function subCls
   * @param {Object} params - NavLink parameters
   * @param {boolean} params.isActive - Whether the link is active
   * @returns {string} CSS classes
   */
  const subCls = ({ isActive }) => {
    if (isActive) {
      return 'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all text-[var(--bv-gold)] bg-[var(--bv-gold)]/5 font-semibold';
    }
    return 'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] hover:bg-[var(--bv-surface)]';
  };

  /**
   * @section Sub-components
   */

  /**
   * DropBtn — a non-NavLink button that expands or collapses a sub-menu group.
   * 
   * @component DropBtn
   * @param {Object} props - Component properties
   * @param {string} props.label - Button label
   * @param {import('lucide-react').LucideIcon} props.icon - Lucide icon component
   * @param {boolean} props.isOpen - Whether the sub-menu is open
   * @param {Function} props.toggle - Function to toggle sub-menu
   * @returns {JSX.Element} The rendered DropBtn component.
   */
  const DropBtn = ({ label, icon: Icon, isOpen, toggle }) => {
    return (
      <button
        onClick={() => {
          return toggle();
        }}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[var(--bv-text-muted)] hover:bg-[var(--bv-surface)] hover:text-[var(--bv-text)] transition-all group"
      >
        <div className="flex items-center gap-3">
          <Icon
            size={18}
            className="group-hover:text-[var(--bv-gold)] transition"
          />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    );
  };

  /**
   * @section Render
   */

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => {
            return setOpen(false);
          }}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[260px] z-50 bg-[var(--bv-bg-raised)] border-r border-[var(--bv-border)] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* ── Logo / brand ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--bv-border)] flex-shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center shadow-[var(--bv-shadow-gold)]">
              <Sparkles size={14} className="text-[var(--bv-bg)]" />
            </div>
            <div>
              <h1 className="font-display text-lg text-[var(--bv-text)] leading-none">
                Book<span className="text-[var(--bv-gold)]">Vibe</span>
              </h1>
              <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5 font-semibold tracking-wider uppercase">
                Host Panel
              </p>
            </div>
          </Link>
          <button
            onClick={() => {
              return setOpen(false);
            }}
            className="lg:hidden text-[var(--bv-text-dim)] hover:text-[var(--bv-text)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          <p className="bv-label px-4 mb-3">Main</p>

          <NavLink
            to="/host/dashboard"
            end
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          <NavLink
            to="/host/bookings"
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <CalendarDays size={18} /> Bookings
          </NavLink>

          {/* Accommodations sub-menu */}
          <DropBtn
            label="Accommodations"
            icon={Building2}
            isOpen={accom}
            toggle={() => {
              return setAccom((p) => {
                return !p;
              });
            }}
          />
          {accom && (
            <div className="ml-5 pl-4 mt-1 space-y-0.5 border-l border-[var(--bv-border)]">
              <NavLink
                to="/host/accommodations"
                end
                onClick={() => {
                  return close();
                }}
                className={subCls}
              >
                <Building2 size={15} /> My Properties
              </NavLink>
              <NavLink
                to="/host/accommodations/add"
                end
                onClick={() => {
                  return close();
                }}
                className={subCls}
              >
                <PlusSquare size={15} /> Add New
              </NavLink>
            </div>
          )}

          {/* Payments sub-menu */}
          <DropBtn
            label="Payments"
            icon={Wallet}
            isOpen={pay}
            toggle={() => {
              return setPay((p) => {
                return !p;
              });
            }}
          />
          {pay && (
            <div className="ml-5 pl-4 mt-1 space-y-0.5 border-l border-[var(--bv-border)]">
              <NavLink
                to="/host/payments/all-payments"
                onClick={() => {
                  return close();
                }}
                className={subCls}
              >
                <ArrowLeftRight size={15} /> All Payments
              </NavLink>
              <NavLink
                to="/host/payments/request-refund-payments"
                onClick={() => {
                  return close();
                }}
                className={subCls}
              >
                <RefreshCcw size={15} /> Refunds
              </NavLink>
              <NavLink
                to="/host/earnings"
                onClick={() => {
                  return close();
                }}
                className={subCls}
              >
                <Wallet size={15} /> Earnings & Payouts
              </NavLink>
            </div>
          )}

          <NavLink
            to="/host/notifications"
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <Bell size={18} /> Notifications
          </NavLink>

          <NavLink
            to="/host/complaints"
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <ShieldAlert size={18} /> Complaints
          </NavLink>

          <NavLink
            to="/host/profile"
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <UserCircle size={18} /> Profile
          </NavLink>

          <NavLink
            to="/host/settings"
            onClick={() => {
              return close();
            }}
            className={navCls}
          >
            <Settings size={18} /> Settings
          </NavLink>
        </nav>

        {/* ── Back to website link ── */}
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

export default HostSidebar;
