/**
 * @file priceCalculator.js
 * @description Smart Price Calculator
 *
 * Automatically picks the best rate for the guest based on stay duration.
 * Logic:
 *   1-6 nights  → nightly rate
 *   7-29 nights → weekly packages + remaining nightly
 *   30+ nights  → monthly packages + remaining weekly/nightly
 *
 * Always picks the CHEAPEST combination for the guest.
 */

// --- Price Calculation ---

/**
 * @function calculatePrice
 * @description Automatically picks the best rate for the guest based on stay duration.
 * @param {Object} property - The property object containing pricing details.
 * @param {number} stayDays - The number of days for the stay.
 * @param {string} [subUnitId] - Selected sub-unit ID for Hotels/Hostels.
 * @param {Array} [selectedAddOns] - Array of {serviceName, quantity} objects.
 * @returns {Object} An object containing the total price, breakdown, savings, and rate type.
 */
export const calculatePrice = (property, stayDays, subUnitId = null, selectedAddOns = []) => {
  let nightly = property.pricing?.nightly || property.price || 0;
  let weekly = property.pricing?.weekly || nightly * 7;
  let monthly = property.pricing?.monthly || nightly * 30;
  let stayTypes = property.stayTypes || ['nightly'];

  if (subUnitId && property.subUnits?.length > 0) {
    const unit = property.subUnits.find(u => u._id === subUnitId || u._id.toString() === subUnitId.toString());
    if (unit) {
      nightly = unit.basePrice;
      weekly = unit.pricing?.weekly || nightly * 7;
      monthly = unit.pricing?.monthly || nightly * 30;
      stayTypes = unit.stayTypes || ['nightly'];
    }
  }

  if (stayDays <= 0) {
    return { total: 0, breakdown: [], savings: 0, rateType: "nightly", perNight: nightly };
  }

  // Simple nightly calculation
  const simpleTotal = nightly * stayDays;
  let bestTotal = simpleTotal;
  let bestBreakdown = [
    {
      label: `${stayDays} night${stayDays > 1 ? "s" : ""} × PKR ${nightly.toLocaleString()}`,
      amount: simpleTotal,
    },
  ];
  let bestRateType = "nightly";

  // Best combination logic (Now supports both single-unit and sub-units)
  if (stayTypes.includes('weekly') && stayDays >= 7) {
    const weeks = Math.floor(stayDays / 7);
    const remainingDays = stayDays % 7;
    const weeklyTotal = weeks * weekly + remainingDays * nightly;

    if (weeklyTotal < bestTotal) {
      bestTotal = weeklyTotal;
      bestRateType = "weekly_package";
      bestBreakdown = [
        {
          label: `${weeks} week${weeks > 1 ? "s" : ""} × PKR ${weekly.toLocaleString()}`,
          amount: weeks * weekly,
        },
      ];
      if (remainingDays > 0) {
        bestBreakdown.push({
          label: `${remainingDays} night${remainingDays > 1 ? "s" : ""} × PKR ${nightly.toLocaleString()}`,
          amount: remainingDays * nightly,
        });
      }
    }
  }

  if (stayTypes.includes('monthly') && stayDays >= 30) {
    const months = Math.floor(stayDays / 30);
    const remainingAfterMonth = stayDays % 30;
    
    // Monthly can be combined with weekly or nightly
    let subCalc;
    if (stayTypes.includes('weekly') && remainingAfterMonth >= 7) {
      const weeks = Math.floor(remainingAfterMonth / 7);
      const days = remainingAfterMonth % 7;
      subCalc = { total: weeks * weekly + days * nightly, type: "monthly_weekly" };
    } else {
      subCalc = { total: remainingAfterMonth * nightly, type: "monthly_nightly" };
    }

    const monthlyTotal = months * monthly + subCalc.total;

    if (monthlyTotal < bestTotal) {
      bestTotal = monthlyTotal;
      bestRateType = "monthly_package";
      bestBreakdown = [
        {
          label: `${months} month${months > 1 ? "s" : ""} × PKR ${monthly.toLocaleString()}`,
          amount: months * monthly,
        },
      ];
      if (remainingAfterMonth > 0) {
        if (subCalc.type === "monthly_weekly") {
          const weeks = Math.floor(remainingAfterMonth / 7);
          const days = remainingAfterMonth % 7;
          bestBreakdown.push({
            label: `${weeks} week${weeks > 1 ? "s" : ""} × PKR ${weekly.toLocaleString()}`,
            amount: weeks * weekly,
          });
          if (days > 0) {
            bestBreakdown.push({
              label: `${days} night${days > 1 ? "s" : ""} × PKR ${nightly.toLocaleString()}`,
              amount: days * nightly,
            });
          }
        } else {
          bestBreakdown.push({
            label: `${remainingAfterMonth} night${remainingAfterMonth > 1 ? "s" : ""} × PKR ${nightly.toLocaleString()}`,
            amount: remainingAfterMonth * nightly,
          });
        }
      }
    }
  }

  // ── ADD-ON SERVICES CALCULATION ──
  let addOnsTotal = 0;
  const addOnsBreakdown = [];

  if (selectedAddOns && selectedAddOns.length > 0) {
    for (const selection of selectedAddOns) {
      const service = property.addOnServices?.find(s => s.serviceName === selection.serviceName);
      if (!service) continue;

      let serviceTotal = 0;
      const qty = selection.quantity || 1;

      switch (service.billingType) {
        case 'per_day':
          serviceTotal = service.price * stayDays * qty;
          addOnsBreakdown.push({
            label: `${service.serviceName} (${qty}x) × ${stayDays} days`,
            amount: serviceTotal
          });
          break;
        case 'per_stay':
          serviceTotal = service.price * qty;
          addOnsBreakdown.push({
            label: `${service.serviceName} (fixed stay charge)`,
            amount: serviceTotal
          });
          break;
        case 'per_item':
          serviceTotal = service.price * qty;
          addOnsBreakdown.push({
            label: `${service.serviceName} (${qty} units)`,
            amount: serviceTotal
          });
          break;
        default:
          serviceTotal = service.price * qty;
      }
      addOnsTotal += serviceTotal;
    }
  }

  const finalTotal = bestTotal + addOnsTotal;
  const savings = simpleTotal - bestTotal;

  return {
    total: finalTotal,
    accommodationTotal: bestTotal,
    addOnsTotal,
    breakdown: [...bestBreakdown, ...addOnsBreakdown],
    savings,
    rateType: bestRateType,
    perNight: nightly,
  };
};

// --- Pricing Display ---

/**
 * @function getPricingDisplay
 * @description Get display-friendly pricing tiers.
 * @param {Object} property - The property object.
 * @returns {Array} An array of pricing tier objects.
 */
export const getPricingDisplay = (property, subUnitId = null) => {
  const tiers = [];
  
  let source = property;
  if (subUnitId && property.subUnits?.length > 0) {
    const unit = property.subUnits.find(u => u._id === subUnitId || u._id.toString() === subUnitId.toString());
    if (unit) source = unit;
  }

  const nightly = source.pricing?.nightly || source.price || source.basePrice;
  const stayTypes = source.stayTypes || ['nightly'];

  if (nightly) {
    tiers.push({
      type: "nightly",
      label: "Per Night",
      price: nightly,
      per: "night",
    });
  }

  if (stayTypes.includes('weekly') && source.pricing?.weekly) {
    const weeklyPerNight = Math.round(source.pricing.weekly / 7);
    let discount = 0;
    if (nightly) {
      discount = Math.round(((nightly - weeklyPerNight) / nightly) * 100);
    }
    tiers.push({
      type: "weekly",
      label: "Weekly",
      price: source.pricing.weekly,
      per: "week",
      perNight: weeklyPerNight,
      discount: discount,
    });
  }

  if (stayTypes.includes('monthly') && source.pricing?.monthly) {
    const monthlyPerNight = Math.round(source.pricing.monthly / 30);
    let discount = 0;
    if (nightly) {
      discount = Math.round(((nightly - monthlyPerNight) / nightly) * 100);
    }
    tiers.push({
      type: "monthly",
      label: "Monthly",
      price: source.pricing.monthly,
      per: "month",
      perNight: monthlyPerNight,
      discount: discount,
    });
  }

  return tiers;
};
