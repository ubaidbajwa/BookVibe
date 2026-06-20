// --- Imports ---

import Booking from '../models/BookingModel.js';
import Property from '../models/PropertyModel.js';

// --- Host Earnings Controllers ---

/**
 * Retrieves monthly earnings data for a host's properties for a given year.
 * Includes total revenue, booking counts, and average stay duration per month.
 * 
 * @async
 * @function getHostEarnings
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
const getHostEarnings = async (req, res) => {
  try {
    const hostProperties = await Property.find({
      hostBy: req.user._id
    }).select('_id');

    const propertyIds = hostProperties.map((p) => {
      return p._id;
    });

    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthlyData = await Booking.aggregate([
      {
        $match: {
          propertyId: {
            $in: propertyIds
          },
          paymentStatus: 'paid',
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: {
            month: {
              $month: '$createdAt'
            }
          },
          revenue: {
            $sum: {
              $subtract: [
                '$totalPrice',
                {
                  $cond: {
                    if: { $in: ['$refundStatus', ['requested', 'processing', 'approved']] },
                    then: { $ifNull: ['$refundAmount', 0] },
                    else: 0
                  }
                }
              ]
            }
          },
          bookings: {
            $sum: {
              $cond: [{ $ne: ['$bookingStatus', 'cancel'] }, 1, 0]
            }
          },
          avgStay: {
            $avg: '$stayDays'
          }
        }
      },
      {
        $sort: {
          '_id.month': 1
        }
      },
    ]);

    // Fill all 12 months
    const earnings = Array.from({
      length: 12
    }, (_, i) => {
      const found = monthlyData.find((d) => {
        return d._id.month === i + 1;
      });
      return {
        month: i + 1,
        revenue: found?.revenue || 0,
        bookings: found?.bookings || 0,
        avgStay: Math.round(found?.avgStay || 0)
      };
    });

    const totalRevenue = earnings.reduce((s, e) => {
      return s + e.revenue;
    }, 0);

    const totalBookings = earnings.reduce((s, e) => {
      return s + e.bookings;
    }, 0);

    const bestMonth = earnings.reduce((best, e) => {
      if (e.revenue > best.revenue) {
        return e;
      }
      return best;
    }, earnings[0]);

    return res.json({
      success: true,
      year,
      earnings,
      summary: {
        totalRevenue,
        totalBookings,
        bestMonth: bestMonth.month,
        bestMonthRevenue: bestMonth.revenue
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export {
  getHostEarnings
};
