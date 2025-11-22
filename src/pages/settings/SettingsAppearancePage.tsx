import { useState } from 'react';

function SettingsAppearancePage() {
  const [theme, setTheme] = useState('system');
  const [accent, setAccent] = useState('indigo');
  const [density, setDensity] = useState('comfortable');

  const themes = [
    {
      id: 'light',
      name: 'Light',
      description: 'Bright background with crisp contrast.',
      swatches: ['#f8fafc', '#e2e8f0', '#0f172a'],
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Low glare palette for late nights.',
      swatches: ['#0f172a', '#1e293b', '#e2e8f0'],
    },
    {
      id: 'system',
      name: 'Follow system',
      description: 'Match your operating system preference.',
      swatches: ['#cbd5e1', '#e2e8f0', '#0f172a'],
    },
  ];

  const accentOptions = [
    { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
    { id: 'emerald', label: 'Emerald', swatch: '#059669' },
    { id: 'amber', label: 'Amber', swatch: '#f59e0b' },
    { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  ];

  return (
    <div className="settings-panel__content">
      <h2>Appearance</h2>
      <p>
        Control how the interface looks and feels. Preview themes, choose accent colors, and decide the
        density that keeps you most comfortable.
      </p>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Theme</h3>
            <p>Pick the mode you want to use across the app. Each option includes a quick preview.</p>
          </div>
          <span className="settings-card__meta">Live preview</span>
        </div>

        <div className="settings-card__grid">
          {themes.map((option) => (
            <label
              key={option.id}
              className={`settings-choice ${theme === option.id ? 'settings-choice--active' : ''}`}
            >
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={(event) => setTheme(event.target.value)}
              />
              <div className="settings-choice__preview">
                {option.swatches.map((swatch) => (
                  <span key={swatch} className="settings-choice__swatch" style={{ backgroundColor: swatch }} />
                ))}
              </div>
              <div className="settings-choice__body">
                <div className="settings-choice__label">{option.name}</div>
                <p className="settings-choice__description">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Accent color</h3>
            <p>Choose the accent used for buttons, sliders, and focus states.</p>
          </div>
          <span className="settings-card__meta">Applied instantly</span>
        </div>
        <div className="settings-accent-options">
          {accentOptions.map((option) => (
            <label
              key={option.id}
              className={`settings-accent ${accent === option.id ? 'settings-accent--active' : ''}`}
            >
              <input
                type="radio"
                name="accent"
                value={option.id}
                checked={accent === option.id}
                onChange={(event) => setAccent(event.target.value)}
              />
              <span className="settings-accent__swatch" style={{ backgroundColor: option.swatch }} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Density</h3>
            <p>Adjust the amount of spacing between items. Perfect for small screens or large monitors.</p>
          </div>
          <span className="settings-card__meta">Affects lists and tables</span>
        </div>
        <div className="settings-radio-group">
          <label className={`settings-radio ${density === 'compact' ? 'settings-radio--active' : ''}`}>
            <input
              type="radio"
              name="density"
              value="compact"
              checked={density === 'compact'}
              onChange={(event) => setDensity(event.target.value)}
            />
            <div>
              <div className="settings-radio__label">Compact</div>
              <p className="settings-radio__description">Tighter spacing so you can see more rows at once.</p>
            </div>
          </label>
          <label className={`settings-radio ${density === 'comfortable' ? 'settings-radio--active' : ''}`}>
            <input
              type="radio"
              name="density"
              value="comfortable"
              checked={density === 'comfortable'}
              onChange={(event) => setDensity(event.target.value)}
            />
            <div>
              <div className="settings-radio__label">Comfortable</div>
              <p className="settings-radio__description">Balanced padding that matches the rest of the app.</p>
            </div>
          </label>
          <label className={`settings-radio ${density === 'spacious' ? 'settings-radio--active' : ''}`}>
            <input
              type="radio"
              name="density"
              value="spacious"
              checked={density === 'spacious'}
              onChange={(event) => setDensity(event.target.value)}
            />
            <div>
              <div className="settings-radio__label">Spacious</div>
              <p className="settings-radio__description">Extra breathing room for focus-intensive work.</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

export default SettingsAppearancePage;
