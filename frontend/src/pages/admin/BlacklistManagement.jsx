/**
 * @file BlacklistManagement.jsx
 * @description Admin page for managing the permanent ban list. A blacklisted CNIC,
 * email, or phone can never register on BookVibe again. Admins can add entries
 * manually or remove them to lift a ban.
 */

import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import { Ban, RefreshCw, Plus, Trash2, Loader2, ShieldOff, AlertCircle, X } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const fmtDate = (v) => {
    if (!v) return '—'
    return new Date(v).toLocaleDateString('en-PK', {
        day: 'numeric', month: 'short', year: 'numeric',
    })
}

const BlacklistManagement = () => {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [form, setForm] = useState({ cnicNumber: '', email: '', phone: '', reason: '' })
    const [pageError, setPageError] = useState(null)
    const [formError, setFormError] = useState(null)

    const load = async () => {
        try {
            setLoading(true)
            const r = await axios.get(`${BASE}/user/admin/blacklist`, getAuthConfig())
            setEntries(r.data.entries || [])
            setPageError(null)
        } catch {
            setPageError('Failed to load blacklist. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const handleAdd = async (e) => {
        e.preventDefault()
        if (!form.cnicNumber.trim() && !form.email.trim() && !form.phone.trim()) {
            setFormError('Enter at least a CNIC, email, or phone number.')
            return
        }
        setFormError(null)
        try {
            setAdding(true)
            await axios.post(`${BASE}/user/admin/blacklist`, form, getAuthConfig())
            setForm({ cnicNumber: '', email: '', phone: '', reason: '' })
            load()
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to add to blacklist. Please try again.')
        } finally {
            setAdding(false)
        }
    }

    const handleRemove = async (id) => {
        if (!window.confirm('Remove this entry? The banned person will be able to register again.')) return
        try {
            await axios.delete(`${BASE}/user/admin/blacklist/${id}`, getAuthConfig())
            setEntries((prev) => prev.filter((e) => e._id !== id))
        } catch (err) {
            setPageError(err.response?.data?.message || 'Failed to lift ban. Please try again.')
        }
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

            {/* Header */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--bv-gold-border)] bg-[var(--bv-bg-raised)] p-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--bv-danger)] mb-2">Permanent Bans</p>
                        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
                            <Ban size={24} className="text-[var(--bv-danger)]" /> Blacklist
                        </h1>
                        <p className="text-sm text-[var(--bv-text-dim)] mt-1">
                            {entries.length} banned {entries.length === 1 ? 'identity' : 'identities'} — these CNIC / email / phone cannot register.
                        </p>
                    </div>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="bv-btn-outline text-sm px-4 py-2.5 flex items-center gap-2 self-start sm:self-auto"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </section>

            {/* Manual add form */}
            <form onSubmit={handleAdd} className="bv-card-static p-5 space-y-4">
                <p className="text-sm font-bold text-[var(--bv-text)] flex items-center gap-2">
                    <Plus size={15} className="text-[var(--bv-gold)]" /> Manually Blacklist an Identity
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                        <label className="bv-label">CNIC Number</label>
                        <input
                            value={form.cnicNumber}
                            onChange={(e) => { setForm({ ...form, cnicNumber: e.target.value }); setFormError(null) }}
                            placeholder="42101-1234567-8"
                            className="bv-input"
                        />
                    </div>
                    <div>
                        <label className="bv-label">Email</label>
                        <input
                            value={form.email}
                            onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormError(null) }}
                            placeholder="user@example.com"
                            className="bv-input"
                        />
                    </div>
                    <div>
                        <label className="bv-label">Phone</label>
                        <input
                            value={form.phone}
                            onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFormError(null) }}
                            placeholder="+923001234567"
                            className="bv-input"
                        />
                    </div>
                </div>
                <div>
                    <label className="bv-label">Reason</label>
                    <input
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="Why is this identity being banned?"
                        className="bv-input"
                        maxLength={1000}
                    />
                </div>
                {formError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/15">
                        <AlertCircle size={13} className="text-[var(--bv-danger)] flex-shrink-0" />
                        <p className="text-xs text-[var(--bv-danger)]">{formError}</p>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={adding}
                    className="text-xs py-2.5 px-4 rounded-xl font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                    {adding ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Add to Blacklist
                </button>
            </form>

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-20 rounded-2xl" />)}
                </div>
            ) : entries.length === 0 ? (
                <div className="bv-card-static py-16 text-center">
                    <ShieldOff size={40} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-20" />
                    <p className="font-bold text-[var(--bv-text)]">No banned identities</p>
                    <p className="text-xs text-[var(--bv-text-dim)] mt-1">Blacklisted users from complaints will appear here</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map((e) => (
                        <div key={e._id} className="bv-card p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    {e.cnicNumber && <span className="text-[var(--bv-text-dim)]">CNIC <span className="font-semibold text-[var(--bv-text)]">{e.cnicNumber}</span></span>}
                                    {e.email && <span className="text-[var(--bv-text-dim)]">Email <span className="font-semibold text-[var(--bv-text)] break-all">{e.email}</span></span>}
                                    {e.phone && <span className="text-[var(--bv-text-dim)]">Phone <span className="font-semibold text-[var(--bv-text)]">{e.phone}</span></span>}
                                </div>
                                <p className="text-xs text-[var(--bv-text-muted)]">{e.reason}</p>
                                <p className="text-[10px] text-[var(--bv-text-dim)]">
                                    {e.user?.username ? `Account: ${e.user.username} · ` : ''}
                                    Banned {fmtDate(e.createdAt)}
                                    {e.blacklistedBy?.username ? ` by ${e.blacklistedBy.username}` : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => handleRemove(e._id)}
                                className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5 self-start"
                            >
                                <Trash2 size={12} /> Lift Ban
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default BlacklistManagement
