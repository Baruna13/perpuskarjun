export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Ubah error Supabase/Postgres jadi pesan yang ramah
export function raise(error) {
  if (!error) return;
  if (error.code === '23505') throw new HttpError(409, 'Data duplikat (nilai unik sudah dipakai)');
  if (error.code === '23503') throw new HttpError(409, 'Data masih dipakai data lain, tidak bisa dihapus');
  if (error.code === 'PGRST116') throw new HttpError(404, 'Data tidak ditemukan');
  throw new HttpError(422, error.message);
}

export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    if (e.name === 'ZodError')
      return res.status(400).json({ error: e.errors?.[0]?.message ?? 'Input tidak valid', details: e.errors });
    res.status(e.status ?? 422).json({ error: e.message });
  });
