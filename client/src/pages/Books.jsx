import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, BookOpen, X, UploadCloud, Tag } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import BookReader from '../components/BookReader';
import BookDetail from '../components/BookDetail';
import ShelfBook from '../components/ShelfBook';

const LIMIT = 15;
const EMPTY = {
  isbn: '', book_code: '', title: '', author: '', publisher: '', description: '', publish_year: '', category_id: '',
  total_stock: 1, shelf_location: '', acquisition_source: '', acquisition_supplier: '',
};

async function uploadFile(bookId, kind, file) {
  const up = await api(`/books/${bookId}/upload-url`, { method: 'POST', body: { kind, filename: file.name } });
  const { error } = await supabase.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, file);
  if (error) throw new Error(`Upload ${kind} gagal: ${error.message}`);
  await api(`/books/${bookId}/confirm-upload`, { method: 'POST', body: { kind, path: up.path } });
}

function FileField({ label, accept, file, onChange }) {
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-dashed border-rule p-3 text-sm text-muted transition hover:border-clay hover:bg-parchment/60">
      <span className="flex items-center gap-2 font-semibold text-espresso"><UploadCloud size={16} /> {label}</span>
      <span className="truncate text-xs">{file ? file.name : 'Klik untuk memilih file'}</span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onChange(e.target.files[0] ?? null)} />
    </label>
  );
}

function BookForm({ book, categories, onClose, onSaved }) {
  const [f, setF] = useState(book ? {
    isbn: book.isbn ?? '', book_code: book.book_code ?? '', title: book.title, author: book.author,
    publisher: book.publisher ?? '', description: book.description ?? '', publish_year: book.publish_year ?? '',
    category_id: book.category_id ?? '', total_stock: book.total_stock, shelf_location: book.shelf_location,
  } : EMPTY);
  const [cover, setCover] = useState(null);
  const [ebook, setEbook] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const saved = book
        ? await api(`/books/${book.id}`, { method: 'PATCH', body: f })
        : await api('/books', { method: 'POST', body: f });
      if (cover) await uploadFile(saved.id, 'cover', cover);
      if (ebook) await uploadFile(saved.id, 'ebook', ebook);
      onSaved();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 md:items-center">
      <form onSubmit={submit} className="modal w-full max-w-2xl space-y-4 p-6 md:p-7">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{book ? 'Edit Buku' : 'Tambah Buku'}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X size={19} /></button>
        </div>
        {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="field-label">Judul *</label><input className="input" value={f.title} onChange={set('title')} required /></div>
          <div><label className="field-label">Penulis *</label><input className="input" value={f.author} onChange={set('author')} required /></div>
          <div><label className="field-label">ISBN (untuk scan barcode)</label><input className="input tnum" value={f.isbn} onChange={set('isbn')} /></div>
          <div><label className="field-label">Kode buku (jika tanpa ISBN)</label><input className="input tnum" value={f.book_code} onChange={set('book_code')} placeholder="mis. BK-0001" /></div>
          <div><label className="field-label">Penerbit</label><input className="input" value={f.publisher} onChange={set('publisher')} /></div>
          <div><label className="field-label">Tahun terbit</label><input className="input" type="number" value={f.publish_year} onChange={set('publish_year')} /></div>
          <div><label className="field-label">Kategori</label>
            <select className="input" value={f.category_id} onChange={set('category_id')}>
              <option value="">— Pilih kategori —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="field-label">Stok total *</label><input className="input" type="number" min="0" value={f.total_stock} onChange={set('total_stock')} required /></div>
          <div className="md:col-span-2"><label className="field-label">Lokasi rak * (cth: RAK-A1)</label><input className="input" value={f.shelf_location} onChange={set('shelf_location')} required /></div>
          <div className="md:col-span-2"><label className="field-label">Deskripsi</label><textarea className="input" rows={4} value={f.description} onChange={set('description')} placeholder="Sinopsis singkat buku" /></div>
          {!book && (
            <>
              <div><label className="field-label">Sumber pengadaan</label>
                <select className="input" value={f.acquisition_source} onChange={set('acquisition_source')}>
                  <option value="">— Tidak dicatat —</option><option value="pembelian">Pembelian</option><option value="hibah">Hibah</option><option value="sumbangan">Sumbangan</option><option value="lainnya">Lainnya</option>
                </select></div>
              <div><label className="field-label">Pemasok / donatur</label><input className="input" value={f.acquisition_supplier} onChange={set('acquisition_supplier')} disabled={!f.acquisition_source} /></div>
            </>
          )}
          <FileField label="Sampul (jpg/png/webp)" accept=".jpg,.jpeg,.png,.webp" file={cover} onChange={setCover} />
          <FileField label="E-book (PDF)" accept=".pdf" file={ebook} onChange={setEbook} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Buku'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Books() {
  const { user } = useAuth();
  const isStaff = user.role !== 'anggota';
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pub, setPub] = useState('');
  const [categories, setCategories] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [reader, setReader] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      if (cat) params.set('category_id', cat);
      if (pub) params.set('publisher', pub);
      const r = await api(`/books?${params}`);
      setBooks(r.data); setTotal(r.total); setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, cat, pub]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
    api('/books/meta/publishers').then(setPublishers).catch(() => {});
  }, []);

  const remove = async (b) => {
    if (!confirm(`Hapus "${b.title}"?`)) return;
    try { await api(`/books/${b.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };
  const addCategory = async () => {
    const name = prompt('Nama kategori baru:');
    if (!name) return;
    try { await api('/categories', { method: 'POST', body: { name } }); setCategories(await api('/categories')); }
    catch (e) { setError(e.message); }
  };
  const reserve = async (b) => {
    try {
      await api('/reservations', { method: 'POST', body: { book_id: b.id } });
      alert(`Reservasi "${b.title}" berhasil. Pantau di menu Pinjaman Saya.`);
    } catch (e) { setError(e.message); }
  };
  const requestBorrow = async (b) => {
    try {
      await api('/requests', { method: 'POST', body: { book_id: b.id } });
      alert(`Pengajuan "${b.title}" terkirim. Pustakawan akan menyiapkan bukunya; ambil di perpustakaan sebelum batas waktu. Pantau di menu Pinjaman Saya.`);
    } catch (e) { setError(e.message); }
  };
  const toggleWish = async (b) => {
    setBooks((prev) => prev.map((x) => (x.id === b.id ? { ...x, wishlisted: !x.wishlisted } : x))); // optimistis
    try {
      if (b.wishlisted) await api(`/wishlist/${b.id}`, { method: 'DELETE' });
      else await api('/wishlist', { method: 'POST', body: { book_id: b.id } });
    } catch (e) { setError(e.message); load(); }
  };
  const read = (bk) => setReader({ id: bk.id, title: bk.title });

  const pages = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Koleksi</span></div>
          <h1 className="text-4xl font-semibold tracking-tight">Katalog Buku</h1>
          <p className="mt-1 text-sm text-muted"><span className="tnum font-bold text-espresso">{total}</span> judul tertata di rak perpustakaan.</p>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={addCategory}><Tag size={15} /> Kategori</button>
            <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Tambah Buku</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-4 top-3.5 text-muted" />
          <input className="input-pill pl-11!" placeholder="Cari judul, penulis, ISBN, atau kode buku" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className="input-pill w-auto!" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-pill w-auto!" value={pub} onChange={(e) => { setPub(e.target.value); setPage(1); }}>
          <option value="">Semua penerbit</option>
          {publishers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {error && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{error}</div>}

      <div className="panel p-3 md:p-5">
        {loading && (
          <div className="shelf-grid">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="px-4 pt-6"><div className="aspect-[1/1.48] animate-pulse rounded bg-parchment" /><div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-parchment" /></div>
            ))}
          </div>
        )}
        {!loading && (
          <div className="shelf-grid">
            {books.map((b) => (
              <ShelfBook key={b.id} book={b} isStaff={isStaff}
                onOpen={(bk) => setDetailId(bk.id)} onRead={read}
                onEdit={(bk) => setModal({ book: bk })} onDelete={remove}
                onReserve={isStaff ? undefined : reserve}
                onRequest={!isStaff && user.member?.is_active ? requestBorrow : undefined}
                onWishlist={user.member ? toggleWish : undefined} />
            ))}
          </div>
        )}
        {!loading && !books.length && !error && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted"><BookOpen size={40} /> Rak masih kosong — belum ada buku ditemukan</div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
        <span className="tnum text-muted">Halaman <b className="text-espresso">{page}</b> / {pages}</span>
        <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya</button>
      </div>

      {modal && <BookForm book={modal.book} categories={categories} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); api('/books/meta/publishers').then(setPublishers).catch(() => {}); }} />}
      {detailId && <BookDetail bookId={detailId} onClose={() => setDetailId(null)} onChanged={load} onRead={read} onReserve={isStaff ? undefined : reserve} onRequest={!isStaff && user.member?.is_active ? requestBorrow : undefined} />}
      {reader && <BookReader book={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
