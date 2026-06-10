import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { session, profile } = useAuth();
  const { isReadOnly, allowedStudents } = useSubscription();
  
  const [academicYear, setAcademicYear] = useState(() => localStorage.getItem('academicYear') || '2026');
  
  useEffect(() => {
    localStorage.setItem('academicYear', academicYear);
  }, [academicYear]);

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState({}); // { classId: [subjectIds] }
  const [marks, setMarks] = useState({}); // { 'studentId_subjectId_term': score }
  const [attendance, setAttendance] = useState([]);
  const [featureAccess, setFeatureAccess] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      setLoadingData(true);
      
      const [clsRes, subRes, stuRes, tsRes, marksRes, attRes, featRes] = await Promise.all([
        supabase.from('classes').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('students').select('*'),
        supabase.from('teacher_subjects').select('*').eq('teacher_id', session.user.id),
        supabase.from('marks').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('feature_access').select('*')
      ]);

      if (clsRes.data) setClasses(clsRes.data);
      if (subRes.data) setSubjects(subRes.data);
      if (stuRes.data) setStudents(stuRes.data);

      if (tsRes.data) {
        const tsMap = {};
        tsRes.data.forEach(ts => {
          if (!tsMap[ts.class_id]) tsMap[ts.class_id] = [];
          tsMap[ts.class_id].push(ts.subject_id);
        });
        setTeacherSubjects(tsMap);
      }

      if (marksRes.data) {
        const marksMap = {};
        marksRes.data.forEach(m => {
          marksMap[`${m.student_id}_${m.subject_id}_${m.term}`] = m.score;
        });
        setMarks(marksMap);
      }
      
      if (attRes.data) {
        setAttendance(attRes.data);
      }
      
      if (featRes && featRes.data) {
        setFeatureAccess(featRes.data);
      }
      setLoadingData(false);
    };

    fetchData();

    // Subscribe to realtime marks updates
    const marksSubscription = supabase
      .channel('public:marks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marks' }, payload => {
        const { new: newRecord } = payload;
        if (newRecord) {
          setMarks(prev => ({
            ...prev,
            [`${newRecord.student_id}_${newRecord.subject_id}_${newRecord.term}`]: newRecord.score
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(marksSubscription);
    };
  }, [session]);

  const updateMark = async (studentId, subjectId, term, score) => {
    if (isReadOnly) {
      alert("This action is disabled. The portal is in Read-Only Mode because the school subscription has expired.");
      return;
    }

    const fullTerm = term.startsWith('202') ? term : `${academicYear}_${term}`;

    // Optimistic UI update
    setMarks(prev => ({
      ...prev,
      [`${studentId}_${subjectId}_${fullTerm}`]: score
    }));

    // Upsert to Supabase
    const { error } = await supabase.from('marks').upsert({
      student_id: studentId,
      subject_id: subjectId,
      term: fullTerm,
      score: score
    }, { onConflict: 'student_id,subject_id,term' });
    
    if (error) console.error("Error saving mark:", error);
  };

  const toggleTeacherSubject = async (classId, subjectId) => {
    if (isReadOnly) {
      alert("This action is disabled. The portal is in Read-Only Mode.");
      return;
    }

    const current = teacherSubjects[classId] || [];
    const isSelected = current.includes(subjectId);

    // Optimistic UI
    setTeacherSubjects(prev => {
      const ts = { ...prev };
      if (isSelected) ts[classId] = current.filter(id => id !== subjectId);
      else ts[classId] = [...current, subjectId];
      return ts;
    });

    if (isSelected) {
      await supabase.from('teacher_subjects')
        .delete()
        .match({ teacher_id: session.user.id, class_id: classId, subject_id: subjectId });
    } else {
      await supabase.from('teacher_subjects')
        .insert({ teacher_id: session.user.id, class_id: classId, subject_id: subjectId });
    }
  };

  const addStudent = async (classId, name, rollNo) => {
    if (isReadOnly) {
      return { success: false, error: { message: "Portal is in Read-Only Mode. Please renew your subscription to register new students." } };
    }

    if (students.length >= allowedStudents) {
      return { success: false, error: { message: `Student limit reached (${allowedStudents} allowed). Please upgrade your subscription plan.` } };
    }

    const { data, error } = await supabase.from('students').insert([{ class_id: classId, name, roll_no: rollNo }]).select();
    if (!error && data) {
      setStudents(prev => [...prev, data[0]]);
      return { success: true };
    }
    return { success: false, error };
  };

  const updateStudentLanguages = async (studentId, secondLang, thirdLang, electiveSubject = null, sixthSubject = null) => {
    if (isReadOnly) {
      alert("This action is disabled. The portal is in Read-Only Mode.");
      return;
    }

    // Optimistic UI
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, second_language: secondLang, third_language: thirdLang, elective_subject: electiveSubject, sixth_subject: sixthSubject } : s
    ));
    
    // DB Update
    await supabase.from('students')
      .update({ second_language: secondLang, third_language: thirdLang, elective_subject: electiveSubject, sixth_subject: sixthSubject })
      .eq('id', studentId);
  };

  const updateStudentUid = async (studentId, newUid) => {
    if (isReadOnly) {
      alert("This action is disabled. The portal is in Read-Only Mode.");
      return { success: false, error: { message: "Portal is in Read-Only Mode." } };
    }

    const { error } = await supabase.from('students')
      .update({ uid: newUid })
      .eq('id', studentId);

    if (!error) {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, uid: newUid } : s));
      return { success: true };
    }
    return { success: false, error };
  };

  const updateStudentPictureUrl = (studentId, newUrl) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, picture_url: newUrl } : s));
  };

  const updateSubjectName = (subjectId, newName) => {
    setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, name: newName } : s));
  };

  // Filter classes by academic year
  const activeClasses = classes.filter(c => c.academic_year === academicYear || (!c.academic_year && academicYear === '2026'));

  const removeStudent = (studentId) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const removeTeacher = (teacherId) => {
    // Note: since teachers are part of profiles, you don't keep a global teachers state in context, 
    // it's fetched locally in Admin.jsx. So this just triggers a global refresh if needed, 
    // or just does nothing and Admin.jsx updates its own state.
    // We don't need a state here if it's managed locally in Admin.jsx.
  };

  const grantFeatureAccess = async (featureName, userType, id, isEnabled = true, expiresAt = null, accessReason = '') => {
    if (isReadOnly) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const payload = {
      feature_name: featureName,
      user_type: userType,
      is_enabled: isEnabled,
      expires_at: expiresAt,
      access_reason: accessReason,
      created_by: currentUserId
    };
    if (userType === 'teacher') payload.user_id = id;
    if (userType === 'class') payload.class_id = id;
    if (userType === 'student') payload.student_id = id;

    const onConflictKeys = userType === 'teacher' ? 'feature_name,user_id' : userType === 'student' ? 'feature_name,student_id' : 'feature_name,class_id';

    // Optimistic UI update
    setFeatureAccess(prev => {
      const existingIdx = prev.findIndex(f => f.feature_name === featureName && f.user_type === userType && (userType === 'teacher' ? f.user_id === id : userType === 'student' ? f.student_id === id : f.class_id === id));
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...payload };
        return next;
      } else {
        return [...prev, payload];
      }
    });

    const { error } = await supabase
      .from('feature_access')
      .upsert(payload, { onConflict: onConflictKeys });
    
    if (error) console.error("Error granting feature:", error);
  };

  const revokeFeatureAccess = async (featureName, userType, id) => {
    if (isReadOnly) return;
    
    // Optimistic UI update
    setFeatureAccess(prev => prev.filter(f => !(f.feature_name === featureName && f.user_type === userType && (userType === 'teacher' ? f.user_id === id : userType === 'student' ? f.student_id === id : f.class_id === id))));

    let query = supabase.from('feature_access').delete().eq('feature_name', featureName).eq('user_type', userType);
    if (userType === 'teacher') query = query.eq('user_id', id);
    if (userType === 'class') query = query.eq('class_id', id);
    if (userType === 'student') query = query.eq('student_id', id);

    const { error } = await query;
    if (error) console.error("Error revoking feature:", error);
  };

  return (
    <DataContext.Provider value={{
      academicYear, setAcademicYear,
      classes: activeClasses, subjects, students, teacherSubjects, marks, attendance, featureAccess,
      loadingData,
      updateMark, toggleTeacherSubject, addStudent, updateStudentLanguages, updateStudentUid, updateStudentPictureUrl, updateSubjectName, removeStudent, grantFeatureAccess, revokeFeatureAccess
    }}>
      {children}
    </DataContext.Provider>
  );
};
