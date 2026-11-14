import { useEffect, useRef, useState } from 'react';
import { Camera, KeyRound, Save, Trash2, IdCard } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

const ROLE = { admin: 'Administrator', pustakawan: 'Pustakawan', anggota: 'Anggota' };
const MAX_MB = 2;

function Msg({ m }) {
  if (!m) return null;
  return <div className={`rounded-xl p-3 text-sm font-medium ${m.type === 'ok' ? 'bg-sage-soft text-sage' : 'bg-rust-soft text-rust'}`}>{m.text}</div>;
}

export default function Profil() {
  const { user, refresh } = useAuth();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.full_name);
  const [nameMsg, setNameMsg] = useState(null);
  const [photoMsg, setPhotoMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [hasEmailLogin, setHasEmailLogin] = useState(true);

  // Akun yang hanya masuk via Google belum punya password: tidak perlu password saat ini
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasEmailLogin((data?.user?.app_metadata?.providers ?? []).includes('email')));
  }, []);

  const saveName = async (e) => {
    e.preventDefault(); setBusy('name'); setNameMsg(null);
    try { await api('/profile', { method: 'PATCH', body: { full_name: name } }); await refresh(); setNameMsg({ type: 'ok', text: 'Nama diperbarui.' }); }
    catch (x) { setNameMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setPhotoMsg({ type: 'err', text: `Ukuran foto maksimal ${MAX_MB} MB` }); return; }
    setBusy('photo'); setPhotoMsg(null);
    try {
      const up = await api('/profile/avatar-url', { method: 'POST', body: { filename: file.name } });
      const { error } = await supabase.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, file);
      if (error) throw new Error(`Upload gagal: ${error.message}`);
      await api('/profile/avatar-confirm', { method: 'POST', body: { path: up.path } });
      await refresh();
      setPhotoMsg({ type: 'ok', text: 'Foto profil diperbarui.' });
    } catch (x) { setPhotoMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  const removePhoto = async () => {
    if (!confirm('Hapus foto profil?')) return;
    setBusy('photo'); setPhotoMsg(null);
    try { await api('/profile/avatar', { method: 'DELETE' }); await refresh(); setPhotoMsg({ type: 'ok', text: 'Foto dihapus.' }); }
    catch (x) { setPhotoMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  const changePassword = async (e) => {
    e.preventDefault(); setPwMsg(null);
    if (pw.next.length < 8) return setPwMsg({ type: 'err', text: 'Password baru minimal 8 karakter' });
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: 'Konfirmasi password tidak sama' });
    setBusy('pw');
    try {
      if (hasEmailLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pw.current });
        if (error) throw new Error('Password saat ini salah');
      }
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw new Error(error.message.includes('different') ? 'Password baru harus berbeda dari yang lama' : error.message);
      setPw({ current: '', next: '', confirm: '' });
      setHasEmailLogin(true);
      setPwMsg({ type: 'ok', text: 'Password berhasil diganti.' });
    } catch (x) { setPwMsg({ type: 'err', text: x.message }); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Akun</span></div>
        <h1 className="text-4xl font-semibold tracking-tight">Profil Saya</h1>
        <p className="mt-1 text-sm text-muted">Kelola foto, nama, dan password akun Anda.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-5 p-5 md:p-6">
          <h2 className="font-serif text-2xl font-semibold">Foto & Data Diri</h2>
          <div className="flex items-center gap-4">
            <Avatar name={user.full_name} url={user.avatar_url} size="h-24 w-24" text="text-3xl" />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary !py-2" onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}><Camera size={15} /> {busy === 'photo' ? 'Mengunggah...' : 'Ganti Foto'}</button>
                {user.avatar_url && <button className="btn btn-ghost !py-2" onClick={removePhoto} disabled={busy === 'photo'}><Trash2 size={15} /> Hapus</button>}
              </div>
              <p className="text-xs text-muted">JPG, PNG, atau WebP. Maks {MAX_MB} MB.</p>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={pickPhoto} />
            </div>
          </div>
          <Msg m={photoMsg} />

          <form onSubmit={saveName} className="space-y-3">
            <div><label className="field-label">Nama lengkap</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><label className="field-label">Email</label><input className="input opacity-70" value={user.email ?? ''} disabled /></div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="badge badge-ink">{ROLE[user.role]}</span>
              {user.member && <span className="badge bg-parchment text-muted"><IdCard size={12} /> {user.member.member_code} · {user.member.member_type}</span>}
            </div>
            <Msg m={nameMsg} />
            <button className="btn btn-primary" disabled={busy === 'name' || name.trim() === user.full_name}><Save size={15} /> {busy === 'name' ? 'Menyimpan...' : 'Simpan Nama'}</button>
          </form>
        </section>

        <form onSubmit={changePassword} className="card space-y-4 p-5 md:p-6">
          <h2 className="font-serif text-2xl font-semibold">Ganti Password</h2>
          {!hasEmailLogin && <div className="rounded-xl bg-ochre-soft p-3 text-sm text-ochre">Akun Anda masuk lewat Google. Anda boleh membuat password agar bisa masuk dengan email juga.</div>}
          {hasEmailLogin && <div><label className="field-label">Password saat ini</label><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></div>}
          <div><label className="field-label">Password baru</label><input className="input" type="password" autoComplete="new-password" minLength={8} placeholder="Min. 8 karakter" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></div>
          <div><label className="field-label">Ulangi password baru</label><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
          <Msg m={pwMsg} />
          <button className="btn btn-primary" disabled={busy === 'pw'}><KeyRound size={15} /> {busy === 'pw' ? 'Memproses...' : 'Ganti Password'}</button>
          <p className="text-xs text-muted">Lupa password lama? Minta pustakawan/admin untuk mereset akun Anda, lalu ganti di sini.</p>
        </form>
      </div>
    </div>
  );
}
