/**
 * BecomeHost.jsx
 *
 * Promotional banner section aimed at property owners. Renders a full-bleed
 * background image with an overlaid marketing copy block, feature highlights
 * (icons + labels), and a CTA button that navigates to the signup page.
 */

import { ArrowRight, TrendingUp, Shield, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BecomeHost = () => {
    const nav = useNavigate()

    return (
        <section className="py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="relative rounded-3xl overflow-hidden">
                    {/* Background image for the promotional banner */}
                    <img
                        src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80"
                        alt=""
                        className="w-full h-[420px] object-cover"
                    />

                    {/* Dark gradient overlay to make text readable over the image */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0C0C0E] via-[#0C0C0E]/80 to-transparent" />

                    {/* Content block positioned over the image */}
                    <div className="absolute inset-0 flex items-center px-8 sm:px-16">
                        <div className="max-w-lg">
                            {/* Eyebrow label */}
                            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
                                For Property Owners
                            </p>

                            {/* Headline */}
                            <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight">
                                Turn Your Space Into<br />
                                <span className="text-[var(--bv-gold)]">Revenue</span>
                            </h2>

                            {/* Subtext */}
                            <p className="text-[var(--bv-text-muted)] mt-4 text-sm leading-relaxed max-w-md">
                                Join our network of verified hosts. List your property, set your rates,
                                and start earning from travelers across Pakistan.
                            </p>

                            {/* Feature highlights — icon + label pairs */}
                            <div className="flex flex-wrap gap-6 mt-6 mb-8">
                                {[
                                    { i: TrendingUp, t: 'Earn More' },
                                    { i: Shield, t: 'Verified Guests' },
                                    { i: Users, t: 'Community' },
                                ].map(({ i: Icon, t }) => (
                                    <div key={t} className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center">
                                            <Icon size={14} className="text-[var(--bv-gold)]" />
                                        </div>
                                        <span className="text-sm text-white/80">{t}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA — navigates to signup so the user can register as a host */}
                            <button
                                onClick={() => nav('/signup')}
                                className="bv-btn-gold inline-flex items-center gap-2 text-sm px-8 py-3.5"
                            >
                                Start Hosting <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default BecomeHost
