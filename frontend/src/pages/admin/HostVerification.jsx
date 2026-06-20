import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import { ShieldCheck, RefreshCw, CheckCircle, XCircle, Eye, X, CreditCard, Fingerprint, ScanFace, User, Calendar, MapPin, AlertCircle } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const HostVerification = () => {
    const [hosts, setHosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoad, setActionLoad] = useState(null)
    const [detail, setDetail] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const [pageError, setPageError] = useState(null)
    const [formError, setFormError] = useState(null)

    const fetch = async () => {
        try {
            setLoading(true)
            const r = await axios.get(`${BASE}/user/admin/pending-hosts`, getAuthConfig())
            setHosts(r.data.hosts || [])
            setPageError(null)
        } catch {
            setPageError('Failed to load pending hosts. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetch() }, [])

    const handleAction = async (id, status) => {
        if (status === 'rejected' && !rejectReason.trim()) {
            setFormError('Please enter a rejection reason before rejecting.')
            return
        }
        setFormError(null)
        try {
            setActionLoad(id)
            await axios.patch(`${BASE}/user/admin/verify-host/${id}`, { status, rejectedReason: rejectReason }, getAuthConfig())
            setHosts(p => p.filter(h => h._id !== id))
            setDetail(null)
            setRejectReason('')
        } catch (e) {
            setPageError(e.response?.data?.message || 'Failed to update verification status')
        } finally {
            setActionLoad(null)
        }
    }

    return (
        <div className="space-y-8">
            {pageError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
                    <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
                    <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
                    <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
                        <X size={14} />
                    </button>
                </div>
            )}

            {detail && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl bv-card-static p-6 bv-animate-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-[var(--bv-text)]">KYC Review</h3><button onClick={() => { setDetail(null); setRejectReason(''); setFormError(null) }} className="p-2 hover:bg-[var(--bv-surface)] rounded-xl"><X size={16} className="text-[var(--bv-text-dim)]" /></button></div>

                {/* Applicant Info */}
                <div className="flex items-center gap-4 mb-5"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-lg">{detail.username?.charAt(0)?.toUpperCase()}</div><div><h4 className="font-bold text-[var(--bv-text)]">{detail.username}</h4><p className="text-xs text-[var(--bv-text-dim)]">{detail.email} · {detail.phone || '—'}</p></div></div>

                {/* OCR Extracted Data */}
                {detail.cnicData?.cnicNumber ? (
                    <div className="bv-card-static p-4 mb-4 border-[var(--bv-gold-border)]">
                        <p className="text-sm font-bold text-[var(--bv-gold)] flex items-center gap-2 mb-3"><Fingerprint size={14} /> OCR Extracted Data</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {[
                                { l: 'CNIC', v: detail.cnicData.cnicNumber, i: CreditCard },
                                { l: 'Name', v: detail.cnicData.fullName, i: User },
                                { l: 'Father', v: detail.cnicData.fatherName, i: User },
                                { l: 'DOB', v: detail.cnicData.dateOfBirth, i: Calendar },
                                { l: 'Address', v: detail.cnicData.address, i: MapPin },
                                { l: 'Gender', v: detail.cnicData.gender, i: User },
                            ].filter(x => x.v).map(({ l, v, i: I }) => (
                                <div key={l} className="flex items-start gap-2"><I size={12} className="text-[var(--bv-gold)] mt-1 flex-shrink-0" /><div><p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">{l}</p><p className="text-[var(--bv-text)] font-semibold">{v}</p></div></div>
                            ))}
                        </div>

                        {/* Confidence Scores */}
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--bv-divider)]">
                            {detail.cnicData.confidence && <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${detail.cnicData.confidence >= 80 ? 'bg-emerald-500/10 text-[var(--bv-success)]' : detail.cnicData.confidence >= 50 ? 'bg-amber-500/10 text-[var(--bv-warning)]' : 'bg-red-500/10 text-[var(--bv-danger)]'}`}><ShieldCheck size={12} /> OCR: {detail.cnicData.confidence}%</div>}
                            {detail.cnicData.faceMatchScore && <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${detail.cnicData.faceMatchScore >= 70 ? 'bg-emerald-500/10 text-[var(--bv-success)]' : 'bg-red-500/10 text-[var(--bv-danger)]'}`}><ScanFace size={12} /> Face Match: {detail.cnicData.faceMatchScore}%</div>}
                            {detail.cnicData.livenessScore && <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${detail.cnicData.livenessScore >= 70 ? 'bg-emerald-500/10 text-[var(--bv-success)]' : 'bg-red-500/10 text-[var(--bv-danger)]'}`}><User size={12} /> Liveness: {detail.cnicData.livenessScore}%</div>}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl mb-4"><p className="text-xs text-[var(--bv-warning)] font-semibold">OCR data not available — Python verification service may have been offline during registration. Review documents manually.</p></div>
                )}

                {/* Documents */}
                <p className="bv-label mb-2">Identity Documents</p>
                <div className="grid grid-cols-3 gap-3 mb-5">{[{ l: 'CNIC Front', s: detail.cnicImage?.frontImage?.url }, { l: 'CNIC Back', s: detail.cnicImage?.backImage?.url }, { l: 'Selfie', s: detail.selfieImage?.url }].map(({ l, s }) => <div key={l} className="text-center"><p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold mb-1">{l}</p>{s ? <img src={s} alt="" className="w-full h-28 object-cover rounded-xl border border-[var(--bv-border)]" /> : <div className="w-full h-28 rounded-xl bg-[var(--bv-surface)] border border-dashed border-[var(--bv-border)] flex items-center justify-center text-[10px] text-[var(--bv-text-dim)]">N/A</div>}</div>)}</div>

                {/* Cross-check: Compare entered name vs CNIC name */}
                {detail.cnicData?.fullName && detail.username && (
                    <div className={`p-3 rounded-xl text-xs mb-4 ${detail.cnicData.fullName.toLowerCase().includes(detail.username.toLowerCase().split(' ')[0]) ? 'bg-emerald-500/10 text-[var(--bv-success)] border border-emerald-500/20' : 'bg-amber-500/10 text-[var(--bv-warning)] border border-amber-500/20'}`}>
                        <p className="font-bold">Name Cross-Check</p>
                        <p className="mt-0.5">Entered: <strong>{detail.username}</strong> | CNIC: <strong>{detail.cnicData.fullName}</strong></p>
                    </div>
                )}

                <div className="mb-1">
                    <label className="bv-label">Rejection Reason (required if rejecting)</label>
                    <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); setFormError(null) }} rows={2} placeholder="Why are you rejecting..." className="bv-input resize-none" />
                </div>

                {formError && (
                    <p className="text-xs text-[var(--bv-danger)] mb-3 flex items-center gap-1.5">
                        <AlertCircle size={12} /> {formError}
                    </p>
                )}

                <div className="flex gap-3 mt-3">
                    <button onClick={() => handleAction(detail._id, 'verified')} disabled={actionLoad === detail._id} className="flex-1 bv-btn-gold text-sm py-3 flex items-center justify-center gap-2"><CheckCircle size={14} /> Approve Host</button>
                    <button onClick={() => handleAction(detail._id, 'rejected')} disabled={actionLoad === detail._id} className="flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 flex items-center justify-center gap-2 disabled:opacity-50"><XCircle size={14} /> Reject</button>
                </div>
            </div></div>}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2"><ShieldCheck size={26} className="text-[var(--bv-gold)]" /> Host Verification</h1><p className="text-[var(--bv-text-dim)] text-sm mt-1">{hosts.length} pending review</p></div><button onClick={fetch} disabled={loading} className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>

            {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bv-skeleton h-20 rounded-2xl" />)}</div>
            : hosts.length === 0 ? <div className="bv-card-static py-20 text-center"><ShieldCheck size={48} className="mx-auto mb-3 text-[var(--bv-success)] opacity-30" /><p className="font-bold text-[var(--bv-text)]">All caught up!</p><p className="text-sm text-[var(--bv-text-dim)] mt-1">No pending verifications</p></div>
            : <div className="space-y-3">{hosts.map(h => (
                <div key={h._id} className="bv-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1"><div className="w-12 h-12 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] flex items-center justify-center"><ShieldCheck size={20} className="text-[var(--bv-warning)]" /></div><div className="min-w-0"><p className="font-semibold text-[var(--bv-text)]">{h.username}</p><p className="text-xs text-[var(--bv-text-dim)]">{h.email} · {h.phone || '—'}</p>{h.cnicData?.cnicNumber && <p className="text-xs text-[var(--bv-gold)] mt-0.5">CNIC: {h.cnicData.cnicNumber}</p>}</div></div>
                    <div className="flex gap-2"><button onClick={() => setDetail(h)} className="bv-btn-gold text-xs px-4 py-2 flex items-center gap-1.5"><Eye size={12} /> Review</button><button onClick={() => handleAction(h._id, 'verified')} disabled={actionLoad === h._id} className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5 !border-emerald-500/30 !text-[var(--bv-success)]"><CheckCircle size={12} /> Quick Approve</button></div>
                </div>
            ))}</div>}
        </div>
    )
}
export default HostVerification
