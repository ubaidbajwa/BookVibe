import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../redux/slices/authSlice'
import { Clock, ShieldCheck, Mail, LogOut } from 'lucide-react'
import { getAuthConfig } from '../utils/authConfig'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const UnderReview = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { user: sessionUser } = useSelector((s) => s.auth)
    const profile = sessionUser?.user

    const handleLogout = async () => {
        try {
            await axios.post(`${BASE}/user/logout`, {}, getAuthConfig())
        } catch { /* ignore */ }
        dispatch(logout())
        navigate('/login', { replace: true })
    }

    const isHost = profile?.role === 'host'

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[var(--bv-bg)]">
            <div className="bv-card max-w-md w-full p-8 text-center space-y-6">

                {/* Icon */}
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Clock size={38} className="text-[var(--bv-warning)]" />
                </div>

                {/* Heading */}
                <div className="space-y-2">
                    <h1 className="font-display text-2xl text-[var(--bv-text)]">
                        {isHost ? 'Host Account Under Review' : 'Account Under Review'}
                    </h1>
                    <p className="text-sm text-[var(--bv-text-muted)] leading-relaxed">
                        {isHost
                            ? 'All host accounts require admin verification before you can list properties. This typically takes '
                            : 'Your identity documents are being reviewed by our admin team. This typically takes '}
                        <strong className="text-[var(--bv-text)]">24–48 hours</strong>.
                    </p>
                </div>

                {/* Host-specific notice */}
                {isHost && (
                    <div className="flex items-start gap-3 p-3.5 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl text-left">
                        <ShieldCheck size={15} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
                            This is a mandatory security step for all hosts — even if your documents are perfectly clear. Please be patient.
                        </p>
                    </div>
                )}

                {/* Email note */}
                <div className="flex items-center gap-3 p-3.5 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl text-left">
                    <Mail size={15} className="text-[var(--bv-gold)] flex-shrink-0" />
                    <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
                        You'll receive an email at <span className="font-semibold">{profile?.email || 'your email'}</span> once reviewed.
                    </p>
                </div>

                {/* What happens next */}
                <div className="space-y-2 text-left">
                    <p className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-widest">What happens next?</p>
                    {(isHost
                        ? ['Admin reviews your CNIC and selfie', 'You receive an approval or rejection email', 'If approved, you can start listing properties']
                        : ['Admin reviews your CNIC and selfie', 'You receive an approval or rejection email', 'If approved, full access is granted instantly']
                    ).map((step) => (
                        <div key={step} className="flex items-start gap-2 text-xs text-[var(--bv-text-muted)]">
                            <ShieldCheck size={12} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
                            {step}
                        </div>
                    ))}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--bv-border)] text-sm text-[var(--bv-text-muted)] hover:text-[var(--bv-text)] hover:border-[var(--bv-text-dim)] transition"
                >
                    <LogOut size={14} />
                    Sign out
                </button>
            </div>
        </div>
    )
}

export default UnderReview
