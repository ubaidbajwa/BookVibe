/**
 * @file MyBookings.jsx
 * @description Lists all bookings for the authenticated guest. Supports four filter tabs 
 * (all / active / completed / cancelled), cancel-with-refund preview, 
 * booking deletion, review prompts, concierge service access, and complaint filing.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getMyBookings, resetBookingState } from '../redux/slices/bookingSlice';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';
import {
  CalendarDays, MapPin, Star, CreditCard, Banknote, CheckCircle, XCircle,
  Clock, Loader2, AlertTriangle, BookOpen, MessageSquare,
  ShieldAlert, Eye, RefreshCw, Moon, Trash2, Undo2, X, ConciergeBell
} from 'lucide-react';
import ConciergeServiceList from '../components/ConciergeServiceList';

/**
 * Base API URL derived from environment variables.
 * @constant {string}
 */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Formats a date string to a human-readable Pakistani locale string.
 * 
 * @param {string} d - ISO date string.
 * @returns {string} Formatted date string.
 */
const formatDate = (d) => {
  if (!d) {
    return '—';
  }
  return new Date(d).toLocaleDateString('en-PK', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

/**
 * Tailwind class maps keyed by booking / payment / refund status strings.
 * @constant {Object}
 */
const statusColors = {
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  cancel: 'bg-red-500/10 text-red-600 border-red-500/20',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
  none: 'bg-[var(--bv-surface)] text-[var(--bv-text-dim)] border-[var(--bv-border)]',
  requested: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

/**
 * BookingActionModal Sub-component
 * 
 * Confirmation dialog for both 'cancel' (with optional refund preview)
 * and 'delete' actions on a booking.
 * 
 * @param {Object} props - Component props.
 * @returns {JSX.Element|null}
 */
const BookingActionModal = ({
  action,
  booking,
  cancelReason,
  setCancelReason,
  cancelling,
  deleting,
  onCancelConfirm,
  onDeleteConfirm,
  onClose,
}) => {
  if (!action || !booking) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={() => {
          return onClose();
        }} 
      />
      <div className="relative w-full max-w-md bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] p-6 bv-animate-in">
        <button
          onClick={() => {
            return onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition"
        >
          <X size={16} />
        </button>

        {action.type === 'cancel' ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-[var(--bv-danger)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--bv-text)]">Cancel this booking?</h3>
                <p className="text-sm text-[var(--bv-text-muted)] mt-1">Review the refund outcome before you confirm.</p>
              </div>
            </div>

            {/* Refund preview section */}
            {action.refundInfo && booking.paymentStatus === 'paid' && (
              <div className={`p-3 rounded-xl ${action.refundInfo.eligible ? 'bg-emerald-500/5 border border-emerald-500/15' : 'bg-red-500/5 border border-red-500/15'}`}>
                <p className="text-xs font-bold text-[var(--bv-text)]">
                  {action.refundInfo.eligible ? (
                    `Refund: PKR ${action.refundInfo.refundAmount?.toLocaleString()} (${action.refundInfo.refundPercent}%)`
                  ) : (
                    'No refund available'
                  )}
                </p>
                <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">{action.refundInfo.reason}</p>
                {action.refundInfo.cancellationFee > 0 && (
                  <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">
                    Cancellation fee: PKR {action.refundInfo.cancellationFee?.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {booking.paymentStatus !== 'paid' && (
              <p className="text-xs text-[var(--bv-text-dim)]">
                No payment was made, so this booking will be cancelled without any refund.
              </p>
            )}

            <div>
              <label className="text-[10px] font-bold text-[var(--bv-text-dim)] uppercase">Reason (Compulsory) *</label>
              <input
                value={cancelReason}
                onChange={(e) => {
                  return setCancelReason(e.target.value);
                }}
                placeholder="Required: Please explain why you are cancelling..."
                className="bv-input mt-1 text-sm border-[var(--bv-border-gold)]"
                required
              />
              {action.refundInfo?.eligible && (
                <p className="text-[10px] text-[var(--bv-gold)] mt-2 italic font-semibold">
                  Note: Your refund request will be sent to the host. Please wait 24 hours for host approval before the refund is processed.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  if (!cancelReason.trim()) {
                    return;
                  }
                  return onCancelConfirm();
                }}
                disabled={cancelling === booking._id}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling === booking._id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                {cancelling === booking._id ? (
                  'Processing...'
                ) : (
                  action.refundInfo?.eligible ? 'Cancel & Request Refund' : 'Yes, cancel'
                )}
              </button>
              <button
                onClick={() => {
                  return onClose();
                }}
                disabled={cancelling === booking._id}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
              >
                Keep booking
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-[var(--bv-danger)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--bv-text)]">Delete from history?</h3>
                <p className="text-sm text-[var(--bv-text-muted)] mt-1">This booking will be permanently removed from your history.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  return onDeleteConfirm();
                }}
                disabled={deleting === booking._id}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting === booking._id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deleting === booking._id ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => {
                  return onClose();
                }}
                disabled={deleting === booking._id}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * MyBookings Component
 * @returns {JSX.Element} The rendered component.
 */
const MyBookings = () => {
  // --- Hooks & Redux ---

  /**
   * Navigation hook for programmatic routing.
   */
  const nav = useNavigate();

  /**
   * Redux dispatch hook.
   */
  const dispatch = useDispatch();

  /**
   * Accesses booking state from Redux store.
   */
  const { myBookings, loading, error } = useSelector((s) => {
    return s.booking;
  });

  // --- Component State ---

  /**
   * State to track which booking is currently being cancelled.
   */
  const [cancelling, setCancelling] = useState(null);

  /**
   * State to track which booking is currently being deleted.
   */
  const [deleting, setDeleting] = useState(null);

  /**
   * State for the current confirmation action modal details.
   */
  const [confirmAction, setConfirmAction] = useState(null);

  /**
   * State to track loading status of refund previews.
   */
  const [loadingPreview, setLoadingPreview] = useState(null);

  /**
   * State for the user-provided cancellation reason.
   */
  const [cancelReason, setCancelReason] = useState('');

  /**
   * State to store review eligibility status for each booking.
   */
  const [reviewStatus, setReviewStatus] = useState({});

  /**
   * State for current booking filter tab.
   */
  const [filter, setFilter] = useState('all');

  /**
   * State to control visibility of the concierge services panel.
   */
  const [showServices, setShowServices] = useState(null);

  // --- Effects ---

  /**
   * Effect Hook: Fetches the guest's bookings on component mount.
   */
  useEffect(() => {
    // Setup
    dispatch(getMyBookings());

    // Dependencies
  }, [dispatch]);

  /**
   * Effect Hook: Handles displaying errors from the booking slice.
   */
  useEffect(() => {
    // Setup
    if (error) {
      dispatch(resetBookingState());
    }

    // Dependencies
  }, [error, dispatch]);

  /**
   * Effect Hook: Checks review eligibility for each booking whenever the list updates.
   */
  useEffect(() => {
    // Setup
    if (!myBookings || myBookings.length === 0) {
      return;
    }

    const check = async () => {
      const results = await Promise.all(
        myBookings.map((b) =>
          axios.get(`${BASE}/reviews/can-review/${b._id}`, getAuthConfig())
            .then((r) => ({ id: b._id, data: r.data }))
            .catch(() => ({ id: b._id, data: { canReview: false } }))
        )
      );
      const s = {};
      results.forEach(({ id, data }) => { s[id] = data; });
      setReviewStatus(s);
    };

    check();

    // Dependencies
  }, [myBookings]);

  // --- Logic Handlers ---

  /**
   * Loads a refund preview for a specific booking.
   * @param {string} id - Booking ID.
   * @async
   */
  const handleCancelPreview = async (id) => {
    setLoadingPreview(id);
    try {
      const res = await axios.get(`${BASE}/booking/${id}/cancel-preview`, getAuthConfig());
      if (res.data.success) {
        setConfirmAction({ id, type: 'cancel', refundInfo: res.data.refundInfo });
        setCancelReason('');
      }
    } catch {
      // error silently handled
    } finally {
      setLoadingPreview(null);
    }
  };

  /**
   * Submits a booking cancellation.
   * @param {string} id - Booking ID.
   * @async
   */
  const handleCancelConfirm = async (id) => {
    setCancelling(id);
    try {
      const res = await axios.post(
        `${BASE}/booking/${id}/cancel`,
        { reason: cancelReason || 'Guest cancelled' },
        getAuthConfig()
      );
      if (res.data.success) {
        setConfirmAction(null);
        setCancelReason('');
        dispatch(getMyBookings());
      }
    } catch {
      // error silently handled
    } finally {
      setCancelling(null);
    }
  };

  /**
   * Permanently deletes a booking from history.
   * @param {string} id - Booking ID.
   * @async
   */
  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.delete(`${BASE}/booking/${id}`, getAuthConfig());
      setConfirmAction(null);
      dispatch(getMyBookings());
    } catch {
      // error silently handled
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Checks if a checkout date has passed.
   * @param {string} d - Date string.
   * @returns {boolean}
   */
  const isCheckoutPassed = (d) => {
    return new Date(d) < new Date();
  };

  // --- Memoized Derived Data ---

  /**
   * The booking currently being displayed in the modal.
   */
  const activeModalBooking = confirmAction ? (
    myBookings?.find((b) => {
      return b._id === confirmAction.id;
    })
  ) : null;

  /**
   * Filtered list of bookings based on the active tab.
   */
  const filtered = (() => {
    if (filter === 'all') {
      return myBookings;
    }
    if (filter === 'active') {
      return myBookings?.filter((b) => {
        return b.bookingStatus === 'confirmed' && !isCheckoutPassed(b.checkOut);
      });
    }
    if (filter === 'completed') {
      return myBookings?.filter((b) => {
        return b.bookingStatus === 'confirmed' && isCheckoutPassed(b.checkOut);
      });
    }
    if (filter === 'cancelled') {
      return myBookings?.filter((b) => {
        return b.bookingStatus === 'cancel';
      });
    }
    return myBookings;
  })();

  /**
   * Counts for each filter tab badge.
   */
  const counts = {
    all: myBookings?.length || 0,
    active: myBookings?.filter((b) => {
      return b.bookingStatus === 'confirmed' && !isCheckoutPassed(b.checkOut);
    }).length || 0,
    completed: myBookings?.filter((b) => {
      return b.bookingStatus === 'confirmed' && isCheckoutPassed(b.checkOut);
    }).length || 0,
    cancelled: myBookings?.filter((b) => {
      return b.bookingStatus === 'cancel';
    }).length || 0,
  };

  // --- Render ---

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Action Confirmation Modal Section */}
        <BookingActionModal
          action={confirmAction}
          booking={activeModalBooking}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelling={cancelling}
          deleting={deleting}
          onCancelConfirm={() => {
            return activeModalBooking && handleCancelConfirm(activeModalBooking._id);
          }}
          onDeleteConfirm={() => {
            return activeModalBooking && handleDelete(activeModalBooking._id);
          }}
          onClose={() => { 
            setConfirmAction(null); 
            setCancelReason(''); 
          }}
        />

        {/* Concierge Services Section */}
        {showServices && (
          <ConciergeServiceList
            bookingId={showServices.bookingId}
            propertyId={showServices.propertyId}
            onClose={() => {
              return setShowServices(null);
            }}
          />
        )}

        {/* Page Header Section */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">My Account</p>
            <h1 className="font-display text-3xl text-[var(--bv-text)] flex items-center gap-3">
              <BookOpen size={28} className="text-[var(--bv-gold)]" /> My Bookings
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                return nav('/my-complaints');
              }}
              className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <ShieldAlert size={13} /> Complaints
            </button>
            <button
              onClick={() => {
                return nav('/notifications');
              }}
              className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <MessageSquare size={13} /> Notifications
            </button>
            <button
              onClick={() => {
                return dispatch(getMyBookings());
              }}
              disabled={loading}
              className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Tabs Section */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${filter === key ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)] shadow-[var(--bv-shadow-gold)]' : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'}`}
              >
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === key ? 'bg-white/20' : 'bg-[var(--bv-border)]'}`}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading Skeletons Section */}
        {loading && !myBookings?.length && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => {
              return (
                <div key={i} className="bv-skeleton h-[180px] rounded-2xl" />
              );
            })}
          </div>
        )}

        {/* Empty State Section */}
        {!loading && (!filtered || filtered.length === 0) && (
          <div className="bv-card-static py-20 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20" />
            <h3 className="text-xl font-bold text-[var(--bv-text)]">
              {filter !== 'all' ? `No ${filter} bookings` : 'No bookings yet'}
            </h3>
            {filter === 'all' && (
              <button
                onClick={() => {
                  return nav('/view-all-properties');
                }}
                className="bv-btn-gold text-sm px-6 py-2.5 mt-5"
              >
                Explore Properties
              </button>
            )}
          </div>
        )}

        {/* Booking Cards Grid Section */}
        <div className="space-y-4">
          {filtered?.map((booking) => {
            const p = booking.propertyId;
            const stayDays = booking.stayDays ||
              Math.max(1, Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000));

            const isCompleted = (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed' || booking.bookingStatus === 'staying') && isCheckoutPassed(booking.checkOut);
            const isCancelled = booking.bookingStatus === 'cancel';
            const isActive = (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'staying' || (booking.paymentMethod === 'arrival' && booking.bookingStatus === 'pending')) && !isCheckoutPassed(booking.checkOut);
            
            // Stay has actually started (for complaint filing)
            const hasStayStarted = new Date(booking.checkIn) <= new Date();

            const review = reviewStatus[booking._id];
            const canDelete = isCancelled || isCompleted;
            const isConfirmingThis = confirmAction?.id === booking._id;

            // Active + paid + no refund yet → show "Cancel & Refund"
            const canRequestRefund = isActive && booking.paymentStatus === 'paid' && (!booking.refundStatus || booking.refundStatus === 'none');
            // Active + unpaid → show plain "Cancel"
            const canCancel = isActive && booking.paymentStatus !== 'paid';

            return (
              <div key={booking._id} className="bv-card overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* Property Image Section */}
                  <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0 relative">
                    {p?.images?.[0]?.url ? (
                      <img src={p.images[0].url} alt={p?.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[var(--bv-surface)] flex items-center justify-center">
                        <BookOpen size={24} className="text-[var(--bv-text-dim)]" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bv-badge bv-badge-gold text-[10px]">{p?.type}</span>
                  </div>

                  {/* Booking Details Content Section */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--bv-text)] truncate">{p?.name || 'Property'}</h3>
                        <p className="flex items-center gap-1 text-xs text-[var(--bv-text-dim)] mt-1">
                          <MapPin size={11} /> {p?.city}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${statusColors[booking.bookingStatus]}`}>
                          {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : 'Active'}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${statusColors[booking.paymentStatus]}`}>
                          {booking.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-[var(--bv-text-muted)] mb-4">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={12} className="text-[var(--bv-gold)]" />
                        {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Moon size={12} className="text-[var(--bv-gold)]" />
                        {stayDays} night{stayDays !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {booking.paymentMethod === 'stripe' ? (
                          <CreditCard size={12} className="text-[var(--bv-gold)]" />
                        ) : (
                          <Banknote size={12} className="text-[var(--bv-gold)]" />
                        )}
                        {booking.paymentMethod === 'stripe' ? 'Card' : 'Cash'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-[var(--bv-gold)]">
                        PKR {booking.totalPrice?.toLocaleString()}
                      </span>

                      {/* Action Buttons Section */}
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => {
                            return nav(`/my-bookings/${booking._id}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-text-muted)] bg-[var(--bv-surface)] hover:bg-[var(--bv-card-hover)] transition"
                        >
                          <Eye size={12} /> Details
                        </button>

                        {isActive && (
                          <button
                            onClick={() => {
                              return setShowServices({ bookingId: booking._id, propertyId: p?._id });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-gold)] bg-[var(--bv-gold)]/10 border border-[var(--bv-gold-border)] hover:bg-[var(--bv-gold)]/20 transition"
                          >
                            <ConciergeBell size={12} /> Services
                          </button>
                        )}

                        {(isCompleted || isActive) && review?.canReview && (
                          <button
                            onClick={() => {
                              return nav(`/write-review/${booking._id}`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-gold)] bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] transition"
                          >
                            <Star size={12} /> Review
                          </button>
                        )}

                        {isCompleted && review && !review.canReview && review.reason === 'Already reviewed' && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-success)] bg-emerald-500/10">
                            <CheckCircle size={12} /> Reviewed
                          </span>
                        )}

                        {isCompleted && review && !review.canReview && review.reason?.includes('expired') && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-text-dim)] bg-[var(--bv-surface)]">
                            <Clock size={12} /> Expired
                          </span>
                        )}

                        {(isCompleted || (isActive && hasStayStarted)) && (
                          <button
                            onClick={() => {
                              return nav(`/file-complaint?bookingId=${booking._id}&propertyId=${p?._id}`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-danger)] bg-red-500/10 transition"
                          >
                            <ShieldAlert size={12} /> Complaint
                          </button>
                        )}

                        {/* Cancellation Buttons Section */}
                        {canCancel && (
                          <button
                            onClick={() => {
                              return handleCancelPreview(booking._id);
                            }}
                            disabled={loadingPreview === booking._id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--bv-danger)] border border-red-500/20 transition disabled:opacity-50"
                          >
                            {loadingPreview === booking._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <XCircle size={12} />
                            )}
                            Cancel
                          </button>
                        )}

                        {canRequestRefund && (
                          <button
                            onClick={() => {
                              return handleCancelPreview(booking._id);
                            }}
                            disabled={loadingPreview === booking._id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 transition disabled:opacity-50"
                          >
                            {loadingPreview === booking._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Undo2 size={12} />
                            )}
                            Cancel & Refund
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => {
                              return setConfirmAction({ id: booking._id, type: 'delete' });
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Refund Status Alert Section */}
                    {booking.refundStatus && booking.refundStatus !== 'none' && (
                      <div className={`mt-3 p-3 rounded-xl border ${statusColors[booking.refundStatus]}`}>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {booking.refundStatus === 'requested' && (
                            <>
                              <Clock size={12} /> Refund Requested — PKR {(booking.refundAmount || booking.totalPrice)?.toLocaleString()} ({booking.refundPercent || 100}%)
                            </>
                          )}
                          {booking.refundStatus === 'processing' && (
                            <>
                              <Loader2 size={12} className="animate-spin" /> Refund Processing — PKR {(booking.refundAmount || booking.totalPrice)?.toLocaleString()} ({booking.refundPercent || 100}%)
                            </>
                          )}
                          {booking.refundStatus === 'approved' && (
                            <>
                              <CheckCircle size={12} /> Refund Approved — PKR {(booking.refundAmount || booking.totalPrice)?.toLocaleString()}
                            </>
                          )}
                          {booking.refundStatus === 'rejected' && (
                            <>
                              <XCircle size={12} /> Refund Rejected{booking.refundRejectedReason && ` — ${booking.refundRejectedReason}`}
                            </>
                          )}
                        </div>
                        {booking.refundStatus === 'requested' && (
                          <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                            Host will review. If no response in 24 hours, admin will process.
                          </p>
                        )}
                        {booking.refundStatus === 'processing' && (
                          <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                            Refund is being sent. Funds typically arrive within 3–5 business days.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Review Prompt Section */}
                    {isCompleted && review?.canReview && !isConfirmingThis && (
                      <div className="mt-3 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--bv-gold-border)] bg-[var(--bv-gold-glow)]">
                        <div>
                          <p className="text-sm font-bold text-[var(--bv-text)]">Share your experience</p>
                          <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                            {review.daysLeft ? `${review.daysLeft} days left` : 'Review window closing soon'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            return nav(`/write-review/${booking._id}`);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-[var(--bv-gold)] bg-[var(--bv-card)] border border-[var(--bv-gold-border)] transition"
                        >
                          <Star size={12} /> Write Review
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Link Section */}
        {myBookings?.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                return nav('/my-complaints');
              }}
              className="flex items-center gap-2 text-sm text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
            >
              <MessageSquare size={14} /> View My Complaints
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
