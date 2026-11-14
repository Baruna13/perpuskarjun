-- 1) Bucket foto profil (publik, maks 2 MB, hanya gambar)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2) Profil otomatis: ambil foto dari Google bila ada
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), NULLIF(NEW.raw_user_meta_data->>'picture', '')));
  RETURN NEW;
END $$;

-- 3) Pengajuan pinjam dari aplikasi
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  note TEXT,
  borrowing_id UUID REFERENCES public.borrowings(id) ON DELETE SET NULL
);
-- satu anggota hanya boleh punya 1 pengajuan menunggu per buku
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrow_requests_pending
  ON public.borrow_requests (member_id, book_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON public.borrow_requests (status, requested_at DESC);
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;

INSERT INTO public.settings (key, value) VALUES ('request_expire_days', '2') ON CONFLICT (key) DO NOTHING;
