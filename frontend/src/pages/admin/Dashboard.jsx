/**
 * Dashboard.jsx
 *
 * The main landing page of the admin panel. Shows a grid of platform-wide
 * summary stat cards (users, hosts, bookings, revenue, KYC, complaints),
 * a recent-users list, a pending-verifications list, and quick-action
 * navigation buttons. All data is fetched in parallel from the admin API.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getAuthConfig } from '../../utils/authConfig'
import {
    Users, Building2, Calendar, DollarSign,
    ShieldCheck, AlertCircle, TrendingUp, ArrowUpRight, RefreshCw, X,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// Admin routes live behind a secret, configurable path prefix (see App.jsx) —
// never hardcode '/admin/...' literally, it doesn't match any registered route.
const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6'

/**
 * Reusable stat card used in the summary grid.
 * Accepts an icon component, title, numeric/string value, hint subtitle,
 * and an optional positive-trend label.
 */
const StatCard = ({ icon: I, title, value, hint, trend }) => (
    <div className="bv-card p-5 flex flex-col h-40 justify-between group cursor-default">
        <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)]">
                <I size={18} className="text-[var(--bv-gold)]" />
            </div>
            {trend && (
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--bv-success)]">
                    <ArrowUpRight size={12} />
                    {trend}
                </span>
            )}
        </div>
        <div>
            <p className="bv-label">{title}</p>
            <h3 className="text-2xl font-black text-[var(--bv-text)] mt-1">{value}</h3>
            {hint && <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">{hint}</p>}
        </div>
    </div>
)

const Dashboard = () => {
    const nav = useNavigate()

    /** @type {[object|null, Function]} Platform stats returned by /admin/stats */
    const [stats, setStats] = useState(null)

    /** @type {[boolean, Function]} Whether data fetches are in progress */
    const [loading, setLoading] = useState(true)

    /** @type {[string|null, Function]} Page-level error message */
    const [pageError, setPageError] = useState(null)

    /** @type {[Array, Function]} Most recently registered users (up to 5) */
    const [recentUsers, setRecentUsers] = useState([])

    /** @type {[Array, Function]} Hosts with pending KYC verification (up to 5) */
    const [pendingHosts, setPendingHosts] = useState([])

    // Fetch stats, recent users, and pending hosts all in parallel
    const fetchAll = async () => {
        try {
            setLoading(true)

            const [s, u, h] = await Promise.all([
                axios
                    .get(`${BASE}/user/admin/stats`, getAuthConfig())
                    .catch(() => ({ data: {} })),
                axios
                    .get(`${BASE}/user/admin/recent-users?limit=5`, getAuthConfig())
                    .catch(() => ({ data: { users: [] } })),
                axios
                    .get(`${BASE}/user/admin/pending-hosts?limit=5`, getAuthConfig())
                    .catch(() => ({ data: { hosts: [] } })),
            ])

            setStats(
                s.data.stats || {
                    totalUsers: 0,
                    totalHosts: 0,
                    totalBookings: 0,
                    totalRevenue: 0,
                    pendingVerifications: 0,
                    openComplaints: 0,
                }
            )
            setRecentUsers(u.data.users || [])
            setPendingHosts(h.data.hosts || [])
        } catch {
            setPageError('Failed to load dashboard data. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Fetch all dashboard data on mount.
     * Empty dependency array ensures this runs once after the initial render.
     */
    useEffect(
        () => {
            // Load all dashboard data in one parallel batch
            fetchAll()
        },
        [] // Run once on mount
    )

    // Build stat card configuration array only when stats are available
    const cards = stats
        ? [
            { icon: Users,       title: 'Total Users',        value: stats.totalUsers,                                        hint: 'Guests & hosts', trend: '+12%' },
            { icon: Building2,   title: 'Total Hosts',        value: stats.totalHosts,                                        hint: 'Active hosts' },
            { icon: Calendar,    title: 'Bookings',           value: stats.totalBookings,                                     hint: 'All time', trend: '+8%' },
            { icon: DollarSign,  title: 'Gross Revenue',      value: `PKR ${(stats.totalRevenue || 0).toLocaleString()}`,     hint: 'Total paid (after refunds)' },
            { icon: TrendingUp,  title: 'Platform Commission',value: `PKR ${(stats.totalCommission || 0).toLocaleString()}`,  hint: '10% of gross revenue' },
            { icon: ShieldCheck, title: 'Pending KYC',        value: stats.pendingVerifications,                              hint: 'Awaiting review' },
            { icon: AlertCircle, title: 'Complaints',         value: stats.openComplaints,                                    hint: 'Open cases' },
        ]
        : []

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
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
                        Admin <span className="text-[var(--bv-gold)]">Dashboard</span>
                    </h1>
                    <p className="text-[var(--bv-text-dim)] text-sm mt-1">
                        Platform overview &amp; management
                    </p>
                </div>
                <button
                    onClick={fetchAll}
                    disabled={loading}
                    className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stat cards grid — skeleton placeholders while loading */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading
                    ? [1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className="bv-skeleton h-40 rounded-2xl" />
                    ))
                    : cards.map((c) => <StatCard key={c.title} {...c} />)
                }
            </div>

            {/* Two-column lists: recent users + pending verifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent users panel */}
                <div className="bv-card-static">
                    <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
                        <h2 className="text-base font-bold text-[var(--bv-text)]">Recent Users</h2>
                        <button
                            onClick={() => nav(`/${P}/management/users`)}
                            className="text-xs text-[var(--bv-gold)] font-semibold"
                        >
                            View All →
                        </button>
                    </div>
                    <div className="p-5 space-y-3">
                        {loading ? (
                            [1, 2, 3].map((i) => (
                                <div key={i} className="bv-skeleton h-14 rounded-xl" />
                            ))
                        ) : recentUsers.length === 0 ? (
                            <p className="text-center py-8 text-[var(--bv-text-dim)] text-sm">
                                No users yet
                            </p>
                        ) : (
                            recentUsers.map((u) => (
                                <div
                                    key={u._id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] transition"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs flex-shrink-0">
                                        {u.username?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                                            {u.username}
                                        </p>
                                        <p className="text-xs text-[var(--bv-text-dim)] truncate">
                                            {u.email}
                                        </p>
                                    </div>
                                    <span className={`bv-badge ${u.role === 'host' ? 'bv-badge-gold' : 'bv-badge-green'} capitalize`}>
                                        {u.role}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pending host verifications panel */}
                <div className="bv-card-static">
                    <div className="flex items-center justify-between p-5 border-b border-[var(--bv-divider)]">
                        <h2 className="text-base font-bold text-[var(--bv-text)]">
                            Pending Verifications
                        </h2>
                        <button
                            onClick={() => nav(`/${P}/host-verification`)}
                            className="text-xs text-[var(--bv-gold)] font-semibold"
                        >
                            View All →
                        </button>
                    </div>
                    <div className="p-5 space-y-3">
                        {loading ? (
                            [1, 2, 3].map((i) => (
                                <div key={i} className="bv-skeleton h-14 rounded-xl" />
                            ))
                        ) : pendingHosts.length === 0 ? (
                            <p className="text-center py-8 text-[var(--bv-text-dim)] text-sm">
                                No pending verifications
                            </p>
                        ) : (
                            pendingHosts.map((h) => (
                                <div
                                    key={h._id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] transition"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[var(--bv-surface)] flex items-center justify-center">
                                        <ShieldCheck size={16} className="text-[var(--bv-warning)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                                            {h.username}
                                        </p>
                                        <p className="text-xs text-[var(--bv-text-dim)]">{h.email}</p>
                                    </div>
                                    <span className="bv-badge bv-badge-amber">Pending</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick navigation action buttons */}
            <div className="bv-card-static p-5">
                <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
                    Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { l: 'Manage Users',    to: `/${P}/management/users`,  i: Users },
                        { l: 'Verify Hosts',    to: `/${P}/host-verification`, i: ShieldCheck },
                        { l: 'View Complaints', to: `/${P}/complaints`,        i: AlertCircle },
                        { l: 'Analytics',       to: `/${P}/analytics`,         i: TrendingUp },
                    ].map(({ l, to, i: I }) => (
                        <button
                            key={l}
                            onClick={() => nav(to)}
                            className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] hover:bg-[var(--bv-gold-glow)] transition text-left group"
                        >
                            <I
                                size={20}
                                className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition mb-2"
                            />
                            <p className="text-sm font-semibold text-[var(--bv-text)]">{l}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
