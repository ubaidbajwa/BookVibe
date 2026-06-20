/**
 * ViewPropertyByCategory.jsx - Category-Based Property Browsing
 *
 * Filters and displays properties belonging to a specific type (e.g., House, Apartment, Room).
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { MapPin, ArrowRight } from 'lucide-react'
import { cloudinaryTransform } from '../utils/publicPagePerf'

// ==========================================
// Constants & Configuration
// ==========================================

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// ==========================================
// ViewPropertyByCategory Component
// ==========================================

/**
 * ViewPropertyByCategory - Renders a list of properties for a given category.
 * @returns {JSX.Element}
 */
const ViewPropertyByCategory = () => {
    const { category } = useParams()
    const nav = useNavigate()
    
    // --- State ---
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    
    const label = category ? category.charAt(0).toUpperCase() + category.slice(1) : ''

    // --- Effects ---

    /**
     * Effect: Fetch properties by category slug.
     */
    useEffect(
        () => {
            // Setup
            if (category) {
                axios.get(`${BASE}/property?type=${category}`)
                    .then((r) => {
                        return setItems(r.data.properties || [])
                    })
                    .catch(() => {
                        // Silently handle errors
                    })
                    .finally(() => {
                        return setLoading(false)
                    })
            }

            // Cleanup
            return () => {
                // No cleanup needed
            }
        },
        // Dependencies
        [category]
    )

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
                <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">Category</p>
                <h1 className="font-display text-3xl text-[var(--bv-text)] mb-2">{label} Properties</h1>
                <p className="text-[var(--bv-text-dim)] text-sm mb-8">{items.length} found</p>
                
                {
                    loading ? (
                        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide sm:grid sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {
                                [1, 2, 3].map((i) => {
                                    return (
                                        <div key={i} className="bv-skeleton h-[340px] rounded-2xl min-w-[290px] sm:min-w-0 flex-shrink-0" />
                                    )
                                })
                            }
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-[var(--bv-text-muted)]">No {label.toLowerCase()} properties found</p>
                            <button
                                onClick={() => {
                                    return nav('/')
                                }}
                                className="mt-4 bv-btn-gold text-sm px-6 py-2.5"
                            >
                                Go Home
                            </button>
                        </div>
                    ) : (
                        <div className={`flex gap-5 overflow-x-auto pb-4 scrollbar-hide ${
                            ['hotel', 'hostel'].includes(category?.toLowerCase()) 
                            ? 'flex-col space-y-6' 
                            : 'sm:grid sm:gap-6 sm:grid-cols-2 lg:grid-cols-3'
                        }`}>
                            {
                                items.map((p) => {
                                    const isMulti = ['hotel', 'hostel'].includes(p.type?.toLowerCase());
                                    
                                    if (isMulti) {
                                        const minPrice = p.subUnits?.length > 0 ? Math.min(...p.subUnits.map(u => u.basePrice)) : p.price;
                                        return (
                                            <div
                                                key={p._id}
                                                onClick={() => nav(`/hotel/${p._id}/rooms`)}
                                                className="bv-card group cursor-pointer flex flex-col md:flex-row overflow-hidden min-h-[220px]"
                                            >
                                                <div className="md:w-1/3 relative h-48 md:h-auto overflow-hidden">
                                                    <img
                                                        src={cloudinaryTransform(p.images?.[0]?.url)}
                                                        alt={p.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute top-3 left-3 bv-badge bv-badge-gold">{p.type}</div>
                                                </div>
                                                <div className="flex-1 p-6 flex flex-col justify-between">
                                                    <div>
                                                        <h3 className="font-display text-2xl text-[var(--bv-text)] group-hover:text-[var(--bv-gold)] transition">{p.name}</h3>
                                                        <p className="flex items-center gap-1.5 text-xs text-[var(--bv-text-dim)] mt-2">
                                                            <MapPin size={11} /> {p.address}, {p.city}
                                                        </p>
                                                        <p className="mt-4 text-sm text-[var(--bv-text-muted)] line-clamp-3 leading-6">
                                                            {p.description}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bv-divider)]">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xl font-black text-[var(--bv-gold)]">
                                                                <span className="text-[10px] text-[var(--bv-text-dim)] mr-1">Starts from</span>
                                                                PKR {minPrice?.toLocaleString()}
                                                                <span className="text-xs text-[var(--bv-text-dim)] ml-1 font-normal">/ night</span>
                                                            </span>
                                                            {p.subUnits?.length > 0 && (
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)] bg-[var(--bv-surface)] px-2 py-1 rounded">
                                                                    {p.subUnits.length} Units Available
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button className="bv-btn-gold text-xs px-5 py-2 flex items-center gap-2">
                                                            View Rooms <ArrowRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={p._id}
                                            onClick={() => {
                                                return nav(`/property/${p.type?.toLowerCase()}/${p._id}`)
                                            }}
                                            className="bv-card group cursor-pointer overflow-hidden min-w-[290px] sm:min-w-0 flex-shrink-0"
                                        >
                                            <div className="relative h-52 overflow-hidden">
                                                <img
                                                    src={cloudinaryTransform(p.images?.[0]?.url)}
                                                    alt={p.name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                    loading="lazy"
                                                />
                                                <div className="absolute top-3 left-3 bv-badge bv-badge-gold">{p.type}</div>
                                            </div>
                                            <div className="p-5">
                                                <h3 className="font-bold text-[var(--bv-text)] truncate">{p.name}</h3>
                                                <p className="flex items-center gap-1.5 text-xs text-[var(--bv-text-dim)] mt-1">
                                                    <MapPin size={11} /> {p.city}
                                                </p>
                                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--bv-divider)]">
                                                    <span className="text-lg font-bold text-[var(--bv-gold)]">
                                                        PKR {p.price?.toLocaleString()}
                                                        <span className="text-xs text-[var(--bv-text-dim)] ml-1 font-normal">/ night</span>
                                                    </span>
                                                    <ArrowRight size={16} className="text-[var(--bv-text-dim)] group-hover:text-[var(--bv-gold)] transition" />
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

export default ViewPropertyByCategory
