/**
 * @file property.routes.js
 * @description Express router for property listing management, availability toggling, and searching.
 */

import express from "express";
import {
  addProperty,
  getHostProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  toggleAvailability,
  toggleSubUnitAvailability,
  deleteSubUnit,
  getAllProperties,
} from "../controllers/Property.controller.js";
import {
  isAuthenticated,
  isAuthorized
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// ─── SPECIFIC HOST ROUTES (must be registered before /:id wildcard) ──────────

/**
 * @route POST /api/properties/add-property
 * @desc Add a new property listing (Host only).
 */
router.post("/add-property", isAuthenticated, isAuthorized("host"), addProperty);

/**
 * @route GET /api/properties/host/my-properties
 * @desc Get all properties owned by the authenticated host.
 */
router.get("/host/my-properties", isAuthenticated, isAuthorized("host"), getHostProperties);

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────

/**
 * @route GET /api/properties
 * @desc Get all properties (supports searching and filtering).
 */
router.get("/", getAllProperties);

/**
 * @route GET /api/properties/:id
 * @desc Get details of a single property by ID.
 */
router.get("/:id", getPropertyById);

/**
 * @route PUT /api/properties/:id
 * @desc Update property details (Host only).
 */
router.put("/:id", isAuthenticated, isAuthorized("host"), updateProperty);

/**
 * @route DELETE /api/properties/:id
 * @desc Delete a property listing (Host only).
 */
router.delete("/:id", isAuthenticated, isAuthorized("host"), deleteProperty);

/**
 * @route PATCH /api/properties/:id/toggle-availability
 * @desc Toggle property availability status (Host only).
 */
router.patch("/:id/toggle-availability", isAuthenticated, isAuthorized("host"), toggleAvailability);

/**
 * @route PATCH /api/properties/:id/unit/:unitId/toggle-availability
 * @desc Toggle subunit availability status (Host only).
 */
router.patch("/:id/unit/:unitId/toggle-availability", isAuthenticated, isAuthorized("host"), toggleSubUnitAvailability);

/**
 * @route DELETE /api/properties/:id/unit/:unitId
 * @desc Delete a subunit (Host only).
 */
router.delete("/:id/unit/:unitId", isAuthenticated, isAuthorized("host"), deleteSubUnit);

export default router;
