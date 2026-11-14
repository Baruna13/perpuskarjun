import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';
import { BORROWING_SELECT, todayWIB, fineRate, decorate } from '../lib/circulation.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');

const SELECT = '*, books(title, isbn, book_code, cover_url, available_stock, total_stock, shelf_location), members(member_code, member_type, is_active, profiles(full_name, avatar_url))';

// Pengajuan yang lewat batas waktu otomatis menjadi 'expired'
const sweep = async () => { await supabase.from('borrow_requests').update({ status: 'expired' }).eq('status', 'pending').lt('expires_at', new Date().toISOString()); };

async function setting(key, def) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  const n = parseInt(data?.value ?? '', 10);
  return Number.isFinite(n) ? n : def;
}

// Anggota: pengajuan sendiri. Staf: ?status=pending (default) | approved | rejected | cancelled | expired | all
router.get('/', wrap(async (req, res) => {
  await sweep();
  let q = supabase.from('borrow_requests').select(SELECT).order('requested_at', { ascending: false }).limit(200);
  if (req.user.role === 'anggota') {
    if (!req.user.member) return res.json([]);
    q = q.eq('member_id', req.user.member.id);
  } else {
    const st = req.query.status ?? 'pending';
    if (st !== 'all') q = q.eq('status', st);
  }
  const { data, error } = await q;
  raise(error);
  res.json(data);
}));

// Anggota mengajukan pinjam (buku disiapkan pustakawan; peminjaman dicatat saat anggota datang)
router.post('/', wrap(async (req, res) => {
  if (req.user.role !== 'anggota') throw new HttpError(403, 'Pengajuan hanya untuk anggota. Staf mencatat peminjaman lewat menu Sirkulasi');
  const m = req.user.member;
  if (!m) throw new HttpError(400, 'Daftarkan keanggotaan terlebih dahulu');
  if (!m.is_active) throw new HttpError(403, 'Keanggotaan belum aktif');
  const { book_id } = z.object({ book_id: z.string().uuid() }).parse(req.body);

  await sweep();
  const { data: book, error: be } = await supabase.from('books').select('id, available_stock').eq('id', book_id).single();
  raise(be);
  if (book.available_stock <= 0) throw new HttpError(409, 'Stok buku habis. Silakan gunakan Reservasi');

  const { data: loan } = await supabase.from('borrowings').select('id').eq('member_id', m.id).eq('book_id', book_id).is('return_date', null).maybeSingle();
  if (loan) throw new HttpError(409, 'Anda sedang meminjam buku ini');

  const { data: fines } = await supabase.from('fines').select('amount, borrowings!inner(member_id)').eq('borrowings.member_id', m.id).eq('is_paid', false);
  if ((fines ?? []).some((f) => Number(f.amount) > 0)) throw new HttpError(409, 'Selesaikan denda Anda terlebih dahulu');

  const limit = await setting(`max_borrow_${m.member_type}`, 3);
  const { count: active } = await supabase.from('borrowings').select('id', { count: 'exact', head: true }).eq('member_id', m.id).is('return_date', null);
  const { count: pending } = await supabase.from('borrow_requests').select('id', { count: 'exact', head: true }).eq('member_id', m.id).eq('status', 'pending');
  if ((active ?? 0) + (pending ?? 0) >= limit) throw new HttpError(409, `Kuota penuh: pinjaman aktif + pengajuan sudah ${limit} buku`);

  const days = await setting('request_expire_days', 2);
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  const { data, error } = await supabase.from('borrow_requests')
    .insert({ member_id: m.id, book_id, expires_at: expires }).select().single();
  if (error?.code === '23505') throw new HttpError(409, 'Anda sudah mengajukan buku ini');
  raise(error);
  res.status(201).json(data);
}));

// Anggota membatalkan pengajuan menunggu
router.delete('/:id', wrap(async (req, res) => {
  const { data: r, error } = await supabase.from('borrow_requests').select('id, member_id, status').eq('id', req.params.id).single();
  raise(error);
  if (req.user.role === 'anggota' && r.member_id !== req.user.member?.id) throw new HttpError(403, 'Akses ditolak');
  if (r.status !== 'pending') throw new HttpError(409, 'Pengajuan sudah tidak aktif');
  const { data, error: ue } = await supabase.from('borrow_requests').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', r.id).select().single();
  raise(ue);
  res.json(data);
}));

// Staf: setujui = catat peminjaman sekarang (semua validasi dijalankan ulang secara atomik)
router.post('/:id/approve', staff, wrap(async (req, res) => {
  await sweep();
  const { data: r, error } = await supabase.from('borrow_requests').select('id, member_id, book_id, status').eq('id', req.params.id).single();
  raise(error);
  if (r.status !== 'pending') throw new HttpError(409, r.status === 'expired' ? 'Pengajuan sudah kedaluwarsa' : 'Pengajuan sudah diproses');

  const { data: loan, error: le } = await supabase.rpc('borrow_book', {
    p_member_id: r.member_id, p_book_id: r.book_id, p_created_by: req.user.id,
  });
  if (le) throw new HttpError(422, le.message);

  await supabase.from('borrow_requests').update({
    status: 'approved', decided_by: req.user.id, decided_at: new Date().toISOString(), borrowing_id: loan.id,
  }).eq('id', r.id).eq('status', 'pending');

  const { data: full, error: fe } = await supabase.from('borrowings').select(BORROWING_SELECT).eq('id', loan.id).single();
  raise(fe);
  res.json(decorate(full, todayWIB(), await fineRate()));
}));

// Staf: tolak dengan alasan
router.post('/:id/reject', staff, wrap(async (req, res) => {
  const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body ?? {});
  const { data, error } = await supabase.from('borrow_requests')
    .update({ status: 'rejected', note: note || null, decided_by: req.user.id, decided_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('status', 'pending').select().maybeSingle();
  raise(error);
  if (!data) throw new HttpError(409, 'Pengajuan sudah diproses atau tidak ditemukan');
  res.json(data);
}));

export default router;
