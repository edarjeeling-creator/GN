import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedStudent = localStorage.getItem('studentProfile');
    if (savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent);
        setProfile(parsed);
        setSession(null);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Error parsing student profile", e);
        localStorage.removeItem('studentProfile');
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isStudentLocal = localStorage.getItem('studentProfile') !== null;
      if (!isStudentLocal) {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const isStudentLocal = localStorage.getItem('studentProfile') !== null;
      if (!isStudentLocal) {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else {
          setProfile(null);
          setLoading(false);
        }
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
    localStorage.removeItem('studentProfile');
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const unifiedLogin = async (name, uid) => {
    try {
      const trimmedName = name.trim();
      
      // If name is an email, attempt direct Supabase Auth login (common for admins & teachers)
      if (trimmedName.includes('@')) {
        localStorage.removeItem('studentProfile');
        return await supabase.auth.signInWithPassword({ email: trimmedName, password: uid });
      }



      // First, check if this is a student by calling the SECURITY DEFINER RPC
      // This bypasses RLS which is required since students are not authenticated yet
      const { data: studentReport, error: studentError } = await supabase.rpc('get_student_report', {
        p_uid: uid,
        p_academic_year: '2026' // Default academic year
      });

      if (!studentError && studentReport && studentReport.student) {
        // Verify the name matches (case-insensitive)
        const dbName = studentReport.student.name.toLowerCase().trim();
        const inputName = trimmedName.toLowerCase();
        
        if (dbName === inputName) {
          const student = studentReport.student;
          const cls = studentReport.class;

          const studentProfile = {
            id: student.id,
            name: student.name,
            role: 'student',
            student_id: student.id,
            class_id: student.class_id,
            school_id: student.school_id,
            className: cls ? `${cls.name} ${cls.section}` : ''
          };

          localStorage.setItem('studentProfile', JSON.stringify(studentProfile));
          setProfile(studentProfile);
          setSession(null);
          setLoading(false);
          return { success: true };
        }
      }

      // If not a student, check if they are a teacher trying to login with Name + Password
      // This requires a custom RPC if teachers log in by name, but usually they log in by email.
      // Since they didn't provide an email (no '@'), and they aren't a student, we fail.
      return { error: { message: 'Invalid Name or UID' } };
    } catch (err) {
      console.error("Unified login error:", err);
      return { error: err };
    }
  };

  const logout = async () => {
    localStorage.removeItem('studentProfile');
    setProfile(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, login, unifiedLogin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
