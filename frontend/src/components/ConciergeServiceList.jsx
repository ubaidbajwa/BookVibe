/**
 * @file ConciergeServiceList.jsx
 * @description Modal overlay that lists all concierge services available for a given property.
 * Guests can browse services and add them to their stay with a single click.
 * The component fetches the service catalogue from the API and posts an order
 * request when the guest confirms. The host is notified in real-time via the backend.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { ConciergeBell, Plus, Loader2, Info, X } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @component ConciergeServiceList
 * @description Component for displaying and ordering concierge services.
 * @param {Object} props - Component props.
 * @param {string} props.bookingId - ID of the active booking.
 * @param {string} props.propertyId - ID of the property.
 * @param {Function} props.onClose - Callback to close the modal.
 * @returns {JSX.Element} The ConciergeServiceList component.
 */
const ConciergeServiceList = ({ bookingId, propertyId, onClose }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description List of concierge service objects fetched for this property.
   */
  const [services, setServices] = useState([]);

  /**
   * @description Loading state for fetching the service catalogue.
   */
  const [loading, setLoading] = useState(true);

  /**
   * @description Holds the _id of the service currently being ordered.
   */
  const [ordering, setOrdering] = useState(null);

  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Fetch the concierge service catalogue for this property on mount or propertyId change.
   */
  useEffect(
    () => {
      const fetchServices = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE}/concierge/property/${propertyId}`);
          setServices(res.data.services || []);
        } catch (error) {
          console.error('Failed to fetch concierge services:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchServices();

      // Cleanup function if needed
      return () => {
        // No cleanup necessary for this effect
      };
    },
    // Dependencies
    [propertyId]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   HANDLERS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Place an order for a single concierge service.
   * @param {string} serviceId - The ID of the service to order.
   */
  const handleOrder = async (serviceId) => {
    try {
      setOrdering(serviceId);

      const res = await axios.post(
        `${BASE}/concierge/order-service`,
        {
          bookingId,
          serviceId,
          quantity: 1,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        if (onClose) {
          onClose();
        }
      }
    } catch {
      // error silently handled
    } finally {
      setOrdering(null);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent backdrop — clicking it closes the modal */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          onClose();
        }}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-2xl bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] flex flex-col max-h-[80vh] bv-animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--bv-divider)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bv-gold-glow)] flex items-center justify-center border border-[var(--bv-gold-border)]">
              <ConciergeBell size={20} className="text-[var(--bv-gold)]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--bv-text)]">Local Concierge</h3>
              <p className="text-xs text-[var(--bv-text-dim)]">Personalized services for your stay</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-xl text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading skeleton state */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => {
                return <div key={i} className="bv-skeleton h-24 rounded-xl" />;
              })}
            </div>
          ) : services.length === 0 ? (
            /* Empty state — no services configured for this property */
            <div className="text-center py-12">
              <ConciergeBell size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20" />
              <h4 className="text-base font-bold text-[var(--bv-text-muted)]">No services available</h4>
              <p className="text-sm text-[var(--bv-text-dim)] mt-1">
                This property doesn&apos;t offer additional concierge services yet.
              </p>
            </div>
          ) : (
            /* Service grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((s) => {
                return (
                  <div
                    key={s._id}
                    className="p-4 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)] flex flex-col justify-between hover:border-[var(--bv-gold-border)] transition group"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-[var(--bv-text)] group-hover:text-[var(--bv-gold)] transition">
                          {s.serviceName}
                        </h4>
                        <span className="text-sm font-black text-[var(--bv-gold)]">PKR {s.price}</span>
                      </div>
                      <p className="text-xs text-[var(--bv-text-dim)] line-clamp-3 mb-4">
                        {s.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Add to stay button — disabled while an order is in-flight */}
                    <button
                      onClick={() => {
                        handleOrder(s._id);
                      }}
                      disabled={ordering === s._id}
                      className="w-full bv-btn-gold py-2 text-xs flex items-center justify-center gap-2"
                    >
                      {ordering === s._id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      Add to Stay
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment disclaimer at the bottom of the content area */}
          <div className="mt-6 p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] flex gap-3">
            <Info size={16} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--bv-text-dim)] leading-relaxed">
              Requested services will be added to your booking. Payment is typically handled directly with the host
              unless specified otherwise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConciergeServiceList;
