import { NavLink, Outlet } from 'react-router-dom';

export type SettingsSectionId = 'profile' | 'account' | 'security' | 'notifications' | 'appearance';

const settingsSections: { id: SettingsSectionId; label: string; description: string }[] = [
  {
    id: 'profile',
    label: 'Profile',
  },
  {
    id: 'account',
    label: 'Account',
  },
  {
    id: 'security',
    label: 'Security',
  },
  {
    id: 'notifications',
    label: 'Notifications',
  },
  {
    id: 'appearance',
    label: 'Appearance',
  },
];

function SettingsLayout() {
  return (
    <div className="settings-layout">
      <div className="settings-layout__shell">
        <header className="settings-layout__header">
          <div>
            <p className="settings-layout__eyebrow">Settings Center</p>
          </div>
        </header>

        <div className="settings-layout__body">
          <nav className="settings-nav" aria-label="Settings sections">
            {settingsSections.map((section) => (
              <NavLink
                key={section.id}
                to={section.id}
                replace
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
