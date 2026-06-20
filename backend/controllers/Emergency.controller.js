// --- Imports ---

import BookingModel from "../models/BookingModel.js";
import notificationService from "../services/notification.service.js";

// --- Helpers ---

/**
 * Mocks nearby medical facilities based on coordinates.
 * 
 * @function getNearbyFacilities
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {Array<Object>} List of facilities.
 */
const getNearbyFacilities = function(lat, lng) {
  return [
    {
      name: 'City General Hospital',
      type: 'Hospital',
      distance: '1.2km',
      phone: '+92-300-1234567'
    },
    {
      name: 'Al-Shifa Clinic',
      type: 'Clinic',
      distance: '0.8km',
      phone: '+92-300-7654321'
    },
    {
      name: 'Local Pharmacy',
      type: 'Pharmacy',
      distance: '0.3km',
      phone: '+92-300-1122334'
    }
  ];
};

// --- Emergency Controllers ---

/**
 * Triggers a medical SOS alert, notifying the host via dashboard and SMS.
 * Provides the guest with nearby emergency facility information.
 * 
 * @async
 * @function triggerMedicalSOS
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const triggerMedicalSOS = async (req, res) => {
  try {
    const {
      bookingId,
      message
    } = req.body;
    const guestId = req.user._id;

    // Single query — populate hostBy directly to avoid a second round-trip
    const booking = await BookingModel.findById(bookingId)
      .populate({
        path: 'propertyId',
        populate: {
          path: 'hostBy',
          select: 'phone username'
        },
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.userId.toString() !== guestId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const property = booking.propertyId;
    // coordinates may be absent on legacy properties — never crash an SOS.
    let lat = null;
    let lng = null;
    if (property.coordinates) {
      lat = property.coordinates.lat ?? null;
      lng = property.coordinates.lng ?? null;
    }
    const sosMessage = message || 'Medical Emergency! Immediate assistance required.';

    // 1. Ephemeral real-time alert to host
    notificationService.emitRaw(`host:${property.hostBy._id}`, 'emergency:sos', {
      type: 'MEDICAL_SOS',
      severity: 'CRITICAL',
      guestName: req.user.username,
      guestPhone: req.user.phone,
      propertyName: property.name,
      address: property.address,
      coordinates: {
        lat,
        lng
      },
      message: sosMessage,
    });

    // 2. Persistent notification + SMS fallback
    await notificationService.notifyHost(property.hostBy._id, 'emergency:sos', {
      type: 'emergency',
      severity: 'critical',
      title: '🚨 MEDICAL SOS ALERT 🚨',
      message: `URGENT: ${req.user.username} has triggered a medical SOS at ${property.name}. Contact guest immediately! Message: ${sosMessage}. Guest Phone: ${req.user.phone}`,
      bookingId: booking._id,
      critical: true, // triggers Twilio SMS fallback
    });

    let facilities = [];
    if (lat && lng) {
      facilities = getNearbyFacilities(lat, lng);
    }

    return res.json({
      success: true,
      message: 'SOS Triggered. Host has been alerted via Dashboard and SMS.',
      nearbyFacilities: facilities,
      emergencyContacts: {
        ambulance: '1122',
        police: '15'
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
