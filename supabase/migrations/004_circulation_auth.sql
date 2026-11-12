-- 1) Profil otomatis: dukung Google (metadata 'name') selain 'full_name'
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
                           NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email));
  RETURN NEW;
END $$;

-- 2) Statistik dashboard (tanggal "hari ini" dikirim backend, zona WIB)
CREATE OR REPLACE FUNCTION public.dashboard_stats(p_today DATE) RETURNS JSON
LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'total_titles',     (SELECT count(*) FROM public.books),
    'total_copies',     (SELECT COALESCE(sum(total_stock), 0) FROM public.books),
    'available_copies', (SELECT COALESCE(sum(available_stock), 0) FROM public.books),
    'ebooks',           (SELECT count(*) FROM public.books WHERE is_ebook),
    'borrowed_now',     (SELECT count(*) FROM public.borrowings WHERE return_date IS NULL),
    'overdue_now',      (SELECT count(*) FROM public.borrowings WHERE return_date IS NULL AND due_date < p_today),
    'active_members',   (SELECT count(*) FROM public.members WHERE is_active),
    'pending_members',  (SELECT count(*) FROM public.members WHERE NOT is_active),
    'borrowed_today',   (SELECT count(*) FROM public.borrowings WHERE borrow_date = p_today),
    'returned_today',   (SELECT count(*) FROM public.borrowings WHERE return_date = p_today),
    'unpaid_fines',     (SELECT COALESCE(sum(amount), 0) FROM public.fines WHERE NOT is_paid),
    'popular', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
        SELECT b.id, b.title, b.author, b.cover_url, b.is_ebook, b.available_stock, b.total_stock,
               b.shelf_location, count(br.id)::int AS borrow_count
        FROM public.books b JOIN public.borrowings br ON br.book_id = b.id
        GROUP BY b.id ORDER BY count(br.id) DESC, b.title LIMIT 5) t)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.dashboard_stats FROM PUBLIC, anon, authenticated;

-- 3) OPSIONAL (jalankan terpisah): samakan zona waktu database dengan WIB agar
--    CURRENT_DATE pada fungsi pinjam/kembali = tanggal Jakarta.
-- ALTER DATABASE postgres SET timezone TO 'Asia/Jakarta';
