import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  const status = e.name === 'ZodError' ? 400 : 422;
  res.status(status).json({ error: e.errors?.[0]?.message ?? e.message });
});

// Pinjam: input member_code + isbn (hasil scan)
router.post('/', staff, wrap(async (req, res) => {
  const { member_code, isbn } = z.object({
    member_code: z.string().min(1), isbn: z.string().min(1),
  }).parse(req.body);

  const { data: member } = await supabase.from('members').select('id').eq('member_code', member_code).maybeSingle();
  const { data: book } = await supabase.from('books').select('id').eq('isbn', isbn).maybeSingle();
  if (!member) throw new Error('Anggota tidak ditemukan');
  if (!book) throw new Error('Buku tidak ditemukan');

  const { data, error } = await supabase.rpc('borrow_book', {
    p_member_id: member.id, p_book_id: book.id, p_created_by: req.user.id,
  });
  if (error) throw new Error(error.message);
  res.status(201).json(data);
}));

// Kembali
router.post('/:id/return', staff, wrap(async (req, res) => {
  const { is_paid = false } = z.object({ is_paid: z.boolean().optional() }).parse(req.body ?? {});
  const { data, error } = await supabase.rpc('return_book', { p_borrowing_id: req.params.id, p_is_paid: is_paid });
  if (error) throw new Error(error.message);
  res.json(data);
}));

// Perpanjang (staf, atau anggota untuk miliknya sendiri)
router.post('/:id/renew', wrap(async (req, res) => {
  if (req.user.role === 'anggota') {
    const { data: own } = await supabase.from('borrowings').select('member_id').eq('id', req.params.id).maybeSingle();
    if (!own || own.member_id !== req.user.member?.id) return res.status(403).json({ error: 'Akses ditolak' });
  }
  const { data, error } = await supabase.rpc('renew_borrowing', { p_borrowing_id: req.params.id });
  if (error) throw new Error(error.message);
  res.json(data);
}));

// Riwayat: staf lihat semua, anggota hanya miliknya
router.get('/', wrap(async (req, res) => {
  let q = supabase.from('v_borrowings')
    .select('*')
    .order('created_at', { ascending: false });
  if (req.user.role === 'anggota') q = q.eq('member_id', req.user.member?.id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  res.json(data);
}));

export default router;
