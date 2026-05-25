import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
