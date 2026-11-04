import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Trash2, Search, ShieldCheck, BookMarked, User, X, Mail, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ROLES = {
  admin: { label: 'Administrator', icon: ShieldCheck, dot: 'bg-clay', perk: 'Otoritas Penuh', desc: 'Akses penuh: konfigurasi sistem, hak akses pengguna, dan seluruh data perpustakaan.' },
  pustakawan: { label: 'Pustakawan', icon: BookMarked, dot: 'bg-resin', perk: 'Koleksi & Sirkulasi', desc: 'Mengelola katalog buku fisik/digital, data anggota, peminjaman, dan denda.' },
  anggota: { label: 'Anggota', icon: User, dot: 'bg-ink', perk: 'Akses Baca & Reservasi', desc: 'Mencari katalog, membaca e-book, serta melihat riwayat pinjaman milik sendiri.' },
};
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');

function RolePill({ role }) {
  const Icon = ROLES[role].icon;
  const tone = role === 'admin' ? 'bg-clay-deep text-white' : role === 'pustakawan' ? 'bg-ink text-white' : 'badge-ink';
  return <span className={`badge ${tone}`}><Icon size={12} /> {role}</span>;
}

export default function Users() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const load = () => api('/users').then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const act = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const setRole = (id, role) => act(() => api(`/users/${id}`, { method: 'PATCH', body: { role } }));
  const remove = (u) => confirm(`Hapus ${u.full_name}?`) && act(() => api(`/users/${u.id}`, { method: 'DELETE' }));
  const create = (e) => {
    e.preventDefault();
    act(async () => { await api('/users', { method: 'POST', body: form }); setForm(null); });
  };

  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter((u) => (roleFilter === 'all' || u.role === roleFilter) &&
      (u.full_name.toLowerCase().includes(t) || (u.email ?? '').toLowerCase().includes(t)));
  }, [rows, q, roleFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">Pengaturan <span className="mx-1">›</span> <span className="text-clay-deep">Keamanan & Akses</span></div>
          <h1 className="text-4xl font-semibold tracking-tight">Pengguna & Hak Akses</h1>
          <p className="mt-1 text-sm text-muted">Kelola akun staf, pustakawan, dan otoritas tingkat sistem.{!isAdmin && ' (Mode baca saja)'}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setForm(form ? null : { full_name: '', email: '', password: '', role: 'pustakawan' })}><UserPlus size={16} /> Tambah Pengguna</button>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(ROLES).map(([key, r]) => (
          <div key={key} className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif text-lg font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} /> {r.label}</div>
              <span className="badge bg-parchment text-muted"><span className="tnum">{rows.filter((u) => u.role === key).length}</span> akun</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{r.desc}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-clay-deep"><r.icon size={14} /> {r.perk}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}

      {form && (
        <form onSubmit={create} className="panel space-y-4 p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div><h2 className="font-serif text-2xl font-semibold">Form Akun Baru</h2><p className="text-sm text-muted">Daftarkan kredensial akun staf atau pengguna baru.</p></div>
            <button type="button" className="icon-btn" onClick={() => setForm(null)}><X size={18} /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><label className="field-label">Nama lengkap *</label><div className="relative"><User size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" placeholder="Nama lengkap" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div></div>
            <div><label className="field-label">Email *</label><div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" type="email" placeholder="email@sekolah.sch.id" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div></div>
            <div><label className="field-label">Kata sandi sementara *</label><div className="relative"><Lock size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" type="password" placeholder="Min. 8 karakter" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div></div>
            <div><label className="field-label">Tingkat hak akses *</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Administrator</option><option value="pustakawan">Pustakawan</option><option value="anggota">Anggota</option>
              </select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary">Simpan Pengguna</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-52 flex-1 md:max-w-sm">
            <Search size={16} className="absolute left-4 top-3.5 text-muted" />
            <input className="input-pill pl-11!" placeholder="Saring nama atau email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input-pill w-auto!" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Semua peran ({rows.length})</option>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Pengguna</th><th>Email terdaftar</th><th>Role otoritas</th>{isAdmin && <th className="text-right">Aksi</th>}</tr></thead>
            <tbody>
              {shown.map((u) => {
                const me = u.id === user.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFDBCD] text-xs font-bold text-clay-deep">{initials(u.full_name)}</div>
                        <div>
                          <div className="flex items-center gap-2 font-semibold">{u.full_name}{me && <span className="badge bg-[#F9E3D5] text-clay-deep !px-2 !py-0">Anda</span>}</div>
                          <div className="tnum text-[11px] text-[#8C7A6B]">ID: {u.id.slice(0, 8).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-muted">{u.email}</td>
                    <td>
                      {isAdmin && !me
                        ? <select className="input-pill !w-auto !py-1.5 !text-xs" value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                            <option value="admin">admin</option><option value="pustakawan">pustakawan</option><option value="anggota">anggota</option>
                          </select>
                        : <RolePill role={u.role} />}
                    </td>
                    {isAdmin && <td className="text-right">{!me && <button className="icon-btn hover:!text-rust" title="Hapus" onClick={() => remove(u)}><Trash2 size={16} /></button>}</td>}
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={4} className="!h-24 text-center text-muted">Tidak ada pengguna yang cocok</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-parchment px-4 py-3 text-xs text-muted">Menampilkan <b className="tnum text-espresso">{shown.length}</b> dari <b className="tnum text-espresso">{rows.length}</b> pengguna terdaftar</div>
      </div>
    </div>
  );
}
