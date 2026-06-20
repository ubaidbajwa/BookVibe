/**
 * @file HostEarnings.jsx
 * @description Bar chart widget used inside the host dashboard to display monthly revenue
 * and booking statistics for a selected year. Data is fetched from the backend
 * earnings endpoint whenever the selected year changes. The user can step
 * through years with prev/next chevron buttons (capped at the current year).
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';
import { TrendingUp, DollarSign, Calendar, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Short month labels for the X-axis of the bar chart.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

/**
 * @component HostEarnings
 * @description Renders the earnings overview chart and summary for hosts.
 * @returns {JSX.Element|null} The HostEarnings component.
 */
const HostEarnings = () => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description The raw API response containing earnings array and summary.
   */
  const [data, setData] = useState(null);

  /**
   * @description True while the earnings API call is in progress.
   */
  const [loading, setLoading] = useState(true);

  /**
   * @description The currently selected year for the earnings breakdown.
   */
  const [year, setYear] = useState(new Date().getFullYear());

  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Fetch the earnings breakdown for the selected year every time `year` changes.
   */
  useEffect(
    () => {
      setLoading(true);

      axios
        .get(`${BASE}/booking/host/earnings?year=${year}`, getAuthConfig())
        .then((r) => {
          setData(r.data);
        })
        .catch(() => {
          setData(null);
        })
        .finally(() => {
          setLoading(false);
        });

      // Cleanup function
      return () => {
        // No cleanup necessary
      };
    },
    // Dependencies
    [year]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  // Loading skeleton
  if (loading) {
    return (
      <div className="bv-card-static p-6">
        <div className="bv-skeleton h-48 rounded-xl" />
      </div>
    );
  }

  // Render nothing if the fetch failed
  if (!data) {
    return null;
  }

  /* -------------------------------------------------------------------------- */
  /*                               LOGIC / DATA PREP                             */
  /* -------------------------------------------------------------------------- */

  const earnings = data.earnings || [];
  const summary = data.summary || {};

  // Determine the tallest bar so all other bars can be scaled relative to it
  const maxRev = Math.max(
    ...earnings.map((e) => {
      return e.revenue;
    }),
    1
  );

  return (
    <div className="bv-card-static overflow-hidden">
      {/* Header row with title and year navigation */}
      <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
        <div>
          <h2 className="text-base font-bold text-[var(--bv-text)] flex items-center gap-2">
            <BarChart3 size={18} className="text-[var(--bv-gold)]" />
            Earnings Overview
          </h2>
          <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">Monthly revenue breakdown</p>
        </div>

        {/* Year stepper — future years are disabled */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setYear((y) => {
                return y - 1;
              });
            }}
            className="p-1.5 rounded-lg hover:bg-[var(--bv-surface)] text-[var(--bv-text-dim)] transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-[var(--bv-gold)] min-w-[50px] text-center">{year}</span>
          <button
            onClick={() => {
              setYear((y) => {
                return Math.min(y + 1, new Date().getFullYear());
              });
            }}
            disabled={year >= new Date().getFullYear()}
            className="p-1.5 rounded-lg hover:bg-[var(--bv-surface)] text-[var(--bv-text-dim)] transition disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-3 gap-px bg-[var(--bv-border)]">
        {[
          {
            i: DollarSign,
            l: 'Total Revenue',
            v: `PKR ${(summary.totalRevenue || 0).toLocaleString()}`,
          },
          {
            i: Calendar,
            l: 'Total Bookings',
            v: summary.totalBookings || 0,
          },
          {
            i: TrendingUp,
            l: 'Best Month',
            v: summary.bestMonth
              ? `${MONTHS[summary.bestMonth - 1]} (PKR ${(summary.bestMonthRevenue || 0).toLocaleString()})`
              : '—',
          },
        ].map(({ i: Icon, l, v }) => {
          return (
            <div key={l} className="bg-[var(--bv-card)] p-4">
              <Icon size={14} className="text-[var(--bv-gold)] mb-1" />
              <p className="text-lg font-bold text-[var(--bv-text)]">{v}</p>
              <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold mt-0.5">{l}</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="p-5">
        <div className="flex items-end gap-2 h-44">
          {earnings.map((e, i) => {
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Hover tooltip showing PKR amount + booking count */}
                <div className="absolute bottom-full mb-2 bg-[var(--bv-bg-raised)] border border-[var(--bv-border)] rounded-lg px-3 py-2 shadow-[var(--bv-shadow-md)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <p className="text-xs font-bold text-[var(--bv-gold)]">PKR {e.revenue.toLocaleString()}</p>
                  <p className="text-[10px] text-[var(--bv-text-dim)]">
                    {e.bookings} bookings · avg {e.avgStay} nights
                  </p>
                </div>

                {/* Bar itself — height is proportional to revenue relative to the max */}
                <div
                  className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer"
                  style={{
                    height: `${Math.max(4, (e.revenue / maxRev) * 100)}%`,
                    background:
                      e.revenue > 0
                        ? 'linear-gradient(to top, var(--bv-gold), var(--bv-gold-light))'
                        : 'var(--bv-surface)',
                    minHeight: 4,
                  }}
                />

                {/* Month label */}
                <span className="text-[9px] text-[var(--bv-text-dim)] font-bold">{MONTHS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HostEarnings;
