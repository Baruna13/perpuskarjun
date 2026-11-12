import { QRCodeSVG } from 'qrcode.react';
import { BookOpen, Printer, X } from 'lucide-react';

// Kartu anggota digital; QR berisi member_code (bisa dipindai di meja sirkulasi)
export default function MemberCard({ name, code, type }) {
  return (
    <div className="relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: 'linear-gradient(135deg, #C26D45 0%, #914722 60%, #5B3A29 100%)', boxShadow: '0 12px 28px -8px rgba(145,71,34,.5)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="font-serif text-xl font-semibold">DigiLib Card</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Sistem Perpustakaan Sekolah</div>
        </div>
        <BookOpen size={26} className="text-white/80" />
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold leading-tight">{name}</div>
          <div className="font-mono text-xs text-white/85">{code}</div>
          <div className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">{type}</div>
        </div>
        <div className="shrink-0 rounded-lg bg-white p-1.5"><QRCodeSVG value={code} size={68} level="M" /></div>
      </div>
    </div>
  );
}

// Modal kartu + tombol cetak (dipakai anggota untuk kartunya sendiri)
export function CardModal({ name, code, type, onClose }) {
  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="modal w-full max-w-md space-y-4 p-6">
        <div className="no-print flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">Kartu Anggota</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="print-area"><MemberCard name={name} code={code} type={type} /></div>
        <p className="no-print text-xs text-muted">Tunjukkan QR ini di meja perpustakaan untuk transaksi lebih cepat.</p>
        <button className="btn btn-primary no-print w-full" onClick={() => window.print()}><Printer size={15} /> Cetak Kartu</button>
      </div>
    </div>
  );
}
