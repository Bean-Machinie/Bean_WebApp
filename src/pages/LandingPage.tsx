import { Link } from 'react-router-dom';

// Public landing page with simple calls-to-action.
export function LandingPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Welcome to Bean&apos;s WebApp</h1>
        <p className="muted">A minimal starting point you can extend with more features.</p>
      </header>
      <div className="card">
        <p>Get started by creating an account or logging into your dashboard.</p>
        <div className="actions">
          <Link className="button" to="/login">
            Log in
          </Link>
          <Link className="button button--ghost" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
