/**
 * @file PricingTiers.jsx
 * @description Displays the available pricing plans for a property, highlighting nightly,
 * weekly, and monthly rates. It provides a visual comparison of different stay tiers
 * and automatically identifies available discounts and per-night equivalents.
 */

import { Moon, Calendar, CalendarRange, TrendingDown } from 'lucide-react';
import { getPricingDisplay } from '../utils/priceCalculator';

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Maps a tier type string to its corresponding Lucide icon component.
 */
const iconMap = {
  nightly: Moon,
  weekly: Calendar,
  monthly: CalendarRange,
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

/**
 * @component PricingTiers
 * @description PricingTiers Component for comparing stay durations and rates.
 * @param {Object} props - Component properties.
 * @param {Object} props.property - The full property object.
 * @returns {JSX.Element|null} The PricingTiers component or null.
 */
const PricingTiers = ({ property }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    LOGIC                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Array of pricing tiers derived from the property data.
   */
  const tiers = getPricingDisplay(property);

  // Only render the component when there are at least two tiers to compare
  if (tiers.length <= 1) {
    return null;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="bv-card-static p-6">
      <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Pricing Plans</h3>

      {/* Responsive tier grid — 2 columns for 2 tiers, 3 columns for 3 tiers */}
      <div className={`grid gap-3 ${tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {tiers.map((tier) => {
          const Icon = iconMap[tier.type] || Moon;

          return (
            <div
              key={tier.type}
              className={`relative p-4 rounded-xl border transition-all ${
                tier.type === 'monthly'
                  ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]'
                  : 'border-[var(--bv-border)] bg-[var(--bv-bg)]'
              }`}
            >
              {/* Discount badge — only shown when a discount applies */}
              {tier.discount > 0 && (
                <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-[var(--bv-success)] text-white text-[10px] font-bold rounded-full shadow-sm">
                  <TrendingDown size={10} /> {tier.discount}% OFF
                </div>
              )}

              {/* Tier icon */}
              <Icon
                size={18}
                className={`mb-2 ${tier.type === 'monthly' ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'}`}
              />

              {/* Tier label */}
              <p className="text-xs text-[var(--bv-text-dim)] font-bold uppercase tracking-wider">{tier.label}</p>

              {/* Price */}
              <p className="text-xl font-black text-[var(--bv-text)] mt-1">PKR {tier.price.toLocaleString()}</p>

              {/* Billing period */}
              <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">/ {tier.per}</p>

              {/* Equivalent per-night cost for weekly/monthly tiers */}
              {tier.perNight && (
                <p className="text-[10px] text-[var(--bv-gold)] font-semibold mt-1">
                  ≈ PKR {tier.perNight.toLocaleString()}/night
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Minimum stay notice */}
      {property.minStay > 1 && (
        <p className="text-[10px] text-[var(--bv-text-dim)] mt-3">Minimum stay: {property.minStay} nights</p>
      )}
    </div>
  );
};

export default PricingTiers;
