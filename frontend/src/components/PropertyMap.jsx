/**
 * @file PropertyMap.jsx
 * @description Renders an interactive Leaflet map for a property's location.
 * It displays a custom marker at the property's coordinates, draws a proximity
 * circle, and provides deep links to Google Maps for directions. It also
 * performs reverse geocoding to resolve and display nearby neighborhood labels.
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                LEAFLET SETUP                               */
/* -------------------------------------------------------------------------- */

// Fix default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/** Custom gold marker to match the BookVibe brand */
const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/* -------------------------------------------------------------------------- */
/*                               SUB-COMPONENTS                               */
/* -------------------------------------------------------------------------- */

/**
 * @component FitBounds
 * @description Internal helper: sets the map view to the given coordinates.
 * @param {Object} props - Component properties.
 * @param {number} props.lat - Latitude.
 * @param {number} props.lng - Longitude.
 * @returns {null} Renders nothing.
 */
const FitBounds = ({ lat, lng }) => {
  /**
   * @description Access the Leaflet map instance.
   */
  const map = useMap();

  /**
   * @hook useEffect
   * @description Pan and zoom the map to the property coordinates when they change.
   */
  useEffect(
    () => {
      if (lat && lng) {
        map.setView([lat, lng], 15);
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
 * @component PropertyMap
 * @description Main component for displaying a property's location on a map.
 * @param {Object} props - Component properties.
 * @returns {JSX.Element} The PropertyMap component.
 */
const PropertyMap = ({ latitude, longitude, propertyName, address, city, type, rating }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Array of neighbourhood/suburb strings from reverse geocoding.
   */
  const [nearby, setNearby] = useState([]);

  /* -------------------------------------------------------------------------- */
  /*                                    LOGIC                                   */
  /* -------------------------------------------------------------------------- */

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Reverse-geocode the property coordinates via Nominatim.
   */
  useEffect(
    () => {
      /**
       * Asynchronous fetch for reverse geocoding data.
       */
      const fetchNearby = async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();

          if (data?.address) {
            const parts = [];

            if (data.address.neighbourhood) {
              parts.push(data.address.neighbourhood);
            }
            if (data.address.suburb) {
              parts.push(data.address.suburb);
            }
            if (data.address.city_district) {
              parts.push(data.address.city_district);
            }

            setNearby(parts.slice(0, 3));
          }
        } catch {
          // Silently fail — nearby labels are non-critical
        }
      };

      fetchNearby();

      
      return () => {
        
      };
    },
    // Dependencies
    [lat, lng]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  // Guard: show a placeholder if coordinates are missing or not valid numbers
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return (
      <div className="bv-card-static p-8 text-center">
        <MapPin size={32} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-30" />
        <p className="text-[var(--bv-text-muted)] font-semibold">Location not available</p>
        <p className="text-xs text-[var(--bv-text-dim)] mt-1">Property coordinates not set by host</p>
      </div>
    );
  }

  /** Deep-link to navigate from the user's current position to the property */
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  /** Deep-link to open Google Maps centred on the property */
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="bv-card-static overflow-hidden">
      {/* Header: section label + address */}
      <div className="p-5 border-b border-[var(--bv-divider)]">
        <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest flex items-center gap-2">
          <MapPin size={14} /> Location
        </h3>
        <p className="text-sm text-[var(--bv-text-muted)] mt-1">
          {address}
          {city ? `, ${city}` : ''}
        </p>
      </div>

      {/* Map */}
      <div style={{ height: 380, zIndex: 0 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomAnimation={true}
          fadeAnimation={true}
          wheelDebounceTime={40}
          wheelPxPerZoomLevel={80}
          zoomSnap={0.5}
          zoomDelta={0.5}
        >
          {/* CartoDB Voyager tiles — fast, clean minimal style */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={20}
            updateWhenZooming={false}
            updateWhenIdle={true}
            keepBuffer={4}
          />

          {/* Pan/zoom the map to the property on load */}
          <FitBounds lat={lat} lng={lng} />

          {/* Property marker with informational popup */}
          <Marker position={[lat, lng]} icon={goldIcon}>
            <Popup maxWidth={220}>
              <div style={{ textAlign: 'center', fontFamily: 'Satoshi, sans-serif' }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>{propertyName}</p>
                {type && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      background: '#C9A84C20',
                      color: '#C9A84C',
                      borderRadius: 20,
                      fontWeight: 700,
                    }}
                  >
                    {type}
                  </span>
                )}
                {rating && <p style={{ fontSize: 11, color: '#C9A84C', marginTop: 4 }}>&#9733; {rating}</p>}
                <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{address}</p>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    fontSize: 11,
                    color: '#1A8A7D',
                    fontWeight: 600,
                  }}
                >
                  Get Directions →
                </a>
              </div>
            </Popup>
          </Marker>

          {/* 500 m proximity circle with dashed gold outline */}
          <Circle
            center={[lat, lng]}
            radius={500}
            pathOptions={{
              color: '#C9A84C',
              fillColor: '#C9A84C',
              fillOpacity: 0.06,
              weight: 1,
              dashArray: '5,5',
            }}
          />
        </MapContainer>
      </div>

      {/* Footer: nearby labels + external map links */}
      <div className="p-4 bg-[var(--bv-bg-raised)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            {/* Neighbourhood pills from reverse geocode */}
            {nearby.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold self-center mr-1">
                  Nearby:
                </span>
                {nearby.map((n, i) => {
                  return (
                    <span key={i} className="bv-badge bv-badge-gold text-[9px]">
                      {n}
                    </span>
                  );
                })}
              </div>
            )}
            {/* Decimal coordinate display */}
            <p className="text-[10px] text-[var(--bv-text-dim)] mt-1.5">
              {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
            </p>
          </div>

          {/* External map links */}
          <div className="flex gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bv-btn-gold text-xs px-4 py-2 flex items-center gap-1.5 no-underline"
            >
              <Navigation size={12} /> Directions
            </a>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5 no-underline"
            >
              <ExternalLink size={12} /> Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyMap;
