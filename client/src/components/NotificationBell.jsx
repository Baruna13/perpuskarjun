import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Info } from 'lucide-react';
import { api } from '../lib/api';

const LEVEL = {
  danger: { icon: AlertTriangle, cls: 'bg-rust-soft text-rust' },
  warn: { icon: Clock, cls: 'bg-ochre-soft text-ochre' },
  info: { icon: Info, cls: 'bg-parchment text-muted' },
};

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => api('/notifications').then(setItems).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted shadow-sm transition hover:text-clay" style={{ border: '1px solid rgba(224,212,196,.7)' }} title="Notifikasi">
        <Bell size={18} />
        {items.length > 0 && <span className="tnum absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-80 max-w-[85vw] overflow-hidden shadow-xl">
          <div className="border-b border-parchment px-4 py-3 font-serif text-lg font-semibold">Notifikasi</div>
          <div className="max-h-96 divide-y divide-parchment overflow-y-auto">
            {items.map((n) => {
              const L = LEVEL[n.level] ?? LEVEL.info;
              return (
                <Link key={n.id} to={n.link ?? '/'} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 transition hover:bg-parchment/50">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${L.cls}`}><L.icon size={16} /></div>
                  <div className="min-w-0"><div className="text-sm font-bold">{n.title}</div><div className="text-xs text-muted">{n.body}</div></div>
                </Link>
              );
            })}
            {!items.length && <div className="p-6 text-center text-sm text-muted">Tidak ada notifikasi. Semua aman.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
