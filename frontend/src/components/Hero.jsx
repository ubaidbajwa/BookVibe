/**
 * @file Hero.jsx
 * @description Full-viewport hero section rendered at the top of the Home page. Displays a
 * background image with layered gradient overlays, a headline block, two CTA
 * buttons, and three floating stat cards on large screens.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Star, Shield, MapPin } from 'lucide-react'

/**
 * @component Hero
 * @description Main landing page hero section.
 */
const Hero = () => {
  /* -------------------------------------------------------------------------- */
  /*                                    Hooks                                   */
  /* -------------------------------------------------------------------------- */

  const navigate = useNavigate()

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* --- Background --- */}
      <div className="absolute inset-0">
        {/* Hero background image */}
        <img
          src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=2000&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Left-to-right gradient — darkens left side for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0C0C0E] via-[#0C0C0E]/85 to-transparent" />
        {/* Top/bottom gradient — vignette for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0E] via-transparent to-[#0C0C0E]/30" />
      </div>

      {/* --- Foreground content --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 py-32 w-full">
        <div className="max-w-2xl">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] mb-8 bv-animate-in">
            <Star size={12} className="text-[var(--bv-gold)]" />
            <span className="text-xs font-semibold text-[var(--bv-gold-light)] tracking-wide">
              TRUSTED BY 10,000+ TRAVELERS
            </span>
          </div>

          {/* Main headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-[var(--bv-text)] leading-[1.1] tracking-tight bv-animate-in bv-stagger-1">
            Where Luxury<br />
            <span className="text-[var(--bv-gold)]">Meets Home</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg text-[var(--bv-text-muted)] leading-relaxed max-w-lg bv-animate-in bv-stagger-2">
            Discover handpicked stays across Pakistan — from mountain retreats to urban
            penthouses. Every booking, an experience.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-10 bv-animate-in bv-stagger-3">
            <button
              onClick={() => {
                navigate('/view-all-properties')
              }}
              className="bv-btn-gold text-sm px-8 py-3.5 inline-flex items-center gap-2"
            >
              Explore Stays <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                navigate('/signup')
              }}
              className="bv-btn-outline text-sm px-8 py-3.5"
            >
              Become a Host
            </button>
          </div>
        </div>

        {/* Floating stat cards — only shown on large screens */}
        <div className="hidden lg:flex absolute right-8 bottom-24 gap-4 bv-animate-in bv-stagger-4">
          {[
            { icon: Star, val: '4.9', label: 'Avg Rating', color: 'text-[var(--bv-gold)]' },
            { icon: MapPin, val: '50+', label: 'Cities', color: 'text-[var(--bv-gold)]' },
            { icon: Shield, val: '100%', label: 'Verified', color: 'text-[var(--bv-success)]' },
          ].map(({ icon: Icon, val, label, color }) => {
            return (
              <div
                key={label}
                className="bg-[var(--bv-card)]/80 backdrop-blur-md border border-[var(--bv-border)] rounded-2xl p-5 w-36 text-center shadow-[var(--bv-shadow-md)]"
              >
                <Icon size={18} className={`${color} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-[var(--bv-text)]">{val}</p>
                <p className="text-xs text-[var(--bv-text-dim)] mt-1">{label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom fade into the page background */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bv-bg)] to-transparent" />
    </section>
  )
}

export default Hero
