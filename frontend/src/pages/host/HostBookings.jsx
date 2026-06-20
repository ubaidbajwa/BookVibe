/**
 * @file HostBookings.jsx
 * @description List view for all bookings associated with a host's properties.
 * Features include filtering by status, search functionality, and booking record management.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getHostBookings, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import axios from 'axios';
import {
  Eye,
  ImageOff,
  SearchCheck,
  Trash2,
  Loader2,
  RefreshCw,
  CalendarDays,
  CreditCard,
  Banknote,
  Moon,
  Search,
  AlertTriangle,
  X,
} from 'lucide-react';

/**
 * @section Constants
 */

/** @type {string} Base URL for API requests. */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @section Utility Helpers
 */

/**
 * Returns a Tailwind class string for a booking-status badge colour.
 *
 * @param {'cancelled'|'completed'|'active'|'pending'} state - Derived display state
 * @returns {string} Tailwind classes
 */
const statusTone = (state) => {
  switch (state) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'completed':
      return 'bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] border-[var(--bv-gold-border)]';
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      // cancelled
      return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
};

/**
 * Returns a Tailwind class string for a payment-status badge colour.
 * 
 * @param {string} s - Payment status string
 * @returns {string} Tailwind classes
 */
const payTone = (s) => {
  if (s === 'paid') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (s === 'pending') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-red-500/10 text-red-400 border-red-500/20';
};

/**
 * Format an ISO date string to a locale-aware short date string.
 * 
 * @param {string} d - Date string
 * @returns {string} Formatted date
 */
const fmtDate = (d) => {
  if (!d) {
    return '—';
  }
  return new Date(d).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * @section Sub-components
 */

/**
 * DeleteModal — a small overlay dialog for confirming booking deletion.
 * 
 * @component DeleteModal
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether to show the modal
 * @param {Function} props.onCancel - Cancel handler
 * @param {Function} props.onConfirm - Confirm handler
 * @param {boolean} props.loading - Loading state
 * @returns {JSX.Element|null} The rendered DeleteModal component.
 */
const DeleteModal = ({ show, onCancel, onConfirm, loading }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] p-6 bv-animate-in">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} className="text-[var(--bv-danger)]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--bv-text)]">
              Delete this booking?
            </h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-1">
              This booking record will be removed from your host panel. Guest
              history will stay intact.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {loading ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * @component HostBookings
 * @description Main dashboard for hosts to view and manage their property bookings.
 * 
 * @returns {JSX.Element} The rendered HostBookings component.
 */
const HostBookings = () => {
  /**
   * @section Hooks & Context
   */

  /** @type {Function} Redux dispatch function. */
  const dispatch = useDispatch();

  /** @type {Function} Navigation function for programmatic routing. */
  const nav = useNavigate();

  /** @type {Object} Redux state for accommodations. */
  const { hostBookings, loading, error } = useSelector((s) => {
    return s.accommodations;
  });

  /**
   * @section State Management
   */

  /** 
   * @type {[string, Function]} Currently active filter tab key ('all', 'active', 'completed', 'cancelled').
   */
  const [filter, setFilter] = useState('all');

  /** 
   * @type {[string, Function]} Text entered in the search box.
   */
  const [search, setSearch] = useState('');

  /** 
   * @type {[string|null, Function]} ID of the booking whose delete modal is open, or null.
   */
  const [deleteModal, setDeleteModal] = useState(null);

  /** 
   * @type {[string|null, Function]} ID of the booking currently being deleted, or null.
   */
  const [deleting, setDeleting] = useState(null);

  /**
   * @section Effects
   */

  /**
   * Load host bookings on mount.
   */
  useEffect(
    () => {
      /** Setup: Dispatch fetch for host bookings */
      dispatch(getHostBookings());

      /** Cleanup */
      return () => {
        // No cleanup needed
      };
    },
    /** Dependencies */
    [dispatch]
  );

  /**
   * Handle and display Redux errors.
   */
  useEffect(
    () => {
      /** Setup: Display toast and reset state on error */
      if (error) {
        dispatch(resetAccommodationState());
      }

      /** Cleanup */
      return () => {
        // No cleanup needed
      };
    },
    /** Dependencies */
    [error, dispatch]
  );

  /**
   * @section Memoised Data
   */

  /** 
   * Memoised base list of bookings.
   * @type {Array}
   */
  const bookings = useMemo(
    () => {
      return hostBookings || [];
    },
    [hostBookings]
  );

  /** 
   * Consistent reference to current time.
   * @type {Date}
   */
  const now = new Date();

  /**
   * @section Predicates
   */

  /** 
   * Check if booking is active.
   * @param {Object} b - Booking object
   * @returns {boolean}
   */
  const isActive = (b) => {
    // Upcoming (confirmed) or currently in-house (staying), stay not yet ended.
    return (
      (b.bookingStatus === 'confirmed' || b.bookingStatus === 'staying') &&
      new Date(b.checkOut) > now
    );
  };

  /**
   * Check if booking is completed.
   * @param {Object} b - Booking object
   * @returns {boolean}
   */
  const isCompleted = (b) => {
    // Cron flips finished stays to 'completed'; also treat a not-yet-transitioned
    // confirmed/staying booking whose check-out has passed as completed.
    return (
      b.bookingStatus === 'completed' ||
      ((b.bookingStatus === 'confirmed' || b.bookingStatus === 'staying') &&
        new Date(b.checkOut) <= now)
    );
  };

  /**
   * Check if booking is cancelled.
   * @param {Object} b - Booking object
   * @returns {boolean}
   */
  const isCancelled = (b) => {
    return b.bookingStatus === 'cancel';
  };

  /**
   * Reduce a booking to a single display state used for both its label and
   * badge colour, so the two never disagree.
   * @param {Object} b - Booking object
   * @returns {'cancelled'|'completed'|'active'|'pending'}
   */
  const stateOf = (b) => {
    if (isCancelled(b)) {
      return 'cancelled';
    }
    if (isCompleted(b)) {
      return 'completed';
    }
    if (isActive(b)) {
      return 'active';
    }
    return 'pending';
  };

  /** 
   * Check if booking can be deleted.
   * @param {Object} b - Booking object
   * @returns {boolean}
   */
  const canDelete = (b) => {
    return isCancelled(b) || isCompleted(b);
  };

  /**
   * @section Filter Logic
   */

  /** 
   * Memoised filtered list based on tabs and search.
   * @type {Array}
   */
  const filtered = useMemo(
    () => {
      let list = bookings;

      /** Apply tab filter */
      if (filter === 'active') {
        list = bookings.filter((b) => {
          return isActive(b);
        });
      } else if (filter === 'completed') {
        list = bookings.filter((b) => {
          return isCompleted(b);
        });
      } else if (filter === 'cancelled') {
        list = bookings.filter((b) => {
          return isCancelled(b);
        });
      }

      /** Apply free-text search */
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter((b) => {
          return (
            b.propertyId?.name?.toLowerCase().includes(q) ||
            b.userId?.username?.toLowerCase().includes(q) ||
            b.userId?.email?.toLowerCase().includes(q)
          );
        });
      }

      return list;
    },
    /** Dependencies */
    [bookings, filter, search]
  );

  /** 
   * Counts for filter tabs.
   * @type {Object}
   */
  const counts = {
    all: bookings.length,
    active: bookings.filter((b) => {
      return isActive(b);
    }).length,
    completed: bookings.filter((b) => {
      return isCompleted(b);
    }).length,
    cancelled: bookings.filter((b) => {
      return isCancelled(b);
    }).length,
  };

  /** 
   * Total revenue calculation.
   * @type {number}
   */
  const totalRevenue = bookings
    .filter((b) => {
      return b.paymentStatus === 'paid';
    })
    .reduce((s, b) => {
      return s + (b.totalPrice || 0);
    }, 0);

  /**
   * @section Handlers
   */

  /**
   * Permanently delete a booking record.
   * 
   * @async
   * @function handleDelete
   * @param {string} id - Booking ID
   * @returns {Promise<void>}
   */
  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.delete(`${BASE}/booking/host/${id}`, { withCredentials: true });
      setDeleteModal(null);
      dispatch(getHostBookings());
    } catch {
      // error silently handled
    } finally {
      setDeleting(null);
    }
  };

  /**
   * @section Render
   */

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      <DeleteModal
        show={!!deleteModal}
        onConfirm={() => {
          if (deleteModal) {
            handleDelete(deleteModal);
          }
        }}
        onCancel={() => {
          return setDeleteModal(null);
        }}
        loading={deleting === deleteModal}
      />

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            All <span className="text-[var(--bv-gold)]">Bookings</span>
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Manage reservations for your properties
          </p>
        </div>
        <button
          onClick={() => {
            return dispatch(getHostBookings());
          }}
          disabled={loading}
          className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary stat strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'text-[var(--bv-text)]' },
          { label: 'Active', value: counts.active, color: 'text-emerald-400' },
          { label: 'Completed', value: counts.completed, color: 'text-[var(--bv-gold)]' },
          { label: 'Cancelled', value: counts.cancelled, color: 'text-red-400' },
          {
            label: 'Revenue',
            value: `PKR ${totalRevenue.toLocaleString()}`,
            color: 'text-[var(--bv-gold)]',
          },
        ].map(({ label, value, color }) => {
          return (
            <div key={label} className="bv-card p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                {label}
              </p>
              <p className={`text-xl font-black ${color} mt-1`}>{value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Filter tabs + search box ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(({ key, label }) => {
            return (
              <button
                key={key}
                onClick={() => {
                  return setFilter(key);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  filter === key
                    ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                    : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
                }`}
              >
                {label}
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    filter === key ? 'bg-white/20' : 'bg-[var(--bv-border)]'
                  }`}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bv-text-dim)]"
          />
          <input
            value={search}
            onChange={(e) => {
              return setSearch(e.target.value);
            }}
            placeholder="Search guest, property..."
            className="bv-input pl-9 text-sm"
          />
        </div>
      </div>

      {/* ── Booking list ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => {
            return (
              <div key={i} className="bv-skeleton h-36 rounded-2xl" />
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bv-card-static p-12 text-center">
          <SearchCheck
            size={36}
            className="mx-auto text-[var(--bv-text-dim)] opacity-40 mb-3"
          />
          <p className="text-lg font-bold text-[var(--bv-text)]">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            return (
              <div key={b._id} className="bv-card overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Property thumbnail */}
                  <div className="md:w-44 h-32 md:h-auto flex-shrink-0 relative bg-[var(--bv-surface)]">
                    {b.propertyId?.images?.[0]?.url ? (
                      <img
                        src={b.propertyId.images[0].url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff
                          size={20}
                          className="text-[var(--bv-text-dim)]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Booking details */}
                  <div className="flex-1 p-5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--bv-text)] truncate">
                          {b.propertyId?.name || 'Property'}
                        </h3>
                        <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                          Guest: {b.userId?.username || '—'} ·{' '}
                          {b.userId?.email || ''}
                        </p>
                      </div>
                      <p className="text-lg font-black text-[var(--bv-gold)] flex-shrink-0">
                        PKR {b.totalPrice?.toLocaleString()}
                      </p>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${statusTone(
                          stateOf(b)
                        )}`}
                      >
                        {stateOf(b)}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${payTone(
                          b.paymentStatus
                        )}`}
                      >
                        {b.paymentStatus}
                      </span>
                      {b.refundStatus && b.refundStatus !== 'none' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Refund: {b.refundStatus}
                        </span>
                      )}
                    </div>

                    {/* Date / night / payment-method row */}
                    <div className="flex flex-wrap gap-4 text-xs text-[var(--bv-text-dim)] mb-3">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays
                          size={11}
                          className="text-[var(--bv-gold)]"
                        />
                        {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Moon size={11} className="text-[var(--bv-gold)]" />
                        {b.stayDays} night{b.stayDays > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {b.paymentMethod === 'arrival' ? (
                          <Banknote
                            size={11}
                            className="text-[var(--bv-gold)]"
                          />
                        ) : (
                          <CreditCard
                            size={11}
                            className="text-[var(--bv-gold)]"
                          />
                        )}
                        {b.paymentMethod === 'arrival' ? 'Cash' : 'Card'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={() => {
                          return nav(`/host/bookings/${b._id}`);
                        }}
                        className="bv-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
                      >
                        <Eye size={12} /> View Details
                      </button>

                      {/* Confirm Cash Payment Button for 'arrival' method */}
                      {b.paymentMethod === 'arrival' && b.paymentStatus === 'pending' && b.bookingStatus !== 'cancel' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Confirm that you have received cash payment for this booking?')) {
                              try {
                                const res = await axios.patch(`${BASE}/booking/host/${b._id}/confirm-cash`, {}, { withCredentials: true });
                                if (res.data.success) {
                                  dispatch(getHostBookings());
                                }
                              } catch {
                                // error silently handled
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-black bg-[var(--bv-gold)] hover:opacity-90 transition shadow-sm"
                        >
                          <Banknote size={12} /> Confirm Cash
                        </button>
                      )}

                      {canDelete(b) && (
                        <button
                          onClick={() => {
                            return setDeleteModal(b._id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HostBookings;
