import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);

// key -> batas minimum
const FIELDS = {
  fine_per_day: 0,
  loan_days_siswa: 1, loan_days_guru: 1, loan_days_staf: 1,
  max_borrow_siswa: 1, max_borrow_guru: 1, max_borrow_staf: 1,
  renew_days: 1,
};

router.get('/', requireRole('admin', 'pustakawan'), wrap(async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('key, value');
  raise(error);
  const out = {};
  for (const k of Object.keys(FIELDS)) {
    const row = data.find((r) => r.key === k);
    out[k] = row ? parseInt(row.value, 10) : null;
  }
  res.json(out);
}));

router.patch('/', requireRole('admin'), wrap(async (req, res) => {
  const body = z.record(z.coerce.number().int('Harus bilangan bulat').max(1000000)).parse(req.body);
  const rows = [];
  for (const [k, v] of Object.entries(body)) {
    if (!(k in FIELDS)) throw new HttpError(400, `Pengaturan tidak dikenal: ${k}`);
    if (v < FIELDS[k]) throw new HttpError(400, `Nilai ${k} minimal ${FIELDS[k]}`);
    rows.push({ key: k, value: String(v), updated_at: new Date().toISOString() });
  }
  if (!rows.length) throw new HttpError(400, 'Tidak ada perubahan');
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  raise(error);
  res.json({ ok: true, updated: rows.length });
}));

export default router;
