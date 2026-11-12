import { supabase } from './supabase.js';

export const BORROWING_SELECT =
  '*, books(title, author, isbn, cover_url), members(member_code, member_type, profiles(full_name)), fines(id, late_days, amount, is_paid, paid_at)';

// Tanggal hari ini (YYYY-MM-DD) di zona Asia/Jakarta
export const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

export async function fineRate() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'fine_per_day').maybeSingle();
  return parseInt(data?.value ?? '1000', 10);
}

// Tambah status efektif (terlambat dihitung dinamis) + estimasi denda berjalan
export function decorate(b, today, rate = 0) {
  const late = !b.return_date && b.due_date < today;
  const days = late ? daysBetween(b.due_date, today) : 0;
  const { fines, ...rest } = b;
  return {
    ...rest,
    fine: Array.isArray(fines) ? (fines[0] ?? null) : (fines ?? null),
    effective_status: late ? 'terlambat' : b.status,
    running_late_days: days,
    estimated_fine: days * rate,
  };
}
