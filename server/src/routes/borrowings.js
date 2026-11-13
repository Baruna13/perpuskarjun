import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';
import { BORROWING_SELECT, todayWIB, fineRate, decorate } from '../lib/circulation.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');

// Pinjam: input member_code + isbn (hasil scan)
router.post('/', staff, wrap(async (req, res) => {
  const { member_code, isbn, book_id } = z.object({
    member_code: z.string().trim().min(1, 'Kode anggota wajib diisi'),
    isbn: z.string().trim().min(1).optional(), // ISBN atau kode buku
    book_id: z.string().uuid().optional(),
  }).refine((v) => v.isbn || v.book_id, { message: 'ISBN / kode buku wajib diisi' }).parse(req.body);

  const { data: member } = await supabase.from('members').select('id').eq('member_code', member_code).maybeSingle();
  if (!member) throw new HttpError(404, 'Anggota tidak ditemukan');

  let book = book_id ? { id: book_id } : null;
  if (!book) {
    ({ data: book } = await supabase.from('books').select('id').eq('isbn', isbn).maybeSingle());
    if (!book) ({ data: book } = await supabase.from('books').select('id').eq('book_code', isbn).maybeSingle());
  }
  if (!book) throw new HttpError(404, 'Buku tidak ditemukan');

  const { data, error } = await supabase.rpc('borrow_book', {
    p_member_id: member.id, p_book_id: book.id, p_created_by: req.user.id,
  });
  if (error) throw new HttpError(422, error.message);

  const { data: full, error: fe } = await supabase.from('borrowings').select(BORROWING_SELECT).eq('id', data.id).single();
  raise(fe);
  res.status(201).json(decorate(full, todayWIB(), await fineRate()));
}));

// Kembali (+ denda otomatis)
router.post('/:id/return', staff, wrap(async (req, res) => {
  const { is_paid = false } = z.object({ is_paid: z.boolean().optional() }).parse(req.body ?? {});
  const { data, error } = await supabase.rpc('return_book', { p_borrowing_id: req.params.id, p_is_paid: is_paid });
  if (error) throw new HttpError(422, error.message);
  res.json(data);
}));

// Perpanjang (staf, atau anggota untuk miliknya sendiri)
router.post('/:id/renew', wrap(async (req, res) => {
  if (req.user.role === 'anggota') {
    const { data: own } = await supabase.from('borrowings').select('member_id').eq('id', req.params.id).maybeSingle();
    if (!own || own.member_id !== req.user.member?.id) throw new HttpError(403, 'Akses ditolak');
    if (!req.user.member.is_active) throw new HttpError(403, 'Keanggotaan belum aktif');
  }
  const { data, error } = await supabase.rpc('renew_borrowing', { p_borrowing_id: req.params.id });
  if (error) throw new HttpError(422, error.message);
  res.json(data);
}));

// Riwayat: staf lihat semua, anggota hanya miliknya.
// Query: scope=all|active|returned|overdue, q, member_id, book_id, from, to
router.get('/', wrap(async (req, res) => {
  const { scope = 'all', q = '', member_id, book_id, from, to } = req.query;
  const today = todayWIB();

  let query = supabase.from('borrowings').select(BORROWING_SELECT)
    .order('created_at', { ascending: false }).limit(1000);

  if (req.user.role === 'anggota') {
    if (!req.user.member) return res.json([]);
    query = query.eq('member_id', req.user.member.id);
  } else if (member_id) query = query.eq('member_id', member_id);

  if (book_id) query = query.eq('book_id', book_id);
  if (scope === 'active') query = query.is('return_date', null);
  if (scope === 'returned') query = query.not('return_date', 'is', null);
  if (scope === 'overdue') query = query.is('return_date', null).lt('due_date', today);
  if (from) query = query.gte('borrow_date', from);
  if (to) query = query.lte('borrow_date', to);

  const { data, error } = await query;
  raise(error);
  const rate = await fineRate();
  let rows = data.map((b) => decorate(b, today, rate));

  const term = String(q).trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) => [r.books?.title, r.books?.isbn, r.members?.member_code, r.members?.profiles?.full_name]
      .some((v) => (v ?? '').toLowerCase().includes(term)));
  }
  res.json(rows);
}));

export default router;
