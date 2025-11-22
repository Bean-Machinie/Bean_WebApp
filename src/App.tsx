import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import SettingsAppearancePage from './pages/settings/SettingsAppearancePage';
import SettingsLayout from './pages/settings/SettingsLayout';
import SettingsNotificationsPage from './pages/settings/SettingsNotificationsPage';
import SettingsProfilePage from './pages/settings/SettingsProfilePage';
import SettingsAccountPage from './pages/settings/SettingsAccountPage';
import './App.css';

// App wires global routes: workspaces under /app and account settings under /settings.
function App() {
  return (
    <Routes>
      <Route path="/app" element={<AppLayout />} />

      <Route path="/settings" element={<SettingsLayout />}>
        <Route index element={<SettingsProfilePage />} />
        <Route path="profile" element={<SettingsProfilePage />} />
        <Route path="account" element={<SettingsAccountPage />} />
        <Route path="friends" element={<SettingsNotificationsPage />} />
        <Route path="notifications" element={<SettingsNotificationsPage />} />
        <Route path="appearance" element={<SettingsAppearancePage />} />
        <Route path="themes" element={<SettingsAppearancePage />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;
