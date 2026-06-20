/**
 * UserManagement.jsx
 *
 * Admin page for managing platform users. Fetches all users (guests, hosts,
 * admins) and allows the admin to:
 *  - Search by name or email
 *  - Filter by role (guest / host / admin)
 *  - View full user details in a modal
 *  - Block or unblock a user
 *  - Permanently delete a non-admin user (with confirmation modal)
 */

import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import {
    Users, Search, RefreshCw, ShieldBan, ShieldCheck,
    Eye, Trash2, X, AlertTriangle, AlertCircle,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const UserManagement = () => {
    /** @type {[Array, Function]} Full list of users returned by the API */
    const [users, setUsers] = useState([])

    /** @type {[boolean, Function]} Whether the initial fetch or a refresh is in progress */
    const [loading, setLoading] = useState(true)

    /** @type {[string, Function]} Free-text search query (name or email) */
    const [search, setSearch] = useState('')

    /** @type {[string, Function]} Active role filter: 'all' | 'guest' | 'host' | 'admin' */
    const [roleFilter, setRoleFilter] = useState('all')

    /** @type {[string|null, Function]} ID of the user whose block/unblock is in-flight */
    const [actionLoad, setActionLoad] = useState(null)

    /** @type {[object|null, Function]} User object pending deletion confirmation, or null */
    const [delUser, setDelUser] = useState(null)

    /** @type {[object|null, Function]} User object shown in the detail modal, or null */
    const [detail, setDetail] = useState(null)

    /** @type {[string|null, Function]} Page-level error message */
    const [pageError, setPageError] = useState(null)

    // Fetch all users from the admin endpoint
    const fetch = async () => {
        try {
            setLoading(true)
            const r = await axios.get(`${BASE}/user/admin/all-users`, getAuthConfig())
            setUsers(r.data.users || [])
        } catch {
            setPageError('Failed to load users. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Load users on mount.
     * Empty dependency array ensures this runs once after the first render.
     */
    useEffect(
        () => {
            // Initial user list load
            fetch()
        },
        [] // Run once on mount
    )

    // Apply role filter and search query to the full user list
    const filtered = users.filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) {
            return false
        }
        if (
            search.trim() &&
            !u.username?.toLowerCase().includes(search.toLowerCase()) &&
            !u.email?.toLowerCase().includes(search.toLowerCase())
        ) {
            return false
        }
        return true
    })

    // Block or unblock a user by ID; updates local state optimistically on success
    const handleBlock = async (id, block) => {
        try {
            setActionLoad(id)
            await axios.patch(
                `${BASE}/user/admin/${block ? 'block' : 'unblock'}/${id}`,
                {},
                getAuthConfig()
            )
            // Update the isBlocked flag in local state without a full refetch
            setUsers((prev) =>
                prev.map((u) => (u._id === id ? { ...u, isBlocked: block } : u))
            )
            // Keep detail modal in sync if it's showing this user
            setDetail((prev) => prev && prev._id === id ? { ...prev, isBlocked: block } : prev)
        } catch (e) {
            setPageError(e.response?.data?.message || 'Failed to update user status')
        } finally {
            setActionLoad(null)
        }
    }

    // Permanently delete the user stored in delUser state
    const handleDelete = async () => {
        if (!delUser) {
            return
        }

        try {
            setActionLoad(delUser._id)
            await axios.delete(
                `${BASE}/user/admin/delete/${delUser._id}`,
                getAuthConfig()
            )
            // Remove from local state and close confirmation modal
            setUsers((prev) => prev.filter((u) => u._id !== delUser._id))
            setDelUser(null)
        } catch (e) {
            setPageError(e.response?.data?.message || 'Failed to delete user')
            setDelUser(null)
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
            {/* Delete confirmation modal */}
            {delUser && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bv-card-static p-6 bv-animate-in">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-[var(--bv-danger)] flex items-center justify-center mb-4">
                            <AlertTriangle size={26} />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--bv-text)]">Delete user?</h3>
                        <p className="text-sm text-[var(--bv-text-muted)] mt-2">
                            Remove{' '}
                            <span className="font-bold text-[var(--bv-text)]">{delUser.username}</span>{' '}
                            permanently.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setDelUser(null)}
                                className="flex-1 bv-btn-outline py-3 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={actionLoad === delUser._id}
                                className="flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User detail modal */}
            {detail && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bv-card-static p-6 bv-animate-in">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-[var(--bv-text)]">User Details</h3>
                            <button
                                onClick={() => setDetail(null)}
                                className="p-2 hover:bg-[var(--bv-surface)] rounded-xl transition"
                            >
                                <X size={16} className="text-[var(--bv-text-dim)]" />
                            </button>
                        </div>

                        {/* Avatar and basic identity */}
                        <div className="flex items-center gap-4 mb-5">
                            {detail.profileImage?.url ? (
                                <img
                                    src={detail.profileImage.url}
                                    alt=""
                                    className="w-16 h-16 rounded-2xl object-cover border border-[var(--bv-border)]"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xl">
                                    {detail.username?.charAt(0)?.toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h4 className="font-bold text-[var(--bv-text)]">{detail.username}</h4>
                                <p className="text-xs text-[var(--bv-text-dim)]">{detail.email}</p>
                                <div className="flex gap-1.5 mt-1">
                                    <span
                                        className={`bv-badge ${
                                            detail.role === 'host'
                                                ? 'bv-badge-gold'
                                                : detail.role === 'admin'
                                                ? 'bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20'
                                                : 'bv-badge-green'
                                        } capitalize`}
                                    >
                                        {detail.role}
                                    </span>
                                    {detail.isBlocked && (
                                        <span className="bv-badge bv-badge-red">Blocked</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detail field rows */}
                        <div className="space-y-2 text-sm">
                            {[
                                ['Phone',          detail.phone],
                                ['Address',        detail.address || detail.cnicData?.address],
                                ['DOB',            detail.dob],
                                ['Email Verified', detail.isEmailVerified ? 'Yes' : 'No'],
                                ['KYC Status',     detail.isVerified || '—'],
                                ['CNIC',           detail.cnicData?.cnicNumber || '—'],
                                ['Joined',         detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '—'],
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

                        {/* CNIC document thumbnails (only shown when available) */}
                        {detail.cnicImage?.frontImage?.url && (
                            <div className="mt-4">
                                <p className="bv-label mb-2">CNIC Documents</p>
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
                    </div>
                </div>
            )}

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
                        <Users size={26} className="text-[var(--bv-gold)]" />
                        User Management
                    </h1>
                    <p className="text-[var(--bv-text-dim)] text-sm mt-1">
                        {filtered.length} users found
                    </p>
                </div>
                <button
                    onClick={fetch}
                    disabled={loading}
                    className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Search and role-filter controls */}
            <div className="bv-card-static p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-3 bv-input">
                    <Search size={15} className="text-[var(--bv-text-dim)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bv-input sm:w-40"
                >
                    <option value="all">All Roles</option>
                    <option value="guest">Guests</option>
                    <option value="host">Hosts</option>
                    <option value="admin">Admins</option>
                </select>
            </div>

            {/* User list — skeleton, empty state, or user rows */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bv-skeleton h-16 rounded-xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bv-card-static py-16 text-center">
                    <Users size={48} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-20" />
                    <p className="text-[var(--bv-text-muted)] font-bold">No users found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((u) => (
                        <div
                            key={u._id}
                            className="bv-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                            {/* Avatar and name/email */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {u.profileImage?.url ? (
                                    <img
                                        src={u.profileImage.url}
                                        alt=""
                                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs flex-shrink-0">
                                        {u.username?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                                        {u.username}
                                    </p>
                                    <p className="text-xs text-[var(--bv-text-dim)] truncate">
                                        {u.email}
                                    </p>
                                </div>
                            </div>

                            {/* Role and status badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className={`bv-badge ${
                                        u.role === 'host'
                                            ? 'bv-badge-gold'
                                            : u.role === 'admin'
                                            ? 'bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20'
                                            : 'bv-badge-green'
                                    } capitalize`}
                                >
                                    {u.role}
                                </span>
                                {u.isBlocked && (
                                    <span className="bv-badge bv-badge-red">Blocked</span>
                                )}
                                {u.isEmailVerified && (
                                    <span className="bv-badge bv-badge-green">Verified</span>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={() => setDetail(u)}
                                    className="bv-btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                                >
                                    <Eye size={12} /> View
                                </button>

                                <button
                                    onClick={() => handleBlock(u._id, !u.isBlocked)}
                                    disabled={actionLoad === u._id}
                                    className={`text-xs px-3 py-1.5 rounded-[var(--bv-radius-sm)] font-semibold flex items-center gap-1 transition disabled:opacity-50 ${
                                        u.isBlocked
                                            ? 'bg-emerald-500/10 text-[var(--bv-success)] border border-emerald-500/20 hover:bg-emerald-500/20'
                                            : 'bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20 hover:bg-red-500/20'
                                    }`}
                                >
                                    {u.isBlocked ? (
                                        <>
                                            <ShieldCheck size={12} /> Unblock
                                        </>
                                    ) : (
                                        <>
                                            <ShieldBan size={12} /> Block
                                        </>
                                    )}
                                </button>

                                {/* Delete button is hidden for admin-role users */}
                                {u.role !== 'admin' && (
                                    <button
                                        onClick={() => setDelUser(u)}
                                        className="text-xs px-3 py-1.5 rounded-[var(--bv-radius-sm)] bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20 font-semibold flex items-center gap-1 hover:bg-red-500/20 transition"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default UserManagement
