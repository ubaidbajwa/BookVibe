/**
 * MyAccomodations
 *
 * Lists all property listings owned by the authenticated host.
 * Each card shows a thumbnail, name, type badge, address, price, an
 * availability toggle, and view / delete actions.
 * A confirmation modal prevents accidental permanent deletion.
 */

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
    getHostProperties,
    deleteProperty,
    togglePropertyAvailability,
    resetAccommodationState,
} from '../../redux/slices/accommodationSlice'
import {
    MapPin,
    Trash2,
    Eye,
    Pencil,
    PlusCircle,
    Building2,
    RefreshCw,
    ImageOff,
    AlertTriangle,
    BedDouble,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Toggle sub-component
// ---------------------------------------------------------------------------

/**
 * Toggle — a pill-shaped on/off switch used to show or hide a property
 * from the public listing. Green when on, neutral when off.
 */
const Toggle = ({ on, fn, disabled }) => {
    return (
        <button
            onClick={fn}
            disabled={disabled}
            className={`w-12 h-7 rounded-full transition flex items-center px-0.5 disabled:opacity-50 ${
                on ? 'bg-[var(--bv-success)]' : 'bg-[var(--bv-surface)]'
            }`}
        >
            <div
                className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    on ? 'translate-x-5' : ''
                }`}
            />
        </button>
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MyAccomodations = () => {
    const dispatch = useDispatch()
    const nav = useNavigate()

    /** Property object staged for deletion, or null when the modal is closed. */
    const [del, setDel] = useState(null)

    /** ID of the property whose toggle is currently in-flight (null = none). */
    const [togglingId, setTogglingId] = useState(null)

    const { properties, loading, actionLoading, error, success, message } = useSelector(
        (s) => s.accommodations
    )

    /**
     * Fetch the host's property list on mount.
     * dispatch is stable — included to satisfy exhaustive-deps.
     */
    useEffect(
        () => {
            dispatch(getHostProperties())
        },
        [dispatch] // fetch once on component mount
    )

    /**
     * After a successful action (delete, toggle), show a success toast,
     * reset Redux success flags, and close the delete modal if it was open.
     */
    useEffect(
        () => {
            if (success && message) {
                dispatch(resetAccommodationState())
                setDel(null)
            }
        },
        [success, message, dispatch] // all three are needed to correctly respond
    )

    /**
     * Surface any async error as a toast, then clear it so the notification
     * does not repeat on the next render cycle.
     */
    useEffect(
        () => {
            if (error) {
                dispatch(resetAccommodationState())
            }
        },
        [error, dispatch] // error value triggers the toast; dispatch clears it
    )

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    /**
     * Toggle a property's availability without blocking every other toggle.
     * actionLoading from Redux is shared across all actions; we keep a local
     * "which ID is toggling" so only that card's button is disabled.
     */
    const handleToggle = async (id) => {
        setTogglingId(id)
        await dispatch(togglePropertyAvailability(id))
        setTogglingId(null)
    }

    /**
     * Verification status badge config for a property.
     */
    const verificationBadge = (status) => {
        switch (status) {
            case 'verified':
                return { label: 'Verified', cls: 'bv-badge-green' }
            case 'rejected':
                return { label: 'Rejected', cls: 'bv-badge-red' }
            default:
                return { label: 'Pending Review', cls: 'bv-badge-amber' }
        }
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className="space-y-8">
            {/* ── Delete confirmation modal ── */}
            {del && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => !actionLoading && setDel(null)}
                >
                    <div className="w-full max-w-md bv-card-static p-6 bv-animate-in" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-[var(--bv-danger)] flex items-center justify-center mb-4">
                            <AlertTriangle size={26} />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--bv-text)]">
                            Delete property?
                        </h3>
                        <p className="text-sm text-[var(--bv-text-muted)] mt-2">
                            This cannot be undone.{' '}
                            <span className="font-semibold text-[var(--bv-text)]">{del.name}</span>{' '}
                            will be removed.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setDel(null)}
                                disabled={actionLoading}
                                className="flex-1 bv-btn-outline py-3 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => dispatch(deleteProperty(del._id))}
                                disabled={actionLoading}
                                className="flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
                        <Building2 size={26} className="text-[var(--bv-gold)]" /> My Properties
                    </h1>
                    <p className="text-[var(--bv-text-dim)] text-sm mt-1">
                        {loading ? 'Loading...' : `${properties?.length || 0} listings`}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => dispatch(getHostProperties())}
                        disabled={loading}
                        className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => nav('/host/accommodations/add')}
                        className="bv-btn-gold text-sm px-4 py-2 flex items-center gap-2"
                    >
                        <PlusCircle size={14} /> Add New
                    </button>
                </div>
            </div>

            {/* ── Content area ── */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bv-skeleton h-36 rounded-2xl" />
                    ))}
                </div>
            ) : !properties?.length ? (
                /* Empty state */
                <div className="bv-card-static py-20 text-center">
                    <Building2 size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20" />
                    <h3 className="text-lg font-bold text-[var(--bv-text-muted)]">
                        No properties yet
                    </h3>
                    <p className="text-[var(--bv-text-dim)] text-sm mt-1 mb-6">
                        Start earning by adding your first listing
                    </p>
                    <button
                        onClick={() => nav('/host/accommodations/add')}
                        className="bv-btn-gold text-sm px-6 py-3 inline-flex items-center gap-2"
                    >
                        <PlusCircle size={16} /> Add Property
                    </button>
                </div>
            ) : (
                /* Property cards */
                <div className="space-y-6">
                    {properties.map((p) => {
                        const isMulti = ['Hotel', 'Hostel', 'Plaza'].includes(p.type);
                        
                        if (isMulti) {
                            return (
                                <div
                                    key={p._id}
                                    onClick={() => nav(`/host/accommodations/${p._id}`)}
                                    className="bv-card p-0 flex flex-col md:flex-row overflow-hidden group border-[var(--bv-border-gold)] bg-[var(--bv-gold-glow)] cursor-pointer"
                                >
                                    {/* Large Banner Thumbnail */}
                                    <div className="md:w-64 h-52 md:h-auto shrink-0 relative overflow-hidden">
                                        {p.images?.[0]?.url ? (
                                            <img
                                                src={p.images[0].url}
                                                alt=""
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[var(--bv-surface)] flex items-center justify-center">
                                                <ImageOff size={32} className="text-[var(--bv-text-dim)]" />
                                            </div>
                                        )}
                                        <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                                            <span className="bv-badge bv-badge-gold shadow-lg">{p.type} Establishment</span>
                                            <span className={`bv-badge ${verificationBadge(p.verificationStatus).cls} shadow-lg`}>
                                                {verificationBadge(p.verificationStatus).label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Banner Details */}
                                    <div className="flex-1 p-6 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-4">
                                                <h3 className="text-2xl font-black text-[var(--bv-text)] group-hover:text-[var(--bv-gold)] transition">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                                    <span className="text-xs font-bold text-[var(--bv-text-dim)]">
                                                        {p.available ? 'Public' : 'Hidden'}
                                                    </span>
                                                    <Toggle
                                                        on={p.available}
                                                        fn={() => handleToggle(p._id)}
                                                        disabled={togglingId === p._id}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center text-[var(--bv-text-dim)] text-sm mt-2">
                                                <MapPin size={14} className="mr-1.5 text-[var(--bv-gold)]" />
                                                {p.address}{p.city ? `, ${p.city}` : ''}
                                            </div>
                                            <p className="mt-3 text-xs text-[var(--bv-text-muted)] line-clamp-2 leading-relaxed">
                                                {p.description}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--bv-divider)]">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-tighter">Units</span>
                                                    <span className="text-xl font-black text-[var(--bv-gold)]">{p.subUnits?.length || 0}</span>
                                                </div>
                                                <div className="h-8 w-px bg-[var(--bv-divider)]" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-tighter">Avg Price</span>
                                                    <span className="text-xl font-black text-[var(--bv-gold)]">PKR {p.price?.toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => nav(`/host/accommodations/${p._id}`)}
                                                    className="bv-btn-gold text-xs px-5 py-2.5 flex items-center gap-2"
                                                >
                                                    <BedDouble size={14} /> Manage Rooms
                                                </button>
                                                <button
                                                    onClick={() => nav(`/host/accommodations/edit/${p._id}`)}
                                                    className="bv-btn-outline text-xs px-3 py-2.5"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setDel(p)}
                                                    className="bv-btn-outline text-xs px-3 py-2.5 text-rose-400 border-rose-500/20 hover:bg-rose-500/5"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={p._id}
                                className="bv-card p-4 flex flex-col md:flex-row gap-5 items-start md:items-center"
                            >
                                {/* Thumbnail */}
                                <div className="w-full md:w-44 h-36 md:h-28 flex-shrink-0 relative overflow-hidden rounded-xl bg-[var(--bv-surface)]">
                                    {p.images?.[0]?.url ? (
                                        <img
                                            src={p.images[0].url}
                                            alt=""
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center flex-col gap-1">
                                            <ImageOff size={24} className="text-[var(--bv-text-dim)]" />
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-[var(--bv-text)] truncate">
                                        {p.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="bv-badge bv-badge-gold capitalize">{p.type}</span>
                                        <span className={`bv-badge ${verificationBadge(p.verificationStatus).cls}`}>
                                            {verificationBadge(p.verificationStatus).label}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-[var(--bv-text-dim)] text-sm mt-2">
                                        <MapPin size={13} className="mr-1.5" />
                                        {p.address}{p.city ? `, ${p.city}` : ''}
                                    </div>
                                    <p className="text-lg font-bold text-[var(--bv-gold)] mt-1">
                                        PKR {p.price?.toLocaleString()}{' '}
                                        <span className="text-[var(--bv-text-dim)] text-xs font-normal">
                                            / night
                                        </span>
                                    </p>
                                </div>

                                {/* Availability toggle */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--bv-text-dim)]">
                                        {p.available ? 'Active' : 'Hidden'}
                                    </span>
                                    <Toggle
                                        on={p.available}
                                        fn={() => handleToggle(p._id)}
                                        disabled={togglingId === p._id}
                                    />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => nav(`/host/accommodations/${p._id}`)}
                                        className="bv-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
                                    >
                                        <Eye size={13} /> View
                                    </button>
                                    <button
                                        onClick={() => nav(`/host/accommodations/edit/${p._id}`)}
                                        className="bv-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
                                    >
                                        <Pencil size={13} /> Edit
                                    </button>
                                    <button
                                        onClick={() => setDel(p)}
                                        disabled={actionLoading}
                                        className="text-xs px-3 py-2 rounded-[var(--bv-radius-sm)] bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20 font-semibold flex items-center gap-1.5 hover:bg-red-500/20 transition disabled:opacity-50"
                                    >
                                        <Trash2 size={13} /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
}

export default MyAccomodations
