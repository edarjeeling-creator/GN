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



      const rolesToTry = ['student', 'teacher', 'admin'];
      let email = null;
      let resolvedRole = null;

      // Try finding the user in each role
      for (const role of rolesToTry) {
        const { data, error } = await supabase.rpc('lookup_user_email', {
          p_role: role,
          p_name: name,
          p_uid: uid
        });
        
        if (data) {
          email = data;
          resolvedRole = role;
          break; // Found the user
        }
      }

      if (!email) {
        // Fallback: Check if they are a teacher trying to login with Name + Password
        const { data: teacherEmail, error: teacherError } = await supabase.rpc('lookup_teacher_email_by_name', {
          p_name: name
        });
        
        if (teacherEmail) {
          email = teacherEmail;
          resolvedRole = 'teacher';
        } else {
          return { error: { message: 'Invalid Name or UID' } };
        }
      }

      // Zero-Auth student login: Bypasses supabase.auth entirely to prevent rate limits & teacher logouts!
      if (resolvedRole === 'student') {
        const { data, error: studentError } = await supabase.rpc('get_student_report', {
          p_uid: uid,
          p_academic_year: '2026'
        });
          
        if (studentError || !data || !data.student) {
          return { error: { message: 'Student record could not be loaded.' } };
        }

        const student = data.student;
        const cls = data.class;

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
        setSession(null); // Keep supabase auth session empty for this student tab
        setLoading(false);
        return { success: true };
      }

      // Teachers & Admins use standard Supabase Auth
      localStorage.removeItem('studentProfile');
      const result = await supabase.auth.signInWithPassword({ email, password: uid });
      return result;
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
