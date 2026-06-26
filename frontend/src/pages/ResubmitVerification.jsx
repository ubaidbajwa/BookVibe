/**
 * ResubmitVerification.jsx
 * Allows a rejected user to re-upload CNIC + selfie and resubmit for admin review.
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { refreshSession, setUser } from '../redux/slices/authSlice'
import {
    Upload, CheckCircle, Loader2, AlertTriangle,
    Shield, RefreshCw, Clock, Info
} from 'lucide-react'
import { getAuthConfig } from '../utils/authConfig'

// Lazy-loaded so the heavy AWS Amplify bundle only loads at the selfie step.
const LivenessCheck = lazy(() => import('../components/LivenessCheck'))

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

// ── Image compression (same as signup) ──
const compressImage = (file, maxSize = 1280, quality = 0.82) =>
    new Promise((resolve) => {
        if (!file?.type?.startsWith('image/')) return resolve(file)
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
            const c = document.createElement('canvas')
            c.width = Math.round(img.width * scale)
            c.height = Math.round(img.height * scale)
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
            c.toBlob((blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file), 'image/jpeg', quality)
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
        img.src = url
    })

// ── Upload box ──
const UploadBox = ({ label, preview, onChange, required }) => (
    <div>
        <label className="bv-label">{label}{required && <span className="text-[var(--bv-danger)] ml-0.5">*</span>}</label>
        <label className="cursor-pointer group">
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
                        e.target.value = ''; return
                    }
                    onChange(await compressImage(file))
                }}
            />
            <div className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative
                ${preview ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--bv-border)] hover:border-[var(--bv-gold)] hover:bg-[var(--bv-gold-glow)] bg-[var(--bv-bg-raised)]'}`}>
                {preview ? (
                    <>
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-semibold">Change</p>
                        </div>
                    </>
                ) : (
                    <>
                        <Upload size={18} className="text-[var(--bv-text-dim)] mb-1.5 group-hover:text-[var(--bv-gold)] transition" />
                        <p className="text-xs text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition">Click to upload</p>
                    </>
                )}
            </div>
        </label>
    </div>
)

const ResubmitVerification = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { user: sessionUser, isLogin, authReady } = useSelector((s) => s.auth)
    const profile = sessionUser?.user

    const isHost = profile?.role === 'host'
    const attemptsRemaining = isHost ? 0 : Math.max(0, 5 - (profile?.kycAiAttempts || 0))

    const [cnicFront, setCnicFront] = useState(null)
    const [cnicBack, setCnicBack] = useState(null)
    const [selfieImg, setSelfieImg] = useState(null)
    const [cnicFrontPrev, setCnicFrontPrev] = useState(null)
    const [cnicBackPrev, setCnicBackPrev] = useState(null)
    const [selfiePrev, setSelfiePrev] = useState(null)

    const [submitting, setSubmitting] = useState(false)
    // Confidence (0-100) from the AWS Face Liveness session; non-null = passed.
    const [livenessConfidence, setLivenessConfidence] = useState(null)
    // AWS Face Liveness session id — re-verified server-side (anti-spoofing).
    const [livenessSessionId, setLivenessSessionId] = useState(null)

    // Redirect non-rejected users to the right page
    useEffect(() => {
        if (!authReady) return
        if (!isLogin) { navigate('/login', { replace: true }); return }
        if (profile?.isVerified === 'verified') {
            navigate('/', { replace: true })
        } else if (profile?.isVerified === 'pending') {
            navigate('/under-review', { replace: true })
        }
    }, [authReady, isLogin, profile?.isVerified])

    // Preview effects
    useEffect(() => { setCnicFrontPrev(cnicFront ? URL.createObjectURL(cnicFront) : null) }, [cnicFront])
    useEffect(() => { setCnicBackPrev(cnicBack ? URL.createObjectURL(cnicBack) : null) }, [cnicBack])
    useEffect(() => { setSelfiePrev(selfieImg ? URL.createObjectURL(selfieImg) : null) }, [selfieImg])

    // AWS Face Liveness passed — the live frame AWS captured becomes the selfie,
    // and the sessionId is sent so the backend can re-verify the live result.
    const handleLivenessSuccess = useCallback(({ selfieFile, confidence, sessionId }) => {
        setSelfieImg(selfieFile)
        setLivenessConfidence(typeof confidence === 'number' ? confidence : 0)
        setLivenessSessionId(sessionId || null)
    }, [])

    const handleLivenessReset = useCallback(() => {
        setSelfieImg(null)
        setLivenessConfidence(null)
        setLivenessSessionId(null)
    }, [])

    const handleSubmit = async () => {
        if (!cnicFront || !cnicBack || !selfieImg) {
            return;
        }
        setSubmitting(true)
        try {
            const fd = new FormData()
            fd.append('frontImage', cnicFront)
            fd.append('backImage', cnicBack)
            fd.append('selfieImage', selfieImg)
            if (livenessSessionId) {
                fd.append('livenessSessionId', livenessSessionId)
            }

            // Never force Content-Type on a FormData body — see AdminProfile.jsx for why.
            const res = await axios.post(`${BASE}/verify/resubmit`, fd, {
                ...getAuthConfig(),
                timeout: 300000,
            })

            const { verificationStatus } = res.data

            // Fast update so SessionManager reacts immediately
            dispatch(setUser({ isVerified: verificationStatus }))
            // Also refresh full session in background for complete data sync
            dispatch(refreshSession()).catch(() => {})

            if (verificationStatus === 'verified') {
                navigate('/', { replace: true })
            } else if (verificationStatus === 'pending') {
                navigate('/under-review', { replace: true })
            } else {
                // Reset image state so user uploads fresh images
                setCnicFront(null); setCnicBack(null); setSelfieImg(null)
            }
        } catch {
            // error silently handled
        } finally {
            setSubmitting(false)
        }
    }

    if (!authReady) return null

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-lg mx-auto space-y-6">

                {/* Header */}
                <div>
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">Re-verification</p>
                    <h1 className="font-display text-3xl text-[var(--bv-text)]">Re-submit Documents</h1>
                    <p className="text-sm text-[var(--bv-text-muted)] mt-1.5">
                        Upload clearer photos of your CNIC and take a fresh selfie.
                    </p>
                </div>

                {/* Rejection reason banner */}
                {profile?.rejectedReason && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <AlertTriangle size={16} className="text-[var(--bv-danger)] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-[var(--bv-danger)]">Previous rejection reason:</p>
                            <p className="text-sm text-[var(--bv-danger)]/80 mt-0.5">{profile.rejectedReason}</p>
                        </div>
                    </div>
                )}

                {/* Host info: always goes to admin review */}
                {isHost && (
                    <div className="flex items-start gap-3 p-4 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
                        <Clock size={16} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-[var(--bv-gold)]">Admin review required</p>
                            <p className="text-xs text-[var(--bv-gold)]/80 mt-0.5 leading-relaxed">
                                All host accounts are verified manually. After resubmission, your documents will be reviewed by our team within <strong>24–48 hours</strong>. You'll receive an email and notification once done.
                            </p>
                        </div>
                    </div>
                )}

                {/* Guest info: AI attempts remaining */}
                {!isHost && (
                    <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                        attemptsRemaining === 0
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                        <Info size={16} className={`flex-shrink-0 mt-0.5 ${attemptsRemaining === 0 ? 'text-amber-500' : 'text-blue-400'}`} />
                        <div>
                            {attemptsRemaining > 0 ? (
                                <>
                                    <p className="text-sm font-semibold text-blue-400">{attemptsRemaining} AI attempt{attemptsRemaining !== 1 ? 's' : ''} remaining</p>
                                    <p className="text-xs text-blue-400/80 mt-0.5 leading-relaxed">
                                        Our AI will automatically verify your documents. If verification fails {attemptsRemaining === 1 ? 'again' : `${attemptsRemaining} more time${attemptsRemaining !== 1 ? 's' : ''}`}, your request will go to admin review (24–48 hours).
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold text-amber-500">Going to admin review</p>
                                    <p className="text-xs text-amber-500/80 mt-0.5 leading-relaxed">
                                        You've used all AI verification attempts. Your resubmission will be reviewed manually by admin within <strong>24–48 hours</strong>.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Tips */}
                <div className="bv-card-static p-4 space-y-2">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest">Tips for approval</p>
                    {[
                        'Photograph CNIC in good lighting, no glare',
                        'Hold camera steady — no blur',
                        'CNIC must be horizontal (landscape)',
                        'Selfie: full face visible, no glasses',
                    ].map((t) => (
                        <div key={t} className="flex items-center gap-2 text-xs text-[var(--bv-text-muted)]">
                            <CheckCircle size={11} className="text-[var(--bv-gold)] flex-shrink-0" /> {t}
                        </div>
                    ))}
                </div>

                {/* Uploads */}
                <div className="bv-card p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <UploadBox label="CNIC Front" preview={cnicFrontPrev} onChange={setCnicFront} required />
                        <UploadBox label="CNIC Back" preview={cnicBackPrev} onChange={setCnicBack} required />
                    </div>

                    {/* Selfie */}
                    <div>
                        <label className="bv-label">Live Selfie <span className="text-[var(--bv-danger)]">*</span></label>
                        {selfiePrev ? (
                            <div className="relative rounded-xl overflow-hidden border border-emerald-500/30">
                                <img src={selfiePrev} alt="" className="w-full h-40 object-cover" />
                                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 text-white text-xs rounded-lg">
                                    <CheckCircle size={12} />
                                    Live verified{livenessConfidence != null ? ` (${Math.round(livenessConfidence)}%)` : ''}
                                </div>
                                <button onClick={handleLivenessReset}
                                    className="absolute top-2 right-2 px-3 py-1 bg-[var(--bv-card)]/90 text-[var(--bv-text)] text-xs rounded-lg border border-[var(--bv-border)]">
                                    Retake
                                </button>
                            </div>
                        ) : (
                            <Suspense fallback={
                                <div className="flex items-center justify-center rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-8 text-sm text-[var(--bv-text-muted)]">
                                    Loading live identity check…
                                </div>
                            }>
                                <LivenessCheck
                                    onSuccess={handleLivenessSuccess}
                                    onFail={handleLivenessReset}
                                    onError={handleLivenessReset}
                                />
                            </Suspense>
                        )}
                    </div>
                </div>

                {/* Privacy note */}
                <div className="flex items-start gap-2.5 p-3.5 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
                    <Shield size={14} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
                        Documents are encrypted and only shared with admin for review.
                    </p>
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting || !cnicFront || !cnicBack || !selfieImg}
                    className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {submitting ? (
                        <><Loader2 size={15} className="animate-spin" /> {isHost ? 'Submitting for Admin Review...' : 'Verifying...'}</>
                    ) : (
                        <><RefreshCw size={15} /> {isHost ? 'Re-submit for Admin Review' : attemptsRemaining > 0 ? 'Re-submit & Verify' : 'Re-submit for Admin Review'}</>
                    )}
                </button>
            </div>
        </div>
    )
}

export default ResubmitVerification
