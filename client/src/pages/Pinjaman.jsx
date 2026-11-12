import { useCallback, useEffect, useState } from 'react';
import { BookCopy, RefreshCw, X, Wallet, CalendarClock, IdCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CardModal } from '../components/MemberCard';
import { api } from '../lib/api';
import { rupiah, tgl } from '../lib/format';
import StatusBadge from '../components/StatusBadge';

export default function Pinjaman() {
  const { user } = useAuth();
  const [card, setCard] = useState(false);
  const [loans, setLoans] = useState([]);
  const [fines, setFines] = useState([]);
  const [resv, setResv] = useState([]);
  const [msg, setMsg] = useState(null); // {type, text}
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, f, r] = await Promise.all([api('/borrowings'), api('/fines'), api('/reservations')]);
      setLoans(l); setFines(f); setResv(r);
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, okText) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: okText }); await load(); }
    catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(''); }
  };

  const active = loans.filter((b) => !b.return_date);
  const history = loans.filter((b) => b.return_date);
  const waiting = resv.filter((r) => r.status === 'waiting');
  const unpaid = fines.filter((f) => !f.is_paid);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Akun saya</span></div>
        <h1 className="text-4xl font-semibold tracking-tight">Pinjaman Saya</h1>
        <p className="mt-1 text-sm text-muted">Buku yang sedang dipinjam, denda, reservasi, dan riwayat.</p>
      </div>

      {user.member && (
        <button className="btn btn-ghost" onClick={() => setCard(true)}><IdCard size={16} /> Kartu Anggota Saya</button>
      )}

      {msg && <div className={`rounded-xl p-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-sage-soft text-sage' : 'bg-rust-soft text-rust'}`}>{msg.text}</div>}

      {unpaid.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-rust-soft p-4 text-sm text-rust">
          <Wallet size={18} className="mt-0.5 shrink-0" />
          <div><b>Denda belum dibayar: {rupiah(unpaid.reduce((a, f) => a + Number(f.amount), 0))}.</b> Selesaikan di meja perpustakaan sebelum meminjam lagi.</div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold"><BookCopy size={20} className="text-clay" /> Sedang dipinjam <span className="badge bg-parchment text-muted">{active.length}</span></h2>
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((b) => (
            <div key={b.id} className="card flex gap-4 p-4">
              {b.books?.cover_url ? <img src={b.books.cover_url} alt="" className="h-24 w-16 rounded object-cover shadow" /> : <div className="h-24 w-16 rounded bg-parchment" />}
              <div className="min-w-0 flex-1">
                <div className="font-serif font-semibold leading-tight">{b.books?.title}</div>
                <div className="text-xs text-muted">{b.books?.author}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge s={b.effective_status} />
                  <span>Jatuh tempo <b>{tgl(b.due_date)}</b></span>
                </div>
                {b.running_late_days > 0 && <div className="mt-1 text-xs font-semibold text-rust">Terlambat {b.running_late_days} hari · denda berjalan {rupiah(b.estimated_fine)}</div>}
                <button className="btn btn-ghost mt-3 !px-4 !py-1.5 !text-xs" disabled={b.renew_count >= 1 || busy === b.id}
                  onClick={() => act(b.id, () => api(`/borrowings/${b.id}/renew`, { method: 'POST' }), 'Peminjaman diperpanjang.')}>
                  <RefreshCw size={13} /> {b.renew_count >= 1 ? 'Sudah diperpanjang' : 'Perpanjang'}
                </button>
              </div>
            </div>
          ))}
          {!active.length && <div className="card p-6 text-center text-sm text-muted md:col-span-2">Tidak ada buku yang sedang dipinjam.</div>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold"><CalendarClock size={20} className="text-clay" /> Reservasi <span className="badge bg-parchment text-muted">{waiting.length}</span></h2>
        <div className="card divide-y divide-parchment">
          {waiting.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div><div className="font-semibold">{r.books?.title}</div><div className="text-xs text-muted">Dipesan {tgl(r.reservation_date)} · {r.books?.available_stock > 0 ? 'sekarang tersedia, silakan ke perpustakaan' : 'menunggu buku dikembalikan'}</div></div>
              <button className="icon-btn hover:!text-rust" title="Batalkan" disabled={busy === r.id} onClick={() => act(r.id, () => api(`/reservations/${r.id}`, { method: 'DELETE' }), 'Reservasi dibatalkan.')}><X size={17} /></button>
            </div>
          ))}
          {!waiting.length && <div className="p-6 text-center text-sm text-muted">Belum ada reservasi. Buku yang stoknya habis bisa direservasi dari halaman Katalog.</div>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Riwayat peminjaman</h2>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Buku</th><th>Dipinjam</th><th>Dikembalikan</th><th>Denda</th></tr></thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.id}>
                  <td className="max-w-[260px] truncate font-semibold">{b.books?.title}</td>
                  <td>{tgl(b.borrow_date)}</td><td>{tgl(b.return_date)}</td>
                  <td className="tnum">{b.fine ? <>{rupiah(b.fine.amount)} <span className={`badge ml-1 ${b.fine.is_paid ? 'badge-sage' : 'badge-rust'}`}>{b.fine.is_paid ? 'lunas' : 'belum'}</span></> : '–'}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={4} className="!h-20 text-center text-muted">Belum ada riwayat</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {card && <CardModal name={user.full_name} code={user.member.member_code} type={user.member.member_type} onClose={() => setCard(false)} />}
    </div>
  );
}
