/**
 * HostManagement.jsx
 *
 * Admin page for managing platform hosts. Fetches all host-role users and
 * allows the admin to:
 *  - Search by name or email
 *  - Filter by KYC verification status (verified / pending / rejected)
 *  - View full host details (including CNIC documents) in a modal
 *  - Approve or reject a pending host's KYC verification from the detail modal
 *  - Block or unblock a host account
 */

import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import {
    Building2, Search, RefreshCw, ShieldBan, ShieldCheck,
    Eye, CheckCircle, XCircle, X, AlertCircle,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

/**
 * Small badge that maps a KYC verification status string to a colour variant.
 * Falls back to a gold badge for unrecognised status values.
 */
const VBadge = ({ s }) => {
    const colorMap = {
        verified: 'bv-badge-green',
        pending:  'bv-badge-amber',
        rejected: 'bv-badge-red',
    }
    return (
        <span className={`bv-badge ${colorMap[s] || 'bv-badge-gold'} capitalize`}>
            {s || 'Unknown'}
        </span>
    )
}

const HostManagement = () => {
    /** @type {[Array, Function]} Full list of hosts returned by the API */
    const [hosts, setHosts] = useState([])

    /** @type {[boolean, Function]} Whether the initial fetch or a refresh is in progress */
    const [loading, setLoading] = useState(true)

    /** @type {[string, Function]} Free-text search query (name or email) */
    const [search, setSearch] = useState('')

    /** @type {[string, Function]} Active KYC status filter: 'all' | 'verified' | 'pending' | 'rejected' */
    const [statusFilter, setStatusFilter] = useState('all')

    /** @type {[string|null, Function]} ID of the host whose block/verify action is in-flight */
    const [actionLoad, setActionLoad] = useState(null)

    /** @type {[object|null, Function]} Host object shown in the detail modal, or null */
    const [detail, setDetail] = useState(null)

    /** @type {[string, Function]} Admin-provided rejection reason */
    const [rejectionReason, setRejectionReason] = useState('')

    /** @type {[boolean, Function]} Whether the rejection reason input is visible */
    const [rejectMode, setRejectMode] = useState(false)

    /** @type {[string|null, Function]} Page-level error message */
    const [pageError, setPageError] = useState(null)

    const fetchHosts = async () => {
        try {
            setLoading(true)
            const r = await axios.get(`${BASE}/user/admin/all-hosts`, getAuthConfig())
            setHosts(r.data.hosts || [])
        } catch {
            setPageError('Failed to load hosts. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(
        () => {
            fetchHosts()
        },
        []
    )

    // Apply status filter and search query to the full host list
    const filtered = hosts.filter((h) => {
        if (statusFilter !== 'all' && h.isVerified !== statusFilter) {
            return false
        }
        if (
            search.trim() &&
            !h.username?.toLowerCase().includes(search.toLowerCase()) &&
            !h.email?.toLowerCase().includes(search.toLowerCase())
        ) {
            return false
        }
        return true
    })

    // Block or unblock a host by ID; updates local state optimistically on success
    const handleBlock = async (id, block) => {
        try {
            setActionLoad(id)
            await axios.patch(
                `${BASE}/user/admin/${block ? 'block' : 'unblock'}/${id}`,
                {},
                getAuthConfig()
            )
            // Update the isBlocked flag in local state without a full refetch
            setHosts((prev) =>
                prev.map((h) => (h._id === id ? { ...h, isBlocked: block } : h))
            )
            // Keep detail modal in sync if it's showing this host
            setDetail((prev) => prev && prev._id === id ? { ...prev, isBlocked: block } : prev)
        } catch (e) {
            setPageError(e.response?.data?.message || 'Failed to update host status')
        } finally {
            setActionLoad(null)
        }
    }

    // Update a host's KYC verification status (verified / rejected) with an optional reason
    const handleVerify = async (id, status, reason = '') => {
        try {
            setActionLoad(id)
            await axios.patch(
                `${BASE}/user/admin/verify-host/${id}`,
                { status, rejectedReason: reason },
                getAuthConfig()
            )
            // Update local state so the badge reflects the new status immediately
            setHosts((prev) =>
                prev.map((h) => (h._id === id ? { ...h, isVerified: status } : h))
            )
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
            {/* Host detail modal */}
            {detail && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bv-card-static p-6 bv-animate-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-[var(--bv-text)]">Host Details</h3>
                            <button
                                onClick={() => { setDetail(null); setRejectMode(false); setRejectionReason('') }}
                                className="p-2 hover:bg-[var(--bv-surface)] rounded-xl"
                            >
                                <X size={16} className="text-[var(--bv-text-dim)]" />
                            </button>
                        </div>

                        {/* Avatar and identity */}
                        <div className="flex items-center gap-4 mb-5">
                            {detail.profileImage?.url ? (
                                <img
                                    src={detail.profileImage.url}
                                    alt=""
                                    className="w-16 h-16 rounded-2xl object-cover border border-[var(--bv-border)] flex-shrink-0"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xl flex-shrink-0">
                                    {detail.username?.charAt(0)?.toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h4 className="font-bold text-[var(--bv-text)]">{detail.username}</h4>
                                <p className="text-xs text-[var(--bv-text-dim)]">{detail.email}</p>
                                <div className="flex gap-1.5 mt-1">
                                    <VBadge s={detail.isVerified} />
                                    {detail.isBlocked && (
                                        <span className="bv-badge bv-badge-red">Blocked</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detail field rows */}
                        <div className="space-y-2 text-sm">
                            {[
                                ['Phone',        detail.phone],
                                ['Address',      detail.address || detail.cnicData?.address],
                                ['Trust Score',  detail.trustScore != null ? `${detail.trustScore}/100` : '—'],
                                ['CNIC',         detail.cnicData?.cnicNumber || '—'],
                                ['Father Name',  detail.cnicData?.fatherName || '—'],
                                ['Joined',       detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '—'],
                            ].map(([l, v]) => (
                                <div
                                    key={l}
                                    className="flex justify-between py-2 border-b border-[var(--bv-divider)] last:border-0"
                                >
                                    <span className="text-[var(--bv-text-dim)]">{l}</span>
                                    <span className="text-[var(--bv-text)] font-semibold">
                                        {v || '—'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* CNIC document thumbnails */}
                        {detail.cnicImage?.frontImage?.url && (
                            <div className="mt-4">
                                <p className="bv-label mb-2">Documents</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        detail.cnicImage?.frontImage?.url,
                                        detail.cnicImage?.backImage?.url,
                                        detail.selfieImage?.url,
                                    ]
                                        .filter(Boolean)
                                        .map((src, i) => (
                                            <img
                                                key={i}
                                                src={src}
                                                alt=""
                                                className="w-full h-20 object-cover rounded-lg border border-[var(--bv-border)]"
                                            />
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Approve / Reject actions — only shown for pending hosts */}
                        {detail.isVerified === 'pending' && (
                            <div className="mt-5 space-y-3">
                                {rejectMode ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-wide">
                                            Rejection Reason *
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Explain why the documents are rejected..."
                                            rows={3}
                                            className="w-full bv-input text-sm resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    if (!rejectionReason.trim()) {
                                                        setPageError('Please provide a rejection reason before rejecting.')
                                                        return
                                                    }
                                                    handleVerify(detail._id, 'rejected', rejectionReason.trim())
                                                    setDetail(null)
                                                    setRejectMode(false)
                                                    setRejectionReason('')
                                                }}
                                                className="flex-1 py-2.5 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={14} /> Confirm Rejection
                                            </button>
                                            <button
                                                onClick={() => { setRejectMode(false); setRejectionReason('') }}
                                                className="px-4 py-2.5 bv-btn-outline text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                handleVerify(detail._id, 'verified')
                                                setDetail(null)
                                            }}
                                            className="flex-1 bv-btn-gold text-sm py-2.5 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={14} /> Approve
                                        </button>
                                        <button
                                            onClick={() => setRejectMode(true)}
                                            className="flex-1 py-2.5 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={14} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
                        <Building2 size={26} className="text-[var(--bv-gold)]" />
                        Host Management
                    </h1>
                    <p className="text-[var(--bv-text-dim)] text-sm mt-1">
                        {filtered.length} hosts found
                    </p>
                </div>
                <button
                    onClick={fetchHosts}
                    disabled={loading}
                    className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Search and status-filter controls */}
            <div className="bv-card-static p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-3 bv-input">
                    <Search size={15} className="text-[var(--bv-text-dim)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search hosts..."
                        className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bv-input sm:w-40"
                >
                    <option value="all">All Status</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            {/* Host list — skeleton or host rows */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bv-skeleton h-16 rounded-xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bv-card-static py-16 text-center">
                    <Building2 size={48} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-20" />
                    <p className="text-[var(--bv-text-muted)] font-bold">No hosts found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((h) => (
                        <div
                            key={h._id}
                            className="bv-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                            {/* Avatar and name/email */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs flex-shrink-0">
                                    {h.username?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                                        {h.username}
                                    </p>
                                    <p className="text-xs text-[var(--bv-text-dim)] truncate">
                                        {h.email}
                                    </p>
                                </div>
                            </div>

                            {/* Verification and blocked badges */}
                            <div className="flex items-center gap-2">
                                <VBadge s={h.isVerified} />
                                {h.isBlocked && (
                                    <span className="bv-badge bv-badge-red">Blocked</span>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={() => setDetail(h)}
                                    className="bv-btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                                >
                                    <Eye size={12} /> View
                                </button>

                                <button
                                    onClick={() => handleBlock(h._id, !h.isBlocked)}
                                    disabled={actionLoad === h._id}
                                    className={`text-xs px-3 py-1.5 rounded-[var(--bv-radius-sm)] font-semibold flex items-center gap-1 transition disabled:opacity-50 ${
                                        h.isBlocked
                                            ? 'bg-emerald-500/10 text-[var(--bv-success)] border border-emerald-500/20'
                                            : 'bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20'
                                    }`}
                                >
                                    {h.isBlocked ? (
                                        <>
                                            <ShieldCheck size={12} /> Unblock
                                        </>
                                    ) : (
                                        <>
                                            <ShieldBan size={12} /> Block
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default HostManagement
