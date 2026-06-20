/**
 * @file AddAccommodations.jsx
 * @description Host flow for choosing a listing type and adding/editing property details.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Clock,
  ConciergeBell,
  CreditCard,
  Home,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Moon,
  PawPrint,
  PartyPopper,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import LocationPickerMap from '../../components/LocationPickerMap';
import {
  addNewAccommodation,
  getSingleAccommodationById,
  resetAccommodationState,
  updateProperty,
} from '../../redux/slices/accommodationSlice';

const SINGLE_TYPES = ['Room', 'Apartment', 'House', 'Guest House'];
const MULTI_TYPES = ['Hotel', 'Hostel', 'Plaza'];
const ALL_TYPES = [...SINGLE_TYPES, ...MULTI_TYPES];
const UNIT_TYPES = ['Entire Home', 'Single', 'Double', 'Suite', 'Dorm Bed', 'Office', 'Shop'];
const ROOM_FLOORS = ['Basement', 'Ground', '1st', '2nd', '3rd', '4th', '5th+'];
const ROOM_BLOCKS = ['None', 'Block A', 'Block B', 'Block C', 'Block D', 'Main Wing', 'East Wing', 'West Wing', 'Female Wing', 'Male Wing'];
const BILLING_TYPES = [
  { label: 'Per Night', value: 'per_night' },
  { label: 'Per Stay', value: 'per_stay' },
  { label: 'Per Person', value: 'per_person' },
  { label: 'Per Item', value: 'per_item' },
];

const STAY_TYPES = [
  { value: 'nightly', title: 'Per Night', hint: 'Short stays', icon: Moon },
  { value: 'weekly', title: 'Weekly', hint: '7+ nights', icon: CalendarDays },
  { value: 'monthly', title: 'Monthly', hint: '30+ nights', icon: CalendarDays },
];

// Platform-wide cancellation policy (same for every property — not host-configurable).
const CANCELLATION_PHASES = [
  { title: 'Within 24 hours', hint: '100% refund — full money back' },
  { title: 'Within 4 days', hint: '85% refund — 15% cancellation fee' },
  { title: 'After 4 days', hint: '70% refund — 30% cancellation fee' },
];

const PRESET_AMENITIES = [
  'WiFi', 'AC', 'Parking', 'Kitchen', 'TV', 'Hot Water', 'Geyser',
  'Generator Backup', 'Security Guard', 'CCTV', 'Laundry', 'Gym',
  'Swimming Pool', 'Elevator', 'Pet Friendly', 'Smoke Alarm',
];

const timeLabel = value => {
  if (!value) return '';
  const [hours, minutes = '00'] = value.split(':');
  const h = Number(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${minutes} ${suffix}`;
};

const Section = ({ title, icon: Icon, children }) => (
  <section className="rounded-2xl border border-white/8 bg-[#1c1c21] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-7">
    <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[#d3af4b]">
      {Icon && <Icon size={16} />}
      {title}
    </h2>
    {children}
  </section>
);

const Label = ({ children }) => (
  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-[#8d8a83]">
    {children}
  </label>
);

const inputClass = 'w-full rounded-xl border border-white/8 bg-[#121215] px-4 py-3 text-sm font-semibold text-[#f3eee6] outline-none transition placeholder:text-[#6f6c66] focus:border-[#d3af4b] focus:ring-2 focus:ring-[#d3af4b]/15';
const checkCardClass = 'flex min-h-[58px] items-center gap-3 rounded-xl border border-white/8 bg-[#151519] px-4 py-3 text-sm font-bold text-[#f3eee6] transition hover:border-[#d3af4b]/40';

const AddAccommodations = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const { loading, success, message, singleProperty } = useSelector(s => s.accommodations);

  const [listingType, setListingType] = useState(isEdit ? 'single' : null);
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    accommodationType: 'Room',
    city: 'Lahore',
    country: 'Pakistan',
    address: '',
    latitude: '',
    longitude: '',
    description: '',
  });
  const [pricing, setPricing] = useState({
    price: '5000',
    weeklyPrice: '',
    monthlyPrice: '',
    stayTypes: ['nightly'],
    minStay: 1,
    maxStay: 365,
  });
  const [times, setTimes] = useState({
    checkInTime: '14:00',
    checkOutTime: '11:00',
    flexibleCheckIn: false,
  });
  const [rules, setRules] = useState({
    smokingAllowed: false,
    petsAllowed: false,
    partiesAllowed: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    maxGuests: 2,
    customRules: [],
  });
  const [policy, setPolicy] = useState({
    depositRequired: false,
    depositAmount: '',
    damageRules: '',
    onlyVerifiedGuests: false,
  });
  const [services, setServices] = useState({
    homemadeFood: false,
    foodTitle: 'Homemade Food',
    foodDescription: '',
    foodPrice: '',
    medicalService: false,
    medicalTitle: 'Medical Assistance',
    medicalDescription: '',
  });
  const [subUnits, setSubUnits] = useState([]);
  // Each item: { type: 'existing', url, public_id } | { type: 'new', url (objectURL), file }
  const [imageItems, setImageItems] = useState([]);
  // { unitIndex: [{ type: 'existing'|'new', url, public_id?, file? }] }
  const [subUnitImageItems, setSubUnitImageItems] = useState({});
  const [addOnServices, setAddOnServices] = useState([]);
  const [amenities, setAmenities] = useState(['WiFi', 'AC', 'Parking', 'Kitchen']);
  const [customAmenity, setCustomAmenity] = useState('');

  // Reset stale success/error so returning to this page doesn't redirect immediately
  useEffect(() => {
    dispatch(resetAccommodationState());
    return () => { dispatch(resetAccommodationState()); };
  }, [dispatch]);

  useEffect(() => {
    if (isEdit && id) dispatch(getSingleAccommodationById(id));
  }, [isEdit, id, dispatch]);

  useEffect(() => {
    if (!isEdit || !singleProperty) return;

    const type = singleProperty.type || 'Room';
    setListingType(MULTI_TYPES.includes(type) ? 'multi' : 'single');
    setBasicInfo({
      name: singleProperty.name || '',
      accommodationType: type,
      city: singleProperty.city || 'Lahore',
      country: singleProperty.country || 'Pakistan',
      address: singleProperty.address || '',
      latitude: singleProperty.coordinates?.lat || '',
      longitude: singleProperty.coordinates?.lng || '',
      description: singleProperty.description || '',
    });
    setPricing({
      price: singleProperty.price || '',
      weeklyPrice: singleProperty.pricing?.weekly || '',
      monthlyPrice: singleProperty.pricing?.monthly || '',
      stayTypes: singleProperty.stayTypes || ['nightly'],
      minStay: singleProperty.minStay || 1,
      maxStay: singleProperty.maxStay || 365,
    });
    setTimes({
      checkInTime: singleProperty.checkInTime || '14:00',
      checkOutTime: singleProperty.checkOutTime || '11:00',
      flexibleCheckIn: Boolean(singleProperty.flexibleCheckIn),
    });
    setRules(singleProperty.houseRules || {
      smokingAllowed: false,
      petsAllowed: false,
      partiesAllowed: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      maxGuests: 2,
      customRules: [],
    });
    setPolicy({
      depositRequired: singleProperty.damagePolicy?.depositRequired || false,
      depositAmount: singleProperty.damagePolicy?.depositAmount || '',
      damageRules: singleProperty.damagePolicy?.damageRules || '',
      onlyVerifiedGuests: Boolean(singleProperty.onlyVerifiedGuests),
    });
    setServices({
      homemadeFood: Boolean(singleProperty.foodServices?.available),
      foodTitle: singleProperty.foodServices?.title || 'Homemade Food',
      foodDescription: singleProperty.foodServices?.description || '',
      foodPrice: singleProperty.foodServices?.price || '',
      medicalService: Boolean(singleProperty.medicalServices?.available),
      medicalTitle: singleProperty.medicalServices?.title || 'Medical Assistance',
      medicalDescription: singleProperty.medicalServices?.description || '',
    });
    setAmenities(singleProperty.amenities || []);
    setSubUnits(singleProperty.subUnits || []);
    setAddOnServices(singleProperty.addOnServices || []);

    // Load existing main images as tracked items
    setImageItems(
      (singleProperty.images || []).map(img => ({
        type: 'existing',
        url: img.url,
        public_id: img.public_id,
      }))
    );

    // Load existing sub-unit images as tracked items keyed by unit index
    const unitItems = {};
    (singleProperty.subUnits || []).forEach((unit, i) => {
      unitItems[i] = (unit.images || []).map(img => ({
        type: 'existing',
        url: img.url,
        public_id: img.public_id,
      }));
    });
    setSubUnitImageItems(unitItems);
  }, [isEdit, singleProperty]);

  useEffect(() => {
    if (success) {
      nav('/host/accommodations');
    }
  }, [success, message, nav]);

  useEffect(() => {
    if (isEdit && singleProperty && subUnits.length > 0) {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#room-')) {
        setTimeout(() => {
          const el = document.getElementById(hash.substring(1));
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a brief highlight effect
            el.style.transition = 'box-shadow 0.5s';
            el.style.boxShadow = '0 0 0 2px var(--bv-gold)';
            setTimeout(() => { el.style.boxShadow = 'none'; }, 2000);
          }
        }, 500); // small delay to ensure DOM is ready
      }
    }
  }, [isEdit, singleProperty, subUnits.length]);

  const stayTypeSet = useMemo(() => new Set(pricing.stayTypes), [pricing.stayTypes]);
  const isMulti = listingType === 'multi';
  const visibleTypes = isMulti ? MULTI_TYPES : SINGLE_TYPES;
  const remainingImages = Math.max(0, 4 - imageItems.length);

  const chooseType = type => {
    setListingType(type);
    setBasicInfo(current => ({
      ...current,
      accommodationType: type === 'multi' ? 'Hotel' : 'Room',
    }));
  };

  const toggleStayType = value => {
    const next = pricing.stayTypes.includes(value)
      ? pricing.stayTypes.filter(item => item !== value)
      : [...pricing.stayTypes, value];

    setPricing({ ...pricing, stayTypes: next.length ? next : ['nightly'] });
  };

  const addSubUnit = () => {
    setSubUnits(prev => [...prev, {
      roomNo: '',
      name: '',
      unitType: 'Single',
      basePrice: '',
      pricing: { weekly: '', monthly: '' },
      stayTypes: ['nightly'],
      capacity: 1,
      description: '',
      floor: 'Ground',
      block: 'None',
      amenities: [],
    }]);
  };

  const removeSubUnit = (removeIndex) => {
    setSubUnits(prev => prev.filter((_, i) => i !== removeIndex));
    // Re-index sub-unit image items so they match the new subUnits array positions
    setSubUnitImageItems(prev => {
      const next = {};
      Object.keys(prev).map(Number).sort((a, b) => a - b).forEach(k => {
        if (k === removeIndex) return;
        next[k < removeIndex ? k : k - 1] = prev[k];
      });
      return next;
    });
  };

  const toggleUnitStayType = (index, value) => {
    const unit = subUnits[index];
    const next = unit.stayTypes.includes(value)
      ? unit.stayTypes.filter(item => item !== value)
      : [...unit.stayTypes, value];
    
    updateSubUnit(index, 'stayTypes', next.length ? next : ['nightly']);
  };

  const updateSubUnit = (index, field, value) => {
    setSubUnits(subUnits.map((unit, i) => (i === index ? { ...unit, [field]: value } : unit)));
  };

  const addService = () => {
    setAddOnServices([...addOnServices, { serviceName: '', price: '', billingType: 'per_stay' }]);
  };

  const updateService = (index, field, value) => {
    setAddOnServices(addOnServices.map((service, i) => (i === index ? { ...service, [field]: value } : service)));
  };

  const toggleAmenity = amenity => {
    setAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const addCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (trimmed && !amenities.includes(trimmed)) {
      setAmenities(prev => [...prev, trimmed]);
      setCustomAmenity('');
    }
  };

  const handleImageChange = event => {
    const files = Array.from(event.target.files || []);
    const slots = Math.max(0, 6 - imageItems.length);
    const selected = files.slice(0, slots);
    setImageItems(prev => [
      ...prev,
      ...selected.map(file => ({ type: 'new', url: URL.createObjectURL(file), file })),
    ]);
    event.target.value = '';
  };

  const removeImage = index => {
    setImageItems(prev => prev.filter((_, i) => i !== index));
  };

  const addSubUnitImage = (unitIndex, files) => {
    const slots = 3 - (subUnitImageItems[unitIndex] || []).length;
    const selected = files.slice(0, slots);
    setSubUnitImageItems(prev => ({
      ...prev,
      [unitIndex]: [
        ...(prev[unitIndex] || []),
        ...selected.map(file => ({ type: 'new', url: URL.createObjectURL(file), file })),
      ],
    }));
  };

  const removeSubUnitImage = (unitIndex, imgIndex) => {
    setSubUnitImageItems(prev => ({
      ...prev,
      [unitIndex]: (prev[unitIndex] || []).filter((_, i) => i !== imgIndex),
    }));
  };

  const handleSubmit = event => {
    event.preventDefault();

    if (!isEdit && imageItems.length < 4) {
      return;
    }

    const fd = new FormData();
    Object.entries(basicInfo).forEach(([key, value]) => fd.append(key, value));
    Object.entries(pricing).forEach(([key, value]) => {
      fd.append(key, key === 'stayTypes' ? JSON.stringify(value) : value);
    });
    Object.entries(times).forEach(([key, value]) => fd.append(key, value));
    Object.entries(rules).forEach(([key, value]) => {
      if (key === 'customRules') {
        const cleaned = (value || []).map(r => r.trim()).filter(Boolean);
        fd.append(key, JSON.stringify(cleaned));
      } else {
        fd.append(key, value);
      }
    });
    Object.entries(policy).forEach(([key, value]) => fd.append(key, value));
    fd.append('listingType', listingType);
    fd.append('amenities', JSON.stringify(amenities));
    fd.append('addOnServices', JSON.stringify(addOnServices));
    fd.append('foodServices', JSON.stringify({
      available: !isMulti && services.homemadeFood,
      title: services.foodTitle,
      description: services.foodDescription,
      price: services.foodPrice,
    }));
    fd.append('medicalServices', JSON.stringify({
      available: services.medicalService,
      title: services.medicalTitle,
      description: services.medicalDescription,
    }));

    // Sub-units: embed only the kept existing images; new file uploads go separately
    if (isMulti) {
      const updatedSubUnits = subUnits.map((unit, i) => ({
        ...unit,
        images: (subUnitImageItems[i] || [])
          .filter(item => item.type === 'existing')
          .map(({ url, public_id }) => ({ url, public_id })),
      }));
      fd.append('subUnits', JSON.stringify(updatedSubUnits));
      updatedSubUnits.forEach((_, i) => {
        (subUnitImageItems[i] || [])
          .filter(item => item.type === 'new')
          .forEach(item => fd.append(`subunit_images_${i}`, item.file));
      });
    } else {
      fd.append('subUnits', JSON.stringify([]));
    }

    // Main images: tell backend which existing ones to keep, then upload the new files
    fd.append(
      'existingImages',
      JSON.stringify(
        imageItems
          .filter(item => item.type === 'existing')
          .map(({ url, public_id }) => ({ url, public_id }))
      )
    );
    imageItems
      .filter(item => item.type === 'new')
      .forEach(item => fd.append('images', item.file));

    if (isEdit) {
      dispatch(updateProperty({ id, formData: fd }));
    } else {
      dispatch(addNewAccommodation(fd));
    }
  };

  if (!listingType && !isEdit) {
    return (
      <div className="mx-auto max-w-[940px] px-4 py-14 text-[#f3eee6]">
        <div className="mb-12 text-center">
          <h1 className="font-display text-4xl leading-tight text-[#f7ead0]">What Would You Like To List?</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base font-semibold text-[#8d8a83]">
            Tell us what you are offering so we can make your onboarding process easier.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseType('single')}
            className="group rounded-2xl border border-white/8 bg-[#1c1c21] p-8 text-left shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition hover:border-[#d3af4b]/70 hover:bg-[#221f1d]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d3af4b]/12 text-[#d3af4b] transition group-hover:scale-105">
              <Home size={26} />
            </div>
            <h2 className="text-2xl font-black text-[#f7ead0]">A Single Space</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#8d8a83]">
              List one room, apartment, house, or guest house with one shared availability calendar.
            </p>
          </button>

          <button
            type="button"
            onClick={() => chooseType('multi')}
            className="group rounded-2xl border border-white/8 bg-[#1c1c21] p-8 text-left shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition hover:border-[#d3af4b]/70 hover:bg-[#221f1d]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d3af4b]/12 text-[#d3af4b] transition group-hover:scale-105">
              <Building2 size={26} />
            </div>
            <h2 className="text-2xl font-black text-[#f7ead0]">Multi-Unit Property</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#8d8a83]">
              List a hotel, hostel, plaza, or building with multiple rooms, beds, shops, or offices.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] pb-16 text-[#f3eee6]">
      <div className="mb-7 flex items-start gap-4">
        <button
          type="button"
          onClick={() => (isEdit ? nav(-1) : setListingType(null))}
          className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8d8a83] transition hover:bg-[#1c1c21] hover:text-[#d3af4b]"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-3xl leading-tight text-[#f7ead0]">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#8d8a83]">
            {isMulti ? 'Create a multi-unit listing' : 'Create a single-space listing'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Basic Info" icon={Home}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Property Name *</Label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="e.g. Mountain View Suite"
                value={basicInfo.name}
                onChange={event => setBasicInfo({ ...basicInfo, name: event.target.value })}
              />
            </div>
            <div>
              <Label>Type *</Label>
              <select
                className={inputClass}
                value={basicInfo.accommodationType}
                onChange={event => setBasicInfo({ ...basicInfo, accommodationType: event.target.value })}
              >
                {visibleTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <Label>City *</Label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="e.g. Lahore"
                value={basicInfo.city}
                onChange={event => setBasicInfo({ ...basicInfo, city: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description *</Label>
              <textarea
                required
                className={`${inputClass} min-h-[105px] resize-y`}
                placeholder={`Describe your ${isMulti ? 'establishment (hotel/hostel)' : 'property'}...`}
                value={basicInfo.description}
                onChange={event => setBasicInfo({ ...basicInfo, description: event.target.value })}
              />
            </div>
          </div>
        </Section>

        {!isMulti && (
          <Section title="Pricing & Stay Duration" icon={CreditCard}>
            <div>
              <Label>Available Stay Types *</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {STAY_TYPES.map(item => {
                  const Icon = item.icon;
                  const selected = stayTypeSet.has(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleStayType(item.value)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-[#d3af4b] bg-[#3a3321] text-[#d3af4b]'
                          : 'border-white/8 bg-[#18181d] text-[#8d8a83] hover:border-[#d3af4b]/35'
                      }`}
                    >
                      <Icon size={18} className="mb-4" />
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="mt-1 text-[11px] font-semibold opacity-75">{item.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <Label>Per Night (PKR) *</Label>
                <input type="number" required className={inputClass} value={pricing.price} onChange={event => setPricing({ ...pricing, price: event.target.value })} />
              </div>
              {stayTypeSet.has('weekly') && (
                <div>
                  <Label>Weekly Price (PKR)</Label>
                  <input type="number" className={inputClass} value={pricing.weeklyPrice} onChange={event => setPricing({ ...pricing, weeklyPrice: event.target.value })} />
                </div>
              )}
              {stayTypeSet.has('monthly') && (
                <div>
                  <Label>Monthly Price (PKR)</Label>
                  <input type="number" className={inputClass} value={pricing.monthlyPrice} onChange={event => setPricing({ ...pricing, monthlyPrice: event.target.value })} />
                </div>
              )}
              <div>
                <Label>Min Stay (Nights)</Label>
                <input type="number" min="1" className={inputClass} value={pricing.minStay} onChange={event => setPricing({ ...pricing, minStay: event.target.value })} />
              </div>
              <div>
                <Label>Max Stay (Nights)</Label>
                <input type="number" min="1" className={inputClass} value={pricing.maxStay} onChange={event => setPricing({ ...pricing, maxStay: event.target.value })} />
              </div>
            </div>
          </Section>
        )}

        <Section title="Check-in & Check-out Times" icon={Clock}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>Check-in Time</Label>
              <input type="time" className={inputClass} value={times.checkInTime} onChange={event => setTimes({ ...times, checkInTime: event.target.value })} />
            </div>
            <div>
              <Label>Check-out Time</Label>
              <input type="time" className={inputClass} value={times.checkOutTime} onChange={event => setTimes({ ...times, checkOutTime: event.target.value })} />
            </div>
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm font-bold text-[#f3eee6]">
            <input type="checkbox" checked={times.flexibleCheckIn} onChange={event => setTimes({ ...times, flexibleCheckIn: event.target.checked })} className="h-4 w-4 accent-[#d3af4b]" />
            Flexible check-in (early/late allowed on request)
          </label>
          <div className="mt-5 rounded-xl bg-[#101013] px-4 py-3 text-xs font-semibold text-[#8d8a83]">
            Guests will see: Check-in {timeLabel(times.checkInTime)}, Check-out {timeLabel(times.checkOutTime)}
          </div>
        </Section>

        {isMulti && (
          <Section title={`Rooms & Units${subUnits.length > 0 ? ` (${subUnits.length})` : ''}`} icon={BedDouble}>
            <p className="mb-4 text-xs font-semibold text-[#8d8a83]">
              Add each room separately. Guests will see these as individual booking options under your {basicInfo.accommodationType}.
            </p>
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={addSubUnit} className="inline-flex items-center gap-2 rounded-xl border border-[#d3af4b]/35 px-4 py-2 text-xs font-black text-[#d3af4b] transition hover:bg-[#d3af4b]/8">
                <Plus size={14} /> Add Room
              </button>
            </div>
            {subUnits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#151519] p-8 text-center">
                <BedDouble size={28} className="mx-auto mb-3 text-[#3a3832]" />
                <p className="text-sm font-bold text-[#8d8a83]">No rooms added yet</p>
                <p className="mt-1 text-xs text-[#5a5852]">Add single rooms, suites, dorm beds, or shops.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {subUnits.map((unit, index) => (
                  <div key={index} id={`room-${unit._id || index}`} className="rounded-xl border border-white/8 bg-[#151519] p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#d3af4b]">Room #{index + 1}</h3>
                      <button type="button" onClick={() => removeSubUnit(index)} className="text-rose-400 hover:text-rose-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label>Room No / Name *</Label>
                        <input className={inputClass} placeholder="e.g. 101 or Deluxe" value={unit.roomNo} onChange={event => updateSubUnit(index, 'roomNo', event.target.value)} />
                      </div>
                      <div>
                        <Label>Display Title *</Label>
                        <input className={inputClass} placeholder="e.g. Luxury Double Room" value={unit.name} onChange={event => updateSubUnit(index, 'name', event.target.value)} />
                      </div>
                      <div>
                        <Label>Unit Type *</Label>
                        <select className={inputClass} value={unit.unitType} onChange={event => updateSubUnit(index, 'unitType', event.target.value)}>
                          {UNIT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Nightly Price (PKR) *</Label>
                        <input className={inputClass} type="number" placeholder="per night" value={unit.basePrice} onChange={event => updateSubUnit(index, 'basePrice', event.target.value)} />
                      </div>
                      <div>
                        <Label>Capacity *</Label>
                        <input className={inputClass} type="number" min="1" placeholder="Guests" value={unit.capacity} onChange={event => updateSubUnit(index, 'capacity', event.target.value)} />
                      </div>
                    </div>

                    <div className="mt-4 border-t border-white/5 pt-4">
                      <Label>Stay Durations & Pricing</Label>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 text-[10px] font-bold text-[#8d8a83]">
                            <input type="checkbox" checked={unit.stayTypes.includes('weekly')} onChange={() => toggleUnitStayType(index, 'weekly')} className="accent-[#d3af4b]" />
                            Allow Weekly Stays
                          </label>
                          {unit.stayTypes.includes('weekly') && (
                            <input className={`${inputClass} text-xs`} type="number" placeholder="Weekly Rate (PKR)" value={unit.pricing?.weekly || ''} onChange={e => updateSubUnit(index, 'pricing', { ...unit.pricing, weekly: e.target.value })} />
                          )}
                        </div>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 text-[10px] font-bold text-[#8d8a83]">
                            <input type="checkbox" checked={unit.stayTypes.includes('monthly')} onChange={() => toggleUnitStayType(index, 'monthly')} className="accent-[#d3af4b]" />
                            Allow Monthly Stays
                          </label>
                          {unit.stayTypes.includes('monthly') && (
                            <input className={`${inputClass} text-xs`} type="number" placeholder="Monthly Rate (PKR)" value={unit.pricing?.monthly || ''} onChange={e => updateSubUnit(index, 'pricing', { ...unit.pricing, monthly: e.target.value })} />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Floor</Label>
                            <select className={`${inputClass} text-xs`} value={unit.floor} onChange={event => updateSubUnit(index, 'floor', event.target.value)}>
                              {ROOM_FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label>Block</Label>
                            <select className={`${inputClass} text-xs`} value={unit.block} onChange={event => updateSubUnit(index, 'block', event.target.value)}>
                              {ROOM_BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Label>Room Description</Label>
                      <textarea
                        className={`${inputClass} min-h-[80px] text-xs resize-y`}
                        placeholder="Describe specific features of this room (e.g. balcony, mountain view, attached bath)..."
                        value={unit.description || ''}
                        onChange={event => updateSubUnit(index, 'description', event.target.value)}
                      />
                    </div>

                    <div className="mt-4">
                      <Label>Room-Specific Amenities</Label>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_AMENITIES.map(amenity => {
                          const selected = (unit.amenities || []).includes(amenity);
                          return (
                            <button
                              key={amenity}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? unit.amenities.filter(a => a !== amenity)
                                  : [...(unit.amenities || []), amenity];
                                updateSubUnit(index, 'amenities', next);
                              }}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                                selected
                                  ? 'border-[#d3af4b] bg-[#3a3321] text-[#d3af4b]'
                                  : 'border-white/5 bg-[#121215] text-[#6f6c66] hover:border-[#d3af4b]/20'
                              }`}
                            >
                              {amenity}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 border-t border-white/5 pt-4">
                      <Label>Room Images (Max 3)</Label>
                      <div className="flex flex-wrap gap-3">
                        {(subUnitImageItems[index] || []).map((item, i) => (
                          <div key={i} className="relative h-16 w-24 overflow-hidden rounded-lg border border-white/10">
                            <img src={item.url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeSubUnitImage(index, i)}
                              className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white hover:bg-black"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        {(subUnitImageItems[index] || []).length < 3 && (
                          <label className="flex h-16 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#101013] text-[#d3af4b] hover:border-[#d3af4b]/40">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={e => addSubUnitImage(index, Array.from(e.target.files || []))}
                            />
                            <Plus size={16} />
                            <span className="mt-1 text-[9px] font-bold">Add</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="House Rules & Policies" icon={ShieldCheck}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={checkCardClass}>
              <input type="checkbox" checked={rules.smokingAllowed} onChange={event => setRules({ ...rules, smokingAllowed: event.target.checked })} className="accent-[#d3af4b]" />
              <Moon size={15} className="text-[#8d8a83]" />
              Smoking allowed
            </label>
            <label className={checkCardClass}>
              <input type="checkbox" checked={rules.petsAllowed} onChange={event => setRules({ ...rules, petsAllowed: event.target.checked })} className="accent-[#d3af4b]" />
              <PawPrint size={15} className="text-[#8d8a83]" />
              Pets allowed
            </label>
            <label className={checkCardClass}>
              <input type="checkbox" checked={rules.partiesAllowed} onChange={event => setRules({ ...rules, partiesAllowed: event.target.checked })} className="accent-[#d3af4b]" />
              <PartyPopper size={15} className="text-[#8d8a83]" />
              Parties allowed
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <Label>Max Guests</Label>
              <input type="number" min="1" className={inputClass} value={rules.maxGuests} onChange={event => setRules({ ...rules, maxGuests: event.target.value })} />
            </div>
            <div>
              <Label>Quiet Hours Start</Label>
              <input type="time" className={inputClass} value={rules.quietHoursStart} onChange={event => setRules({ ...rules, quietHoursStart: event.target.value })} />
            </div>
            <div>
              <Label>Quiet Hours End</Label>
              <input type="time" className={inputClass} value={rules.quietHoursEnd} onChange={event => setRules({ ...rules, quietHoursEnd: event.target.value })} />
            </div>
          </div>

          <div className="mt-5">
            <Label>Custom Rules (One Per Line)</Label>
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              placeholder="No shoes inside the house&#10;Do not use host's personal items&#10;Keep kitchen clean after use"
              value={(rules.customRules || []).join('\n')}
              onChange={event => setRules({ ...rules, customRules: event.target.value.split('\n') })}
            />
          </div>

          <label className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5 text-sm font-bold text-[#f3eee6]">
            <input type="checkbox" checked={policy.depositRequired} onChange={event => setPolicy({ ...policy, depositRequired: event.target.checked })} className="h-4 w-4 accent-[#d3af4b]" />
            Require Security Deposit
          </label>

          {policy.depositRequired && (
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <Label>Deposit Amount (PKR)</Label>
                <input type="number" className={inputClass} value={policy.depositAmount} onChange={event => setPolicy({ ...policy, depositAmount: event.target.value })} />
              </div>
              <div>
                <Label>Damage Rules</Label>
                <input className={inputClass} value={policy.damageRules} onChange={event => setPolicy({ ...policy, damageRules: event.target.value })} />
              </div>
            </div>
          )}

          <div className="mt-6">
            <Label>Cancellation Policy</Label>
            <p className="mb-3 text-[11px] font-semibold text-[#8d8a83]">
              BookVibe applies one standard refund policy to every property, based on how long after payment the guest cancels.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CANCELLATION_PHASES.map(item => (
                <div key={item.title} className="rounded-xl border border-white/8 bg-[#18181d] p-4 text-left">
                  <p className="text-sm font-black text-[#d3af4b]">{item.title}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8d8a83]">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <Label>Guest Requirements</Label>
            <label className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#18181d] p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.onlyVerifiedGuests}
                onChange={event => setPolicy({ ...policy, onlyVerifiedGuests: event.target.checked })}
                className="mt-0.5 accent-[#d3af4b]"
              />
              <span>
                <span className="block text-sm font-black text-[#e9e6df]">Only Verified Guests</span>
                <span className="mt-1 block text-[11px] font-semibold text-[#8d8a83]">
                  Only guests who have completed identity (KYC) verification can book this property.
                </span>
              </span>
            </label>
          </div>
        </Section>

        <Section title="Location" icon={MapPin}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Address *</Label>
              <input required className={inputClass} placeholder="Street, area" value={basicInfo.address} onChange={event => setBasicInfo({ ...basicInfo, address: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Country *</Label>
              <input required className={inputClass} placeholder="e.g. Pakistan" value={basicInfo.country} onChange={event => setBasicInfo({ ...basicInfo, country: event.target.value })} />
            </div>
          </div>

          <div className="mt-5">
            <Label>Pin Location *</Label>
            <div className="[&_.bv-input]:border-white/8 [&_.bv-input]:bg-[#121215] [&_.bv-input]:text-[#f3eee6] [&_.bv-btn-outline]:border-[#d3af4b]/35 [&_.bv-btn-outline]:text-[#d3af4b]">
              <LocationPickerMap
                latitude={basicInfo.latitude}
                longitude={basicInfo.longitude}
                propertyName={basicInfo.name}
                onLocationChange={(lat, lng) => setBasicInfo({ ...basicInfo, latitude: lat, longitude: lng })}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>Latitude</Label>
              <input className={inputClass} value={basicInfo.latitude} onChange={event => setBasicInfo({ ...basicInfo, latitude: event.target.value })} />
            </div>
            <div>
              <Label>Longitude</Label>
              <input className={inputClass} value={basicInfo.longitude} onChange={event => setBasicInfo({ ...basicInfo, longitude: event.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="Amenities" icon={UtensilsCrossed}>
          <Label>Select all that apply — tap to toggle</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMENITIES.map(amenity => {
              const selected = amenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    selected
                      ? 'border-[#d3af4b] bg-[#3a3321] text-[#d3af4b]'
                      : 'border-white/8 bg-[#151519] text-[#8d8a83] hover:border-[#d3af4b]/35 hover:text-[#d3af4b]'
                  }`}
                >
                  {selected && <Check size={9} className="mr-1 inline" strokeWidth={3} />}
                  {amenity}
                </button>
              );
            })}
          </div>

          {/* Custom amenities not in preset */}
          {amenities.filter(a => !PRESET_AMENITIES.includes(a)).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {amenities.filter(a => !PRESET_AMENITIES.includes(a)).map(a => (
                <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-[#d3af4b] bg-[#3a3321] px-3 py-1.5 text-xs font-bold text-[#d3af4b]">
                  {a}
                  <button type="button" onClick={() => toggleAmenity(a)} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add custom amenity */}
          <div className="mt-3 flex gap-2">
            <input
              className={`${inputClass} flex-1 text-xs`}
              placeholder="Add custom amenity (e.g. Rooftop Access)..."
              value={customAmenity}
              onChange={e => setCustomAmenity(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } }}
            />
            <button
              type="button"
              onClick={addCustomAmenity}
              className="shrink-0 rounded-xl border border-[#d3af4b]/35 px-4 text-xs font-black text-[#d3af4b] transition hover:bg-[#d3af4b]/8"
            >
              Add
            </button>
          </div>
        </Section>

        <Section title="Special Services" icon={ShieldCheck}>
          {/* Homemade Food — Single Space only */}
          {!isMulti && (
            <div className="pb-5">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-[#f3eee6]">
                <input
                  type="checkbox"
                  checked={services.homemadeFood}
                  onChange={e => setServices({ ...services, homemadeFood: e.target.checked })}
                  className="h-4 w-4 accent-[#d3af4b]"
                />
                <UtensilsCrossed size={15} className="text-[#d3af4b]" />
                Homemade Food Available
              </label>
              <p className="mt-1 pl-7 text-[11px] font-semibold text-[#6f6c66]">
                Guests can request meals from you directly.
              </p>

              {services.homemadeFood && (
                <div className="mt-4 space-y-3 rounded-xl border border-white/8 bg-[#151519] p-4">
                  <div>
                    <Label>Service Title</Label>
                    <input
                      className={inputClass}
                      value={services.foodTitle}
                      onChange={e => setServices({ ...services, foodTitle: e.target.value })}
                      placeholder="e.g. Desi Home Cooked Meals"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <textarea
                      className={`${inputClass} min-h-[80px] resize-y text-xs`}
                      placeholder="e.g. Fresh Pakistani home-cooked meals prepared daily. Breakfast, lunch, and dinner available on request."
                      value={services.foodDescription}
                      onChange={e => setServices({ ...services, foodDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Price per Meal (PKR)</Label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="e.g. 500"
                      value={services.foodPrice}
                      onChange={e => setServices({ ...services, foodPrice: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Medical Service — both Single and Multi */}
          <div className={!isMulti ? 'border-t border-white/8 pt-5' : ''}>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-[#f3eee6]">
              <input
                type="checkbox"
                checked={services.medicalService}
                onChange={e => setServices({ ...services, medicalService: e.target.checked })}
                className="h-4 w-4 accent-[#d3af4b]"
              />
              <ShieldCheck size={15} className="text-[#d3af4b]" />
              Medical Assistance Available
            </label>
            <p className="mt-1 pl-7 text-[11px] font-semibold text-[#6f6c66]">
              Complimentary — no charge to guests.
            </p>

            {services.medicalService && (
              <div className="mt-4 space-y-3 rounded-xl border border-white/8 bg-[#151519] p-4">
                <div>
                  <Label>Service Title</Label>
                  <input
                    className={inputClass}
                    value={services.medicalTitle}
                    onChange={e => setServices({ ...services, medicalTitle: e.target.value })}
                    placeholder="e.g. First Aid & Doctor on Call"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y text-xs`}
                    placeholder="e.g. First aid kit on-site. Nearest clinic is 5 min away. Doctor on call available within 30 minutes."
                    value={services.medicalDescription}
                    onChange={e => setServices({ ...services, medicalDescription: e.target.value })}
                  />
                </div>
                <p className="text-[11px] font-semibold text-[#d3af4b]">
                  This service is free — it will be shown as a facility, not a chargeable add-on.
                </p>
              </div>
            )}
          </div>
        </Section>

        <Section title="Optional Add-on Services" icon={ConciergeBell}>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={addService} className="inline-flex items-center gap-2 rounded-xl border border-[#d3af4b]/35 px-4 py-2 text-xs font-black text-[#d3af4b]">
              <Plus size={14} />
              Add Service
            </button>
          </div>
          {addOnServices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#151519] p-5 text-center text-sm font-semibold text-[#8d8a83]">
              Add services like laundry, breakfast, airport pickup, or cleaning.
            </div>
          ) : (
            <div className="space-y-3">
              {addOnServices.map((service, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-white/8 bg-[#151519] p-4 md:grid-cols-[minmax(0,1fr)_140px_150px_38px]">
                  <input className={inputClass} placeholder="Service name" value={service.serviceName} onChange={event => updateService(index, 'serviceName', event.target.value)} />
                  <input className={inputClass} type="number" placeholder="Price" value={service.price} onChange={event => updateService(index, 'price', event.target.value)} />
                  <select className={inputClass} value={service.billingType} onChange={event => updateService(index, 'billingType', event.target.value)}>
                    {BILLING_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setAddOnServices(addOnServices.filter((_, i) => i !== index))} className="flex h-11 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-500/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={isMulti ? "Hotel / Hostel Establishment Images" : "Property Images"} icon={ImageIcon}>
          <p className="mb-4 text-[11px] font-semibold text-[#8d8a83]">
            {isMulti 
              ? "Upload photos of the building, reception, common areas, and exterior. These will be the main photos for your establishment listing." 
              : "Upload high-quality photos of your property. Minimum 4 images required."}
          </p>
          <div className="flex flex-wrap gap-4">
            {imageItems.map((item, index) => (
              <div key={`${item.url}-${index}`} className="group relative h-[104px] w-[150px] overflow-hidden rounded-xl border border-white/8 bg-[#101013]">
                <img src={item.url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove image">
                  <X size={14} />
                </button>
              </div>
            ))}

            {imageItems.length < 6 && (
              <label className="flex h-[104px] w-[150px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#101013] text-[#d3af4b] transition hover:border-[#d3af4b]/50">
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                <Upload size={20} />
                <span className="mt-2 text-xs font-bold">Upload</span>
              </label>
            )}
          </div>
          <p className="mt-4 text-xs font-black text-[#d3af4b]">
            {remainingImages > 0 ? `${remainingImages} more needed` : 'Ready to submit'}
          </p>
        </Section>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d3af4b] px-5 py-4 text-sm font-black text-[#111114] transition hover:bg-[#e2c05c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : isEdit ? <Check size={16} /> : <Save size={16} />}
          {isEdit ? 'Update Property' : 'Add Property'}
        </button>
      </form>
    </div>
  );
};

export default AddAccommodations;
