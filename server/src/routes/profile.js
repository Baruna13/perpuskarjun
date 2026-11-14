import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, raise, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate);

const EXT = ['jpg', 'jpeg', 'png', 'webp'];
// path file di bucket 'avatars' dari URL publik kita (null bila foto dari luar, mis. Google)
const ownPath = (url) => (url && url.includes('/object/public/avatars/') ? decodeURIComponent(url.split('/object/public/avatars/')[1]) : null);

// Ubah nama
router.patch('/', wrap(async (req, res) => {
  const { full_name } = z.object({ full_name: z.string().trim().min(1, 'Nama wajib diisi').max(255) }).parse(req.body);
  const { data, error } = await supabase.from('profiles')
    .update({ full_name, updated_at: new Date().toISOString() }).eq('id', req.user.id).select().single();
  raise(error);
  res.json(data);
}));

// Foto profil: dapatkan signed upload URL (file diunggah langsung dari browser)
router.post('/avatar-url', wrap(async (req, res) => {
  const { filename } = z.object({ filename: z.string().min(1) }).parse(req.body);
  const ext = filename.split('.').pop().toLowerCase();
  if (!EXT.includes(ext)) throw new HttpError(400, `Format foto harus: ${EXT.join(', ')}`);
  const path = `${req.user.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('avatars').createSignedUploadUrl(path);
  raise(error);
  res.json({ bucket: 'avatars', path: data.path ?? path, token: data.token });
}));

// Konfirmasi unggahan: simpan URL, hapus foto lama kita
router.post('/avatar-confirm', wrap(async (req, res) => {
  const { path } = z.object({ path: z.string().min(1) }).parse(req.body);
  if (!path.startsWith(`${req.user.id}/`)) throw new HttpError(400, 'Path file tidak valid');
  const old = ownPath(req.user.avatar_url);
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase.from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() }).eq('id', req.user.id).select().single();
  raise(error);
  if (old && old !== path) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  res.json(data);
}));

// Hapus foto profil
router.delete('/avatar', wrap(async (req, res) => {
  const old = ownPath(req.user.avatar_url);
  const { error } = await supabase.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', req.user.id);
  raise(error);
  if (old) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  res.status(204).end();
}));

export default router;
