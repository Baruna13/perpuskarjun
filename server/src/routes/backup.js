import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise } from '../lib/http.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// [tabel, kolom urut]
const TABLES = [
  ['profiles', 'id'], ['members', 'id'], ['categories', 'id'], ['books', 'id'],
  ['borrowings', 'id'], ['fines', 'id'], ['reservations', 'id'], ['reviews', 'id'],
  ['wishlists', 'id'], ['settings', 'key'], ['acquisitions', 'id'],
];

async function fetchAll(table, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999);
    raise(error);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Ekspor seluruh data aplikasi sebagai JSON (tanpa password / hash)
router.get('/', wrap(async (_req, res) => {
  const data = {};
  for (const [t, order] of TABLES) data[t] = await fetchAll(t, order);

  const emails = [];
  for (let page = 1; page <= 20; page++) {
    const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = list?.users ?? [];
    emails.push(...users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));
    if (users.length < 1000) break;
  }
  data.auth_users = emails;

  res.set('Cache-Control', 'no-store');
  res.json({
    meta: {
      app: 'DigiLib', created_at: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
      note: 'File storage (sampul & e-book) tidak ikut; cadangkan bucket dari dashboard Supabase.',
    },
    data,
  });
}));

export default router;
