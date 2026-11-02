import { supabase } from '../lib/supabase.js';

// Verifikasi JWT Supabase + muat role dari tabel profiles
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Token tidak valid' });

  const { data: profile } = await supabase
    .from('profiles').select('id, full_name, role').eq('id', data.user.id).single();
  if (!profile) return res.status(403).json({ error: 'Profil tidak ditemukan' });

  const { data: member } = await supabase
    .from('members').select('id, member_code, member_type, is_active')
    .eq('user_id', profile.id).maybeSingle();

  req.user = { ...profile, member };
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'Akses ditolak' });
