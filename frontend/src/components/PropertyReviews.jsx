/**
 * @file PropertyReviews.jsx
 * @description Handles the display of guest reviews for a specific property.
 * It fetches review data and aggregate statistics from the API and presents
 * a summary dashboard (including a star distribution chart) followed by a
 * list of individual review cards. It also supports showing host replies.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Star, MessageSquare } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/* -------------------------------------------------------------------------- */
/*                               SUB-COMPONENTS                               */
/* -------------------------------------------------------------------------- */

/**
 * @component Stars
 * @description Renders a row of up to five stars.
 * @param {Object} props - Component properties.
 * @param {number} props.n - The number of filled stars.
 * @param {number} props.size - The size of each star icon.
 * @returns {JSX.Element} The Stars component.
 */
const Stars = ({ n, size = 12 }) => {
  return (
    <div className="flex gap-0.5">
      {Array(5)
        .fill(0)
        .map((_, i) => {
          return (
            <Star
              key={i}
              size={size}
              className={i < n ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-surface)]'}
              fill={i < n ? 'var(--bv-gold)' : 'none'}
            />
          );
        })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

/**
 * @component PropertyReviews
 * @description Main component for displaying reviews for a property.
 * @param {Object} props - Component properties.
 * @param {string} props.propertyId - The MongoDB _id of the property.
 * @returns {JSX.Element} The PropertyReviews component.
 */
const PropertyReviews = ({ propertyId }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Array of review objects returned by the API.
   */
  const [reviews, setReviews] = useState([]);

  /**
   * @description Aggregate stats object (average, total, distribution).
   */
  const [stats, setStats] = useState(null);

  /**
   * @description Whether the API request is currently in progress.
   */
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Fetch reviews and aggregate stats for this property.
   */
  useEffect(
    () => {
      if (!propertyId) {
        return;
      }

      const controller = new AbortController();

      axios
        .get(`${BASE}/reviews/property/${propertyId}`, { signal: controller.signal })
        .then((r) => {
          setReviews(r.data.reviews || []);
          setStats(r.data.stats);
        })
        .catch((err) => {
          // Ignore cancellation errors triggered by cleanup — only log real failures.
          if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
            // Silently fail — reviews are non-critical
          }
        })
        .finally(() => {
          setLoading(false);
        });

      // Abort the in-flight request when the component unmounts or propertyId changes.
      return () => {
        controller.abort();
      };
    },
    // Dependencies
    [propertyId]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => {
          return <div key={i} className="bv-skeleton h-24 rounded-xl" />;
        })}
      </div>
    );
  }

  // Empty state
  if (!reviews.length) {
    return (
      <div className="bv-card-static p-8 text-center">
        <MessageSquare size={32} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-30" />
        <p className="text-[var(--bv-text-muted)] font-semibold">No reviews yet</p>
        <p className="text-xs text-[var(--bv-text-dim)] mt-1">Be the first to share your experience</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats summary card */}
      {stats && (
        <div className="bv-card-static p-5 flex flex-col sm:flex-row gap-6">
          {/* Average score + star visual */}
          <div className="text-center sm:text-left sm:pr-6 sm:border-r border-[var(--bv-divider)]">
            <p className="text-4xl font-black text-[var(--bv-gold)]">{stats.average}</p>
            <Stars n={Math.round(stats.average)} size={14} />
            <p className="text-xs text-[var(--bv-text-dim)] mt-1">
              {stats.total} review{stats.total !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Star distribution bar chart */}
          <div className="flex-1 space-y-1.5">
            {stats.distribution?.map(({ star, count }) => {
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-[var(--bv-text-dim)] w-4">{star}</span>
                  <Star size={10} className="text-[var(--bv-gold)]" fill="var(--bv-gold)" />
                  <div className="flex-1 h-2 bg-[var(--bv-surface)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--bv-gold)] rounded-full transition-all"
                      style={{
                        width: stats.total ? `${(count / stats.total) * 100}%` : 0,
                      }}
                    />
                  </div>
                  <span className="text-xs text-[var(--bv-text-dim)] w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual review cards */}
      {reviews.map((r) => {
        return (
          <div key={r._id} className="bv-card-static p-5">
            {/* Reviewer header: avatar + name + date + rating */}
            <div className="flex items-start gap-3 mb-3">
              {r.guest?.profileImage?.url ? (
                <img src={r.guest.profileImage.url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-sm flex-shrink-0">
                  {r.guest?.username?.charAt(0)?.toUpperCase()}
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[var(--bv-text)] text-sm">{r.guest?.username}</p>
                  <p className="text-[10px] text-[var(--bv-text-dim)]">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Stars n={r.rating} />
                  {r.title && <span className="text-xs text-[var(--bv-text-muted)] font-semibold">— {r.title}</span>}
                </div>
              </div>
            </div>

            {/* Review body */}
            {r.comment && <p className="text-sm text-[var(--bv-text-muted)] leading-relaxed">{r.comment}</p>}

            {/* Optional host reply */}
            {r.hostReply?.text && (
              <div className="mt-3 ml-6 p-3 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
                <p className="text-[10px] text-[var(--bv-gold)] font-bold uppercase tracking-wider mb-1">Host Reply</p>
                <p className="text-sm text-[var(--bv-text-muted)]">{r.hostReply.text}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PropertyReviews;
