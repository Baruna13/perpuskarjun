import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try { const me = await api('/auth/me'); setUser(me); return me; }
    catch (e) { setUser(null); throw e; }
  }, []);

  useEffect(() => {
    // INITIAL_SESSION & SIGNED_IN juga terpicu setelah redirect balik dari Google
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setLoading(false); return; }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setTimeout(async () => { // jangan panggil supabase langsung di dalam callback
          if (session) { try { await loadMe(); } catch { /* ditampilkan di form login */ } }
          setLoading(false);
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message);
    await loadMe();
  };

  const register = async ({ full_name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    if (!data.session) return { needsConfirm: true }; // "Confirm email" aktif di Supabase
    await loadMe();
    return { needsConfirm: false };
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}
