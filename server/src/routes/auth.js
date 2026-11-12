import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();

// Info user login (profil + data anggota bila ada)
router.get('/me', authenticate, (req, res) => res.json(req.user));

// Pendaftaran keanggotaan mandiri (setelah register / login Google).
// Dibuat NON-AKTIF: pustakawan harus memverifikasi dulu sebelum bisa meminjam.
router.post('/join', authenticate, wrap(async (req, res) => {
  if (req.user.role !== 'anggota') throw new HttpError(400, 'Hanya akun anggota yang perlu mendaftar keanggotaan');
  if (req.user.member) return res.json(req.user.member);

  const { member_type } = z.object({ member_type: z.enum(['siswa', 'guru', 'staf']) }).parse(req.body);
  const { data: s } = await supabase.from('settings').select('value').eq('key', `max_borrow_${member_type}`).maybeSingle();
  const limit = s ? parseInt(s.value, 10) : 3;

  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    const { data: code, error: ce } = await supabase.rpc('next_member_code');
    if (ce) { lastErr = ce; break; }
    const { data, error } = await supabase.from('members')
      .insert({ user_id: req.user.id, member_code: code, member_type, max_borrow_limit: limit, is_active: false })
      .select('*').single();
    if (!error) return res.status(201).json(data);
    lastErr = error;
    if (error.code !== '23505') break;
  }
  raise(lastErr);
}));

export default router;
