/**
 * NearByRooms.jsx
 *
 * This component utilizes geolocation to detect the user's current city and
 * display properties located in the same area. It performs a reverse geocoding
 * look-up to resolve the city name and then fetches filtered properties.
 * The section is conditionally rendered only when nearby properties are found.
 *
 * @module NearByRooms
 */

import { useEffect, useState } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cloudinaryTransform } from '../utils/publicPagePerf';
import WishlistButton from './WishlistButton';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * NearByRooms Component.
 *
 * @returns {JSX.Element|null}
 */
const NearByRooms = () => {
  const navigate = useNavigate();

  /* ── STATE MANAGEMENT ── */

  /** @type {[string, Function]} City name resolved from reverse geocoding */
  const [city, setCity] = useState('');

  /** @type {[Array, Function]} List of property objects returned for the detected city */
  const [items, setItems] = useState([]);

  /** @type {[boolean, Function]} Whether geocoding or property fetch is in progress */
  const [loading, setLoading] = useState(true);

  /* ── EFFECTS ── */

  /**
   * Effect: Step 1 - Request the user's GPS coordinates and reverse-geocode to a city.
   */
  useEffect(
    () => {
      if (!navigator.geolocation) {
        setLoading(false);
        return;
      }

      // AbortController lets us cancel the reverse-geocode fetch if the
      // component unmounts before the geolocation callback fires.
      const geoController = new AbortController();
      let cancelled = false;

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          if (cancelled) return;
          try {
            const r = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
              { signal: geoController.signal }
            );
            const j = await r.json();
            if (!cancelled) setCity(j.city || j.locality || '');
          } catch (err) {
            if (err.name !== 'AbortError' && !cancelled) setLoading(false);
          }
        },
        () => {
          if (!cancelled) setLoading(false);
        }
      );

      return () => {
        cancelled = true;
        geoController.abort();
      };
    },
    // Dependencies: Run once on mount
    []
  );

  /**
   * Effect: Step 2 - Fetch properties for the resolved city.
   */
  useEffect(
    () => {
      if (!city) {
        return;
      }

      setLoading(true);
      const controller = new AbortController();

      axios
        .get(`${BASE}/property?city=${encodeURIComponent(city)}`, { signal: controller.signal })
        .then((r) => {
          setItems(r.data?.properties?.slice(0, 8) || []);
        })
        .catch((err) => {
          if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
            setItems([]);
          }
        })
        .finally(() => {
          setLoading(false);
        });

      // Cancel the request if the component unmounts before it resolves.
      return () => {
        controller.abort();
      };
    },
    // Dependencies: re-fetch if city changes
    [city]
  );

  /* ── RENDER HELPERS ── */

  // Hide the section entirely if there's no city and we're not loading
  if (!city && !loading) {
    return null;
  }

  // Hide the section if the fetch completed with zero results
  if (!loading && items.length === 0) {
    return null;
  }

  /* ── MAIN RENDER ── */

  return (
    <section className="py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section label and city-specific heading */}
        <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">
          Near You
        </p>
        <h2 className="font-display text-3xl text-[var(--bv-text)] mb-8">
          Properties in <span className="text-[var(--bv-gold)]">{city}</span>
        </h2>

        {/* Horizontally scrollable card row */}
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {loading ? (
            // Skeleton placeholders while data loads
            [1, 2, 3, 4].map((i) => {
              return (
                <div key={i} className="bv-skeleton min-w-[280px] h-72 rounded-2xl flex-shrink-0" />
              );
            })
          ) : (
            items.map((p) => {
              return (
                <div
                  key={p._id}
                  onClick={() => {
                    return navigate(`/property/${p.type?.toLowerCase()}/${p._id}`);
                  }}
                  className="bv-card min-w-[280px] flex-shrink-0 cursor-pointer overflow-hidden group"
                >
                  {/* Property thumbnail */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={cloudinaryTransform(p.images?.[0]?.url)}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className="bv-badge bv-badge-gold">{p.type}</div>
                      <WishlistButton propertyId={p._id} />
                    </div>
                    </div>

                  {/* Card content */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-[var(--bv-text)] truncate">{p.name}</h3>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--bv-divider)]">
                      <div>
                        <span className="text-sm font-bold text-[var(--bv-gold)]">
                          PKR {p.price?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[var(--bv-text-dim)] ml-1">
                          / night
                        </span>
                        {/* Weekly pricing badge */}
                        {p.pricing?.weekly && (
                          <span className="text-[10px] text-[var(--bv-success)] ml-2 font-semibold">
                            Weekly available
                          </span>
                        )}
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition"
                      />
                    </div>

                    {/* Star rating */}
                    <div className="mt-2">
                      <span className="flex items-center gap-1 text-xs text-[var(--bv-gold)]">
                        <Star size={10} fill="currentColor" /> {p.rating || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default NearByRooms;
