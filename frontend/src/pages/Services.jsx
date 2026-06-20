/**
 * Services.jsx - Our Services Page
 *
 * Detailed breakdown of the services provided by BookVibe to travelers and hosts.
 */

import { Home, Shield, Headphones, MapPin, Users, CreditCard } from 'lucide-react'

// ==========================================
// Constants
// ==========================================

const services = [
    { icon: Home, title: 'Premium Stays', desc: 'Verified rooms, apartments, and full homes across Pakistan.' },
    { icon: Shield, title: 'KYC Verification', desc: 'CNIC OCR, liveness detection, and face matching for security.' },
    { icon: CreditCard, title: 'Secure Payments', desc: 'Stripe-powered payments with refund protection.' },
    { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support for hosts and guests anytime.' },
    { icon: MapPin, title: 'City Discovery', desc: 'Explore hidden gems and local stays in 50+ cities.' },
    { icon: Users, title: 'Host Community', desc: 'Earn from your property with our verified host network.' },
]

// ==========================================
// Services Component
// ==========================================

/**
 * Services - Renders the services showcase page.
 * @returns {JSX.Element}
 */
const Services = () => {
    return (
        <div className="pt-20">
            {/* --- Hero Section --- */}
            <section className="relative h-[350px] overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[var(--bv-bg)]/80" />
                <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">What We Offer</p>
                    <h1 className="font-display text-4xl md:text-5xl text-[var(--bv-text)]">Our Services</h1>
                    <p className="text-[var(--bv-text-muted)] mt-3 max-w-xl">More than a stay — an experience.</p>
                </div>
            </section>

            {/* --- Services Grid --- */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {
                        services.map((s, i) => {
                            return (
                                <div key={i} className="bv-card p-8 text-center group">
                                    <div className="w-14 h-14 rounded-2xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center mx-auto mb-5 group-hover:shadow-[var(--bv-shadow-gold)] transition">
                                        <s.icon size={22} className="text-[var(--bv-gold)]" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[var(--bv-text)] mb-2">{s.title}</h3>
                                    <p className="text-sm text-[var(--bv-text-muted)]">{s.desc}</p>
                                </div>
                            )
                        })
                    }
                </div>
            </section>
        </div>
    )
}

export default Services
