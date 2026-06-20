import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import { getSocket } from '../../hooks/useSocket';
import {
  AlertCircle, ArrowRight, MessageSquareWarning, RefreshCw, Search,
  ShieldAlert, Sparkles, Send, Loader2, Trash2, ChevronDown, ChevronUp, ShieldX,
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
  const cfg = statusMap[s] || statusMap.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {s}
    </span>
  );
};

const HostComplaints = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const cardRefs = useRef({});

  const [received, setReceived] = useState([]);
  const [filed, setFiled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchComplaints(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ complaint }) => {
      setReceived((prev) => prev.map((c) => c._id === complaint._id ? complaint : c));
      setFiled((prev) => prev.map((c) => c._id === complaint._id ? complaint : c));
    };
    socket.on('complaint:message', handler);
    return () => socket.off('complaint:message', handler);
  }, []);

  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || (received.length === 0 && filed.length === 0)) return;
    const inReceived = received.some((c) => c._id === targetId);
    const inFiled = filed.some((c) => c._id === targetId);
    if (inReceived) setTab('received');
    else if (inFiled) setTab('filed');
    setExpanded(targetId);
    setTimeout(() => {
      cardRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [received, filed, searchParams]);

  const filtered = useMemo(() => {
    const list = tab === 'received' ? received : filed;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) =>
      i.subject?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.property?.name?.toLowerCase().includes(q) ||
      i.complainant?.username?.toLowerCase().includes(q) ||
      i.against?.username?.toLowerCase().includes(q)
    );
  }, [tab, received, filed, search]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const [againstRes, myRes] = await Promise.all([
        axios.get(`${BASE}/complaints/against-me`, getAuthConfig()),
        axios.get(`${BASE}/complaints/my`, getAuthConfig()),
      ]);
      setReceived(againstRes.data.complaints || []);
      setFiled(myRes.data.complaints || []);
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (id) => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${BASE}/complaints/${id}/reply`,
        { messageText: replyText.trim() },
        getAuthConfig()
      );
      if (res.data.success) {
        setReplyText('');
        if (tab === 'received') {
          setReceived((p) => p.map((c) => c._id === id ? res.data.complaint : c));
        } else {
          setFiled((p) => p.map((c) => c._id === id ? res.data.complaint : c));
        }
      }
    } catch {
      // error silently handled
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.delete(`${BASE}/complaints/${id}`, getAuthConfig());
      setConfirmDeleteId(null);
      setFiled((p) => p.filter((c) => c._id !== id));
    } catch (e) {
      if (e.response?.status === 404) {
        setFiled((p) => p.filter((c) => c._id !== id));
        setConfirmDeleteId(null);
      }
    } finally {
      setDeleting(null);
    }
  };

  const openCounterComplaint = (item) => {
    const query = new URLSearchParams();
    if (item.booking?._id) query.set('bookingId', item.booking._id);
    if (item.property?._id || item.booking?.propertyId?._id) query.set('propertyId', item.property?._id || item.booking?.propertyId?._id);
    if (item.complainant?._id) query.set('againstUserId', item.complainant._id);
    nav(`/file-complaint?${query.toString()}`);
  };

  const stats = {
    receivedOpen: received.filter((i) => i.status === 'open' || i.status === 'reviewing').length,
    filedResolved: filed.filter((i) => i.status === 'resolved').length,
    total: received.length + filed.length,
  };

  return (
    <div className="space-y-6">

      <section className="relative overflow-hidden rounded-2xl border border-[var(--bv-gold-border)] bg-[var(--bv-bg-raised)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--bv-gold)] mb-2">Trust & Resolution</p>
            <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">Complaints Centre</h1>
            <p className="text-sm text-[var(--bv-text-dim)] mt-1">Manage guest reports and your own filed complaints</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => nav('/file-complaint')} className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5">
              <ShieldAlert size={13} /> File Complaint
            </button>
            <button onClick={fetchComplaints} disabled={loading} className="bv-btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open Against You', value: stats.receivedOpen, icon: MessageSquareWarning, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
          { label: 'Your Resolved',    value: stats.filedResolved, icon: Sparkles,           color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Total Cases',      value: stats.total,         icon: AlertCircle,        color: 'text-[var(--bv-gold)]', bg: 'bg-[var(--bv-gold-glow)]' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bv-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {[
            { key: 'received', label: `Received (${received.length})` },
            { key: 'filed',    label: `Filed (${filed.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setExpanded(null); setReplyText(''); }}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                tab === key
                  ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                  : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)] hover:bg-[var(--bv-bg-raised)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bv-text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search complaints..."
            className="bv-input pl-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-36 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bv-card-static py-16 text-center">
          <AlertCircle size={40} className="mx-auto text-[var(--bv-text-dim)] opacity-25 mb-3" />
          <p className="font-bold text-[var(--bv-text)]">No complaints</p>
          <p className="text-sm text-[var(--bv-text-muted)] mt-1">
            {tab === 'received' ? 'No guest complaints against you' : "You haven't filed any complaints"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isExpanded = expanded === item._id;
            const counterpart = tab === 'received' ? item.complainant : item.against;
            const propertyName = item.property?.name || item.booking?.propertyId?.name || 'Property';
            const canReply    = tab === 'received' && (item.status === 'open' || item.status === 'reviewing');
            const canMessage  = tab === 'filed'    && (item.status === 'open' || item.status === 'reviewing');
            const canDeleteThis = tab === 'filed';
            const hostIsAgainst = tab === 'received';
            const hasWarning = item.adminAction === 'warn_both' ||
              (item.adminAction === 'warning' && (
                (hostIsAgainst && item.warnTarget === 'against') ||
                (!hostIsAgainst && item.warnTarget === 'complainant')
              ));
            const showDeleteConfirm = confirmDeleteId === item._id;

            return (
              <div
                key={item._id}
                ref={(el) => { cardRefs.current[item._id] = el; }}
                className={`bv-card overflow-hidden transition-all duration-300 ${searchParams.get('id') === item._id ? 'ring-2 ring-[var(--bv-gold)] ring-offset-2' : ''}`}
              >
                <div className={`h-1 w-full ${statusMap[item.status]?.dot || 'bg-amber-500'}`} />

                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge s={item.status} />
                        <span className="text-[10px] text-[var(--bv-text-dim)] uppercase tracking-wider">
                          {item.category?.replace('_', ' ')}
                        </span>
                        {item.conversationThread?.length > 0 && (
                          <span className="text-[10px] text-[var(--bv-gold)] flex items-center gap-0.5">
                            <Send size={9} /> {item.conversationThread.length}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[var(--bv-text)] truncate">{item.subject || 'Complaint'}</h3>
                      <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                        {tab === 'received' ? 'From: ' : 'Against: '}
                        <span className="font-semibold text-[var(--bv-text-muted)]">{counterpart?.username || '—'}</span>
                        <span className="mx-1.5 opacity-40">·</span>
                        {propertyName}
                        <span className="mx-1.5 opacity-40">·</span>
                        {fmtDate(item.createdAt)}
                      </p>
                      <p className="text-sm text-[var(--bv-text-muted)] mt-2 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setExpanded(isExpanded ? null : item._id); setReplyText(''); }}
                        className="bv-btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? 'Less' : 'View'}
                      </button>
                      {tab === 'received' && item.booking?._id && (
                        <button
                          onClick={() => openCounterComplaint(item)}
                          className="bv-btn-outline text-xs px-3 py-1.5 flex items-center gap-1 text-[var(--bv-gold)] border-[var(--bv-gold-border)]"
                        >
                          <ArrowRight size={12} /> Counter
                        </button>
                      )}
                      {canDeleteThis && (
                        <button
                          onClick={() => setConfirmDeleteId(showDeleteConfirm ? null : item._id)}
                          className="p-2 rounded-lg text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {hasWarning && (
                    <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                      <ShieldX size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold text-red-600 leading-snug">
                        Admin issued you a formal warning on this complaint. Please adhere to community guidelines.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    {[
                      { label: 'Property', value: propertyName },
                      { label: 'Booking',  value: `#${item.booking?._id?.slice(-6) || 'N/A'}` },
                      { label: 'Check-in', value: item.booking ? fmtDate(item.booking.checkIn) : '—' },
                      { label: 'Payment',  value: item.booking?.paymentStatus || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">{label}</p>
                        <p className="text-xs font-semibold text-[var(--bv-text)] mt-0.5 truncate capitalize">{value}</p>
                      </div>
                    ))}
                  </div>

                  {showDeleteConfirm && (
                    <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/15 bv-animate-in">
                      <p className="text-sm font-bold text-[var(--bv-text)]">Delete this complaint permanently?</p>
                      <p className="text-xs text-[var(--bv-text-dim)] mt-1">This cannot be undone.</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleDelete(item._id)}
                          disabled={deleting === item._id}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--bv-danger)] hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {deleting === item._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--bv-text-muted)] border border-[var(--bv-border)] hover:bg-[var(--bv-surface)] transition"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--bv-divider)] space-y-3 bv-animate-in">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                          Conversation {item.conversationThread?.length > 0 ? `(${item.conversationThread.length})` : ''}
                        </p>

                        {(!item.conversationThread || item.conversationThread.length === 0) ? (
                          <div className="py-6 text-center">
                            <Send size={22} className="mx-auto mb-2 text-[var(--bv-text-dim)] opacity-20" />
                            <p className="text-xs text-[var(--bv-text-dim)]">No messages yet. Start the conversation below.</p>
                          </div>
                        ) : (
                          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 pt-2">
                            {item.conversationThread.map((msg, i) => {
                              const myPartyId = idOf(tab === 'received' ? item.against : item.complainant);
                              const isMe = idOf(msg.senderId) === myPartyId;
                              const isAdmin = msg.senderRole === 'Admin';
                              const otherParty = tab === 'received' ? item.complainant : item.against;
                              const senderName = isMe ? 'You'
                                : isAdmin ? 'Support Team'
                                : (msg.senderId?.username || otherParty?.username || 'Other');

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

                      {(canReply || canMessage) ? (
                        <div className="flex gap-2 pt-1 border-t border-[var(--bv-divider)]">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type a message..."
                            className="bv-input flex-1 text-sm"
                            maxLength={1000}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(item._id); }}
                          />
                          <button
                            onClick={() => handleSend(item._id)}
                            disabled={!replyText.trim() || sending}
                            className="bv-btn-gold px-4 py-2 flex items-center gap-1.5 text-xs disabled:opacity-50 flex-shrink-0"
                          >
                            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Send
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-[var(--bv-text-dim)] italic text-center py-2 border-t border-[var(--bv-divider)]">
                          This complaint is <span className="font-semibold capitalize">{item.status}</span> — no further messages can be sent.
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
  );
};

export default HostComplaints;
