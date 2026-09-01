import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MobileProtectedRoute = () => {
  const { session, profile } = useAuth();

  // Allow passing the guard if there is a standard Supabase session OR if the student is logged in via Zero-Auth
  if (!session && profile?.role !== 'student') {
    return <Navigate to="/login" replace />;
  }

  // Purely acts as an auth guard, no layout injected.
  // The layout will be handled by MobileAppShell
  return <Outlet />;
};

export default MobileProtectedRoute;
