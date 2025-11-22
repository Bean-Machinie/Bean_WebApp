import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const themeOptions = [
  {
    id: 'system',
    name: 'System',
    description: 'Automatically follows your OS preference.',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Bright backgrounds and strong contrast.',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Low-glare palette for late sessions.',
  },
];

function SettingsAppearancePage() {
  const { user } = useAuth();
  const [theme, setTheme] = useState('system');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadTheme = async () => {
      const { data } = await supabase.from('profiles').select('theme_preference').eq('id', user.id).single();
      if (data?.theme_preference) {
        setTheme(data.theme_preference);
        applyTheme(data.theme_preference);
      }
    };

    loadTheme();
  }, [user]);

  const applyTheme = (value: string) => {
    document.documentElement.dataset.theme = value;
  };

  const handleSelect = async (value: string) => {
    setTheme(value);
    applyTheme(value);
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').upsert({ id: user.id, theme_preference: value });
    setStatus(error ? error.message : 'Theme saved');
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
          <span className="settings-card__meta">Live preview</span>
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

        {status ? <p className="settings-field__help">{status}</p> : null}
      </div>
    </div>
  );
}

export default SettingsAppearancePage;
