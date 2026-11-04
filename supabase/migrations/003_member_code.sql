-- Generator kode anggota: LIB-<tahun>-<urut 3 digit>
CREATE OR REPLACE FUNCTION public.next_member_code() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE yr TEXT := to_char(CURRENT_DATE, 'YYYY'); nxt INT;
BEGIN
  SELECT COALESCE(MAX(substring(member_code from '([0-9]+)$')::INT), 0) + 1 INTO nxt
  FROM public.members WHERE member_code LIKE 'LIB-' || yr || '-%';
  RETURN 'LIB-' || yr || '-' || lpad(nxt::TEXT, 3, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.next_member_code FROM PUBLIC, anon, authenticated;
