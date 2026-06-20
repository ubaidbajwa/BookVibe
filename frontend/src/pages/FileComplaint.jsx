import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';
import { AlertTriangle, ArrowLeft, Send, Loader2, Paperclip, X } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const FileComplaint = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const authUser = useSelector((s) => s.auth.user?.user);

  const initialAgainstUserId = params.get('againstUserId') || params.get('against') || '';
  const initialBookingId = params.get('bookingId') || params.get('booking') || '';
  const initialPropertyId = params.get('propertyId') || params.get('property') || '';

  const [againstUserId, setAgainstUserId] = useState(initialAgainstUserId);
  const [bookingId] = useState(initialBookingId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [context, setContext] = useState({ propertyName: '', againstName: '' });

  useEffect(() => {
    if (!bookingId) return;
    const loadBookingContext = async () => {
      try {
        setPrefillLoading(true);
        const { data } = await axios.get(`${BASE}/booking/${bookingId}`, getAuthConfig());
        const booking = data?.booking;
        const property = booking?.propertyId;
        const guest = booking?.userId;
        const hostId = property?.hostBy;
        const me = authUser?._id;

        if (property?._id) setPropertyId(property._id);

        setContext({
          propertyName: property?.name || '',
          againstName: (me && guest?._id === me) ? 'Host' : (guest?.username || 'User'),
        });

        if (!againstUserId) {
          if (me && guest?._id === me && hostId) setAgainstUserId(hostId);
          else if (guest?._id) setAgainstUserId(guest._id);
        }
      } catch {
        // error silently handled
      } finally {
        setPrefillLoading(false);
      }
    };
    loadBookingContext();
  }, [authUser?._id, bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter((f) => {
      if (f.size > 50 * 1024 * 1024) { return false; }
      return true;
    });
    setEvidence((prev) => [...prev, ...valid].slice(0, 5));
    e.target.value = '';
  };

  const removeEvidence = (idx) => setEvidence((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!againstUserId.trim() || !subject.trim() || !description.trim()) {
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('againstUserId', againstUserId.trim());
      if (bookingId) form.append('bookingId', bookingId);
      if (propertyId) form.append('propertyId', propertyId);
      form.append('subject', subject.trim());
      form.append('description', description.trim());
      form.append('category', category);
      evidence.forEach((file) => form.append('evidence', file));
      await axios.post(`${BASE}/complaints`, form, getAuthConfig());
      nav(-1);
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="font-display text-3xl text-[var(--bv-text)] mb-2 flex items-center gap-3">
          <AlertTriangle size={26} className="text-[var(--bv-danger)]" /> File Complaint
        </h1>
        <p className="text-[var(--bv-text-muted)] text-sm mb-8">
          Report an issue with a host or guest. Admin will review and take action.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bv-card-static p-6 space-y-4">
            {bookingId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="bv-label">Booking</label>
                  <div className="bv-input min-h-11 flex items-center">#{bookingId}</div>
                </div>
                <div>
                  <label className="bv-label">Against</label>
                  <div className="bv-input min-h-11 flex items-center">
                    {prefillLoading ? 'Loading...' : (context.againstName || 'Auto-selected')}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="bv-label">Property</label>
                  <div className="bv-input min-h-11 flex items-center">
                    {prefillLoading ? 'Loading...' : (context.propertyName || propertyId || 'Auto-selected')}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="bv-label">Against User ID *</label>
                <input
                  value={againstUserId}
                  onChange={(e) => setAgainstUserId(e.target.value)}
                  placeholder="User ID of person you're complaining about"
                  className="bv-input"
                  required
                />
                <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                  Find this in booking details or profile
                </p>
              </div>
            )}

            <div>
              <label className="bv-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="bv-input">
                <option value="property_issue">Property Issue</option>
                <option value="behavior">Behavior</option>
                <option value="payment">Payment</option>
                <option value="safety">Safety</option>
                <option value="fraud">Fraud</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="bv-label">Subject *</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief subject line"
                className="bv-input"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="bv-label">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe the issue in detail..."
                className="bv-input resize-none"
                maxLength={2000}
                required
              />
              <p className="text-[10px] text-[var(--bv-text-dim)] text-right mt-1">
                {description.length}/2000
              </p>
            </div>

            <div>
              <label className="bv-label">Evidence (optional)</label>
              <label className="bv-input min-h-11 flex items-center gap-2 cursor-pointer hover:border-[var(--bv-gold)] transition">
                <Paperclip size={16} className="text-[var(--bv-text-dim)]" />
                <span className="text-sm text-[var(--bv-text-dim)]">
                  Attach photos or videos of damage (max 5, ≤50MB each)
                </span>
                <input type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
              </label>
              {evidence.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {evidence.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs bg-[var(--bv-surface-2)] rounded-lg px-3 py-2"
                    >
                      <span className="truncate text-[var(--bv-text-muted)]">
                        {file.type.startsWith('video') ? '🎬' : '🖼️'} {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEvidence(idx)}
                        className="text-[var(--bv-danger)] hover:opacity-70 flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="p-4 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl flex items-start gap-3">
            <AlertTriangle size={16} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
              False complaints may result in your account being penalized. Please provide accurate information.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Complaint</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FileComplaint;
