/**
 * @file store.js
 * @description Redux Store Configuration
 *
 * Combines the three domain slices (accommodations, auth, booking) into a
 * single store. Serialization checks are relaxed for the accommodation slice
 * because it temporarily holds FormData objects (file uploads) which are not
 * plain-object serializable.
 */

import { configureStore } from "@reduxjs/toolkit";
import accommodationReducer from "../slices/accommodationSlice";
import authReducer from "../slices/authSlice";
import bookingReducer from "../slices/bookingSlice";

// --- Store Configuration ---

/**
 * @constant store
 * @description The application's Redux store instance.
 */
export const store = configureStore({
  // --- Reducers ---
  reducer: {
    accommodations: accommodationReducer,
    auth: authReducer,
    booking: bookingReducer,
  },

  // --- Middleware ---
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        // FormData instances are passed through these actions during file
        // uploads (property images, profile photos). They cannot be
        // serialized, so we exempt them from the serialization check.
        ignoredActions: [
          "accommodation/add/pending",
          "accommodation/add/fulfilled",
          "accommodation/update/pending",
          "accommodation/update/fulfilled",
          "accommodation/updateProfile/pending",
          "accommodation/updateProfile/fulfilled",
        ],
        ignoredPaths: ["accommodation.formData"],
      },
    });
  },
});
