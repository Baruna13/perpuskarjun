import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  let q = supabase.from('reservations')
    .select('*, books(title, cover_url, available_stock), members(member_code, profiles(full_name))')
    .order('reservation_date', { ascending: false }).limit(500);
  if (req.user.role === 'anggota') {
    if (!req.user.member) return res.json([]);
    q = q.eq('member_id', req.user.member.id);
  }
  const { data, error } = await q;
  raise(error);
  res.json(data);
}));

// Pesan buku yang stoknya 0 (anggota untuk diri sendiri; staf boleh mewakili via member_id)
router.post('/', wrap(async (req, res) => {
  const body = z.object({ book_id: z.string().uuid(), member_id: z.string().uuid().optional() }).parse(req.body);

  let member;
  if (req.user.role === 'anggota') {
    member = req.user.member;
    if (!member) throw new HttpError(400, 'Daftarkan keanggotaan terlebih dulu');
  } else {
    if (!body.member_id) throw new HttpError(400, 'member_id wajib diisi');
    const { data } = await supabase.from('members').select('id, is_active').eq('id', body.member_id).maybeSingle();
    member = data;
    if (!member) throw new HttpError(404, 'Anggota tidak ditemukan');
  }
  if (!member.is_active) throw new HttpError(403, 'Keanggotaan belum aktif');

  const { data: book, error: be } = await supabase.from('books').select('id, available_stock').eq('id', body.book_id).single();
  raise(be);
  if (book.available_stock > 0) throw new HttpError(409, 'Buku masih tersedia, silakan pinjam langsung');

  const { data: dup } = await supabase.from('reservations').select('id')
    .eq('member_id', member.id).eq('book_id', book.id).eq('status', 'waiting').maybeSingle();
  if (dup) throw new HttpError(409, 'Anda sudah mereservasi buku ini');
  const { data: loan } = await supabase.from('borrowings').select('id')
    .eq('member_id', member.id).eq('book_id', book.id).is('return_date', null).maybeSingle();
  if (loan) throw new HttpError(409, 'Anda sedang meminjam buku ini');

  const { data, error } = await supabase.from('reservations')
    .insert({ member_id: member.id, book_id: book.id }).select().single();
  raise(error);
  res.status(201).json(data);
}));

// Batalkan reservasi
router.delete('/:id', wrap(async (req, res) => {
  const { data: r, error } = await supabase.from('reservations').select('id, member_id, status').eq('id', req.params.id).single();
  raise(error);
  if (req.user.role === 'anggota' && r.member_id !== req.user.member?.id) throw new HttpError(403, 'Akses ditolak');
  if (r.status !== 'waiting') throw new HttpError(409, 'Reservasi sudah tidak aktif');
  const { data, error: ue } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', r.id).select().single();
  raise(ue);
  res.json(data);
}));

export default router;
