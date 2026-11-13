import { useEffect, useState } from 'react';
import { Download, Save, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';

const TYPES = [['siswa', 'Siswa'], ['guru', 'Guru'], ['staf', 'Staf']];

export default function Pengaturan() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [backupInfo, setBackupInfo] = useState(null);

  useEffect(() => { api('/settings').then(setS).catch((e) => setMsg({ type: 'err', text: e.message })); }, []);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy('save'); setMsg(null);
    try {
      await api('/settings', { method: 'PATCH', body: s });
      setMsg({ type: 'ok', text: 'Pengaturan disimpan. Berlaku untuk transaksi berikutnya.' });
    } catch (x) { setMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  const backup = async () => {
    setBusy('backup'); setMsg(null);
    try {
      const data = await api('/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `digilib-backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setBackupInfo(data.meta);
    } catch (x) { setMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-muted">Pengaturan <span className="mx-1">›</span> <span className="text-clay-deep">Sistem</span></div>
        <h1 className="text-4xl font-semibold tracking-tight">Pengaturan Sistem</h1>
        <p className="mt-1 text-sm text-muted">Aturan peminjaman, denda, dan cadangan data. Hanya admin.</p>
      </div>
      {msg && <div className={`rounded-xl p-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-sage-soft text-sage' : 'bg-rust-soft text-rust'}`}>{msg.text}</div>}

      <form onSubmit={save} className="card space-y-5 p-5 md:p-6">
        <h2 className="font-serif text-2xl font-semibold">Aturan Perpustakaan</h2>
        {!s && <div className="text-muted">Memuat...</div>}
        {s && (
          <>
            <div className="max-w-xs"><label className="field-label">Tarif denda per hari (Rp)</label><input className="input tnum" type="number" min="0" value={s.fine_per_day ?? ''} onChange={set('fine_per_day')} required /></div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Tipe anggota</th><th>Masa pinjam (hari)</th><th>Maks. buku dipinjam</th></tr></thead>
                <tbody>
                  {TYPES.map(([k, label]) => (
                    <tr key={k}>
                      <td className="font-semibold">{label}</td>
                      <td><input className="input tnum !w-28" type="number" min="1" value={s[`loan_days_${k}`] ?? ''} onChange={set(`loan_days_${k}`)} required /></td>
                      <td><input className="input tnum !w-28" type="number" min="1" value={s[`max_borrow_${k}`] ?? ''} onChange={set(`max_borrow_${k}`)} required /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="max-w-xs"><label className="field-label">Tambahan hari saat perpanjangan</label><input className="input tnum" type="number" min="1" value={s.renew_days ?? ''} onChange={set('renew_days')} required /></div>
            <p className="text-xs text-muted">Perubahan hanya berlaku untuk peminjaman baru. Jatuh tempo pinjaman yang sudah berjalan tidak berubah.</p>
            <button className="btn btn-primary" disabled={busy === 'save'}><Save size={16} /> {busy === 'save' ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
          </>
        )}
      </form>

      <section className="card space-y-4 p-5 md:p-6">
        <h2 className="font-serif text-2xl font-semibold">Backup Data</h2>
        <p className="text-sm leading-relaxed text-muted">Unduh seluruh data perpustakaan (pengguna, anggota, buku, transaksi, denda, reservasi, ulasan, wishlist, pengadaan, pengaturan) sebagai satu file JSON. Password tidak ikut diekspor.</p>
        <div className="flex items-start gap-3 rounded-2xl bg-ochre-soft p-4 text-sm text-ochre">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>File sampul dan e-book <b>tidak</b> ikut, cadangkan bucket dari dashboard Supabase. File backup berisi data pribadi anggota, simpan di tempat aman. Untuk database yang sangat besar, gunakan fitur backup bawaan Supabase.</div>
        </div>
        <button className="btn btn-primary" onClick={backup} disabled={busy === 'backup'}><Download size={16} /> {busy === 'backup' ? 'Menyiapkan...' : 'Unduh Backup (JSON)'}</button>
        {backupInfo && (
          <div className="rounded-2xl bg-sage-soft p-4 text-sm text-sage">
            <b>Backup selesai.</b> Isi: {Object.entries(backupInfo.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </div>
        )}
      </section>
    </div>
  );
}
