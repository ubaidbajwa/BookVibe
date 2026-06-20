import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  User, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, XCircle,
  Clock, Edit3, Camera, Save, X, Loader2, Fingerprint, ScanFace,
  CreditCard, ShieldCheck, AlertTriangle, Star,
} from 'lucide-react';
import { updateHostProfile, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import { setUser } from '../../redux/slices/authSlice';

const InfoRow = ({ icon: I, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0">
    <div className="p-2 bg-[var(--bv-gold-glow)] rounded-lg">
      <I size={13} className="text-[var(--bv-gold)]" />
    </div>
    <div>
      <p className="bv-label mb-0">{label}</p>
      <p className="text-sm font-medium text-[var(--bv-text)] mt-0.5">{value || '—'}</p>
    </div>
  </div>
);

const VBadge = ({ status }) => {
  const map = {
    verified: { c: 'bv-badge-green',  i: <CheckCircle size={10} />, l: 'Verified' },
    pending:  { c: 'bv-badge-amber',  i: <Clock size={10} />,       l: 'Pending Review' },
    rejected: { c: 'bv-badge-red',    i: <XCircle size={10} />,     l: 'Rejected' },
  };
  const v = map[status] || { c: 'bv-badge-gold', i: <Shield size={10} />, l: 'Unverified' };
  return <span className={`bv-badge ${v.c}`}>{v.i} {v.l}</span>;
};

const TrustBar = ({ score }) => {
  const pct = Math.min(Math.max(Number(score) || 0, 0), 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-[var(--bv-gold)]' : 'bg-red-500';
  return (
    <div className="mt-4 px-6 pb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] flex items-center gap-1">
          <Star size={9} className="text-[var(--bv-gold)]" /> Trust Score
        </p>
        <span className="text-sm font-black text-[var(--bv-text)]">{pct}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bv-surface)] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const fmtDob = (raw) => {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return raw;
  }
};

const HostProfile = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { loading, success, error, message, updatedUser } = useSelector((s) => s.accommodations);

  const host = user?.user;
  const cd = host?.cnicData || {};

  const [editing, setEditing]   = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');
  const [dob, setDob]           = useState('');
  const [prev, setPrev]         = useState(null);
  const [file, setFile]         = useState(null);

  const fileRef    = useRef(null);
  const prevUrlRef = useRef(null);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
  }, []);

  useEffect(() => {
    if (success && message && updatedUser) {
      dispatch(setUser(updatedUser));
      setEditing(false);
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
      setPrev(null);
      setFile(null);
      dispatch(resetAccommodationState());
    }
  }, [success, message, updatedUser, dispatch]);

  useEffect(() => {
    if (error) {
      dispatch(resetAccommodationState());
    }
  }, [error, dispatch]);

  if (!host) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[var(--bv-text-dim)]">
        User not found
      </div>
    );
  }

  const avatarSrc = prev || host.profileImage?.url;

  const startEdit = () => {
    setUsername(host.username || '');
    setPhone(host.phone || '');
    setAddress(host.address || '');
    setDob(host.dob || '');
    setPrev(null);
    setFile(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setPrev(null);
    setFile(null);
  };

  const handleImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { return; }
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    const url = URL.createObjectURL(f);
    prevUrlRef.current = url;
    setFile(f);
    setPrev(url);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) {
      return;
    }
    const fd = new FormData();
    fd.append('username', username.trim());
    fd.append('phone', phone.trim());
    fd.append('address', address.trim());
    fd.append('dob', dob);
    if (file) fd.append('profileImage', file);
    dispatch(updateHostProfile(fd));
  };

  const hasAnyDoc = host.cnicImage?.frontImage?.url || host.cnicImage?.backImage?.url || host.selfieImage?.url;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">My Profile</h1>
        {!editing && (
          <button onClick={startEdit} className="bv-btn-gold text-sm px-4 py-2 flex items-center gap-2">
            <Edit3 size={14} /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar column */}
        <div className="space-y-4">
          <div className="bv-card-static overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-[var(--bv-gold)]/20 to-transparent" />

            <div className="px-6 pb-2">
              <div className="relative -mt-12 w-fit mx-auto">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] object-cover shadow-[var(--bv-shadow-md)]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] shadow-[var(--bv-shadow-md)] bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                    <span className="text-3xl font-black text-[var(--bv-bg)]">
                      {host.username?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                {editing && (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-xl text-[var(--bv-bg)] shadow-[var(--bv-shadow-gold)]"
                    >
                      <Camera size={12} />
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImg} />
                  </>
                )}
              </div>

              <div className="text-center mt-4">
                <h2 className="text-xl font-bold text-[var(--bv-text)]">{host.username}</h2>
                <span className="bv-badge bv-badge-gold capitalize mt-1">{host.role}</span>
              </div>

              <div className="flex justify-center gap-2 mt-3 flex-wrap pb-2">
                <VBadge status={host.isVerified} />
                {host.isEmailVerified && (
                  <span className="bv-badge bv-badge-green"><CheckCircle size={10} /> Email</span>
                )}
                {host.isPhoneVerified && (
                  <span className="bv-badge bv-badge-green"><CheckCircle size={10} /> Phone</span>
                )}
              </div>
            </div>

            <TrustBar score={host.trustScore} />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Rejection banner */}
          {host.isVerified === 'rejected' && host.rejectedReason && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-600">Verification Rejected</p>
                <p className="text-xs text-red-500 mt-0.5">{host.rejectedReason}</p>
              </div>
            </div>
          )}

          {/* Pending banner */}
          {host.isVerified === 'pending' && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-600">Verification Pending</p>
                <p className="text-xs text-amber-500 mt-0.5">Admin is reviewing your KYC documents. This usually takes 24–48 hours.</p>
              </div>
            </div>
          )}

          {editing ? (
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">
                Edit Information
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                {[
                  { l: 'Full Name *', v: username, s: setUsername, placeholder: 'Your full name' },
                  { l: 'Phone',      v: phone,    s: setPhone,    placeholder: '+923001234567' },
                  { l: 'Address',    v: address,  s: setAddress,  placeholder: 'Your city / address' },
                ].map(({ l, v, s, placeholder }) => (
                  <div key={l}>
                    <label className="bv-label">{l}</label>
                    <input
                      value={v}
                      onChange={(e) => s(e.target.value)}
                      placeholder={placeholder}
                      className="bv-input"
                    />
                  </div>
                ))}
                <div>
                  <label className="bv-label">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="bv-input [color-scheme:dark]"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                      : <><Save size={15} /> Save Changes</>}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bv-btn-outline py-3 px-4 text-sm flex items-center gap-2"
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
                Personal Info
              </h3>
              <InfoRow icon={User}     label="Full Name" value={host.username} />
              <InfoRow icon={Mail}     label="Email"     value={host.email} />
              <InfoRow icon={Phone}    label="Phone"     value={host.phone} />
              <InfoRow icon={MapPin}   label="Address"   value={host.address} />
              <InfoRow icon={Calendar} label="Date of Birth" value={fmtDob(host.dob)} />
            </div>
          )}

          {/* CNIC extracted data */}
          {cd.cnicNumber && (
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Fingerprint size={14} /> CNIC Verified Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { l: 'CNIC Number',  v: cd.cnicNumber,   i: CreditCard },
                  { l: 'Name (CNIC)',  v: cd.fullName,     i: User },
                  { l: 'Father Name',  v: cd.fatherName,   i: User },
                  { l: 'DOB (CNIC)',   v: cd.dateOfBirth,  i: Calendar },
                  { l: 'Address',      v: cd.address,      i: MapPin },
                  { l: 'Gender',       v: cd.gender,       i: User },
                ].filter((x) => x.v).map(({ l, v, i: I }) => (
                  <div key={l} className="flex items-start gap-3 p-3 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)]">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <I size={13} className="text-[var(--bv-success)]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">{l}</p>
                      <p className="text-sm font-semibold text-[var(--bv-text)] mt-0.5">{v}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(cd.confidence || cd.faceMatchScore) && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--bv-divider)]">
                  {cd.confidence && (
                    <span className="bv-badge bv-badge-gold">
                      <ShieldCheck size={10} /> OCR: {cd.confidence}%
                    </span>
                  )}
                  {cd.faceMatchScore && (
                    <span className="bv-badge bv-badge-green">
                      <ScanFace size={10} /> Face Match: {cd.faceMatchScore}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CNIC document images */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
              Identity Documents
            </h3>
            {hasAnyDoc ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { l: 'CNIC Front', s: host.cnicImage?.frontImage?.url },
                  { l: 'CNIC Back',  s: host.cnicImage?.backImage?.url },
                  { l: 'Selfie',     s: host.selfieImage?.url },
                ].map(({ l, s }) => (
                  <div key={l} className="text-center">
                    <p className="bv-label mb-2">{l}</p>
                    {s ? (
                      <img
                        src={s}
                        alt={l}
                        className="w-full h-28 object-cover rounded-xl border border-[var(--bv-border)]"
                      />
                    ) : (
                      <div className="w-full h-28 rounded-xl bg-[var(--bv-surface)] border border-dashed border-[var(--bv-border)] flex items-center justify-center text-xs text-[var(--bv-text-dim)]">
                        Not uploaded
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 border border-dashed border-[var(--bv-border)] rounded-xl">
                <Shield size={28} className="text-[var(--bv-text-dim)] mb-2 opacity-30" />
                <p className="text-sm text-[var(--bv-text-dim)]">No documents uploaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostProfile;
