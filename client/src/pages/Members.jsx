import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, UserSquare2, ShieldCheck, UserX, UserPlus, Search, X, Mail, Lock, User } from 'lucide-react';
import { api } from '../lib/api';

const EMPTY = { full_name: '', email: '', password: '', member_type: 'siswa' };
const TABS = [['all', 'Semua'], ['siswa', 'Siswa'], ['guru', 'Guru'], ['staf', 'Staf']];
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
const TYPE_BADGE = { siswa: 'bg-parchment text-muted', guru: 'bg-[#DCE8F7] text-ink', staf: 'bg-ochre-soft text-ochre' };

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBEADF] text-clay-deep"><Icon size={20} /></div>
      <div><div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div><div className="tnum font-serif text-2xl font-semibold">{value}</div></div>
    </div>
  );
}

export default function Members() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  const load = () => api('/members').then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/members', { method: 'POST', body: form }); setForm(null); load(); }
    catch (err) { setError(err.message); }
  };
  const toggle = async (m) => {
    try { await api(`/members/${m.id}`, { method: 'PATCH', body: { is_active: !m.is_active } }); load(); }
    catch (err) { setError(err.message); }
  };

  const count = (t) => rows.filter((m) => m.member_type === t).length;
  const shown = useMemo(() => {
    const term = q.toLowerCase();
    return rows.filter((m) =>
      (tab === 'all' || m.member_type === tab) &&
      (status === 'all' || (status === 'active') === !!m.is_active) &&
      (m.member_code.toLowerCase().includes(term) || (m.profiles?.full_name ?? '').toLowerCase().includes(term) || (m.email ?? '').toLowerCase().includes(term)));
  }, [rows, q, tab, status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Keanggotaan</span></div>
          <h1 className="text-4xl font-semibold tracking-tight">Data Anggota</h1>
          <p className="mt-1 text-sm text-muted">Kelola keanggotaan siswa, guru, dan staf perpustakaan.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(form ? null : EMPTY)}><UserPlus size={16} /> Tambah Anggota</button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={GraduationCap} label="Total siswa" value={count('siswa')} />
        <Stat icon={UserSquare2} label="Total guru" value={count('guru')} />
        <Stat icon={ShieldCheck} label="Anggota aktif" value={rows.filter((m) => m.is_active).length} />
        <Stat icon={UserX} label="Non-aktif" value={rows.filter((m) => !m.is_active).length} />
      </div>

      {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}

      {form && (
        <form onSubmit={create} className="panel space-y-4 p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Pendaftaran Anggota Baru</h2>
              <p className="text-sm text-muted">Akun login dibuat otomatis, kode anggota digenerate (LIB-tahun-urut).</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setForm(null)}><X size={18} /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><label className="field-label">Nama lengkap</label>
              <div className="relative"><User size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" placeholder="mis. Raden Ayu Kartini" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div></div>
            <div><label className="field-label">Email</label>
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" type="email" placeholder="anggota@sekolah.sch.id" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div></div>
            <div><label className="field-label">Password awal</label>
              <div className="relative"><Lock size={16} className="absolute left-3.5 top-3 text-muted" /><input className="input pl-10!" type="password" placeholder="Min. 8 karakter" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div></div>
            <div><label className="field-label">Tipe anggota</label>
              <select className="input" value={form.member_type} onChange={(e) => setForm({ ...form, member_type: e.target.value })}>
                <option value="siswa">Siswa</option><option value="guru">Guru</option><option value="staf">Staf</option>
              </select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary">Simpan Anggota</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex rounded-full bg-parchment p-1">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === k ? 'bg-white text-clay-deep shadow-sm' : 'text-muted hover:text-espresso'}`}>
                {label} <span className="tnum text-xs opacity-70">({k === 'all' ? rows.length : count(k)})</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-52 flex-1 md:max-w-xs">
            <Search size={16} className="absolute left-4 top-3.5 text-muted" />
            <input className="input-pill pl-11!" placeholder="Cari nama, email, atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input-pill w-auto!" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Status: Semua</option><option value="active">Aktif</option><option value="inactive">Non-aktif</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Kode</th><th>Nama anggota</th><th>Email</th><th>Tipe</th><th>Batas pinjam</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-bold text-clay-deep">{m.member_code}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFDBCD] text-xs font-bold text-clay-deep">{initials(m.profiles?.full_name)}</div>
                      <span className="font-semibold">{m.profiles?.full_name}</span>
                    </div>
                  </td>
                  <td className="text-muted">{m.email ?? '–'}</td>
                  <td><span className={`badge ${TYPE_BADGE[m.member_type]}`}>{m.member_type}</span></td>
                  <td className="tnum">{m.max_borrow_limit} buku</td>
                  <td>
                    <button onClick={() => toggle(m)} title="Klik untuk ubah status" className={`badge ${m.is_active ? 'badge-sage' : 'badge-rust'}`}>
                      ● {m.is_active ? 'Aktif' : 'Non-aktif'}
                    </button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={6} className="!h-24 text-center text-muted">Belum ada anggota yang cocok</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-parchment px-4 py-3 text-xs text-muted">Menampilkan <b className="tnum text-espresso">{shown.length}</b> dari <b className="tnum text-espresso">{rows.length}</b> anggota</div>
      </div>
    </div>
  );
}
