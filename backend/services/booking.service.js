/**
 * @fileoverview Booking service for managing property reservations, availability, and pricing
 * @module services/booking
 */

import mongoose from "mongoose";
import BookingModel from "../models/BookingModel.js";
import PropertyModel from "../models/PropertyModel.js";
import FoodMenuModel from "../models/FoodMenuModel.js";
import stripeService from "./stripe.service.js";
import refundHelper from "../utils/refundHelper.js";
import trustService from "./trust.service.js";
import { notifyAdmin } from "../utils/notificationHelper.js";
import { withPropertyLock } from "../utils/bookingLock.js";

const PLATFORM_FEE_PERCENT = 10;

// Bookings at or above this amount trigger an admin "high-value booking" alert
// (gated by each admin's settings.notifications.notifyHighValueBookings).
const HIGH_VALUE_BOOKING_THRESHOLD = 50000;

class BookingService {
  /**
   * Creates a new booking, handles pricing logic, and initiates Stripe sessions if needed.
   * 
   * @async
   * @function createBooking
   * @param {Object} data - Booking data from controller.
   * @returns {Promise<Object>} The created booking and optional Stripe session.
   * @throws {Error} If availability check fails or property is not found.
   */
  async createBooking(data) {
    const {
      propertyId,
      subUnitId,
      userId,
      checkIn,
      checkOut,
      paymentMethod,
      selectedAddOns,
      homemadeFoodSelected,
      // Pre-ordered meal plan — the client sends only the FoodMenu item IDs;
      // titles and prices are resolved authoritatively server-side below so a
      // tampered client can't set its own meal price or attach a foreign item.
      breakfastId,
      lunchId,
      dinnerId,
    } = data;

    const property = await PropertyModel.findById(propertyId);
    if (!property) throw new Error("Property not found");

    // 0a. Blocked-host gate: a host blocked/blacklisted by admin must not be able
    // to receive new bookings, even if a guest still has the listing page open.
    const host = await mongoose.model('UserAndHost').findById(property.hostBy).select('isBlocked');
    if (host?.isBlocked) {
      throw new Error("This property is currently unavailable for booking.");
    }

    // 0. Verified-guest gate: hosts may restrict bookings to KYC-verified guests only.
    if (property.onlyVerifiedGuests) {
      const guest = await mongoose.model('UserAndHost').findById(userId).select('isVerified');
      if (!guest || guest.isVerified !== 'verified') {
        throw new Error("This property only accepts identity-verified guests. Please complete your verification first.");
      }
    }

    return await withPropertyLock(propertyId, async () => {
      // 1. Availability check (Global or Sub-unit specific)
      const isAvailable = await this.checkAvailability(propertyId, checkIn, checkOut, subUnitId);
      if (!isAvailable) throw new Error("Dates are no longer available for this unit");

      // 2. Pricing calculation (Securely computed server-side)
      const stayDays = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000));

      // Calculate base accommodation price
      const { total: accommodationPrice, rateType } = this.computeAccommodationPrice(property, stayDays, subUnitId);

      // Calculate add-ons total
      const { total: addOnsTotal, processedAddOns } = this.calculateAddOnsTotal(property, selectedAddOns, stayDays);

      // Homemade Food Price (Optional Service)
      const homemadeFoodPrice = (homemadeFoodSelected && property.foodServices?.available)
        ? (property.foodServices.price || 0)
        : 0;

      // Pre-ordered meal plan: resolve each selected FoodMenu item server-side.
      // Only items that actually belong to this property are honoured; each meal
      // is charged once per night of the stay (foodprice × stayDays).
      const { mealSelection, mealTotal } = await this.resolveMealSelection(
        { breakfastId, lunchId, dinnerId },
        propertyId,
        stayDays
      );

      const grandTotal = accommodationPrice + addOnsTotal + homemadeFoodPrice + mealTotal;

      // 3. Trust Engine Analysis (Risk Assessment)
      const { requiresSecurityDeposit, riskScore } = await trustService.analyzeBookingRisk(userId, property);

      // 4. Create the booking record
      const booking = await BookingModel.create({
        propertyId,
        subUnitId,
        userId,
        checkIn,
        checkOut,
        stayDays,
        stayType: rateType,
        totalPrice: grandTotal,
        selectedAddOns: processedAddOns,
        paymentMethod,
        requiresSecurityDeposit,
        riskScore,
        damageDepositStatus: property.damagePolicy?.depositRequired ? 'held' : 'none',
        homemadeFoodSelected: !!homemadeFoodSelected,
        ...mealSelection,
      });

      if (grandTotal >= HIGH_VALUE_BOOKING_THRESHOLD) {
        notifyAdmin('booking:highvalue', {
          title: 'High-Value Booking',
          message: `New booking of PKR ${grandTotal.toLocaleString()} for "${property.name}".`,
          type: 'booking',
          severity: 'info',
          link: `/admin/bookings/${booking._id}`,
          bookingId: booking._id,
          propertyId: property._id,
        }, 'notifyHighValueBookings').catch((e) => console.error('[notifyAdmin:booking:highvalue]', e));
      }

      // 5. Payment handling (Stripe)
      if (paymentMethod === 'stripe') {
        const session = await stripeService.createCheckoutSession({
          bookingId: booking._id,
          userId,
          property,
          checkIn,
          checkOut,
          stayDays,
          totalPrice: booking.totalPrice
        });
        booking.stripeSessionId = session.id;
        await booking.save();
        return { booking, session };
      }

      return { booking };
    });
  }

  /**
   * Resolves a guest's pre-ordered meal plan against the property's own food menu.
   * Each meal slot (breakfast/lunch/dinner) may reference one FoodMenu item by ID;
   * only items that genuinely belong to this property are accepted, and the price
   * is taken from the menu (never the client), charged once per night of the stay.
   *
   * @async
   * @function resolveMealSelection
   * @param {{breakfastId?: string, lunchId?: string, dinnerId?: string}} ids - Selected item IDs.
   * @param {string} propertyId - The property the booking is for.
   * @param {number} stayDays - Number of nights, used as the per-meal multiplier.
   * @returns {Promise<{mealSelection: Object, mealTotal: number}>}
   */
  async resolveMealSelection(ids, propertyId, stayDays) {
    const slotIds = { breakfast: ids.breakfastId, lunch: ids.lunchId, dinner: ids.dinnerId };
    const requestedIds = Object.values(slotIds).filter(Boolean);

    const mealSelection = {};
    let mealTotal = 0;
    if (requestedIds.length === 0) {
      return { mealSelection, mealTotal };
    }

    const items = await FoodMenuModel.find({ _id: { $in: requestedIds }, propertyId });
    const byId = new Map(items.map((i) => [i._id.toString(), i]));

    for (const [slot, id] of Object.entries(slotIds)) {
      if (!id) continue;
      const item = byId.get(id.toString());
      // Skip silently if the id is invalid, belongs to another property, or the
      // requested item isn't actually served at this slot.
      if (!item || item.servingAt !== slot) continue;
      const price = item.foodprice * stayDays;
      mealSelection[slot] = { title: item.foodname, price };
      mealTotal += price;
    }

    return { mealSelection, mealTotal };
  }

  /**
   * Checks if the property (or specific sub-unit) is available for given dates.
   *
   * @async
   * @function checkAvailability
   */
  async checkAvailability(propertyId, checkIn, checkOut, subUnitId = null) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const query = {
      propertyId,
      bookingStatus: { $in: ['pending', 'confirmed', 'staying', 'completed'] },
      $or: [
        { checkIn: { $lt: end, $gte: start } },
        { checkOut: { $gt: start, $lte: end } },
        { checkIn: { $lte: start }, checkOut: { $gte: end } }
      ]
    };

    // If a sub-unit is specified, only check for clashes in that specific unit
    if (subUnitId) {
      query.subUnitId = subUnitId;
    }

    const overlap = await BookingModel.findOne(query);
    return !overlap;
  }

  /**
   * Computes the accommodation price based on smart pricing tiers or sub-unit base price.
   */
  computeAccommodationPrice(property, stayDays, subUnitId) {
    let baseRate = property.pricing?.nightly || property.price;
    let isSubUnit = false;

    // If sub-unit selected, override baseRate
    if (subUnitId && property.subUnits?.length > 0) {
      const unit = property.subUnits.find(u => u._id.toString() === subUnitId.toString());
      if (unit) {
        baseRate = unit.basePrice;
        isSubUnit = true;
      }
    }

    // Single-unit properties get smart tiered pricing
    if (!isSubUnit) {
      if (stayDays >= 30 && property.pricing?.monthly) {
        return { total: property.pricing.monthly * Math.ceil(stayDays / 30), rateType: 'monthly' };
      }
      if (stayDays >= 7 && property.pricing?.weekly) {
        const weeks = Math.floor(stayDays / 7);
        const remaining = stayDays % 7;
        return { total: (weeks * property.pricing.weekly) + (remaining * baseRate), rateType: 'weekly' };
      }
    }

    // Default: simple nightly rate
    return { total: baseRate * stayDays, rateType: 'nightly' };
  }

  /**
   * Validates and calculates the total for dynamic add-on services.
   */
  calculateAddOnsTotal(property, selectedAddOns, stayDays) {
    let total = 0;
    const processedAddOns = [];

    if (!selectedAddOns || !Array.isArray(selectedAddOns)) {
      return { total, processedAddOns };
    }

    for (const selection of selectedAddOns) {
      const service = property.addOnServices.find(s => s.serviceName === selection.serviceName);
      if (!service) continue;

      let subtotal = 0;
      const qty = selection.quantity || 1;

      switch (service.billingType) {
        case 'per_day':
        case 'per_night':
          subtotal = service.price * stayDays * qty;
          break;
        case 'per_stay':
          subtotal = service.price * qty;
          break;
        case 'per_item':
          subtotal = service.price * qty;
          break;
        case 'per_person':
          // Assuming qty represents number of persons if billingType is per_person
          subtotal = service.price * stayDays * qty;
          break;
        default:
          subtotal = service.price * qty;
      }

      total += subtotal;
      processedAddOns.push({
        serviceName: service.serviceName,
        price: service.price,
        quantity: qty,
        billingType: service.billingType,
        subtotal
      });
    }

    return { total, processedAddOns };
  }

  // --- Retrieval Methods ---

  async getGuestBookings(userId) {
    return BookingModel.find({ userId, guestDeleted: { $ne: true } })
      .populate('propertyId', 'name city country images type')
      .sort({ createdAt: -1 });
  }

  async getHostBookings(hostId) {
    const properties = await PropertyModel.find({ hostBy: hostId }).select('_id');
    const ids = properties.map(p => p._id);
    return BookingModel.find({ propertyId: { $in: ids }, hostDeleted: { $ne: true } })
      .populate('propertyId', 'name city type images')
      .populate('userId', 'username email phone')
      .sort({ createdAt: -1 });
  }

  async getHostPayments(hostId) {
    const properties = await PropertyModel.find({ hostBy: hostId }).select('_id');
    const ids = properties.map(p => p._id);
    return BookingModel.find({ propertyId: { $in: ids }, paymentStatus: 'paid' })
      .populate('propertyId', 'name images')
      .populate('userId', 'username')
      .sort({ updatedAt: -1 });
  }

  // --- Refund Logic ---

  async getRefundPreview(bookingId, userId) {
    const booking = await BookingModel.findById(bookingId).populate('propertyId');
    if (!booking || booking.userId.toString() !== userId.toString()) throw new Error("Unauthorized");
    return refundHelper.calculateRefund(booking);
  }

  async cancelWithRefund(bookingId, userId, reason) {
    const booking = await BookingModel.findById(bookingId).populate('propertyId');
    if (!booking || booking.userId.toString() !== userId.toString()) throw new Error("Unauthorized");

    const refundInfo = refundHelper.calculateRefund(booking);

    booking.bookingStatus = 'cancel';
    booking.refundStatus = refundInfo.refundAmount > 0 ? 'requested' : 'none';
    booking.refundAmount = refundInfo.refundAmount;
    booking.refundPercent = refundInfo.refundPercent;
    booking.refundReason = reason;
    booking.refundRequestedAt = new Date();

    // Reverse outstanding debt for cash bookings that are cancelled.
    // booking.debtRecorded is only true after the host confirmed cash receipt and
    // recordCashBookingDebt() ran — so we only reverse if the debt was actually recorded.
    if (booking.paymentMethod === 'arrival' && booking.debtRecorded) {
      const platformFee = Math.round((booking.totalPrice || 0) * PLATFORM_FEE_PERCENT / 100);
      await mongoose.model('UserAndHost').findByIdAndUpdate(booking.propertyId.hostBy, {
        $inc: { outstandingDebt: -platformFee }
      });
      booking.debtRecorded = false;
    }

    await booking.save();
    return { booking, refundInfo };
  }

  async getRefundRequests(hostId) {
    const properties = await PropertyModel.find({ hostBy: hostId }).select('_id');
    const ids = properties.map(p => p._id);
    return BookingModel.find({ propertyId: { $in: ids }, refundStatus: { $ne: 'none' } })
      .populate('propertyId', 'name images')
      .populate('userId', 'username email');
  }

  // --- Stats ---

  async getHostDashboardStats(hostId) {
    const properties = await PropertyModel.find({ hostBy: hostId }).select('_id');
    const ids = properties.map(p => p._id);

    const [all, hostData] = await Promise.all([
      BookingModel.find({ propertyId: { $in: ids } }),
      mongoose.model('UserAndHost').findById(hostId).select('outstandingDebt')
    ]);

    // "Active" = upcoming (confirmed) + currently in-house (staying).
    // The lifecycle cron flips confirmed → staying at check-in, so excluding
    // 'staying' here would drop the guests who are actually on-site right now.
    const activeBookings = all.filter(
      b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'staying'
    );
    
    // Revenue logic: Total Price minus any refund amount (requested, processing, or approved).
    // Cancelled bookings with any active refund status are excluded from earnings.
    const totalRevenue = all
      .filter(b => b.paymentStatus === 'paid')
      .reduce((acc, b) => {
        const gross = b.totalPrice || 0;
        const refund = ['requested', 'processing', 'approved'].includes(b.refundStatus) ? (b.refundAmount || 0) : 0;
        return acc + (gross - refund);
      }, 0);

    const pendingPayments = all.filter(
      b => b.paymentStatus === 'pending' && b.bookingStatus !== 'cancel'
    ).length;
    const totalProperties = properties.length;
    const occupancyRate = totalProperties > 0
      ? Math.min(100, Math.round((activeBookings.length / totalProperties) * 100))
      : 0;

    // Calculate total platform commission (10% of gross revenue)
    const totalCommission = Math.round(totalRevenue * PLATFORM_FEE_PERCENT / 100);

    const stats = {
      totalBookings: all.length,
      activeBookings: activeBookings.length,
      totalRevenue, // Gross
      totalEarnings: totalRevenue - totalCommission, // Net
      pendingPayments,
      totalProperties,
      occupancyRate,
      outstandingDebt: hostData?.outstandingDebt || 0,
      totalCommission,
      hostBalance: 0,
    };

    const recentBookings = await BookingModel.find({ propertyId: { $in: ids }, bookingStatus: { $ne: 'cancel' } })
      .populate('userId', 'username')
      .populate('propertyId', 'name images')
      .sort({ createdAt: -1 })
      .limit(5);

    return { stats, recentBookings };
  }
}

export default new BookingService();
