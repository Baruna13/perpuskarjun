import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise } from '../lib/http.js';

const router = Router();
router.use(authenticate);
const staff = requireRole('admin', 'pustakawan');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const body = z.object({ name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(100) });

router.get('/', wrap(async (_req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  raise(error);
  res.json(data);
}));

router.post('/', staff, wrap(async (req, res) => {
  const { name } = body.parse(req.body);
  const { data, error } = await supabase.from('categories').insert({ name, slug: slugify(name) }).select().single();
  raise(error);
  res.status(201).json(data);
}));

router.patch('/:id', staff, wrap(async (req, res) => {
  const { name } = body.parse(req.body);
  const { data, error } = await supabase.from('categories')
    .update({ name, slug: slugify(name) }).eq('id', req.params.id).select().single();
  raise(error);
  res.json(data);
}));

router.delete('/:id', staff, wrap(async (req, res) => {
  const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
  raise(error);
  res.status(204).end();
}));

export default router;
