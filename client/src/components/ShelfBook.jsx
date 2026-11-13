import { BookMarked, CalendarClock, Heart, Pencil, Star, Trash2 } from 'lucide-react';

const COVER_COLORS = ['#914722', '#8F4E00', '#2C4058', '#4A5D77', '#6D3A00', '#5B3A29', '#7A4B2A'];

export function CoverFallback({ title }) {
  const i = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % COVER_COLORS.length;
  return (
    <div className="flex h-full w-full flex-col justify-between p-3 pl-5 text-white" style={{ background: `linear-gradient(160deg, ${COVER_COLORS[i]}, #231B15)` }}>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">DigiLib</span>
      <span className="line-clamp-4 font-serif text-base font-semibold leading-tight">{title}</span>
    </div>
  );
}

// Satu buku yang "bersandar" di rak kayu
export default function ShelfBook({ book, isStaff, onOpen, onRead, onEdit, onDelete, onReserve, onWishlist }) {
  const available = book.available_stock > 0;
  return (
    <div className="shelf-item flex flex-col">
      <div className="px-4 pt-6">
        <div className="relative">
          <div className={`book-cover bg-parchment ${onOpen ? 'cursor-pointer' : ''}`} onClick={() => onOpen?.(book)}>
            {book.cover_url
              ? <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" draggable={false} />
              : <CoverFallback title={book.title} />}
            <span className={`badge absolute right-2 top-2 z-[3] shadow-sm ${available ? 'bg-white/90 text-ink' : 'badge-rust'}`}>
              {available ? `Tersedia: ${book.available_stock}` : 'Habis'}
            </span>
          </div>
          {book.is_ebook && (
            <span title="E-book" className="absolute -top-2 left-4 z-[4] h-5 w-3.5 bg-clay shadow"
              style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)' }} />
          )}
          {onWishlist && (
            <button onClick={() => onWishlist(book)} title={book.wishlisted ? 'Hapus dari wishlist' : 'Tambah ke wishlist'}
              className="absolute bottom-2 right-2 z-[4] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-110">
              <Heart size={16} className={book.wishlisted ? 'text-rust' : 'text-muted'} fill={book.wishlisted ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>
      <div className="shelf-rail -mt-1 relative z-0" />

      <div className="flex flex-1 flex-col items-center gap-0.5 px-4 pb-8 pt-3 text-center">
        <button className="line-clamp-2 font-serif text-sm font-semibold leading-tight hover:text-clay-deep" onClick={() => onOpen?.(book)} disabled={!onOpen}>{book.title}</button>
        <div className="w-full truncate text-xs text-muted">{book.author}</div>
        {book.rating_count > 0 && (
          <div className="flex items-center gap-1 text-xs font-semibold text-resin"><Star size={12} fill="currentColor" /> {book.rating_avg} <span className="font-normal text-muted">({book.rating_count})</span></div>
        )}
        <div className="w-full truncate text-[10px] font-semibold uppercase tracking-wider text-[#8C7A6B]">
          {book.categories?.name ?? 'Tanpa kategori'} · {book.shelf_location}
        </div>
        {book.is_ebook && onRead && (
          <button className="btn btn-primary mt-2 !px-4 !py-1.5 !text-xs" onClick={() => onRead(book)}>
            <BookMarked size={14} /> Baca Buku
          </button>
        )}
        {!isStaff && onReserve && book.available_stock <= 0 && (
          <button className="btn btn-ghost mt-2 !px-4 !py-1.5 !text-xs" onClick={() => onReserve(book)}>
            <CalendarClock size={14} /> Reservasi
          </button>
        )}
        {isStaff && (onEdit || onDelete) && (
          <div className="mt-1.5 flex gap-1">
            {onEdit && <button className="icon-btn" title="Edit" onClick={() => onEdit(book)}><Pencil size={15} /></button>}
            {onDelete && <button className="icon-btn hover:!text-rust" title="Hapus" onClick={() => onDelete(book)}><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
    </div>
  );
}
