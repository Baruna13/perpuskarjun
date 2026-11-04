# Deploy ke Vercel (2 project dari 1 repo)
- Backend : Root Directory = server   -> env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLIENT_ORIGIN
- Frontend: Root Directory = client   -> env: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
Urutan: backend dulu -> frontend -> isi CLIENT_ORIGIN di backend -> redeploy backend.
