import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards private routes and redirects guests to the login page.
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page">Checking authentication…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
