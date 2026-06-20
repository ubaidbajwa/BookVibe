// --- Imports ---

import FoodOrderModel from "../models/FoodOrderModel.js";
import FoodMenuModel from "../models/FoodMenuModel.js";
import BookingModel from "../models/BookingModel.js";
import notificationService from "../services/notification.service.js";

// --- Food Order Controllers ---

/**
 * Creates a new food order for an active booking.
 * Performs server-side price verification and ensures items belong to the property.
 * 
 * @async
 * @function createFoodOrder
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const createFoodOrder = async (req, res) => {
  try {
    const {
      bookingId,
      items,
      notes
    } = req.body;
    const guestId = req.user._id;

    const booking = await BookingModel.findById(bookingId).populate('propertyId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId.toString() !== guestId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You don't own this booking"
      });
    }

    const property = booking.propertyId;

    // Server-side price verification — never trust client item.price
    const menuItemIds = items.map((i) => {
      return i.menuItemId;
    }).filter((id) => {
      return Boolean(id);
    });

    const menuItems = await FoodMenuModel.find({
      _id: {
        $in: menuItemIds
      },
      propertyId: property._id, // must belong to this property
    });

    const priceMap = new Map(menuItems.map((m) => {
      return [m._id.toString(), m.foodprice];
    }));

    let totalPrice = 0;
    const verifiedItems = items.map((item) => {
      const serverPrice = priceMap.get(item.menuItemId?.toString());
      if (serverPrice === undefined) {
        throw new Error(`Menu item '${item.name}' not found or does not belong to this property`);
      }
      const qty = Math.max(1, item.quantity || 1);
      totalPrice += serverPrice * qty;
      return {
        ...item,
        price: serverPrice,
        quantity: qty
      };
    });

    const order = await FoodOrderModel.create({
      bookingId,
      propertyId: property._id,
      hostId: property.hostBy,
      guestId,
      items: verifiedItems,
      totalPrice,
      notes,
    });

    // Ephemeral real-time alert so the host sees the order immediately
    notificationService.emitRaw(`host:${property.hostBy}`, 'food:new_order', {
      orderId: order._id,
      guestName: req.user.username,
      propertyName: property.name,
      totalPrice,
    });

    // Persistent notification for the host's notification centre
    await notificationService.notifyHost(property.hostBy, 'food:order', {
      type: 'food',
      title: 'New Food Order',
      message: `New homemade meal order for ${property.name}`,
      data: {
        orderId: order._id
      },
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
 * Updates the status of a food order (host only).
 * 
 * @async
 * @function updateFoodOrderStatus
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateFoodOrderStatus = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      status
    } = req.body;
    const hostId = req.user._id;

    const order = await FoodOrderModel.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.hostId.toString() !== hostId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    order.status = status;
    if (status === 'delivered') {
      order.deliveryTime = new Date();
    }
    await order.save();

    // Ephemeral status push to the guest
    notificationService.emitRaw(`user:${order.guestId}`, 'food:status_update', {
      orderId: order._id,
      status,
    });

    // Persistent notification for the guest's notification centre
    await notificationService.notifyUser(order.guestId, 'food:update', {
      type: 'food',
      title: `Order ${status}`,
      message: `Your food order is now ${status}`,
      data: {
        orderId: order._id
      },
    });

    return res.json({
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
 * Retrieves all food orders placed by the authenticated guest.
 * 
 * @async
 * @function getGuestFoodOrders
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const getGuestFoodOrders = async (req, res) => {
  try {
    const orders = await FoodOrderModel.find({
        guestId: req.user._id
      })
      .populate('propertyId', 'name images')
      .sort({
        createdAt: -1
      });
    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all food orders for properties owned by the authenticated host.
 * 
 * @async
 * @function getHostFoodOrders
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const getHostFoodOrders = async (req, res) => {
  try {
    const orders = await FoodOrderModel.find({
        hostId: req.user._id
      })
      .populate('propertyId', 'name')
      .populate('guestId', 'username phone')
      .sort({
        createdAt: -1
      });
    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
