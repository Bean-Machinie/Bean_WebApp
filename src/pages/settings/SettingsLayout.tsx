import { NavLink, Outlet } from 'react-router-dom';

export type SettingsSectionId = 'profile' | 'account' | 'friends' | 'notifications' | 'appearance';

const groupedSections: { heading?: string; sections: { id: SettingsSectionId; label: string }[] }[] = [
  {
    sections: [
      { id: 'profile', label: 'Profile' },
      { id: 'account', label: 'Account' },
    ],
  },
  {
    heading: 'Access',
    sections: [
      { id: 'friends', label: 'Friends' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    heading: 'Appearance',
    sections: [{ id: 'appearance', label: 'Themes' }],
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
          {groupedSections.map((group, index) => (
            <div key={group.heading ?? `group-${index}`} className="settings-nav__group">
              {group.heading ? <p className="settings-nav__group-title">{group.heading}</p> : null}
              <div className="settings-nav__list">
                {group.sections.map((section) => (
                  <NavLink
                    key={section.id}
                    to={section.id}
                    replace
                    className={({ isActive }) =>
                      `settings-nav__item ${isActive ? 'settings-nav__item--active' : ''}`
                    }
                  >
                    <span className="settings-nav__label">{section.label}</span>
                  </NavLink>
                ))}
              </div>
              {index < groupedSections.length - 1 ? <div className="settings-nav__divider" aria-hidden /> : null}
            </div>
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
