CREATE OR REPLACE FUNCTION public.get_setting_int(p_key TEXT) RETURNS INT
LANGUAGE sql STABLE AS $$ SELECT value::INT FROM public.settings WHERE key = p_key $$;

-- Peminjaman atomik
CREATE OR REPLACE FUNCTION public.borrow_book(p_member_id UUID, p_book_id UUID, p_created_by UUID)
RETURNS public.borrowings LANGUAGE plpgsql AS $$
DECLARE
  m public.members; bk public.books; active_cnt INT; unpaid INT; loan_days INT; max_limit INT;
  result public.borrowings;
BEGIN
  SELECT * INTO m FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anggota tidak ditemukan'; END IF;
  IF NOT m.is_active THEN RAISE EXCEPTION 'Keanggotaan tidak aktif'; END IF;

  SELECT count(*) INTO unpaid FROM public.fines f
    JOIN public.borrowings b ON b.id = f.borrowing_id
    WHERE b.member_id = p_member_id AND f.is_paid = FALSE AND f.amount > 0;
  IF unpaid > 0 THEN RAISE EXCEPTION 'Anggota memiliki denda yang belum dibayar'; END IF;

  max_limit := COALESCE(public.get_setting_int('max_borrow_' || m.member_type::TEXT), m.max_borrow_limit);
  SELECT count(*) INTO active_cnt FROM public.borrowings
    WHERE member_id = p_member_id AND return_date IS NULL;
  IF active_cnt >= max_limit THEN RAISE EXCEPTION 'Kuota pinjam penuh (maks % buku)', max_limit; END IF;

  SELECT * INTO bk FROM public.books WHERE id = p_book_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buku tidak ditemukan'; END IF;
  IF bk.available_stock <= 0 THEN RAISE EXCEPTION 'Stok buku habis'; END IF;

  IF EXISTS (SELECT 1 FROM public.borrowings WHERE member_id = p_member_id
             AND book_id = p_book_id AND return_date IS NULL) THEN
    RAISE EXCEPTION 'Anggota sedang meminjam buku ini';
  END IF;

  loan_days := public.get_setting_int('loan_days_' || m.member_type::TEXT);

  INSERT INTO public.borrowings (member_id, book_id, borrow_date, due_date, created_by)
  VALUES (p_member_id, p_book_id, CURRENT_DATE, CURRENT_DATE + loan_days, p_created_by)
  RETURNING * INTO result;

  UPDATE public.books SET available_stock = available_stock - 1 WHERE id = p_book_id;

  -- reservasi milik anggota ini untuk buku tsb dianggap terpenuhi
  UPDATE public.reservations SET status = 'fulfilled'
    WHERE member_id = p_member_id AND book_id = p_book_id AND status = 'waiting';
  RETURN result;
END $$;

-- Pengembalian atomik + denda
CREATE OR REPLACE FUNCTION public.return_book(p_borrowing_id UUID, p_is_paid BOOLEAN DEFAULT FALSE)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  b public.borrowings; late INT; rate INT; fine_amt NUMERIC; f public.fines;
BEGIN
  SELECT * INTO b FROM public.borrowings WHERE id = p_borrowing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF b.return_date IS NOT NULL THEN RAISE EXCEPTION 'Buku sudah dikembalikan'; END IF;

  late := GREATEST(CURRENT_DATE - b.due_date, 0);
  rate := public.get_setting_int('fine_per_day');
  fine_amt := late * rate;

  UPDATE public.borrowings SET return_date = CURRENT_DATE, status = 'dikembalikan'
    WHERE id = p_borrowing_id;
  UPDATE public.books SET available_stock = LEAST(available_stock + 1, total_stock)
    WHERE id = b.book_id;

  IF late > 0 THEN
    INSERT INTO public.fines (borrowing_id, late_days, amount, is_paid, paid_at)
    VALUES (p_borrowing_id, late, fine_amt, p_is_paid, CASE WHEN p_is_paid THEN NOW() END)
    RETURNING * INTO f;
  END IF;

  -- reservasi tertua yang masih menunggu -> fulfilled
  UPDATE public.reservations SET status = 'fulfilled'
  WHERE id = (SELECT id FROM public.reservations
              WHERE book_id = b.book_id AND status = 'waiting'
              ORDER BY reservation_date LIMIT 1);

  RETURN json_build_object('borrowing_id', p_borrowing_id, 'late_days', late,
                           'fine_amount', fine_amt, 'fine', row_to_json(f));
END $$;

-- Perpanjangan
CREATE OR REPLACE FUNCTION public.renew_borrowing(p_borrowing_id UUID)
RETURNS public.borrowings LANGUAGE plpgsql AS $$
DECLARE b public.borrowings; result public.borrowings;
BEGIN
  SELECT * INTO b FROM public.borrowings WHERE id = p_borrowing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF b.return_date IS NOT NULL THEN RAISE EXCEPTION 'Buku sudah dikembalikan'; END IF;
  IF b.renew_count >= 1 THEN RAISE EXCEPTION 'Perpanjangan maksimal 1x'; END IF;
  IF EXISTS (SELECT 1 FROM public.reservations
             WHERE book_id = b.book_id AND status = 'waiting' AND member_id <> b.member_id) THEN
    RAISE EXCEPTION 'Buku sedang direservasi pengguna lain';
  END IF;
  UPDATE public.borrowings
    SET due_date = due_date + public.get_setting_int('renew_days'), renew_count = renew_count + 1
    WHERE id = p_borrowing_id RETURNING * INTO result;
  RETURN result;
END $$;

-- Fungsi hanya boleh dipanggil backend (service role)
REVOKE EXECUTE ON FUNCTION public.borrow_book, public.return_book, public.renew_borrowing FROM PUBLIC, anon, authenticated;

-- Auto-create profile saat user daftar
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: aktif sebagai lapisan tambahan (backend pakai service key yang bypass RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "books readable" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories readable" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "own member" ON public.members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own borrowings" ON public.borrowings FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "own fines" ON public.fines FOR SELECT TO authenticated
  USING (borrowing_id IN (SELECT b.id FROM public.borrowings b JOIN public.members m ON m.id = b.member_id WHERE m.user_id = auth.uid()));
CREATE POLICY "own reservations" ON public.reservations FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "reviews readable" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "own wishlist" ON public.wishlists FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- Storage bucket (jalankan juga lewat dashboard jika perlu)
INSERT INTO storage.buckets (id, name, public) VALUES ('book-covers','book-covers',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ebook-files','ebook-files',false) ON CONFLICT DO NOTHING;
