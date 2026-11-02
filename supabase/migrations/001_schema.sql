-- DigiLib schema (ARCH.md + settings)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'pustakawan', 'anggota');
CREATE TYPE member_type AS ENUM ('siswa', 'guru', 'staf');
CREATE TYPE borrow_status AS ENUM ('dipinjam', 'dikembalikan', 'terlambat');
CREATE TYPE reservation_status AS ENUM ('waiting', 'fulfilled', 'cancelled');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'anggota',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_code VARCHAR(50) UNIQUE NOT NULL,
  member_type member_type NOT NULL DEFAULT 'siswa',
  max_borrow_limit INT NOT NULL DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn VARCHAR(20) UNIQUE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  publisher VARCHAR(255),
  publish_year INT,
  category_id INT REFERENCES public.categories(id) ON DELETE SET NULL,
  total_stock INT NOT NULL DEFAULT 1 CHECK (total_stock >= 0),
  available_stock INT NOT NULL DEFAULT 1 CHECK (available_stock >= 0),
  shelf_location VARCHAR(50) NOT NULL,
  cover_url TEXT,
  ebook_url TEXT,
  is_ebook BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.borrowings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status borrow_status NOT NULL DEFAULT 'dipinjam',
  renew_count INT DEFAULT 0 CHECK (renew_count <= 1),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id UUID UNIQUE NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  late_days INT NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  reservation_date TIMESTAMPTZ DEFAULT NOW(),
  status reservation_status DEFAULT 'waiting'
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_book_review UNIQUE (member_id, book_id)
);

CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_book_wishlist UNIQUE (member_id, book_id)
);

-- Tambahan: settings (bisa diubah admin)
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.settings (key, value) VALUES
  ('fine_per_day','1000'),
  ('loan_days_siswa','7'),  ('loan_days_guru','14'), ('loan_days_staf','14'),
  ('max_borrow_siswa','3'), ('max_borrow_guru','5'),  ('max_borrow_staf','5'),
  ('renew_days','7');

-- Indexes
CREATE INDEX idx_books_title_isbn ON public.books(title, isbn);
CREATE INDEX idx_books_category ON public.books(category_id);
CREATE INDEX idx_borrowings_member_status ON public.borrowings(member_id, status);
CREATE INDEX idx_borrowings_due_date ON public.borrowings(due_date);
CREATE INDEX idx_reservations_book_status ON public.reservations(book_id, status);

-- Status 'terlambat' dihitung dinamis
CREATE VIEW public.v_borrowings AS
SELECT b.*,
  CASE WHEN b.return_date IS NULL AND b.due_date < CURRENT_DATE THEN 'terlambat'::borrow_status
       ELSE b.status END AS effective_status,
  CASE WHEN b.return_date IS NULL AND b.due_date < CURRENT_DATE
       THEN (CURRENT_DATE - b.due_date) ELSE 0 END AS running_late_days
FROM public.borrowings b;
