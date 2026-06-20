/**
 * CompareProperties.jsx - Side-by-Side Property Comparison
 *
 * Allows users to select up to 3 properties and compare their features,
 * amenities, and pricing in a tabular format.
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Star, MapPin, Wifi, Car, Utensils, Wind, Tv, ShieldCheck, X, Plus, Check } from 'lucide-react'

// ==========================================
// Constants & Configuration
// ==========================================

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

/**
 * amenityIcons - Mapping of amenity slugs to Lucide icons.
 */
const amenityIcons = {
    wifi: Wifi,
    parking: Car,
    kitchen: Utensils,
    ac: Wind,
    tv: Tv,
    security: ShieldCheck
}

// ==========================================
// CompareProperties Component
// ==========================================

/**
 * CompareProperties - Renders the property comparison dashboard.
 * @returns {JSX.Element}
 */
const CompareProperties = () => {
    const [params] = useSearchParams()
    const nav = useNavigate()
    
    const ids = params.get('ids')?.split(',').filter((id) => {
        return Boolean(id)
    }) || []

    // --- State ---
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [allProperties, setAllProperties] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [search, setSearch] = useState('')

    // --- Effects ---

    /**
     * Effect: Fetch details for the properties identified in the URL.
     */
    useEffect(
        () => {
            if (!ids.length) {
                setLoading(false)
                return
            }
            Promise.all(
                ids.map((id) => {
                    return axios.get(`${BASE}/property/${id}`)
                        .then((r) => {
                            return r.data.property
                        })
                        .catch(() => {
                            return null
                        })
                })
            )
            .then((results) => {
                return setProperties(
                    results.filter((res) => {
                        return Boolean(res)
                    })
                )
            })
            .finally(() => {
                return setLoading(false)
            })
        },
        // Dependencies
        [params]
    )

    // --- Handlers ---

    /**
     * loadAll - Fetches all available properties to populate the "Add" modal.
     */
    const loadAll = async () => {
        if (allProperties.length) {
            setShowAdd(true)
            return
        }
        try {
            const r = await axios.get(`${BASE}/property`)
            setAllProperties(r.data.properties || [])
            setShowAdd(true)
        } catch {
            // error silently handled
        }
    }

    /**
     * addProperty - Adds a new property ID to the comparison list.
     * @param {string} id - Property ID.
     */
    const addProperty = (id) => {
        if (ids.includes(id)) {
            return;
        }
        if (ids.length >= 3) {
            return;
        }
        const newIds = [...ids, id].join(',')
        nav(`/compare?ids=${newIds}`, { replace: true })
        setShowAdd(false)
    }

    /**
     * removeProperty - Removes a property ID from the comparison list.
     * @param {string} id - Property ID.
     */
    const removeProperty = (id) => {
        const newIds = ids.filter((i) => {
            return i !== id
        }).join(',')
        nav(newIds ? `/compare?ids=${newIds}` : '/compare', { replace: true })
    }

    // --- Computed ---
    const filteredAll = allProperties.filter((p) => {
        return !ids.includes(p._id) && (
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.city?.toLowerCase().includes(search.toLowerCase())
        )
    })

    const allAmenities = [...new Set(
        properties.flatMap((p) => {
            return p.amenities || []
        })
    )]

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
                {/* --- Header Actions --- */}
                <button
                    onClick={() => {
                        return nav(-1)
                    }}
                    className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="font-display text-3xl text-[var(--bv-text)]">
                            Compare <span className="text-[var(--bv-gold)]">Properties</span>
                        </h1>
                        <p className="text-[var(--bv-text-dim)] text-sm mt-1">{properties.length}/3 selected</p>
                    </div>
                    {
                        properties.length < 3 && (
                            <button onClick={loadAll} className="bv-btn-gold text-sm px-4 py-2 flex items-center gap-2">
                                <Plus size={14} /> Add Property
                            </button>
                        )
                    }
                </div>

                {/* --- Add property modal --- */}
                {
                    showAdd && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="w-full max-w-md bv-card-static p-6 bv-animate-in max-h-[80vh] flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[var(--bv-text)]">Add Property</h3>
                                    <button
                                        onClick={() => {
                                            return setShowAdd(false)
                                        }}
                                        className="p-2 hover:bg-[var(--bv-surface)] rounded-xl"
                                    >
                                        <X size={16} className="text-[var(--bv-text-dim)]" />
                                    </button>
                                </div>
                                <input
                                    value={search}
                                    onChange={(e) => {
                                        return setSearch(e.target.value)
                                    }}
                                    placeholder="Search by name or city..."
                                    className="bv-input mb-3"
                                />
                                <div className="flex-1 overflow-y-auto space-y-2">
                                    {
                                        filteredAll.slice(0, 20).map((p) => {
                                            return (
                                                <button
                                                    key={p._id}
                                                    onClick={() => {
                                                        return addProperty(p._id)
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[var(--bv-surface)] transition"
                                                >
                                                    {
                                                        p.images?.[0]?.url ? (
                                                            <img src={p.images[0].url} alt="" className="w-12 h-10 rounded-lg object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-12 h-10 rounded-lg bg-[var(--bv-surface)] flex-shrink-0" />
                                                        )
                                                    }
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-[var(--bv-text)] truncate">{p.name}</p>
                                                        <p className="text-xs text-[var(--bv-text-dim)]">{p.city} · PKR {p.price?.toLocaleString()}</p>
                                                    </div>
                                                    <Plus size={16} className="text-[var(--bv-gold)]" />
                                                </button>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {
                                [1, 2, 3].map((i) => {
                                    return (
                                        <div key={i} className="bv-skeleton h-[500px] rounded-2xl" />
                                    )
                                })
                            }
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="bv-card-static py-20 text-center">
                            <p className="text-[var(--bv-text-muted)] font-bold text-lg mb-4">No properties selected</p>
                            <button onClick={loadAll} className="bv-btn-gold text-sm px-6 py-3">Select Properties to Compare</button>
                        </div>
                    ) : (
                        <>
                            {/* --- Images Row --- */}
                            <div className={`grid gap-4 mb-6 ${properties.length === 1 ? 'grid-cols-1' : properties.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {
                                    properties.map((p) => {
                                        return (
                                            <div key={p._id} className="bv-card-static overflow-hidden relative group">
                                                <button
                                                    onClick={() => {
                                                        return removeProperty(p._id)
                                                    }}
                                                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <X size={14} />
                                                </button>
                                                <img src={p.images?.[0]?.url || ''} alt={p.name} className="w-full h-48 object-cover" />
                                                <div className="p-4">
                                                    <h3 className="font-bold text-[var(--bv-text)] truncate">{p.name}</h3>
                                                    <p className="text-xs text-[var(--bv-text-dim)] flex items-center gap-1 mt-1">
                                                        <MapPin size={11} /> {p.city}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div>

                            {/* --- Comparison Table --- */}
                            <div className="bv-card-static overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <th className="p-4 text-left bv-label">Feature</th>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <th key={p._id} className="p-4 text-center text-[var(--bv-gold)] font-bold">
                                                            {p.name?.split(' ').slice(0, 2).join(' ')}
                                                        </th>
                                                    )
                                                })
                                            }
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">Price/Night</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center font-bold text-[var(--bv-gold)]">
                                                            PKR {p.price?.toLocaleString()}
                                                        </td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">Type</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center">
                                                            <span className="bv-badge bv-badge-gold capitalize">{p.type}</span>
                                                        </td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">Rating</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center">
                                                            <span className="flex items-center justify-center gap-1 text-[var(--bv-gold)]">
                                                                <Star size={12} fill="currentColor" /> {p.rating || '—'}
                                                            </span>
                                                        </td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">City</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center text-[var(--bv-text)]">{p.city}</td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">Food Service</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center">
                                                            {
                                                                p.foodMenuAvailable ? (
                                                                    <Check size={16} className="text-[var(--bv-success)] mx-auto" />
                                                                ) : (
                                                                    <X size={16} className="text-[var(--bv-text-dim)] mx-auto" />
                                                                )
                                                            }
                                                        </td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        <tr className="border-b border-[var(--bv-divider)]">
                                            <td className="p-4 text-[var(--bv-text-muted)]">Medical</td>
                                            {
                                                properties.map((p) => {
                                                    return (
                                                        <td key={p._id} className="p-4 text-center">
                                                            {
                                                                p.medicalServiceAvailable ? (
                                                                    <Check size={16} className="text-[var(--bv-success)] mx-auto" />
                                                                ) : (
                                                                    <X size={16} className="text-[var(--bv-text-dim)] mx-auto" />
                                                                )
                                                            }
                                                        </td>
                                                    )
                                                })
                                            }
                                        </tr>
                                        {
                                            allAmenities.map((a) => {
                                                const AmenityIcon = amenityIcons[a?.toLowerCase()]
                                                return (
                                                    <tr key={a} className="border-b border-[var(--bv-divider)]">
                                                        <td className="p-4 text-[var(--bv-text-muted)] capitalize">
                                                            <span className="flex items-center gap-2">
                                                                {AmenityIcon && <AmenityIcon size={14} className="text-[var(--bv-gold)]" />}
                                                                {a}
                                                            </span>
                                                        </td>
                                                        {
                                                            properties.map((p) => {
                                                                return (
                                                                    <td key={p._id} className="p-4 text-center">
                                                                        {
                                                                            p.amenities?.includes(a) ? (
                                                                                <Check size={16} className="text-[var(--bv-success)] mx-auto" />
                                                                            ) : (
                                                                                <X size={16} className="text-[var(--bv-text-dim)] mx-auto" />
                                                                            )
                                                                        }
                                                                    </td>
                                                                )
                                                            })
                                                        }
                                                    </tr>
                                                )
                                            })
                                        }
                                    </tbody>
                                </table>

                                {/* --- Book buttons --- */}
                                <div className={`grid gap-4 p-4 border-t border-[var(--bv-divider)] ${properties.length === 1 ? 'grid-cols-1' : properties.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {
                                        properties.map((p) => {
                                            return (
                                                <button
                                                    key={p._id}
                                                    onClick={() => {
                                                        return nav(`/property/${p.type?.toLowerCase()}/${p._id}`)
                                                    }}
                                                    className="bv-btn-gold py-3 text-sm"
                                                >
                                                    Book {p.name?.split(' ')[0]}
                                                </button>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </>
                    )
                }
            </div>
        </div>
    )
}

export default CompareProperties
