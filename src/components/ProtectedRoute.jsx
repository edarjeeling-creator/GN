import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

const ProtectedRoute = () => {
  const { session, profile } = useAuth();

  // Allow passing the guard if there is a standard Supabase session OR if the student is logged in via Zero-Auth
  if (!session && profile?.role !== 'student') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;
