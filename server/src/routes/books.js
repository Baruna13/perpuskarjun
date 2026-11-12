import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');
const isStaff = (u) => u.role !== 'anggota';

const optStr = z.string().trim().transform((v) => v || null).nullable().optional();
const optInt = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().nullable());

const bookSchema = z.object({
  isbn: optStr,
  title: z.string().trim().min(1, 'Judul wajib diisi'),
  author: z.string().trim().min(1, 'Penulis wajib diisi'),
  publisher: optStr,
  publish_year: optInt,
  category_id: optInt,
  total_stock: z.coerce.number().int().min(0, 'Stok tidak boleh negatif').default(1),
  shelf_location: z.string().trim().min(1, 'Lokasi rak wajib diisi'),
});

// Anggota tidak perlu melihat path file e-book
const present = (b, user) => {
  if (isStaff(user)) return b;
  const { ebook_url, ...rest } = b;
  return rest;
};

router.get('/', wrap(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
  const from = (page - 1) * limit;

  const sortNew = req.query.sort === 'new';
  let q = supabase.from('books').select('*, categories(name, slug)', { count: 'exact' })
    .order(sortNew ? 'created_at' : 'title', { ascending: !sortNew }).range(from, from + limit - 1);

  const s = String(req.query.q ?? '').replace(/[,()%*]/g, ' ').trim();
  if (s) q = q.or(`title.ilike.%${s}%,author.ilike.%${s}%,isbn.ilike.%${s}%`);
  if (req.query.category_id) q = q.eq('category_id', req.query.category_id);
  if (req.query.ebook === 'true') q = q.eq('is_ebook', true);

  const { data, error, count } = await q;
  raise(error);
  res.json({ data: data.map((b) => present(b, req.user)), total: count, page, limit });
}));

// Cari buku via ISBN (hasil scan barcode) untuk transaksi
router.get('/by-isbn/:isbn', staff, wrap(async (req, res) => {
  const { data, error } = await supabase.from('books')
    .select('id, isbn, title, author, cover_url, available_stock, total_stock, shelf_location')
    .eq('isbn', req.params.isbn.trim()).single();
  raise(error);
  res.json(data);
}));

router.get('/:id', wrap(async (req, res) => {
  const { data, error } = await supabase.from('books').select('*, categories(name, slug)').eq('id', req.params.id).single();
  raise(error);
  res.json(present(data, req.user));
}));

router.post('/', staff, wrap(async (req, res) => {
  const b = bookSchema.parse(req.body);
  const { data, error } = await supabase.from('books')
    .insert({ ...b, available_stock: b.total_stock }).select().single();
  raise(error);
  res.status(201).json(data);
}));

router.patch('/:id', staff, wrap(async (req, res) => {
  const b = bookSchema.partial().parse(req.body);
  const update = { ...b };

  if (b.total_stock !== undefined) {
    const { data: old, error: oe } = await supabase.from('books').select('total_stock, available_stock').eq('id', req.params.id).single();
    raise(oe);
    const newAvail = old.available_stock + (b.total_stock - old.total_stock);
    if (newAvail < 0) throw new HttpError(400, 'Stok total lebih kecil dari jumlah buku yang sedang dipinjam');
    update.available_stock = newAvail;
  }
  const { data, error } = await supabase.from('books').update(update).eq('id', req.params.id).select().single();
  raise(error);
  res.json(data);
}));

router.delete('/:id', staff, wrap(async (req, res) => {
  const { error } = await supabase.from('books').delete().eq('id', req.params.id);
  raise(error);
  res.status(204).end();
}));

// ---- Upload file: backend hanya mengeluarkan signed upload URL, file diunggah langsung dari browser ----
const EXT = { cover: ['jpg', 'jpeg', 'png', 'webp'], ebook: ['pdf'] };
const BUCKET = { cover: 'book-covers', ebook: 'ebook-files' };

router.post('/:id/upload-url', staff, wrap(async (req, res) => {
  const { kind, filename } = z.object({ kind: z.enum(['cover', 'ebook']), filename: z.string().min(1) }).parse(req.body);
  const ext = filename.split('.').pop().toLowerCase();
  if (!EXT[kind].includes(ext)) throw new HttpError(400, `Format file harus: ${EXT[kind].join(', ')}`);

  const path = `${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET[kind]).createSignedUploadUrl(path);
  raise(error);
  res.json({ bucket: BUCKET[kind], path: data.path ?? path, token: data.token, signedUrl: data.signedUrl });
}));

router.post('/:id/confirm-upload', staff, wrap(async (req, res) => {
  const { kind, path } = z.object({ kind: z.enum(['cover', 'ebook']), path: z.string().min(1) }).parse(req.body);
  if (!path.startsWith(`${req.params.id}/`)) throw new HttpError(400, 'Path file tidak valid');

  const update = kind === 'cover'
    ? { cover_url: supabase.storage.from('book-covers').getPublicUrl(path).data.publicUrl }
    : { ebook_url: path, is_ebook: true };
  const { data, error } = await supabase.from('books').update(update).eq('id', req.params.id).select().single();
  raise(error);
  res.json(data);
}));

// Signed URL e-book (private bucket), berlaku 1 jam
router.get('/:id/ebook-url', wrap(async (req, res) => {
  if (req.user.role === 'anggota' && !req.user.member?.is_active)
    throw new HttpError(403, 'Keanggotaan tidak aktif');
  const { data: book, error } = await supabase.from('books').select('is_ebook, ebook_url').eq('id', req.params.id).single();
  raise(error);
  if (!book.is_ebook || !book.ebook_url) throw new HttpError(404, 'Buku ini tidak punya e-book');
  const { data, error: se } = await supabase.storage.from('ebook-files').createSignedUrl(book.ebook_url, 3600);
  raise(se);
  res.json({ url: data.signedUrl, expires_in: 3600 });
}));

export default router;
