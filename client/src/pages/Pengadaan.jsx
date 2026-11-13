import { useCallback, useEffect, useState } from 'react';
import { PackagePlus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { rupiah, tgl } from '../lib/format';

const SOURCES = [['pembelian', 'Pembelian'], ['hibah', 'Hibah'], ['sumbangan', 'Sumbangan'], ['lainnya', 'Lainnya']];
const SRC_TONE = { pembelian: 'badge-ink', hibah: 'badge-sage', sumbangan: 'badge-ochre', lainnya: 'bg-parchment text-muted' };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { quantity: 1, source: 'pembelian', supplier: '', unit_price: '', acquired_date: today(), notes: '' };

export default function Pengadaan() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState(null);
  const [bq, setBq] = useState('');
  const [found, setFound] = useState([]);
  const [book, setBook] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/acquisitions${filter ? `?source=${filter}` : ''}`).then(setRows).catch((e) => setErr(e.message)), [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form || book || bq.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => api(`/books?q=${encodeURIComponent(bq.trim())}&limit=6`).then((r) => setFound(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [bq, form, book]);

  const open = () => { setForm({ ...EMPTY, acquired_date: today() }); setBook(null); setBq(''); setErr(''); setOk(''); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api('/acquisitions', { method: 'POST', body: { ...form, book_id: book?.id } });
      setOk(`Tercatat: ${form.quantity} eksemplar "${book.title}". Stok bertambah otomatis.`);
      setForm(null); load();
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  const totalQty = rows.reduce((a, r) => a + r.quantity, 0);
  const totalValue = rows.reduce((a, r) => a + (r.unit_price ? Number(r.unit_price) * r.quantity : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Pengadaan</span></div>
          <h1 className="text-4xl font-semibold tracking-tight">Pengadaan Buku</h1>
          <p className="mt-1 text-sm text-muted">Catat buku baru masuk beserta sumber asalnya. Stok katalog bertambah otomatis.</p>
        </div>
        <button className="btn btn-primary" onClick={open}><PackagePlus size={16} /> Catat Buku Masuk</button>
      </div>

      {ok && <div className="rounded-xl bg-sage-soft p-3 text-sm font-medium text-sage">{ok}</div>}
      {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}

      {form && (
        <form onSubmit={submit} className="panel space-y-4 p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div><h2 className="font-serif text-2xl font-semibold">Catat Buku Masuk</h2><p className="text-sm text-muted">Untuk judul yang belum ada di katalog, tambahkan dulu lewat menu Katalog (bisa sekalian mencatat sumbernya).</p></div>
            <button type="button" className="icon-btn" onClick={() => setForm(null)}><X size={18} /></button>
          </div>

          <div>
            <label className="field-label">Buku *</label>
            {book ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-parchment/70 p-3">
                <div className="min-w-0"><div className="truncate font-serif font-semibold">{book.title}</div><div className="text-xs text-muted">{book.author} · stok {book.total_stock}</div></div>
                <button type="button" className="btn btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => { setBook(null); setBq(''); }}>Ganti</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-muted" />
                <input className="input pl-10!" placeholder="Cari judul, ISBN, atau kode buku" value={bq} onChange={(e) => setBq(e.target.value)} />
                {found.length > 0 && (
                  <div className="card absolute z-20 mt-1 w-full overflow-hidden shadow-xl">
                    {found.map((b) => (
                      <button type="button" key={b.id} className="block w-full px-4 py-2.5 text-left transition hover:bg-parchment/60" onClick={() => { setBook(b); setFound([]); }}>
                        <div className="text-sm font-semibold">{b.title}</div><div className="text-xs text-muted">{b.author} · {b.isbn ?? b.book_code ?? 'tanpa ISBN'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div><label className="field-label">Jumlah (eksemplar) *</label><input className="input" type="number" min="1" value={form.quantity} onChange={set('quantity')} required /></div>
            <div><label className="field-label">Sumber *</label>
              <select className="input" value={form.source} onChange={set('source')}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label className="field-label">Tanggal masuk</label><input className="input" type="date" value={form.acquired_date} onChange={set('acquired_date')} /></div>
            <div><label className="field-label">Pemasok / donatur</label><input className="input" value={form.supplier} onChange={set('supplier')} placeholder="mis. Toko Buku Gramedia / Alumni 2020" /></div>
            <div><label className="field-label">Harga satuan (Rp)</label><input className="input" type="number" min="0" value={form.unit_price} onChange={set('unit_price')} placeholder="kosongkan jika hibah" /></div>
            <div><label className="field-label">Catatan</label><input className="input" value={form.notes} onChange={set('notes')} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary" disabled={!book || busy}>{busy ? 'Menyimpan...' : 'Simpan & Tambah Stok'}</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Catatan</div><div className="tnum font-serif text-2xl font-semibold text-clay-deep">{rows.length}</div></div>
        <div className="card p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Eksemplar masuk</div><div className="tnum font-serif text-2xl font-semibold text-clay-deep">{totalQty}</div></div>
        <div className="card p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Nilai pengadaan</div><div className="tnum font-serif text-2xl font-semibold text-clay-deep">{rupiah(totalValue)}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4">
          <select className="input-pill w-auto!" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Semua sumber</option>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Tanggal</th><th>Buku</th><th>Jumlah</th><th>Sumber</th><th>Pemasok / donatur</th><th>Harga satuan</th><th>Total</th><th>Dicatat oleh</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{tgl(r.acquired_date)}</td>
                  <td className="max-w-[240px] truncate font-semibold">{r.books?.title}</td>
                  <td className="tnum">{r.quantity}</td>
                  <td><span className={`badge ${SRC_TONE[r.source]}`}>{r.source}</span></td>
                  <td className="text-muted">{r.supplier ?? '–'}</td>
                  <td className="tnum">{r.unit_price ? rupiah(r.unit_price) : '–'}</td>
                  <td className="tnum">{r.unit_price ? rupiah(Number(r.unit_price) * r.quantity) : '–'}</td>
                  <td className="text-muted">{r.profiles?.full_name ?? '–'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="!h-24 text-center text-muted">Belum ada catatan pengadaan</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
