import { NavLink, Outlet } from 'react-router-dom';

export type SettingsSectionId = 'profile' | 'account' | 'security' | 'notifications' | 'appearance';

const settingsSections: { id: SettingsSectionId; label: string; description: string }[] = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Update your name, bio, and basic information.',
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Manage login details and account info.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Passwords, 2FA, keys…',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Control emails and alerts.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Choose light, dark, or system theme.',
  },
];

function SettingsLayout() {
  return (
    <div className="settings-layout">
      <div className="settings-layout__shell">
        <header className="settings-layout__header">
          <div>
            <p className="settings-layout__eyebrow">Settings</p>
            <h1>Manage your account</h1>
          </div>
          <p className="settings-layout__lede">
            Configure your profile, security, notifications, and appearance from one place.
          </p>
        </header>

        <div className="settings-layout__body">
          <nav className="settings-nav" aria-label="Settings sections">
            {settingsSections.map((section) => (
              <NavLink
                key={section.id}
                to={section.id}
                className={({ isActive }) => `settings-nav__item ${isActive ? 'settings-nav__item--active' : ''}`}
              >
                <span className="settings-nav__label">{section.label}</span>
                <span className="settings-nav__description">{section.description}</span>
              </NavLink>
            ))}
          </nav>

          <section className="settings-panel" aria-live="polite">
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsLayout;
