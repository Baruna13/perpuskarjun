import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BookMarked, Users, ShieldCheck, ArrowRight, Plus, UserPlus, UserCog, CalendarDays, Layers, Wallet, AlertTriangle, ArrowLeftRight, Flame } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { rupiah, tgl } from '../lib/format';
import ShelfBook from '../components/ShelfBook';
import BookReader from '../components/BookReader';
import StatusBadge from '../components/StatusBadge';

function Stat({ icon: Icon, label, value, sub, tone = 'bg-white/80' }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`} style={{ boxShadow: '0 2px 8px -2px rgba(44,27,21,.05)' }}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted"><Icon size={14} /> {label}</div>
      <div className="tnum mt-1 font-serif text-3xl font-semibold text-clay-deep">{value ?? '–'}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function ShelfSection({ icon: Icon, title, badge, to, books, onRead }) {
  if (!books?.length) return null;
  return (
    <section className="panel p-5 md:p-7">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-parchment text-clay-deep"><Icon size={20} /></div>
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          {badge && <span className="badge bg-[#F9E3D5] text-clay-deep">{badge}</span>}
        </div>
        <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-clay-deep hover:underline">Lihat semua <ArrowRight size={15} /></Link>
      </div>
      <div className="shelf-grid">{books.map((b) => <ShelfBook key={b.id} book={b} onRead={onRead} />)}</div>
    </section>
  );
}

function Action({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl bg-parchment/70 p-4 transition hover:bg-parchment">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-clay-deep shadow-sm"><Icon size={19} /></div>
      <div><div className="text-sm font-bold">{title}</div><div className="text-xs text-muted">{desc}</div></div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isStaff = user.role !== 'anggota';
  const [s, setS] = useState(null);
  const [fresh, setFresh] = useState([]);
  const [reader, setReader] = useState(null);

  useEffect(() => {
    api('/stats').then(setS).catch(() => {});
    api('/books?limit=6&sort=new').then((r) => setFresh(r.data)).catch(() => {});
  }, []);

  const first = user.full_name.split(' ')[0];
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const read = (b) => setReader({ id: b.id, title: b.title });
  const roleLine = { admin: 'Akses Admin Terotentikasi', pustakawan: 'Akses Pustakawan', anggota: 'Akses Anggota' }[user.role];
  const borrowedCopies = s ? Number(s.total_copies) - Number(s.available_copies) : null;

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-3xl p-6 md:p-8" style={{ background: 'linear-gradient(135deg, #FBEADF 0%, #F9F1E6 60%, #FDF3E7 100%)', border: '1px solid rgba(224,212,196,.6)' }}>
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-clay-deep">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> {roleLine}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-muted"><CalendarDays size={13} /> {today}</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Halo, <em className="text-clay-deep">{first}</em></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Selamat datang di DigiLib{user.member ? <> · kode anggota <b className="tnum text-espresso">{user.member.member_code}</b></> : ''}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={BookOpen} label="Judul buku" value={s?.total_titles} sub={`${s?.ebooks ?? 0} e-book`} />
          <Stat icon={Layers} label="Eksemplar" value={s?.total_copies} sub={s ? `${s.available_copies} tersedia · ${borrowedCopies} dipinjam` : ''} tone="bg-ochre-soft" />
          {isStaff && <Stat icon={Users} label="Anggota aktif" value={s?.active_members} sub={s?.pending_members ? `${s.pending_members} menunggu verifikasi` : 'terverifikasi'} tone="bg-sage-soft" />}
          {isStaff && <Stat icon={AlertTriangle} label="Terlambat" value={s?.overdue_now} sub={s ? `Denda belum dibayar ${rupiah(s.unpaid_fines)}` : ''} tone="bg-rust-soft" />}
        </div>
      </section>

      {isStaff && s?.today && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-parchment text-clay-deep"><ArrowLeftRight size={20} /></div>
              <div><h2 className="font-serif text-xl font-semibold">Transaksi Hari Ini</h2>
                <p className="text-xs text-muted"><b className="tnum">{s.borrowed_today}</b> dipinjam · <b className="tnum">{s.returned_today}</b> dikembalikan</p></div>
            </div>
            <Link to="/sirkulasi" className="flex items-center gap-1 text-sm font-semibold text-clay-deep hover:underline">Buka sirkulasi <ArrowRight size={15} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Anggota</th><th>Buku</th><th>Pinjam</th><th>Jatuh tempo</th><th>Status</th></tr></thead>
              <tbody>
                {s.today.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">{b.members?.profiles?.full_name}</td>
                    <td className="max-w-[240px] truncate">{b.books?.title}</td>
                    <td>{tgl(b.borrow_date)}</td><td>{tgl(b.due_date)}</td>
                    <td><StatusBadge s={b.effective_status} /></td>
                  </tr>
                ))}
                {!s.today.length && <tr><td colSpan={5} className="!h-20 text-center text-muted">Belum ada transaksi hari ini</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ShelfSection icon={Flame} title="Paling Sering Dipinjam" badge="Populer" to="/books" books={s?.popular} onRead={read} />
      <ShelfSection icon={BookMarked} title="Katalog Baru Masuk" badge="Terbaru" to="/books" books={fresh} onRead={read} />

      <section className="card p-5 md:p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold">Aksi Cepat</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Action to="/books" icon={BookOpen} title="Jelajahi Katalog" desc="Cari judul, penulis, atau ISBN" />
          {isStaff && <Action to="/sirkulasi" icon={ArrowLeftRight} title="Pinjam / Kembali" desc="Transaksi cepat dengan scan" />}
          {isStaff && <Action to="/books" icon={Plus} title="Tambah Buku" desc="Entri katalog baru + e-book" />}
          {isStaff && <Action to="/members" icon={UserPlus} title="Tambah Anggota" desc="Daftarkan siswa, guru, atau staf" />}
          {user.role === 'admin' && <Action to="/users" icon={UserCog} title="Kelola Pengguna" desc="Atur role dan hak akses" />}
          {!isStaff && <Action to="/pinjaman" icon={Wallet} title="Pinjaman Saya" desc="Perpanjang, denda, reservasi" />}
        </div>
      </section>

      {reader && <BookReader book={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
