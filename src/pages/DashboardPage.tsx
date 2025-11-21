import { useAuth } from '../context/AuthContext';

// Placeholder for authenticated experiences (future canvas, gallery, etc.).
export function DashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="page">
      <header className="page__header">
        <h1>Dashboard</h1>
        <p className="muted">This dashboard is the entry point for logged-in functionality.</p>
      </header>

      <div className="card">
        <div className="card__header">
          <div>
            <p className="muted">Signed in as</p>
            <p className="strong">{user?.email}</p>
          </div>
          <button className="button button--ghost" onClick={signOut}>
            Log out
          </button>
        </div>

        <div className="card__body">
          <p>
            This area can host navigation, future tools, or components like a canvas, gallery, or
            settings. Add sections here as the app grows.
          </p>
        </div>
      </div>
    </div>
  );
}
