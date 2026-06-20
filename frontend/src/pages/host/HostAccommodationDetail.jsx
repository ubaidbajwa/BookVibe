import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  getSingleAccommodationById,
  resetAccommodationState,
} from '../../redux/slices/accommodationSlice';
import { getAuthConfig } from '../../utils/authConfig';
import {
  ArrowLeft,
  MapPin,
  Star,
  Edit3,
  Utensils,
  Pill,
  ImageOff,
  BedDouble,
  Users,
  Layers,
  Moon,
  Coffee,
  Tag,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  Loader2,
  Clock,
  ShieldCheck,
  DollarSign,
  PlusCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const Toggle = ({ on, fn, disabled }) => {
    return (
        <button
            onClick={fn}
            disabled={disabled}
            className={`w-9 h-5 rounded-full transition flex items-center px-0.5 disabled:opacity-50 ${
                on ? 'bg-[var(--bv-success)]' : 'bg-[var(--bv-surface)] border border-[var(--bv-border)]'
            }`}
        >
            <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    on ? 'translate-x-4' : ''
                }`}
            />
        </button>
    )
}

const HostAccommodationDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const { singleProperty: p, loading, error } = useSelector((s) => s.accommodations);

  const [actionLoading, setActionLoading] = useState(false);

  /** ID of the sub-unit staged for deletion, null when modal is closed. */
  const [unitToDelete, setUnitToDelete] = useState(null);

  useEffect(() => {
    if (id) dispatch(getSingleAccommodationById(id));
    return () => { dispatch(resetAccommodationState()); };
  }, [id, dispatch]);

  useEffect(() => {
    if (error) {
      dispatch(resetAccommodationState());
    }
  }, [error, dispatch]);

  const toggleSubUnit = async (unitId) => {
    try {
      setActionLoading(true);
      await axios.patch(`${BASE}/property/${id}/unit/${unitId}/toggle-availability`, {}, getAuthConfig());
      dispatch(getSingleAccommodationById(id));
    } catch {
      // error silently handled
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteSubUnit = async () => {
    if (!unitToDelete) return;
    try {
      setActionLoading(true);
      await axios.delete(`${BASE}/property/${id}/unit/${unitToDelete}`, getAuthConfig());
      setUnitToDelete(null);
      dispatch(getSingleAccommodationById(id));
    } catch {
      // error silently handled
    } finally {
      setActionLoading(false);
    }
  };

  // Show skeleton while loading OR while stale data from a different property is in
  // the store (happens when AddAccommodations/edit cleanup resets `loading` after our
  // thunk sets it to true, leaving the old singleProperty visible for a moment).
  if (loading || (p && p._id !== id)) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bv-skeleton h-[350px] rounded-2xl" />
        <div className="bv-skeleton h-8 w-1/2 rounded-lg" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--bv-text-muted)]">Property not found</p>
        <button onClick={() => nav(-1)} className="mt-4 text-[var(--bv-gold)] text-sm underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* delete room modal */}
      {unitToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !actionLoading && setUnitToDelete(null)}
        >
          <div
            className="w-full max-w-md bv-card-static p-6 bv-animate-in"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setUnitToDelete(null)}
              disabled={actionLoading}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition"
            >
              <X size={16} />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={26} className="text-[var(--bv-danger)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--bv-text)]">Delete this room?</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">
              This cannot be undone. Any room-specific images will be removed.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setUnitToDelete(null)}
                disabled={actionLoading}
                className="flex-1 bv-btn-outline py-3 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSubUnit}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {actionLoading ? 'Deleting...' : 'Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => nav(-1)}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm transition"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => nav(`/host/accommodations/edit/${p._id}`)}
          className="bv-btn-gold text-sm px-4 py-2 flex items-center gap-2"
        >
          <Edit3 size={14} /> Edit
        </button>
      </div>
      {p.images?.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {p.images.map((img, i) => {
            return (
              <div
                key={i}
                className={`rounded-xl overflow-hidden border border-[var(--bv-border)] ${
                  i === 0 ? 'col-span-2 row-span-2 h-[300px]' : 'h-[145px]'
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="w-full h-[300px] bg-[var(--bv-surface)] rounded-2xl flex items-center justify-center">
          <ImageOff size={48} className="text-[var(--bv-text-dim)]" />
        </div>
      )}


      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="bv-badge bv-badge-gold">{p.type}</span>
          {p.rating && (
            <span className="flex items-center gap-1 text-sm text-[var(--bv-gold)]">
              <Star size={14} fill="currentColor" /> {p.rating}
            </span>
          )}
          <span
            className={`bv-badge ${
              p.available ? 'bv-badge-green' : 'bv-badge-red'
            }`}
          >
            {p.available ? 'Active' : 'Hidden'}
          </span>
        </div>

        <h1 className="font-display text-3xl text-[var(--bv-text)]">{p.name}</h1>
        <p className="flex items-center gap-1.5 text-[var(--bv-text-muted)] text-sm mt-2">
          <MapPin size={14} /> {p.address}, {p.city}, {p.country}
        </p>
        <p className="text-2xl font-bold text-[var(--bv-gold)] mt-3">
          PKR {p.price?.toLocaleString()}{' '}
          <span className="text-sm text-[var(--bv-text-dim)] font-normal">/ night</span>
        </p>
      </div>

      {p.description && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Description
          </h3>
          <p className="text-[var(--bv-text-muted)] text-sm leading-relaxed">
            {p.description}
          </p>
        </div>
      )}

      {p.amenities?.length > 0 && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Amenities
          </h3>
          <div className="flex flex-wrap gap-2">
            {p.amenities.map((a, i) => {
              return (
                <span key={i} className="bv-badge bv-badge-gold">
                  {a}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {(p.pricing?.weekly || p.pricing?.monthly || p.stayTypes?.length > 0) && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Pricing
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)]">Nightly</p>
              <p className="text-lg font-black text-[var(--bv-gold)] mt-1">PKR {p.price?.toLocaleString()}</p>
            </div>
            {p.pricing?.weekly && (
              <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)]">Weekly</p>
                <p className="text-lg font-black text-[var(--bv-gold)] mt-1">PKR {p.pricing.weekly.toLocaleString()}</p>
                {p.pricing.weeklyDiscount > 0 && (
                  <p className="text-[9px] text-emerald-400 font-bold">{p.pricing.weeklyDiscount}% off</p>
                )}
              </div>
            )}
            {p.pricing?.monthly && (
              <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)]">Monthly</p>
                <p className="text-lg font-black text-[var(--bv-gold)] mt-1">PKR {p.pricing.monthly.toLocaleString()}</p>
                {p.pricing.monthlyDiscount > 0 && (
                  <p className="text-[9px] text-emerald-400 font-bold">{p.pricing.monthlyDiscount}% off</p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {p.stayTypes?.map(st => (
              <span key={st} className="bv-badge bv-badge-gold capitalize">{st}</span>
            ))}
            {p.minStay > 1 && (
              <span className="bv-badge bv-badge-amber">Min {p.minStay} nights</span>
            )}
          </div>
        </div>
      )}

      <div className="bv-card-static p-5">
        <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
          Policies
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)] flex items-center gap-1">
              <Clock size={9} /> Check-in
            </p>
            <p className="text-sm font-bold text-[var(--bv-text)] mt-1">{p.checkInTime || '14:00'}</p>
          </div>
          <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)] flex items-center gap-1">
              <Clock size={9} /> Check-out
            </p>
            <p className="text-sm font-bold text-[var(--bv-text)] mt-1">{p.checkOutTime || '11:00'}</p>
          </div>
          <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)] flex items-center gap-1">
              <ShieldCheck size={9} /> Cancellation
            </p>
            <p className="text-sm font-bold text-[var(--bv-text)] mt-1 capitalize">{p.cancellationPolicy || 'moderate'}</p>
          </div>
          <div className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)] flex items-center gap-1">
              <DollarSign size={9} /> Deposit
            </p>
            <p className="text-sm font-bold text-[var(--bv-text)] mt-1">
              {p.damagePolicy?.depositRequired
                ? `PKR ${p.damagePolicy.depositAmount?.toLocaleString()}`
                : 'None'}
            </p>
          </div>
        </div>
        {p.houseRules && (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--bv-text-dim)]">
            <span className="flex items-center gap-1">
              {p.houseRules.smokingAllowed ? <CheckCircle size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-red-400" />}
              Smoking
            </span>
            <span className="flex items-center gap-1">
              {p.houseRules.petsAllowed ? <CheckCircle size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-red-400" />}
              Pets
            </span>
            <span className="flex items-center gap-1">
              {p.houseRules.partiesAllowed ? <CheckCircle size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-red-400" />}
              Parties
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} /> Max {p.houseRules.maxGuests} guests
            </span>
            {p.houseRules.quietHoursStart && (
              <span className="flex items-center gap-1">
                <Moon size={11} /> Quiet {p.houseRules.quietHoursStart}–{p.houseRules.quietHoursEnd}
              </span>
            )}
          </div>
        )}
      </div>

      {(p.foodServices?.available || p.medicalServices?.available) && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Services
          </h3>
          <div className="flex flex-wrap gap-4">
            {p.foodServices?.available && (
              <div className="flex items-start gap-3">
                <Utensils size={16} className="text-[var(--bv-success)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--bv-text)]">{p.foodServices.title || 'Homemade Food'}</p>
                  {p.foodServices.price > 0 && (
                    <p className="text-xs text-[var(--bv-text-dim)]">PKR {p.foodServices.price.toLocaleString()} / meal</p>
                  )}
                </div>
              </div>
            )}
            {p.medicalServices?.available && (
              <div className="flex items-start gap-3">
                <Pill size={16} className="text-[var(--bv-info)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--bv-text)]">{p.medicalServices.title || 'Medical Service'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {p.subUnits?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BedDouble size={20} className="text-[var(--bv-gold)]" />
              <h3 className="text-lg font-bold text-[var(--bv-text)]">
                Rooms & Units ({p.subUnits.length})
              </h3>
            </div>
            <button
              onClick={() => nav(`/host/accommodations/edit/${p._id}`)}
              className="bv-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
            >
              <PlusCircle size={13} /> Add Room
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {p.subUnits.map((unit, index) => {
              const UNIT_ICONS = {
                Single: Moon, Double: BedDouble, Suite: Star,
                'Dorm Bed': Users, Office: Coffee, Shop: Tag,
              };
              const UnitIcon = UNIT_ICONS[unit.unitType] || BedDouble;

              return (
                <div key={unit._id || index} className="bv-card p-4 flex flex-col md:flex-row gap-5 items-start">
                  <div className="w-full md:w-36 h-28 flex-shrink-0 relative overflow-hidden rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
                    {unit.images?.[0]?.url ? (
                      <img src={unit.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={20} className="text-[var(--bv-text-dim)] opacity-30" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="bv-badge-gold text-[8px] px-1.5 py-0.5">{unit.unitType}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[var(--bv-text)]">
                        {unit.roomNo && <span className="text-[var(--bv-gold)] mr-2">#{unit.roomNo}</span>}
                        {unit.name}
                      </h4>
                      <div className="text-right">
                        <span className="text-lg font-black text-[var(--bv-gold)]">PKR {unit.basePrice?.toLocaleString()}</span>
                        <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase tracking-wider">/ night</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--bv-text-dim)]">
                        <Layers size={10} /> {unit.floor} Floor
                      </span>
                      {unit.block && unit.block !== 'None' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--bv-text-dim)]">
                          <MapPin size={10} /> {unit.block}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--bv-text-dim)]">
                        <Users size={10} /> {unit.capacity} Guests
                      </span>
                    </div>

                    <p className="text-xs text-[var(--bv-text-muted)] line-clamp-2 mt-2 leading-relaxed">
                      {unit.description || 'No description provided for this room.'}
                    </p>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--bv-divider)]">
                      <div className="flex gap-2">
                        {unit.stayTypes?.map(st => (
                          <span key={st} className="text-[9px] font-black uppercase tracking-widest bg-[var(--bv-surface)] border border-[var(--bv-border)] text-[var(--bv-gold)] px-2 py-0.5 rounded">
                            {st}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-[var(--bv-border)]">
                          <span className="text-[10px] font-bold text-[var(--bv-text-dim)]">
                            {unit.available ? 'Active' : 'Hidden'}
                          </span>
                          <Toggle
                            on={unit.available}
                            fn={() => toggleSubUnit(unit._id)}
                            disabled={actionLoading}
                          />
                        </div>
                        <button
                          onClick={() => nav(`/property/${p.type?.toLowerCase()}/${p._id}?room=${unit._id}`)}
                          className="bv-btn-outline text-[10px] px-2 py-1.5 flex items-center gap-1"
                          title="Preview public listing"
                        >
                          <Eye size={12} /> Preview
                        </button>
                        <button
                          onClick={() => nav(`/host/accommodations/edit/${p._id}`)}
                          className="bv-btn-outline text-[10px] px-2 py-1.5 flex items-center gap-1"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setUnitToDelete(unit._id)}
                          disabled={actionLoading}
                          className="bv-btn-outline text-[10px] px-2 py-1.5 text-rose-400 border-rose-500/20 hover:bg-rose-500/10 flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostAccommodationDetail;
