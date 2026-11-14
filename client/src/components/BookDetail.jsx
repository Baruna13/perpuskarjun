import { useCallback, useEffect, useState } from 'react';
import { BookMarked, CalendarClock, HandHelping, Heart, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { tgl } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { CoverFallback } from './ShelfBook';
import { Stars, StarInput } from './Stars';

// Detail buku: deskripsi lengkap, wishlist, rating & ulasan
export default function BookDetail({ bookId, onClose, onChanged, onRead, onReserve, onRequest }) {
  const { user } = useAuth();
  const isStaff = user.role !== 'anggota';
  const memberId = user.member?.id;
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [err, setErr] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([api(`/books/${bookId}`), api(`/books/${bookId}/reviews`)]);
      setBook(b); setReviews(r);
      const mine = r.find((x) => x.member_id === memberId);
      if (mine) { setRating(mine.rating); setComment(mine.comment ?? ''); }
    } catch (e) { setErr(e.message); }
  }, [bookId, memberId]);
  useEffect(() => { load(); }, [load]);

  const toggleWish = async () => {
    try {
      if (book.wishlisted) await api(`/wishlist/${book.id}`, { method: 'DELETE' });
      else await api('/wishlist', { method: 'POST', body: { book_id: book.id } });
      await load(); onChanged?.();
    } catch (e) { setErr(e.message); }
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setNote('');
    try {
      await api(`/books/${bookId}/reviews`, { method: 'POST', body: { rating, comment } });
      setNote('Ulasan tersimpan. Terima kasih!'); await load(); onChanged?.();
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  const removeReview = async (r) => {
    if (!confirm('Hapus ulasan ini?')) return;
    try { await api(`/books/${bookId}/reviews/${r.id}`, { method: 'DELETE' }); await load(); onChanged?.(); }
    catch (x) { setErr(x.message); }
  };

  const mine = reviews.find((r) => r.member_id === memberId);
  const meta = book && [
    ['Penulis', book.author], ['Penerbit', book.publisher], ['Tahun', book.publish_year],
    ['Kategori', book.categories?.name], ['ISBN', book.isbn], ['Kode buku', book.book_code], ['Lokasi rak', book.shelf_location],
  ].filter(([, v]) => v);

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 md:items-center">
      <div className="modal w-full max-w-3xl p-6">
        <div className="mb-3 flex justify-end"><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        {!book && !err && <div className="p-10 text-center text-muted">Memuat...</div>}
        {err && <div className="mb-3 rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}

        {book && (
          <>
            <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
              <div>
                <div className="book-cover bg-parchment">{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <CoverFallback title={book.title} />}</div>
              </div>
              <div className="min-w-0 space-y-3">
                <div>
                  <h2 className="font-serif text-3xl font-semibold leading-tight">{book.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    {book.rating_count > 0
                      ? <><Stars value={book.rating_avg} size={16} /><b className="tnum">{book.rating_avg}</b><span className="text-muted">({book.rating_count} ulasan)</span></>
                      : <span className="text-muted">Belum ada ulasan</span>}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {meta.map(([k, v]) => <div key={k}><dt className="field-label !mb-0">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
                </dl>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${book.available_stock > 0 ? 'badge-sage' : 'badge-rust'}`}>{book.available_stock} dari {book.total_stock} tersedia</span>
                  {book.is_ebook && <span className="badge badge-ink">E-book</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {book.is_ebook && onRead && <button className="btn btn-primary" onClick={() => onRead(book)}><BookMarked size={15} /> Baca Buku</button>}
                  {!isStaff && onRequest && book.available_stock > 0 && <button className="btn btn-primary" onClick={() => onRequest(book)}><HandHelping size={15} /> Ajukan Pinjam</button>}
                  {!isStaff && onReserve && book.available_stock <= 0 && <button className="btn btn-ghost" onClick={() => onReserve(book)}><CalendarClock size={15} /> Reservasi</button>}
                  {memberId && <button className="btn btn-ghost" onClick={toggleWish}><Heart size={15} className={book.wishlisted ? 'text-rust' : ''} fill={book.wishlisted ? 'currentColor' : 'none'} /> {book.wishlisted ? 'Di wishlist' : 'Wishlist'}</button>}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-serif text-lg font-semibold">Deskripsi</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{book.description || 'Belum ada deskripsi untuk buku ini.'}</p>
            </div>

            <div className="mt-6 space-y-4 border-t border-parchment pt-5">
              <h3 className="font-serif text-xl font-semibold">Ulasan <span className="badge bg-parchment text-muted">{reviews.length}</span></h3>

              {memberId && (
                <form onSubmit={submit} className="space-y-3 rounded-2xl bg-parchment/60 p-4">
                  <div className="text-sm font-bold">{mine ? 'Ulasan Anda' : 'Tulis ulasan'}</div>
                  <StarInput value={rating} onChange={setRating} />
                  <textarea className="input" rows={3} maxLength={1000} placeholder="Bagikan pendapat Anda tentang buku ini (opsional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                  {note && <div className="text-sm font-medium text-sage">{note}</div>}
                  <button className="btn btn-primary" disabled={busy || !rating}>{busy ? 'Menyimpan...' : mine ? 'Perbarui Ulasan' : 'Kirim Ulasan'}</button>
                </form>
              )}

              <div className="divide-y divide-parchment">
                {reviews.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{r.name}</b><Stars value={r.rating} /><span className="text-xs text-muted">{tgl(r.created_at)}</span></div>
                      {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.comment}</p>}
                    </div>
                    {(isStaff || r.member_id === memberId) && <button className="icon-btn hover:!text-rust" title="Hapus ulasan" onClick={() => removeReview(r)}><Trash2 size={15} /></button>}
                  </div>
                ))}
                {!reviews.length && <div className="py-4 text-sm text-muted">Jadilah yang pertama memberi ulasan.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
