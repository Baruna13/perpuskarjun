import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'pustakawan'));

const SOURCES = ['pembelian', 'hibah', 'sumbangan', 'lainnya'];

router.get('/', wrap(async (req, res) => {
  let q = supabase.from('acquisitions')
    .select('*, books(title, isbn, book_code), profiles(full_name)')
    .order('acquired_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (SOURCES.includes(req.query.source)) q = q.eq('source', req.query.source);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from ?? '')) q = q.gte('acquired_date', req.query.from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to ?? '')) q = q.lte('acquired_date', req.query.to);
  const { data, error } = await q;
  raise(error);
  res.json(data);
}));

// Catat buku masuk: stok bertambah otomatis
router.post('/', wrap(async (req, res) => {
  const b = z.object({
    book_id: z.string().uuid('Pilih buku terlebih dahulu'),
    quantity: z.coerce.number().int().min(1, 'Jumlah minimal 1').max(10000),
    source: z.enum(SOURCES).default('pembelian'),
    supplier: z.string().trim().max(255).optional(),
    unit_price: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().min(0).nullable()),
    acquired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).parse(req.body);

  const { data, error } = await supabase.rpc('receive_acquisition', {
    p_book_id: b.book_id, p_quantity: b.quantity, p_source: b.source, p_supplier: b.supplier || null,
    p_unit_price: b.unit_price, p_date: b.acquired_date ?? null, p_notes: b.notes || null, p_created_by: req.user.id,
  });
  if (error) throw new HttpError(422, error.message);
  res.status(201).json(data);
}));

export default router;
