import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function api(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
  return json;
}
