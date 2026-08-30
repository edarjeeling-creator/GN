import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export const AdminRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || profile.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
};

export const AccountantRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || (profile.role !== 'accountant' && profile.role !== 'admin')) return <Navigate to="/dashboard" />;
  return children;
};

export const LibrarianRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || (profile.role !== 'librarian' && profile.role !== 'admin')) return <Navigate to="/dashboard" />;
  return children;
};

export const TeacherRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const isTeachingPrincipal = profile?.role === 'principal' && (!profile.designation || ['Principal', 'Headmaster'].includes(profile.designation));
  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin' && !isTeachingPrincipal)) return <Navigate to={profile?.role === 'principal' ? "/principal" : "/dashboard"} />;
  return children;
};

export const StudentRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || profile.role !== 'student') return <Navigate to="/dashboard" />;
  return children;
};

export const PrincipalRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || (profile.role !== 'principal' && profile.role !== 'admin')) return <Navigate to="/dashboard" />;
  return children;
};

export const ParentRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || profile.role !== 'parent') return <Navigate to="/dashboard" />;
  return children;
};

export const FeatureRoute = ({ featureName, userType, children }) => {
  const { profile, loading } = useAuth();
  const { featureAccess, students, loadingData } = useData();

  if (loading || loadingData) return <div>Loading feature...</div>;
  if (!profile) return <Navigate to="/login" />;

  // Admins always have access
  if (profile.role === 'admin') return children;



  // Check based on profile role and permission hierarchy
  let hasAccess = false;

  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  if (featureAccess && Array.isArray(featureAccess)) {
    const isTeachingPrincipal = profile.role === 'principal' && (!profile.designation || ['Principal', 'Headmaster'].includes(profile.designation));
    if (profile.role === 'teacher' || isTeachingPrincipal) {
      const teacherRule = featureAccess.find(f => 
        f.feature_name === featureName && 
        f.target_type === 'teacher' && 
        f.target_id === profile.id
      );
      if (teacherRule && teacherRule.is_enabled && isNotExpired(teacherRule.expires_at)) {
        hasAccess = true;
      }
    } else if (profile.role === 'student') {
      const matchingStudents = students.filter(s => {
        if (profile?.id) return s.id === profile.id;
        if (profile?.uid) return s.uid === profile.uid;
        if (profile?.name) return s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase();
        return false;
      });
      
      for (const studentData of matchingStudents) {
        // Priority 1: Student-level rule
        const studentRule = featureAccess.find(f => 
          f.feature_name === featureName && 
          f.target_type === 'student' && 
          f.target_id === studentData.id
        );

        // Priority 2: Class-level rule
        const classRule = featureAccess.find(f => 
          f.feature_name === featureName && 
          f.target_type === 'class' && 
          f.target_id === studentData.class_id
        );

        if (studentRule) {
          if (studentRule.is_enabled && isNotExpired(studentRule.expires_at)) {
            hasAccess = true;
            break;
          } else if (!studentRule.is_enabled) {
            continue; // Explicitly blocked for this record, but another record might be granted
          }
        } else if (classRule && classRule.is_enabled && isNotExpired(classRule.expires_at)) {
          hasAccess = true;
          break;
        }
      }
    }
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
