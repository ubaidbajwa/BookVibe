/**
 * Analytics.jsx
 *
 * This component provides a high-level overview of platform performance.
 * It fetches and displays monthly booking trends, revenue growth, and user
 * acquisition data using custom CSS-driven charts. It also presents key scalar
 * KPIs in an easy-to-read dashboard format.
 *
 * @module Analytics
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, RefreshCw } from 'lucide-react';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Analytics Page Component.
 *
 * @returns {JSX.Element}
 */
const Analytics = () => {
  /* ── STATE MANAGEMENT ── */

  /** @type {[object|null, Function]} Analytics payload returned by the API */
  const [data, setData] = useState(null);

  /** @type {[boolean, Function]} Whether the fetch is in-flight */
  const [loading, setLoading] = useState(true);

  // Month abbreviation lookup indexed by 1-based month number
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /* ── DATA FETCHING ── */

  /**
   * Fetch analytics data from the API.
   * Gracefully handles errors by providing an empty dataset.
   */
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const r = await axios
        .get(`${BASE}/user/admin/analytics`, getAuthConfig())
        .catch(() => {
          return {
            data: {
              analytics: {
                monthlyBookings: [],
                monthlyRevenue: [],
                userGrowth: [],
              },
            },
          };
        });
      setData(r.data.analytics || {});
    } finally {
      setLoading(false);
    }
  };

  /**
   * Effect: Initial analytics load on component mount.
   */
  useEffect(
    () => {
      // Execute initial fetch
      fetchAnalytics();
    },
    // Dependencies: Runs once on mount
    []
  );

  /* ── SUB-COMPONENTS (INLINE) ── */

  /**
   * A generic vertical bar chart built with flex + inline styles.
   * Each bar height is proportional to its value relative to the max.
   *
   * @param {Object} props - Component properties.
   */
  const BarChart = ({ title, data: items = [], valueKey = 'value', color = 'var(--bv-gold)' }) => {
    // Guard against division by zero; ensure max is at least 1
    const max = Math.max(...items.map((i) => {
      return i[valueKey] || 0;
    }), 1);

    return (
      <div className="bv-card-static p-5">
        <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
          {title}
        </h3>
        <div className="flex items-end gap-2 h-40">
          {items.length === 0 ? (
            <p className="text-[var(--bv-text-dim)] text-sm m-auto">
              No data available
            </p>
          ) : (
            items.map((item, i) => {
              // Calculate height percentage, ensuring a minimum of 4 px
              const heightPct = Math.max(4, (item[valueKey] / max) * 100);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg transition-all hover:opacity-80"
                    style={{
                      height: `${heightPct}%`,
                      background: color,
                      minHeight: 4,
                    }}
                  />
                  <span className="text-[9px] text-[var(--bv-text-dim)] font-bold">
                    {months[item.month - 1] || item.label || i + 1}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  /* ── RENDER ── */

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
            <BarChart3 size={26} className="text-[var(--bv-gold)]" />
            Analytics
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Platform performance overview
          </p>
        </div>
        <button
          onClick={() => {
            return fetchAnalytics();
          }}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Charts grid — skeleton placeholders while loading */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => {
            return (
              <div key={i} className="bv-skeleton h-56 rounded-2xl" />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BarChart
            title="Monthly Bookings"
            data={data?.monthlyBookings || []}
            valueKey="count"
            color="var(--bv-gold)"
          />
          <BarChart
            title="Monthly Revenue (PKR)"
            data={data?.monthlyRevenue || []}
            valueKey="total"
            color="var(--bv-success)"
          />
          <BarChart
            title="New Users Per Month"
            data={data?.userGrowth || []}
            valueKey="count"
            color="var(--bv-info)"
          />

          {/* Scalar KPI tiles */}
          <div className="bv-card-static p-5">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  i: TrendingUp,
                  l: 'Growth Rate',
                  v: data?.growthRate || '—',
                },
                {
                  i: DollarSign,
                  l: 'Avg Booking',
                  v: data?.avgBookingValue
                    ? `PKR ${data.avgBookingValue.toLocaleString()}`
                    : '—',
                },
                {
                  i: Users,
                  l: 'Active Users',
                  v: data?.activeUsers || '—',
                },
                {
                  i: Calendar,
                  l: 'This Month',
                  v: data?.thisMonthBookings || '—',
                },
              ].map(({ i: I, l, v }) => {
                return (
                  <div
                    key={l}
                    className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]"
                  >
                    <I size={16} className="text-[var(--bv-gold)] mb-2" />
                    <p className="text-lg font-black text-[var(--bv-text)]">{v}</p>
                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">
                      {l}
                    </p>
                  </div>
                );
              })}
              {/* Platform Commission — full-width tile */}
              <div className="col-span-2 p-4 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold mb-1">
                    Platform Commission ({new Date().getFullYear()})
                  </p>
                  <p className="text-xl font-black text-[var(--bv-gold)]">
                    PKR {(data?.totalYearCommission || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">
                    10% of PKR {(data?.totalYearRevenue || 0).toLocaleString()} net revenue
                  </p>
                </div>
                <TrendingUp size={32} className="text-[var(--bv-gold)] opacity-30 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
