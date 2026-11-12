import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Library, BookOpen, ScanLine, BookMarked } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.9z"/>
  </svg>
);

export default function Login() {
  const { user, login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [f, setF] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'login') await login(f.email, f.password);
      else {
        const r = await register(f);
        if (r.needsConfirm) { setInfo('Pendaftaran berhasil. Cek email Anda dan klik tautan konfirmasi, lalu masuk.'); setMode('login'); }
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const google = async () => {
    setError('');
    try { await loginWithGoogle(); } catch (err) { setError(err.message); }
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
            <li className="flex items-center gap-3"><ScanLine size={19} /> Peminjaman cepat dengan kartu anggota</li>
            <li className="flex items-center gap-3"><BookMarked size={19} /> Baca e-book seperti buku sungguhan</li>
          </ul>
        </div>
        <div className="relative text-xs font-semibold uppercase tracking-wider text-white/50">Sand & Cedar · {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="card w-full max-w-sm space-y-5 p-8">
          <div className="flex items-center gap-2 font-serif text-2xl font-semibold text-clay-deep lg:hidden"><Library /> DigiLib</div>
          <div>
            <h2 className="text-3xl font-semibold">{mode === 'login' ? 'Selamat datang' : 'Buat akun'}</h2>
            <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Masuk untuk melanjutkan ke perpustakaan.' : 'Daftar sebagai anggota perpustakaan.'}</p>
          </div>

          <button type="button" onClick={google} className="btn btn-ghost w-full !bg-white"><GoogleLogo /> Lanjutkan dengan Google</button>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-rule" /> atau pakai email <span className="h-px flex-1 bg-rule" /></div>

          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}
            {info && <div className="rounded-xl bg-sage-soft p-3 text-sm font-medium text-sage">{info}</div>}
            {mode === 'register' && (
              <div><label className="field-label">Nama lengkap</label><input className="input" placeholder="Nama sesuai kartu pelajar" value={f.full_name} onChange={set('full_name')} required /></div>
            )}
            <div><label className="field-label">Email</label><input className="input" type="email" placeholder="nama@email.com" value={f.email} onChange={set('email')} required /></div>
            <div><label className="field-label">Password</label><input className="input" type="password" placeholder={mode === 'register' ? 'Min. 8 karakter' : '••••••••'} minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={set('password')} required /></div>
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}</button>
          </form>

          <p className="text-center text-sm text-muted">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button type="button" className="font-bold text-clay-deep hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}>
              {mode === 'login' ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
