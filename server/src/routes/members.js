import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');

// Anggota: lihat profil sendiri
router.get('/me', wrap(async (req, res) => res.json(req.user)));

router.get('/', staff, wrap(async (req, res) => {
  const { data, error } = await supabase.from('members')
    .select('*, profiles(full_name, avatar_url)').order('created_at', { ascending: false }).limit(500);
  raise(error);
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users ?? []).map((u) => [u.id, u.email]));
  res.json(data.map((m) => ({ ...m, email: emails.get(m.user_id) ?? null })));
}));

// Cari anggota via kode (hasil scan QR)
router.get('/by-code/:code', staff, wrap(async (req, res) => {
  const { data, error } = await supabase.from('members')
    .select('*, profiles(full_name)').eq('member_code', req.params.code.trim()).single();
  raise(error);
  const { count } = await supabase.from('borrowings').select('id', { count: 'exact', head: true })
    .eq('member_id', data.id).is('return_date', null);
  const { data: fines } = await supabase.from('fines').select('amount, borrowings!inner(member_id)')
    .eq('borrowings.member_id', data.id).eq('is_paid', false);
  const { data: s } = await supabase.from('settings').select('value').eq('key', `max_borrow_${data.member_type}`).maybeSingle();
  res.json({
    ...data,
    active_count: count ?? 0,
    unpaid_fines: (fines ?? []).reduce((a, f) => a + Number(f.amount), 0),
    max_limit: s ? parseInt(s.value, 10) : data.max_borrow_limit,
  });
}));

router.post('/', staff, wrap(async (req, res) => {
  const b = z.object({
    full_name: z.string().trim().min(1, 'Nama wajib diisi'),
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    member_type: z.enum(['siswa', 'guru', 'staf']).default('siswa'),
  }).parse(req.body);

  const { data: s } = await supabase.from('settings').select('value').eq('key', `max_borrow_${b.member_type}`).maybeSingle();
  const limit = s ? parseInt(s.value, 10) : 3;

  const { data: created, error: ue } = await supabase.auth.admin.createUser({
    email: b.email, password: b.password, email_confirm: true,
    user_metadata: { full_name: b.full_name },
  });
  if (ue) throw new HttpError(422, ue.message);
  const uid = created.user.id;

  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    const { data: code, error: ce } = await supabase.rpc('next_member_code');
    if (ce) { lastErr = ce; break; }
    const { data: member, error } = await supabase.from('members')
      .insert({ user_id: uid, member_code: code, member_type: b.member_type, max_borrow_limit: limit })
      .select('*').single();
    if (!error) return res.status(201).json({ ...member, full_name: b.full_name, email: b.email });
    lastErr = error;
    if (error.code !== '23505') break; // retry hanya jika kode bentrok
  }
  await supabase.auth.admin.deleteUser(uid); // rollback
  raise(lastErr);
}));

// Staf menetapkan password baru untuk akun anggota (password lama tidak bisa dilihat)
router.post('/:id/reset-password', staff, wrap(async (req, res) => {
  const { password } = z.object({ password: z.string().min(8, 'Password minimal 8 karakter') }).parse(req.body);
  const { data: m, error } = await supabase.from('members').select('user_id, profiles(role)').eq('id', req.params.id).single();
  raise(error);
  if (m.profiles?.role !== 'anggota') throw new HttpError(403, 'Hanya akun anggota yang dapat direset di sini');
  const { error: ue } = await supabase.auth.admin.updateUserById(m.user_id, { password });
  if (ue) throw new HttpError(422, ue.message);
  res.json({ ok: true });
}));

router.patch('/:id', staff, wrap(async (req, res) => {
  const b = z.object({
    full_name: z.string().trim().min(1).optional(),
    member_type: z.enum(['siswa', 'guru', 'staf']).optional(),
    is_active: z.boolean().optional(),
    max_borrow_limit: z.number().int().min(1).optional(),
  }).parse(req.body);
  const { full_name, ...memberFields } = b;

  const { data: member, error } = Object.keys(memberFields).length
    ? await supabase.from('members').update(memberFields).eq('id', req.params.id).select().single()
    : await supabase.from('members').select().eq('id', req.params.id).single();
  raise(error);
  if (full_name) {
    const { error: pe } = await supabase.from('profiles').update({ full_name }).eq('id', member.user_id);
    raise(pe);
  }
  res.json(member);
}));

export default router;
