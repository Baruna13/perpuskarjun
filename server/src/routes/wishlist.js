import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';
import { enrich } from '../lib/bookMeta.js';

const router = Router();
router.use(authenticate);

const needMember = (req) => {
  if (!req.user.member) throw new HttpError(403, 'Wishlist hanya untuk anggota');
  return req.user.member;
};

router.get('/', wrap(async (req, res) => {
  const m = needMember(req);
  const { data, error } = await supabase.from('wishlists')
    .select('created_at, books(*, categories(name, slug))').eq('member_id', m.id).order('created_at', { ascending: false });
  raise(error);
  res.json(await enrich(data.map((w) => w.books).filter(Boolean), req.user));
}));

router.post('/', wrap(async (req, res) => {
  const m = needMember(req);
  const { book_id } = z.object({ book_id: z.string().uuid() }).parse(req.body);
  const { error } = await supabase.from('wishlists')
    .upsert({ member_id: m.id, book_id }, { onConflict: 'member_id,book_id', ignoreDuplicates: true });
  raise(error);
  res.status(201).json({ ok: true });
}));

router.delete('/:book_id', wrap(async (req, res) => {
  const m = needMember(req);
  const { error } = await supabase.from('wishlists').delete().eq('member_id', m.id).eq('book_id', req.params.book_id);
  raise(error);
  res.status(204).end();
}));

export default router;
