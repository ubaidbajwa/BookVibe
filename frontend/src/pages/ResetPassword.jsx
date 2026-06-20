/**
 * ResetPassword.jsx - New Password Entry Page
 *
 * Allows users to set a new password using a valid reset token from their email.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound } from 'lucide-react'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"

// ==========================================
// ResetPassword Component
// ==========================================

/**
 * ResetPassword - Renders the password reset form.
 * @returns {JSX.Element}
 */
const ResetPassword = () => {
    const nav = useNavigate()
    const { token } = useParams()

    // --- State ---
    const [pw, setPw] = useState('')
    const [cpw, setCpw] = useState('')
    const [loading, setLoading] = useState(false)

    // --- Handlers ---

    /**
     * handleSubmit - Processes the password reset submission.
     * @param {Event} e - Form submission event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (pw.length < 6) {
            return;
        }
        if (pw !== cpw) {
            return;
        }

        try {
            setLoading(true)
            await axios.post(`${BASE_URL}/user/reset-password/${token}`, {
                password: pw
            })
            nav('/login')
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
                    <KeyRound size={24} className="text-[var(--bv-gold)]" />
                </div>
                <h1 className="font-display text-2xl text-[var(--bv-text)]">Reset Password</h1>
                <p className="text-sm text-[var(--bv-text-muted)] mt-2 mb-6">Choose a new password.</p>
                
                <label className="bv-label">New Password</label>
                <input
                    type="password"
                    value={pw}
                    onChange={(e) => {
                        setPw(e.target.value)
                    }}
                    className="bv-input mb-4"
                    required
                />
                
                <label className="bv-label">Confirm Password</label>
                <input
                    type="password"
                    value={cpw}
                    onChange={(e) => {
                        setCpw(e.target.value)
                    }}
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
                            'Updating...'
                        ) : (
                            'Reset Password'
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

export default ResetPassword
