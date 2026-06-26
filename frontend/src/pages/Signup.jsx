/**
 * Signup.jsx — BookVibe Registration
 *
 * A multi-step registration flow (Role → Details → Email OTP → Documents → Verify → Done).
 * Includes complex identity verification logic using OCR, liveness detection, and face matching.
 */

import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import {
    User, Mail, Lock, Phone, Calendar, MapPin, Eye, EyeOff, Upload, Camera, CheckCircle,
    XCircle, ArrowRight, Shield, Loader2, Briefcase, UserCheck, X, RefreshCw, ChevronRight,
    Sparkles, CreditCard, AlertTriangle, Clock,
} from 'lucide-react'

// Lazy-loaded so the heavy AWS Amplify / Face Liveness bundle is only fetched
// when the user actually reaches the live-selfie step.
const LivenessCheck = lazy(() => import('../components/LivenessCheck'))

// ==========================================
// Constants & Configuration
// ==========================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const OTP_LEN = 6
const SIGNUP_STORAGE_KEY = 'bookvibe_signup_progress'

/**
 * ALLOWED_CNIC_TYPES - Set of accepted MIME types for CNIC uploads.
 */
const ALLOWED_CNIC_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
])

// ==========================================
// Reusable Components
// ==========================================

/**
 * Input - Custom labeled input field with icon support.
 * @returns {JSX.Element}
 */
const Input = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required, hint }) => {
    const [show, setShow] = useState(false)
    const isPass = type === 'password'

    return (
        <div>
            {
                label && (
                    <label className="bv-label">
                        {label}
                        {
                            required && (
                                <span className="text-[var(--bv-danger)] ml-0.5">*</span>
                            )
                        }
                    </label>
                )
            }
            <div className="flex items-center gap-3 bv-input">
                {
                    Icon && (
                        <Icon size={15} className="text-[var(--bv-text-dim)] flex-shrink-0" />
                    )
                }
                <input
                    type={isPass ? (show ? 'text' : 'password') : type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className="flex-1 bg-transparent text-[var(--bv-text)] placeholder-[var(--bv-text-dim)] text-sm outline-none"
                />
                {
                    isPass && (
                        <button
                            type="button"
                            onClick={() => {
                                return setShow((s) => {
                                    return !s
                                })
                            }}
                            className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] transition"
                        >
                            {
                                show ? (
                                    <EyeOff size={15} />
                                ) : (
                                    <Eye size={15} />
                                )
                            }
                        </button>
                    )
                }
            </div>
            {
                hint && (
                    <p className="text-[10px] text-[var(--bv-text-dim)] mt-1 ml-1">{hint}</p>
                )
            }
        </div>
    )
}

/**
 * OTPInput - Managed 6-digit OTP input field.
 * @returns {JSX.Element}
 */
const OTPInput = ({ otp, setOtp, onComplete }) => {
    const refs = useRef([])

    /**
     * handleChange - Handles character input and auto-focus.
     */
    const handleChange = (i, v) => {
        if (!/^\d*$/.test(v)) {
            return
        }
        const n = [...otp]
        n[i] = v.slice(-1)
        setOtp(n)

        if (v && i < OTP_LEN - 1) {
            refs.current[i + 1]?.focus()
        }
        if (n.every((d) => { return d }) && n.join('').length === OTP_LEN) {
            onComplete?.(n.join(''))
        }
    }

    /**
     * handleKey - Handles backspace navigation.
     */
    const handleKey = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) {
            refs.current[i - 1]?.focus()
        }
    }

    /**
     * handlePaste - Handles pasting of entire OTP.
     */
    const handlePaste = (e) => {
        e.preventDefault()
        const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
        if (!p) {
            return
        }
        const n = Array(OTP_LEN).fill('')
        p.split('').forEach((d, i) => {
            n[i] = d
        })
        setOtp(n)
        refs.current[Math.min(p.length, OTP_LEN - 1)]?.focus()
        if (p.length === OTP_LEN) {
            onComplete?.(p)
        }
    }

    return (
        <div>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {
                    otp.map((digit, i) => {
                        return (
                            <input
                                key={i}
                                ref={(el) => {
                                    return (refs.current[i] = el)
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => {
                                    return handleChange(i, e.target.value)
                                }}
                                onKeyDown={(e) => {
                                    return handleKey(i, e)
                                }}
                                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-[var(--bv-bg-raised)]
                                    ${digit ? 'border-[var(--bv-gold)] text-[var(--bv-gold)] ring-2 ring-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)] text-[var(--bv-text)] focus:border-[var(--bv-gold)]'}`}
                            />
                        )
                    })
                }
            </div>
            <div className="flex gap-1.5 justify-center mt-3">
                {
                    Array(OTP_LEN).fill(null).map((_, i) => {
                        return (
                            <div
                                key={i}
                                className={`h-0.5 w-7 rounded-full transition-all duration-300 ${i < otp.filter((d) => { return d }).length ? 'bg-[var(--bv-gold)]' : 'bg-[var(--bv-border)]'}`}
                            />
                        )
                    })
                }
            </div>
        </div>
    )
}

/**
 * ImageUploadBox - Clickable upload area for identity documents.
 * @returns {JSX.Element}
 */
const ImageUploadBox = ({ label, image, setImage, preview, required, hint, onValidate, accept = 'image/*' }) => {
    return (
        <div className="flex flex-col gap-1.5">
            {
                label && (
                    <label className="bv-label">
                        {label}
                        {
                            required && (
                                <span className="text-[var(--bv-danger)] ml-0.5">*</span>
                            )
                        }
                    </label>
                )
            }
            <label className="cursor-pointer group">
                <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) {
                            return
                        }
                        if (onValidate) {
                            try {
                                await onValidate(file)
                            } catch {
                                e.target.value = ''
                                return
                            }
                        }
                        const compressed = await compressImageFile(file)
                        setImage(compressed)
                    }}
                />
                <div className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative
                    ${preview ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--bv-border)] hover:border-[var(--bv-gold)] hover:bg-[var(--bv-gold-glow)] bg-[var(--bv-bg-raised)]'}`}>
                    {
                        preview ? (
                            <>
                                <img src={preview} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[var(--bv-text)] text-xs font-semibold">Change</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <Upload size={18} className="text-[var(--bv-text-dim)] mb-1.5 group-hover:text-[var(--bv-gold)] transition" />
                                <p className="text-xs text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] text-center px-2 transition">
                                    {hint || 'Click to upload'}
                                </p>
                            </>
                        )
                    }
                </div>
            </label>
            {
                image && (
                    <button
                        type="button"
                        onClick={() => {
                            return setImage(null)
                        }}
                        className="flex items-center gap-1 text-xs text-[var(--bv-danger)] self-start"
                    >
                        <X size={10} /> Remove
                    </button>
                )
            }
        </div>
    )
}

/**
 * StepBar - Progress indicator for the multi-step flow.
 * @returns {JSX.Element}
 */
const StepBar = ({ steps, current }) => {
    return (
        <div className="flex items-center mb-8">
            {
                steps.map((s, i) => {
                    const done = current > s.id
                    const active = current === s.id
                    return (
                        <div key={s.id} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all text-xs font-bold
                                    ${done ? 'bg-[var(--bv-gold)] border-[var(--bv-gold)] text-[var(--bv-bg)]' : active ? 'bg-[var(--bv-card)] border-[var(--bv-gold)] text-[var(--bv-gold)]' : 'bg-[var(--bv-card)] border-[var(--bv-border)] text-[var(--bv-text-dim)]'}`}>
                                    {
                                        done ? (
                                            <CheckCircle size={14} />
                                        ) : (
                                            s.id
                                        )
                                    }
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${active ? 'text-[var(--bv-gold)]' : done ? 'text-[var(--bv-gold-dim)]' : 'text-[var(--bv-text-dim)]'}`}>
                                    {s.label}
                                </span>
                            </div>
                            {
                                i < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${done ? 'bg-[var(--bv-gold-dim)]' : 'bg-[var(--bv-border)]'}`} />
                                )
                            }
                        </div>
                    )
                })
            }
        </div>
    )
}

/**
 * PrimaryBtn - Standardized gold button for primary actions.
 * @returns {JSX.Element}
 */
const PrimaryBtn = ({ children, onClick, disabled, type = 'button' }) => {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
        >
            {children}
        </button>
    )
}

/**
 * VerifyRow - A status row for the identity verification process.
 * @returns {JSX.Element}
 */
const VerifyRow = ({ label, status, value }) => {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                {
                    status === 'loading' && (
                        <Loader2 size={16} className="text-[var(--bv-gold)] animate-spin" />
                    )
                }
                {
                    status === 'pass' && (
                        <CheckCircle size={16} className="text-[var(--bv-success)]" />
                    )
                }
                {
                    status === 'fail' && (
                        <XCircle size={16} className="text-[var(--bv-danger)]" />
                    )
                }
                {
                    status === 'idle' && (
                        <div className="w-3 h-3 rounded-full bg-[var(--bv-surface)]" />
                    )
                }
            </div>
            <div className="flex-1">
                <p className={`text-sm font-semibold ${status === 'pass' ? 'text-[var(--bv-text)]' : status === 'fail' ? 'text-[var(--bv-danger)]' : status === 'loading' ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'}`}>
                    {label}
                </p>
                {
                    status === 'loading' && (
                        <p className="text-xs text-[var(--bv-gold)] mt-0.5 animate-pulse">Processing...</p>
                    )
                }
                {
                    value && status !== 'loading' && status !== 'idle' && (
                        <p className="text-xs text-[var(--bv-text-muted)] mt-0.5">{value}</p>
                    )
                }
            </div>
        </div>
    )
}

/**
 * CheckItem - Small success indicator with text.
 * @returns {JSX.Element}
 */
const CheckItem = ({ text }) => {
    return (
        <div className="flex items-center gap-2.5 text-sm text-[var(--bv-success)]">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={11} />
            </div>
            {text}
        </div>
    )
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * compressImageFile - Reduces image size before upload.
 */
const compressImageFile = (file, maxSize = 1280, quality = 0.82) => {
    return new Promise((resolve) => {
        if (!file?.type?.startsWith('image/')) {
            return resolve(file)
        }

        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(url)
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => {
                if (!blob) {
                    return resolve(file)
                }
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            }, 'image/jpeg', quality)
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(file)
        }

        img.src = url
    })
}

/**
 * validateCnicFile - Enforces orientation and size rules for CNIC photos.
 */
const validateCnicFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('Please select an image file.'))
        }

        if (!ALLOWED_CNIC_TYPES.has(file.type.toLowerCase())) {
            return reject(new Error('Only JPG, PNG, or WebP images are accepted for CNIC upload.'))
        }

        if (file.size > 10 * 1024 * 1024) {
            return reject(new Error('Image must be under 10 MB. Please compress or retake the photo.'))
        }

        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(url)

            if (img.height > img.width) {
                return reject(new Error(
                    'This looks like a portrait (vertical) photo. A CNIC card is always horizontal — please rotate your phone to landscape and retake.'
                ))
            }

            const ratio = img.width / img.height
            if (ratio > 4.0) {
                return reject(new Error(
                    'This image appears too wide to be a CNIC card. Please upload a straight-on photo of the card.'
                ))
            }

            resolve(file)
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Could not read the image file. Please try a different photo.'))
        }

        img.src = url
    })
}

// ==========================================
// Main Signup Component
// ==========================================

/**
 * Signup - Root registration component managing multi-step state and API calls.
 * @returns {JSX.Element}
 */
const Signup = () => {
    const navigate = useNavigate()
    const STEPS = [
        { id: 1, label: 'Role' },
        { id: 2, label: 'Details' },
        { id: 3, label: 'Email' },
        { id: 4, label: 'Docs' },
        { id: 5, label: 'Verify' },
        { id: 6, label: 'Done' }
    ]

    // --- Core State ---
    const [role, setRole] = useState(null)
    const [step, setStep] = useState(1)
    const steps = STEPS

    // --- Form State ---
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [dob, setDob] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')

    // --- Images State ---
    const [profileImg, setProfileImg] = useState(null)
    const [profilePrev, setProfilePrev] = useState(null)
    const [cnicFront, setCnicFront] = useState(null)
    const [cnicFrontPrev, setCnicFrontPrev] = useState(null)
    const [cnicBack, setCnicBack] = useState(null)
    const [cnicBackPrev, setCnicBackPrev] = useState(null)
    const [selfieImg, setSelfieImg] = useState(null)
    const [selfiePrev, setSelfiePrev] = useState(null)
    // Confidence (0-100) from the AWS Face Liveness session; non-null = liveness passed.
    const [livenessConfidence, setLivenessConfidence] = useState(null)
    // AWS Face Liveness session id — sent to the backend so it can re-verify the
    // live result server-side and source the selfie from AWS (anti-spoofing).
    const [livenessSessionId, setLivenessSessionId] = useState(null)

    // --- OTP State ---
    const [emailOtp, setEmailOtp] = useState(Array(OTP_LEN).fill(''))
    const [emailCooldown, setEmailCooldown] = useState(0)

    // --- Verification State ---
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [verifyDone, setVerifyDone] = useState(false)
    const [ocrStatus, setOcrStatus] = useState('idle')
    const [livenessStatus, setLivenessStatus] = useState('idle')
    const [faceStatus, setFaceStatus] = useState('idle')
    const [ocrData, setOcrData] = useState(null)
    const [faceScore, setFaceScore] = useState(null)
    const [faceDecision, setFaceDecision] = useState('')
    const [verifyError, setVerifyError] = useState('')
    const [overallPass, setOverallPass] = useState(false)
    const [registering, setRegistering] = useState(false)
    const [regResult, setRegResult] = useState(null) // { isVerified, attemptsRemaining }
    const [hostWillSubmitToAdmin, setHostWillSubmitToAdmin] = useState(false)


    // --- Effects ---

    /**
     * Effect: Load initial progress from sessionStorage.
     */
    useEffect(
        () => {
            try {
                const saved = sessionStorage.getItem(SIGNUP_STORAGE_KEY)
                if (!saved) {
                    return
                }
                const data = JSON.parse(saved)
                if (data.role) {
                    setRole(data.role)
                }
                if (data.step) {
                    setStep(data.step)
                }
                if (data.username) {
                    setUsername(data.username)
                }
                if (data.email) {
                    setEmail(data.email)
                }
                if (data.dob) {
                    setDob(data.dob)
                }
                if (data.phone) {
                    setPhone(data.phone)
                }
                if (data.address) {
                    setAddress(data.address)
                }
            } catch {
                // Silently ignore parsing errors
            }
        },
        // Dependencies
        []
    )

    /**
     * Effect: Persist progress to sessionStorage whenever state changes.
     */
    useEffect(
        () => {
            const data = {
                role,
                step,
                username,
                email,
                dob,
                phone,
                address,
            }
            sessionStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(data))
        },
        [role, step, username, email, dob, phone, address]
    )

    /**
     * Effect: Manage image previews.
     */
    useEffect(
        () => {
            setProfilePrev(profileImg ? URL.createObjectURL(profileImg) : null)
        },
        [profileImg]
    )
    useEffect(
        () => {
            setCnicFrontPrev(cnicFront ? URL.createObjectURL(cnicFront) : null)
        },
        [cnicFront]
    )
    useEffect(
        () => {
            setCnicBackPrev(cnicBack ? URL.createObjectURL(cnicBack) : null)
        },
        [cnicBack]
    )
    useEffect(
        () => {
            setSelfiePrev(selfieImg ? URL.createObjectURL(selfieImg) : null)
        },
        [selfieImg]
    )

    /**
     * Effect: Manage email OTP resend cooldown.
     */
    useEffect(
        () => {
            if (emailCooldown <= 0) {
                return
            }
            const t = setTimeout(() => {
                return setEmailCooldown((c) => {
                    return c - 1
                })
            }, 1000)
            return () => {
                return clearTimeout(t)
            }
        },
        [emailCooldown]
    )

    // --- Handlers ---

    /**
     * handleLivenessSuccess - Called when the AWS Face Liveness check passes.
     * The live reference frame captured by AWS becomes the selfie used for
     * face-matching, so the verified-live face is the one matched to the CNIC.
     * The sessionId is forwarded to the backend so it can re-verify the live
     * outcome server-side (the client result alone is never trusted).
     * @param {{ selfieFile: File, confidence: number, sessionId: string }} result
     */
    const handleLivenessSuccess = useCallback(({ selfieFile, confidence, sessionId }) => {
        setSelfieImg(selfieFile)
        setLivenessConfidence(typeof confidence === 'number' ? confidence : 0)
        setLivenessSessionId(sessionId || null)
        setVerifyError('')
    }, [])

    /**
     * handleLivenessFail - Called when the liveness check fails (not a live person).
     * @param {string} message
     */
    const handleLivenessFail = useCallback((message) => {
        setSelfieImg(null)
        setLivenessConfidence(null)
        setLivenessSessionId(null)
        setVerifyError(message || 'Liveness check failed. Please try again.')
    }, [])

    /**
     * handleLivenessError - Called on a technical/configuration error.
     * @param {string} message
     */
    const handleLivenessError = useCallback((message) => {
        setSelfieImg(null)
        setLivenessConfidence(null)
        setVerifyError(message || 'Liveness check is unavailable right now.')
    }, [])

    /**
     * validateStep2 - Checks form requirements for the details step.
     */
    const validateStep2 = () => {
        if (!username.trim()) {
            return false
        }
        if (!email.trim()) {
            return false
        }
        if (!password || password.length < 6) {
            return false
        }
        if (password !== confirm) {
            return false
        }
        if (!dob) {
            return false
        }
        if (!phone.trim()) {
            return false
        }
        if (!/^\+\d{7,15}$/.test(phone)) {
            return false
        }
        return true
    }

    /**
     * validateStep5 - Checks file requirements before verification.
     */
    const validateStep5 = () => {
        if (!cnicFront) {
            return false
        }
        if (!cnicBack) {
            return false
        }
        if (!selfieImg) {
            return false
        }
        return true
    }

    /**
     * handleAccountNext - Sends email OTP and moves to step 3.
     */
    const handleAccountNext = async () => {
        if (!validateStep2()) {
            return
        }
        try {
            setLoading(true)
            await axios.post(`${BASE_URL}/user/send-email-otp`, { email, username })
            setEmailCooldown(60)
            setEmailOtp(Array(OTP_LEN).fill(''))
            setStep(3)
        } catch {
            // error silently handled
        } finally {
            setLoading(false)
        }
    }

    /**
     * handleEmailOTPVerify - Verifies the email OTP.
     */
    const handleEmailOTPVerify = async (otpStr) => {
        const code = otpStr || emailOtp.join('')
        if (code.length !== OTP_LEN) {
            return;
        }
        try {
            setLoading(true)
            await axios.post(`${BASE_URL}/user/verify-email-otp`, { email, otp: code })
            setStep(4)
        } catch {
            setEmailOtp(Array(OTP_LEN).fill(''))
        } finally {
            setLoading(false)
        }
    }

    /**
     * resendEmailOTP - Requests a new OTP.
     */
    const resendEmailOTP = async () => {
        try {
            await axios.post(`${BASE_URL}/user/send-email-otp`, { email, username })
            setEmailCooldown(60)
            setEmailOtp(Array(OTP_LEN).fill(''))
        } catch {
            // error silently handled
        }
    }

    /**
     * proceedToVerification - Pre-validation before starting the AI verification flow.
     */
    const proceedToVerification = () => {
        if (verifying || registering) {
            return
        }
        if (!validateStep5()) {
            return
        }
        setStep(5)
        setTimeout(runVerification, 300)
    }

    /**
     * runVerification - Executes OCR, Liveness, and Face Match AI services.
     */
    const runVerification = async () => {
        if (verifying || registering) {
            return
        }
        setVerifying(true)
        setVerifyDone(false)
        setVerifyError('')
        setOcrData(null)
        setFaceScore(null)
        setFaceDecision('')
        setOverallPass(false)
        setHostWillSubmitToAdmin(false)
        setOcrStatus('idle')
        setLivenessStatus('idle')
        setFaceStatus('idle')

        let ocrResult = null
        let livenessOk = false
        let faceOk = false
        let faceDecisionLocal = ''

        // --- Step 1: CNIC OCR ---
        setOcrStatus('loading')
        try {
            const f = new FormData()
            f.append('cnic_front', cnicFront, 'cnic_front.jpg')
            const r = await axios.post(`${BASE_URL}/verify/cnic-ocr`, f, {
                timeout: 300000,
                withCredentials: false
            })
            if (r.data.success) {
                ocrResult = r.data.extracted
                setOcrData(ocrResult)
                setOcrStatus('pass')
            } else {
                setOcrStatus('fail')
            }
        } catch (e) {
            setOcrStatus('fail')
            const msg = e.response?.data?.message
            const code = e.response?.data?.code
            const isInvalidDoc = code === 'INVALID_DOCUMENT_TYPE' || (msg && msg.includes('Invalid Image Detected'))

            if (isInvalidDoc) {
                const errorMsg = msg || 'Invalid Image Detected. Please upload a clear, actual photo of your Pakistani CNIC.'
                setVerifyError(errorMsg)
                setVerifying(false)
                setVerifyDone(true)
                return // Abort if junk image
            }

            if (code === 'PROVIDER_NOT_CONFIGURED' || e.response?.status === 503) {
                if (role === 'guest') {
                    setVerifyError('Verification service is not configured. Add real API credentials in .env file.')
                    setVerifying(false)
                    setVerifyDone(true)
                    return
                }
                // Host: continue without OCR — admin will review uploaded images manually
            }
        }

        // --- Step 2: Liveness ---
        // Already verified live via the AWS Face Liveness challenge during
        // selfie capture; the live frame is now selfieImg. No image re-check.
        if (livenessConfidence != null) {
            livenessOk = true
            setLivenessStatus('pass')
        } else {
            setLivenessStatus('fail')
            setVerifyError('Please complete the live identity check before verifying.')
        }

        // --- Step 3: Face Match ---
        setFaceStatus('loading')
        try {
            const f = new FormData()
            f.append('cnic_image', cnicFront, 'cnic.jpg')
            f.append('selfie_image', selfieImg, 'selfie.jpg')
            const r = await axios.post(`${BASE_URL}/verify/face-match`, f, {
                timeout: 300000,
                withCredentials: false
            })

            const decision = r.data.decision || r.data.result?.decision || ''
            const score = r.data.result?.similarity_percent ?? r.data.confidence ?? null
            faceDecisionLocal = decision
            setFaceScore(score)
            setFaceDecision(decision)

            if (r.data.success && decision === 'approved') {
                faceOk = true
                setFaceStatus('pass')
            } else if (r.data.success && decision === 'manual_review') {
                faceOk = true
                setFaceStatus('fail')
                setVerifyError(`Face match is borderline (${score}%). Admin review required.`)
            } else {
                setFaceStatus('fail')
                if (livenessOk) {
                    setVerifyError(r.data.message || `Face mismatch (${score ?? 0}%).`)
                }
            }
        } catch {
            setFaceStatus('fail')
            faceDecisionLocal = ''
            setVerifyError('Face matching service unavailable.')
        }

        const passed = livenessOk && faceOk
        setOverallPass(passed)
        setVerifyDone(true)
        setVerifying(false)

        if (role === 'host' || passed) {
            // Set flag for ALL host flows — even when AI passes, backend still sets them to pending
            if (role === 'host') setHostWillSubmitToAdmin(true)
            setTimeout(() => {
                return handleFinalRegistration(ocrResult, faceDecisionLocal)
            }, 1500)
        }
    }

    /**
     * handleFinalRegistration - Submits final registration data to the backend.
     */
    const handleFinalRegistration = async (ocrResult, faceDecisionLocal) => {
        if (registering) {
            return
        }
        setRegistering(true)
        try {
            const fd = new FormData()
            fd.append('username', username.trim())
            fd.append('email', email.trim())
            fd.append('password', password)
            fd.append('dob', dob)
            fd.append('phone', phone.trim())
            fd.append('address', address.trim())
            fd.append('role', role)
            if (profileImg) {
                fd.append('profileImage', profileImg)
            }
            if (cnicFront) {
                fd.append('frontImage', cnicFront)
            }
            if (cnicBack) {
                fd.append('backImage', cnicBack)
            }
            if (selfieImg) {
                fd.append('selfieImage', selfieImg)
            }
            // Forward the AWS liveness session so the backend can re-verify the
            // live result server-side and use the AWS-captured frame as the selfie.
            if (livenessSessionId) {
                fd.append('livenessSessionId', livenessSessionId)
            }

            if (ocrResult) {
                const cnicData = {
                    cnicNumber: ocrResult.cnicNumber,
                    fullName: ocrResult.fullName,
                    dateOfBirth: ocrResult.dateOfBirth,
                    confidence: ocrResult.confidence,
                    faceMatchScore: faceScore,
                    livenessScore: livenessConfidence ?? 0
                }
                fd.append('cnicData', JSON.stringify(cnicData))
            }
            
            if (faceDecisionLocal) {
                fd.append('faceDecision', faceDecisionLocal)
            }

            // Never force Content-Type on a FormData body — axios/the browser must
            // compute it themselves so the multipart boundary matches the actual body,
            // otherwise the server receives an unparseable request (no fields, no files).
            const res = await axios.post(`${BASE_URL}/user/register-user`, fd, {
                withCredentials: false,
            })
            
            if (res.data.success) {
                sessionStorage.removeItem(SIGNUP_STORAGE_KEY)
                setRegResult({
                    isVerified: res.data.isVerified,
                    attemptsRemaining: res.data.attemptsRemaining,
                })
                setStep(6)
            }
        } catch (e) {
            const code = e.response?.data?.code
            const msg  = e.response?.data?.message || 'Registration failed'

            if (code === 'CNIC_DUPLICATE') {
                // CNIC already registered — cannot fix by going back, show dedicated error
                setVerifyError(msg)
                setOverallPass(false)
                setVerifyDone(true)
                return
            }

            setStep(4)
            setOverallPass(false)
        } finally {
            setRegistering(false)
        }
    }

    // --- Sub-Panels ---

    /**
     * LeftPanel - Decorative sidebar component.
     */
    const LeftPanel = () => {
        return (
            <div className="hidden lg:flex w-[420px] flex-shrink-0 bg-[var(--bv-bg-raised)] flex-col justify-between p-10 relative overflow-hidden border-r border-[var(--bv-border)]">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--bv-gold)]/8 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2.5 mb-16">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-lg flex items-center justify-center">
                            <Sparkles size={14} className="text-[var(--bv-bg)]" />
                        </div>
                        <span className="font-display text-lg text-[var(--bv-text)]">
                            Book<span className="text-[var(--bv-gold)]">Vibe</span>
                        </span>
                    </Link>
                    <h1 className="font-display text-4xl text-[var(--bv-text)] leading-[1.15]">
                        Your next<br /><span className="text-[var(--bv-gold)]">stay awaits.</span>
                    </h1>
                    <p className="text-[var(--bv-text-muted)] mt-4 text-sm leading-relaxed">
                        Join thousands of travelers discovering authentic stays across Pakistan.
                    </p>
                    <div className="space-y-4 mt-8">
                        {
                            [
                                { icon: Shield, text: 'CNIC & face verification' },
                                { icon: Sparkles, text: 'Homemade food & medical support' },
                                { icon: CheckCircle, text: 'Secure bookings & payments' }
                            ].map(({ icon: Icon, text }) => {
                                return (
                                    <div key={text} className="flex items-center gap-3">
                                        <div className="w-7 h-7 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Icon size={13} className="text-[var(--bv-gold)]" />
                                        </div>
                                        <span className="text-[var(--bv-text-muted)] text-sm">{text}</span>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
                <div className="relative z-10 bv-card-static p-5">
                    <p className="text-[var(--bv-text-muted)] text-sm italic leading-relaxed">
                        "Booking was smooth and the host was incredibly welcoming. The food was a bonus!"
                    </p>
                    <div className="flex items-center gap-2.5 mt-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-full flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs">A</div>
                        <div>
                            <p className="text-xs font-bold text-[var(--bv-text)]">Ayesha R.</p>
                            <p className="text-[10px] text-[var(--bv-text-dim)]">Lahore</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex">
            <LeftPanel />
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-[var(--bv-border)]">
                    <div className="flex items-center gap-2 lg:hidden">
                        <div className="w-7 h-7 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-lg flex items-center justify-center">
                            <Sparkles size={14} className="text-[var(--bv-bg)]" />
                        </div>
                        <span className="font-display text-[var(--bv-text)]">
                            Book<span className="text-[var(--bv-gold)]">Vibe</span>
                        </span>
                    </div>
                    <div className="hidden lg:block" />
                    <p className="text-sm text-[var(--bv-text-muted)]">
                        Have an account? <Link to="/login" className="text-[var(--bv-gold)] font-semibold">Sign in</Link>
                    </p>
                </div>
                <div className="flex-1 flex items-start justify-center py-10 px-6 sm:px-10">
                    <div className="w-full max-w-md bv-animate-in">
                        {
                            role && step > 1 && step < 6 && (
                                <StepBar steps={steps} current={step} />
                            )
                        }

                        {/* --- STEP 1: Role --- */}
                        {
                            step === 1 && (
                                <div>
                                    <div className="mb-8">
                                        <h2 className="font-display text-2xl text-[var(--bv-text)]">Create your account</h2>
                                        <p className="text-[var(--bv-text-muted)] text-sm mt-1.5">How will you use BookVibe?</p>
                                    </div>
                                    <div className="space-y-3">
                                        {
                                            [
                                                { r: 'guest', icon: User, title: 'Guest', desc: 'Browse and book stays', badge: 'Most popular' },
                                                { r: 'host', icon: Briefcase, title: 'Host', desc: 'List your property and earn' }
                                            ].map(({ r, icon: Icon, title, desc, badge }) => {
                                                return (
                                                    <button
                                                        key={r}
                                                        onClick={() => {
                                                            setRole(r)
                                                            setStep(2)
                                                        }}
                                                        className="w-full text-left group rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-card)] hover:border-[var(--bv-gold-border)] hover:shadow-[var(--bv-shadow-md)] p-5 transition-all"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-11 h-11 rounded-xl bg-[var(--bv-surface)] group-hover:bg-[var(--bv-gold-glow)] flex items-center justify-center transition">
                                                                    <Icon size={20} className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="font-semibold text-[var(--bv-text)]">{title}</h3>
                                                                        {
                                                                            badge && (
                                                                                <span className="text-[10px] font-bold bv-badge bv-badge-gold">{badge}</span>
                                                                            )
                                                                        }
                                                                    </div>
                                                                    <p className="text-[var(--bv-text-dim)] text-sm mt-0.5">{desc}</p>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={18} className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition flex-shrink-0" />
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                            )
                        }

                        {/* --- STEP 2: Details --- */}
                        {
                            step === 2 && (
                                <div className="space-y-5">
                                    <div className="mb-2">
                                        <h2 className="font-display text-2xl text-[var(--bv-text)]">Your details</h2>
                                        <p className="text-[var(--bv-text-muted)] text-sm mt-1.5">Fill in your account information</p>
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="relative">
                                            {
                                                profilePrev ? (
                                                    <img src={profilePrev} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--bv-border)]" />
                                                ) : (
                                                    <div className="w-20 h-20 rounded-2xl bg-[var(--bv-surface)] border border-dashed border-[var(--bv-border)] flex items-center justify-center">
                                                        <User size={24} className="text-[var(--bv-text-dim)]" />
                                                    </div>
                                                )
                                            }
                                            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-lg flex items-center justify-center cursor-pointer shadow-[var(--bv-shadow-gold)]">
                                                <Camera size={13} className="text-[var(--bv-bg)]" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        return setProfileImg(e.target.files?.[0] || null)
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Input
                                            icon={User}
                                            label="Full Name"
                                            value={username}
                                            onChange={(e) => {
                                                return setUsername(e.target.value)
                                            }}
                                            placeholder="Ahmad Khan"
                                            required
                                        />
                                        <Input
                                            icon={Mail}
                                            label="Email"
                                            value={email}
                                            onChange={(e) => {
                                                return setEmail(e.target.value)
                                            }}
                                            placeholder="you@example.com"
                                            required
                                            type="email"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                icon={Lock}
                                                label="Password"
                                                value={password}
                                                onChange={(e) => {
                                                    return setPassword(e.target.value)
                                                }}
                                                placeholder="Min 6 chars"
                                                required
                                                type="password"
                                            />
                                            <Input
                                                icon={Lock}
                                                label="Confirm"
                                                value={confirm}
                                                onChange={(e) => {
                                                    return setConfirm(e.target.value)
                                                }}
                                                placeholder="Repeat"
                                                required
                                                type="password"
                                            />
                                        </div>
                                        <Input
                                            icon={Phone}
                                            label="Phone"
                                            value={phone}
                                            onChange={(e) => {
                                                return setPhone(e.target.value)
                                            }}
                                            placeholder="+923001234567"
                                            required
                                            hint="Include country code"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                icon={Calendar}
                                                label="Date of Birth"
                                                value={dob}
                                                onChange={(e) => {
                                                    return setDob(e.target.value)
                                                }}
                                                required
                                                type="date"
                                            />
                                            <Input
                                                icon={MapPin}
                                                label="Address"
                                                value={address}
                                                onChange={(e) => {
                                                    return setAddress(e.target.value)
                                                }}
                                                placeholder="City"
                                            />
                                        </div>
                                    </div>
                                    <PrimaryBtn onClick={handleAccountNext} disabled={loading}>
                                        {
                                            loading ? (
                                                <>
                                                    <Loader2 size={15} className="animate-spin" /> Sending OTP...
                                                </>
                                            ) : (
                                                <>
                                                    Continue <ArrowRight size={15} />
                                                </>
                                            )
                                        }
                                    </PrimaryBtn>
                                    <button
                                        onClick={() => {
                                            return setStep(1)
                                        }}
                                        className="w-full text-center text-sm text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] transition"
                                    >
                                        ← Back
                                    </button>
                                </div>
                            )
                        }

                        {/* --- STEP 3: Email OTP --- */}
                        {
                            step === 3 && (
                                <div className="space-y-7">
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center mb-4">
                                            <Mail size={22} className="text-[var(--bv-gold)]" />
                                        </div>
                                        <h2 className="font-display text-2xl text-[var(--bv-text)]">Check your email</h2>
                                        <p className="text-[var(--bv-text-muted)] text-sm mt-1.5">
                                            Code sent to <span className="font-semibold text-[var(--bv-text)]">{email}</span>
                                        </p>
                                    </div>
                                    <OTPInput
                                        otp={emailOtp}
                                        setOtp={setEmailOtp}
                                        onComplete={handleEmailOTPVerify}
                                    />
                                    <PrimaryBtn
                                        onClick={() => {
                                            return handleEmailOTPVerify()
                                        }}
                                        disabled={loading || emailOtp.filter((d) => { return d }).length < OTP_LEN}
                                    >
                                        {
                                            loading ? (
                                                <>
                                                    <Loader2 size={15} className="animate-spin" /> Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    Verify Email <ArrowRight size={15} />
                                                </>
                                            )
                                        }
                                    </PrimaryBtn>
                                    <div className="text-center text-sm">
                                        {
                                            emailCooldown > 0 ? (
                                                <p className="text-[var(--bv-text-dim)]">
                                                    Resend in <span className="font-semibold text-[var(--bv-text-muted)]">{emailCooldown}s</span>
                                                </p>
                                            ) : (
                                                <button
                                                    onClick={resendEmailOTP}
                                                    className="inline-flex items-center gap-1.5 text-[var(--bv-gold)] font-semibold"
                                                >
                                                    <RefreshCw size={12} /> Resend code
                                                </button>
                                            )
                                        }
                                    </div>
                                </div>
                            )
                        }

                        {/* --- STEP 4: Documents --- */}
                        {
                            step === 4 && (
                                <div className="space-y-6">
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl bg-[var(--bv-surface)] flex items-center justify-center mb-4">
                                            <UserCheck size={22} className="text-[var(--bv-text-muted)]" />
                                        </div>
                                        <h2 className="font-display text-2xl text-[var(--bv-text)]">Identity documents</h2>
                                        <p className="text-[var(--bv-text-muted)] text-sm mt-1.5">Upload CNIC front/back and capture a live selfie</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <ImageUploadBox
                                            label="CNIC Front"
                                            image={cnicFront}
                                            setImage={setCnicFront}
                                            preview={cnicFrontPrev}
                                            required
                                            hint="Landscape photo of CNIC front"
                                            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                                            onValidate={validateCnicFile}
                                        />
                                        <ImageUploadBox
                                            label="CNIC Back"
                                            image={cnicBack}
                                            setImage={setCnicBack}
                                            preview={cnicBackPrev}
                                            required
                                            hint="Landscape photo of CNIC back"
                                            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                                            onValidate={validateCnicFile}
                                        />
                                    </div>
                                    <div>
                                        <label className="bv-label">
                                            Live Selfie <span className="text-[var(--bv-danger)]">*</span>
                                        </label>
                                        {
                                            selfiePrev ? (
                                                <div className="relative rounded-xl overflow-hidden border border-emerald-500/30">
                                                    <img src={selfiePrev} alt="" className="w-full h-40 object-cover" />
                                                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 text-white text-xs rounded-lg">
                                                        <CheckCircle size={12} />
                                                        Live verified{livenessConfidence != null ? ` (${Math.round(livenessConfidence)}%)` : ''}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelfieImg(null)
                                                            setLivenessConfidence(null)
                                                        }}
                                                        className="absolute top-2 right-2 px-3 py-1 bg-[var(--bv-card)]/90 text-[var(--bv-text)] text-xs rounded-lg border border-[var(--bv-border)]"
                                                    >
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
                                                        onFail={handleLivenessFail}
                                                        onError={handleLivenessError}
                                                    />
                                                </Suspense>
                                            )
                                        }
                                    </div>
                                    <div className="flex items-start gap-2.5 p-3.5 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
                                        <Shield size={14} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
                                            Documents encrypted. CNIC shared with hosts only on booking.
                                        </p>
                                    </div>
                                    <PrimaryBtn onClick={proceedToVerification} disabled={!cnicFront || !cnicBack || !selfieImg}>
                                        Verify Identity <ArrowRight size={15} />
                                    </PrimaryBtn>
                                    <button
                                        onClick={() => {
                                            return setStep(3)
                                        }}
                                        className="w-full text-center text-sm text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)] transition"
                                    >
                                        ← Back
                                    </button>
                                </div>
                            )
                        }

                        {/* --- STEP 5: Verification --- */}
                        {
                            step === 5 && (
                                <div className="space-y-5">
                                    <div>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                                            verifying || registering ? 'bg-[var(--bv-gold-glow)]'
                                            : overallPass ? 'bg-emerald-500/10'
                                            : verifyDone && hostWillSubmitToAdmin ? 'bg-amber-500/10'
                                            : verifyDone ? 'bg-red-500/10'
                                            : 'bg-[var(--bv-gold-glow)]'
                                        }`}>
                                            {
                                                verifying || registering ? (
                                                    <Loader2 size={22} className="text-[var(--bv-gold)] animate-spin" />
                                                ) : overallPass ? (
                                                    <CheckCircle size={22} className="text-[var(--bv-success)]" />
                                                ) : verifyDone && hostWillSubmitToAdmin ? (
                                                    <Clock size={22} className="text-amber-500" />
                                                ) : verifyDone ? (
                                                    <XCircle size={22} className="text-[var(--bv-danger)]" />
                                                ) : (
                                                    <Shield size={22} className="text-[var(--bv-gold)]" />
                                                )
                                            }
                                        </div>
                                        <h2 className="font-display text-2xl text-[var(--bv-text)]">
                                            {
                                                verifying ? (
                                                    'Verifying...'
                                                ) : registering ? (
                                                    'Creating account...'
                                                ) : overallPass ? (
                                                    faceDecision === 'manual_review' ? 'Manual review queued' : 'Verified!'
                                                ) : verifyDone && hostWillSubmitToAdmin ? (
                                                    'Submitting for Admin Review'
                                                ) : verifyDone ? (
                                                    'Verification failed'
                                                ) : (
                                                    'Identity verification'
                                                )
                                            }
                                        </h2>
                                        {
                                            verifying && (
                                                <p className="text-[var(--bv-text-muted)] text-sm mt-1.5">Running OCR, liveness & face match. Up to 30s.</p>
                                            )
                                        }
                                    </div>
                                    <div className="bv-card-static p-5">
                                        <p className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-widest mb-2">Checks</p>
                                        <VerifyRow
                                            label="CNIC OCR"
                                            status={ocrStatus}
                                            value={
                                                ocrStatus === 'pass' && ocrData ? (
                                                    [ocrData.fullName && `Name: ${ocrData.fullName}`, ocrData.cnicNumber && `CNIC: ${ocrData.cnicNumber}`].filter(Boolean).join(' · ')
                                                ) : ocrStatus === 'fail' ? (
                                                    'Could not read — can add manually later'
                                                ) : (
                                                    ''
                                                )
                                            }
                                        />
                                        <VerifyRow
                                            label="Liveness Detection"
                                            status={livenessStatus}
                                            value={
                                                livenessStatus === 'pass' ? (
                                                    'Real person confirmed'
                                                ) : livenessStatus === 'fail' ? (
                                                    'Could not confirm'
                                                ) : (
                                                    ''
                                                )
                                            }
                                        />
                                        <VerifyRow
                                            label="Face Match"
                                            status={faceStatus}
                                            value={
                                                faceStatus === 'pass' ? (
                                                    `Match confirmed${faceScore !== null ? ` — ${faceScore}%` : ''}`
                                                ) : faceStatus === 'fail' ? (
                                                    faceDecision === 'manual_review' ? 'Manual review required' : `No match${faceScore !== null ? ` — ${faceScore}%` : ''}`
                                                ) : (
                                                    ''
                                                )
                                            }
                                        />
                                    </div>
                                    {
                                        ocrStatus === 'pass' && ocrData && (
                                            <div className="bv-card-static p-5 border-[var(--bv-gold-border)]">
                                                <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <CreditCard size={12} /> CNIC Data
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {
                                                        [
                                                            { l: 'CNIC', v: ocrData.cnicNumber },
                                                            { l: 'Name', v: ocrData.fullName },
                                                            { l: 'DOB', v: ocrData.dateOfBirth },
                                                            { l: 'Confidence', v: ocrData.confidence ? `${ocrData.confidence}%` : null }
                                                        ].filter((r) => {
                                                            return r.v
                                                        }).map(({ l, v }) => {
                                                            return (
                                                                <div key={l}>
                                                                    <p className="text-[10px] text-[var(--bv-gold-dim)] uppercase font-bold tracking-wider">{l}</p>
                                                                    <p className="text-sm font-bold text-[var(--bv-text)] mt-0.5">{v}</p>
                                                                </div>
                                                            )
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        )
                                    }
                                    {
                                        registering && (
                                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                <Loader2 size={16} className="text-[var(--bv-success)] animate-spin" />
                                                <p className="text-sm font-semibold text-[var(--bv-success)]">Creating account...</p>
                                            </div>
                                        )
                                    }
                                    {
                                        verifyDone && overallPass && faceDecision === 'manual_review' && verifyError && (
                                            <div className="flex items-start gap-2.5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                <AlertTriangle size={16} className="text-[var(--bv-warning)] flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-[var(--bv-warning)] leading-relaxed">{verifyError}</p>
                                            </div>
                                        )
                                    }
                                    {/* Host: AI failed but auto-proceeding to admin review */}
                                    {
                                        verifyDone && !overallPass && hostWillSubmitToAdmin && !registering && (
                                            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-amber-500 leading-relaxed">
                                                    AI checks are optional for hosts. Your documents will be reviewed manually by our admin team within <strong>24–48 hours</strong>.
                                                </p>
                                            </div>
                                        )
                                    }
                                    {/* Guest AI failed, or host got hard error (invalid doc) — show retry */}
                                    {
                                        verifyDone && !overallPass && !hostWillSubmitToAdmin && !registering && (
                                            <div className="space-y-3">
                                                {
                                                    verifyError && (
                                                        <div className="flex items-start gap-2.5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                            <AlertTriangle size={16} className="text-[var(--bv-danger)] flex-shrink-0 mt-0.5" />
                                                            <p className="text-sm text-[var(--bv-danger)] leading-relaxed">{verifyError}</p>
                                                        </div>
                                                    )
                                                }
                                                {/* CNIC already registered — cannot retry, must login */}
                                                {
                                                    verifyError && verifyError.includes('already registered') && (
                                                        <button
                                                            onClick={() => navigate('/login')}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bv-btn-gold text-sm"
                                                        >
                                                            Go to Login
                                                        </button>
                                                    )
                                                }
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setSelfieImg(null)
                                                            setStep(4)
                                                        }}
                                                        className="flex items-center justify-center gap-2 py-3 bv-btn-outline text-sm"
                                                    >
                                                        <Camera size={14} /> Retake Selfie
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setVerifyDone(false)
                                                            setVerifyError('')
                                                            setOcrStatus('idle')
                                                            setFaceStatus('idle')
                                                            setLivenessStatus('idle')
                                                            setTimeout(runVerification, 100)
                                                        }}
                                                        className="flex items-center justify-center gap-2 py-3 bv-btn-gold text-sm"
                                                    >
                                                        <RefreshCw size={14} /> Try Again
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>
                            )
                        }

                        {/* --- STEP 6: Done --- */}
                        {step === 6 && (
                            <div className="text-center space-y-6 py-4">
                                {/* Verified */}
                                {regResult?.isVerified === 'verified' && (
                                    <>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-gradient-to-br from-emerald-500 to-emerald-600">
                                            <UserCheck size={36} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="font-display text-2xl text-[var(--bv-text)]">Identity Verified!</h2>
                                            <p className="text-[var(--bv-text-muted)] text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                                                Hi {username}, your CNIC and selfie passed verification. You can start using BookVibe right away.
                                            </p>
                                        </div>
                                        <div className="bv-card-static p-5 text-left space-y-2.5">
                                            <CheckItem text="Email verified" />
                                            <CheckItem text="Identity verified" />
                                            {ocrData?.cnicNumber && <CheckItem text={`CNIC: ${ocrData.cnicNumber}`} />}
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={() => { sessionStorage.removeItem(SIGNUP_STORAGE_KEY); navigate('/login') }} className="w-full bv-btn-gold py-3.5 text-sm">
                                                Log In to Continue
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Host / Guest pending (admin review) */}
                                {regResult?.isVerified === 'pending' && (
                                    <>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-[var(--bv-shadow-gold)] bg-gradient-to-br from-amber-500 to-amber-600">
                                            <Clock size={36} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="font-display text-2xl text-[var(--bv-text)]">
                                                {role === 'host' ? 'Host Application Under Review' : 'Account Under Review'}
                                            </h2>
                                            <p className="text-[var(--bv-text-muted)] text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                                                Hi {username}, {role === 'host'
                                                    ? 'host accounts always require admin approval before you can list properties. This takes 24–48 hours.'
                                                    : 'your documents have been submitted for manual verification. This usually takes 24–48 hours.'}
                                            </p>
                                        </div>
                                        <div className="bv-card-static p-5 text-left space-y-2.5">
                                            <CheckItem text="Email verified" />
                                            <CheckItem text="Identity documents uploaded" />
                                            {ocrData?.cnicNumber && <CheckItem text={`CNIC: ${ocrData.cnicNumber}`} />}
                                            <div className="flex items-center gap-2.5 text-sm text-[var(--bv-warning)]">
                                                <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                                    <Loader2 size={11} className="animate-spin" />
                                                </div>
                                                Admin review in progress (24–48h)
                                            </div>
                                        </div>
                                        <div className="bv-card-static p-4 border-amber-500/20 bg-amber-500/5 text-left">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle size={16} className="text-[var(--bv-warning)] flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-[var(--bv-text-muted)] leading-relaxed">
                                                    You'll receive an email at <span className="font-semibold text-[var(--bv-text)]">{email}</span> once reviewed.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={() => { sessionStorage.removeItem(SIGNUP_STORAGE_KEY); navigate('/') }} className="w-full bv-btn-gold py-3.5 text-sm">
                                                Back to Home
                                            </button>
                                            <p className="text-[10px] text-[var(--bv-text-dim)]">Check your email for updates</p>
                                        </div>
                                    </>
                                )}

                                {/* Guest rejected — AI failed, can retry */}
                                {regResult?.isVerified === 'rejected' && (
                                    <>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-gradient-to-br from-red-500 to-red-600">
                                            <XCircle size={36} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="font-display text-2xl text-[var(--bv-text)]">Verification Failed</h2>
                                            <p className="text-[var(--bv-text-muted)] text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                                                Hi {username}, your account was created but identity verification did not pass.
                                                You have <strong className="text-[var(--bv-text)]">{regResult.attemptsRemaining} attempt(s)</strong> remaining to re-upload clearer images.
                                            </p>
                                        </div>
                                        <div className="bv-card-static p-5 text-left space-y-2.5">
                                            <CheckItem text="Email verified" />
                                            <CheckItem text="Account created" />
                                            <div className="flex items-center gap-2.5 text-sm text-[var(--bv-danger)]">
                                                <XCircle size={14} className="flex-shrink-0" />
                                                Identity verification failed
                                            </div>
                                        </div>
                                        <div className="bv-card-static p-4 border-red-500/20 bg-red-500/5 text-left">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle size={16} className="text-[var(--bv-danger)] flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-[var(--bv-text-muted)] leading-relaxed">
                                                    Log in and go to <strong>Profile → Re-submit Documents</strong> to upload clearer CNIC photos and retake your selfie.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={() => { sessionStorage.removeItem(SIGNUP_STORAGE_KEY); navigate('/login') }} className="w-full bv-btn-gold py-3.5 text-sm">
                                                Log In & Re-submit
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Signup
