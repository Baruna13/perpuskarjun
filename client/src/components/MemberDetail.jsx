import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { api } from '../lib/api';
import { rupiah, tgl } from '../lib/format';
import MemberCard from './MemberCard';
import StatusBadge from './StatusBadge';

// Kartu digital + riwayat peminjaman satu anggota (untuk staf)
export default function MemberDetail({ member, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const name = member.profiles?.full_name ?? '';

  useEffect(() => {
    api(`/borrowings?member_id=${member.id}&scope=all`).then(setRows).catch((e) => setErr(e.message));
  }, [member.id]);

  const active = rows?.filter((b) => !b.return_date).length ?? 0;
  const fines = rows?.reduce((a, b) => a + (b.fine && !b.fine.is_paid ? Number(b.fine.amount) : 0), 0) ?? 0;

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 md:items-center">
      <div className="modal w-full max-w-4xl p-6">
        <div className="no-print mb-4 flex items-center justify-between">
          <div><h2 className="font-serif text-2xl font-semibold">{name}</h2>
            <p className="text-sm text-muted">{member.email ?? '–'} · terdaftar {tgl(member.created_at)}</p></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="space-y-3">
            <div className="print-area"><MemberCard name={name} code={member.member_code} type={member.member_type} /></div>
            <button className="btn btn-ghost no-print w-full" onClick={() => window.print()}><Printer size={15} /> Cetak Kartu</button>
            <div className="no-print grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-parchment/70 p-3"><div className="field-label !mb-0">Sedang dipinjam</div><b className="tnum">{active} / {member.max_borrow_limit}</b></div>
              <div className="rounded-xl bg-parchment/70 p-3"><div className="field-label !mb-0">Denda belum lunas</div><b className="tnum">{rupiah(fines)}</b></div>
            </div>
          </div>

          <div className="no-print min-w-0">
            <h3 className="mb-2 font-serif text-lg font-semibold">Riwayat peminjaman</h3>
            {err && <div className="rounded-xl bg-rust-soft p-3 text-sm font-medium text-rust">{err}</div>}
            <div className="card max-h-[22rem] overflow-auto">
              <table className="tbl">
                <thead><tr><th>Buku</th><th>Pinjam</th><th>Kembali</th><th>Status</th><th>Denda</th></tr></thead>
                <tbody>
                  {rows?.map((b) => (
                    <tr key={b.id}>
                      <td className="max-w-[200px] truncate font-semibold">{b.books?.title}</td>
                      <td className="whitespace-nowrap">{tgl(b.borrow_date)}</td>
                      <td className="whitespace-nowrap">{tgl(b.return_date)}</td>
                      <td><StatusBadge s={b.effective_status} /></td>
                      <td className="tnum">{b.fine ? rupiah(b.fine.amount) : b.estimated_fine > 0 ? <span className="text-rust">{rupiah(b.estimated_fine)}*</span> : '–'}</td>
                    </tr>
                  ))}
                  {rows && !rows.length && <tr><td colSpan={5} className="!h-20 text-center text-muted">Belum pernah meminjam</td></tr>}
                  {!rows && !err && <tr><td colSpan={5} className="!h-20 text-center text-muted">Memuat...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
