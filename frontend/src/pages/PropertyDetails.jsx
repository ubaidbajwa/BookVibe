import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BedDouble, CalendarDays, Car,
  CheckCircle, ChevronLeft, ChevronRight, Cigarette, Clock, Coffee,
  ConciergeBell, Dumbbell, ExternalLink, Flame, Heart, ImageOff, Loader2,
  MapPin, Maximize2, MessageSquare, Moon, Navigation, PawPrint, PartyPopper,
  Share2, Shield, ShieldCheck, Star, Tag, Tv, Users, UtensilsCrossed, Wifi,
  Wind, X, Building2, ImageIcon, Layers
} from 'lucide-react';
import { getPricingDisplay, calculatePrice } from '../utils/priceCalculator';
import { getAuthConfig } from '../utils/authConfig';
import WishlistButton from '../components/WishlistButton';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const AVAIL = { IDLE: 'idle', CHECKING: 'checking', AVAILABLE: 'available', UNAVAILABLE: 'unavailable' };

// Platform-wide cancellation policy — same for every property, measured from payment time.
const CANCELLATION_PHASES = [
  { label: 'Within 24h', desc: 'Cancel within 24 hours of payment — 100% refund.', cls: 'text-[var(--bv-success)] bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.2)]' },
  { label: 'Within 4 days', desc: 'Cancel after 24 hours but within 4 days — 85% refund (15% fee).', cls: 'text-[var(--bv-warning)] bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.2)]' },
  { label: 'After 4 days', desc: 'Cancel more than 4 days after payment — 70% refund (30% fee).', cls: 'text-[var(--bv-danger)] bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.2)]' },
];

const BILL_LABEL = { per_day: '/ day', per_stay: '/ stay', per_item: '/ item' };

const AMENITY_ICON = {
  WiFi: Wifi, AC: Wind, Heating: Flame, Kitchen: UtensilsCrossed,
  'Free Parking': Car, Parking: Car, TV: Tv, 'Smart TV': Tv,
  'Dedicated Workspace': Coffee, Gym: Dumbbell, Breakfast: Coffee,
  'Pet Friendly': PawPrint, 'Smoke Alarm': Shield,
};

const formatMoney = v => `PKR ${(Number(v) || 0).toLocaleString()}`;

const formatTime = v => {
  if (!v) return '';
  const [h, m = '00'] = String(v).split(':');
  const hour = Number(h);
  if (Number.isNaN(hour)) return v;
  return `${hour % 12 || 12}:${m.padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getGuestName = r => r.guest?.username || r.userId?.username || 'Guest';
const getGuestImage = r => r.guest?.profileImage || r.userId?.profileImage;
const getHostReply = r => {
  if (!r.hostReply) return '';
  return typeof r.hostReply === 'string' ? r.hostReply : r.hostReply.text;
};

const Section = ({ title, icon: Icon, children, className = '' }) => (
  <section className={`bv-card-static p-5 ${className}`}>
    <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--bv-gold)]">
      {Icon && <Icon size={14} strokeWidth={2.4} />}
      <span>{title}</span>
    </div>
    {children}
  </section>
);

const SOFT_ICON_TONES = {
  teal: 'border-[var(--bv-border-gold)] bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]',
  red: 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.08)] text-[var(--bv-danger)]',
  neutral: 'border-[var(--bv-border)] bg-[var(--bv-surface)] text-[var(--bv-text-muted)]',
};

const SoftIcon = ({ icon: Icon, children, tone = 'teal' }) => (
  <div className={`flex min-h-[48px] items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${SOFT_ICON_TONES[tone]}`}>
    <Icon size={16} />
    <span>{children}</span>
  </div>
);

const GalleryNav = ({ onClick, children, className = '' }) => (
  <button type="button" onClick={onClick} className={`rounded-full bg-black/45 p-2 text-white backdrop-blur transition hover:bg-black/70 ${className}`}>
    {children}
  </button>
);

const PropertyDetails = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { isLogin } = useSelector(s => s.auth);
  const authUser = useSelector(s => s.auth.user?.user);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [availState, setAvailState] = useState(AVAIL.IDLE);

  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${BASE}/property/${id}`, { signal: ctrl.signal });
        setProperty(res.data.property);
        
        // If roomParam exists, try to select that unit, otherwise select the first one
        if (res.data.property.subUnits?.length > 0) {
          const focusUnit = roomParam 
            ? res.data.property.subUnits.find(u => u._id === roomParam || u.roomNo === roomParam)
            : res.data.property.subUnits[0];
          
          if (focusUnit) setSelectedUnitId(focusUnit._id);
          else setSelectedUnitId(res.data.property.subUnits[0]._id);
        }
      } catch (err) {
        if (!axios.isCancel(err)) { nav('/'); }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [id, nav, roomParam]);

  useEffect(() => {
    if (!id) return undefined;
    const ctrl = new AbortController();
    axios.get(`${BASE}/reviews/property/${id}`, { signal: ctrl.signal })
      .then(res => setReviews(res.data.reviews || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => { setAvailState(AVAIL.IDLE); }, [checkIn, checkOut, selectedUnitId]);

  const focusedUnit = useMemo(() => {
    if (!property || !selectedUnitId) return null;
    return property.subUnits?.find(u => u._id === selectedUnitId || u._id?.toString() === selectedUnitId);
  }, [property, selectedUnitId]);

  const handleCheckAvailability = async () => {
    if (!isLogin) { nav('/login'); return; }
    if (!checkIn || !checkOut) { return; }
    if (new Date(checkOut) <= new Date(checkIn)) { return; }
    setAvailState(AVAIL.CHECKING);
    try {
      const res = await axios.post(`${BASE}/booking/check-availability`, { propertyId: id, subUnitId: selectedUnitId, checkIn, checkOut }, getAuthConfig());
      setAvailState(res.data.isBooked ? AVAIL.UNAVAILABLE : AVAIL.AVAILABLE);
    } catch {
      setAvailState(AVAIL.IDLE);
    }
  };

  // This property is restricted to identity-verified guests, and the current user isn't verified.
  const needsVerification = property?.onlyVerifiedGuests && isLogin && authUser?.isVerified !== 'verified';

  const proceedToBooking = () => {
    if (needsVerification) {
      nav('/profile');
      return;
    }
    const typeSlug = (property?.type || 'property').toLowerCase().replace(/\s+/g, '-');
    nav(`/${typeSlug}/confirm-booking/${id}?${new URLSearchParams({ checkIn, checkOut, subUnitId: selectedUnitId || '' })}`);
  };

  const stayDays = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000));
  }, [checkIn, checkOut]);

  const pricingTiers = useMemo(() => (property ? getPricingDisplay(property, selectedUnitId) : []), [property, selectedUnitId]);

  const perNight = useMemo(() => {
    if (!property) return 0;
    if (focusedUnit) return focusedUnit.basePrice;
    return property.pricing?.nightly || property.price || 0;
  }, [property, focusedUnit]);

  const totalEstimate = useMemo(() => {
    if (!property || !stayDays) return null;
    return calculatePrice(property, stayDays, selectedUnitId, []);
  }, [property, stayDays, selectedUnitId]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  const ratingDistribution = useMemo(() =>
    [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => Math.round(r.rating) === star).length }))
  , [reviews]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bv-bg)] px-5 pb-20 pt-24">
        <div className="mx-auto max-w-[1060px] space-y-5">
          <div className="bv-skeleton h-[360px] rounded-lg" />
          <div className="bv-skeleton h-20 rounded-lg" />
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="bv-skeleton h-36 rounded-lg" />
              <div className="bv-skeleton h-32 rounded-lg" />
              <div className="bv-skeleton h-44 rounded-lg" />
            </div>
            <div className="bv-skeleton h-80 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) return null;

  const isHotel = ['Hotel', 'Hostel'].includes(property.type);
  const images = (isHotel && focusedUnit?.images?.length > 0) ? focusedUnit.images : (property.images || []);
  const hasSubUnits = property.subUnits?.length > 0 && isHotel;
  const mapCoords = property.coordinates?.lat && property.coordinates.lat !== 0
    ? [property.coordinates.lat, property.coordinates.lng]
    : null;
  const addressLine = [property.address, property.city, property.country].filter(Boolean).join(', ');
  const today = new Date().toISOString().split('T')[0];
  const checkInTime = formatTime(property.checkInTime || '14:00');
  const checkOutTime = formatTime(property.checkOutTime || '11:00');

  const goPrev = e => { e?.stopPropagation(); setActiveImg(c => (c - 1 + (images.length || 1)) % (images.length || 1)); };
  const goNext = e => { e?.stopPropagation(); setActiveImg(c => (c + 1) % (images.length || 1)); };

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: property.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); }
    } catch {
      // share cancelled or clipboard unavailable — no action needed
    }
  };

  const openDirections = () => {
    const q = mapCoords ? `${mapCoords[0]},${mapCoords[1]}` : addressLine;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[var(--bv-bg)] pb-24 pt-20 text-[var(--bv-text)] lg:pb-16">
      <div className="mx-auto max-w-[1060px] px-4 sm:px-6">

        <button
          type="button"
          onClick={() => nav(-1)}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--bv-text-dim)] transition hover:text-[var(--bv-gold)]"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* ── Gallery ── */}
        <div className="mb-6">
          {images.length > 0 ? (
            <div className="space-y-3">
              <div
                className="group relative h-[260px] overflow-hidden rounded-lg bg-[var(--bv-surface)] shadow-[var(--bv-shadow-md)] sm:h-[360px] lg:h-[380px]"
                onClick={() => setLightbox(true)}
                role="button"
                tabIndex={0}
              >
                <img src={images[activeImg]?.url} alt={property.name} className="h-full w-full object-cover" />

                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <WishlistButton 
                    propertyId={property._id} 
                    className="h-9 w-9 flex items-center justify-center !p-0"
                  />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleShare(); }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
                    aria-label="Share property"
                  >
                    <Share2 size={16} />
                  </button>
                </div>

                {images.length > 1 && (
                  <>
                    <GalleryNav onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <ChevronLeft size={18} />
                    </GalleryNav>
                    <GalleryNav onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <ChevronRight size={18} />
                    </GalleryNav>
                  </>
                )}

                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setLightbox(true); }}
                  className="absolute bottom-4 left-4 hidden items-center gap-2 rounded-lg bg-[var(--bv-card)]/90 px-3 py-2 text-xs font-bold text-[var(--bv-text)] shadow-sm backdrop-blur transition hover:text-[var(--bv-gold)] sm:flex"
                >
                  <Maximize2 size={14} /> View photos
                </button>
              </div>

              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {images.slice(0, 8).map((img, index) => (
                    <button
                      key={img.public_id || img.url || index}
                      type="button"
                      onClick={() => setActiveImg(index)}
                      className={`h-12 w-[74px] shrink-0 overflow-hidden rounded-md border-2 transition sm:h-14 sm:w-[86px] ${
                        activeImg === index
                          ? 'border-[var(--bv-gold)] shadow-[var(--bv-shadow-gold)]'
                          : 'border-[var(--bv-border)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-lg bg-[var(--bv-surface)]">
              <ImageOff size={44} className="text-[var(--bv-text-dim)]" />
            </div>
          )}
        </div>

        {/* ── Lightbox ── */}
        {lightbox && images.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setLightbox(false)}>
            <button type="button" onClick={() => setLightbox(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close gallery">
              <X size={22} />
            </button>
            {images.length > 1 && (
              <button type="button" onClick={goPrev} className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20">
                <ChevronLeft size={22} />
              </button>
            )}
            <img
              src={images[activeImg]?.url}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={e => e.stopPropagation()}
            />
            {images.length > 1 && (
              <button type="button" onClick={goNext} className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20">
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="space-y-5">

            {/* ── Title ── */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="bv-badge bv-badge-gold">{roomParam && focusedUnit ? focusedUnit.unitType : property.type}</span>
                {property.verificationStatus === 'verified' && (
                  <span className="bv-badge bv-badge-green inline-flex items-center gap-1">
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
              </div>

              {roomParam && focusedUnit ? (
                <div className="flex flex-col items-start">
                  <p className="text-sm font-bold text-[var(--bv-text-dim)] uppercase tracking-widest mb-1">
                    This room is from
                  </p>
                  <button 
                    onClick={() => { setSelectedUnitId(null); nav(`/property/${property.type.toLowerCase()}/${property._id}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="font-display text-4xl leading-tight sm:text-5xl text-[var(--bv-gold)] hover:underline text-left mb-3"
                  >
                    {property.name}
                  </button>
                  <h1 className="text-2xl font-black text-[var(--bv-text)]">
                    {focusedUnit.roomNo && <span className="mr-2">#{focusedUnit.roomNo}</span>}
                    {focusedUnit.name}
                  </h1>
                </div>
              ) : (
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">
                  {property.name}
                </h1>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--bv-text-muted)]">
                <MapPin size={15} className="text-[var(--bv-gold)]" />
                {addressLine}
              </p>
            </div>

            {/* ── Availability Banner ── */}
            <div className={`rounded-lg border p-4 ${
              property.available
                ? 'border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.06)]'
                : 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.06)]'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  property.available ? 'bg-[rgba(251,191,36,0.15)] text-[var(--bv-warning)]' : 'bg-[rgba(248,113,113,0.15)] text-[var(--bv-danger)]'
                }`}>
                  {property.available ? <CalendarDays size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div>
                  <p className={`text-sm font-black ${property.available ? 'text-[var(--bv-warning)]' : 'text-[var(--bv-danger)]'}`}>
                    {property.available ? 'Available for booking' : 'Currently booked'}
                  </p>
                  <p className="text-xs font-semibold text-[var(--bv-text-muted)]">
                    Select your check-in and check-out dates to confirm availability.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Check-in / Check-out ── */}
            <Section title="Check-in and Check-out" icon={Clock}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--bv-text-dim)]">Check-in</p>
                  <p className="mt-2 text-2xl font-black text-[var(--bv-gold)]">{checkInTime}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--bv-text-dim)]">Fixed arrival time</p>
                </div>
                <div className="rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--bv-text-dim)]">Check-out</p>
                  <p className="mt-2 text-2xl font-black text-[var(--bv-text)]">{checkOutTime}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--bv-text-dim)]">Must vacate by this time</p>
                </div>
              </div>
            </Section>

            {/* ── Room Showcase (multi-unit) ── */}
            {hasSubUnits && !roomParam && (
              <Section title={`Units Available`} icon={BedDouble}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-[var(--bv-surface)] border border-[var(--bv-border)] rounded-2xl p-6">
                   <div>
                     <p className="text-sm font-semibold text-[var(--bv-text-muted)]">Currently Active Rooms</p>
                     <div className="flex items-end gap-3 mt-1">
                       <h4 className="text-4xl font-black text-[var(--bv-gold)] leading-none">
                         {property.subUnits.filter(u => u.available).length}
                       </h4>
                       <span className="text-xs font-bold text-[var(--bv-text-dim)] pb-1 uppercase tracking-widest">Rooms</span>
                     </div>
                   </div>
                   <button 
                     onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); nav(`/hotel/${property._id}/rooms`); }} 
                     className="w-full sm:w-auto bv-btn-gold px-8 py-3.5 text-sm"
                   >
                     View All Rooms
                   </button>
                </div>
              </Section>
            )}

            {/* ── Description ── */}
            <Section title="Description" icon={MessageSquare}>
              <p className="text-sm leading-7 text-[var(--bv-text-muted)]">{property.description}</p>
            </Section>

            {/* ── Amenities ── */}
            {property.amenities?.length > 0 && (
              <Section title="Amenities" icon={CheckCircle}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {property.amenities.map(amenity => {
                    const Icon = AMENITY_ICON[amenity] || CheckCircle;
                    return <SoftIcon key={amenity} icon={Icon}>{amenity}</SoftIcon>;
                  })}
                </div>
              </Section>
            )}

            {/* ── Pricing Plans ── */}
            {(!isHotel || roomParam) && pricingTiers.length > 0 && (
              <Section title="Pricing Plans" icon={Tag}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {pricingTiers.map(tier => (
                    <div
                      key={tier.type}
                      className={`relative rounded-lg border bg-[var(--bv-card)] p-4 ${
                        tier.type === 'monthly' ? 'border-[var(--bv-gold)] shadow-[var(--bv-shadow-gold)]' : 'border-[var(--bv-border)]'
                      }`}
                    >
                      {tier.discount > 0 && (
                        <span className="absolute -top-2 right-3 rounded-full bg-[var(--bv-gold)] px-2 py-0.5 text-[9px] font-black text-[var(--bv-text-inverse)]">
                          {tier.discount}% OFF
                        </span>
                      )}
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--bv-text-dim)]">{tier.label}</p>
                      <p className="mt-3 text-xl font-black text-[var(--bv-text)]">{formatMoney(tier.price)}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--bv-text-muted)]">/{tier.per}</p>
                      {tier.perNight && (
                        <p className="mt-2 text-[11px] font-semibold text-[var(--bv-gold)]">{formatMoney(tier.perNight)}/night</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Extra Services ── */}
            {property.addOnServices?.length > 0 && (
              <Section title="Extra Services" icon={ConciergeBell}>
                <div className="space-y-3">
                  {property.addOnServices.map(service => (
                    <div key={service.serviceName} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]">
                          <ConciergeBell size={16} />
                        </span>
                        <div>
                          <p className="text-sm font-black text-[var(--bv-text)]">{service.serviceName}</p>
                          <p className="text-[11px] font-semibold capitalize text-[var(--bv-text-muted)]">{service.billingType?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <p className="text-right text-sm font-black text-[var(--bv-gold)]">
                        {formatMoney(service.price)}
                        <span className="block text-[10px] font-semibold text-[var(--bv-text-dim)]">{BILL_LABEL[service.billingType] || '/ stay'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Homemade Food ── */}
            {property.foodServices?.available && (
              <Section title="Homemade Food" icon={UtensilsCrossed}>
                <div className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]">
                        <UtensilsCrossed size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-black text-[var(--bv-text)]">
                          {property.foodServices.title || 'Homemade Food'}
                        </p>
                        {property.foodServices.description && (
                          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--bv-text-muted)]">
                            {property.foodServices.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {property.foodServices.price && (
                      <div className="shrink-0 text-right">
                        <p className="text-base font-black text-[var(--bv-gold)]">
                          {formatMoney(property.foodServices.price)}
                        </p>
                        <p className="text-[10px] font-semibold text-[var(--bv-text-dim)]">/ meal</p>
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* ── Medical Assistance ── */}
            {property.medicalServices?.available && (
              <Section title="Medical Assistance" icon={ShieldCheck}>
                <div className="rounded-xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.05)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(74,222,128,0.12)] text-[var(--bv-success)]">
                      <ShieldCheck size={18} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-[var(--bv-text)]">
                          {property.medicalServices.title || 'Medical Assistance'}
                        </p>
                        <span className="rounded-full border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--bv-success)]">
                          Free
                        </span>
                      </div>
                      {property.medicalServices.description && (
                        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--bv-text-muted)]">
                          {property.medicalServices.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Security Deposit ── */}
            {property.damagePolicy?.depositRequired && (
              <Section title="Security Deposit" icon={Shield}>
                <div className="rounded-lg border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.06)] p-4 text-sm">
                  <p className="font-black text-[var(--bv-warning)]">{formatMoney(property.damagePolicy.depositAmount)} deposit required</p>
                  {property.damagePolicy.damageRules && (
                    <p className="mt-1 leading-6 text-[var(--bv-text-muted)]">{property.damagePolicy.damageRules}</p>
                  )}
                </div>
              </Section>
            )}

            {/* ── House Rules ── */}
            <Section title="House Rules" icon={Shield}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SoftIcon icon={Cigarette} tone={property.houseRules?.smokingAllowed ? 'teal' : 'red'}>
                  {property.houseRules?.smokingAllowed ? 'Smoking allowed' : 'Smoking not allowed'}
                </SoftIcon>
                <SoftIcon icon={PawPrint} tone={property.houseRules?.petsAllowed ? 'teal' : 'red'}>
                  {property.houseRules?.petsAllowed ? 'Pets allowed' : 'Pets not allowed'}
                </SoftIcon>
                <SoftIcon icon={PartyPopper} tone={property.houseRules?.partiesAllowed ? 'teal' : 'red'}>
                  {property.houseRules?.partiesAllowed ? 'Parties allowed' : 'Parties not allowed'}
                </SoftIcon>
                <SoftIcon icon={Users} tone="neutral">Max {property.houseRules?.maxGuests || 2} guests</SoftIcon>
                <SoftIcon icon={Clock} tone="neutral">
                  Quiet {property.houseRules?.quietHoursStart || '22:00'} – {property.houseRules?.quietHoursEnd || '07:00'}
                </SoftIcon>
              </div>
              {property.houseRules?.customRules?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {property.houseRules.customRules.map((rule, i) => (
                    <p key={`${rule}-${i}`} className="rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] px-4 py-3 text-sm font-semibold text-[var(--bv-text-muted)]">
                      {rule}
                    </p>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Cancellation Policy ── */}
            <Section title="Cancellation Policy" icon={Moon}>
              <p className="mb-3 text-xs font-semibold text-[var(--bv-text-dim)]">
                Refunds depend on how long after payment you cancel:
              </p>
              <div className="space-y-2">
                {CANCELLATION_PHASES.map((phase) => (
                  <div key={phase.label} className={`rounded-lg border px-4 py-3 text-sm font-semibold ${phase.cls}`}>
                    <span className="mr-3 rounded-md bg-[var(--bv-card)]/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                      {phase.label}
                    </span>
                    {phase.desc}
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Reviews ── */}
            <Section title="Guest Reviews" icon={Star}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_132px]">
                <div>
                  <p className="text-sm font-semibold text-[var(--bv-text-muted)]">Only verified stays can leave reviews.</p>
                  <div className="mt-5 space-y-2">
                    {ratingDistribution.map(({ star, count }) => {
                      const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                      return (
                        <div key={star} className="grid grid-cols-[34px_minmax(0,1fr)_18px] items-center gap-3 text-[11px] font-bold text-[var(--bv-text-muted)]">
                          <span>{star} star</span>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bv-surface)]">
                            <div className="h-full rounded-full bg-[var(--bv-gold)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bv-card-static p-4 text-center">
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]">
                    <Star size={16} fill="currentColor" />
                  </div>
                  <p className="text-2xl font-black text-[var(--bv-text)]">{avgRating.toFixed(1)}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--bv-text-muted)]">
                    {reviews.length} verified review{reviews.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {reviews.map(review => {
                    const replyText = getHostReply(review);
                    const guestName = getGuestName(review);
                    const guestImage = getGuestImage(review);
                    return (
                      <article key={review._id} className="rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--bv-gold-glow)] text-sm font-black text-[var(--bv-gold)]">
                              {guestImage ? <img src={guestImage} alt="" className="h-full w-full object-cover" /> : guestName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-black text-[var(--bv-text)]">{guestName}</p>
                              <p className="text-[11px] font-semibold text-[var(--bv-text-muted)]">
                                {new Date(review.createdAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 text-[var(--bv-gold)]">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star key={star} size={12} fill={star <= review.rating ? 'currentColor' : 'none'} />
                            ))}
                          </div>
                        </div>
                        {review.title && <p className="mt-3 text-sm font-black text-[var(--bv-text)]">{review.title}</p>}
                        {review.comment && <p className="mt-2 text-sm leading-6 text-[var(--bv-text-muted)]">{review.comment}</p>}
                        {replyText && (
                          <div className="mt-3 border-l-2 border-[var(--bv-gold)] pl-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--bv-gold)]">Host reply</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--bv-text-muted)]">{replyText}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] py-10 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-[var(--bv-text-dim)]" />
                  <p className="text-sm font-black text-[var(--bv-text)]">No reviews yet</p>
                </div>
              )}
            </Section>

            {/* ── Location ── */}
            <Section title="Location" icon={MapPin}>
              <p className="mb-4 text-sm font-semibold text-[var(--bv-text-muted)]">{property.address}, {property.city}</p>
              <div className="h-[330px] overflow-hidden rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                {mapCoords ? (
                  <MapContainer center={mapCoords} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={mapCoords}><Popup>{property.name}</Popup></Marker>
                  </MapContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--bv-text-muted)]">
                    <MapPin size={30} />
                    <p className="text-sm font-semibold">{addressLine}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {mapCoords && (
                  <span className="mr-auto text-[11px] font-semibold text-[var(--bv-text-dim)]">
                    {mapCoords[0].toFixed(5)}, {mapCoords[1].toFixed(5)}
                  </span>
                )}
                <button type="button" onClick={openDirections} className="bv-btn-gold inline-flex items-center gap-2 px-4 py-2 text-xs">
                  <Navigation size={13} /> Directions
                </button>
                <button type="button" onClick={openDirections} className="bv-btn-outline inline-flex items-center gap-2 px-4 py-2 text-xs">
                  <ExternalLink size={13} /> Google Maps
                </button>
              </div>
            </Section>
          </main>

          {/* ── Booking Sidebar ── */}
          <aside className="lg:sticky lg:top-24">
            {(!isHotel || roomParam) ? (
              <div className="bv-card-static p-5">
                <div>
                  <p className="text-3xl font-black leading-none text-[var(--bv-gold)]">
                    {formatMoney(perNight)}
                    <span className="ml-1 text-xs font-bold text-[var(--bv-text-muted)]">/ night</span>
                  </p>
                  {pricingTiers.find(t => t.type === 'weekly') && (
                    <p className="mt-2 text-[11px] font-semibold text-[var(--bv-text-muted)]">
                      Weekly: {formatMoney(pricingTiers.find(t => t.type === 'weekly')?.price)}
                    </p>
                  )}
                  {pricingTiers.find(t => t.type === 'monthly') && (
                    <p className="mt-1 text-[11px] font-semibold text-[var(--bv-text-muted)]">
                      Monthly: {formatMoney(pricingTiers.find(t => t.type === 'monthly')?.price)}
                    </p>
                  )}
                </div>

                <div className="my-5 rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--bv-text-muted)]">
                    <Clock size={14} className="text-[var(--bv-gold)]" />
                    <span>In: {checkInTime}</span>
                    <span className="text-[var(--bv-text-dim)]">–</span>
                    <span>Out: {checkOutTime}</span>
                  </div>
                </div>

                {hasSubUnits && (
                  <div className="mb-4">
                    <label className="bv-label">Room / Bed</label>
                    <select
                      className="bv-input text-sm font-semibold"
                      value={selectedUnitId || ''}
                      onChange={e => {
                        nav(`/property/${property.type.toLowerCase()}/${property._id}?room=${e.target.value}`);
                        setSelectedUnitId(e.target.value);
                      }}
                    >
                      {property.subUnits.map(unit => (
                        <option key={unit._id} value={unit._id}>
                          {unit.name} – {formatMoney(unit.basePrice)}/night
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="bv-label">Check-in</label>
                    <input type="date" min={today} className="bv-input" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
                  </div>
                  <div>
                    <label className="bv-label">Check-out</label>
                    <input type="date" min={checkIn || today} className="bv-input" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
                  </div>
                </div>

              {stayDays > 0 && totalEstimate && (
                <div className="mt-4 space-y-2 rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface)] p-3">
                  {totalEstimate.breakdown.map((item, i) => (
                    <div key={`${item.label}-${i}`} className="flex justify-between gap-3 text-xs font-semibold text-[var(--bv-text-muted)]">
                      <span>{item.label}</span>
                      <span className="text-[var(--bv-text)]">{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-[var(--bv-divider)] pt-2 text-sm font-black text-[var(--bv-text)]">
                    <span>Total</span>
                    <span className="text-[var(--bv-gold)]">{formatMoney(totalEstimate.total)}</span>
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {needsVerification && (
                  <div className="rounded-lg border border-[var(--bv-border-gold)] bg-[var(--bv-gold-glow)] p-3 text-xs font-semibold text-[var(--bv-gold)]">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={13} /> Verified guests only
                    </span>
                    <span className="mt-1 block font-medium text-[var(--bv-text-muted)]">
                      This host accepts only identity-verified guests.{' '}
                      <button type="button" onClick={() => nav('/profile')} className="underline hover:text-[var(--bv-gold)]">
                        Complete your verification
                      </button>{' '}to book.
                    </span>
                  </div>
                )}
                {availState === AVAIL.IDLE && (
                  <button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={!checkIn || !checkOut}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--bv-border-gold)] px-4 py-3 text-sm font-black text-[var(--bv-gold)] transition hover:bg-[var(--bv-gold-glow)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight size={15} /> Check Availability
                  </button>
                )}
                {availState === AVAIL.CHECKING && (
                  <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--bv-border)] px-4 py-3 text-sm font-black text-[var(--bv-text-muted)]">
                    <Loader2 size={15} className="animate-spin text-[var(--bv-gold)]" /> Checking dates
                  </div>
                )}
                {availState === AVAIL.UNAVAILABLE && (
                  <>
                    <div className="rounded-lg border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.08)] p-3 text-sm font-semibold text-[var(--bv-danger)]">
                      These dates are not available.
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvailState(AVAIL.IDLE)}
                      className="w-full rounded-lg border border-[var(--bv-border-gold)] px-4 py-3 text-sm font-black text-[var(--bv-gold)] transition hover:bg-[var(--bv-gold-glow)]"
                    >
                      Change Dates
                    </button>
                  </>
                )}
                {availState === AVAIL.AVAILABLE && (
                  <>
                    <div className="rounded-lg border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.08)] p-3 text-sm font-semibold text-[var(--bv-success)]">
                      Great news, these dates are available.
                    </div>
                    <button
                      type="button"
                      onClick={proceedToBooking}
                      disabled={needsVerification}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--bv-gold)] px-4 py-3 text-sm font-black text-[var(--bv-text-inverse)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowRight size={15} /> Proceed to Booking
                    </button>
                  </>
                )}
              </div>

              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-[var(--bv-text-dim)]">
                <ShieldCheck size={13} className="text-[var(--bv-gold)]" />
                Verified hosts and secure payment
              </p>
            </div>
            ) : (
              <div className="rounded-2xl border border-[var(--bv-border-gold)] bg-[var(--bv-card)] p-6 shadow-[var(--bv-shadow-gold)] sticky top-24">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] mb-4">
                  <CalendarDays size={24} />
                </div>
                <h3 className="text-xl font-black text-[var(--bv-text)] mb-2">Ready to book?</h3>
                <p className="text-sm font-semibold leading-relaxed text-[var(--bv-text-muted)] mb-6">
                  To check availability, prices, and to make a booking, please select a specific room from our catalogue.
                </p>
                <button 
                  onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); nav(`/hotel/${property._id}/rooms`); }}
                  className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
                >
                  View All Rooms <ArrowRight size={16} />
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Mobile Sticky Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--bv-border)] bg-[var(--bv-card)]/95 px-4 py-3 shadow-[var(--bv-shadow-lg)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-[var(--bv-text-dim)]">From</p>
            <p className="text-lg font-black text-[var(--bv-text)]">
              {formatMoney(perNight)}
              <span className="ml-1 text-[11px] font-bold text-[var(--bv-text-dim)]">/ night</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => document.querySelector('aside')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="rounded-lg bg-[var(--bv-gold)] px-5 py-3 text-sm font-black text-[var(--bv-text-inverse)] transition hover:opacity-90"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;
