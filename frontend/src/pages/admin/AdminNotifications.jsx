import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../components/SocketContext';
import {
  Bell, CalendarClock, Wallet, ShieldAlert, Info, CheckCircle,
  Trash2, CheckSquare, Square, Loader2, ChevronRight, Siren, Utensils, AlertCircle, X,
} from 'lucide-react';

const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

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

const AdminNotifications = () => {
  const nav = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, deleteNotifications, clearAll } = useNotifications();

  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingSingle, setDeletingSingle] = useState(null);
  const [pageError, setPageError] = useState(null);

  const allSelected = notifications.length > 0 && selected.size === notifications.length;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
    setSelected(new Set());
    const bookingId = n.bookingId || n.data?.bookingId;
    if (bookingId) { nav(`/${P}/bookings/${bookingId}`); return; }
    if (n.link?.startsWith('/host/bookings/')) {
      nav(`/${P}/bookings/${n.link.split('/').pop()}`);
      return;
    }
    if (n.link?.startsWith('/admin/')) {
      nav(`/${P}/${n.link.slice('/admin/'.length)}`);
      return;
    }
    if (n.link) nav(n.link);
  };

  const handleDeleteSingle = async (id) => {
    setDeletingSingle(id);
    try {
      await deleteNotification(id);
    } catch {
      setPageError('Failed to delete notification. Please try again.');
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
      setPageError('Failed to delete selected notifications. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    setDeleting(true);
    try {
      await clearAll();
      setSelected(new Set());
    } catch {
      setPageError('Failed to clear notifications. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {pageError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
          <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--bv-danger)] uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-3">
            <Bell size={26} className="text-[var(--bv-gold)]" /> Notifications
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            {unreadCount} unread · {notifications.length} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={markAllRead}
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
              className="bv-btn-outline text-xs px-3 py-2 text-[var(--bv-danger)] border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
          >
            {allSelected
              ? <CheckSquare size={16} className="text-[var(--bv-gold)]" />
              : <Square size={16} />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          {selected.size > 0 && (
            <span className="text-[10px] text-[var(--bv-text-dim)]">{selected.size} selected</span>
          )}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bv-card-static py-20 text-center">
          <Bell size={42} className="mx-auto text-[var(--bv-text-dim)] mb-4 opacity-20" />
          <p className="text-lg font-bold text-[var(--bv-text-muted)]">No notifications yet</p>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            Booking alerts, verification updates, and complaints will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const key = n.id || n._id;
            const Icon = iconMap[n.type] || Bell;
            const isUnread = !n.isRead;
            const isSelected = selected.has(key);

            return (
              <div
                key={key}
                className={`bv-card p-4 flex items-start gap-3 transition ${
                  isUnread ? '!border-[var(--bv-gold-border)] ring-1 ring-[var(--bv-gold)]/10' : ''
                } ${isSelected ? 'bg-[var(--bv-gold-glow)]' : ''}`}
              >
                <button onClick={() => toggleSelect(key)} className="mt-1 flex-shrink-0">
                  {isSelected
                    ? <CheckSquare size={16} className="text-[var(--bv-gold)]" />
                    : <Square size={16} className="text-[var(--bv-text-dim)]" />}
                </button>

                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  n.severity === 'danger'  ? 'bg-red-500/10 text-[var(--bv-danger)] border-red-500/20'
                  : n.severity === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : n.severity === 'success' ? 'bg-emerald-500/10 text-[var(--bv-success)] border-emerald-500/20'
                  : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)] border-[var(--bv-border)]'
                }`}>
                  <Icon size={18} />
                </div>

                <button onClick={() => handleOpen(n)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--bv-text)]">{n.title}</h3>
                    {isUnread && <span className="bv-badge bv-badge-gold text-[9px]">New</span>}
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
                    onClick={() => handleDeleteSingle(key)}
                    disabled={deletingSingle === key}
                    className="p-1.5 rounded-lg text-[var(--bv-text-dim)] hover:text-[var(--bv-danger)] hover:bg-red-500/10 transition disabled:opacity-50"
                  >
                    {deletingSingle === key
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
