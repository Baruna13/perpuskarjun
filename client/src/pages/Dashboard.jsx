import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BookMarked, Users, IdCard, ShieldCheck, ArrowRight, Plus, UserPlus, UserCog, CalendarDays } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import ShelfBook from '../components/ShelfBook';
import BookReader from '../components/BookReader';

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`} style={{ boxShadow: '0 2px 8px -2px rgba(44,27,21,.05)' }}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted"><Icon size={14} /> {label}</div>
      <div className="tnum mt-1 font-serif text-3xl font-semibold text-clay-deep">{value ?? '–'}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function ShelfSection({ icon: Icon, title, badge, to, books, onRead }) {
  if (!books.length) return null;
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
      <div className="shelf-grid">
        {books.map((b) => <ShelfBook key={b.id} book={b} onRead={onRead} />)}
      </div>
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
  const [stats, setStats] = useState({});
  const [fresh, setFresh] = useState([]);
  const [ebooks, setEbooks] = useState([]);
  const [reader, setReader] = useState(null);

  useEffect(() => {
    const set = (k) => (v) => setStats((s) => ({ ...s, [k]: v }));
    api('/books?limit=1').then((r) => set('books')(r.total)).catch(() => {});
    api('/books?limit=1&ebook=true').then((r) => set('ebooks')(r.total)).catch(() => {});
    api('/books?limit=6&sort=new').then((r) => setFresh(r.data)).catch(() => {});
    api('/books?limit=6&ebook=true').then((r) => setEbooks(r.data)).catch(() => {});
    if (isStaff) api('/members').then((r) => set('members')(r.length)).catch(() => {});
  }, [isStaff]);

  const first = user.full_name.split(' ')[0];
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const read = (b) => setReader({ id: b.id, title: b.title });
  const roleLine = { admin: 'Akses Admin Terotentikasi', pustakawan: 'Akses Pustakawan', anggota: 'Akses Anggota' }[user.role];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 rounded-3xl p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center" style={{ background: 'linear-gradient(135deg, #FBEADF 0%, #F9F1E6 60%, #FDF3E7 100%)', border: '1px solid rgba(224,212,196,.6)' }}>
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-clay-deep">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> {roleLine}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-muted"><CalendarDays size={13} /> {today}</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Halo, <em className="text-clay-deep">{first}</em></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Selamat datang di DigiLib{user.member ? <> · kode anggota <b className="tnum text-espresso">{user.member.member_code}</b></> : ''}. Jelajahi koleksi di rak, atau lanjutkan membaca e-book favorit Anda.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={BookOpen} label="Judul buku" value={stats.books} tone="bg-white/80" />
          <Stat icon={BookMarked} label="E-book" value={stats.ebooks} tone="bg-ochre-soft" />
          {isStaff
            ? <Stat icon={Users} label="Anggota" value={stats.members} sub="terdaftar" tone="bg-sage-soft" />
            : <Stat icon={IdCard} label="Kartu" value={user.member?.member_type ?? '–'} tone="bg-sage-soft" />}
        </div>
      </section>

      <ShelfSection icon={BookOpen} title="Katalog Baru Masuk" badge="Terbaru" to="/books" books={fresh} onRead={read} />
      <ShelfSection icon={BookMarked} title="E-book untuk Dibaca" badge="Digital" to="/books" books={ebooks} onRead={read} />

      <section className="card p-5 md:p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold">Aksi Cepat</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Action to="/books" icon={BookOpen} title="Jelajahi Katalog" desc="Cari judul, penulis, atau ISBN" />
          {isStaff && <Action to="/books" icon={Plus} title="Tambah Buku" desc="Entri katalog baru + e-book" />}
          {isStaff && <Action to="/members" icon={UserPlus} title="Tambah Anggota" desc="Daftarkan siswa, guru, atau staf" />}
          {user.role === 'admin' && <Action to="/users" icon={UserCog} title="Kelola Pengguna" desc="Atur role dan hak akses" />}
        </div>
      </section>

      {reader && <BookReader book={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
