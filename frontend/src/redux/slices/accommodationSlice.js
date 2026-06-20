/**
 * @file accommodationSlice.js
 * @description Accommodation and Host Management Redux Slice
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getAuthConfig } from "../../utils/authConfig";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// --- Constants & Storage Helpers ---

const NR_KEY = "host-notification-read-map";

/**
 * @function getNRMap
 * @description Retrieves the notification read map from localStorage.
 * @returns {Object} The read map.
 */
const getNRMap = () => {
  try {
    return JSON.parse(localStorage.getItem(NR_KEY)) || {};
  } catch {
    return {};
  }
};

/**
 * @function saveNRMap
 * @description Saves the notification read map to localStorage.
 * @param {Object} map - The read map to save.
 */
const saveNRMap = (map) => {
  localStorage.setItem(NR_KEY, JSON.stringify(map));
};

/**
 * @function getHostReadIds
 * @description Gets the list of read notification IDs for a specific host.
 * @param {string} hostId - The host's ID.
 * @returns {Array} List of read IDs.
 */
const getHostReadIds = (hostId) => {
  if (!hostId) {
    return [];
  }
  return getNRMap()[hostId] || [];
};

/**
 * @function setHostReadIds
 * @description Sets the list of read notification IDs for a specific host.
 * @param {string} hostId - The host's ID.
 * @param {Array} ids - List of read IDs.
 */
const setHostReadIds = (hostId, ids) => {
  if (!hostId) {
    return;
  }
  const map = getNRMap();
  map[hostId] = ids;
  saveNRMap(map);
};

// --- Time Formatting Helpers ---

/**
 * @function fmtTime
 * @description Formats a date into a relative time string (e.g., "5m ago").
 * @param {string|Date} value - The date value to format.
 * @returns {string} The formatted relative time.
 */
const fmtTime = (value) => {
  if (!value) {
    return "Recently";
  }

  const diff = new Date() - new Date(value);
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
  });
};

/**
 * @function toN
 * @description Enriches a notification object with a relative time string.
 * @param {Object} obj - The notification object.
 * @returns {Object} The enriched notification object.
 */
const toN = (obj) => {
  return {
    ...obj,
    relativeTime: fmtTime(obj.createdAt),
  };
};

/**
 * @function buildNotifs
 * @description Aggregates and filters notifications from properties, bookings, and refunds.
 * @param {Object} params - The data sources for building notifications.
 * @returns {Array} The sorted list of notification objects.
 */
const buildNotifs = ({
  properties = [],
  bookings = [],
  refunds = [],
  settings = {},
}) => {
  const notifications = [];
  const notificationSettings = settings.notifications || {};

  // Process Bookings
  bookings.forEach((booking) => {
    if (notificationSettings.emailBookings !== false) {
      notifications.push(
        toN({
          id: `booking:${booking._id}`,
          type: "booking",
          severity: "info",
          title: "New booking",
          message: `${booking.userId?.username || "Guest"} booked ${
            booking.propertyId?.name || "property"
          }.`,
          createdAt: booking.createdAt,
          link: `/host/bookings/${booking._id}`,
          meta: booking,
        })
      );
    }

    if (
      notificationSettings.emailPayments !== false &&
      booking.paymentStatus === "pending" &&
      booking.bookingStatus === "confirmed"
    ) {
      notifications.push(
        toN({
          id: `payment:${booking._id}`,
          type: "payment",
          severity: "warning",
          title: "Payment pending",
          message: `${booking.propertyId?.name || "Booking"} awaiting payment.`,
          createdAt: booking.createdAt,
          link: "/host/payments/all-payments",
          meta: booking,
        })
      );
    }
  });

  // Process Refunds
  if (notificationSettings.emailPayments !== false) {
    refunds.forEach((refund) => {
      notifications.push(
        toN({
          id: `refund:${refund._id}`,
          type: "refund",
          severity: refund.refundStatus === "requested" ? "danger" : "success",
          title:
            refund.refundStatus === "requested"
              ? "Refund request"
              : `Refund ${refund.refundStatus}`,
          message: `${refund.userId?.username || "Guest"} requested refund for ${
            refund.propertyId?.name || "property"
          }.`,
          createdAt:
            refund.refundRequestedAt || refund.updatedAt || refund.createdAt,
          link: "/host/payments/request-refund-payments",
          meta: refund,
        })
      );
    });
  }

  // Process Property Hidden Status
  if (notificationSettings.emailPromotions !== false) {
    properties
      .filter((prop) => {
        return !prop.available;
      })
      .forEach((prop) => {
        notifications.push(
          toN({
            id: `property:${prop._id}`,
            type: "property",
            severity: "neutral",
            title: "Property hidden",
            message: `${prop.name} hidden from guests.`,
            createdAt: prop.updatedAt || prop.createdAt,
            link: "/host/accommodations",
            meta: prop,
          })
        );
      });
  }

  return notifications.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

// --- Async Thunks ---

export const addNewAccommodation = createAsyncThunk(
  "accommodation/add",
  async (formData, { rejectWithValue }) => {
    try {
      // Do NOT set Content-Type manually for FormData — axios/the browser must
      // compute it themselves so the multipart boundary matches the actual body.
      // An explicit 'multipart/form-data' header with no boundary silently breaks
      // the upload: express-fileupload receives an unparseable body (no files, no fields).
      const response = await axios.post(
        `${BASE}/property/add-property`,
        formData,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to add property"
      );
    }
  }
);

export const getHostProperties = createAsyncThunk(
  "accommodation/getHostProperties",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/property/host/my-properties`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch properties"
      );
    }
  }
);

export const deleteProperty = createAsyncThunk(
  "accommodation/delete",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(
        `${BASE}/property/${id}`,
        getAuthConfig()
      );
      return {
        ...response.data,
        id,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete property"
      );
    }
  }
);

export const togglePropertyAvailability = createAsyncThunk(
  "accommodation/toggleAvailability",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${BASE}/property/${id}/toggle-availability`,
        {},
        getAuthConfig()
      );
      return {
        ...response.data,
        id,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to toggle availability"
      );
    }
  }
);

export const updateProperty = createAsyncThunk(
  "accommodation/update",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      // See addNewAccommodation above — never force Content-Type on a FormData body.
      const response = await axios.put(
        `${BASE}/property/${id}`,
        formData,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update property"
      );
    }
  }
);

export const getSingleAccommodationById = createAsyncThunk(
  "accommodation/getSingle",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE}/property/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch property"
      );
    }
  }
);

export const getHostDashboardStats = createAsyncThunk(
  "accommodation/dashboardStats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/booking/host/dashboard-stats`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch dashboard stats"
      );
    }
  }
);

export const getHostBookings = createAsyncThunk(
  "accommodation/hostBookings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/booking/host/all-bookings`,
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

export const getHostPayments = createAsyncThunk(
  "accommodation/hostPayments",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/booking/host/payments`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch payments"
      );
    }
  }
);

export const getHostNotifications = createAsyncThunk(
  "accommodation/notifications",
  async (_, { rejectWithValue, getState }) => {
    try {
      const [pRes, bRes, rRes] = await Promise.all([
        axios.get(`${BASE}/property/host/my-properties`, getAuthConfig()),
        axios.get(`${BASE}/booking/host/all-bookings`, getAuthConfig()),
        axios.get(`${BASE}/booking/host/refunds`, getAuthConfig()),
      ]);

      const user = getState().auth?.user?.user;
      const settings = user?.settings || {};

      const notifications = buildNotifs({
        properties: pRes.data?.properties || [],
        bookings: bRes.data?.bookings || [],
        refunds: rRes.data?.refunds || [],
        settings: settings,
      });

      return {
        notifications,
        readIds: getHostReadIds(user?._id),
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch notifications"
      );
    }
  }
);

export const getSingleBooking = createAsyncThunk(
  "accommodation/getSingleBooking",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE}/booking/${id}`, getAuthConfig());
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch booking"
      );
    }
  }
);

export const getRefundRequests = createAsyncThunk(
  "accommodation/getRefunds",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE}/booking/host/refunds`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch refunds"
      );
    }
  }
);

export const updateRefundStatus = createAsyncThunk(
  "accommodation/updateRefundStatus",
  async ({ id, refundStatus, rejectedReason }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${BASE}/booking/${id}/refund-status`,
        { refundStatus, rejectedReason },
        getAuthConfig()
      );
      return {
        ...response.data,
        id,
        refundStatus,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update refund status"
      );
    }
  }
);

export const updateHostProfile = createAsyncThunk(
  "accommodation/updateProfile",
  async (formData, { rejectWithValue }) => {
    try {
      // See addNewAccommodation above — never force Content-Type on a FormData body.
      const response = await axios.put(
        `${BASE}/user/update-profile`,
        formData,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update profile"
      );
    }
  }
);

export const updatePassword = createAsyncThunk(
  "accommodation/updatePassword",
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${BASE}/user/update-password`,
        data,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update password"
      );
    }
  }
);

// --- Slice ---

const accommodationSlice = createSlice({
  name: "accommodation",

  // --- State ---
  initialState: {
    properties: [],
    singleProperty: null,
    dashboardStats: null,
    hostBalance: 0,
    outstandingDebt: 0,
    recentBookings: [],
    hostBookings: [],
    hostPayments: [],
    refunds: [],
    notifications: [],
    notificationReadIds: [],
    notificationsLoading: false,
    notificationsError: null,
    notificationsFetchedAt: null,
    singleBooking: null,
    updatedUser: null,
    loading: false,
    actionLoading: false,
    error: null,
    success: false,
    message: "",
  },

  // --- Reducers ---
  reducers: {
    resetAccommodationState(state) {
      state.loading = false;
      state.actionLoading = false;
      state.error = null;
      state.success = false;
      state.message = "";
      state.updatedUser = null;
      state.notificationsError = null;
    },
    clearError(state) {
      state.error = null;
    },
    markNotificationRead(state, action) {
      const { id, hostId } = action.payload || {};
      if (!id || state.notificationReadIds.includes(id)) {
        return;
      }
      state.notificationReadIds.push(id);
      setHostReadIds(hostId, state.notificationReadIds);
    },
    markAllNotificationsRead(state, action) {
      const hostId = action.payload;
      state.notificationReadIds = state.notifications.map((item) => {
        return item.id;
      });
      setHostReadIds(hostId, state.notificationReadIds);
    },
  },

  // --- Extra Reducers ---
  extraReducers: (builder) => {
    // --- Helper Reducers ---
    const setPending = (state) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state, action) => {
      state.loading = false;
      state.error = action.payload;
    };
    const setActionPending = (state) => {
      state.actionLoading = true;
    };
    const setActionRejected = (state, action) => {
      state.actionLoading = false;
      state.error = action.payload;
    };

    // --- Cases ---
    builder.addCase(addNewAccommodation.pending, setPending);
    builder.addCase(addNewAccommodation.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;
    });
    builder.addCase(addNewAccommodation.rejected, setRejected);

    builder.addCase(getHostProperties.pending, setPending);
    builder.addCase(getHostProperties.fulfilled, (state, action) => {
      state.loading = false;
      state.properties = action.payload.properties;
    });
    builder.addCase(getHostProperties.rejected, setRejected);

    builder.addCase(deleteProperty.pending, setActionPending);
    builder.addCase(deleteProperty.fulfilled, (state, action) => {
      state.actionLoading = false;
      state.success = true;
      state.message = action.payload.message;
      state.properties = state.properties.filter((item) => {
        return item._id !== action.payload.id;
      });
    });
    builder.addCase(deleteProperty.rejected, setActionRejected);

    builder.addCase(togglePropertyAvailability.pending, setActionPending);
    builder.addCase(togglePropertyAvailability.fulfilled, (state, action) => {
      state.actionLoading = false;
      const index = state.properties.findIndex((item) => {
        return item._id === action.payload.id;
      });
      if (index !== -1) {
        state.properties[index].available = action.payload.available;
      }
    });
    builder.addCase(togglePropertyAvailability.rejected, setActionRejected);

    builder.addCase(updateProperty.pending, setPending);
    builder.addCase(updateProperty.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;
      const index = state.properties.findIndex((item) => {
        return item._id === action.payload.property?._id;
      });
      if (index !== -1) {
        state.properties[index] = action.payload.property;
      }
    });
    builder.addCase(updateProperty.rejected, setRejected);

    builder.addCase(getSingleAccommodationById.pending, setPending);
    builder.addCase(getSingleAccommodationById.fulfilled, (state, action) => {
      state.loading = false;
      state.singleProperty = action.payload.property;
    });
    builder.addCase(getSingleAccommodationById.rejected, setRejected);

    builder.addCase(getHostDashboardStats.pending, setPending);
    builder.addCase(getHostDashboardStats.fulfilled, (state, action) => {
      state.loading = false;
      state.dashboardStats = action.payload.stats;
      state.hostBalance = action.payload.stats?.hostBalance || 0;
      state.outstandingDebt = action.payload.stats?.outstandingDebt || 0;
      state.recentBookings = action.payload.recentBookings || [];
    });
    builder.addCase(getHostDashboardStats.rejected, setRejected);

    builder.addCase(getHostBookings.pending, setPending);
    builder.addCase(getHostBookings.fulfilled, (state, action) => {
      state.loading = false;
      state.hostBookings = action.payload.bookings;
    });
    builder.addCase(getHostBookings.rejected, setRejected);

    builder.addCase(getHostPayments.pending, setPending);
    builder.addCase(getHostPayments.fulfilled, (state, action) => {
      state.loading = false;
      state.hostPayments = action.payload.payments;
    });
    builder.addCase(getHostPayments.rejected, setRejected);

    builder.addCase(getHostNotifications.pending, (state) => {
      state.notificationsLoading = true;
      state.notificationsError = null;
    });
    builder.addCase(getHostNotifications.fulfilled, (state, action) => {
      state.notificationsLoading = false;
      state.notifications = action.payload.notifications;
      state.notificationReadIds = action.payload.readIds;
      state.notificationsFetchedAt = action.payload.fetchedAt;
    });
    builder.addCase(getHostNotifications.rejected, (state, action) => {
      state.notificationsLoading = false;
      state.notificationsError = action.payload;
    });

    builder.addCase(getSingleBooking.pending, setPending);
    builder.addCase(getSingleBooking.fulfilled, (state, action) => {
      state.loading = false;
      state.singleBooking = action.payload.booking;
    });
    builder.addCase(getSingleBooking.rejected, setRejected);

    builder.addCase(getRefundRequests.pending, setPending);
    builder.addCase(getRefundRequests.fulfilled, (state, action) => {
      state.loading = false;
      state.refunds = action.payload.refunds;
    });
    builder.addCase(getRefundRequests.rejected, setRejected);

    builder.addCase(updateRefundStatus.pending, setActionPending);
    builder.addCase(updateRefundStatus.fulfilled, (state, action) => {
      state.actionLoading = false;
      state.success = true;
      state.message = action.payload.message;
      const index = state.refunds.findIndex((item) => {
        return item._id === action.payload.id;
      });
      if (index !== -1) {
        state.refunds[index].refundStatus = action.payload.refundStatus;
      }
    });
    builder.addCase(updateRefundStatus.rejected, setActionRejected);

    builder.addCase(updateHostProfile.pending, setPending);
    builder.addCase(updateHostProfile.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;
      state.updatedUser = action.payload.user;
    });
    builder.addCase(updateHostProfile.rejected, setRejected);

    builder.addCase(updatePassword.pending, setPending);
    builder.addCase(updatePassword.fulfilled, (state, action) => {
      state.loading = false;
      state.success = true;
      state.message = action.payload.message;
    });
    builder.addCase(updatePassword.rejected, setRejected);
  },
});

export const {
  resetAccommodationState,
  clearError,
  markNotificationRead,
  markAllNotificationsRead,
} = accommodationSlice.actions;

export default accommodationSlice.reducer;
