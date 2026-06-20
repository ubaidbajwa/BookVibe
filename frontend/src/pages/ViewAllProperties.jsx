/**
 * @file ViewAllProperties.jsx
 * @description Page component that displays a searchable and filterable list of all available properties.
 * Features include pagination (load more), property type filtering, and stay duration filtering.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  MapPin, 
  Star, 
  Search, 
  Filter, 
  X, 
  Loader2, 
  ArrowRight, 
  Moon, 
  Calendar, 
  CalendarRange, 
  ChevronDown, 
  Home, 
  Building2, 
  DoorOpen, 
  SlidersHorizontal 
} from 'lucide-react';
import { cloudinaryTransform } from '../utils/publicPagePerf';
import WishlistButton from '../components/WishlistButton';

/**
 * Base API URL derived from environment variables.
 * @constant {string}
 */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * ViewAllProperties Component
 * @returns {JSX.Element} The rendered component.
 */
const ViewAllProperties = () => {
  // --- Hooks ---

  /**
   * Navigation hook for programmatic routing.
   */
  const nav = useNavigate();

  /**
   * Hook to access and manage URL search parameters.
   */
  const [params] = useSearchParams();

  /**
   * State for the list of properties to display.
   */
  const [properties, setProperties] = useState([]);

  /**
   * State to track initial loading of properties.
   */
  const [loading, setLoading] = useState(true);

  /**
   * State to track loading of additional properties for pagination.
   */
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * State to control the visibility of the filter panel.
   */
  const [showFilters, setShowFilters] = useState(false);

  /**
   * State for current page in pagination.
   */
  const [page, setPage] = useState(1);

  /**
   * State for the total number of pages available.
   */
  const [totalPages, setTotalPages] = useState(1);

  /**
   * State for the total number of properties found.
   */
  const [totalResults, setTotalResults] = useState(0);

  /**
   * State for search query string.
   */
  const [search, setSearch] = useState(params.get('search') || params.get('city') || '');

  /**
   * State for property type filter.
   */
  const [type, setType] = useState(params.get('type') || '');

  /**
   * State for stay duration type filter (nightly, weekly, monthly).
   */
  const [stayType, setStayType] = useState(params.get('stayType') || '');

  /**
   * State for minimum price filter.
   */
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');

  /**
   * State for maximum price filter.
   */
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');

  /**
   * Ref to store the AbortController for cancelling in-flight requests.
   */
  const abortRef = useRef(null);

  // --- Logic ---

  /**
   * Fetches properties from the API based on current filters and pagination.
   * 
   * @param {Object} overrides - Manual overrides for filter values.
   * @param {boolean} isLoadMore - Whether this is a request for the next page.
   * @async
   */
  const fetchProperties = async (overrides = {}, isLoadMore = false) => {
    // Abort the previous request on fresh searches — prevents stale-state overwrites
    if (!isLoadMore) {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
    }
    const signal = isLoadMore ? undefined : abortRef.current.signal;

    // React Strict Mode runs cleanup (which aborts AC) immediately before re-mounting.
    // JavaScript's `finally` always executes even after `return` inside a catch block,
    // so without this flag, the aborted request's finally would call setLoading(false)
    // AFTER the replacement request has already called setLoading(true), leaving the
    // component stuck in a blank "No properties found" state.
    let aborted = false;

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const s = overrides.search ?? search;
      const t = overrides.type ?? type;
      const st = overrides.stayType ?? stayType;
      const min = overrides.minPrice ?? minPrice;
      const max = overrides.maxPrice ?? maxPrice;
      const p = overrides.page ?? (isLoadMore ? page + 1 : 1);

      const q = new URLSearchParams();
      if (s && s.trim()) {
        q.set('search', s.trim());
      }
      if (t) {
        q.set('type', t);
      }
      if (st) {
        q.set('stayType', st);
      }
      if (min) {
        q.set('minPrice', min);
      }
      if (max) {
        q.set('maxPrice', max);
      }
      q.set('page', p);
      q.set('limit', 12);

      const res = await axios.get(`${BASE}/property?${q.toString()}`, { signal });
      if (res.data.success) {
        if (isLoadMore) {
          setProperties((prev) => {
            return [...prev, ...(res.data.properties || [])];
          });
        } else {
          setProperties(res.data.properties || []);
        }
        setTotalPages(res.data.pages || 1);
        setTotalResults(res.data.total || 0);
        setPage(p);
      }
    } catch (err) {
      if (axios.isCancel(err) || err?.name === 'CanceledError') {
        // Intentional abort — mark as aborted so finally does NOT reset loading.
        // The replacement request is already running and owns the loading flag.
        aborted = true;
        return;
      }
      if (!isLoadMore) {
        setProperties([]);
      }
    } finally {
      // Do not touch loading state for aborted requests; the next request manages it.
      if (!aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  /**
   * Effect Hook: Performs initial fetch of properties based on URL parameters.
   * Handles cleanup by aborting any pending requests on unmount.
   */
  useEffect(() => {
    // Setup
    fetchProperties({
      search: params.get('search') || params.get('city') || '',
      type: params.get('type') || '',
      stayType: params.get('stayType') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      page: 1
    });

    // Cleanup
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
    // Dependencies
  }, []);

  /**
   * Handles the search form submission.
   * @param {Event} e - Form submission event.
   */
  const handleSearch = (e) => {
    if (e) {
      e.preventDefault();
    }
    fetchProperties({ page: 1 });
  };

  /**
   * Clears all active filters and resets the property list.
   */
  const clearFilters = () => {
    setSearch('');
    setType('');
    setStayType('');
    setMinPrice('');
    setMaxPrice('');
    setTimeout(() => {
      fetchProperties({ search: '', type: '', stayType: '', minPrice: '', maxPrice: '', page: 1 });
    }, 50);
  };

  /**
   * Boolean flag indicating if any filters (other than search) are currently active.
   */
  const hasActiveFilters = type || stayType || minPrice || maxPrice;

  // --- Render ---

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">Explore</p>
          <h1 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)]">All Properties</h1>
          <p className="text-[var(--bv-text-muted)] text-sm mt-2">
            {loading ? 'Loading...' : `${totalResults} properties found`}
          </p>
        </div>

        {/* Search Bar Section */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="flex items-center gap-2 bv-input flex-1">
            <Search size={16} className="text-[var(--bv-text-dim)] flex-shrink-0" />
            <input 
              value={search} 
              onChange={(e) => {
                return setSearch(e.target.value);
              }} 
              placeholder="Search by name, city, address..." 
              className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]" 
            />
            {search && (
              <button 
                type="button" 
                onClick={() => { 
                  setSearch(''); 
                  setTimeout(() => {
                    return fetchProperties({ search: '', page: 1 });
                  }, 50);
                }} 
                className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="bv-btn-gold px-6 text-sm flex items-center justify-center gap-2 sm:w-auto">
            <Search size={14} /> Search
          </button>
          <button 
            type="button" 
            onClick={() => {
              return setShowFilters((p) => {
                return !p;
              });
            }} 
            className={`bv-btn-outline px-4 text-sm flex items-center justify-center gap-2 relative sm:w-auto ${hasActiveFilters ? '!border-[var(--bv-gold)] !text-[var(--bv-gold)]' : ''}`}
          >
            <SlidersHorizontal size={14} /> Filters
            {hasActiveFilters && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--bv-gold)] text-[var(--bv-text-inverse)] text-[9px] font-bold flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </form>

        {/* Filter Panel Section */}
        {showFilters && (
          <div className="bv-card-static p-5 mb-6 bv-animate-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest">Filters</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-[var(--bv-danger)] font-semibold hover:underline">
                  Clear All
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Property Type Filter */}
              <div>
                <label className="bv-label">Property Type</label>
                <select 
                  value={type} 
                  onChange={(e) => {
                    return setType(e.target.value);
                  }} 
                  className="bv-input"
                >
                  <option value="">All Types</option>
                  <option value="Room">Room</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Home">Home</option>
                </select>
              </div>
              {/* Stay Duration Filter */}
              <div>
                <label className="bv-label">Stay Duration</label>
                <select 
                  value={stayType} 
                  onChange={(e) => {
                    return setStayType(e.target.value);
                  }} 
                  className="bv-input"
                >
                  <option value="">All Durations</option>
                  <option value="nightly">Per Night</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {/* Min Price Filter */}
              <div>
                <label className="bv-label">Min Price (PKR)</label>
                <input 
                  type="number" 
                  value={minPrice} 
                  onChange={(e) => {
                    return setMinPrice(e.target.value);
                  }} 
                  placeholder="0" 
                  className="bv-input" 
                />
              </div>
              {/* Max Price Filter */}
              <div>
                <label className="bv-label">Max Price (PKR)</label>
                <input 
                  type="number" 
                  value={maxPrice} 
                  onChange={(e) => {
                    return setMaxPrice(e.target.value);
                  }} 
                  placeholder="Any" 
                  className="bv-input" 
                />
              </div>
            </div>
            <button onClick={handleSearch} className="bv-btn-gold text-sm px-6 py-2.5 mt-4 flex items-center gap-2">
              <Filter size={14} /> Apply Filters
            </button>
          </div>
        )}

        {/* Stay Type Quick Filters Section */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
          {[
            { key: '', label: 'All', icon: Home },
            { key: 'nightly', label: 'Per Night', icon: Moon },
            { key: 'weekly', label: 'Weekly', icon: Calendar },
            { key: 'monthly', label: 'Monthly', icon: CalendarRange },
          ].map(({ key, label, icon: Icon }) => {
            return (
              <button 
                key={key} 
                onClick={() => { 
                  setStayType(key); 
                  fetchProperties({ stayType: key, page: 1 }); 
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${stayType === key ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)] shadow-[var(--bv-shadow-gold)]' : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)] hover:bg-[var(--bv-card-hover)]'}`}
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>

        {/* Properties Grid Section */}
        {loading ? (
          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => {
              return (
                <div key={i} className="bv-skeleton h-80 rounded-2xl min-w-[290px] sm:min-w-0 flex-shrink-0" />
              );
            })}
          </div>
        ) : properties.length === 0 ? (
          <div className="bv-card-static py-20 text-center">
            <Home size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-30" />
            <h3 className="text-xl font-bold text-[var(--bv-text)]">No properties found</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="bv-btn-outline text-sm px-6 py-2 mt-4">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
              {properties.map((p) => {
                return (
                  <div
                    key={p._id}
                    onClick={() => {
                      const isMulti = ['Hotel', 'Hostel', 'Plaza'].includes(p.type);
                      if (isMulti) {
                        return nav(`/hotel/${p._id}/rooms`);
                      }
                      return nav(`/property/${p.type?.toLowerCase()}/${p._id}`);
                    }}
                    className="bv-card overflow-hidden cursor-pointer group min-w-[290px] sm:min-w-0 flex-shrink-0"
                  >
                    {/* Property Image */}
                    <div className="relative h-52 overflow-hidden">
                      {p.images?.[0]?.url ? (
                        <img 
                          src={cloudinaryTransform(p.images[0].url)} 
                          alt={p.name} 
                          loading="lazy" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--bv-surface)] flex items-center justify-center">
                          <Home size={32} className="text-[var(--bv-text-dim)]" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="bv-badge bv-badge-gold">{p.type}</span>
                        <WishlistButton propertyId={p._id} />
                      </div>
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
                    {/* Property Content */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-base font-bold text-[var(--bv-text)] truncate flex-1 group-hover:text-[var(--bv-gold)] transition">
                          {p.name}
                        </h3>
                        {p.rating > 0 && (
                          <span className="flex items-center gap-1 text-xs text-[var(--bv-gold)] font-bold ml-2 flex-shrink-0">
                            <Star size={12} fill="currentColor" /> {p.rating}
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1 text-xs text-[var(--bv-text-dim)] mb-4 truncate">
                        <MapPin size={11} /> {p.address}, {p.city}
                      </p>

                      {/* Pricing Section */}
                      <div className="flex items-end justify-between pt-3 border-t border-[var(--bv-divider)]">
                        <div>
                          <span className="text-lg font-black text-[var(--bv-gold)]">
                            PKR {p.price?.toLocaleString()}
                          </span>
                          <span className="text-xs text-[var(--bv-text-dim)] ml-1">/ night</span>
                          {p.pricing?.weekly && (
                            <p className="text-[10px] text-[var(--bv-info)] font-semibold mt-0.5">
                              Weekly: PKR {p.pricing.weekly.toLocaleString()}
                              {p.pricing.weeklyDiscount > 0 && (
                                <span className="text-[var(--bv-success)] ml-1">({p.pricing.weeklyDiscount}% off)</span>
                              )}
                            </p>
                          )}
                          {p.pricing?.monthly && (
                            <p className="text-[10px] text-[var(--bv-success)] font-semibold">
                              Monthly: PKR {p.pricing.monthly.toLocaleString()}
                              {p.pricing.monthlyDiscount > 0 && (
                                <span className="ml-1">({p.pricing.monthlyDiscount}% off)</span>
                              )}
                            </p>
                          )}
                        </div>
                        <ArrowRight size={16} className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination / Load More Section */}
            {page < totalPages && (
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={() => {
                    return fetchProperties({}, true);
                  }} 
                  disabled={loadingMore}
                  className="bv-btn-gold px-10 py-3 text-sm flex items-center gap-3 shadow-[var(--bv-shadow-gold)]"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Loading more...
                    </>
                  ) : (
                    <>
                      Load More Stays <ChevronDown size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewAllProperties;
