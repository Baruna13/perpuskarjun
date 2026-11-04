import { forwardRef, useEffect, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Hitung ukuran 1 halaman agar muat di layar
function calcSize(ratio) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vw < 800;
  const availH = vh - 150;
  const availW = portrait ? vw - 24 : (vw - 120) / 2;
  let h = availH, w = h / ratio;
  if (w > availW) { w = availW; h = w * ratio; }
  return { w: Math.floor(w), h: Math.floor(h), portrait };
}

async function renderPage(doc, n, targetW) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(targetW / base.width, 3) });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return canvas.toDataURL('image/jpeg', 0.88);
}

// Satu halaman buku (harus forwardRef untuk react-pageflip)
const Page = forwardRef(function Page({ src, num, density }, ref) {
  return (
    <div ref={ref} data-density={density} className="bg-white">
      <div className="relative h-full w-full overflow-hidden bg-[#fdfcf8]">
        {src
          ? <img src={src} alt={`Halaman ${num}`} draggable={false} className="h-full w-full select-none object-contain" />
          : <div className="flex h-full items-center justify-center text-slate-300"><Loader2 className="animate-spin" /></div>}
        {/* bayangan lipatan tengah buku */}
        <div className={`pointer-events-none absolute inset-y-0 w-8 from-black/15 to-transparent ${num % 2 === 0 ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'}`} />
      </div>
    </div>
  );
});

export default function BookReader({ book, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [images, setImages] = useState({});
  const [current, setCurrent] = useState(0); // index halaman (mulai 0)
  const [size, setSize] = useState(null);
  const [ratio, setRatio] = useState(1.4);
  const [fs, setFs] = useState(false);

  const docRef = useRef(null);
  const bookRef = useRef(null);
  const wrapRef = useRef(null);
  const imagesRef = useRef({});
  const pending = useRef(new Set());
  const renderW = useRef(900);
  const startRef = useRef(0);
  const storeKey = `reader:${book.id}`;

  // 1) Muat PDF lewat signed URL
  useEffect(() => {
    let cancelled = false, task;
    (async () => {
      try {
        const { url } = await api(`/books/${book.id}/ebook-url`);
        task = pdfjsLib.getDocument({ url });
        const doc = await task.promise;
        if (cancelled) { doc.destroy(); return; }
        docRef.current = doc;
        const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
        const r = vp.height / vp.width;
        const sz = calcSize(r);
        renderW.current = Math.min(1400, Math.floor(sz.w * Math.max(window.devicePixelRatio || 1, 1.5)));
        let start = 0;
        try { start = Math.min(Math.max(parseInt(localStorage.getItem(storeKey)) || 0, 0), doc.numPages - 1); } catch { /* abaikan */ }
        startRef.current = start;
        setRatio(r); setSize(sz); setNumPages(doc.numPages); setCurrent(start); setStatus('ready');
      } catch (e) {
        if (!cancelled) { setError(e.message || 'Gagal memuat e-book'); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; task?.destroy?.(); docRef.current?.destroy?.(); };
  }, [book.id, storeKey]);

  // 2) Render halaman sekitar posisi baca (lazy, supaya PDF besar tetap ringan)
  useEffect(() => {
    if (status !== 'ready') return;
    const doc = docRef.current;
    const from = Math.max(1, current - 1), to = Math.min(numPages, current + 6);
    for (let p = from; p <= to; p++) {
      if (imagesRef.current[p] || pending.current.has(p)) continue;
      pending.current.add(p);
      renderPage(doc, p, renderW.current)
        .then((url) => { imagesRef.current[p] = url; setImages((s) => ({ ...s, [p]: url })); })
        .catch(() => {})
        .finally(() => pending.current.delete(p));
    }
  }, [current, status, numPages]);

  // 3) Responsif, keyboard, fullscreen, kunci scroll
  useEffect(() => {
    if (status !== 'ready') return;
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => setSize(calcSize(ratio)), 250); };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
  }, [status, ratio]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      if (e.key === 'ArrowRight') bookRef.current?.pageFlip().flipNext();
      if (e.key === 'ArrowLeft') bookRef.current?.pageFlip().flipPrev();
    };
    const onFs = () => setFs(!!document.fullscreenElement);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : wrapRef.current?.requestFullscreen?.());
  const onFlip = (e) => {
    setCurrent(e.data);
    try { localStorage.setItem(storeKey, String(e.data)); } catch { /* abaikan */ }
  };

  const shown = current === 0 ? '1' : `${current + 1}${current + 2 <= numPages && !size?.portrait ? `–${current + 2}` : ''}`;

  return (
    <div ref={wrapRef} className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#231B15] via-[#382f28] to-[#231B15] text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{book.title}</div>
          <div className="text-xs text-slate-400">Gunakan ← → atau seret halaman untuk membalik</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleFs} className="rounded-lg p-2 hover:bg-white/10" title="Layar penuh">{fs ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" title="Tutup"><X size={20} /></button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-slate-300"><Loader2 className="animate-spin" size={36} /> Menyiapkan buku...</div>
        )}
        {status === 'error' && (
          <div className="max-w-sm space-y-3 text-center">
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
            <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
          </div>
        )}
        {status === 'ready' && size && (
          <div className="drop-shadow-[0_25px_40px_rgba(0,0,0,.55)]">
            <HTMLFlipBook
              key={`${size.w}x${size.h}`}
              ref={bookRef}
              width={size.w}
              height={size.h}
              size="fixed"
              showCover
              usePortrait={size.portrait}
              drawShadow
              maxShadowOpacity={0.5}
              flippingTime={700}
              mobileScrollSupport={false}
              startPage={current || startRef.current}
              onFlip={onFlip}
              className=""
              style={{}}
              startZIndex={0}
              autoSize={false}
              clickEventForward
              useMouseEvents
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page key={i} num={i + 1} src={images[i + 1]} density={i === 0 || i === numPages - 1 ? 'hard' : 'soft'} />
              ))}
            </HTMLFlipBook>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-4">
          <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => bookRef.current?.pageFlip().flipPrev()}><ChevronLeft /></button>
          <input
            type="range" min={1} max={numPages} value={current + 1}
            onChange={(e) => bookRef.current?.pageFlip().turnToPage(Number(e.target.value) - 1)}
            className="flex-1 accent-[#C26D45]"
          />
          <span className="w-28 text-center text-sm tabular-nums text-slate-300">Hal. {shown} / {numPages}</span>
          <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => bookRef.current?.pageFlip().flipNext()}><ChevronRight /></button>
        </div>
      )}
    </div>
  );
}
