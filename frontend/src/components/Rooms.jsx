/**
 * Rooms.jsx
 *
 * This component renders the "Handpicked Properties" section on the home page.
 * It fetches a limited set of featured properties from the API and displays
 * them in a responsive grid or scrollable container. Each property card
 * provides a preview of pricing, ratings, and location details.
 *
 * @module Rooms
 */

import { useEffect, useState } from 'react';
import { MapPin, Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cloudinaryTransform } from '../utils/publicPagePerf';
import WishlistButton from './WishlistButton';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/* ── SUB-COMPONENTS ── */

/**
 * Skeleton placeholder rendered while the property list loads.
 *
 * @returns {JSX.Element}
 */
const Skeleton = () => {
  return (
    <div className="bv-skeleton h-[340px] rounded-2xl min-w-[280px] sm:min-w-0" />
  );
};

/* ── MAIN COMPONENT ── */

/**
 * Rooms Component.
 *
 * @returns {JSX.Element}
 */
const Rooms = () => {
  const navigate = useNavigate();

  /* ── STATE MANAGEMENT ── */

  /** @type {[Array, Function]} List of up to 6 featured property objects */
  const [items, setItems] = useState([]);

  /** @type {[boolean, Function]} Whether the initial API fetch is in progress */
  const [loading, setLoading] = useState(true);

  /* ── EFFECTS ── */

  /**
   * Effect: Fetch the first 6 properties on component mount.
   */
  useEffect(() => {
    const controller = new AbortController();

    axios
      .get(`${BASE}/property?limit=6`, { signal: controller.signal })
      .then((r) => setItems(r.data?.properties?.slice(0, 6) || []))
      .catch((err) => {
        if (!axios.isCancel(err)) {
          // Silently fail — empty state is handled in JSX
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  /* ── RENDER ── */

  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">
              Featured
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)]">
              Handpicked Properties
            </h2>
          </div>
          {/* "View all" link — hidden on mobile (shown via button at bottom instead) */}
          <button
            onClick={() => {
              return navigate('/view-all-properties');
            }}
            className="hidden sm:inline-flex items-center gap-2 text-sm text-[var(--bv-gold)] hover:text-[var(--bv-gold-light)] font-semibold transition"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {/* Card container — horizontal scroll on mobile, CSS grid on sm+ */}
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide sm:grid sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            // Render 6 skeletons while loading
            [1, 2, 3, 4, 5, 6].map((i) => {
              return (
                <Skeleton key={i} />
              );
            })
          ) : items.length === 0 ? (
            // Empty state
            <div className="w-full sm:col-span-full text-center py-20">
              <p className="text-[var(--bv-text-dim)] text-lg">
                No properties available yet
              </p>
            </div>
          ) : (
            items.map((p) => {
              return (
                <div
                  key={p._id}
                  onClick={() => {
                    return navigate(`/property/${p.type?.toLowerCase()}/${p._id}`);
                  }}
                  className="bv-card group cursor-pointer overflow-hidden min-w-[280px] sm:min-w-0 flex-shrink-0"
                >
                  {/* Thumbnail with overlaid badges */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={
                        cloudinaryTransform(p.images?.[0]?.url) ||
                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'
                      }
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--bv-bg)] via-transparent to-transparent opacity-60" />

                    {/* Property type badge — top left */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className="bv-badge bv-badge-gold">{p.type}</div>
                      <WishlistButton propertyId={p._id} />
                    </div>

                    {/* Star rating badge — bottom right */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 bv-badge bg-black/40 text-[var(--bv-gold)] border-transparent backdrop-blur-sm">
                      <Star size={10} fill="currentColor" /> {p.rating || '—'}
                    </div>

                    {/* Stay type badges — top right (weekly / monthly) */}
                    <div className="absolute top-3 right-3 flex flex-col gap-1">
                      {p.stayTypes?.includes('weekly') && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/90 text-white backdrop-blur-sm">
                          WEEKLY
                        </span>
                      )}
                      {p.stayTypes?.includes('monthly') && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/90 text-white backdrop-blur-sm">
                          MONTHLY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-[var(--bv-text)] truncate group-hover:text-[var(--bv-gold)] transition-colors">
                      {p.name}
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs text-[var(--bv-text-dim)] mt-1.5">
                      <MapPin size={11} /> {p.city}, {p.country}
                    </p>

                    <div className="flex items-end justify-between mt-4 pt-4 border-t border-[var(--bv-divider)]">
                      <div>
                        {/* Base nightly rate */}
                        <span className="text-lg font-bold text-[var(--bv-gold)]">
                          PKR {p.price?.toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--bv-text-dim)] ml-1">
                          / night
                        </span>

                        {/* Weekly rate with optional discount percentage */}
                        {p.pricing?.weekly && (
                          <p className="text-[10px] text-[var(--bv-info)] font-semibold mt-0.5">
                            Weekly: PKR {p.pricing.weekly.toLocaleString()}
                            {p.pricing.weeklyDiscount > 0 && (
                              <span className="text-[var(--bv-success)] ml-1">
                                ({p.pricing.weeklyDiscount}% off)
                              </span>
                            )}
                          </p>
                        )}

                        {/* Monthly rate with optional discount percentage */}
                        {p.pricing?.monthly && (
                          <p className="text-[10px] text-[var(--bv-success)] font-semibold">
                            Monthly: PKR {p.pricing.monthly.toLocaleString()}
                            {p.pricing.monthlyDiscount > 0 && (
                              <span className="ml-1">
                                ({p.pricing.monthlyDiscount}% off)
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <ArrowRight
                        size={16}
                        className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] group-hover:translate-x-1 transition-all"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile "View All" button — replaces the hidden header link */}
        <div className="sm:hidden flex justify-center mt-8">
          <button
            onClick={() => {
              return navigate('/view-all-properties');
            }}
            className="bv-btn-outline text-sm px-8 py-3"
          >
            View All Properties
          </button>
        </div>
      </div>
    </section>
  );
};

export default Rooms;
