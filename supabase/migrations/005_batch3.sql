-- Deskripsi & kode buku, pengadaan, indeks pendukung
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS book_code VARCHAR(30) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_books_publisher ON public.books(publisher);
CREATE INDEX IF NOT EXISTS idx_reviews_book ON public.reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_member ON public.wishlists(member_id);

DO $$ BEGIN
  CREATE TYPE acquisition_source AS ENUM ('pembelian', 'hibah', 'sumbangan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  source acquisition_source NOT NULL DEFAULT 'pembelian',
  supplier VARCHAR(255),
  unit_price NUMERIC(12,2) CHECK (unit_price >= 0),
  acquired_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acquisitions_date ON public.acquisitions(acquired_date DESC);
ALTER TABLE public.acquisitions ENABLE ROW LEVEL SECURITY;

-- Catat buku masuk + tambah stok secara atomik
CREATE OR REPLACE FUNCTION public.receive_acquisition(
  p_book_id UUID, p_quantity INT, p_source acquisition_source, p_supplier TEXT,
  p_unit_price NUMERIC, p_date DATE, p_notes TEXT, p_created_by UUID
) RETURNS public.acquisitions LANGUAGE plpgsql AS $$
DECLARE r public.acquisitions;
BEGIN
  PERFORM 1 FROM public.books WHERE id = p_book_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buku tidak ditemukan'; END IF;
  INSERT INTO public.acquisitions (book_id, quantity, source, supplier, unit_price, acquired_date, notes, created_by)
  VALUES (p_book_id, p_quantity, p_source, p_supplier, p_unit_price, COALESCE(p_date, CURRENT_DATE), p_notes, p_created_by)
  RETURNING * INTO r;
  UPDATE public.books SET total_stock = total_stock + p_quantity, available_stock = available_stock + p_quantity
  WHERE id = p_book_id;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.receive_acquisition FROM PUBLIC, anon, authenticated;
