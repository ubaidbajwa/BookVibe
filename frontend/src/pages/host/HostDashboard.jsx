/**
 * @file HostDashboard.jsx
 * @description Main overview for host property performance.
 * Displays key metrics, recent bookings, and earnings analytics.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getHostDashboardStats, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
  ImageOff,
  AlertTriangle,
} from 'lucide-react';
import HostEarnings from '../../components/HostEarnings';

/**
 * Map a booking status to a bv-badge tone class.
 * Recent bookings can be confirmed / staying (in-house) / completed / pending —
 * only cancelled stays should read as a red "danger" state.
 * @param {string} status - Booking status
 * @returns {string} bv-badge modifier class
 */
const statusBadge = (status) => {
  switch (status) {
    case 'confirmed':
    case 'staying':
      return 'bv-badge-green';
    case 'completed':
      return 'bv-badge-gold';
    case 'pending':
      return 'bv-badge-amber';
    default:
      // cancel and any unknown state
      return 'bv-badge-red';
  }
};

/**
 * @section Sub-components
 */

/**
 * StatCard — displays a single KPI with an icon and value.
 * @component StatCard
 */
const StatCard = ({ icon: Icon, title, value, hint, color }) => {
  return (
    <div className="bv-card p-5 flex flex-col h-40 justify-between group">
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)]">
          <Icon size={18} className="text-[var(--bv-gold)]" />
        </div>
        <ArrowUpRight
          size={16}
          className="text-[var(--bv-success)] opacity-0 group-hover:opacity-100 transition"
        />
      </div>
      <div>
        <p className="bv-label">{title}</p>
        <h3 className={`text-2xl font-black mt-1 ${color || 'text-[var(--bv-text)]'}`}>{value}</h3>
        {hint && (
          <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">{hint}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Skeleton placeholder for a stat card.
 * @component Skel
 */
const Skel = () => {
  return (
    <div className="bv-skeleton h-40 rounded-2xl" />
  );
};

/**
 * Skeleton placeholder for a booking row.
 * @component SkelRow
 */
const SkelRow = () => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bv-bg)]">
      <div className="bv-skeleton w-12 h-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="bv-skeleton h-4 w-3/4 rounded" />
        <div className="bv-skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
};

/**
 * @component HostDashboard
 * @description The primary dashboard for hosts to monitor their business metrics.
 */
const HostDashboard = () => {
  const dispatch = useDispatch();
  const nav = useNavigate();

  const { dashboardStats: stats, recentBookings, loading, error } = useSelector((s) => {
    return s.accommodations;
  });
  const { user } = useSelector((s) => {
    return s.auth;
  });

  // Unwrap the nested user object once
  const u = user?.user;

  /**
   * @section Effects
   */

  /**
   * Fetch dashboard stats on mount.
   */
  useEffect(
    () => {
      // Logic setup
      dispatch(getHostDashboardStats());

      // Cleanup
      return () => {
        // No cleanup needed
      };
    },
    // Dependencies
    [dispatch]
  );

  /**
   * Handle and display error messages.
   */
  useEffect(
    () => {
      // Logic setup
      if (error) {
        dispatch(resetAccommodationState());
      }

      // Cleanup
      return () => {
        // No cleanup needed
      };
    },
    // Dependencies
    [error, dispatch]
  );

  /**
   * @section Derived Data
   */

  // Build the stat card definitions once stats are available
  const cards = stats
    ? [
        {
          icon: Calendar,
          title: 'Total Bookings',
          value: stats.totalBookings,
          hint: 'All time',
        },
        {
          icon: CheckCircle,
          title: 'Active',
          value: stats.activeBookings,
          hint: 'Currently active',
        },
        {
          icon: DollarSign,
          title: 'Gross Revenue',
          value: `PKR ${stats.totalRevenue?.toLocaleString()}`,
          hint: 'Total before commission',
        },
        {
          icon: AlertTriangle,
          title: 'Platform Fee',
          value: `PKR ${stats.totalCommission?.toLocaleString()}`,
          hint: '10% BookVibe commission',
          color: 'text-red-400',
        },
        {
          icon: TrendingUp,
          title: 'Net Earnings',
          value: `PKR ${stats.totalEarnings?.toLocaleString()}`,
          hint: 'Your take-home pay',
          color: 'text-emerald-400',
        },
        {
          icon: Clock,
          title: 'Pending',
          value: stats.pendingPayments,
          hint: 'Awaiting payment',
        },
        {
          icon: Building2,
          title: 'Properties',
          value: stats.totalProperties,
          hint: 'Active listings',
        },
      ]
    : [];

  /**
   * Format an ISO date string to a short human-readable form.
   * @param {string} d - Date string
   * @returns {string} Formatted date
   */
  const fmtDate = (d) => {
    return new Date(d).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
    });
  };

  /**
   * @section Render
   */

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            Welcome,{' '}
            <span className="text-[var(--bv-gold)]">{u?.username || 'Host'}</span>
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Property performance overview
          </p>
        </div>
        <button
          onClick={() => {
            return dispatch(getHostDashboardStats());
          }}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5, 6, 7].map((i) => {
            return (
              <Skel key={i} />
            );
          })
        ) : (
          cards.map((c) => {
            return (
              <StatCard key={c.title} {...c} />
            );
          })
        )}
      </div>

      {/* ── Earnings chart widget ── */}
      <HostEarnings />

      {/* ── Recent bookings list ── */}
      <div className="bv-card-static">
        <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
          <div>
            <h2 className="text-base font-bold text-[var(--bv-text)]">
              Recent Bookings
            </h2>
            <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
              Latest 5 reservations
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => {
              return (
                <SkelRow key={i} />
              );
            })
          ) : recentBookings?.length === 0 ? (
            <div className="text-center py-12">
              <Calendar
                size={36}
                className="mx-auto mb-2 text-[var(--bv-text-dim)] opacity-30"
              />
              <p className="text-sm text-[var(--bv-text-dim)]">No bookings yet</p>
            </div>
          ) : (
            recentBookings?.map((b) => {
              return (
                <button
                  key={b._id}
                  onClick={() => {
                    return nav(`/host/bookings/${b._id}`);
                  }}
                  className="w-full flex items-center justify-between gap-4 p-4 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] transition text-left"
                >
                  {/* Property thumbnail + name */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bv-surface)]">
                      {b.propertyId?.images?.[0]?.url ? (
                        <img
                          src={b.propertyId.images[0].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff
                            size={14}
                            className="text-[var(--bv-text-dim)]"
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--bv-text)] text-sm truncate">
                        {b.propertyId?.name || '—'}
                      </p>
                      <p className="text-xs text-[var(--bv-text-dim)] truncate">
                        {b.userId?.username || '—'} ·{' '}
                        {fmtDate(b.checkIn)} – {fmtDate(b.checkOut)}
                      </p>
                    </div>
                  </div>

                  {/* Price + status badge */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[var(--bv-gold)] text-sm">
                      PKR {b.totalPrice?.toLocaleString()}
                    </p>
                    <span
                      className={`bv-badge ${statusBadge(b.bookingStatus)} capitalize`}
                    >
                      {b.bookingStatus}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HostDashboard;
