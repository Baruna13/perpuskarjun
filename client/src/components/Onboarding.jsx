import { useState } from 'react';
import { IdCard } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const TYPES = [['siswa', 'Siswa', 'Pelajar / murid'], ['guru', 'Guru', 'Tenaga pengajar'], ['staf', 'Staf', 'Tenaga kependidikan']];

// Ditampilkan untuk akun baru (register / Google) yang belum punya data keanggotaan
export default function Onboarding() {
  const { user, refresh } = useAuth();
  const [type, setType] = useState('siswa');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { await api('/auth/join', { method: 'POST', body: { member_type: type } }); await refresh(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="mx-auto mt-10 max-w-lg space-y-5">
      <div className="card space-y-5 p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBEADF] text-clay-deep"><IdCard size={24} /></div>
        <div>
          <h1 className="text-3xl font-semibold">Halo, {user.full_name.split(' ')[0]}!</h1>
          <p className="mt-1 text-sm text-muted">Satu langkah lagi: daftarkan keanggotaan perpustakaan Anda. Pustakawan akan memverifikasi sebelum Anda bisa meminjam buku.</p>
        </div>
        {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}
        <div className="grid gap-2">
          {TYPES.map(([k, label, desc]) => (
            <button key={k} onClick={() => setType(k)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${type === k ? 'border-clay bg-[#FBEADF]/50' : 'border-rule hover:border-clay/50'}`}>
              <span><b className="block text-sm">{label}</b><span className="text-xs text-muted">{desc}</span></span>
              <span className={`h-4 w-4 rounded-full border-2 ${type === k ? 'border-clay bg-clay' : 'border-rule'}`} />
            </button>
          ))}
        </div>
        <button className="btn btn-primary w-full" onClick={submit} disabled={busy}>{busy ? 'Mendaftarkan...' : 'Daftarkan Keanggotaan'}</button>
      </div>
    </div>
  );
}
