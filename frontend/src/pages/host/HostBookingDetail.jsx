/**
 * @file HostBookingDetail.jsx
 * @description Detailed view for a specific booking from the host's perspective.
 * Provides booking information and allows hosts to confirm cash payments for "pay on arrival" bookings.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getSingleBooking, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import BookingDetailPanel from '../../components/booking/BookingDetailPanel';

/**
 * @section Constants
 */

/** @type {string} Base URL for API requests. */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @component HostBookingDetail
 * @description Host-facing booking details page with payment confirmation capabilities.
 * 
 * @returns {JSX.Element} The rendered HostBookingDetail component.
 */
const HostBookingDetail = () => {
  /**
   * @section Hooks & Context
   */

  /** @type {Object} URL parameters containing the booking ID. */
  const { id } = useParams();

  /** @type {Function} Redux dispatch function. */
  const dispatch = useDispatch();

  /** @type {Function} Navigation function for programmatic routing. */
  const navigate = useNavigate();

  /** @type {Object} Redux state for accommodations. */
  const { singleBooking: booking, loading, error } = useSelector((s) => {
    return s.accommodations;
  });

  /**
   * @section State Management
   */

  /** 
   * @type {[boolean, Function]} State for tracking if cash confirmation is in progress.
   */
  const [confirmingCash, setConfirmingCash] = useState(false);

  /**
   * @type {[boolean, Function]} Local flag set to true after the host successfully confirms cash.
   * This immediately hides the confirm button without waiting for a
   * page-level refetch to settle.
   */
  const [cashConfirmed, setCashConfirmed] = useState(false);

  /**
   * @section Effects
   */

  /**
   * Fetch booking data on mount or ID change.
   * Resets state on unmount.
   */
  useEffect(
    () => {
      /** Setup: Dispatch fetch if ID exists */
      if (id) {
        dispatch(getSingleBooking(id));
      }

      /** Cleanup: Reset state on unmount */
      return () => {
        dispatch(resetAccommodationState());
      };
    },
    /** Dependencies */
    [dispatch, id]
  );

  /**
   * Handle and display error messages.
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
    [dispatch, error]
  );

  /**
   * @section Handlers
   */

  /**
   * Calls the host-specific endpoint to mark a cash booking as paid.
   * On success, sets the local cashConfirmed flag and re-fetches the booking.
   * 
   * @async
   * @function handleConfirmCash
   * @returns {Promise<void>}
   */
  const handleConfirmCash = async () => {
    /** Prevent double-submission */
    if (confirmingCash) {
      return;
    }

    try {
      setConfirmingCash(true);
      const res = await axios.patch(
        `${BASE}/booking/host/${id}/confirm-cash`,
        {},
        { withCredentials: true }
      );

      if (res.data.success) {
        setCashConfirmed(true);
        dispatch(getSingleBooking(id));
      }
    } catch {
      // error silently handled
    } finally {
      setConfirmingCash(false);
    }
  };

  /**
   * @section Derived State
   */

  /**
   * Determines whether the cash-confirm button should be shown.
   * Conditions: cash payment method + not cancelled + not already locally
   * confirmed + payment not already marked paid on the server.
   * 
   * @type {boolean}
   */
  const showCashConfirm =
    booking?.paymentMethod === 'arrival' &&
    booking?.bookingStatus !== 'cancel' &&
    !cashConfirmed &&
    booking?.paymentStatus !== 'paid';

  /**
   * @section Render
   */

  return (
    <BookingDetailPanel
      booking={booking}
      loading={loading}
      onBack={() => {
        return navigate('/host/bookings');
      }}
      backLabel="Back to Bookings"
      title="Booking Detail"
      subtitle="Guest reservation details for your property"
      showCashConfirm={showCashConfirm}
      confirmingCash={confirmingCash}
      onConfirmCash={handleConfirmCash}
      cashConfirmed={cashConfirmed}
      isHost={true}
    />
  );
};

export default HostBookingDetail;
