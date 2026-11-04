import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Library, BookOpen, ScanLine, BookMarked } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); nav('/'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen bg-linen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: 'linear-gradient(155deg, #914722 0%, #5B3A29 55%, #231B15 100%)' }}>
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-resin/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-clay/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5 font-serif text-2xl font-semibold"><Library /> DigiLib</div>
        <div className="relative space-y-8">
          <h1 className="font-serif text-5xl font-semibold leading-[1.1] tracking-tight">Ruang baca<br />yang hangat,<br /><em className="text-[#FFB595]">kini digital.</em></h1>
          <ul className="space-y-3 text-[#FEEEE3]/90">
            <li className="flex items-center gap-3"><BookOpen size={19} /> Katalog buku fisik & e-book</li>
            <li className="flex items-center gap-3"><ScanLine size={19} /> Peminjaman cepat dengan kartu QR</li>
            <li className="flex items-center gap-3"><BookMarked size={19} /> Baca e-book seperti buku sungguhan</li>
          </ul>
        </div>
        <div className="relative text-xs font-semibold uppercase tracking-wider text-white/50">Sand & Cedar · {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
          <div className="flex items-center gap-2 font-serif text-2xl font-semibold text-clay-deep lg:hidden"><Library /> DigiLib</div>
          <div>
            <h2 className="text-3xl font-semibold">Selamat datang</h2>
            <p className="mt-1 text-sm text-muted">Masuk untuk melanjutkan ke perpustakaan.</p>
          </div>
          {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}
          <div className="space-y-3">
            <div><label className="field-label">Email</label><input className="input" type="email" placeholder="nama@sekolah.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label className="field-label">Password</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Masuk...' : 'Masuk'}</button>
        </form>
      </div>
    </div>
  );
}
