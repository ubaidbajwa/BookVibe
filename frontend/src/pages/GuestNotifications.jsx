import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../components/SocketContext';
import {
  Bell, CalendarClock, Wallet, ShieldAlert, Info, CheckCircle,
  Trash2, CheckSquare, Square, Loader2, ChevronRight, ArrowLeft, Siren, Utensils,
} from 'lucide-react';

const iconMap = {
  booking: CalendarClock,
  payment: Wallet,
  refund: ShieldAlert,
  property: Info,
  complaint: ShieldAlert,
  verification: CheckCircle,
  system: Bell,
  emergency: Siren,
  food: Utensils,
};

const timeAgo = (date) => {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const GuestNotifications = () => {
  const nav = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, deleteNotifications, clearAll } = useNotifications();

  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingSingle, setDeletingSingle] = useState(null);

  const allSelected = notifications.length > 0 && selected.size === notifications.length;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map((n) => n.id || n._id)));
    }
  };

  const handleOpen = (n) => {
    if (!n.isRead) markRead(n.id || n._id);
    if (n.link) nav(n.link);
  };

  const handleDeleteSingle = async (id) => {
    setDeletingSingle(id);
    try {
      await deleteNotification(id);
    } catch {
      // error silently handled
    } finally {
      setDeletingSingle(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    setDeleting(true);
    try {
      await deleteNotifications([...selected]);
      setSelected(new Set());
    } catch {
      // error silently handled
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    setDeleting(true);
    try {
      await clearAll();
    } catch {
      // error silently handled
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">My Account</p>
            <h1 className="font-display text-3xl text-[var(--bv-text)] flex items-center gap-3">
              <Bell size={28} className="text-[var(--bv-gold)]" /> Notifications
            </h1>
            <p className="text-sm text-[var(--bv-text-muted)] mt-1">
              {unreadCount} unread · {notifications.length} total
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => markAllRead()}
              disabled={!unreadCount}
              className="bv-btn-outline text-xs px-3 py-2 disabled:opacity-50"
            >
              Mark all read
            </button>
            {selected.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-[var(--bv-danger)] flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete ({selected.size})
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={deleting}
                className="bv-btn-outline text-xs px-3 py-2 text-[var(--bv-danger)] border-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] mb-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
            >
              {allSelected ? (
                <CheckSquare size={16} className="text-[var(--bv-gold)]" />
              ) : (
                <Square size={16} />
              )}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <span className="text-[10px] text-[var(--bv-text-dim)]">{selected.size} selected</span>
            )}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bv-card-static py-20 text-center">
            <Bell size={48} className="mx-auto text-[var(--bv-text-dim)] mb-4 opacity-20" />
            <p className="text-lg font-bold text-[var(--bv-text)]">No notifications</p>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">
              You'll see booking updates, payment confirmations, and more here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              const isUnread = !n.isRead;
              const isSelected = selected.has(n.id || n._id);

              return (
                <div
                  key={n.id || n._id}
                  className={`bv-card p-4 flex items-start gap-3 transition ${
                    isUnread ? '!border-[var(--bv-gold-border)] ring-1 ring-[var(--bv-gold)]/10' : ''
                  } ${isSelected ? 'bg-[var(--bv-gold-glow)]' : ''}`}
                >
                  <button
                    onClick={() => toggleSelect(n.id || n._id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-[var(--bv-gold)]" />
                    ) : (
                      <Square size={16} className="text-[var(--bv-text-dim)]" />
                    )}
                  </button>

                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                      n.severity === 'danger'
                        ? 'bg-red-500/10 text-[var(--bv-danger)] border-red-500/20'
                        : n.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : n.severity === 'success'
                        ? 'bg-emerald-500/10 text-[var(--bv-success)] border-emerald-500/20'
                        : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)] border-[var(--bv-border)]'
                    }`}
                  >
                    <Icon size={18} />
                  </div>

                  <button onClick={() => handleOpen(n)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[var(--bv-text)]">{n.title}</h3>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-[var(--bv-gold)]" />}
                    </div>
                    <p className="text-xs text-[var(--bv-text-muted)] mt-1 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-[var(--bv-text-dim)] mt-1.5">
                      {timeAgo(n.receivedAt || n.createdAt)}
                    </p>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {n.link && (
                      <button
                        onClick={() => handleOpen(n)}
                        className="p-1.5 rounded-lg text-[var(--bv-gold)] hover:bg-[var(--bv-gold-glow)] transition"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSingle(n.id || n._id)}
                      disabled={deletingSingle === (n.id || n._id)}
                      className="p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition disabled:opacity-50"
                    >
                      {deletingSingle === (n.id || n._id) ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
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

export default GuestNotifications;
