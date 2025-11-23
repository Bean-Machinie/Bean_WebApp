import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import SettingsAppearancePage from './pages/settings/SettingsAppearancePage';
import SettingsLayout from './pages/settings/SettingsLayout';
import SettingsNotificationsPage from './pages/settings/SettingsNotificationsPage';
import SettingsProfilePage from './pages/settings/SettingsProfilePage';
import SettingsAccountPage from './pages/settings/SettingsAccountPage';
import './App.css';

type GuardedRouteProps = {
  children: JSX.Element;
};

// Blocks access to authenticated areas when no user is present.
function ProtectedRoute({ children }: GuardedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Checking authentication…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Prevents logged-in users from seeing login/register again.
function PublicRoute({ children }: GuardedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Checking authentication…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

// App wires global routes: workspaces under /app and account settings under /settings.
function App() {
  return (
    <Routes>
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SettingsProfilePage />} />
        <Route path="profile" element={<SettingsProfilePage />} />
        <Route path="account" element={<SettingsAccountPage />} />
        <Route path="friends" element={<SettingsNotificationsPage />} />
        <Route path="notifications" element={<SettingsNotificationsPage />} />
        <Route path="appearance" element={<SettingsAppearancePage />} />
        <Route path="themes" element={<SettingsAppearancePage />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Route>

      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;
