/**
 * ConfirmBooking.jsx
 *
 * Booking confirmation page. Fetches the property and its food menu,
 * calculates smart pricing (nightly/weekly/monthly) based on stay length,
 * lets the guest optionally add meals, choose a payment method (cash or
 * Stripe), and displays house rules, cancellation policy, and damage
 * deposit. On submit, creates the booking; for Stripe bookings it
 * redirects to the Stripe Checkout session URL.
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import axios from 'axios'
import {
    ArrowLeft, CreditCard, Banknote, Loader2, MapPin, Star, ShieldCheck,
    CalendarDays, Moon, Calendar, CalendarRange, Clock, AlertTriangle, CheckCircle,
    BedDouble, Utensils, ConciergeBell, Plus, Minus
} from 'lucide-react'
import { calculatePrice } from '../utils/priceCalculator'
import { getAuthConfig } from '../utils/authConfig'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const ConfirmBooking = () => {
    const { id } = useParams()
    const nav = useNavigate()
    const [params] = useSearchParams()
    const { isLogin } = useSelector(s => s.auth)

    const [property, setProperty] = useState(null)
    const [foodMenu, setFoodMenu] = useState([])
    const [loading, setLoading] = useState(true)
    const [booking, setBooking] = useState(false)
    const [securityDepositRequired, setSecurityDepositRequired] = useState(false)
    const [riskScore, setRiskScore] = useState(0)

    // Date params come from the PropertyDetails page's "Book Now" link
    const [checkIn]  = useState(params.get('checkIn')  || '')
    const [checkOut] = useState(params.get('checkOut') || '')
    const [paymentMethod, setPaymentMethod] = useState('arrival')

    // ── MULTI-TIER PARAMS ──
    const [subUnitId] = useState(params.get('subUnitId') || null)
    const [initialAddOns] = useState(() => {
        try {
            const raw = params.get('selectedAddOns')
            return raw ? JSON.parse(decodeURIComponent(raw)) : []
        } catch { return [] }
    })
    const [selectedAddOns, setSelectedAddOns] = useState(initialAddOns)
    const [homemadeFoodSelected, setHomemadeFoodSelected] = useState(false)

    // Food selection state — one item per meal slot, or null for no meal
    const [selectedBreakfast, setSelectedBreakfast] = useState(null)
    const [selectedLunch,     setSelectedLunch]     = useState(null)
    const [selectedDinner,    setSelectedDinner]    = useState(null)

    // Derive stay length from the date params
    const stayDays = checkIn && checkOut
        ? Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000))
        : 0

    useEffect(() => {
        if (!isLogin) {
            nav('/login')
            return
        }
        if (!id || !checkIn || !checkOut) {
            nav(-1)
            return
        }

        const fetchData = async () => {
            try {
                setLoading(true)
                const [propRes, foodRes] = await Promise.all([
                    axios.get(`${BASE}/property/${id}`),
                    axios.get(`${BASE}/foodmenu/property/${id}`).catch(() => ({ data: { menu: [] } })),
                ])
                setProperty(propRes.data.property)
                setFoodMenu(foodRes.data.menu || [])
            } catch {
                nav(-1)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id, checkIn, checkOut, isLogin, nav])

    const pricing = useMemo(
        () => property ? calculatePrice(property, stayDays, subUnitId, selectedAddOns) : null,
        [property, stayDays, subUnitId, selectedAddOns]
    )

    const selectedUnit = useMemo(() => {
        if (!property || !subUnitId) return null
        return property.subUnits?.find(u => u._id === subUnitId || u._id.toString() === subUnitId.toString())
    }, [property, subUnitId])

    // ── Meal plan: group menu items by the slot they're served at ──
    const mealsBySlot = useMemo(() => {
        const groups = { breakfast: [], lunch: [], dinner: [] }
        for (const item of foodMenu) {
            if (groups[item.servingAt]) groups[item.servingAt].push(item)
        }
        return groups
    }, [foodMenu])

    const hasMealMenu = mealsBySlot.breakfast.length > 0 || mealsBySlot.lunch.length > 0 || mealsBySlot.dinner.length > 0

    // Selected item + its setter for each slot, so the slot UI can be rendered in a loop
    const mealSlots = [
        { key: 'breakfast', label: 'Breakfast', items: mealsBySlot.breakfast, selected: selectedBreakfast, setSelected: setSelectedBreakfast },
        { key: 'lunch',     label: 'Lunch',     items: mealsBySlot.lunch,     selected: selectedLunch,     setSelected: setSelectedLunch },
        { key: 'dinner',    label: 'Dinner',    items: mealsBySlot.dinner,    selected: selectedDinner,    setSelected: setSelectedDinner },
    ]

    // Clicking the already-selected item clears the slot (toggle off)
    const toggleMeal = (slot, item) => {
        slot.setSelected(prev => (prev?._id === item._id ? null : item))
    }

    // ── Add-on handlers ──
    const handleAddOnToggle = (svc) => {
        const exists = selectedAddOns.find(s => s.serviceName === svc.serviceName)
        if (exists) {
            setSelectedAddOns(prev => prev.filter(s => s.serviceName !== svc.serviceName))
        } else {
            setSelectedAddOns(prev => [...prev, { serviceName: svc.serviceName, quantity: 1 }])
        }
    }
    const handleQtyChange = (serviceName, delta) => {
        setSelectedAddOns(prev => prev.map(s =>
            s.serviceName === serviceName
                ? { ...s, quantity: Math.max(1, s.quantity + delta) }
                : s
        ))
    }

    const breakfastTotal = selectedBreakfast ? selectedBreakfast.foodprice * stayDays : 0
    const lunchTotal     = selectedLunch     ? selectedLunch.foodprice     * stayDays : 0
    const dinnerTotal    = selectedDinner    ? selectedDinner.foodprice    * stayDays : 0
    const homemadeFoodTotal = homemadeFoodSelected ? (property?.foodServices?.price || 0) : 0
    const mealTotal      = breakfastTotal + lunchTotal + dinnerTotal + homemadeFoodTotal
    const damageDeposit  = property?.damagePolicy?.depositRequired ? (property.damagePolicy.depositAmount || 0) : 0
    const grandTotal     = (pricing?.total || 0) + mealTotal

    const handleBooking = async () => {
        if (!isLogin) return nav('/login')
        if (booking) return

        try {
            setBooking(true)
            const bookingData = {
                propertyId: id,
                subUnitId,
                selectedAddOns,
                checkIn,
                checkOut,
                paymentMethod,
                totalPrice: grandTotal,
                stayType: pricing.rateType,
                homemadeFoodSelected,
            }

            // Send only the menu-item IDs — the server resolves title + price
            // from its own food menu so the client can't tamper with meal pricing.
            if (selectedBreakfast) bookingData.breakfastId = selectedBreakfast._id
            if (selectedLunch) bookingData.lunchId = selectedLunch._id
            if (selectedDinner) bookingData.dinnerId = selectedDinner._id

            const response = await axios.post(`${BASE}/booking/create-booking`, bookingData, getAuthConfig())

            if (response.data.success) {
                const { booking: bData, session } = response.data
                if (bData.requiresSecurityDeposit) {
                    setSecurityDepositRequired(true)
                    setRiskScore(bData.riskScore || 0)
                    return
                }
                if (paymentMethod === 'stripe' && session?.url) {
                    window.location.href = session.url
                    return
                }
                nav('/my-bookings')
            }
        } catch {
            // error silently handled
        } finally {
            setBooking(false)
        }
    }

    if (loading) return <div className="min-h-screen pt-28 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
    if (!property) return null

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => nav(-1)} className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition">
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] mb-8">Confirm Booking</h1>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bv-card-static p-5">
                            <div className="flex gap-4">
                                <img src={property.images?.[0]?.url || ''} className="w-28 h-20 rounded-xl object-cover" />
                                <div className="min-w-0">
                                    <span className="bv-badge bv-badge-gold text-[10px] mb-1">{property.type}</span>
                                    <h3 className="text-sm font-bold text-[var(--bv-text)] truncate">{property.name}</h3>
                                    {selectedUnit && <p className="text-xs font-bold text-[var(--bv-gold)] mt-1 flex items-center gap-1"><BedDouble size={12} /> {selectedUnit.name}</p>}
                                    <p className="flex items-center gap-1 text-xs text-[var(--bv-text-dim)] mt-1"><MapPin size={10} /> {property.city}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bv-card-static p-5">
                            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Stay Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">Check-in</p>
                                    <p className="text-sm font-semibold text-[var(--bv-text)] mt-1">{new Date(checkIn).toLocaleDateString()}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">Check-out</p>
                                    <p className="text-sm font-semibold text-[var(--bv-text)] mt-1">{new Date(checkOut).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Extra Services Selection ── */}
                        {(property.addOnServices?.length > 0 || property.foodServices?.available) && (
                            <div className="bv-card-static p-5 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest flex items-center gap-2">
                                        <ConciergeBell size={14} /> Extra Services
                                    </h3>
                                    <p className="text-xs text-[var(--bv-text-dim)] mt-1">Optional — select what you need during your stay.</p>
                                </div>
                                <div className="space-y-2">
                                    {/* Homemade Food Option */}
                                    {property.foodServices?.available && (
                                        <div
                                            onClick={() => setHomemadeFoodSelected(!homemadeFoodSelected)}
                                            className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition ${homemadeFoodSelected ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)] hover:border-[var(--bv-gold-border)]'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${homemadeFoodSelected ? 'bg-[var(--bv-gold)] border-[var(--bv-gold)]' : 'border-[var(--bv-border)]'}`}>
                                                    {homemadeFoodSelected && <CheckCircle size={12} className="text-black" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-[var(--bv-text)]">{property.foodServices.title || 'Homemade Food'}</p>
                                                    <p className="text-[10px] text-[var(--bv-text-dim)]">PKR {property.foodServices.price} / per service</p>
                                                </div>
                                            </div>
                                            <Utensils size={16} className={homemadeFoodSelected ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'} />
                                        </div>
                                    )}

                                    {property.addOnServices?.map(svc => {
                                        const isSelected = selectedAddOns.find(s => s.serviceName === svc.serviceName)
                                        const BILL = { 
                                            per_day: '/ day', 
                                            per_night: '/ night', 
                                            per_stay: '/ stay', 
                                            per_item: '/ item',
                                            per_person: '/ person'
                                        }
                                        return (
                                            <div
                                                key={svc.serviceName}
                                                onClick={() => handleAddOnToggle(svc)}
                                                className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition ${isSelected ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)] hover:border-[var(--bv-gold-border)]'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${isSelected ? 'bg-[var(--bv-gold)] border-[var(--bv-gold)]' : 'border-[var(--bv-border)]'}`}>
                                                        {isSelected && <CheckCircle size={12} className="text-black" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[var(--bv-text)]">{svc.serviceName}</p>
                                                        <p className="text-[10px] text-[var(--bv-text-dim)]">PKR {svc.price} {BILL[svc.billingType] || '/ stay'}</p>
                                                    </div>
                                                </div>
                                                {/* Quantity controls for per_item */}
                                                {isSelected && svc.billingType === 'per_item' && (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleQtyChange(svc.serviceName, -1)}
                                                            className="w-7 h-7 rounded-full bg-[var(--bv-surface)] border border-[var(--bv-border)] flex items-center justify-center hover:border-[var(--bv-gold)] transition"
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-sm font-bold text-[var(--bv-text)] w-4 text-center">
                                                            {isSelected.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => handleQtyChange(svc.serviceName, 1)}
                                                            className="w-7 h-7 rounded-full bg-[var(--bv-surface)] border border-[var(--bv-border)] flex items-center justify-center hover:border-[var(--bv-gold)] transition"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Meal Plan Selection ── */}
                        {hasMealMenu && (
                            <div className="bv-card-static p-5 space-y-5">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest flex items-center gap-2">
                                        <Utensils size={14} /> Meal Plan
                                    </h3>
                                    <p className="text-xs text-[var(--bv-text-dim)] mt-1">
                                        Optional — pick one item per meal. Charged per night ({stayDays} night{stayDays !== 1 ? 's' : ''}).
                                    </p>
                                </div>

                                {mealSlots.filter(slot => slot.items.length > 0).map(slot => (
                                    <div key={slot.key}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-[var(--bv-text-muted)] uppercase tracking-wide">{slot.label}</p>
                                            {slot.selected && (
                                                <button
                                                    onClick={() => slot.setSelected(null)}
                                                    className="text-[10px] font-semibold text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] transition"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {slot.items.map(item => {
                                                const isSelected = slot.selected?._id === item._id
                                                return (
                                                    <div
                                                        key={item._id}
                                                        onClick={() => toggleMeal(slot, item)}
                                                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition ${isSelected ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)] hover:border-[var(--bv-gold-border)]'}`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${isSelected ? 'bg-[var(--bv-gold)] border-[var(--bv-gold)]' : 'border-[var(--bv-border)]'}`}>
                                                                {isSelected && <CheckCircle size={12} className="text-black" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-[var(--bv-text)] truncate">{item.foodname}</p>
                                                                <p className="text-[10px] text-[var(--bv-text-dim)]">PKR {item.foodprice?.toLocaleString()} / night</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bv-card-static p-5">
                            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Payment Method</h3>
                            <div className="space-y-3">
                                {[{key:'arrival', label:'Pay on Arrival', icon:Banknote}, {key:'stripe', label:'Pay with Card', icon:CreditCard}].map(m => (
                                    <label key={m.key} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${paymentMethod === m.key ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]' : 'border-[var(--bv-border)]'}`}>
                                        <input type="radio" className="hidden" checked={paymentMethod === m.key} onChange={() => setPaymentMethod(m.key)} />
                                        <m.icon size={20} className={paymentMethod === m.key ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'} />
                                        <span className="text-sm font-semibold">{m.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="bv-card-static p-6 sticky top-28">
                            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">Booking Summary</h3>
                            <div className="space-y-3 text-sm">
                                {pricing?.breakdown.map((item, i) => (
                                    <div key={i} className="flex justify-between text-[var(--bv-text-muted)]">
                                        <span>{item.label}</span>
                                        <span className="font-semibold text-[var(--bv-text)]">PKR {item.amount.toLocaleString()}</span>
                                    </div>
                                ))}

                                {homemadeFoodSelected && (
                                    <div className="flex justify-between text-[var(--bv-text-muted)]">
                                        <span>{property.foodServices.title || 'Homemade Food'}</span>
                                        <span className="font-semibold text-[var(--bv-text)]">PKR {property.foodServices.price.toLocaleString()}</span>
                                    </div>
                                )}

                                {/* Pre-ordered meal line items (price × nights) */}
                                {[
                                    { label: 'Breakfast', sel: selectedBreakfast, total: breakfastTotal },
                                    { label: 'Lunch',     sel: selectedLunch,     total: lunchTotal },
                                    { label: 'Dinner',    sel: selectedDinner,    total: dinnerTotal },
                                ].filter(m => m.sel).map(m => (
                                    <div key={m.label} className="flex justify-between text-[var(--bv-text-muted)]">
                                        <span>{m.label}: {m.sel.foodname} <span className="text-[var(--bv-text-dim)]">× {stayDays}</span></span>
                                        <span className="font-semibold text-[var(--bv-text)]">PKR {m.total.toLocaleString()}</span>
                                    </div>
                                ))}

                                <div className="border-t border-[var(--bv-divider)] pt-3 mt-3 flex justify-between">
                                    <span className="text-base font-bold text-[var(--bv-text)]">Total</span>
                                    <span className="text-xl font-black text-[var(--bv-gold)]">PKR {grandTotal.toLocaleString()}</span>
                                </div>

                                {/* Refundable security deposit — held separately, not part of the charge */}
                                {damageDeposit > 0 && (
                                    <div className="flex justify-between items-center text-xs text-[var(--bv-text-dim)] pt-1">
                                        <span className="flex items-center gap-1"><ShieldCheck size={12} /> Refundable deposit</span>
                                        <span className="font-semibold">PKR {damageDeposit.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleBooking} disabled={booking} className="w-full bv-btn-gold py-3.5 text-sm mt-5 flex items-center justify-center gap-2">
                                {booking ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Security-deposit notice (risk engine flagged this booking) ── */}
            {securityDepositRequired && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bv-card-static p-6 bv-animate-in">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                <ShieldCheck size={22} className="text-[var(--bv-warning)]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--bv-text)]">Security Deposit Required</h3>
                                <p className="text-sm text-[var(--bv-text-muted)] mt-1 leading-relaxed">
                                    Your booking was created but, after an automated risk review, it requires a
                                    refundable security deposit before it can be confirmed. The deposit is returned
                                    after checkout provided there's no damage.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 p-3 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)] space-y-1.5">
                            {damageDeposit > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--bv-text-dim)]">Deposit amount</span>
                                    <span className="font-bold text-[var(--bv-text)]">PKR {damageDeposit.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--bv-text-dim)]">Risk score</span>
                                <span className="font-semibold text-[var(--bv-warning)]">{riskScore}/100</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => nav('/my-bookings')}
                                className="flex-1 bv-btn-gold py-3 text-sm"
                            >
                                Go to My Bookings
                            </button>
                            <button
                                onClick={() => setSecurityDepositRequired(false)}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ConfirmBooking
