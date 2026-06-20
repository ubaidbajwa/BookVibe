// --- Imports ---

import ServiceMenuModel from "../models/ServiceMenuModel.js";
import ServiceOrderModel from "../models/ServiceOrderModel.js";
import BookingModel from "../models/BookingModel.js";
import PropertyModel from "../models/PropertyModel.js";
import notificationService from "../services/notification.service.js";

// --- Concierge Controllers ---

/**
 * Adds a new service to a property's concierge menu.
 * Restricted to the host who owns the property.
 * 
 * @async
 * @function addService
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const addService = async (req, res) => {
  try {
    const {
      propertyId,
      serviceName,
      price,
      description
    } = req.body;
    const hostId = req.user._id;

    const property = await PropertyModel.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Safety: Ensure only the host of the property can add services
    if (property.hostBy.toString() !== hostId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const newService = await ServiceMenuModel.create({
      propertyId,
      serviceName,
      price,
      description,
      isAvailable: true
    });

    return res.status(201).json({
      success: true,
      service: newService
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Places an order for a concierge service during an active booking.
 * Validates prices server-side and ensures the service belongs to the booked property.
 * 
 * @async
 * @function orderService
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const orderService = async (req, res) => {
  try {
    const {
      bookingId,
      serviceId,
      quantity = 1
    } = req.body;
    const userId = req.user._id;

    // 1. Verify the booking exists, belongs to the user, and is still active
    const booking = await BookingModel.findById(bookingId).populate('propertyId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    // HIGH-1 fix: cancelled bookings cannot generate new service orders
    if (booking.bookingStatus === 'cancel') {
      return res.status(400).json({
        success: false,
        message: 'Cannot order services for a cancelled booking'
      });
    }

    // 2. Fetch service and VALIDATE PRICE server-side (Security Rule)
    const service = await ServiceMenuModel.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    if (!service.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Service not currently available'
      });
    }

    // HIGH-1 fix: verify the service belongs to the SAME property as the booking.
    if (service.propertyId.toString() !== booking.propertyId._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This service does not belong to your booked property'
      });
    }

    const totalPrice = service.price * quantity;

    // 3. Create the order
    const order = await ServiceOrderModel.create({
      bookingId,
      serviceId,
      propertyId: booking.propertyId._id,
      userId,
      quantity,
      priceAtOrder: service.price,
      totalPrice,
      status: 'pending'
    });

    // 4. Notify the host about the new request
    await notificationService.notifyHost(booking.propertyId.hostBy, 'concierge:new_order', {
      type: 'system',
      severity: 'info',
      title: 'Concierge Service Requested',
      message: `Guest ${req.user.username} has requested "${service.serviceName}" for their stay at ${booking.propertyId.name}.`,
      data: {
        orderId: order._id,
        bookingId
      }
    });

    return res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all available services for a specific property.
 * 
 * @async
 * @function getPropertyServices
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const getPropertyServices = async (req, res) => {
  try {
    const {
      propertyId
    } = req.params;
    const services = await ServiceMenuModel.find({
      propertyId,
      isAvailable: true
    });
    return res.json({
      success: true,
      services
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.user._id;

    const service = await ServiceMenuModel.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const property = await PropertyModel.findById(service.propertyId);
    if (!property || property.hostBy.toString() !== hostId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await ServiceMenuModel.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
