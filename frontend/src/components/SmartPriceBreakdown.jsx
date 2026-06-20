/**
 * @file SmartPriceBreakdown.jsx
 * @description Dynamic Price Breakdown Component
 *
 * This component provides a detailed cost breakdown for a property stay based on the
 * number of selected nights. It utilizes a pricing utility to calculate nightly,
 * weekly, or monthly rates and displays line items, savings, and the final total.
 */

import { calculatePrice } from '../utils/priceCalculator';
import { TrendingDown, Sparkles } from 'lucide-react';

/* ── MAIN COMPONENT ── */

/**
 * @function SmartPriceBreakdown
 * @description Renders a detailed breakdown of the total price, including taxes and discounts.
 * @param {Object} props - Component properties.
 * @param {Object} props.property - The property object containing pricing tiers.
 * @param {number} props.stayDays - The number of nights for the stay.
 * @param {string} [props.subUnitId] - Optional selected sub-unit ID.
 * @param {Array} [props.selectedAddOns] - Optional array of selected add-on services.
 * @returns {JSX.Element|null} The rendered price breakdown or null if no duration is selected.
 */
const SmartPriceBreakdown = ({ property, stayDays, subUnitId = null, selectedAddOns = [] }) => {
  // Nothing to show if a duration hasn't been selected yet
  if (!stayDays || stayDays <= 0) {
    return null;
  }

  // Delegate all pricing logic to the utility — this component only handles rendering
  const result = calculatePrice(property, stayDays, subUnitId, selectedAddOns);

  return (
    <div className="border-t border-[var(--bv-divider)] pt-4 mb-4 space-y-2">
      {/* Breakdown line items (e.g., "7 nights × PKR X", "Weekly rate") */}
      {result.breakdown.map((item, i) => {
        return (
          <div
            key={i}
            className="flex justify-between text-sm text-[var(--bv-text-muted)]"
          >
            <span>{item.label}</span>
            <span className="text-[var(--bv-text)]">
              PKR {item.amount.toLocaleString()}
            </span>
          </div>
        );
      })}

      {/* Savings badge — shown when a discount rate was applied */}
      {result.savings > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-500/8 border border-emerald-500/15 rounded-xl">
          <TrendingDown size={14} className="text-[var(--bv-success)]" />
          <span className="text-xs font-bold text-[var(--bv-success)]">
            You save PKR {result.savings.toLocaleString()} with {result.rateType} rate!
          </span>
        </div>
      )}

      {/* Total row */}
      <div className="flex justify-between font-bold text-lg text-[var(--bv-gold)] pt-2 border-t border-[var(--bv-divider)]">
        <span>Total</span>
        <span>PKR {result.total.toLocaleString()}</span>
      </div>

      {/* Best rate indicator — shown when weekly or monthly rate was auto-applied */}
      {result.rateType !== 'nightly' && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--bv-gold)]">
          <Sparkles size={10} /> Best rate auto-applied
        </div>
      )}
    </div>
  );
};

export default SmartPriceBreakdown;
