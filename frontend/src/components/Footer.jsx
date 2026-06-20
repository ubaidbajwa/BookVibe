/**
 * @file Footer.jsx
 * @description Site-wide footer rendered on all public pages. Contains:
 * - Brand logo and tagline.
 * - Four navigation link groups (Explore, Company, Support, Legal).
 * - Copyright line and social media links.
 *
 * Links use `warmPublicPage` on hover/focus to prefetch the target page bundle
 * so the navigation feels instant.
 */

import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { warmPublicPage } from '../utils/publicPagePerf'

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

/** 
 * Link groups rendered in the footer grid. 
 */
const linkGroups = [
  {
    title: 'Explore',
    links: [
      ['Rooms', '/property/Room'],
      ['Homes', '/property/Home'],
      ['Apartments', '/property/Apartment'],
      ['All Properties', '/view-all-properties'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Services', '/services'],
      ['Contact', '/contact'],
    ],
  },
  {
    title: 'Support',
    links: [
      ['Help Center', '#'],
      ['Cancellation', '#'],
      ['FAQs', '#'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy', '#'],
      ['Terms', '#'],
      ['Cookies', '#'],
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

/**
 * @component Footer
 * @description Standard site footer.
 */
const Footer = () => {
  return (
    <footer className="public-footer bg-[var(--bv-bg-raised)] border-t border-[var(--bv-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* Top section: brand block + navigation groups */}
        <div className="flex flex-col lg:flex-row lg:justify-between gap-10 sm:gap-12 mb-10 sm:mb-12 pb-10 sm:pb-12 border-b border-[var(--bv-divider)]">
          {/* Brand block */}
          <div className="lg:max-w-xs text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                <Sparkles size={16} className="text-[var(--bv-bg)]" />
              </div>
              <span className="font-display text-xl text-[var(--bv-text)]">
                Book<span className="text-[var(--bv-gold)]">Vibe</span>
              </span>
            </Link>
            <p className="text-[var(--bv-text-muted)] text-sm leading-relaxed">
              Premium stays across Pakistan. Discover luxury rooms, homes, and apartments
              with world-class hospitality.
            </p>
          </div>

          {/* Navigation link groups */}
          <div className="grid grid-cols-2 gap-6 sm:gap-8 sm:grid-cols-4">
            {linkGroups.map((group) => {
              return (
                <div key={group.title} className="text-left">
                  <h4 className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
                    {group.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {group.links.map(([label, to]) => {
                      return (
                        <li key={label}>
                          <Link
                            to={to}
                            onMouseEnter={() => {
                              warmPublicPage(to)
                            }}
                            onFocus={() => {
                              warmPublicPage(to)
                            }}
                            className="text-sm text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition-colors"
                          >
                            {label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom bar: copyright + social links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-xs text-[var(--bv-text-dim)]">
            &copy; {new Date().getFullYear()} BookVibe. All rights reserved.
          </p>

          <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
            {['Facebook', 'Twitter', 'Instagram'].map((social) => {
              return (
                <a
                  key={social}
                  href="#"
                  className="text-xs text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] transition-colors"
                >
                  {social}
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
