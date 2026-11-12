import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, raise } from '../lib/http.js';
import { BORROWING_SELECT, todayWIB, fineRate, decorate } from '../lib/circulation.js';

const router = Router();
router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  const today = todayWIB();
  const { data, error } = await supabase.rpc('dashboard_stats', { p_today: today });
  raise(error);

  if (req.user.role === 'anggota') {
    const { total_titles, total_copies, available_copies, ebooks, popular } = data;
    return res.json({ total_titles, total_copies, available_copies, ebooks, popular });
  }

  const { data: rows, error: re } = await supabase.from('borrowings').select(BORROWING_SELECT)
    .or(`borrow_date.eq.${today},return_date.eq.${today}`)
    .order('created_at', { ascending: false }).limit(8);
  raise(re);
  const rate = await fineRate();
  res.json({ ...data, today: rows.map((b) => decorate(b, today, rate)) });
}));

export default router;
