/**
 * VerifyOTP.jsx - Two-Factor / Email Verification Page
 *
 * Features a multi-input OTP field with auto-focus, paste support,
 * and a cooldown-managed resend mechanism.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axios from 'axios'
import { ShieldCheck, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react'
import { login as loginAction } from '../redux/slices/authSlice'

// ==========================================
// Constants & Configuration
// ==========================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const LEN = 6
const COOLDOWN = 60

// ==========================================
// VerifyOTP Component
// ==========================================

/**
 * VerifyOTP - Renders the 6-digit OTP verification interface.
 * @returns {JSX.Element}
 */
const VerifyOTP = () => {
    const nav = useNavigate()
    const loc = useLocation()
    const dispatch = useDispatch()
    const email = loc.state?.email || ''

    // --- State ---
    const [otp, setOtp] = useState(Array(LEN).fill(''))
    const [loading, setLoading] = useState(false)
    const [resending, setResending] = useState(false)
    const [cd, setCd] = useState(COOLDOWN)
    const [canResend, setCanResend] = useState(false)
    
    // --- Refs ---
    const refs = useRef([])

    // --- Effects ---

    /**
     * Effect: Validate session presence.
     */
    useEffect(
        () => {
            if (!email) {
                nav('/signup', { replace: true })
            }
        },
        // Dependencies
        [email, nav]
    )

    /**
     * Effect: Manage resend cooldown timer.
     */
    useEffect(
        () => {
            if (cd <= 0) {
                setCanResend(true)
                return
            }
            const t = setTimeout(() => {
                setCd((c) => {
                    return c - 1
                })
            }, 1000)
            return () => {
                return clearTimeout(t)
            }
        },
        // Dependencies
        [cd]
    )

    // --- Handlers ---

    /**
     * handleChange - Processes input into an OTP digit slot.
     * @param {number} i - Index of the input.
     * @param {string} v - Input value.
     */
    const handleChange = (i, v) => {
        if (!/^\d*$/.test(v)) {
            return
        }
        const n = [...otp]
        n[i] = v.slice(-1)
        setOtp(n)

        if (v && i < LEN - 1) {
            refs.current[i + 1]?.focus()
        }
        if (n.every((d) => {
            return d
        })) {
            handleVerify(n.join(''))
        }
    }

    /**
     * handleKey - Handles backspace navigation between OTP inputs.
     * @param {number} i - Index of the input.
     * @param {Event} e - Keyboard event.
     */
    const handleKey = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) {
            refs.current[i - 1]?.focus()
        }
    }

    /**
     * handlePaste - Handles clipboard pasting of the entire OTP.
     * @param {Event} e - Paste event.
     */
    const handlePaste = (e) => {
        e.preventDefault()
        const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
        if (!p) {
            return
        }
        const n = Array(LEN).fill('')
        p.split('').forEach((d, i) => {
            n[i] = d
        })
        setOtp(n)
        if (p.length === LEN) {
            handleVerify(p)
        }
    }

    /**
     * handleVerify - Calls the backend to verify the OTP.
     * @param {string} str - The 6-digit OTP string.
     */
    const handleVerify = async (str = otp.join('')) => {
        if (str.length !== LEN) {
            return;
        }
        try {
            setLoading(true)
            const res = await axios.post(
                `${BASE_URL}/user/verify-otp`,
                { email, otp: str },
                { withCredentials: true }
            )
            if (res.data.success) {
                dispatch(loginAction.fulfilled(res.data, '', {}))
                nav('/', { replace: true })
            }
        } catch {
            setOtp(Array(LEN).fill(''))
            refs.current[0]?.focus()
        } finally {
            setLoading(false)
        }
    }

    /**
     * handleResend - Requests a new OTP for the user.
     */
    const handleResend = async () => {
        if (!canResend) {
            return
        }
        try {
            setResending(true)
            await axios.post(`${BASE_URL}/user/resend-otp`, {
                email
            })
            setOtp(Array(LEN).fill(''))
            setCd(COOLDOWN)
            setCanResend(false)
        } catch {
            // error silently handled
        } finally {
            setResending(false)
        }
    }

    const filled = otp.filter((d) => {
        return d
    }).length

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bv-animate-in">
                <div className="bv-card-static p-8">
                    {/* --- Header --- */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center mb-4">
                            <ShieldCheck size={32} className="text-[var(--bv-gold)]" />
                        </div>
                        <h1 className="font-display text-2xl text-[var(--bv-text)] text-center">Verify your email</h1>
                        <p className="text-sm text-[var(--bv-text-muted)] text-center mt-2">
                            Code sent to <span className="font-semibold text-[var(--bv-gold)]">{email}</span>
                        </p>
                    </div>

                    {/* --- OTP Inputs --- */}
                    <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                        {
                            otp.map((d, i) => {
                                return (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            return (refs.current[i] = el)
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={d}
                                        onChange={(e) => {
                                            return handleChange(i, e.target.value)
                                        }}
                                        onKeyDown={(e) => {
                                            return handleKey(i, e)
                                        }}
                                        disabled={loading}
                                        className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-[var(--bv-bg)] ${d ? 'border-[var(--bv-gold)] text-[var(--bv-gold)] ring-2 ring-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)] text-[var(--bv-text)] focus:border-[var(--bv-gold)]'} disabled:opacity-50`}
                                    />
                                )
                            })
                        }
                    </div>

                    {/* --- Progress Bar --- */}
                    <div className="flex gap-1 mb-6">
                        {
                            Array(LEN).fill(0).map((_, i) => {
                                return (
                                    <div
                                        key={i}
                                        className={`h-1 flex-1 rounded-full transition-all ${i < filled ? 'bg-[var(--bv-gold)]' : 'bg-[var(--bv-surface)]'}`}
                                    />
                                )
                            })
                        }
                    </div>

                    <button
                        onClick={() => {
                            return handleVerify()
                        }}
                        disabled={loading || filled < LEN}
                        className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
                    >
                        {
                            loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" /> Verifying...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} /> Verify Email
                                </>
                            )
                        }
                    </button>

                    <div className="mt-5 text-center">
                        {
                            canResend ? (
                                <button
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="inline-flex items-center gap-2 text-sm text-[var(--bv-gold)] font-semibold"
                                >
                                    <RefreshCw
                                        size={14}
                                        className={resending ? 'animate-spin' : ''}
                                    />
                                    {
                                        resending ? (
                                            'Sending...'
                                        ) : (
                                            'Resend OTP'
                                        )
                                    }
                                </button>
                            ) : (
                                <p className="text-sm text-[var(--bv-text-muted)]">
                                    Resend in <span className="font-semibold text-[var(--bv-text)]">{cd}s</span>
                                </p>
                            )
                        }
                    </div>

                    <div className="mt-6 pt-5 border-t border-[var(--bv-divider)]">
                        <button
                            onClick={() => {
                                return nav('/signup')
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 text-sm text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] transition"
                        >
                            <ArrowLeft size={14} /> Back to Sign Up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyOTP
