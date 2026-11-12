import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');

// Staf: semua denda. Anggota: denda sendiri. Query: status=unpaid|paid
router.get('/', wrap(async (req, res) => {
  let q = supabase.from('fines')
    .select('*, borrowings!inner(member_id, borrow_date, due_date, return_date, books(title), members(member_code, profiles(full_name)))')
    .order('created_at', { ascending: false }).limit(500);

  if (req.user.role === 'anggota') {
    if (!req.user.member) return res.json([]);
    q = q.eq('borrowings.member_id', req.user.member.id);
  }
  if (req.query.status === 'unpaid') q = q.eq('is_paid', false);
  if (req.query.status === 'paid') q = q.eq('is_paid', true);

  const { data, error } = await q;
  raise(error);
  res.json(data);
}));

// Tandai lunas
router.patch('/:id/pay', staff, wrap(async (req, res) => {
  const { data, error } = await supabase.from('fines')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('is_paid', false).select().maybeSingle();
  raise(error);
  if (!data) throw new HttpError(409, 'Denda sudah lunas atau tidak ditemukan');
  res.json(data);
}));

export default router;
