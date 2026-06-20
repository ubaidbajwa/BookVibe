/**
 * @file bookingSlice.js
 * @description Guest Booking Redux Slice
 *
 * Manages the guest-facing booking workflow:
 *   - Creating a new booking (cash or Stripe)
 *   - Checking property availability before booking
 *   - Cancelling a booking
 *   - Fetching the current user's booking history
 *
 * The `isBooked` flag is set to true after a successful booking creation OR
 * after an availability check that returns "already booked". Components use
 * this to gate the booking form and redirect to the confirmation screen.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getAuthConfig } from "../../utils/authConfig";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// --- Async Thunks ---

/**
 * @function newBooking
 * @description Submits a new booking to the backend.
 * The server recomputes the total price; any client-side price passed in the
 * payload is intentionally ignored by the backend.
 * @param {Object} bookingData - The data for the new booking.
 * @returns {Promise<Object>} The server response data.
 */
export const newBooking = createAsyncThunk(
  "booking/newBooking",
  async (bookingData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE}/booking/create-booking`,
        bookingData,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Booking failed"
      );
    }
  }
);

/**
 * @function checkAvailability
 * @description Queries whether a property is free for the requested date range.
 * Sets `isBooked` based on the server response so the UI can immediately show a "dates unavailable" message.
 * @param {Object} availabilityData - The date range and property ID to check.
 * @returns {Promise<Object>} The server response data.
 */
export const checkAvailability = createAsyncThunk(
  "booking/checkAvailability",
  async (availabilityData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE}/booking/check-availability`,
        availabilityData,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Availability check failed"
      );
    }
  }
);

/**
 * @function cancelBooking
 * @description Cancels the booking with the given ID.
 * On success the booking's status is updated optimistically in Redux state
 * so the MyBookings page reflects the change without a full refetch.
 * @param {string} bookingId - The ID of the booking to cancel.
 * @returns {Promise<Object>} The server response data merged with the booking ID.
 */
export const cancelBooking = createAsyncThunk(
  "booking/cancelBooking",
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BASE}/booking/${bookingId}/cancel`,
        {},
        getAuthConfig()
      );
      // Return the server response merged with the ID so the reducer
      // can locate and update the correct booking in the list
      return {
        ...response.data,
        id: bookingId
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Cancellation failed"
      );
    }
  }
);

/**
 * @function getMyBookings
 * @description Fetches all bookings for the currently logged-in guest.
 * @returns {Promise<Object>} The server response data containing bookings.
 */
export const getMyBookings = createAsyncThunk(
  "booking/getMyBookings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/booking/my-bookings`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch bookings"
      );
    }
  }
);

// --- Slice ---

const bookingSlice = createSlice({
  name: "booking",

  // --- State ---
  initialState: {
    myBookings: [],
    isBooked: false, // true when dates are taken OR a booking was just created
    availabilityChecked: false, // true once at least one availability check has resolved
    loading: false,
    success: false,
    error: null,
    message: "",
  },

  // --- Reducers ---
  reducers: {
    /**
     * @function resetAvailability
     * @description Clears the availability-check result.
     * Called when the user changes the date range so the previous result does not persist.
     */
    resetAvailability(state) {
      state.isBooked = false;
      state.availabilityChecked = false;
      state.loading = false;
      state.error = null;
      state.message = "";
      state.success = false;
    },

    /**
     * @function resetBookingState
     * @description Clears transient status flags without affecting the booking list.
     * Used by components on unmount or form reset.
     */
    resetBookingState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.message = "";
    },

    /**
     * @function clearBookingError
     * @description Dismisses the error banner without resetting other state.
     */
    clearBookingError(state) {
      state.error = null;
    },
  },

  // --- Extra Reducers ---
  extraReducers: (builder) => {
    // --- newBooking Cases ---
    builder.addCase(newBooking.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(newBooking.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;
      state.isBooked = true;
    });

    builder.addCase(newBooking.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // --- checkAvailability Cases ---
    builder.addCase(checkAvailability.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(checkAvailability.fulfilled, (state, action) => {
      state.loading = false;
      // `isBooked: true` means the property is already taken for those dates
      state.isBooked = action.payload.isBooked;
      state.availabilityChecked = true;
      // success = dates are free (inverse of isBooked)
      state.success = !action.payload.isBooked;
      state.message = action.payload.message || "";
    });

    builder.addCase(checkAvailability.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // --- cancelBooking Cases ---
    builder.addCase(cancelBooking.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(cancelBooking.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;

      // Optimistically mark the cancelled booking in the local list
      const index = state.myBookings.findIndex((booking) => {
        return booking._id === action.payload.id;
      });

      if (index !== -1) {
        state.myBookings[index].bookingStatus = "cancel";
      }
    });

    builder.addCase(cancelBooking.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // --- getMyBookings Cases ---
    builder.addCase(getMyBookings.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(getMyBookings.fulfilled, (state, action) => {
      state.loading = false;
      state.myBookings = action.payload.bookings;
    });

    builder.addCase(getMyBookings.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
  },
});

export const {
  resetAvailability,
  resetBookingState,
  clearBookingError,
} = bookingSlice.actions;

export default bookingSlice.reducer;
