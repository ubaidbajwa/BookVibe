/**
 * @file ProfilePage.jsx
 * @description Displays the authenticated guest's full profile including personal info, 
 * CNIC-verified data, identity document images, trust score, and booking statistics. 
 * Includes an inline edit form for profile updates.
 */

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, AlertCircle,
  ArrowLeft, Edit3, Save, X, Loader2, Camera, Clock, CreditCard, Home,
  Fingerprint, ScanFace, ShieldCheck, AlertTriangle, RefreshCw
} from 'lucide-react';
import { setUser, logout } from '../redux/slices/authSlice';
import { getAuthConfig } from '../utils/authConfig';

/**
 * Base API URL derived from environment variables.
 * @constant {string}
 */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Formats a date string into a human-readable Pakistani locale format.
 * 
 * @param {string|Date} d - Date value.
 * @returns {string} Formatted date string.
 */
const fmtDate = (d) => {
  if (!d) {
    return '—';
  }
  return new Date(d).toLocaleDateString('en-PK', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

/**
 * TrustRing Sub-component
 * SVG circular progress indicator for the user's trust score.
 * 
 * @param {Object} props - Component props.
 * @param {number} props.score - Trust score (0-100).
 * @returns {JSX.Element}
 */
const TrustRing = ({ score }) => {
  const r = 36;
  const c = 2 * Math.PI * r;
  const o = c - (score / 100) * c;

  let color = 'var(--bv-danger)';
  if (score >= 70) {
    color = 'var(--bv-success)';
  } else if (score >= 40) {
    color = 'var(--bv-gold)';
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" className="-rotate-90">
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke="var(--bv-surface)"
            strokeWidth="8"
          />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={c}
            strokeDashoffset={o}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-[var(--bv-text)]">{score}</span>
          <span className="text-[9px] text-[var(--bv-text-dim)] uppercase">Trust</span>
        </div>
      </div>
    </div>
  );
};

/**
 * VerifyBadge Sub-component
 * Small pill showing whether a field has been verified.
 * 
 * @param {Object} props - Component props.
 * @param {boolean} props.ok - Verification status.
 * @param {string} props.label - Label for the field.
 * @returns {JSX.Element}
 */
const VerifyBadge = ({ ok, label }) => {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${ok ? 'bg-emerald-500/10 text-[var(--bv-success)]' : 'bg-red-500/10 text-[var(--bv-danger)]'}`}>
      {ok ? (
        <CheckCircle size={10} />
      ) : (
        <AlertCircle size={10} />
      )} {label}
    </span>
  );
};

/**
 * ProfilePage Component
 * @returns {JSX.Element} The rendered component.
 */
const ProfilePage = () => {
  // --- Hooks & Redux ---

  /**
   * Navigation hook for programmatic routing.
   */
  const nav = useNavigate();

  /**
   * Redux dispatch hook.
   */
  const dispatch = useDispatch();

  /**
   * Accesses authentication state from Redux store.
   */
  const { user } = useSelector((s) => {
    return s.auth;
  });

  /**
   * Current user data from store.
   */
  const store = user?.user;

  // --- Component State ---

  /**
   * State for the user profile data.
   */
  const [profile, setProfile] = useState(store);

  /**
   * State for guest booking statistics.
   */
  const [stats, setStats] = useState(null);

  /**
   * State for list of recent bookings.
   */
  const [recent, setRecent] = useState([]);

  /**
   * State for profile data loading status.
   */
  const [loadP, setLoadP] = useState(true);

  /**
   * State for stats loading status.
   */
  const [loadS, setLoadS] = useState(true);

  /**
   * State to control edit mode.
   */
  const [editing, setEditing] = useState(false);

  /**
   * State for profile update submission status.
   */
  const [saving, setSaving] = useState(false);

  /**
   * State for username edit field.
   */
  const [username, setUsername] = useState('');

  /**
   * State for phone edit field.
   */
  const [phone, setPhone] = useState('');

  /**
   * State for address edit field.
   */
  const [address, setAddress] = useState('');

  /**
   * State for DOB edit field.
   */
  const [dob, setDob] = useState('');

  /**
   * State for new profile image file.
   */
  const [imgFile, setImgFile] = useState(null);

  /**
   * State for profile image preview URL.
   */
  const [imgPrev, setImgPrev] = useState(null);

  // --- Effects ---

  /**
   * Effect Hook: Fetches the latest user profile from the server on mount.
   */
  useEffect(() => {
    // Setup
    axios.get(`${BASE}/user/me`, getAuthConfig())
      .then((r) => {
        if (r.data.success) {
          setProfile(r.data.user);
          dispatch(setUser(r.data.user));
        }
      })
      .catch((e) => {
        if (e.response?.status === 403) {
          dispatch(logout());
          nav('/login', { replace: true });
        }
        if (store) {
          setProfile(store);
        }
      })
      .finally(() => {
        setLoadP(false);
      });

    // Dependencies
  }, []);

  /**
   * Effect Hook: Fetches guest booking statistics and recent bookings.
   */
  useEffect(() => {
    // Setup
    if (!store) {
      return;
    }

    axios.get(`${BASE}/user/guest-dashboard`, getAuthConfig())
      .then((r) => {
        if (r.data.success) {
          setStats(r.data.stats);
          setRecent(r.data.recentBookings || []);
        }
      })
      .catch(() => {
        // Silent error
      })
      .finally(() => {
        setLoadS(false);
      });

    // Dependencies
  }, []);

  // --- Logic Handlers ---

  /**
   * Enters edit mode and populates fields with current profile data.
   */
  const startEdit = () => {
    setUsername(profile?.username || '');
    setPhone(profile?.phone || '');
    setAddress(profile?.address || '');
    setDob(profile?.dob || '');
    setImgFile(null);
    setImgPrev(null);
    setEditing(true);
  };

  /**
   * Exits edit mode without saving.
   */
  const cancelEdit = () => {
    setEditing(false);
    setImgFile(null);
    setImgPrev(null);
  };

  /**
   * Handles profile image file selection and validation.
   * @param {Event} e - Input change event.
   */
  const handleImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      return;
    }
    setImgFile(f);
    setImgPrev(URL.createObjectURL(f));
  };

  /**
   * Submits the profile update form.
   * @param {Event} e - Form submission event.
   * @async
   */
  const handleSave = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      return;
    }

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append('username', username.trim());
      fd.append('phone', phone.trim());
      fd.append('address', address.trim());
      fd.append('dob', dob);

      if (imgFile) {
        fd.append('profileImage', imgFile);
      }

      // Never force Content-Type on a FormData body — see AdminProfile.jsx for why.
      const r = await axios.put(
        `${BASE}/user/update-profile`,
        fd,
        getAuthConfig()
      );

      if (r.data.success) {
        setProfile(r.data.user);
        dispatch(setUser(r.data.user));
        setEditing(false);

        // Drop the local preview now that the real Cloudinary URL is saved —
        // otherwise the avatar keeps rendering off a blob: URL instead of the
        // saved image, and re-entering edit mode would briefly flash the old preview.
        if (imgPrev) {
          URL.revokeObjectURL(imgPrev);
        }
        setImgFile(null);
        setImgPrev(null);
      }
    } catch {
      // error silently handled
    } finally {
      setSaving(false);
    }
  };

  // --- Render Guards ---

  if (loadP && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--bv-gold)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--bv-text-dim)]">
        Please login
      </div>
    );
  }

  // --- UI Data Resolution ---

  const avatarSrc = imgPrev || profile.profileImage?.url;
  const cd = profile.cnicData || {};

  // --- Render ---

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => {
            return nav(-1);
          }}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* ═══ Rejection Banner ═══ */}
        {profile.isVerified === 'rejected' && (
          <div className="mb-6 flex items-start gap-4 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <AlertTriangle size={20} className="text-[var(--bv-danger)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-[var(--bv-danger)]">Identity Verification Rejected</p>
              {profile.rejectedReason && (
                <p className="text-sm text-[var(--bv-danger)]/80 mt-1">{profile.rejectedReason}</p>
              )}
              <p className="text-sm text-[var(--bv-text-muted)] mt-1">
                Please re-upload clearer documents so our team can verify your identity.
              </p>
            </div>
            <button
              onClick={() => nav('/resubmit-verification')}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bv-danger)] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition flex-shrink-0"
            >
              <RefreshCw size={13} /> Re-submit
            </button>
          </div>
        )}

        {/* ═══ Hero Card Section ═══ */}
        <div className="bv-card-static overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-[var(--bv-gold)]/20 via-[var(--bv-gold)]/5 to-transparent" />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 mb-4">
              <div className="relative w-fit">
                {avatarSrc ? (
                  <img 
                    src={avatarSrc} 
                    alt="" 
                    className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] shadow-[var(--bv-shadow-md)] object-cover" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] shadow-[var(--bv-shadow-md)] bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                    <span className="text-3xl font-black text-[var(--bv-bg)]">
                      {profile.username?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                {editing && (
                  <label className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] rounded-xl cursor-pointer shadow-[var(--bv-shadow-gold)]">
                    <Camera size={12} className="text-[var(--bv-bg)]" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        return handleImg(e);
                      }} 
                    />
                  </label>
                )}
              </div>
              {!editing && (
                <button 
                  onClick={() => {
                    return startEdit();
                  }} 
                  className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                >
                  <Edit3 size={14} /> Edit Profile
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl text-[var(--bv-text)]">{profile.username}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="bv-badge bv-badge-gold capitalize">{profile.role}</span>
                  <VerifyBadge ok={profile.isEmailVerified} label="Email" />
                  <VerifyBadge ok={profile.isPhoneVerified} label="Phone" />
                  <VerifyBadge ok={!!cd.cnicNumber} label="CNIC" />
                </div>
              </div>
              {stats && (
                <TrustRing score={stats.trustScore || profile.trustScore || 0} />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ Main Content Column ═══ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Personal Information Card */}
            {!editing ? (
              <div className="bv-card-static p-6">
                <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Personal Info</h3>
                {[
                  { i: Mail, l: 'Email', v: profile.email },
                  { i: Phone, l: 'Phone', v: profile.phone },
                  { i: MapPin, l: 'Address', v: profile.address },
                  { i: Calendar, l: 'DOB', v: profile.dob },
                ].map(({ i: I, l, v }) => {
                  return (
                    <div key={l} className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0">
                      <div className="p-2 bg-[var(--bv-gold-glow)] rounded-lg">
                        <I size={13} className="text-[var(--bv-gold)]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-widest font-bold">{l}</p>
                        <p className="text-sm font-medium text-[var(--bv-text)] mt-0.5">{v || '—'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bv-card-static p-6">
                <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">Edit Information</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  {[
                    { l: 'Name *', v: username, s: setUsername, t: 'text' },
                    { l: 'Phone', v: phone, s: setPhone, t: 'text' },
                    { l: 'Address', v: address, s: setAddress, t: 'text' },
                    { l: 'Date of Birth', v: dob, s: setDob, t: 'date' },
                  ].map(({ l, v, s, t }) => {
                    return (
                      <div key={l}>
                        <label className="bv-label">{l}</label>
                        <input
                          type={t}
                          value={v}
                          onChange={(e) => {
                            return s(e.target.value);
                          }}
                          className={`bv-input ${t === 'date' ? '[color-scheme:dark]' : ''}`}
                        />
                      </div>
                    );
                  })}

                  {/* Read-only email field */}
                  <div className="p-4 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)]">
                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-widest font-bold">Email (read-only)</p>
                    <p className="text-sm text-[var(--bv-text-muted)] mt-0.5">{profile.email}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save size={15} /> Save
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        return cancelEdit();
                      }}
                      className="bv-btn-outline py-3 px-4 text-sm flex items-center gap-2"
                    >
                      <X size={15} /> Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CNIC Verified Identity Card */}
            {cd.cnicNumber && (
              <div className="bv-card-static p-6">
                <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Fingerprint size={14} /> CNIC Verified Identity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { l: 'CNIC Number', v: cd.cnicNumber, i: CreditCard },
                    { l: 'Full Name (CNIC)', v: cd.fullName, i: User },
                    { l: 'Father Name', v: cd.fatherName, i: User },
                    { l: 'DOB (CNIC)', v: cd.dateOfBirth, i: Calendar },
                    { l: 'Address (CNIC)', v: cd.address, i: MapPin },
                    { l: 'Gender', v: cd.gender, i: User },
                  ].filter((item) => {
                    return item.v;
                  }).map(({ l, v, i: I }) => {
                    return (
                      <div key={l} className="flex items-start gap-3 p-3 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)]">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <I size={13} className="text-[var(--bv-success)]" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-widest font-bold">{l}</p>
                          <p className="text-sm font-semibold text-[var(--bv-text)] mt-0.5">{v}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Verification confidence scores breakdown */}
                {(cd.confidence || cd.faceMatchScore || cd.livenessScore) && (
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[var(--bv-divider)]">
                    {cd.confidence && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-lg">
                        <ShieldCheck size={13} className="text-[var(--bv-gold)]" />
                        <span className="text-xs font-bold text-[var(--bv-gold)]">OCR: {cd.confidence}%</span>
                      </div>
                    )}
                    {cd.faceMatchScore && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                        <ScanFace size={13} className="text-[var(--bv-success)]" />
                        <span className="text-xs font-bold text-[var(--bv-success)]">Face: {cd.faceMatchScore}%</span>
                      </div>
                    )}
                    {cd.livenessScore && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/15 rounded-lg">
                        <User size={13} className="text-[var(--bv-info)]" />
                        <span className="text-xs font-bold text-[var(--bv-info)]">Liveness: {cd.livenessScore}%</span>
                      </div>
                    )}
                    {cd.verifiedAt && (
                      <span className="text-[10px] text-[var(--bv-text-dim)] self-center">
                        Verified: {fmtDate(cd.verifiedAt)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Identity Document Previews Card */}
            {profile.cnicImage?.frontImage?.url && (
              <div className="bv-card-static p-6">
                <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Identity Documents</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { l: 'CNIC Front', s: profile.cnicImage?.frontImage?.url },
                    { l: 'CNIC Back', s: profile.cnicImage?.backImage?.url },
                    { l: 'Selfie', s: profile.selfieImage?.url },
                  ].map(({ l, s }) => {
                    return (
                      <div key={l} className="text-center">
                        <p className="bv-label mb-1.5">{l}</p>
                        {s ? (
                          <img src={s} alt="" className="w-full h-24 object-cover rounded-xl border border-[var(--bv-border)]" />
                        ) : (
                          <div className="w-full h-24 rounded-xl bg-[var(--bv-surface)] border border-dashed border-[var(--bv-border)] flex items-center justify-center text-xs text-[var(--bv-text-dim)]">
                            N/A
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guest Statistics Card */}
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">Booking Stats</h3>
              {loadS ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => {
                    return (
                      <div key={i} className="bv-skeleton h-24 rounded-xl" />
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { i: Calendar, l: 'Total', v: stats?.totalBookings || 0, c: 'var(--bv-gold)' },
                    { i: Clock, l: 'Active', v: stats?.activeBookings || 0, c: 'var(--bv-success)' },
                    { i: CheckCircle, l: 'Done', v: stats?.completedBookings || 0, c: 'var(--bv-info)' },
                    { i: CreditCard, l: 'Spent', v: `${((stats?.totalSpent || 0) / 1000).toFixed(0)}K`, c: 'var(--bv-warning)' },
                  ].map(({ i: I, l, v, c }) => {
                    return (
                      <div key={l} className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)]">
                        <I size={15} style={{ color: c }} className="mb-2" />
                        <p className="text-2xl font-black text-[var(--bv-text)]">{v}</p>
                        <p className="text-xs text-[var(--bv-text-dim)]">{l}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ═══ Sidebar: Recent Activity ═══ */}
          <div className="space-y-5">
            <div className="bv-card-static p-5">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">Recent Bookings</h3>
              {loadS ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => {
                    return (
                      <div key={i} className="bv-skeleton h-14 rounded-xl" />
                    );
                  })}
                </div>
              ) : recent.length === 0 ? (
                <div className="py-6 text-center text-[var(--bv-text-dim)]">
                  <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No bookings yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recent.map((b) => {
                    return (
                      <div
                        key={b._id}
                        onClick={() => {
                          return nav(`/my-bookings/${b._id}`);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] cursor-pointer transition"
                      >
                        {b.propertyId?.images?.[0]?.url ? (
                          <img 
                            src={b.propertyId.images[0].url} 
                            alt="" 
                            className="w-12 h-10 rounded-lg object-cover flex-shrink-0" 
                          />
                        ) : (
                          <div className="w-12 h-10 rounded-lg bg-[var(--bv-surface)] flex items-center justify-center">
                            <Home size={14} className="text-[var(--bv-text-dim)]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                            {b.propertyId?.name || '—'}
                          </p>
                          <p className="text-xs text-[var(--bv-text-dim)]">{fmtDate(b.checkIn)}</p>
                        </div>
                        <p className="text-xs font-bold text-[var(--bv-gold)]">
                          PKR {b.totalPrice?.toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => {
                  return nav('/my-bookings');
                }}
                className="w-full mt-3 text-center text-xs text-[var(--bv-gold)] font-semibold hover:text-[var(--bv-gold-light)] transition"
              >
                View All →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
