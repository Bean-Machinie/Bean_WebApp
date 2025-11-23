import { useEffect, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { themeOptions, type ThemeId } from '../../theme/themeList';

function SettingsAppearancePage() {
  const { theme, setThemePreference, status } = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(status);
  }, [status]);

  const handleSelect = async (value: ThemeId) => {
    setMessage(null);
    await setThemePreference(value);
  };

  return (
    <div className="settings-panel__content">
      <h2>Themes</h2>
      <p>Choose how the interface looks. Changes apply instantly and are stored with your profile.</p>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Theme</h3>
            <p>System respects your OS, while Light and Dark force a preference.</p>
          </div>
        </div>

        <div className="theme-grid">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`theme-card ${theme === option.id ? 'theme-card--active' : ''}`}
              onClick={() => handleSelect(option.id)}
            >
              <div className="theme-card__preview" data-theme={option.id} />
              <div className="theme-card__body">
                <div className="theme-card__title">{option.name}</div>
                <p className="theme-card__description">{option.description}</p>
              </div>
            </button>
          ))}
        </div>

        {message ? <p className="settings-field__help">{message}</p> : null}
      </div>
    </div>
  );
}

export default SettingsAppearancePage;
