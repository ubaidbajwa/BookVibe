import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';
import { getSocket } from '../hooks/useSocket';
import {
  AlertCircle, Plus, RefreshCw, CalendarDays, CreditCard, Home, Hash,
  Trash2, Send, Loader2, MessageSquare, ChevronDown, ChevronUp, AlertTriangle, X,
  ShieldAlert, CheckCircle2, Clock3, XCircle, ShieldX,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const statusMap = {
  open:      { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',       dot: 'bg-amber-500' },
  reviewing: { badge: 'bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] border-[var(--bv-gold-border)]', dot: 'bg-[var(--bv-gold)]' },
  resolved:  { badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' },
  dismissed: { badge: 'bg-red-500/10 text-red-600 border-red-500/20',             dot: 'bg-red-500' },
};

const fmtDate = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const idOf = (v) => (v && typeof v === 'object' ? v._id : v)?.toString();

const Badge = ({ s }) => {
  const key = s?.split(' ')[0]?.toLowerCase();
  const cfg = statusMap[key] || statusMap.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {s}
    </span>
  );
};

const DeleteModal = ({ show, loading, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] p-6 bv-animate-in">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:bg-[var(--bv-surface)] transition">
          <X size={16} />
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} className="text-[var(--bv-danger)]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--bv-text)]">Delete this complaint?</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-1">This will permanently remove the complaint and all its messages.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const MyComplaints = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const cardRefs = useRef({});

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchComplaints(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ complaint }) => {
      setComplaints((prev) => prev.map((c) => c._id === complaint._id ? complaint : c));
    };
    socket.on('complaint:message', handler);
    return () => socket.off('complaint:message', handler);
  }, []);

  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || complaints.length === 0) return;
    setExpanded(targetId);
    setTimeout(() => {
      cardRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [complaints, searchParams]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${BASE}/complaints/my`, getAuthConfig());
      setComplaints(r.data.complaints || []);
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.delete(`${BASE}/complaints/${id}`, getAuthConfig());
      setComplaints((p) => p.filter((c) => c._id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      if (e.response?.status === 404) {
        setComplaints((p) => p.filter((c) => c._id !== id));
        setConfirmDeleteId(null);
      } else {
        // error silently handled
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleSendMessage = async (id) => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${BASE}/complaints/${id}/reply`,
        { messageText: newMsg.trim() },
        getAuthConfig()
      );
      if (res.data.success) {
        setNewMsg('');
        setComplaints((p) => p.map((c) => c._id === id ? res.data.complaint : c));
      }
    } catch {
      // error silently handled
    } finally {
      setSending(false);
    }
  };

  const statusCounts = {
    open:      complaints.filter((c) => c.status === 'open').length,
    reviewing: complaints.filter((c) => c.status === 'reviewing').length,
    resolved:  complaints.filter((c) => c.status === 'resolved').length,
    dismissed: complaints.filter((c) => c.status === 'dismissed').length,
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <DeleteModal
        show={!!confirmDeleteId}
        loading={deleting === confirmDeleteId}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <div className="max-w-4xl mx-auto space-y-6">

        <section className="relative overflow-hidden rounded-2xl border border-[var(--bv-gold-border)] bg-[var(--bv-bg-raised)] p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">Support Centre</p>
              <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">My Complaints</h1>
              <p className="text-sm text-[var(--bv-text-dim)] mt-1">
                {complaints.length} complaint{complaints.length !== 1 ? 's' : ''} filed
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchComplaints}
                disabled={loading}
                className="bv-btn-outline text-sm px-4 py-2.5 flex items-center gap-2"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => nav('/file-complaint')} className="bv-btn-gold text-sm px-4 py-2.5 flex items-center gap-2">
                <Plus size={14} /> File New
              </button>
            </div>
          </div>
        </section>

        {complaints.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'open',      label: 'Open',      icon: Clock3,       color: 'text-amber-500',   bg: 'bg-amber-500/10' },
              { key: 'reviewing', label: 'Reviewing', icon: RefreshCw,    color: 'text-[var(--bv-gold)]', bg: 'bg-[var(--bv-gold-glow)]' },
              { key: 'resolved',  label: 'Resolved',  icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { key: 'dismissed', label: 'Dismissed', icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-500/10' },
            ].map(({ key, label, icon: Icon, color, bg }) => (
              <div key={key} className="bv-card p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={14} className={color} />
                </div>
                <div>
                  <p className={`text-lg font-black ${color}`}>{statusCounts[key]}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-44 rounded-2xl" />)}
          </div>
        ) : complaints.length === 0 ? (
          <div className="bv-card-static py-20 text-center">
            <ShieldAlert size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20" />
            <p className="font-bold text-[var(--bv-text)]">No complaints filed</p>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2 mb-6">
              If you have an issue with a booking or host, let us know.
            </p>
            <button onClick={() => nav('/file-complaint')} className="bv-btn-gold text-sm px-6 py-3 inline-flex items-center gap-2">
              <Plus size={14} /> File a Complaint
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((c) => {
              const isExpanded = expanded === c._id;
              const canMessage = c.status === 'open' || c.status === 'reviewing';

              return (
                <div
                  key={c._id}
                  ref={(el) => { cardRefs.current[c._id] = el; }}
                  className={`bv-card overflow-hidden transition-all duration-300 ${searchParams.get('id') === c._id ? 'ring-2 ring-[var(--bv-gold)] ring-offset-2' : ''}`}
                >
                  <div className={`h-1 w-full ${statusMap[c.status]?.dot || 'bg-amber-500'}`} />

                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge s={c.status} />
                          <span className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-wider">
                            {c.category?.replace('_', ' ')}
                          </span>
                          {c.conversationThread?.length > 0 && (
                            <span className="text-[10px] text-[var(--bv-gold)] flex items-center gap-0.5">
                              <MessageSquare size={9} /> {c.conversationThread.length}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-[var(--bv-text)]">{c.subject}</p>
                        <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                          Against: <span className="font-semibold text-[var(--bv-text-muted)]">{c.against?.username || '—'}</span>
                          <span className="mx-1.5 opacity-40">·</span>
                          {fmtDate(c.createdAt)}
                        </p>
                        <p className="text-sm text-[var(--bv-text-muted)] mt-2 line-clamp-2">{c.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setExpanded(isExpanded ? null : c._id); setNewMsg(''); }}
                          className="bv-btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded ? 'Less' : 'View'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(c._id)}
                          className="p-2 rounded-lg text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {(c.adminAction === 'warn_both' || (c.adminAction === 'warning' && c.warnTarget === 'complainant')) && (
                      <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                        <ShieldX size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-red-600 leading-snug">
                          Admin issued you a formal warning on this complaint. Please adhere to community guidelines.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      {[
                        { icon: Home,         label: 'Property', value: c.property?.name || c.booking?.propertyId?.name || 'N/A' },
                        { icon: Hash,         label: 'Booking',  value: `#${c.booking?._id?.slice(-6) || 'N/A'}` },
                        { icon: CalendarDays, label: 'Check-in', value: c.booking ? fmtDate(c.booking.checkIn) : '—' },
                        { icon: CreditCard,   label: 'Payment',  value: c.booking?.paymentStatus || '—' },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] px-3 py-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)] flex items-center gap-1 mb-1">
                            <Icon size={9} /> {label}
                          </p>
                          <p className="text-xs font-semibold text-[var(--bv-text)] truncate capitalize">{value}</p>
                        </div>
                      ))}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[var(--bv-divider)] space-y-3 bv-animate-in">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                            Conversation {c.conversationThread?.length > 0 ? `(${c.conversationThread.length})` : ''}
                          </p>

                          {(!c.conversationThread || c.conversationThread.length === 0) ? (
                            <div className="py-6 text-center">
                              <MessageSquare size={24} className="mx-auto mb-2 text-[var(--bv-text-dim)] opacity-25" />
                              <p className="text-xs text-[var(--bv-text-dim)]">No messages yet. Start the conversation below.</p>
                            </div>
                          ) : (
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 pt-2">
                              {c.conversationThread.map((msg, i) => {
                                const isMe = idOf(msg.senderId) === idOf(c.complainant);
                                const isAdmin = msg.senderRole === 'Admin';
                                const senderName = isMe ? 'You'
                                  : isAdmin ? 'Support Team'
                                  : (msg.senderId?.username || c.against?.username || 'Host');

                                if (isAdmin) {
                                  return (
                                    <div key={i} className="px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-center">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                                        Support Team · {fmtDate(msg.createdAt)}
                                      </p>
                                      <p className="text-xs text-[var(--bv-text-muted)]">{msg.messageText}</p>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={i}
                                    className={`max-w-[80%] p-3 rounded-2xl ${
                                      isMe
                                        ? 'ml-auto rounded-tr-sm bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)]'
                                        : 'mr-auto rounded-tl-sm bg-[var(--bv-surface)] border border-[var(--bv-border)]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <p className={`text-[10px] font-bold ${isMe ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'}`}>
                                        {senderName}
                                      </p>
                                      <p className="text-[9px] text-[var(--bv-text-dim)] flex-shrink-0">{fmtDate(msg.createdAt)}</p>
                                    </div>
                                    <p className="text-xs text-[var(--bv-text-muted)] leading-relaxed">{msg.messageText}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {canMessage ? (
                          <div className="flex gap-2 pt-1 border-t border-[var(--bv-divider)]">
                            <input
                              value={newMsg}
                              onChange={(e) => setNewMsg(e.target.value)}
                              placeholder="Type a message..."
                              className="bv-input flex-1 text-sm"
                              maxLength={1000}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendMessage(c._id); }}
                            />
                            <button
                              onClick={() => handleSendMessage(c._id)}
                              disabled={!newMsg.trim() || sending}
                              className="bv-btn-gold px-4 py-2 flex items-center gap-1.5 text-xs disabled:opacity-50 flex-shrink-0"
                            >
                              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Send
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-[var(--bv-text-dim)] italic text-center py-2 border-t border-[var(--bv-divider)]">
                            Complaint is <span className="font-semibold capitalize">{c.status}</span> — no further messages can be sent.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyComplaints;
