import { ChangeEvent, useState } from 'react';

function SettingsAccountPage() {
  const [account, setAccount] = useState({
    email: 'alex@bean.app',
    username: 'alexbean',
    authMethod: 'password',
    connectedApps: {
      google: true,
      github: false,
    },
  });

  const updateField = (key: keyof typeof account) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAccount({ ...account, [key]: event.target.value });
  };

  const toggleConnectedApp = (key: keyof typeof account.connectedApps) => () => {
    setAccount({
      ...account,
      connectedApps: { ...account.connectedApps, [key]: !account.connectedApps[key] },
    });
  };

  return (
    <div className="settings-panel__content">
      <h2>Account</h2>
      <p>
        Review the credentials and identity options tied to your account. Updates here affect how you sign in and
        how teammates mention you around the app.
      </p>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Login details</h3>
            <p>Stay reachable with an up-to-date email and username.</p>
          </div>
          <span className="settings-card__meta">Private</span>
        </div>
        <div className="settings-form settings-form--split">
          <label className="settings-field">
            <span className="settings-field__label">Email address</span>
            <input type="email" value={account.email} onChange={updateField('email')} />
            <p className="settings-field__help">Used for sign-in and account recovery.</p>
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Username</span>
            <input type="text" value={account.username} onChange={updateField('username')} />
            <p className="settings-field__help">Appears in comments and mentions.</p>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Authentication</h3>
            <p>Choose how you want to log in. Add backup methods for extra safety.</p>
          </div>
          <span className="settings-card__meta">Secure</span>
        </div>
        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-field__label">Primary method</span>
            <select value={account.authMethod} onChange={updateField('authMethod')}>
              <option value="password">Password</option>
              <option value="sso">Single sign-on (SSO)</option>
              <option value="otp">One-time code (email)</option>
            </select>
            <p className="settings-field__help">Control the default method presented on the login screen.</p>
          </label>

          <label className="settings-field">
            <span className="settings-field__label">Password</span>
            <input type="password" value="••••••••••" readOnly />
            <p className="settings-field__help">Use the security tab to rotate your password or keys.</p>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Connected apps</h3>
            <p>Manage third-party integrations linked to your account.</p>
          </div>
          <span className="settings-card__meta">Keeps access in sync</span>
        </div>
        <div className="settings-integration-list">
          <label className="settings-integration">
            <input type="checkbox" checked={account.connectedApps.google} onChange={toggleConnectedApp('google')} />
            <div className="settings-integration__body">
              <div className="settings-integration__title">Google</div>
              <p className="settings-integration__description">Sign in with your workspace Google account.</p>
            </div>
            <span className="settings-integration__status">
              {account.connectedApps.google ? 'Connected' : 'Not connected'}
            </span>
          </label>

          <label className="settings-integration">
            <input type="checkbox" checked={account.connectedApps.github} onChange={toggleConnectedApp('github')} />
            <div className="settings-integration__body">
              <div className="settings-integration__title">GitHub</div>
              <p className="settings-integration__description">Use GitHub to authenticate and sync commits.</p>
            </div>
            <span className="settings-integration__status">
              {account.connectedApps.github ? 'Connected' : 'Not connected'}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default SettingsAccountPage;
