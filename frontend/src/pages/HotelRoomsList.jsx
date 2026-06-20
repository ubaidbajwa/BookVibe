import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MapPin, Users, Building2, Star, Moon, Coffee, Tag, BedDouble, ArrowRight, ImageOff } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const formatMoney = v => `PKR ${(Number(v) || 0).toLocaleString()}`;

const HotelRoomsList = () => {
    const { id } = useParams();
    const nav = useNavigate();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${BASE}/property/${id}`)
            .then(res => setProperty(res.data.property))
            .catch(() => { /* property stays null → "Hotel not found" is shown */ })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
      <div className="min-h-screen pt-32 text-center text-[var(--bv-text-dim)]">
        <div className="bv-skeleton h-[200px] max-w-[800px] mx-auto rounded-2xl mb-4" />
        <div className="bv-skeleton h-[200px] max-w-[800px] mx-auto rounded-2xl mb-4" />
      </div>
    );
    
    if (!property) return <div className="min-h-screen pt-32 text-center text-[var(--bv-text)] font-bold">Hotel not found</div>;

    const activeUnits = property.subUnits?.filter(u => u.available) || [];

    return (
        <div className="min-h-screen bg-[var(--bv-bg)] pb-24 pt-20 text-[var(--bv-text)]">
            <div className="mx-auto max-w-[860px] px-4 sm:px-6">
                
                <button 
                  onClick={() => nav(`/property/${property.type.toLowerCase()}/${property._id}`)} 
                  className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--bv-text-dim)] transition hover:text-[var(--bv-gold)]"
                >
                    <ArrowLeft size={14} /> Back to {property.name} overview
                </button>
                
                <div className="mb-10">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">Available Accommodations</p>
                    <h1 className="font-display text-4xl sm:text-5xl text-[var(--bv-text)]">Rooms at {property.name}</h1>
                    <p className="mt-3 text-sm font-semibold text-[var(--bv-text-muted)] flex items-center gap-1.5">
                      <MapPin size={14} className="text-[var(--bv-gold)]"/> {property.address}, {property.city}
                    </p>
                </div>
                
                <div className="flex flex-col gap-6">
                    {activeUnits.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-[var(--bv-border)] rounded-2xl">
                          <BedDouble size={32} className="mx-auto text-[var(--bv-text-dim)] mb-4 opacity-50" />
                          <p className="text-[var(--bv-text-dim)] font-semibold">No rooms are currently available for booking.</p>
                        </div>
                    ) : activeUnits.map(unit => {
                        return (
                            <div 
                              key={unit._id} 
                              onClick={() => nav(`/property/${property.type.toLowerCase()}/${property._id}?room=${unit._id}`)} 
                              className="group cursor-pointer flex flex-col sm:flex-row gap-6 rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-card)] p-5 transition hover:border-[var(--bv-border-gold)] hover:bg-[var(--bv-surface)] shadow-sm hover:shadow-[var(--bv-shadow-gold)]"
                            >
                                {/* Thumbnail */}
                                <div className="w-full sm:w-64 h-48 shrink-0 relative rounded-xl overflow-hidden bg-[var(--bv-surface)]">
                                    {unit.images?.[0]?.url ? (
                                      <img src={unit.images[0].url} alt={unit.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-[var(--bv-text-dim)]">
                                        <ImageOff size={28} />
                                      </div>
                                    )}
                                    <div className="absolute top-3 left-3">
                                      <span className="bv-badge-gold shadow-md text-[9px] px-2.5 py-1">{unit.unitType}</span>
                                    </div>
                                </div>
                                
                                {/* Details */}
                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                    <div>
                                        <div className="flex items-start justify-between gap-4">
                                            <h4 className="text-2xl font-black text-[var(--bv-text)] truncate group-hover:text-[var(--bv-gold)] transition">
                                              {unit.roomNo && <span className="text-[var(--bv-gold)] mr-2">#{unit.roomNo}</span>}
                                              {unit.name}
                                            </h4>
                                            <div className="text-right shrink-0">
                                              <span className="text-xl font-black text-[var(--bv-gold)]">{formatMoney(unit.basePrice)}</span>
                                              <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase tracking-wider">/ night</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--bv-text-dim)]">
                                              <Building2 size={13} /> {unit.floor} Floor
                                            </span>
                                            {unit.block && unit.block !== 'None' && (
                                              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--bv-text-dim)]">
                                                <MapPin size={13} /> {unit.block}
                                              </span>
                                            )}
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--bv-text-dim)]">
                                              <Users size={13} /> {unit.capacity} Guests
                                            </span>
                                        </div>
                                        
                                        <p className="mt-4 text-sm leading-relaxed text-[var(--bv-text-muted)] line-clamp-2">
                                          {unit.description || 'No specific description provided for this room.'}
                                        </p>
                                    </div>
                                    
                                    <div className="flex justify-end mt-5 pt-4 border-t border-[var(--bv-divider)]">
                                        <button className="bv-btn-gold text-xs px-6 py-2.5 flex items-center gap-2">
                                          View Room Details <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HotelRoomsList;
