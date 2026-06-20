/**
 * @file SmartSearch.jsx
 * @description Advanced Property Search Component
 *
 * This component provides a comprehensive search interface for property discovery.
 * It features city-based autocomplete, date selection, and advanced filters for
 * property type, stay duration, and price range.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react';

// --- Constants ---

const CITIES = [
  'Islamabad',
  'Lahore',
  'Karachi',
  'Gujranwala',
  'Rawalpindi',
  'Peshawar',
  'Quetta',
  'Faisalabad',
  'Multan',
  'Skardu',
  'Murree',
  'Swat',
  'Hunza',
  'Gilgit',
  'Naran',
  'Abbottabad',
];

/**
 * @function SmartSearch
 * @description Renders a search bar with autocomplete and advanced filtering options.
 * @returns {JSX.Element} The rendered search component.
 */
const SmartSearch = () => {
  const navigate = useNavigate();

  // --- State ---

  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [type, setType] = useState('');
  const [stayType, setStayType] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(50000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);

  // --- Refs ---

  const sugRef = useRef(null);
  const today = new Date().toISOString().split('T')[0];

  // --- Effects ---

  /**
   * @description Effect to handle city search suggestions based on user input.
   */
  useEffect(
    () => {
      // Setup:
      if (!city.trim()) {
        setSuggestions([]);
        return;
      }

      const filtered = CITIES.filter((c) => {
        return c.toLowerCase().includes(city.toLowerCase());
      });

      setSuggestions(filtered.slice(0, 6));
      setShowSug(filtered.length > 0);

      // Cleanup:
      return () => {
        // No cleanup required
      };
    },
    // Dependency Array:
    [
      city, // Re-run whenever city input changes
    ]
  );

  /**
   * @description Effect to handle clicks outside the suggestion dropdown.
   */
  useEffect(
    () => {
      // Setup:
      const handleClickOutside = (e) => {
        if (sugRef.current && !sugRef.current.contains(e.target)) {
          setShowSug(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Cleanup:
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    },
    // Dependency Array:
    []
  );

  // --- Handlers ---

  /**
   * @function handleSubmit
   * @description Processes the search form submission and navigates to results.
   * @param {Event} e - Form submission event.
   */
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!city.trim()) {
      return;
    }

    const params = new URLSearchParams();
    params.set('city', city.trim());

    if (checkIn) {
      params.set('checkIn', checkIn);
    }

    if (type) {
      params.set('type', type);
    }

    if (stayType) {
      params.set('stayType', stayType);
    }

    if (minPrice > 0) {
      params.set('minPrice', minPrice);
    }

    if (maxPrice < 50000) {
      params.set('maxPrice', maxPrice);
    }

    navigate(`/view-all-properties?${params.toString()}`);
  };

  /**
   * @function selectCity
   * @description Sets the selected city and hides suggestions.
   * @param {string} cityName - The city to select.
   */
  const selectCity = (cityName) => {
    setCity(cityName);
    setShowSug(false);
  };

  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h2 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)]">
          Find Your <span className="text-[var(--bv-gold)]">Perfect Stay</span>
        </h2>
        <p className="text-[var(--bv-text-muted)] mt-3 text-sm">
          Smart search across 50+ cities
        </p>
      </div>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="bv-card-static p-4 space-y-4">
          {/* Main row */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex-1 relative" ref={sugRef}>
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)] focus-within:border-[var(--bv-gold)] transition">
                <MapPin
                  size={16}
                  className="text-[var(--bv-text-dim)] flex-shrink-0"
                />
                <input
                  type="text"
                  placeholder="Where to? (city name)"
                  value={city}
                  onChange={(e) => {
                    return setCity(e.target.value);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSug(true);
                    }
                  }}
                  className="flex-1 bg-transparent text-[var(--bv-text)] placeholder-[var(--bv-text-dim)] text-sm outline-none"
                  required
                />
                {city && (
                  <button
                    type="button"
                    onClick={() => {
                      setCity('');
                      setSuggestions([]);
                    }}
                    className="text-[var(--bv-text-dim)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* Autocomplete dropdown */}
              {showSug && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-xl shadow-[var(--bv-shadow-lg)] z-50 overflow-hidden bv-animate-in">
                  {suggestions.map((s) => {
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          return selectCity(s);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bv-gold-glow)] transition"
                      >
                        <MapPin size={14} className="text-[var(--bv-gold)]" />
                        <span className="text-sm text-[var(--bv-text)]">{s}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)] focus-within:border-[var(--bv-gold)] transition sm:w-44">
              <Calendar
                size={16}
                className="text-[var(--bv-text-dim)] flex-shrink-0"
              />
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => {
                  return setCheckIn(e.target.value);
                }}
                className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none [color-scheme:dark]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                return setShowAdvanced((s) => {
                  return !s;
                });
              }}
              className={`p-3 rounded-xl border transition ${
                showAdvanced
                  ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]'
                  : 'border-[var(--bv-border)] text-[var(--bv-text-dim)] hover:text-[var(--bv-text)]'
              }`}
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              type="submit"
              className="bv-btn-gold flex items-center justify-center gap-2 px-8 py-3.5 text-sm whitespace-nowrap"
            >
              <SearchIcon size={16} /> Search
            </button>
          </div>

          {/* Advanced filters */}
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--bv-divider)] bv-animate-in">
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
                  <option value="Home">Full Home</option>
                </select>
              </div>
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
              <div>
                <label className="bv-label">
                  Min Price: PKR {minPrice.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="500"
                  value={minPrice}
                  onChange={(e) => {
                    return setMinPrice(Number(e.target.value));
                  }}
                  className="w-full h-2 bg-[var(--bv-surface)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--bv-gold)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                />
              </div>
              <div>
                <label className="bv-label">
                  Max Price: PKR {maxPrice.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="500"
                  value={maxPrice}
                  onChange={(e) => {
                    return setMaxPrice(Number(e.target.value));
                  }}
                  className="w-full h-2 bg-[var(--bv-surface)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--bv-gold)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </section>
  );
};

export default SmartSearch;
