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
      const trimmedName = (name || '').trim();
      const trimmedUid = (uid || '').trim();
      
      // If name is an email, attempt direct Supabase Auth login (common for admins & teachers)
      if (trimmedName.includes('@')) {
        localStorage.removeItem('studentProfile');
        const loginRes = await supabase.auth.signInWithPassword({ email: trimmedName.toLowerCase(), password: trimmedUid });
        if (loginRes.error) return loginRes;

        // Block inactive staff accounts
        const { data: staffProf } = await supabase
          .from('profiles')
          .select('status, role, name')
          .eq('id', loginRes.data.user.id)
          .single();

        if (staffProf && (staffProf.status === 'Inactive' || staffProf.status === 'Suspended')) {
          await supabase.auth.signOut();
          return {
            error: {
              message: 'Your account has been deactivated. Please contact the school administrator.'
            }
          };
        }
        return loginRes;
      }

      // Check if this is a staff member (teacher, admin, principal) logging in with their name
      let staffLoginError = null;
      try {
        const { data: staffLookup, error: lookupErr } = await supabase.rpc('lookup_staff_email_by_name', {
          p_name: trimmedName
        });

        const staffEmail = typeof staffLookup === 'object' && staffLookup !== null ? staffLookup.email : staffLookup;
        const staffStatus = typeof staffLookup === 'object' && staffLookup !== null ? staffLookup.status : null;

        if (staffStatus === 'Inactive' || staffStatus === 'Suspended') {
          return {
            error: {
              message: 'Your account has been deactivated. Please contact the school administrator.'
            }
          };
        }

        if (!lookupErr && staffEmail && typeof staffEmail === 'string' && staffEmail.includes('@')) {
          localStorage.removeItem('studentProfile');
          const staffLoginRes = await supabase.auth.signInWithPassword({
            email: staffEmail.toLowerCase().trim(),
            password: trimmedUid
          });

          if (!staffLoginRes.error) {
            const { data: staffProf } = await supabase
              .from('profiles')
              .select('status, role, name')
              .eq('id', staffLoginRes.data.user.id)
              .single();

            if (staffProf && (staffProf.status === 'Inactive' || staffProf.status === 'Suspended')) {
              await supabase.auth.signOut();
              return {
                error: {
                  message: 'Your account has been deactivated. Please contact the school administrator.'
                }
              };
            }
            return staffLoginRes;
          } else {
            staffLoginError = staffLoginRes.error;
          }
        }
      } catch (staffErr) {
        console.warn('Staff name lookup failed, checking student credentials:', staffErr);
      }

      // Check if this is a student by calling the SECURITY DEFINER RPC
      // This bypasses RLS which is required since students are not authenticated yet
      const { data: studentReport, error: studentError } = await supabase.rpc('get_student_report', {
        p_uid: trimmedUid,
        p_academic_year: '2026' // Default academic year
      });

      if (!studentError && studentReport && studentReport.student) {
        // Verify the name matches (case-insensitive)
        const dbName = (studentReport.student.name || '').toLowerCase().trim();
        const inputName = trimmedName.toLowerCase();
        
        if (dbName === inputName) {
          const student = studentReport.student;
          const cls = studentReport.class;

          const studentProfile = {
            id: student.id,
            uid: student.uid,
            name: student.name,
            role: 'student',
            student_id: student.id,
            class_id: student.class_id,
            school_id: student.school_id,
            className: cls ? `${cls.name} ${cls.section}` : '',
            class: cls ? cls.name : '',
            section: cls ? cls.section : ''
          };

          localStorage.setItem('studentProfile', JSON.stringify(studentProfile));
          setProfile(studentProfile);
          setSession(null);
          setLoading(false);
          return { success: true };
        }
      }

      if (staffLoginError) {
        return { error: staffLoginError };
      }

      return { error: { message: 'Invalid Name, Email, or Password' } };
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
