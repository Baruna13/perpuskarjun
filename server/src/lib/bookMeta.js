import { supabase } from './supabase.js';

export const isStaff = (u) => u.role !== 'anggota';

// Anggota tidak perlu melihat path file e-book
export function present(b, user) {
  if (isStaff(user)) return b;
  const { ebook_url, ...rest } = b;
  return rest;
}

// Tambahkan rating rata-rata, jumlah ulasan, dan status wishlist ke daftar buku
export async function enrich(rows, user) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return rows;

  const { data: rv } = await supabase.from('reviews').select('book_id, rating').in('book_id', ids);
  const agg = new Map();
  for (const r of rv ?? []) {
    if (r.rating == null) continue;
    const a = agg.get(r.book_id) ?? { sum: 0, n: 0 };
    a.sum += r.rating; a.n += 1; agg.set(r.book_id, a);
  }

  let wl = new Set();
  if (user.member) {
    const { data } = await supabase.from('wishlists').select('book_id').eq('member_id', user.member.id).in('book_id', ids);
    wl = new Set((data ?? []).map((w) => w.book_id));
  }

  return rows.map((r) => {
    const a = agg.get(r.id);
    return present({
      ...r,
      rating_avg: a ? Math.round((a.sum / a.n) * 10) / 10 : null,
      rating_count: a?.n ?? 0,
      wishlisted: wl.has(r.id),
    }, user);
  });
}
