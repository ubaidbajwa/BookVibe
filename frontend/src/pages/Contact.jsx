/**
 * Contact.jsx - Contact Us Page
 *
 * Allows users to send messages to the BookVibe support team.
 * Features a contact form and basic contact information.
 */

import { useState } from 'react'
import { Phone, Mail, MapPin, Loader2, Send } from 'lucide-react'
import axios from 'axios'
import { CONTACT_HERO_SRC } from '../utils/publicPagePerf'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// ==========================================
// Contact Component
// ==========================================

/**
 * Contact - Renders the contact page with a form and info sections.
 * @returns {JSX.Element}
 */
const Contact = () => {
    // --- State ---
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    // --- Handlers ---

    /**
     * handleSubmit - Processes the contact form submission.
     * @param {Event} e - Form submission event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!name.trim() || !email.trim() || !message.trim()) {
            return;
        }

        try {
            setLoading(true)
            await axios.post(`${BASE_URL}/user/contact`, {
                name: name.trim(),
                email: email.trim(),
                message: message.trim()
            })
            setName('')
            setEmail('')
            setMessage('')
        } catch {
            // error silently handled
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="pt-20">
            {/* --- Hero Section --- */}
            <section className="relative h-[350px] overflow-hidden">
                <img
                    src={CONTACT_HERO_SRC}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
                <div className="absolute inset-0 bg-[var(--bv-bg)]/80" />
                <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">Reach Out</p>
                    <h1 className="font-display text-4xl md:text-5xl text-[var(--bv-text)]">Get in Touch</h1>
                </div>
            </section>

            {/* --- Content Section --- */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
                    {/* --- Contact Form --- */}
                    <div className="bv-card-static p-8">
                        <h2 className="font-display text-2xl text-[var(--bv-gold)] mb-6">Send a Message</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="bv-label">Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                    }}
                                    placeholder="Your name"
                                    required
                                    className="bv-input"
                                />
                            </div>
                            <div>
                                <label className="bv-label">Email *</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                    }}
                                    placeholder="you@example.com"
                                    required
                                    className="bv-input"
                                />
                            </div>
                            <div>
                                <label className="bv-label">Message *</label>
                                <textarea
                                    rows="4"
                                    value={message}
                                    onChange={(e) => {
                                        setMessage(e.target.value)
                                    }}
                                    placeholder="Your message..."
                                    required
                                    className="bv-input resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
                            >
                                {
                                    loading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" /> Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} /> Send Message
                                        </>
                                    )
                                }
                            </button>
                        </form>
                    </div>

                    {/* --- Contact Info --- */}
                    <div className="flex flex-col justify-center space-y-8">
                        <div>
                            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Contact Info</p>
                            <p className="text-[var(--bv-text-muted)] leading-relaxed text-sm mb-6">
                                Questions, feedback, or partnerships — we're here.
                            </p>
                        </div>
                        {
                            [
                                { i: Phone, t: '+92 300 1234567' },
                                { i: Mail, t: 'support@bookvibe.com' },
                                { i: MapPin, t: 'Lahore, Pakistan' }
                            ].map(({ i: I, t }) => {
                                return (
                                    <div key={t} className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center flex-shrink-0">
                                            <I size={16} className="text-[var(--bv-gold)]" />
                                        </div>
                                        <p className="text-[var(--bv-text)]">{t}</p>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Contact
