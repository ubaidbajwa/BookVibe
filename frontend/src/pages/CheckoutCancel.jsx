/**
 * CheckoutCancel.jsx - Payment Cancellation Page
 *
 * This page is shown when a user cancels their Stripe payment.
 * It provides options to try again or return to the home page.
 */

import { XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ==========================================
// CheckoutCancel Component
// ==========================================

/**
 * CheckoutCancel - Renders the payment cancellation feedback.
 * @returns {JSX.Element}
 */
const CheckoutCancel = () => {
    const nav = useNavigate()

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bv-card-static p-10 max-w-lg w-full text-center bv-animate-in">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <XCircle size={40} className="text-[var(--bv-danger)]" />
                </div>
                <h1 className="font-display text-3xl text-[var(--bv-text)] mb-3">
                    Payment Cancelled
                </h1>
                <p className="text-[var(--bv-text-muted)] mb-8">
                    Your payment was not completed. The booking was not confirmed.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => {
                            nav(-1)
                        }}
                        className="bv-btn-gold py-3 text-sm"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => {
                            nav('/')
                        }}
                        className="bv-btn-outline py-3 text-sm"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CheckoutCancel
