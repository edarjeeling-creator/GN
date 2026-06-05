import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export const AdminRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || (profile.role !== 'admin' && profile.role !== 'principal')) return <Navigate to="/dashboard" />;
  return children;
};

export const TeacherRoute = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin' && profile.role !== 'principal')) return <Navigate to="/dashboard" />;
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

export const FeatureRoute = ({ featureName, userType, children }) => {
  const { profile, loading } = useAuth();
  const { featureAccess, students, loadingData } = useData();

  if (loading || loadingData) return <div>Loading feature...</div>;
  if (!profile) return <Navigate to="/login" />;

  // Admins always have access
  if (profile.role === 'admin') return children;

  // Check based on userType
  let hasAccess = false;

  if (featureAccess && Array.isArray(featureAccess)) {
    if (userType === 'teacher' && profile.role === 'teacher') {
      hasAccess = featureAccess.some(f => 
        f.feature_name === featureName && 
        f.user_type === 'teacher' && 
        f.user_id === profile.id && 
        f.is_enabled
      );
    } else if (userType === 'class' && profile.role === 'student') {
      const studentData = students.find(s => s.uid === profile.id);
      if (studentData) {
        hasAccess = featureAccess.some(f => 
          f.feature_name === featureName && 
          f.user_type === 'class' && 
          f.class_id === studentData.class_id && 
          f.is_enabled
        );
      }
    }
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
