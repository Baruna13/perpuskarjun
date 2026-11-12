import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { rupiah, tgl } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthRange = (offset = 0) => {
  const n = new Date();
  return [ymd(new Date(n.getFullYear(), n.getMonth() + offset, 1)), ymd(new Date(n.getFullYear(), n.getMonth() + offset + 1, 0))];
};

// ---- pemetaan data ke baris laporan (dipakai layar, cetak, dan Excel) ----
const SECTIONS = [
  ['transaksi', 'Peminjaman & Pengembalian', (d) => d.transactions.map((b) => ({
    'Tgl Pinjam': b.borrow_date, 'Kode Anggota': b.members?.member_code, 'Nama': b.members?.profiles?.full_name,
    'Judul Buku': b.books?.title, 'Jatuh Tempo': b.due_date, 'Tgl Kembali': b.return_date ?? '',
    'Status': b.effective_status, 'Denda (Rp)': b.fine ? Number(b.fine.amount) : 0 }))],
  ['terlambat', 'Belum Kembali & Terlambat', (d) => d.overdue.map((b) => ({
    'Kode Anggota': b.members?.member_code, 'Nama': b.members?.profiles?.full_name, 'Judul Buku': b.books?.title,
    'Jatuh Tempo': b.due_date, 'Terlambat (hari)': b.running_late_days, 'Denda Berjalan (Rp)': b.estimated_fine }))],
  ['denda', 'Rekap Denda', (d) => d.fines.map((f) => ({
    'Kode Anggota': f.borrowings?.members?.member_code, 'Nama': f.borrowings?.members?.profiles?.full_name,
    'Judul Buku': f.borrowings?.books?.title, 'Terlambat (hari)': f.late_days, 'Denda (Rp)': Number(f.amount),
    'Status': f.is_paid ? 'Lunas' : 'Belum dibayar', 'Tgl Bayar': f.paid_at ? f.paid_at.slice(0, 10) : '' }))],
  ['populer', 'Buku Paling Sering Dipinjam', (d) => d.popular.map((p, i) => ({
    '#': i + 1, 'Judul Buku': p.title, 'Penulis': p.author, 'ISBN': p.isbn ?? '', 'Jumlah Dipinjam': p.count }))],
];

const fmt = (k, v) => {
  if (v === '' || v == null) return '–';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return tgl(v);
  if (k.includes('(Rp)')) return rupiah(v);
  return v;
};

function DataTable({ rows, compact }) {
  if (!rows.length) return <div className="p-6 text-center text-sm text-muted">Tidak ada data pada periode ini</div>;
  const cols = Object.keys(rows[0]);
  return (
    <table className={`tbl ${compact ? 'tbl-compact' : ''}`}>
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={typeof r[c] === 'number' ? 'tnum' : ''}>{fmt(c, r[c])}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Stat({ label, value, tone = 'bg-white' }) {
  return (
    <div className={`card p-4 ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="tnum mt-1 font-serif text-2xl font-semibold text-clay-deep">{value}</div>
    </div>
  );
}

const summaryRows = (s) => [
  ['Buku dipinjam (periode)', s.borrowed], ['Buku dikembalikan (periode)', s.returned],
  ['Masih dipinjam (saat ini)', s.still_out], ['Terlambat (saat ini)', s.overdue],
  ['Denda tercatat', rupiah(s.fines_total)], ['Denda sudah dibayar', rupiah(s.fines_paid)], ['Denda belum dibayar', rupiah(s.fines_unpaid)],
];

function autoWidth(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((k) => ({ wch: Math.min(Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2, 50) }));
}

export default function Laporan() {
  const { user } = useAuth();
  const [[from, to], setRange] = useState(monthRange(0));
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('transaksi');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr('');
    api(`/reports?from=${from}&to=${to}`).then(setData).catch((e) => { setErr(e.message); setData(null); });
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const sum = XLSX.utils.aoa_to_sheet([['Laporan Perpustakaan DigiLib'], [`Periode: ${from} s/d ${to}`], [], ...summaryRows(data.summary)]);
    sum['!cols'] = [{ wch: 34 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, sum, 'Ringkasan');
    for (const [, title, map] of SECTIONS) {
      const rows = map(data);
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = autoWidth(rows);
      XLSX.utils.book_append_sheet(wb, ws, title.replace(/[&/]/g, '-').slice(0, 31));
    }
    XLSX.writeFile(wb, `laporan-perpustakaan_${from}_${to}.xlsx`);
  };

  const s = data?.summary;
  const current = SECTIONS.find(([k]) => k === tab);

  return (
    <div className="space-y-5">
      {/* ===== Tampilan layar ===== */}
      <div className="no-print space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-muted">DigiLib <span className="mx-1">›</span> <span className="text-clay-deep">Laporan</span></div>
            <h1 className="text-4xl font-semibold tracking-tight">Laporan Perpustakaan</h1>
            <p className="mt-1 text-sm text-muted">Rekap sirkulasi, keterlambatan, denda, dan buku populer.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={!data} onClick={exportExcel}><FileSpreadsheet size={16} /> Ekspor Excel</button>
            <button className="btn btn-primary" disabled={!data} onClick={() => window.print()}><Printer size={16} /> Cetak / PDF</button>
          </div>
        </div>

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div><label className="field-label">Dari</label><input type="date" className="input" value={from} onChange={(e) => setRange([e.target.value, to])} /></div>
          <div><label className="field-label">Sampai</label><input type="date" className="input" value={to} onChange={(e) => setRange([from, e.target.value])} /></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setRange(monthRange(0))}>Bulan ini</button>
            <button className="btn btn-ghost" onClick={() => setRange(monthRange(-1))}>Bulan lalu</button>
          </div>
        </div>

        {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}

        {s && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Dipinjam" value={s.borrowed} />
            <Stat label="Dikembalikan" value={s.returned} />
            <Stat label="Masih dipinjam" value={s.still_out} tone="bg-ochre-soft" />
            <Stat label="Terlambat" value={s.overdue} tone="bg-rust-soft" />
            <Stat label="Denda tercatat" value={rupiah(s.fines_total)} />
            <Stat label="Denda dibayar" value={rupiah(s.fines_paid)} tone="bg-sage-soft" />
            <Stat label="Denda belum dibayar" value={rupiah(s.fines_unpaid)} tone="bg-rust-soft" />
          </div>
        )}

        {data && (
          <>
            <div className="flex w-fit max-w-full overflow-x-auto rounded-full bg-parchment p-1">
              {SECTIONS.map(([k, title]) => (
                <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-white text-clay-deep shadow-sm' : 'text-muted hover:text-espresso'}`}>{title}</button>
              ))}
            </div>
            <div className="card overflow-x-auto"><DataTable rows={current[2](data)} /></div>
          </>
        )}
        {!data && !err && <div className="p-10 text-center text-muted">Memuat laporan...</div>}
      </div>

      {/* ===== Versi cetak (tampil hanya saat print / simpan PDF) ===== */}
      {data && (
        <div className="print-only print-report text-[11px]">
          <h1 className="text-xl font-bold">Laporan Perpustakaan DigiLib</h1>
          <p>Periode {tgl(from)} s/d {tgl(to)} · dicetak {tgl(ymd(new Date()))} oleh {user.full_name}</p>
          <table className="tbl tbl-compact mt-3 !w-auto"><tbody>{summaryRows(data.summary).map(([k, v]) => <tr key={k}><td className="font-semibold">{k}</td><td className="tnum">{v}</td></tr>)}</tbody></table>
          {SECTIONS.map(([k, title, map]) => (
            <section key={k} className="mt-5">
              <h2 className="mb-1 text-sm font-bold">{title}</h2>
              <DataTable rows={map(data)} compact />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
