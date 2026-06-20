/**
 * Login.jsx - User Authentication Page
 *
 * Sign-in page for BookVibe. Renders a two-panel layout on large screens
 * (decorative sidebar + login form) and a single-column form on mobile.
 * Dispatches the Redux `login` thunk on submit, handles OTP redirect for
 * unverified accounts, and routes admin users to the admin gate after login.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { login, reset } from '../redux/slices/authSlice'
import axios from 'axios'
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

// ==========================================
// Constants & Configuration
// ==========================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const AP = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6'

// ==========================================
// Login Component
// ==========================================

/**
 * Login - Renders the user login interface and handles authentication logic.
 * @returns {JSX.Element}
 */
const Login = () => {
    const nav = useNavigate()
    const dispatch = useDispatch()

    /**
     * Selector: Retrieve authentication state from Redux.
     */
    const { loading, error, success, user } = useSelector((state) => {
        return state.auth
    })

    // --- State ---
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)

    // --- Effects ---

    /**
     * Effect: Handles auth slice side-effects after a login attempt.
     * - On success: reset the slice flags so they don't re-trigger.
     * - On error: surface a toast then reset so the next attempt starts clean.
     */
    useEffect(
        () => {
            // Setup
            if (success) {
                dispatch(reset())
            } else if (error) {
                dispatch(reset())
            }

            // Cleanup
            return () => {
                // No cleanup needed
            }
        },
        // Dependencies
        [success, error, dispatch]
    )

    /**
     * Effect: Redirects after a successful login based on the user's role.
     * Admin users are sent to the secret admin gate; everyone else goes home.
     */
    useEffect(
        () => {
            // Setup
            const role = user?.user?.role
            if (!role) {
                return
            }

            if (role === 'admin') {
                nav(`/${AP}/gate`)
            } else {
                const isVerified = user?.user?.isVerified
                if (isVerified === 'pending') {
                    nav('/under-review', { replace: true })
                } else if (isVerified === 'rejected') {
                    nav('/resubmit-verification', { replace: true })
                } else {
                    nav('/')
                }
            }

            // Cleanup
            return () => {
                // No cleanup needed
            }
        },
        // Dependencies
        [user, nav]
    )

    // --- Handlers ---

    /**
     * handleSubmit - Processes the login form submission.
     * @param {Event} e - Form submission event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!email.trim() || !password) {
            return;
        }

        try {
            const res = await axios.post(
                `${BASE_URL}/user/login`,
                { email, password },
                { withCredentials: true }
            )

            if (res.data.success) {
                dispatch(login({ email, password }))
            }
        } catch (err) {
            const d = err.response?.data

            // Unverified account — redirect to OTP page
            if (d?.requiresOTP) {
                nav('/verify-otp', { state: { email } })
                return
            }

            // Soft-deleted account
            if (d?.accountDeleted) {
                return
            }

            // All other errors — let the Redux thunk handle the error toast
            dispatch(login({ email, password }))
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* --- Left decorative panel (desktop only) --- */}
            <div className="hidden lg:flex w-[440px] flex-shrink-0 bg-[var(--bv-bg-raised)] flex-col justify-between p-10 relative overflow-hidden border-r border-[var(--bv-border)]">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--bv-gold)]/8 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-3 mb-20">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                            <Sparkles size={16} className="text-[var(--bv-bg)]" />
                        </div>
                        <span className="font-display text-xl text-[var(--bv-text)]">
                            Book<span className="text-[var(--bv-gold)]">Vibe</span>
                        </span>
                    </Link>
                    <h1 className="font-display text-4xl text-[var(--bv-text)] leading-tight">
                        Welcome<br /><span className="text-[var(--bv-gold)]">back.</span>
                    </h1>
                    <p className="text-[var(--bv-text-muted)] mt-4 text-sm leading-relaxed">
                        Sign in to continue your journey. Your perfect stay awaits.
                    </p>
                </div>
                <div className="relative z-10 bv-card-static p-5">
                    <p className="text-sm text-[var(--bv-text-muted)] italic leading-relaxed">
                        "The verification process gave me peace of mind. Felt completely safe."
                    </p>
                    <div className="flex items-center gap-2.5 mt-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs">B</div>
                        <div>
                            <p className="text-xs font-bold text-[var(--bv-text)]">Bilal K.</p>
                            <p className="text-[10px] text-[var(--bv-text-dim)]">Islamabad</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Right: login form --- */}
            <div className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-sm bv-animate-in">
                    {/* Logo — only shown on mobile where the left panel is hidden */}
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                            <Sparkles size={16} className="text-[var(--bv-bg)]" />
                        </div>
                        <span className="font-display text-xl text-[var(--bv-text)]">
                            Book<span className="text-[var(--bv-gold)]">Vibe</span>
                        </span>
                    </div>

                    <h2 className="font-display text-2xl text-[var(--bv-text)] mb-1">Sign in</h2>
                    <p className="text-sm text-[var(--bv-text-muted)] mb-8">Enter your credentials to continue</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email field */}
                        <div>
                            <label className="bv-label">Email</label>
                            <div className="flex items-center gap-3 bv-input">
                                <Mail size={15} className="text-[var(--bv-text-dim)]" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        return setEmail(e.target.value)
                                    }}
                                    placeholder="you@example.com"
                                    required
                                    className="flex-1 bg-transparent text-[var(--bv-text)] placeholder-[var(--bv-text-dim)] text-sm outline-none"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="bv-label mb-0">Password</label>
                                <Link to="/forgot-password" className="text-xs text-[var(--bv-gold)] font-semibold">Forgot?</Link>
                            </div>
                            <div className="flex items-center gap-3 bv-input">
                                <Lock size={15} className="text-[var(--bv-text-dim)]" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => {
                                        return setPassword(e.target.value)
                                    }}
                                    placeholder="••••••••"
                                    required
                                    className="flex-1 bg-transparent text-[var(--bv-text)] placeholder-[var(--bv-text-dim)] text-sm outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        return setShowPass((s) => {
                                            return !s
                                        })
                                    }}
                                    className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] transition"
                                >
                                    {
                                        showPass ? (
                                            <EyeOff size={15} />
                                        ) : (
                                            <Eye size={15} />
                                        )
                                    }
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
                        >
                            {
                                loading ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" /> Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign In <ArrowRight size={15} />
                                    </>
                                )
                            }
                        </button>
                    </form>

                    <p className="text-center text-sm text-[var(--bv-text-muted)] mt-8">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-[var(--bv-gold)] font-semibold">Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
