/**
 * About.jsx - About Us Page
 *
 * Provides information about the company's story, mission, and impact.
 */

import { Star, Shield, MapPin, Users } from 'lucide-react'
import aboutPic from "../assets/images/about-pic.png";
import { ABOUT_HERO_SRC } from '../utils/publicPagePerf'

// ==========================================
// About Component
// ==========================================

/**
 * About - Renders the about page with hero, statistics, and mission sections.
 * @returns {JSX.Element}
 */
const About = () => {
    return (
        <div className="pt-20">
            {/* --- Hero Section --- */}
            <section className="relative h-[400px] md:h-[500px] overflow-hidden">
                <img
                    src={ABOUT_HERO_SRC}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--bv-bg)] via-[var(--bv-bg)]/80 to-transparent" />
                <div className="relative z-10 flex flex-col justify-center h-full max-w-7xl mx-auto px-6 sm:px-8">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">Our Story</p>
                    <h1 className="font-display text-4xl md:text-6xl text-[var(--bv-text)]">
                        About <span className="text-[var(--bv-gold)]">BookVibe</span>
                    </h1>
                    <p className="text-lg text-[var(--bv-text-muted)] mt-4 max-w-xl">
                        Connecting travelers with authentic local experiences since 2024.
                    </p>
                </div>
            </section>

            {/* --- Introduction Section --- */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="font-display text-3xl text-[var(--bv-text)] mb-6">
                        Redefining <span className="text-[var(--bv-gold)]">Travel</span>
                    </h2>
                    <p className="text-[var(--bv-text-muted)] leading-relaxed text-lg">
                        BookVibe was built to connect communities. We empower homeowners to share their spaces while giving travelers authentic, verified, and premium stays across Pakistan.
                    </p>
                </div>
            </section>

            {/* --- Statistics Section --- */}
            <section className="py-16 px-6 border-t border-b border-[var(--bv-border)]">
                <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {
                        [
                            { v: '10K+', l: 'Happy Travelers' },
                            { v: '2K+', l: 'Verified Hosts' },
                            { v: '50+', l: 'Cities' },
                            { v: '4.9/5', l: 'Rating' }
                        ].map(({ v, l }) => {
                            return (
                                <div key={l}>
                                    <p className="text-4xl font-bold text-[var(--bv-gold)]">{v}</p>
                                    <p className="text-[var(--bv-text-muted)] mt-2 text-sm">{l}</p>
                                </div>
                            )
                        })
                    }
                </div>
            </section>

            {/* --- Mission Section --- */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <img
                        src={aboutPic}
                        alt="About BookVibe"
                        className="rounded-3xl w-full h-[350px] object-cover shadow-[var(--bv-shadow-lg)]"
                    />
                    <div>
                        <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">Our Mission</p>
                        <h2 className="font-display text-3xl text-[var(--bv-text)] mb-4">
                            Trust, Transparency,<br />
                            <span className="text-[var(--bv-gold)]">Togetherness</span>
                        </h2>
                        <p className="text-[var(--bv-text-muted)] leading-relaxed">
                            Every stay on BookVibe is backed by CNIC verification, face matching, and real reviews. We believe travel should be safe, transparent, and meaningful.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default About
