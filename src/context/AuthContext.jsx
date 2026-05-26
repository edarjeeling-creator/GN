import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
    if (error) console.error("Error fetching profile:", error);
    setLoading(false);
  };

  const login = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const unifiedLogin = async (name, uid) => {
    try {
      const rolesToTry = ['student', 'teacher', 'admin'];
      let email = null;

      // Try finding the user in each role
      for (const role of rolesToTry) {
        const { data, error } = await supabase.rpc('lookup_user_email', {
          p_role: role,
          p_name: name,
          p_uid: uid
        });
        
        if (data) {
          email = data;
          break; // Found the user
        }
      }

      if (!email) return { error: { message: 'Invalid Name or UID' } };

      // Step 2: Sign in with the retrieved email and the UID as the password
      return await supabase.auth.signInWithPassword({ email, password: uid });
    } catch (err) {
      console.error("Unified login error:", err);
      return { error: err };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, login, unifiedLogin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
