/**
 * Wishlist.jsx - Saved Properties Page
 *
 * Displays a list of properties that the authenticated user has marked as favorites.
 */

import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Heart, MapPin, Star, ArrowRight, Loader2, ArrowLeft, RefreshCw } from 'lucide-react'
import { getAuthConfig } from '../utils/authConfig'

// ==========================================
// Constants & Configuration
// ==========================================

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// ==========================================
// Wishlist Component
// ==========================================

/**
 * Wishlist - Renders the user's favorite properties.
 * @returns {JSX.Element}
 */
const Wishlist = () => {
    const nav = useNavigate()

    /**
     * Selector: Retrieve authentication status from Redux.
     */
    const { isLogin, authReady } = useSelector((state) => {
        return state.auth
    })

    // --- State ---
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [removing, setRemoving] = useState(null)

    // --- Handlers ---

    /**
     * fetchWishlist - Retrieves the user's wishlist from the backend.
     */
    const fetchWishlist = () => {
        if (!authReady) {
            return
        }
        if (!isLogin) {
            setItems([])
            setLoading(false)
            return
        }

        setLoading(true)
        axios.get(`${BASE}/wishlist/my`, getAuthConfig())
            .then((r) => {
                return setItems(r.data.wishlist || [])
            })
            .catch(() => {})
            .finally(() => {
                return setLoading(false)
            })
    }

    /**
     * remove - Toggles a property off the user's wishlist.
     * @param {string} id - Property ID.
     */
    const remove = async (id) => {
        setRemoving(id)
        try {
            await axios.post(`${BASE}/wishlist/toggle`, { propertyId: id }, getAuthConfig())
            setItems((prev) => {
                return prev.filter((i) => {
                    return i._id !== id
                })
            })
        } catch {
            // error silently handled
        } finally {
            setRemoving(null)
        }
    }

    // --- Effects ---

    /**
     * Effect: Fetch wishlist when authentication state is determined.
     */
    useEffect(
        () => {
            // Setup
            fetchWishlist()

            // Cleanup
            return () => {
                // No cleanup needed
            }
        },
        // Dependencies
        [authReady, isLogin]
    )

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                {/* --- Navigation --- */}
                <button
                    onClick={() => {
                        return nav(-1)
                    }}
                    className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                {/* --- Header --- */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">Saved</p>
                        <h1 className="font-display text-3xl text-[var(--bv-text)] flex items-center gap-3">
                            <Heart size={26} className="text-red-400" /> Wishlist
                        </h1>
                        <p className="text-sm text-[var(--bv-text-muted)] mt-1">
                            {items.length} saved propert{items.length !== 1 ? 'ies' : 'y'}
                        </p>
                    </div>
                    <button
                        onClick={fetchWishlist}
                        disabled={loading}
                        className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* --- Content Grid --- */}
                {
                    loading ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {
                                [1, 2, 3].map((i) => {
                                    return (
                                        <div key={i} className="bv-skeleton h-[300px] rounded-2xl" />
                                    )
                                })
                            }
                        </div>
                    ) : items.length === 0 ? (
                        <div className="bv-card-static py-20 text-center">
                            <Heart size={48} className="mx-auto mb-3 text-[var(--bv-text-dim)] opacity-20" />
                            <p className="font-bold text-[var(--bv-text)]">No saved properties</p>
                            <p className="text-sm text-[var(--bv-text-dim)] mt-1 mb-5">Heart a property to save it here</p>
                            <button
                                onClick={() => {
                                    return nav('/view-all-properties')
                                }}
                                className="bv-btn-gold text-sm px-6 py-2.5"
                            >
                                Explore Properties
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {
                                items.map((p) => {
                                    return (
                                        <div key={p._id} className="bv-card group overflow-hidden">
                                            <div className="relative h-48 overflow-hidden">
                                                <img
                                                    src={p.images?.[0]?.url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'}
                                                    alt={p.name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                    loading="lazy"
                                                />
                                                <button
                                                    onClick={() => {
                                                        return remove(p._id)
                                                    }}
                                                    disabled={removing === p._id}
                                                    className="absolute top-3 right-3 p-2 rounded-full bg-red-500/20 text-red-400 backdrop-blur-sm hover:bg-red-500/40 transition disabled:opacity-50"
                                                >
                                                    {
                                                        removing === p._id ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <Heart size={16} fill="currentColor" />
                                                        )
                                                    }
                                                </button>
                                                <div className="absolute top-3 left-3 bv-badge bv-badge-gold">{p.type}</div>
                                                {
                                                    p.rating > 0 && (
                                                        <div className="absolute bottom-3 right-3 flex items-center gap-1 bv-badge bg-black/40 text-[var(--bv-gold)] border-transparent backdrop-blur-sm">
                                                            <Star size={10} fill="currentColor" /> {p.rating}
                                                        </div>
                                                    )
                                                }
                                            </div>
                                            <div
                                                className="p-5 cursor-pointer"
                                                onClick={() => {
                                                    return nav(`/property/${p.type?.toLowerCase()}/${p._id}`)
                                                }}
                                            >
                                                <h3 className="font-bold text-[var(--bv-text)] truncate group-hover:text-[var(--bv-gold)] transition">{p.name}</h3>
                                                <p className="flex items-center gap-1.5 text-xs text-[var(--bv-text-dim)] mt-1">
                                                    <MapPin size={11} /> {p.city}
                                                </p>
                                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--bv-divider)]">
                                                    <div>
                                                        <span className="text-lg font-bold text-[var(--bv-gold)]">PKR {p.price?.toLocaleString()}</span>
                                                        <span className="text-xs text-[var(--bv-text-dim)] ml-1">/ night</span>
                                                    </div>
                                                    <ArrowRight size={16} className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                }
            </div>
        </div>
    )
}

export default Wishlist
