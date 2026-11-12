import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';
import { BORROWING_SELECT, todayWIB, fineRate, decorate } from '../lib/circulation.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'pustakawan'));

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

// Satu endpoint untuk seluruh laporan pada rentang tanggal (default: bulan ini)
router.get('/', wrap(async (req, res) => {
  const today = todayWIB();
  const { from = `${today.slice(0, 8)}01`, to = today } = z.object({
    from: dateStr.optional(), to: dateStr.optional(),
  }).parse(req.query);
  if (from > to) throw new HttpError(400, 'Tanggal awal tidak boleh melewati tanggal akhir');

  const rate = await fineRate();

  // Transaksi yang dipinjam ATAU dikembalikan dalam rentang
  const { data: tx, error: te } = await supabase.from('borrowings').select(BORROWING_SELECT)
    .or(`and(borrow_date.gte.${from},borrow_date.lte.${to}),and(return_date.gte.${from},return_date.lte.${to})`)
    .order('borrow_date', { ascending: false }).limit(5000);
  raise(te);

  // Buku belum kembali yang sudah lewat jatuh tempo (kondisi saat ini)
  const { data: out, error: oe } = await supabase.from('borrowings').select(BORROWING_SELECT)
    .is('return_date', null).lt('due_date', today).order('due_date').limit(5000);
  raise(oe);

  const { count: stillOut } = await supabase.from('borrowings').select('id', { count: 'exact', head: true }).is('return_date', null);

  // Denda yang tercatat dalam rentang
  const { data: fines, error: fe } = await supabase.from('fines')
    .select('*, borrowings!inner(borrow_date, due_date, return_date, books(title), members(member_code, profiles(full_name)))')
    .gte('created_at', `${from}T00:00:00+07:00`).lte('created_at', `${to}T23:59:59+07:00`)
    .order('created_at', { ascending: false }).limit(5000);
  raise(fe);

  const inRange = (d) => d && d >= from && d <= to;
  const transactions = tx.map((b) => decorate(b, today, rate));

  const counts = new Map();
  for (const b of transactions) {
    if (!inRange(b.borrow_date)) continue;
    const cur = counts.get(b.book_id) ?? { ...b.books, count: 0 };
    cur.count += 1; counts.set(b.book_id, cur);
  }
  const popular = [...counts.values()].sort((a, b) => b.count - a.count || (a.title ?? '').localeCompare(b.title ?? '')).slice(0, 10);

  const sum = (rows) => rows.reduce((a, f) => a + Number(f.amount), 0);
  res.json({
    range: { from, to },
    summary: {
      borrowed: transactions.filter((b) => inRange(b.borrow_date)).length,
      returned: transactions.filter((b) => inRange(b.return_date)).length,
      still_out: stillOut ?? 0,
      overdue: out.length,
      fines_total: sum(fines),
      fines_paid: sum(fines.filter((f) => f.is_paid)),
      fines_unpaid: sum(fines.filter((f) => !f.is_paid)),
    },
    transactions,
    overdue: out.map((b) => decorate(b, today, rate)),
    fines,
    popular,
  });
}));

export default router;
