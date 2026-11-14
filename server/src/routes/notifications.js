import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap } from '../lib/http.js';
import { todayWIB, daysBetween, fineRate } from '../lib/circulation.js';

const router = Router();
router.use(authenticate);

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const ORDER = { danger: 0, warn: 1, info: 2 };

// Notifikasi dihitung langsung dari data terbaru (tanpa tabel tambahan)
router.get('/', wrap(async (req, res) => {
  const today = todayWIB();
  const items = [];

  if (req.user.role === 'anggota') {
    const m = req.user.member;
    if (!m) {
      items.push({ id: 'join', level: 'info', title: 'Lengkapi keanggotaan', body: 'Pilih tipe anggota untuk mulai meminjam buku.', link: '/' });
    } else {
      if (!m.is_active) items.push({ id: 'pending', level: 'warn', title: 'Keanggotaan menunggu verifikasi', body: 'Pustakawan akan mengaktifkan akun Anda.', link: '/' });

      const rate = await fineRate();
      const { data: loans } = await supabase.from('borrowings').select('id, due_date, books(title)')
        .eq('member_id', m.id).is('return_date', null);
      for (const b of loans ?? []) {
        const left = daysBetween(today, b.due_date);
        const title = b.books?.title ?? 'Buku';
        if (left < 0) items.push({ id: `late-${b.id}`, level: 'danger', title: `Terlambat ${-left} hari`, body: `"${title}" · denda berjalan ${rupiah(-left * rate)}`, link: '/pinjaman' });
        else if (left <= 2) items.push({ id: `due-${b.id}`, level: 'warn', title: left === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${left} hari lagi`, body: `"${title}"`, link: '/pinjaman' });
      }

      const { data: fines } = await supabase.from('fines').select('amount, borrowings!inner(member_id)')
        .eq('borrowings.member_id', m.id).eq('is_paid', false);
      const unpaid = (fines ?? []).reduce((a, f) => a + Number(f.amount), 0);
      if (unpaid > 0) items.push({ id: 'fines', level: 'danger', title: 'Denda belum dibayar', body: `Total ${rupiah(unpaid)}. Selesaikan di meja perpustakaan.`, link: '/pinjaman' });

      const { data: resv } = await supabase.from('reservations').select('id, books(title, available_stock)')
        .eq('member_id', m.id).eq('status', 'waiting');
      for (const r of resv ?? []) {
        if ((r.books?.available_stock ?? 0) > 0) items.push({ id: `resv-${r.id}`, level: 'info', title: 'Buku reservasi tersedia', body: `"${r.books?.title}" siap dipinjam.`, link: '/pinjaman' });
      }
    }
  } else {
    const { count: overdue } = await supabase.from('borrowings').select('id', { count: 'exact', head: true })
      .is('return_date', null).lt('due_date', today);
    if (overdue) items.push({ id: 'overdue', level: 'danger', title: `${overdue} buku terlambat`, body: 'Belum dikembalikan melewati jatuh tempo.', link: '/laporan' });

    const { count: pending } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', false);
    if (pending) items.push({ id: 'pending', level: 'warn', title: `${pending} anggota menunggu verifikasi`, body: 'Aktifkan di menu Data Anggota.', link: '/members' });

    const { data: fines } = await supabase.from('fines').select('amount').eq('is_paid', false);
    if (fines?.length) items.push({ id: 'fines', level: 'warn', title: `${fines.length} denda belum dibayar`, body: `Total ${rupiah(fines.reduce((a, f) => a + Number(f.amount), 0))}`, link: '/sirkulasi' });
  }

  // Pengajuan pinjam
  const nowIso = new Date().toISOString();
  if (req.user.role !== 'anggota') {
    const { count } = await supabase.from('borrow_requests').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').gt('expires_at', nowIso);
    if (count) items.push({ id: 'requests', level: 'warn', title: `${count} pengajuan pinjam menunggu`, body: 'Siapkan bukunya, lalu setujui saat anggota datang.', link: '/sirkulasi?tab=pengajuan' });
  } else if (req.user.member) {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: rej } = await supabase.from('borrow_requests').select('id, note, books(title)')
      .eq('member_id', req.user.member.id).eq('status', 'rejected').gte('decided_at', since);
    for (const r of rej ?? []) items.push({ id: `rej-${r.id}`, level: 'warn', title: 'Pengajuan pinjam ditolak', body: `"${r.books?.title}"${r.note ? ` · ${r.note}` : ''}`, link: '/pinjaman' });
  }

  items.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  res.json(items);
}));

export default router;
