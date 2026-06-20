/**
 * AdminBookings.jsx
 *
 * High-level component for the Admin Panel that manages all platform bookings.
 * Provides a comprehensive, filterable, and searchable list of every booking record.
 * Supports individual and bulk deletions with confirmation workflows.
 *
 * @module AdminBookings
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import {
  Eye, ImageOff, SearchCheck, Trash2, Loader2, RefreshCw, CalendarDays,
  CreditCard, Banknote, Moon, Search, CheckSquare, Square, AlertTriangle, X, AlertCircle
} from 'lucide-react';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

/* ── UTILITY FUNCTIONS ── */

/**
 * Returns Tailwind class string for booking status badge colouring.
 * Receives the derived display state (from stateOf), not the raw DB value.
 *
 * @param {'active'|'completed'|'cancelled'|'pending'} state
 * @returns {string} Tailwind CSS classes.
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
 * Returns Tailwind class string for payment status badge colouring.
 *
 * @param {string} s - The payment status.
 * @returns {string} Tailwind CSS classes.
 */
const payTone = (s) => {
  if (s === 'paid') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (s === 'pending') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  if (s === 'refunded') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  // failed
  return 'bg-red-500/10 text-red-400 border-red-500/20';
};

/**
 * Formats a date value to a human-readable locale string for Pakistan.
 *
 * @param {string|Date} d - The date to format.
 * @returns {string} Formatted date string.
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

/* ── SUB-COMPONENTS ── */

/**
 * Centered confirmation modal used for both single and bulk deletes.
 *
 * @param {Object} props - Component properties.
 * @returns {JSX.Element|null}
 */
const DeleteModal = ({ show, title, desc, count, onConfirm, onCancel, loading }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal card */}
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
            <h3 className="text-lg font-bold text-[var(--bv-text)]">{title}</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-1">{desc}</p>
            {count > 1 && (
              <p className="text-xs text-[var(--bv-danger)] font-semibold mt-2">
                {count} bookings will be deleted
              </p>
            )}
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

/* ── MAIN COMPONENT ── */

/**
 * AdminBookings Page Component.
 *
 * @returns {JSX.Element}
 */
const AdminBookings = () => {
  const nav = useNavigate();

  /* ── STATE MANAGEMENT ── */

  /** @type {[Array, Function]} Full list of bookings returned from the API */
  const [bookings, setBookings] = useState([]);

  /** @type {[boolean, Function]} Whether the initial fetch or a refresh is in progress */
  const [loading, setLoading] = useState(true);

  /** @type {[string, Function]} Active status/payment filter key */
  const [filter, setFilter] = useState('all');

  /** @type {[string, Function]} Free-text search query */
  const [search, setSearch] = useState('');

  /** @type {[Set, Function]} IDs of currently selected bookings for bulk actions */
  const [selected, setSelected] = useState(new Set());

  /**
   * @type {[object|null, Function]}
   * Controls which delete modal is open.
   * null = closed, { type: 'single', id } = single item, { type: 'bulk' } = bulk
   */
  const [deleteModal, setDeleteModal] = useState(null);

  /** @type {[boolean, Function]} Whether a delete request is in-flight */
  const [deleting, setDeleting] = useState(false);

  /** @type {[string|null, Function]} Page-level error message */
  const [pageError, setPageError] = useState(null);

  /* ── DATA FETCHING ── */

  /**
   * Fetch all bookings from the admin endpoint.
   */
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${BASE}/booking/admin/all-bookings`,
        getAuthConfig()
      );
      setBookings(res.data?.bookings || []);
    } catch (e) {
      setPageError(e.response?.data?.message || 'Failed to load bookings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Effect: Initial data load on component mount.
   */
  useEffect(
    () => {
      // Execute the initial fetch
      fetchBookings();
    },
    // Dependency array: Run once on mount
    []
  );

  /* ── LOGIC & HELPERS ── */

  const now = new Date();

  /**
   * Checks if a booking is active (upcoming confirmed or currently in-house staying).
   * @param {Object} b - Booking object.
   * @returns {boolean}
   */
  const isActive = (b) => {
    return (
      (b.bookingStatus === 'confirmed' || b.bookingStatus === 'staying') &&
      new Date(b.checkOut) > now
    );
  };

  /**
   * Checks if a booking is completed.
   * @param {Object} b - Booking object.
   * @returns {boolean}
   */
  const isCompleted = (b) => {
    return (
      b.bookingStatus === 'completed' ||
      ((b.bookingStatus === 'confirmed' || b.bookingStatus === 'staying') &&
        new Date(b.checkOut) <= now)
    );
  };

  /**
   * Checks if a booking is cancelled.
   * @param {Object} b - Booking object.
   * @returns {boolean}
   */
  const isCancelled = (b) => {
    return b.bookingStatus === 'cancel';
  };

  /**
   * Reduces a booking to a single display state used for both label and badge colour.
   * @param {Object} b - Booking object.
   * @returns {'cancelled'|'completed'|'active'|'pending'}
   */
  const stateOf = (b) => {
    if (isCancelled(b)) return 'cancelled';
    if (isCompleted(b)) return 'completed';
    if (isActive(b)) return 'active';
    return 'pending';
  };

  /**
   * Memoized derivation of the filtered bookings list.
   * Re-computes whenever source data, filter, or search text changes.
   */
  const filtered = useMemo(
    () => {
      // Start with the full set
      let list = bookings;

      // Apply status/payment filter
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
      } else if (filter === 'paid') {
        list = bookings.filter((b) => {
          return b.paymentStatus === 'paid';
        });
      } else if (filter === 'pending') {
        list = bookings.filter((b) => {
          return b.paymentStatus === 'pending';
        });
      }

      // Apply free-text search across multiple fields
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter((b) => {
          return (
            b.propertyId?.name?.toLowerCase().includes(q) ||
            b.userId?.username?.toLowerCase().includes(q) ||
            b.userId?.email?.toLowerCase().includes(q) ||
            b.propertyId?.city?.toLowerCase().includes(q)
          );
        });
      }

      return list;
    },
    // Dependencies: source data or filters
    [bookings, filter, search]
  );

  // Pre-computed counts for each filter tab badge
  const counts = {
    all: bookings.length,
    active: bookings.filter((b) => isActive(b)).length,
    completed: bookings.filter((b) => isCompleted(b)).length,
    cancelled: bookings.filter((b) => isCancelled(b)).length,
    paid: bookings.filter((b) => b.paymentStatus === 'paid').length,
    pending: bookings.filter((b) => b.paymentStatus === 'pending').length,
  };

  // Sum revenue from paid bookings, deducting any active refunds
  const totalRevenue = bookings
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((s, b) => {
      const refund = ['requested', 'approved', 'processing'].includes(b.refundStatus)
        ? (b.refundAmount || 0) : 0;
      return s + (b.totalPrice || 0) - refund;
    }, 0);

  // True when every visible (filtered) booking is selected
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => {
      return selected.has(b._id);
    });

  /* ── EVENT HANDLERS ── */

  /**
   * Toggle individual booking selection.
   * @param {string} id - Booking ID.
   */
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * Toggle select/deselect all currently visible bookings.
   */
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered bookings
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((b) => {
          return next.delete(b._id);
        });
        return next;
      });
    } else {
      // Select all filtered bookings
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((b) => {
          return next.add(b._id);
        });
        return next;
      });
    }
  };

  /**
   * Delete a single booking identified in the deleteModal state.
   */
  const handleDeleteSingle = async () => {
    if (!deleteModal || deleteModal.type !== 'single') {
      return;
    }

    setDeleting(true);
    try {
      await axios.delete(
        `${BASE}/booking/admin/${deleteModal.id}`,
        getAuthConfig()
      );
      setDeleteModal(null);

      // Remove from selection set if present
      selected.delete(deleteModal.id);
      setSelected(new Set(selected));

      fetchBookings();
    } catch (e) {
      setPageError(e.response?.data?.message || 'Failed to delete booking. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Delete every booking in the current selection set sequentially.
   */
  const handleDeleteBulk = async () => {
    if (!selected.size) {
      return;
    }

    setDeleting(true);
    let deleted = 0;
    let failed = 0;

    for (const id of selected) {
      try {
        await axios.delete(
          `${BASE}/booking/admin/${id}`,
          getAuthConfig()
        );
        deleted++;
      } catch {
        failed++;
      }
    }

    if (failed) {
      setPageError(`${deleted} booking(s) deleted. ${failed} could not be removed — they may be in use.`);
    }

    setSelected(new Set());
    setDeleteModal(null);
    setDeleting(false);
    fetchBookings();
  };

  /* ── RENDER ── */

  return (
    <div className="space-y-6">
      {pageError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
          <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Confirmation modal for single and bulk deletes */}
      <DeleteModal
        show={!!deleteModal}
        title={
          deleteModal?.type === 'bulk'
            ? `Delete ${selected.size} bookings?`
            : 'Delete this booking?'
        }
        desc={
          deleteModal?.type === 'bulk'
            ? 'All selected bookings will be permanently removed from the platform. This action cannot be undone.'
            : 'This booking record will be permanently deleted. Guest and host records may be affected.'
        }
        count={deleteModal?.type === 'bulk' ? selected.size : 1}
        onConfirm={
          deleteModal?.type === 'bulk'
            ? handleDeleteBulk
            : handleDeleteSingle
        }
        onCancel={() => {
          return setDeleteModal(null);
        }}
        loading={deleting}
      />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            Platform <span className="text-[var(--bv-gold)]">Bookings</span>
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Manage all bookings across the platform
          </p>
        </div>
        <button
          onClick={fetchBookings}
          disabled={loading}
          className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'text-[var(--bv-text)]' },
          { label: 'Active', value: counts.active, color: 'text-emerald-400' },
          { label: 'Completed', value: counts.completed, color: 'text-[var(--bv-gold)]' },
          { label: 'Cancelled', value: counts.cancelled, color: 'text-red-400' },
          { label: 'Paid', value: counts.paid, color: 'text-emerald-400' },
          { label: 'Unpaid', value: counts.pending, color: 'text-amber-400' },
          { label: 'Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: 'text-[var(--bv-gold)]' },
        ].map(({ label, value, color }) => {
          return (
            <div key={label} className="bv-card p-3 text-center">
              <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                {label}
              </p>
              <p className={`text-lg font-black ${color} mt-0.5`}>{value}</p>
            </div>
          );
        })}
      </div>

      {/* Filter tabs and search input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Done' },
            { key: 'cancelled', label: 'Cancelled' },
            { key: 'paid', label: 'Paid' },
            { key: 'pending', label: 'Unpaid' },
          ].map(({ key, label }) => {
            return (
              <button
                key={key}
                onClick={() => {
                  return setFilter(key);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  filter === key
                    ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                    : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
                }`}
              >
                {label} ({counts[key]})
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
            placeholder="Search guest, property, city..."
            className="bv-input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Select-all / bulk-delete toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
        >
          {allFilteredSelected ? (
            <CheckSquare size={16} className="text-[var(--bv-gold)]" />
          ) : (
            <Square size={16} />
          )}
          {allFilteredSelected ? 'Deselect all' : 'Select all'}
          {filtered.length > 0 && ` (${filtered.length})`}
        </button>

        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <span className="text-[10px] text-[var(--bv-text-dim)]">
              {selected.size} selected
            </span>
          )}
          {selected.size > 0 && (
            <button
              onClick={() => {
                return setDeleteModal({ type: 'bulk' });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--bv-danger)] flex items-center gap-1.5 hover:opacity-90 transition"
            >
              <Trash2 size={12} />
              Delete ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Bookings list — skeleton, empty state, or cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => {
            return (
              <div key={i} className="bv-skeleton h-36 rounded-2xl" />
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bv-card-static p-12 text-center">
          <SearchCheck size={36} className="mx-auto text-[var(--bv-text-dim)] opacity-40 mb-3" />
          <p className="text-lg font-bold text-[var(--bv-text)]">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const isSelected = selected.has(b._id);

            return (
              <div
                key={b._id}
                className={`bv-card overflow-hidden transition-all ${
                  isSelected
                    ? 'ring-1 ring-[var(--bv-gold)]/30 bg-[var(--bv-gold-glow)]'
                    : ''
                }`}
              >
                <div className="flex flex-col md:flex-row">
                  {/* Property thumbnail with selection checkbox overlay */}
                  <div className="md:w-44 h-32 md:h-auto flex-shrink-0 relative bg-[var(--bv-surface)]">
                    {b.propertyId?.images?.[0]?.url ? (
                      <img
                        src={b.propertyId.images[0].url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={20} className="text-[var(--bv-text-dim)]" />
                      </div>
                    )}

                    {/* Checkbox button overlaid on the image */}
                    <button
                      onClick={() => {
                        return toggleSelect(b._id);
                      }}
                      className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center transition hover:bg-black/70"
                    >
                      {isSelected ? (
                        <CheckSquare size={15} className="text-[var(--bv-gold)]" />
                      ) : (
                        <Square size={15} className="text-white/70" />
                      )}
                    </button>
                  </div>

                  {/* Main booking information */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--bv-text)] truncate">
                          {b.propertyId?.name || 'Property'}
                        </h3>
                        <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                          Guest: {b.userId?.username || '—'} · Host: {b.propertyId?.hostBy?.username || '—'} · {b.propertyId?.city}
                        </p>
                      </div>
                      <p className="text-lg font-black text-[var(--bv-gold)] flex-shrink-0">
                        PKR {b.totalPrice?.toLocaleString()}
                      </p>
                    </div>

                    {/* Status and payment badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border ${statusTone(stateOf(b))}`}>
                        {stateOf(b)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border ${payTone(b.paymentStatus)}`}>
                        {b.paymentStatus}
                      </span>
                      {b.refundStatus && b.refundStatus !== 'none' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Refund: {b.refundStatus}
                        </span>
                      )}
                    </div>

                    {/* Dates, nights, and payment method */}
                    <div className="flex flex-wrap gap-3 text-[11px] text-[var(--bv-text-dim)] mb-3">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={10} className="text-[var(--bv-gold)]" />
                        {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Moon size={10} className="text-[var(--bv-gold)]" />
                        {b.stayDays}n
                      </span>
                      <span className="flex items-center gap-1">
                        {b.paymentMethod === 'arrival' ? (
                          <Banknote size={10} className="text-[var(--bv-gold)]" />
                        ) : (
                          <CreditCard size={10} className="text-[var(--bv-gold)]" />
                        )}
                        {b.paymentMethod === 'arrival' ? 'Cash' : 'Card'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          return nav(`/${P}/bookings/${b._id}`);
                        }}
                        className="bv-btn-outline text-[11px] px-3 py-1.5 flex items-center gap-1"
                      >
                        <Eye size={11} /> View
                      </button>
                      <button
                        onClick={() => {
                          return setDeleteModal({ type: 'single', id: b._id });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
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

export default AdminBookings;
