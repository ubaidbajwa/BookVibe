/**
 * ForgotPassword.jsx - Password Recovery Page
 *
 * Allows users to request a password reset link by providing their email address.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"

// ==========================================
// ForgotPassword Component
// ==========================================

/**
 * ForgotPassword - Renders the password recovery request form.
 * @returns {JSX.Element}
 */
const ForgotPassword = () => {
    // --- State ---
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)

    // --- Handlers ---

    /**
     * handleSubmit - Processes the password reset request.
     * @param {Event} e - Form submission event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            await axios.post(`${BASE_URL}/user/forgot-password`, {
                email
            })
        } catch {
            // error silently handled
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <form onSubmit={handleSubmit} className="w-full max-w-sm bv-card-static p-8 bv-animate-in">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center mb-5">
                    <Mail size={24} className="text-[var(--bv-gold)]" />
                </div>
                <h1 className="font-display text-2xl text-[var(--bv-text)]">Forgot Password</h1>
                <p className="text-sm text-[var(--bv-text-muted)] mt-2 mb-6">Enter your email for a reset link.</p>
                
                <label className="bv-label">Email Address</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value)
                    }}
                    placeholder="name@example.com"
                    className="bv-input mb-5"
                    required
                />
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bv-btn-gold py-3 text-sm"
                >
                    {
                        loading ? (
                            'Sending...'
                        ) : (
                            'Continue'
                        )
                    }
                </button>
                
                <Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--bv-gold)] font-semibold">
                    <ArrowLeft size={15} /> Back to login
                </Link>
            </form>
        </div>
    )
}

export default ForgotPassword
