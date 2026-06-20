/**
 * Faqs.jsx
 *
 * Accordion FAQ section rendered on the home page. Each item can be toggled
 * open or closed independently — only one item is expanded at a time (clicking
 * an already-open item collapses it). The expand/collapse transition is driven
 * entirely via Tailwind max-height utilities.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/** Static FAQ data — questions and answers about the BookVibe platform. */
const faqs = [
    {
        q: 'How do I book a stay?',
        a: 'Search your destination, pick dates, browse properties and confirm with one click. Payment is handled securely via Stripe.',
    },
    {
        q: 'Can I cancel my booking?',
        a: 'Yes, manage bookings through your profile. Many listings offer free cancellation before check-in date.',
    },
    {
        q: 'Is my payment secure?',
        a: 'All transactions use SSL encryption and are processed through Stripe — a PCI-compliant payment gateway.',
    },
    {
        q: 'How do I list my property?',
        a: 'Register as a host, add property details, upload photos, set pricing. Once verified via KYC, your listing goes live.',
    },
    {
        q: 'What is CNIC verification?',
        a: 'For security, we verify identity via CNIC OCR, liveness detection, and face matching. This protects both hosts and guests.',
    },
    {
        q: 'Do you provide customer support?',
        a: 'Our support team is available 24/7 to help with bookings, payments, or any questions. Use the contact page or in-app chat.',
    },
]

const Faqs = () => {
    /**
     * @state open — index of the currently expanded FAQ item, or null if all collapsed.
     * Single-open accordion: toggling the active item collapses it.
     */
    const [open, setOpen] = useState(null)

    return (
        <section className="py-20 px-6">
            <div className="max-w-3xl mx-auto">
                {/* Section header */}
                <div className="text-center mb-12">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">
                        FAQ
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)]">
                        Common Questions
                    </h2>
                </div>

                {/* Accordion list */}
                <div className="space-y-3">
                    {faqs.map((f, i) => (
                        <div key={i} className="bv-card-static overflow-hidden">
                            {/* Toggle button — clicking it either opens or collapses the item */}
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full flex items-center justify-between px-6 py-5 text-left"
                            >
                                <span className="text-sm font-semibold text-[var(--bv-text)] pr-4">
                                    {f.q}
                                </span>
                                {/* Chevron rotates 180° when the item is open */}
                                <ChevronDown
                                    size={16}
                                    className={`text-[var(--bv-gold)] transition-transform flex-shrink-0 ${open === i ? '-rotate-180' : ''}`}
                                />
                            </button>

                            {/* Collapsible answer panel — max-height transition from 0 to 10rem */}
                            <div
                                className={`overflow-hidden transition-all duration-300 ${open === i ? 'max-h-40' : 'max-h-0'}`}
                            >
                                <p className="px-6 pb-5 text-sm text-[var(--bv-text-muted)] leading-relaxed">
                                    {f.a}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Faqs
