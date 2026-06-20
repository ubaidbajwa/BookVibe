/**
 * @file LocationPickerMap.jsx
 * @description Interactive Leaflet map used in the host's add/edit property form to let the
 * host pin the exact property location. Supports three input methods:
 *  1. Clicking directly on the map.
 *  2. Dragging the marker to a new position.
 *  3. Searching by place name using the Nominatim geocoding API (Pakistan only).
 *  4. Using the browser's Geolocation API to auto-set the current position.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Crosshair, Loader2 } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                LEAFLET SETUP                               */
/* -------------------------------------------------------------------------- */

// Fix the default icon path broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/**
 * Custom gold-coloured marker to match the BookVibe brand colour
 */
const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/* -------------------------------------------------------------------------- */
/*                               HELPER COMPONENTS                            */
/* -------------------------------------------------------------------------- */

/**
 * @component MapClickHandler
 * @description Internal helper: captures map click events and calls `onLocationSelect`.
 * @param {Object} props - Component props.
 * @param {Function} props.onLocationSelect - Callback function for location selection.
 * @returns {null} Renders nothing.
 */
const MapClickHandler = ({ onLocationSelect }) => {
  /**
   * @hook useMapEvents
   * @description Hook into map events to handle click interactions.
   */
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/**
 * @component FlyTo
 * @description Internal helper: smoothly flies the map viewport to the given coordinates.
 * @param {Object} props - Component props.
 * @param {number} props.lat - Latitude to fly to.
 * @param {number} props.lng - Longitude to fly to.
 * @returns {null} Renders nothing.
 */
const FlyTo = ({ lat, lng }) => {
  /**
   * @description Access the Leaflet map instance.
   */
  const map = useMap();

  /**
   * @hook useEffect
   * @description Fly the map to the new coordinates whenever lat or lng changes.
   */
  useEffect(
    () => {
      if (lat && lng) {
        map.flyTo([lat, lng], 16, { duration: 0.8, easeLinearity: 0.5 });
      }

      // Cleanup function
      return () => {
        // No cleanup necessary
      };
    },
    // Dependencies
    [lat, lng, map]
  );

  return null;
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

/**
 * @component LocationPickerMap
 * @description Main map component for selecting property location.
 * @param {Object} props - Component props.
 * @param {string|number} props.latitude - Initial latitude.
 * @param {string|number} props.longitude - Initial longitude.
 * @param {Function} props.onLocationChange - Callback fired on location change.
 * @param {string} props.propertyName - Optional property name for popup.
 * @returns {JSX.Element} The LocationPickerMap component.
 */
const LocationPickerMap = ({ latitude, longitude, onLocationChange, propertyName = '' }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Current [lat, lng] array; initialised from props or Lahore.
   */
  const [position, setPosition] = useState(
    latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : [31.5204, 74.3587] // Lahore default
  );

  /**
   * @description Current value of the location search input.
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * @description True while a Nominatim API call is in progress.
   */
  const [searching, setSearching] = useState(false);

  /**
   * @description Nominatim result list for the current search query.
   */
  const [suggestions, setSuggestions] = useState([]);

  /**
   * @description Whether the autocomplete dropdown is visible.
   */
  const [showSug, setShowSug] = useState(false);

  /**
   * @description True while the browser is resolving GPS coordinates.
   */
  const [gettingLocation, setGettingLocation] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                                    REFS                                    */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Attached to the search wrapper div for click-outside detection.
   */
  const searchRef = useRef(null);

  /**
   * @description Timer for the search input debounce.
   */
  const debounceRef = useRef(null);

  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Sync the internal position state when the parent passes new coordinates.
   */
  useEffect(
    () => {
      if (latitude && longitude) {
        setPosition([parseFloat(latitude), parseFloat(longitude)]);
      }

      // Cleanup function
      return () => {
        // No cleanup necessary
      };
    },
    // Dependencies
    [latitude, longitude]
  );

  /**
   * @hook useEffect
   * @description Close the suggestions dropdown when the user clicks outside the search box.
   */
  useEffect(
    () => {
      /**
       * Handle clicks outside the search container.
       */
      const handleClickOutside = (e) => {
        if (searchRef.current && !searchRef.current.contains(e.target)) {
          setShowSug(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Cleanup
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    },
    // Dependencies
    []
  );

  /**
   * @function handleLocationSelect
   * @description Update the internal position state and notify the parent component.
   */
  const handleLocationSelect = useCallback(
    (lat, lng) => {
      const rLat = parseFloat(lat.toFixed(6));
      const rLng = parseFloat(lng.toFixed(6));
      setPosition([rLat, rLng]);
      onLocationChange(rLat, rLng);
    },
    // Dependencies
    [onLocationChange]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   HANDLERS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Call the Nominatim geocoding API for the given query string.
   * @param {string} query - The search query.
   */
  const searchLocation = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setSearching(true);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pk&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      setSuggestions(data);
      setShowSug(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  /**
   * @description Handle search input changes with a 400 ms debounce.
   * @param {string} val - The input value.
   */
  const handleSearchInput = (val) => {
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocation(val);
    }, 400);
  };

  /**
   * @description Select a suggestion from the dropdown.
   * @param {Object} item - The suggestion item.
   */
  const selectSuggestion = (item) => {
    handleLocationSelect(parseFloat(item.lat), parseFloat(item.lon));
    // Show only the first two parts of the full address to keep the input tidy
    setSearchQuery(item.display_name.split(',').slice(0, 2).join(','));
    setShowSug(false);
  };

  /**
   * @description Use the browser Geolocation API to snap the marker to the user's current physical location.
   */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }

    setGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleLocationSelect(pos.coords.latitude, pos.coords.longitude);
        setGettingLocation(false);
      },
      () => {
        setGettingLocation(false);
        alert('Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-3">
      {/* Search bar + "My Location" button */}
      <div className="flex gap-2" ref={searchRef}>
        <div className="relative flex-1">
          {/* Search input with inline spinner */}
          <div className="flex items-center gap-2 bv-input pr-2">
            <Search size={14} className="text-[var(--bv-text-dim)] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                handleSearchInput(e.target.value);
              }}
              onFocus={() => {
                if (suggestions.length) {
                  setShowSug(true);
                }
              }}
              placeholder="Search location (e.g. Hunza Valley)"
              className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
            />
            {searching && <Loader2 size={14} className="animate-spin text-[var(--bv-gold)]" />}
          </div>

          {/* Autocomplete suggestions dropdown */}
          {showSug && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-xl shadow-[var(--bv-shadow-lg)] z-[1000] overflow-hidden">
              {suggestions.map((s, i) => {
                return (
                  <button
                    key={i}
                    onClick={() => {
                      selectSuggestion(s);
                    }}
                    className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-[var(--bv-gold-glow)] transition border-b border-[var(--bv-divider)] last:border-0"
                  >
                    <MapPin size={13} className="text-[var(--bv-gold)] mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-[var(--bv-text-muted)] line-clamp-2">{s.display_name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* GPS location button */}
        <button
          type="button"
          onClick={() => {
            getCurrentLocation();
          }}
          disabled={gettingLocation}
          className="bv-btn-outline px-3 flex items-center gap-1.5 text-xs flex-shrink-0"
        >
          {gettingLocation ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
          <span className="hidden sm:inline">My Location</span>
        </button>
      </div>

      {/* Map container */}
      <div
        className="rounded-xl overflow-hidden border border-[var(--bv-border)] shadow-[var(--bv-shadow-sm)]"
        style={{ height: 350, zIndex: 0 }}
      >
        <MapContainer
          center={position}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomAnimation={true}
          fadeAnimation={true}
          markerZoomAnimation={true}
          wheelDebounceTime={40}
          wheelPxPerZoomLevel={80}
          zoomSnap={0.5}
          zoomDelta={0.5}
        >
          {/* CartoDB Voyager tiles — fast CDN, clean minimal style */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={20}
            updateWhenZooming={false}
            updateWhenIdle={true}
            keepBuffer={4}
          />

          {/* Click handler — updates marker on map click */}
          <MapClickHandler
            onLocationSelect={(lat, lng) => {
              handleLocationSelect(lat, lng);
            }}
          />

          {/* Smooth fly-to animation when coordinates change */}
          <FlyTo lat={position[0]} lng={position[1]} />

          {/* Draggable gold marker */}
          <Marker
            position={position}
            icon={goldIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                handleLocationSelect(lat, lng);
              },
            }}
          >
            <Popup>
              <div className="text-center">
                <p style={{ fontWeight: 700, fontSize: 13 }}>{propertyName || 'Property Location'}</p>
                <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  {position[0].toFixed(6)}, {position[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Helper hint */}
      <p className="text-[10px] text-[var(--bv-text-dim)] flex items-center gap-1">
        <MapPin size={10} /> Click on map or drag marker to set exact location
      </p>
    </div>
  );
};

export default LocationPickerMap;
