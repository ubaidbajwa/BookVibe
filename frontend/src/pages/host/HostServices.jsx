/**
 * @file HostServices.jsx
 * @description Concierge service management page for the host panel.
 * 
 * Allows the host to add per-property concierge services (e.g. Airport
 * Pickup, Home Chef, Laundry) that guests with active bookings can request
 * through the app.
 *
 * Layout: a two-column grid with an "Add Service" form on the left and
 * the active services list for the selected property on the right.
 * The services list is fetched whenever the selected property changes.
 */

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Plus, Trash2, Loader2, ConciergeBell, Info, ShoppingBag } from 'lucide-react';
import { getAuthConfig } from '../../utils/authConfig';
import { getHostProperties } from '../../redux/slices/accommodationSlice';

/** @type {string} Base URL for API requests. */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @component HostServices
 * @description Manages concierge services for host properties.
 * 
 * @returns {JSX.Element} The rendered HostServices component.
 */
const HostServices = () => {
  /**
   * @section Hooks & Context
   */

  const dispatch = useDispatch();
  /** @type {Object} Properties available in Redux. */
  const { properties } = useSelector((s) => {
    return s.accommodations;
  });

  /**
   * @section State Management
   */

  /** @type {[string, Function]} The currently selected property ID. */
  const [selectedProperty, setSelectedProperty] = useState('');

  /** @type {[Array, Function]} Active concierge services for the selected property. */
  const [services, setServices] = useState([]);

  /** @type {[boolean, Function]} True while fetching the services list. */
  const [loading, setLoading] = useState(false);

  /** @type {[boolean, Function]} True while saving a new service. */
  const [adding, setAdding] = useState(false);

  /** @type {[string|null, Function]} ID of the service being deleted, or null. */
  const [deletingId, setDeletingId] = useState(null);

  /**
   * @type {[Object, Function]} Form field state for the new service.
   */
  const [formData, setFormData] = useState({
    serviceName: '',
    price: '',
    description: '',
  });

  /**
   * @section Effects
   */

  /**
   * Ensure the properties list is loaded so the property selector is populated.
   */
  useEffect(() => {
    if (!properties?.length) {
      dispatch(getHostProperties());
    }
  }, [dispatch, properties?.length]);

  /**
   * Re-fetch the services list whenever the host selects a different property.
   */
  useEffect(
    () => {
      /** Setup: Fetch services if a property is selected */
      if (selectedProperty) {
        fetchServices(selectedProperty);
      }

      /** Cleanup */
      return () => {
        // No cleanup needed
      };
    },
    /** Dependencies */
    [selectedProperty]
  );

  /**
   * @section Handlers
   */

  /**
   * Fetch concierge services for the given property ID.
   * 
   * @async
   * @function fetchServices
   * @param {string} propId - The property ID to fetch services for
   * @returns {Promise<void>}
   */
  const fetchServices = async (propId) => {
    if (!propId) {
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${BASE}/concierge/property/${propId}`);
      setServices(res.data.services || []);
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit the new service form and append the result to the local list.
   * 
   * @async
   * @function handleAddService
   * @param {import('react').FormEvent} e - Form submission event
   * @returns {Promise<void>}
   */
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!selectedProperty) {
      return;
    }
    try {
      setAdding(true);
      const res = await axios.post(
        `${BASE}/concierge/add-service`,
        {
          propertyId: selectedProperty,
          ...formData,
        },
        getAuthConfig()
      );
      if (res.data.success) {
        /** Append the new service to the list without a full re-fetch */
        setServices((prev) => {
          return [...prev, res.data.service];
        });
        /** Reset the form */
        setFormData({ serviceName: '', price: '', description: '' });
      }
    } catch {
      // error silently handled
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteService = async (serviceId) => {
    setDeletingId(serviceId);
    try {
      await axios.delete(`${BASE}/concierge/service/${serviceId}`, getAuthConfig());
      setServices((prev) => prev.filter((s) => s._id !== serviceId));
    } catch {
      // error silently handled
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * @section Render
   */

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
          <ConciergeBell size={26} className="text-[var(--bv-gold)]" /> Local
          Concierge Management
        </h1>
        <p className="text-[var(--bv-text-dim)] text-sm mt-1">
          Manage additional services like Airport Pickups, Home Chefs, or Laundry
          for your properties.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Add Service form (left column) ── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-6 flex items-center gap-2">
              <Plus size={16} /> Add New Service
            </h3>

            <form onSubmit={handleAddService} className="space-y-4">
              {/* Property selector */}
              <div>
                <label className="bv-label">Select Property</label>
                <select
                  className="bv-input"
                  value={selectedProperty}
                  onChange={(e) => {
                    return setSelectedProperty(e.target.value);
                  }}
                  required
                >
                  <option value="">Select a property</option>
                  {properties?.map((p) => {
                    return (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Service name */}
              <div>
                <label className="bv-label">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Airport Pickup"
                  className="bv-input"
                  value={formData.serviceName}
                  onChange={(e) => {
                    return setFormData({ ...formData, serviceName: e.target.value });
                  }}
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="bv-label">Price (PKR)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="bv-input"
                  value={formData.price}
                  onChange={(e) => {
                    return setFormData({ ...formData, price: e.target.value });
                  }}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="bv-label">Description</label>
                <textarea
                  placeholder="Briefly describe what's included..."
                  className="bv-input min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => {
                    return setFormData({
                      ...formData,
                      description: e.target.value,
                    });
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={adding || !selectedProperty}
                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
              >
                {adding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Save Service
              </button>
            </form>
          </div>

          {/* Info callout */}
          <div className="p-4 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex gap-3">
            <Info size={18} className="text-[var(--bv-gold)] flex-shrink-0" />
            <p className="text-xs text-[var(--bv-text-dim)] leading-relaxed">
              These services will be visible to guests with active bookings at
              your selected property. Guests can request them directly through
              the app.
            </p>
          </div>
        </div>

        {/* ── Active services list (right column) ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bv-card-static min-h-[400px]">
            <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
              <div>
                <h2 className="text-base font-bold text-[var(--bv-text)]">
                  Active Services
                </h2>
                <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                  Services currently offered for the selected property
                </p>
              </div>
            </div>

            <div className="p-5">
              {!selectedProperty ? (
                /* No property selected */
                <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--bv-text-dim)]">
                  <ShoppingBag size={48} className="opacity-10 mb-4" />
                  <p className="text-sm">
                    Please select a property to view its services.
                  </p>
                </div>
              ) : loading ? (
                /* Loading skeletons */
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => {
                    return <div key={i} className="bv-skeleton h-24 rounded-xl" />;
                  })}
                </div>
              ) : services.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--bv-text-dim)]">
                  <ConciergeBell size={48} className="opacity-10 mb-4" />
                  <p className="text-sm">
                    No concierge services added yet for this property.
                  </p>
                </div>
              ) : (
                /* Service cards grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {services.map((s) => {
                    return (
                      <div
                        key={s._id}
                        className="p-4 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)] flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-[var(--bv-text)]">
                              {s.serviceName}
                            </h4>
                            <span className="text-sm font-black text-[var(--bv-gold)]">
                              PKR {s.price}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--bv-text-dim)] line-clamp-2 mb-4">
                            {s.description || 'No description provided.'}
                          </p>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-[var(--bv-divider)]">
                          <button
                            onClick={() => handleDeleteService(s._id)}
                            disabled={deletingId === s._id}
                            className="p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition disabled:opacity-50"
                          >
                            {deletingId === s._id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostServices;
