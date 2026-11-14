import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);
const admin = requireRole('admin');

// Admin: CRUD, Pustakawan: read only
router.get('/', requireRole('admin', 'pustakawan'), wrap(async (_req, res) => {
  const { data: profiles, error } = await supabase
    .from('profiles').select('id, full_name, role, avatar_url, created_at').order('created_at', { ascending: false });
  raise(error);
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users ?? []).map((u) => [u.id, u.email]));
  res.json(profiles.map((p) => ({ ...p, email: emails.get(p.id) ?? null })));
}));

router.post('/', admin, wrap(async (req, res) => {
  const b = z.object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    full_name: z.string().trim().min(1, 'Nama wajib diisi'),
    role: z.enum(['admin', 'pustakawan', 'anggota']).default('pustakawan'),
  }).parse(req.body);

  const { data, error } = await supabase.auth.admin.createUser({
    email: b.email, password: b.password, email_confirm: true,
    user_metadata: { full_name: b.full_name },
  });
  if (error) throw new HttpError(422, error.message);
  const { error: e2 } = await supabase.from('profiles').update({ role: b.role }).eq('id', data.user.id);
  raise(e2);
  res.status(201).json({ id: data.user.id, email: b.email, full_name: b.full_name, role: b.role });
}));

router.patch('/:id', admin, wrap(async (req, res) => {
  const b = z.object({
    full_name: z.string().trim().min(1).optional(),
    role: z.enum(['admin', 'pustakawan', 'anggota']).optional(),
  }).parse(req.body);
  if (b.role && req.params.id === req.user.id && b.role !== 'admin')
    throw new HttpError(400, 'Tidak bisa menurunkan role akun sendiri');
  const { data, error } = await supabase.from('profiles')
    .update({ ...b, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
  raise(error);
  res.json(data);
}));

// Admin menetapkan password baru (password lama tidak pernah bisa dilihat; hanya bisa diganti)
router.post('/:id/reset-password', admin, wrap(async (req, res) => {
  const { password } = z.object({ password: z.string().min(8, 'Password minimal 8 karakter') }).parse(req.body);
  const { error } = await supabase.auth.admin.updateUserById(req.params.id, { password });
  if (error) throw new HttpError(422, error.message);
  res.json({ ok: true });
}));

router.delete('/:id', admin, wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri');
  const { error } = await supabase.auth.admin.deleteUser(req.params.id);
  if (error) throw new HttpError(409, 'Gagal menghapus (mungkin masih punya riwayat peminjaman): ' + error.message);
  res.status(204).end();
}));

export default router;
