/**
 * CheckoutSuccess.jsx - Payment Success Page
 *
 * This page is shown after a successful Stripe payment.
 * On mount it asks the backend to verify the checkout session directly with
 * Stripe (webhook fallback for local dev), then displays the booking summary.
 */

import { useEffect, useState } from 'react'
import { CheckCircle, Home, Loader2, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// ==========================================
// Helper Functions
// ==========================================

/**
 * formatBookingDate - Formats a date string for display.
 * @param {string} value - The date string to format.
 * @returns {string} - Formatted date string or fallback.
 */
const formatBookingDate = (value) => {
    if (!value) {
        return '—'
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }
    return parsed.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

// ==========================================
// CheckoutSuccess Component
// ==========================================

/**
 * CheckoutSuccess - Verifies the payment with the backend and renders
 * the payment success feedback and booking details.
 * @returns {JSX.Element}
 */
const CheckoutSuccess = () => {
    const nav = useNavigate()
    const params = new URLSearchParams(window.location.search)
    const bookingId = params.get('bookingId')

    // 'verifying' | 'paid' | 'pending' | 'error'
    const [verifyStatus, setVerifyStatus] = useState(bookingId ? 'verifying' : 'paid')
    const [verifiedBooking, setVerifiedBooking] = useState(null)

    useEffect(() => {
        if (!bookingId) {
            return
        }
        let cancelled = false
        const verifyPayment = async () => {
            try {
                const res = await axios.post(
                    `${BASE}/booking/${bookingId}/verify-payment`,
                    {},
                    { withCredentials: true }
                )
                if (cancelled) return
                if (res.data?.paymentStatus === 'paid') {
                    setVerifyStatus('paid')
                    setVerifiedBooking(res.data.booking || null)
                } else {
                    setVerifyStatus('pending')
                }
            } catch {
                if (!cancelled) setVerifyStatus('error')
            }
        }
        verifyPayment()
        return () => { cancelled = true }
    }, [bookingId])

    const isVerifying = verifyStatus === 'verifying'
    const isPaid = verifyStatus === 'paid'

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bv-card-static p-10 max-w-lg w-full text-center bv-animate-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                    {
                        isVerifying
                            ? <Loader2 size={40} className="text-[var(--bv-gold)] animate-spin" />
                            : isPaid
                                ? <CheckCircle size={40} className="text-[var(--bv-success)]" />
                                : <AlertTriangle size={40} className="text-amber-500" />
                    }
                </div>
                <h1 className="font-display text-3xl text-[var(--bv-text)] mb-3">
                    {
                        isVerifying
                            ? 'Verifying Payment…'
                            : isPaid
                                ? 'Payment Successful'
                                : 'Payment Processing'
                    }
                </h1>
                <p className="text-[var(--bv-text-muted)] mb-6">
                    {
                        isVerifying
                            ? 'Please wait while we confirm your payment with Stripe.'
                            : isPaid
                                ? 'Your booking is confirmed. Check your email for details.'
                                : 'Your payment is being processed. Check My Bookings shortly for the confirmed status.'
                    }
                </p>

                {/* --- Booking Summary Card (data from verified API response) --- */}
                <div className="bv-card-static p-5 text-left mb-6 space-y-2 text-sm">
                    {bookingId && (
                        <p className="text-[var(--bv-text-muted)]">
                            <span className="font-semibold text-[var(--bv-text)]">Booking:</span> #{bookingId}
                        </p>
                    )}
                    {verifiedBooking?.propertyName && (
                        <p className="text-[var(--bv-text-muted)]">
                            <span className="font-semibold text-[var(--bv-text)]">Property:</span> {verifiedBooking.propertyName}
                        </p>
                    )}
                    {verifiedBooking?.checkIn && (
                        <p className="text-[var(--bv-text-muted)]">
                            <span className="font-semibold text-[var(--bv-text)]">Check-in:</span> {formatBookingDate(verifiedBooking.checkIn)}
                        </p>
                    )}
                    {verifiedBooking?.checkOut && (
                        <p className="text-[var(--bv-text-muted)]">
                            <span className="font-semibold text-[var(--bv-text)]">Check-out:</span> {formatBookingDate(verifiedBooking.checkOut)}
                        </p>
                    )}
                    {verifiedBooking?.totalPrice && (
                        <p className="text-[var(--bv-text-muted)]">
                            <span className="font-semibold text-[var(--bv-gold)]">Total:</span> PKR {verifiedBooking.totalPrice?.toLocaleString()}
                        </p>
                    )}
                </div>

                <button
                    onClick={() => {
                        nav("/")
                    }}
                    className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
                >
                    <Home size={16} /> Back to Home
                </button>
            </div>
        </div>
    )
}

export default CheckoutSuccess
