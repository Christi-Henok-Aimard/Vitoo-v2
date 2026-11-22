import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Star } from 'lucide-react';
import { notificationsApi, errorMessage } from '../api';
import { usePolling } from '../lib/hooks';
import { relativeTime } from '../lib/format';
import { useApp } from '../lib/context';
import { localizedNotification } from '../i18n';
import { Empty, Spinner } from '../lib/ui';
import { RatingModal } from './RatingModal';
import type { Notification } from '../types';

export function NotificationBell({ token, allowRating = false }: { token: string; allowRating?: boolean }) {
  const { toast, lang, t } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ratingTrip, setRatingTrip] = useState<{ id: string; label: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list(token);
      setItems(res.notifications || []);
      setUnread(res.unread || 0);
    } catch {
      /* silencieux : la cloche reste utilisable */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);
  usePolling(load, 15000);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const markAll = async () => {
    try {
      await notificationsApi.readAll(token);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const markOne = async (n: Notification) => {
    if (!n.read) {
      try {
        await notificationsApi.read(token, n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* ignore */
      }
    }
    if (allowRating && n.type === 'arrived' && n.tripId) {
      setOpen(false);
      setRatingTrip({ id: n.tripId, label: n.title });
    }
  };

  return (
    <div className="bell" ref={wrapRef}>
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen((v) => !v)} aria-label={t('notifications')}>
        <Bell size={19} />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong>{t('notifications')}</strong>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => void markAll()}>
                <CheckCheck size={14} /> {t('markAllRead')}
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
            ) : items.length === 0 ? (
              <div style={{ padding: 8 }}><Empty icon={Bell} title={t('noNotifications')} text={t('allGood')} /></div>
            ) : (
              items.map((n) => {
                const isDriverAdded = n.type === 'driver_added';
                const text = isDriverAdded
                  ? { title: t('driverAddedTitle'), body: `${n.title} ${t('driverAddedBody')}` }
                  : localizedNotification(lang, n.type, { title: n.title, body: n.body });
                return (
                <div
                  key={n.id}
                  style={{
                    background: n.read ? 'transparent' : 'var(--primary-soft)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <button
                    onClick={() => void markOne(n)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 0,
                      padding: '12px 14px 6px',
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{text.title}</span>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{text.body}</span>
                      </span>
                      {allowRating && n.type === 'arrived' && n.tripId && (
                        <span className="badge badge-warning" style={{ flexShrink: 0 }}>
                          <Star size={11} /> {t('rateTrip')}
                        </span>
                      )}
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>{relativeTime(n.createdAt)}</span>
                  </button>
                  {isDriverAdded && (
                    <div style={{ padding: '0 14px 12px' }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => { void markOne(n); setOpen(false); navigate('/driver/missions'); }}
                      >
                        {t('driverSpace')}
                      </button>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      )}
      {ratingTrip && <RatingModal tripId={ratingTrip.id} tripLabel={ratingTrip.label} onClose={() => setRatingTrip(null)} />}
    </div>
  );
}
