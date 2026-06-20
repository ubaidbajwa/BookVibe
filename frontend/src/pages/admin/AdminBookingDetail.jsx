/**
 * @file AdminBookingDetail.jsx
 * @description Admin view of a single booking record.
 * 
 * Reads the booking ID from the URL parameter, fetches the full booking document,
 * then delegates rendering to the shared BookingDetailPanel component.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import BookingDetailPanel from '../../components/booking/BookingDetailPanel';
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

/**
 * @section Constants
 */

/** @type {string} Base URL for API requests. */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/** @type {string} Admin path segment for routing. */
const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

/**
 * @component AdminBookingDetail
 * @description Admin-facing detailed view for platform bookings.
 * 
 * @returns {JSX.Element} The rendered AdminBookingDetail component.
 */
const AdminBookingDetail = () => {
  /**
   * @section Hooks & Context
   */

  /** @type {Object} URL parameters containing the booking ID. */
  const { id } = useParams();

  /** @type {Function} Navigation function for programmatic routing. */
  const nav = useNavigate();

  /**
   * @section State Management
   */

  /** @type {[Object|null, Function]} The fetched booking document, or null while loading. */
  const [booking, setBooking] = useState(null);

  /** @type {[boolean, Function]} Whether the fetch request is in-flight. */
  const [loading, setLoading] = useState(true);

  /** @type {[string|null, Function]} Load error message. */
  const [loadError, setLoadError] = useState(null);

  /** @type {[boolean, Function]} Whether the delete confirmation modal is open. */
  const [showDelete, setShowDelete] = useState(false);

  /** @type {[boolean, Function]} Whether a delete request is in-flight. */
  const [deleting, setDeleting] = useState(false);

  /**
   * @section Effects
   */

  /**
   * Fetch the booking whenever the route param `id` changes.
   */
  useEffect(
    () => {
      /** Setup: Async function to load booking data */
      const load = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE}/booking/${id}`, getAuthConfig());
          setBooking(res.data?.booking || null);
        } catch (e) {
          setLoadError(e.response?.data?.message || 'Failed to load booking detail. Check your connection and try again.');
          setBooking(null);
        } finally {
          setLoading(false);
        }
      };

      if (id) {
        load();
      }

      /** Cleanup */
      return () => {
        // No cleanup needed
      };
    },
    /** Dependencies */
    [id]
  );

  /**
   * Hard-delete the booking, then navigate back to the list.
   */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${BASE}/booking/admin/${id}`, getAuthConfig());
      nav(`/${P}/bookings`);
    } catch (e) {
      setLoadError(e.response?.data?.message || 'Failed to delete booking.');
      setShowDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * @section Render
   */

  return (
    <div>
      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative w-full max-w-md bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] p-6 bv-animate-in">
            <button onClick={() => setShowDelete(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition">
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-[var(--bv-danger)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--bv-text)]">Delete this booking?</h3>
                <p className="text-sm text-[var(--bv-text-muted)] mt-1">
                  This booking record will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)]">{loadError}</p>
        </div>
      )}

      {/* Delete button — only shown once the booking has loaded */}
      {!loading && booking && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 transition"
          >
            <Trash2 size={14} /> Delete Booking
          </button>
        </div>
      )}

      <BookingDetailPanel
        booking={booking}
        loading={loading}
        onBack={() => nav(`/${P}/bookings`)}
        backLabel="Back to Bookings"
        title="Admin Booking Detail"
        subtitle="Platform-level reservation record"
      />
    </div>
  );
};

export default AdminBookingDetail;
