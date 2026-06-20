import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import {
  ShieldCheck, RefreshCw, CheckCircle, XCircle, Eye, X,
  CreditCard, Fingerprint, ScanFace, User, Calendar, MapPin,
  AlertTriangle, ShieldAlert, BadgeCheck, Clock, Briefcase, Users, AlertCircle
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const KYCQueue = () => {
  const [hosts, setHosts] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoad, setActionLoad] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('host');
  const [pageError, setPageError] = useState(null);
  const [formError, setFormError] = useState(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${BASE}/user/admin/kyc-queue`, getAuthConfig());
      setHosts(r.data.hosts || []);
      setGuests(r.data.guests || []);
      setPageError(null);
    } catch {
      setPageError('Failed to load KYC queue. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleAction = async (id, action) => {
    if (action === 'reject' && !rejectReason.trim()) {
      setFormError('Please provide a reason for rejection.');
      return;
    }
    setFormError(null);
    try {
      setActionLoad(id);
      await axios.patch(
        `${BASE}/user/admin/verify-kyc/${id}`,
        { action, rejectedReason: rejectReason },
        getAuthConfig()
      );
      setHosts((prev) => prev.filter((item) => item._id !== id));
      setGuests((prev) => prev.filter((item) => item._id !== id));
      setDetail(null);
      setRejectReason('');
    } catch (error) {
      setPageError(error.response?.data?.message || 'Verification action failed. Try again.');
    } finally {
      setActionLoad(null);
    }
  };

  const activeList = activeTab === 'host' ? hosts : guests;

  return (
    <div className="space-y-8">
      {pageError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
          <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl p-6 bv-animate-in max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--bv-divider)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--bv-text)] flex items-center gap-2">
                  <Fingerprint className="text-[var(--bv-gold)]" size={24} />
                  Identity Verification Review
                </h3>
                <p className="text-sm text-[var(--bv-text-dim)]">
                  Reviewing {detail.role}: {detail.username}
                  {detail.role === 'guest' && detail.kycAiAttempts > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                      {detail.kycAiAttempts} AI attempt(s) failed
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setDetail(null); setRejectReason(''); setFormError(null); }}
                className="p-2 hover:bg-[var(--bv-surface)] rounded-xl transition"
              >
                <X size={20} className="text-[var(--bv-text-dim)]" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Images */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">CNIC FRONT</p>
                    <div className="aspect-[1.6/1] rounded-xl overflow-hidden border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                      {detail.cnicImage?.frontImage?.url ? (
                        <img src={detail.cnicImage.frontImage.url} alt="CNIC Front"
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => window.open(detail.cnicImage.frontImage.url, '_blank')} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--bv-text-dim)] text-xs">No Image</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">LIVE SELFIE</p>
                    <div className="aspect-[1.6/1] rounded-xl overflow-hidden border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                      {detail.selfieImage?.url ? (
                        <img src={detail.selfieImage.url} alt="Selfie"
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => window.open(detail.selfieImage.url, '_blank')} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--bv-text-dim)] text-xs">No Image</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="text-[var(--bv-gold)]" size={18} />
                    <p className="text-sm font-bold text-[var(--bv-text)]">Visual Comparison Hint</p>
                  </div>
                  <p className="text-xs text-[var(--bv-text-muted)] leading-relaxed">
                    Compare the face on the CNIC with the live selfie. Check for lighting consistency and facial features.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">CNIC BACK</p>
                  <div className="aspect-[1.6/1] rounded-xl overflow-hidden border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                    {detail.cnicImage?.backImage?.url ? (
                      <img src={detail.cnicImage.backImage.url} alt="CNIC Back"
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => window.open(detail.cnicImage.backImage.url, '_blank')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--bv-text-dim)] text-xs">No Image</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Data & Actions */}
              <div className="space-y-6">
                <div className="bv-card-static p-5 bg-[var(--bv-surface)]">
                  <p className="text-xs font-bold text-[var(--bv-text-dim)] uppercase tracking-widest mb-4">Extracted Data</p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-[var(--bv-divider)]">
                      <span className="text-xs text-[var(--bv-text-muted)] flex items-center gap-2"><User size={14} /> Full Name</span>
                      <span className="text-sm font-bold text-[var(--bv-text)]">{detail.cnicData?.fullName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--bv-divider)]">
                      <span className="text-xs text-[var(--bv-text-muted)] flex items-center gap-2"><CreditCard size={14} /> CNIC Number</span>
                      <span className="text-sm font-bold text-[var(--bv-gold)]">{detail.cnicData?.cnicNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--bv-divider)]">
                      <span className="text-xs text-[var(--bv-text-muted)] flex items-center gap-2"><Calendar size={14} /> Date of Birth</span>
                      <span className="text-sm font-bold text-[var(--bv-text)]">{detail.cnicData?.dateOfBirth || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--bv-divider)]">
                      <span className="text-xs text-[var(--bv-text-muted)] flex items-center gap-2"><MapPin size={14} /> Address</span>
                      <span className="text-sm font-bold text-[var(--bv-text)]">{detail.cnicData?.address || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--bv-card)] border border-[var(--bv-border)]">
                      <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold mb-1">Face Match</p>
                      <p className={`text-lg font-black ${detail.cnicData?.faceMatchScore >= 70 ? 'text-[var(--bv-success)]' : 'text-[var(--bv-danger)]'}`}>
                        {detail.cnicData?.faceMatchScore || 0}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bv-card)] border border-[var(--bv-border)]">
                      <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold mb-1">OCR Confidence</p>
                      <p className={`text-lg font-black ${detail.cnicData?.confidence >= 80 ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-warning)]'}`}>
                        {detail.cnicData?.confidence || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="bv-label">Rejection Reason</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => { setRejectReason(e.target.value); setFormError(null); }}
                      rows={3}
                      placeholder="Specify why you are rejecting this identity..."
                      className="bv-input text-sm resize-none"
                    />
                    {formError && (
                      <p className="text-xs text-[var(--bv-danger)] mt-1 flex items-center gap-1.5">
                        <AlertTriangle size={11} /> {formError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAction(detail._id, 'approve')}
                      disabled={actionLoad === detail._id}
                      className="flex-1 bv-btn-gold py-3.5 flex items-center justify-center gap-2"
                    >
                      <BadgeCheck size={18} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(detail._id, 'reject')}
                      disabled={actionLoad === detail._id}
                      className="flex-1 py-3.5 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 transition flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-3">
            <ShieldAlert size={28} className="text-[var(--bv-gold)]" />
            KYC Verification Queue
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Manual review for hosts (always) and guests (after 5 AI failures)
          </p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-[var(--bv-surface)] rounded-xl w-fit border border-[var(--bv-border)]">
        <button
          onClick={() => setActiveTab('host')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'host'
              ? 'bg-[var(--bv-gold)] text-[var(--bv-bg)] shadow-sm'
              : 'text-[var(--bv-text-dim)] hover:text-[var(--bv-text)]'
          }`}
        >
          <Briefcase size={15} />
          Hosts
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'host' ? 'bg-black/20 text-[var(--bv-bg)]' : 'bg-[var(--bv-card)] text-[var(--bv-text)]'
          }`}>
            {hosts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('guest')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'guest'
              ? 'bg-[var(--bv-gold)] text-[var(--bv-bg)] shadow-sm'
              : 'text-[var(--bv-text-dim)] hover:text-[var(--bv-text)]'
          }`}
        >
          <Users size={15} />
          Guests
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'guest' ? 'bg-black/20 text-[var(--bv-bg)]' : 'bg-[var(--bv-card)] text-[var(--bv-text)]'
          }`}>
            {guests.length}
          </span>
        </button>
      </div>

      {/* Tab description */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] text-xs text-[var(--bv-text-muted)]">
        {activeTab === 'host' ? (
          <>
            <Briefcase size={14} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--bv-text)]">Hosts</strong> always require manual admin approval before listing properties, regardless of AI verification score.
            </span>
          </>
        ) : (
          <>
            <Users size={14} className="text-[var(--bv-gold)] flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--bv-text)]">Guests</strong> shown here have failed AI verification 5 times. They are sent for manual review only after exhausting all AI attempts.
            </span>
          </>
        )}
      </div>

      {/* Queue Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-48 rounded-2xl" />)}
        </div>
      ) : activeList.length === 0 ? (
        <div className="bv-card-static py-24 text-center">
          <BadgeCheck size={64} className="mx-auto mb-4 text-[var(--bv-success)] opacity-20" />
          <h3 className="text-xl font-bold text-[var(--bv-text)]">
            {activeTab === 'host' ? 'No Pending Host Verifications' : 'No Pending Guest Verifications'}
          </h3>
          <p className="text-sm text-[var(--bv-text-dim)] mt-2">
            {activeTab === 'host'
              ? 'All host verification requests have been reviewed.'
              : 'No guests have exhausted their AI verification attempts yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeList.map((item) => (
            <div key={item._id} className="bv-card p-5 group hover:border-[var(--bv-gold-border)] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={item.profileImage?.url || '/default-avatar.png'}
                      alt={item.username}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--bv-border)]"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--bv-card)] rounded-full flex items-center justify-center border border-[var(--bv-border)]">
                      {item.role === 'host'
                        ? <Briefcase size={10} className="text-[var(--bv-gold)]" />
                        : <User size={10} className="text-blue-400" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--bv-text)] truncate max-w-[150px]">{item.username}</h3>
                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">{item.role}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">
                    <Clock size={10} /> PENDING
                  </span>
                  {item.role === 'guest' && item.kycAiAttempts > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                      {item.kycAiAttempts} AI fails
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--bv-text-muted)]">Face Match</span>
                  <span className={`font-bold ${item.cnicData?.faceMatchScore >= 70 ? 'text-[var(--bv-success)]' : 'text-[var(--bv-danger)]'}`}>
                    {item.cnicData?.faceMatchScore || 0}%
                  </span>
                </div>
                <div className="w-full h-1 bg-[var(--bv-surface)] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${item.cnicData?.faceMatchScore >= 70 ? 'bg-[var(--bv-success)]' : 'bg-[var(--bv-danger)]'}`}
                    style={{ width: `${item.cnicData?.faceMatchScore || 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--bv-text-dim)] flex items-center gap-1">
                  <Calendar size={10} /> Submitted {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setDetail(item)}
                className="w-full bv-btn-gold py-2.5 text-xs flex items-center justify-center gap-2 group-hover:scale-[1.02] transition"
              >
                <Eye size={14} /> Review Identity
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KYCQueue;
