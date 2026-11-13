import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '../lib/api';
import ShelfBook from '../components/ShelfBook';
import BookDetail from '../components/BookDetail';
import BookReader from '../components/BookReader';

export default function Wishlist() {
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [reader, setReader] = useState(null);

  const load = useCallback(() => api('/wishlist').then(setBooks).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const remove = async (b) => {
    try { await api(`/wishlist/${b.id}`, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); }
  };
  const reserve = async (b) => {
    try { await api('/reservations', { method: 'POST', body: { book_id: b.id } }); alert(`Reservasi "${b.title}" berhasil.`); }
    catch (e) { setErr(e.message); }
  };
  const read = (b) => setReader({ id: b.id, title: b.title });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Akun saya</span></div>
        <h1 className="text-4xl font-semibold tracking-tight">Wishlist</h1>
        <p className="mt-1 text-sm text-muted">Buku yang ingin Anda baca. Klik ikon hati di katalog untuk menambahkan.</p>
      </div>
      {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
      <div className="panel p-3 md:p-5">
        <div className="shelf-grid">
          {books?.map((b) => <ShelfBook key={b.id} book={b} onOpen={(x) => setDetailId(x.id)} onRead={read} onReserve={reserve} onWishlist={remove} />)}
        </div>
        {books && !books.length && <div className="flex flex-col items-center gap-2 py-16 text-muted"><Heart size={40} /> Wishlist masih kosong</div>}
        {!books && !err && <div className="py-16 text-center text-muted">Memuat...</div>}
      </div>
      {detailId && <BookDetail bookId={detailId} onClose={() => setDetailId(null)} onChanged={load} onRead={read} onReserve={reserve} />}
      {reader && <BookReader book={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
