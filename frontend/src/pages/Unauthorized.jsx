/**
 * Unauthorized.jsx - 403 Forbidden Page
 *
 * Displayed when a user attempts to access a route they do not have permissions for.
 */

import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'

// ==========================================
// Unauthorized Component
// ==========================================

/**
 * Unauthorized - Renders an error message for unauthorized access.
 * @returns {JSX.Element}
 */
const Unauthorized = () => {
    const nav = useNavigate()

    return (
        <div className="h-screen flex flex-col items-center justify-center gap-4">
            <ShieldX size={48} className="text-[var(--bv-danger)]" />
            <h1 className="font-display text-2xl text-[var(--bv-text)]">
                403 | <span className="text-[var(--bv-danger)]">Unauthorized</span>
            </h1>
            <p className="text-[var(--bv-text-muted)] text-sm">
                You don't have permission to access this page.
            </p>
            <button
                onClick={() => {
                    nav('/')
                }}
                className="mt-2 bv-btn-gold text-sm px-6 py-2.5"
            >
                Go Home
            </button>
        </div>
    )
}

export default Unauthorized
