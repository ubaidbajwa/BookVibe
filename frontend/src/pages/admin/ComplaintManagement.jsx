import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import { getSocket } from '../../hooks/useSocket'
import {
    AlertCircle, RefreshCw, Eye, CheckCircle, Clock,
    XCircle, X, MessageSquare, Search, ShieldAlert, Ban, Loader2, Trash2, Send
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const statusMap = {
    open:      { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',   dot: 'bg-amber-500' },
    reviewing: { badge: 'bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] border-[var(--bv-gold-border)]', dot: 'bg-[var(--bv-gold)]' },
    resolved:  { badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' },
    dismissed: { badge: 'bg-red-500/10 text-red-600 border-red-500/20',          dot: 'bg-red-500' },
}

const Badge = ({ s }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${statusMap[s]?.badge || statusMap.open.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusMap[s]?.dot || 'bg-amber-500'}`} />
        {s}
    </span>
)

const fmtDate = (v) => {
    if (!v) return '—'
    return new Date(v).toLocaleDateString('en-PK', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

// Minimal delete confirmation modal
const DeleteModal = ({ show, loading, onConfirm, onCancel }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bv-card-static rounded-2xl p-6 text-center bv-animate-in shadow-xl shadow-red-500/5">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                    <Trash2 size={20} className="text-[var(--bv-danger)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--bv-text)]">Delete this complaint?</h3>
                <p className="text-sm text-[var(--bv-text-muted)] mt-2 leading-relaxed">
                    This action cannot be undone. It will be permanently removed from the system.
                </p>
                <div className="flex gap-3 mt-6">
                    <button onClick={onCancel} disabled={loading} className="flex-1 bv-btn-outline py-2.5">
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={loading} 
                        className="flex-1 bv-btn py-2.5 bg-[var(--bv-danger)] text-white hover:bg-red-600 transition disabled:opacity-50"
                    >
                        {loading ? 'Deleting...' : 'Yes, delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ComplaintManagement = () => {
    const [searchParams] = useSearchParams()
    const [complaints, setComplaints] = useState([])
    const [loading, setLoading] = useState(true)
    const [detail, setDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [alreadyBlacklisted, setAlreadyBlacklisted] = useState(false)
    const [response, setResponse] = useState('')
    const [actionLoad, setActionLoad] = useState(false)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [pageError, setPageError] = useState(null)

    // Delete state
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadComplaints = async () => {
        try {
            setLoading(true)
            const r = await axios.get(`${BASE}/user/admin/complaints`, getAuthConfig())
            setComplaints(r.data.complaints || [])
        } catch {
            setPageError('Failed to load complaints. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadComplaints() }, [])

    // Real-time: update list and open modal when any party sends a message
    useEffect(() => {
        const socket = getSocket()
        if (!socket) return
        const handler = ({ complaint }) => {
            setComplaints((prev) => prev.map((c) => c._id === complaint._id ? complaint : c))
            setDetail((prev) => prev && prev._id === complaint._id ? complaint : prev)
        }
        socket.on('complaint:message', handler)
        return () => socket.off('complaint:message', handler)
    }, [])

    // If URL has ?id= (from notification click), auto-open that complaint's detail modal.
    useEffect(() => {
        const targetId = searchParams.get('id')
        if (!targetId || complaints.length === 0 || detail) return
        const found = complaints.find((c) => c._id === targetId)
        if (found) openDetail(found)
    }, [complaints, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

    // Open the review modal and fetch full detail (offender KYC + evidence).
    const openDetail = async (c) => {
        setDetail(c)
        setResponse('')
        setAlreadyBlacklisted(false)
        try {
            setDetailLoading(true)
            const r = await axios.get(`${BASE}/user/admin/complaint/${c._id}`, getAuthConfig())
            if (r.data?.complaint) setDetail(r.data.complaint)
            setAlreadyBlacklisted(!!r.data?.blacklisted)
        } catch (e) {
            setPageError(e.response?.data?.message || 'Could not load full case detail')
        } finally {
            setDetailLoading(false)
        }
    }

    const handleAction = async (id, status, adminAction = 'none', warnTarget = null) => {
        if (adminAction === 'blocked') {
            const ok = window.confirm(
                'Block this user AND permanently blacklist their CNIC, email, and phone? They will never be able to register on BookVibe again.'
            )
            if (!ok) return
        }
        try {
            setActionLoad(true)
            await axios.patch(
                `${BASE}/user/admin/complaint/${id}`,
                { status, adminResponse: response.trim() || undefined, adminAction, warnTarget },
                getAuthConfig()
            )
            setComplaints((prev) =>
                prev.map((c) => c._id === id ? { ...c, status, adminAction } : c)
            )
            setDetail(null)
            setResponse('')
        } catch (e) {
            setPageError(e.response?.data?.message || 'Action failed. Please try again.')
        } finally {
            setActionLoad(false)
        }
    }

    // Post an admin reply into the conversationThread — delivered to BOTH parties.
    const handleSendMessage = async () => {
        if (!response.trim() || actionLoad) return
        try {
            setActionLoad(true)
            const r = await axios.post(
                `${BASE}/user/admin/complaint/${detail._id}/message`,
                { message: response.trim() },
                getAuthConfig()
            )
            if (r.data?.complaint) {
                setDetail(r.data.complaint)
                setComplaints((prev) =>
                    prev.map((c) => c._id === r.data.complaint._id
                        ? { ...c, conversationThread: r.data.complaint.conversationThread }
                        : c)
                )
            }
            setResponse('')
        } catch (e) {
            setPageError(e.response?.data?.message || 'Failed to send message. Please try again.')
        } finally {
            setActionLoad(false)
        }
    }
    
    const handleDelete = async (id) => {
        try {
            setDeleting(true);
            await axios.delete(`${BASE}/complaints/${id}`, getAuthConfig());
            setComplaints((prev) => prev.filter((c) => c._id !== id));
            if (detail?._id === id) setDetail(null);
            setConfirmDeleteId(null);
        } catch (e) {
            if (e.response?.status === 404) {
                setComplaints((prev) => prev.filter((c) => c._id !== id));
                if (detail?._id === id) setDetail(null);
                setConfirmDeleteId(null);
            } else {
                setPageError(e.response?.data?.message || 'Failed to delete complaint. Please try again.');
            }
        } finally {
            setDeleting(false);
        }
    };

    const filtered = complaints.filter((c) => {
        if (filter !== 'all' && c.status !== filter) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                c.subject?.toLowerCase().includes(q) ||
                c.complainant?.username?.toLowerCase().includes(q) ||
                c.against?.username?.toLowerCase().includes(q) ||
                c.description?.toLowerCase().includes(q)
            )
        }
        return true
    })

    const stats = {
        open:      complaints.filter((c) => c.status === 'open').length,
        reviewing: complaints.filter((c) => c.status === 'reviewing').length,
        resolved:  complaints.filter((c) => c.status === 'resolved').length,
        dismissed: complaints.filter((c) => c.status === 'dismissed').length,
    }

    return (
        <div className="space-y-6">
            {pageError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
                    <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
                    <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
                    <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
                        <X size={14} />
                    </button>
                </div>
            )}
            {/* ── Delete Modal ── */}
            <DeleteModal 
                show={!!confirmDeleteId} 
                loading={deleting} 
                onConfirm={() => handleDelete(confirmDeleteId)} 
                onCancel={() => setConfirmDeleteId(null)} 
            />

            {/* ── Detail Modal ── */}
            {detail && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bv-card-static rounded-2xl max-h-[92vh] overflow-y-auto bv-animate-in">
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center">
                                    <ShieldAlert size={16} className="text-[var(--bv-gold)]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)]">Case Review</p>
                                    <h3 className="text-base font-bold text-[var(--bv-text)] leading-tight">{detail.subject || 'Complaint'}</h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge s={detail.status} />
                                <button
                                    onClick={() => { setDetail(null); setResponse('') }}
                                    className="p-2 hover:bg-[var(--bv-surface)] rounded-xl transition"
                                >
                                    <X size={16} className="text-[var(--bv-text-dim)]" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Parties */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] mb-2">Complainant</p>
                                    <p className="text-sm font-bold text-[var(--bv-text)]">{detail.complainant?.username || '—'}</p>
                                    <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">{detail.complainant?.email || '—'}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-danger)] mb-2">Accused</p>
                                    <p className="text-sm font-bold text-[var(--bv-text)]">{detail.against?.username || '—'}</p>
                                    <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">{detail.against?.email || '—'}</p>
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Category', value: detail.category?.replace('_', ' ') || '—' },
                                    { label: 'Filed', value: fmtDate(detail.createdAt) },
                                    { label: 'Property', value: detail.property?.name || detail.booking?.propertyId?.name || 'N/A' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-3 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">{label}</p>
                                        <p className="text-xs font-semibold text-[var(--bv-text)] mt-1 truncate capitalize">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Description */}
                            <div className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] mb-2">Description</p>
                                <p className="text-sm text-[var(--bv-text-muted)] leading-relaxed">{detail.description}</p>
                            </div>

                            {detailLoading && (
                                <div className="flex items-center gap-2 text-xs text-[var(--bv-text-dim)]">
                                    <Loader2 size={13} className="animate-spin" /> Loading identity & evidence…
                                </div>
                            )}

                            {/* Evidence gallery */}
                            {detail.evidence?.length > 0 && (
                                <div className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] mb-2">
                                        Evidence ({detail.evidence.length})
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {detail.evidence.map((ev, i) => (
                                            ev.type === 'video' ? (
                                                <video key={i} src={ev.url} controls className="w-full h-24 object-cover rounded-lg bg-black" />
                                            ) : (
                                                <a key={i} href={ev.url} target="_blank" rel="noreferrer">
                                                    <img src={ev.url} alt={`evidence ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                                                </a>
                                            )
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Complainant identity (KYC) — admin-only review */}
                            {detail.complainant?.cnicData?.cnicNumber || detail.complainant?.cnicImage?.frontImage?.url ? (
                                <div className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] mb-2">Complainant Identity (KYC)</p>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mb-3">
                                        <p className="text-[var(--bv-text-dim)]">CNIC <span className="text-[var(--bv-text)] font-semibold">{detail.complainant?.cnicData?.cnicNumber || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Name <span className="text-[var(--bv-text)] font-semibold">{detail.complainant?.cnicData?.fullName || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Phone <span className="text-[var(--bv-text)] font-semibold">{detail.complainant?.phone || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Email <span className="text-[var(--bv-text)] font-semibold break-all">{detail.complainant?.email || '—'}</span></p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'CNIC Front', url: detail.complainant?.cnicImage?.frontImage?.url },
                                            { label: 'CNIC Back', url: detail.complainant?.cnicImage?.backImage?.url },
                                            { label: 'Selfie', url: detail.complainant?.selfieImage?.url },
                                        ].map(({ label, url }) => url ? (
                                            <a key={label} href={url} target="_blank" rel="noreferrer" className="block">
                                                <img src={url} alt={label} className="w-full h-20 object-cover rounded-lg" />
                                                <p className="text-[9px] text-[var(--bv-text-dim)] mt-1 text-center">{label}</p>
                                            </a>
                                        ) : null)}
                                    </div>
                                </div>
                            ) : null}

                            {/* Accused identity (KYC) — admin-only review */}
                            {detail.against?.cnicData?.cnicNumber || detail.against?.cnicImage?.frontImage?.url ? (
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-danger)]">Accused Identity (KYC)</p>
                                        {alreadyBlacklisted && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-danger)] flex items-center gap-1">
                                                <Ban size={10} /> Blacklisted
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mb-3">
                                        <p className="text-[var(--bv-text-dim)]">CNIC <span className="text-[var(--bv-text)] font-semibold">{detail.against?.cnicData?.cnicNumber || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Name <span className="text-[var(--bv-text)] font-semibold">{detail.against?.cnicData?.fullName || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Phone <span className="text-[var(--bv-text)] font-semibold">{detail.against?.phone || '—'}</span></p>
                                        <p className="text-[var(--bv-text-dim)]">Email <span className="text-[var(--bv-text)] font-semibold break-all">{detail.against?.email || '—'}</span></p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'CNIC Front', url: detail.against?.cnicImage?.frontImage?.url },
                                            { label: 'CNIC Back', url: detail.against?.cnicImage?.backImage?.url },
                                            { label: 'Selfie', url: detail.against?.selfieImage?.url },
                                        ].map(({ label, url }) => url ? (
                                            <a key={label} href={url} target="_blank" rel="noreferrer" className="block">
                                                <img src={url} alt={label} className="w-full h-20 object-cover rounded-lg" />
                                                <p className="text-[9px] text-[var(--bv-text-dim)] mt-1 text-center">{label}</p>
                                            </a>
                                        ) : null)}
                                    </div>
                                </div>
                            ) : null}

                            {/* Conversation thread */}
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                                    Conversation {detail.conversationThread?.length > 0 ? `(${detail.conversationThread.length})` : ''}
                                </p>
                                {(!detail.conversationThread || detail.conversationThread.length === 0) ? (
                                    <div className="py-5 text-center">
                                        <MessageSquare size={22} className="mx-auto mb-2 text-[var(--bv-text-dim)] opacity-20" />
                                        <p className="text-xs text-[var(--bv-text-dim)]">No messages yet in this thread.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 pt-1">
                                        {detail.conversationThread.map((msg, i) => {
                                            const isAdmin = msg.senderRole === 'Admin';
                                            const isGuest = msg.senderRole === 'Guest';
                                            const senderName = msg.senderId?.username || (
                                                isAdmin ? 'Admin'
                                                : isGuest ? (detail.complainant?.username || 'Guest')
                                                : (detail.against?.username || 'Host')
                                            );
                                            const roleBadgeClass = isAdmin
                                                ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                                                : isGuest
                                                ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                                                : 'text-blue-600 bg-blue-500/10 border-blue-500/20';
                                            const bubbleClass = isAdmin
                                                ? 'ml-auto rounded-tr-sm bg-emerald-500/5 border-emerald-500/15'
                                                : isGuest
                                                ? 'mr-auto rounded-tl-sm bg-amber-500/5 border-amber-500/15'
                                                : 'mr-auto rounded-tl-sm bg-blue-500/5 border-blue-500/15';
                                            return (
                                                <div key={i} className={`max-w-[82%] p-3 rounded-2xl border ${bubbleClass}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-[10px] font-bold text-[var(--bv-text-muted)]">{senderName}</p>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${roleBadgeClass}`}>
                                                            {msg.senderRole}
                                                        </span>
                                                        <p className="text-[9px] text-[var(--bv-text-dim)] ml-auto flex-shrink-0">{fmtDate(msg.createdAt)}</p>
                                                    </div>
                                                    <p className="text-xs text-[var(--bv-text-muted)] leading-relaxed">{msg.messageText}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Action panel */}
                            {detail.status !== 'resolved' && detail.status !== 'dismissed' && (
                                <div className="border-t border-[var(--bv-divider)] pt-4 space-y-3">
                                    <div>
                                        <label className="bv-label">Admin Response</label>
                                        <div className="relative">
                                            <textarea
                                                value={response}
                                                onChange={(e) => setResponse(e.target.value)}
                                                rows={3}
                                                placeholder="Write a message to both parties..."
                                                className="bv-input resize-none pr-14"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={!response.trim() || actionLoad}
                                                title="Send to both the complainant and the accused"
                                                className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-lg bg-[var(--bv-gold)] text-[var(--bv-text-inverse)] flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition"
                                            >
                                                {actionLoad ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                                            Sends your message to <span className="font-semibold">both</span> the complainant and the accused — they can read your reply in their complaint thread.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => handleAction(detail._id, 'reviewing')}
                                            disabled={actionLoad}
                                            className="bv-btn-outline text-xs py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Clock size={12} /> Reviewing
                                        </button>
                                        <button
                                            onClick={() => handleAction(detail._id, 'resolved')}
                                            disabled={actionLoad}
                                            className="bv-btn-gold text-xs py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <CheckCircle size={12} /> Resolve
                                        </button>
                                        <button
                                            onClick={() => handleAction(detail._id, 'dismissed')}
                                            disabled={actionLoad}
                                            className="text-xs py-2.5 rounded-xl font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <XCircle size={12} /> Dismiss
                                        </button>
                                    </div>

                                    {/* Enforcement: targeted warning vs severe block + blacklist */}
                                    <div className="pt-1 space-y-2">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                                            Issue Warning To <span className="normal-case font-medium opacity-70">(regarding "{detail.subject}")</span>
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleAction(detail._id, 'resolved', 'warning', 'complainant')}
                                                disabled={actionLoad}
                                                className="text-xs py-2.5 rounded-xl font-bold border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                <AlertCircle size={12} /> Warn {detail.complainant?.username || 'Complainant'}
                                                <span className="opacity-60 capitalize">({detail.complainant?.role || 'guest'})</span>
                                            </button>
                                            <button
                                                onClick={() => handleAction(detail._id, 'resolved', 'warning', 'against')}
                                                disabled={actionLoad}
                                                className="text-xs py-2.5 rounded-xl font-bold border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                <AlertCircle size={12} /> Warn {detail.against?.username || 'Accused'}
                                                <span className="opacity-60 capitalize">({detail.against?.role || 'host'})</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleAction(detail._id, 'resolved', 'warn_both')}
                                            disabled={actionLoad}
                                            className="w-full text-xs py-2.5 rounded-xl font-bold border border-blue-500/30 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <AlertCircle size={12} /> Issue Mutual Warning (Warn Both Parties)
                                        </button>
                                        <button
                                            onClick={() => handleAction(detail._id, 'resolved', 'blocked')}
                                            disabled={actionLoad || alreadyBlacklisted}
                                            className="w-full text-xs py-2.5 rounded-xl font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Ban size={12} /> {alreadyBlacklisted ? 'Accused Already Blacklisted' : `Block & Blacklist ${detail.against?.username || 'Accused'}`}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-[var(--bv-text-dim)] leading-relaxed">
                                        A <span className="font-semibold">warning</span> goes only to the party you pick and cites this complaint as the reason. Use <span className="font-semibold">Block &amp; Blacklist</span> only for theft or property damage — it permanently bans the accused's CNIC, email, and phone.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page header ── */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--bv-gold-border)] bg-[var(--bv-bg-raised)] p-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--bv-gold)] mb-2">Platform Moderation</p>
                        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">Complaints Management</h1>
                        <p className="text-sm text-[var(--bv-text-dim)] mt-1">{complaints.length} total complaints on the platform</p>
                    </div>
                    <button
                        onClick={loadComplaints}
                        disabled={loading}
                        className="bv-btn-outline text-sm px-4 py-2.5 flex items-center gap-2 self-start sm:self-auto"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </section>

            {/* ── Stat tiles ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Open',      value: stats.open,      icon: AlertCircle,  color: 'text-amber-500',   bg: 'bg-amber-500/10' },
                    { label: 'Reviewing', value: stats.reviewing, icon: Clock,         color: 'text-[var(--bv-gold)]', bg: 'bg-[var(--bv-gold-glow)]' },
                    { label: 'Resolved',  value: stats.resolved,  icon: CheckCircle,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Dismissed', value: stats.dismissed, icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-500/10' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bv-card p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">{label}</p>
                            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                                <Icon size={13} className={color} />
                            </div>
                        </div>
                        <p className={`text-3xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Filters + search ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-wrap">
                    {['all', 'open', 'reviewing', 'resolved', 'dismissed'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                                filter === f
                                    ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                                    : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)] hover:bg-[var(--bv-bg-raised)]'
                            }`}
                        >
                            {f} {f !== 'all' && stats[f] !== undefined ? `(${stats[f]})` : ''}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bv-text-dim)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by subject, user, or description..."
                        className="bv-input pl-9 text-sm"
                    />
                </div>
            </div>

            {/* ── Complaint list ── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-24 rounded-2xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bv-card-static py-16 text-center">
                    <MessageSquare size={40} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-20" />
                    <p className="font-bold text-[var(--bv-text)]">No complaints found</p>
                    <p className="text-xs text-[var(--bv-text-dim)] mt-1">Try adjusting your filters</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((c) => (
                        <div key={c._id} className="bv-card p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <Badge s={c.status} />
                                        <span className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-wider">
                                            {c.category?.replace('_', ' ')}
                                        </span>
                                        {(c.conversationThread?.length > 0) && (
                                            <span className="text-[10px] text-[var(--bv-gold)] flex items-center gap-0.5">
                                                <MessageSquare size={9} /> {c.conversationThread.length}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-bold text-[var(--bv-text)] mb-1">{c.subject || 'Complaint'}</p>
                                    <p className="text-xs text-[var(--bv-text-dim)]">
                                        <span className="font-semibold text-[var(--bv-text-muted)]">{c.complainant?.username || '—'}</span>
                                        <span className="mx-1.5 opacity-40">→</span>
                                        <span className="font-semibold text-[var(--bv-danger)]">{c.against?.username || '—'}</span>
                                        <span className="mx-1.5 opacity-40">·</span>
                                        {fmtDate(c.createdAt)}
                                    </p>
                                    {c.description && (
                                        <p className="text-xs text-[var(--bv-text-dim)] mt-1.5 line-clamp-1">{c.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 self-start mt-2 sm:mt-0">
                                    <button
                                        onClick={() => openDetail(c)}
                                        className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
                                    >
                                        <Eye size={12} /> Review
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(c._id)}
                                        className="bv-btn-outline text-xs px-3 py-2 text-red-500 border-red-500/20 hover:bg-red-500/10 flex items-center gap-1.5"
                                        title="Delete Complaint"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ComplaintManagement
