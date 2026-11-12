import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet, History, Search, Printer, X, AlertTriangle, CheckCircle2, ScanLine } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { rupiah, tgl } from '../lib/format';
import StatusBadge from '../components/StatusBadge';

const TABS = [['pinjam', 'Peminjaman', ArrowUpRight], ['kembali', 'Pengembalian', ArrowDownLeft], ['denda', 'Denda', Wallet], ['riwayat', 'Riwayat', History]];

function useDebouncedLoad(load, deps) {
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, deps); // eslint-disable-line
}

// ---------- Struk peminjaman ----------
function Receipt({ data, officer, onClose }) {
  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="modal w-full max-w-sm p-6">
        <div className="print-area space-y-1 font-mono text-xs leading-relaxed">
          <div className="text-center text-sm font-bold">DIGILIB · PERPUSTAKAAN</div>
          <div className="text-center">BUKTI PEMINJAMAN</div>
          <div className="my-2 border-t border-dashed border-espresso/40" />
          <div>No      : #{data.id.slice(0, 8).toUpperCase()}</div>
          <div>Anggota : {data.members?.member_code}</div>
          <div>Nama    : {data.members?.profiles?.full_name}</div>
          <div className="my-2 border-t border-dashed border-espresso/40" />
          <div>Buku    : {data.books?.title}</div>
          <div>ISBN    : {data.books?.isbn}</div>
          <div>Pinjam  : {tgl(data.borrow_date)}</div>
          <div className="font-bold">Kembali : {tgl(data.due_date)}</div>
          <div className="my-2 border-t border-dashed border-espresso/40" />
          <div>Petugas : {officer}</div>
          <div className="pt-2 text-center">Keterlambatan dikenakan denda sesuai ketentuan perpustakaan.</div>
        </div>
        <div className="no-print mt-5 flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Tutup</button>
          <button className="btn btn-primary flex-1" onClick={() => window.print()}><Printer size={15} /> Cetak</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Peminjaman ----------
function BorrowTab() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [member, setMember] = useState(null);
  const [isbn, setIsbn] = useState('');
  const [book, setBook] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const codeRef = useRef(null);
  const isbnRef = useRef(null);

  const findMember = async (e) => {
    e.preventDefault(); setErr(''); setMember(null); setBook(null);
    try { setMember(await api(`/members/by-code/${encodeURIComponent(code.trim())}`)); setTimeout(() => isbnRef.current?.focus(), 50); }
    catch { setErr('Anggota dengan kode tersebut tidak ditemukan'); }
  };
  const findBook = async (e) => {
    e.preventDefault(); setErr(''); setBook(null);
    try { setBook(await api(`/books/by-isbn/${encodeURIComponent(isbn.trim())}`)); }
    catch { setErr('Buku dengan ISBN tersebut tidak ditemukan'); }
  };
  const reset = () => { setCode(''); setMember(null); setIsbn(''); setBook(null); setErr(''); setTimeout(() => codeRef.current?.focus(), 50); };

  const issues = [];
  if (member) {
    if (!member.is_active) issues.push('Keanggotaan belum aktif / non-aktif');
    if (member.active_count >= member.max_limit) issues.push(`Kuota pinjam penuh (${member.active_count}/${member.max_limit})`);
    if (member.unpaid_fines > 0) issues.push(`Ada denda belum dibayar ${rupiah(member.unpaid_fines)}`);
  }
  if (book && book.available_stock <= 0) issues.push('Stok buku habis');

  const borrow = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api('/borrowings', { method: 'POST', body: { member_code: member.member_code, isbn: book.isbn } });
      setReceipt(r); reset();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card space-y-5 p-5">
        <div className="flex items-center gap-2 font-serif text-xl font-semibold"><ScanLine size={20} className="text-clay" /> Langkah 1 · Anggota</div>
        <form onSubmit={findMember} className="flex gap-2">
          <input ref={codeRef} autoFocus className="input" placeholder="Scan / ketik kode anggota (LIB-2026-001)" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary">Cari</button>
        </form>
        {member && (
          <div className="rounded-2xl bg-parchment/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-serif text-lg font-semibold">{member.profiles?.full_name}</div>
                <div className="font-mono text-xs font-bold text-clay-deep">{member.member_code}</div></div>
              <span className="badge badge-ink">{member.member_type}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><div className="field-label !mb-0">Sedang dipinjam</div><b className="tnum">{member.active_count} / {member.max_limit} buku</b></div>
              <div><div className="field-label !mb-0">Denda belum dibayar</div><b className="tnum">{rupiah(member.unpaid_fines)}</b></div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 font-serif text-xl font-semibold"><ScanLine size={20} className="text-clay" /> Langkah 2 · Buku</div>
        <form onSubmit={findBook} className="flex gap-2">
          <input ref={isbnRef} className="input" placeholder="Scan / ketik ISBN buku" value={isbn} onChange={(e) => setIsbn(e.target.value)} disabled={!member} />
          <button className="btn btn-primary" disabled={!member}>Cari</button>
        </form>
        {book && (
          <div className="flex gap-3 rounded-2xl bg-parchment/70 p-4">
            {book.cover_url && <img src={book.cover_url} alt="" className="h-20 w-14 rounded object-cover shadow" />}
            <div className="min-w-0">
              <div className="font-serif font-semibold leading-tight">{book.title}</div>
              <div className="text-xs text-muted">{book.author} · {book.shelf_location}</div>
              <span className={`badge mt-2 ${book.available_stock > 0 ? 'badge-sage' : 'badge-rust'}`}>{book.available_stock} dari {book.total_stock} tersedia</span>
            </div>
          </div>
        )}
      </div>

      <div className="card flex flex-col justify-between gap-5 p-5">
        <div className="space-y-3">
          <h3 className="font-serif text-xl font-semibold">Konfirmasi peminjaman</h3>
          {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
          {issues.map((t) => <div key={t} className="flex items-start gap-2 rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t}</div>)}
          {member && book && !issues.length && (
            <div className="flex items-start gap-2 rounded-xl bg-sage-soft p-3 text-sm font-medium text-sage"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> Semua validasi lolos. Jatuh tempo dihitung otomatis sesuai tipe anggota.</div>
          )}
          {!member && <p className="text-sm text-muted">Mulai dengan memindai kartu anggota, lalu barcode buku. Scanner barcode USB bekerja seperti keyboard, cukup fokus ke kolom input.</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={reset}>Reset</button>
          <button className="btn btn-primary flex-1" disabled={!member || !book || issues.length > 0 || busy} onClick={borrow}>{busy ? 'Memproses...' : 'Pinjamkan Buku'}</button>
        </div>
      </div>

      {receipt && <Receipt data={receipt} officer={user.full_name} onClose={() => setReceipt(null)} />}
    </div>
  );
}

// ---------- Pengembalian ----------
function ReturnTab() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [target, setTarget] = useState(null);
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/borrowings?scope=active&q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setErr(e.message)), [q]);
  useDebouncedLoad(load, [load]);

  const confirmReturn = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api(`/borrowings/${target.id}/return`, { method: 'POST', body: { is_paid: paid } });
      setMsg({ title: target.books?.title, ...r }); setTarget(null); setPaid(false); load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-sage-soft p-4 text-sm text-sage">
          <div><b>"{msg.title}" berhasil dikembalikan.</b> Stok diperbarui otomatis.
            {msg.late_days > 0 ? <> Terlambat <b>{msg.late_days} hari</b>, denda <b>{rupiah(msg.fine_amount)}</b> ({msg.fine?.is_paid ? 'sudah dibayar' : 'belum dibayar, cek tab Denda'}).</> : ' Tidak ada denda.'}</div>
          <button onClick={() => setMsg(null)}><X size={16} /></button>
        </div>
      )}
      {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-4 top-3.5 text-muted" />
        <input className="input-pill pl-11!" placeholder="Cari kode / nama anggota, judul, atau ISBN" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Anggota</th><th>Buku</th><th>Dipinjam</th><th>Jatuh tempo</th><th>Status</th><th>Denda berjalan</th><th /></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><div className="font-semibold">{b.members?.profiles?.full_name}</div><div className="font-mono text-[11px] text-clay-deep">{b.members?.member_code}</div></td>
                <td className="max-w-[220px] truncate">{b.books?.title}</td>
                <td className="whitespace-nowrap">{tgl(b.borrow_date)}</td>
                <td className="whitespace-nowrap">{tgl(b.due_date)}</td>
                <td><StatusBadge s={b.effective_status} />{b.running_late_days > 0 && <span className="ml-1 text-xs text-rust">{b.running_late_days} hr</span>}</td>
                <td className="tnum">{b.estimated_fine > 0 ? rupiah(b.estimated_fine) : '–'}</td>
                <td className="text-right"><button className="btn btn-primary !px-4 !py-1.5 !text-xs" onClick={() => { setTarget(b); setPaid(false); setErr(''); }}>Kembalikan</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="!h-24 text-center text-muted">Tidak ada buku yang sedang dipinjam</td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="modal w-full max-w-md space-y-4 p-6">
            <h3 className="font-serif text-2xl font-semibold">Konfirmasi pengembalian</h3>
            <div className="rounded-2xl bg-parchment/70 p-4 text-sm">
              <div className="font-serif text-lg font-semibold">{target.books?.title}</div>
              <div className="text-muted">{target.members?.profiles?.full_name} · {target.members?.member_code}</div>
              <div className="mt-2">Jatuh tempo: <b>{tgl(target.due_date)}</b></div>
            </div>
            {target.running_late_days > 0 ? (
              <div className="space-y-2 rounded-2xl bg-rust-soft p-4 text-sm text-rust">
                <div className="flex items-center gap-2 font-bold"><AlertTriangle size={16} /> Terlambat {target.running_late_days} hari</div>
                <div>Denda: <b className="tnum text-base">{rupiah(target.estimated_fine)}</b></div>
                <label className="flex cursor-pointer items-center gap-2 font-medium"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-[#C26D45]" /> Denda dibayar sekarang</label>
              </div>
            ) : <div className="rounded-2xl bg-sage-soft p-4 text-sm font-medium text-sage">Tepat waktu, tidak ada denda.</div>}
            {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setTarget(null)}>Batal</button>
              <button className="btn btn-primary" onClick={confirmReturn} disabled={busy}>{busy ? 'Memproses...' : 'Konfirmasi'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Denda ----------
function FinesTab() {
  const [status, setStatus] = useState('unpaid');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  const load = useCallback(() => api(`/fines${status === 'all' ? '' : `?status=${status}`}`).then(setRows).catch((e) => setErr(e.message)), [status]);
  useEffect(() => { load(); }, [load]);

  const pay = async (f) => {
    setErr('');
    try { await api(`/fines/${f.id}/pay`, { method: 'PATCH' }); load(); } catch (e) { setErr(e.message); }
  };
  const total = rows.filter((f) => !f.is_paid).reduce((a, f) => a + Number(f.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="input-pill w-auto!" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="unpaid">Belum dibayar</option><option value="paid">Sudah lunas</option><option value="all">Semua denda</option>
        </select>
        <div className="text-sm text-muted">Total belum dibayar (tampilan ini): <b className="tnum text-rust">{rupiah(total)}</b></div>
      </div>
      {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Anggota</th><th>Buku</th><th>Terlambat</th><th>Denda</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td><div className="font-semibold">{f.borrowings?.members?.profiles?.full_name}</div><div className="font-mono text-[11px] text-clay-deep">{f.borrowings?.members?.member_code}</div></td>
                <td className="max-w-[220px] truncate">{f.borrowings?.books?.title}</td>
                <td className="tnum">{f.late_days} hari</td>
                <td className="tnum font-semibold">{rupiah(f.amount)}</td>
                <td>{f.is_paid ? <span className="badge badge-sage">Lunas · {tgl(f.paid_at)}</span> : <span className="badge badge-rust">Belum dibayar</span>}</td>
                <td className="text-right">{!f.is_paid && <button className="btn btn-primary !px-4 !py-1.5 !text-xs" onClick={() => pay(f)}>Tandai Lunas</button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="!h-24 text-center text-muted">Tidak ada data denda</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Riwayat ----------
function HistoryTab() {
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  const load = useCallback(() => api(`/borrowings?scope=${scope}&q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setErr(e.message)), [scope, q]);
  useDebouncedLoad(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1 md:max-w-sm">
          <Search size={16} className="absolute left-4 top-3.5 text-muted" />
          <input className="input-pill pl-11!" placeholder="Cari anggota, judul, atau ISBN" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input-pill w-auto!" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Semua transaksi</option><option value="active">Sedang dipinjam</option><option value="overdue">Terlambat</option><option value="returned">Sudah kembali</option>
        </select>
      </div>
      {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Anggota</th><th>Buku</th><th>Pinjam</th><th>Jatuh tempo</th><th>Kembali</th><th>Status</th><th>Denda</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><div className="font-semibold">{b.members?.profiles?.full_name}</div><div className="font-mono text-[11px] text-clay-deep">{b.members?.member_code}</div></td>
                <td className="max-w-[220px] truncate">{b.books?.title}</td>
                <td className="whitespace-nowrap">{tgl(b.borrow_date)}</td>
                <td className="whitespace-nowrap">{tgl(b.due_date)}</td>
                <td className="whitespace-nowrap">{tgl(b.return_date)}</td>
                <td><StatusBadge s={b.effective_status} /></td>
                <td className="tnum">{b.fine ? rupiah(b.fine.amount) : b.estimated_fine > 0 ? <span className="text-rust">{rupiah(b.estimated_fine)}*</span> : '–'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="!h-24 text-center text-muted">Belum ada transaksi</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">* denda berjalan (buku belum dikembalikan)</p>
    </div>
  );
}

export default function Sirkulasi() {
  const [tab, setTab] = useState('pinjam');
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Sirkulasi</span></div>
        <h1 className="text-4xl font-semibold tracking-tight">Sirkulasi Buku</h1>
        <p className="mt-1 text-sm text-muted">Peminjaman, pengembalian, dan manajemen denda.</p>
      </div>
      <div className="no-print flex w-fit max-w-full overflow-x-auto rounded-full bg-parchment p-1">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-white text-clay-deep shadow-sm' : 'text-muted hover:text-espresso'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'pinjam' && <BorrowTab />}
      {tab === 'kembali' && <ReturnTab />}
      {tab === 'denda' && <FinesTab />}
      {tab === 'riwayat' && <HistoryTab />}
    </div>
  );
}
