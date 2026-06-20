/**
 * AdminProfile.jsx
 *
 * This component handles the administrative user profile management.
 * It allows admins to view their account details and perform updates to their
 * username, phone number, and profile image. The component manages local image
 * previews and integrates with the Redux store to sync profile changes.
 *
 * @module AdminProfile
 */

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { User, Edit3, Save, X, Loader2, Camera, AlertCircle } from 'lucide-react';
import { setUser } from '../../redux/slices/authSlice';
import { getAuthConfig } from '../../utils/authConfig';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * AdminProfile Component.
 *
 * @returns {JSX.Element|null}
 */
const AdminProfile = () => {
  const dispatch = useDispatch();

  /* ── DATA SOURCE ── */

  // Current authenticated user document from Redux
  const u = useSelector((s) => {
    return s.auth.user?.user;
  });

  /* ── STATE MANAGEMENT ── */

  /** @type {[boolean, Function]} Whether the edit form is currently shown */
  const [editing, setEditing] = useState(false);

  /** @type {[boolean, Function]} Whether the save request is in-flight */
  const [saving, setSaving] = useState(false);

  /** @type {[string, Function]} Controlled value for the username input in edit mode */
  const [username, setUsername] = useState('');

  /** @type {[string, Function]} Controlled value for the phone input in edit mode */
  const [phone, setPhone] = useState('');

  /** @type {[File|null, Function]} Selected image File object, or null */
  const [imgFile, setImgFile] = useState(null);

  /** @type {[string|null, Function]} Object URL for local preview of the selected image */
  const [imgPrev, setImgPrev] = useState(null);

  /** @type {[string|null, Function]} Form-level error message */
  const [formError, setFormError] = useState(null);

  /* ── EVENT HANDLERS ── */

  /**
   * Populate edit-form fields from the current user document and show the form.
   */
  const startEdit = () => {
    setUsername(u?.username || '');
    setPhone(u?.phone || '');
    setImgFile(null);
    setImgPrev(null);
    setEditing(true);
  };

  /**
   * Handle image file selection: create a local object URL for preview.
   *
   * @param {Object} e - Change event from the file input.
   */
  const handleImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      return;
    }
    setImgFile(f);
    setImgPrev(URL.createObjectURL(f));
  };

  /**
   * Submit the edit form as multipart/form-data.
   *
   * @param {Object} e - Form submit event.
   */
  const handleSave = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setFormError('Username is required.');
      return;
    }
    setFormError(null);

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append('username', username.trim());
      fd.append('phone', phone.trim());

      if (imgFile) {
        fd.append('profileImage', imgFile);
      }

      // Never force Content-Type on a FormData body — axios/the browser must compute
      // it themselves so the multipart boundary matches the body. An explicit
      // 'multipart/form-data' header with no boundary silently breaks the upload:
      // the server receives an unparseable body (no fields, no file at all).
      const r = await axios.put(
        `${BASE}/user/update-profile`,
        fd,
        getAuthConfig()
      );

      if (r.data.success) {
        // Sync the updated user object into Redux so all components reflect the change
        dispatch(setUser(r.data.user));
        setEditing(false);

        // Drop the local preview now that the real Cloudinary URL is in Redux —
        // otherwise the avatar keeps rendering off a blob: URL instead of the
        // saved image, and re-entering edit mode would briefly flash the old preview.
        if (imgPrev) {
          URL.revokeObjectURL(imgPrev);
        }
        setImgFile(null);
        setImgPrev(null);
      }
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── RENDER ── */

  // Render nothing until the user is available
  if (!u) {
    return null;
  }

  // Use the local preview while editing; fall back to the stored Cloudinary URL
  const avatar = imgPrev || u.profileImage?.url;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
          Admin <span className="text-[var(--bv-gold)]">Profile</span>
        </h1>
        <p className="text-[var(--bv-text-dim)] text-sm mt-1">Manage your account</p>
      </div>

      {/* Profile card with gradient banner */}
      <div className="bv-card-static overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[var(--bv-danger)]/20 via-[var(--bv-gold)]/10 to-transparent" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 mb-4">
            {/* Avatar with optional camera-icon edit overlay */}
            <div className="relative w-fit">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] shadow-[var(--bv-shadow-md)] object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl border-4 border-[var(--bv-card)] shadow-[var(--bv-shadow-md)] bg-gradient-to-br from-[var(--bv-danger)] to-red-600 flex items-center justify-center">
                  <span className="text-3xl font-black text-white">
                    {u.username?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Camera icon label/file-input — only visible in edit mode */}
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

            {/* Edit button — only shown when not already editing */}
            {!editing && (
              <button
                onClick={() => {
                  return startEdit();
                }}
                className="bv-btn-gold text-sm px-4 py-2 flex items-center gap-2"
              >
                <Edit3 size={14} /> Edit
              </button>
            )}
          </div>

          <h2 className="font-display text-2xl text-[var(--bv-text)]">{u.username}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="bv-badge bg-red-500/10 text-[var(--bv-danger)] border border-red-500/20 capitalize">
              {u.role}
            </span>
          </div>
        </div>
      </div>

      {/* Edit form or read-only detail list */}
      {editing ? (
        <div className="bv-card-static p-6">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">
            Edit Information
          </h3>
          <form
            onSubmit={(e) => {
              return handleSave(e);
            }}
            className="space-y-4"
          >
            <div>
              <label className="bv-label">Username *</label>
              <input
                value={username}
                onChange={(e) => {
                  return setUsername(e.target.value);
                }}
                className="bv-input"
                required
              />
            </div>
            <div>
              <label className="bv-label">Phone</label>
              <input
                value={phone}
                onChange={(e) => {
                  return setPhone(e.target.value);
                }}
                className="bv-input"
              />
            </div>

            {/* Email is read-only — shown for reference only */}
            <div className="p-4 bg-[var(--bv-bg)] rounded-xl border border-[var(--bv-border)]">
              <p className="bv-label mb-0">Email (read-only)</p>
              <p className="text-sm text-[var(--bv-text-muted)] mt-0.5">{u.email}</p>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/15">
                <AlertCircle size={13} className="text-[var(--bv-danger)] flex-shrink-0" />
                <p className="text-xs text-[var(--bv-danger)]">{formError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setFormError(null); }}
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
            Account Details
          </h3>
          {[
            ['Username', u.username],
            ['Email', u.email],
            ['Phone', u.phone || '—'],
            ['Role', u.role],
            ['Joined', u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'],
          ].map(([l, v]) => {
            return (
              <div
                key={l}
                className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0"
              >
                <div className="p-2 bg-[var(--bv-gold-glow)] rounded-lg">
                  <User size={13} className="text-[var(--bv-gold)]" />
                </div>
                <div>
                  <p className="bv-label mb-0">{l}</p>
                  <p className="text-sm font-medium text-[var(--bv-text)] mt-0.5">{v}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminProfile;
