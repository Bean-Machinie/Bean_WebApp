import { ChangeEvent, useState } from 'react';

function SettingsProfilePage() {
  const [profile, setProfile] = useState({
    displayName: 'Alex Bean',
    bio: 'Building workflows for the whole team.',
    location: 'San Francisco, CA',
    timezone: 'Pacific Time (PT)',
    website: 'https://bean.app',
    contact: 'hello@bean.app',
  });

  const updateField = (key: keyof typeof profile) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [key]: event.target.value });
  };

  return (
    <div className="settings-panel__content">
      <h2>Profile</h2>
      <p>
        Keep your public details in sync so collaborators recognize you. These fields appear anywhere your
        profile card is shown in the app.
      </p>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Identity</h3>
            <p>Share the basics that appear on your profile card.</p>
          </div>
          <span className="settings-card__meta">Public</span>
        </div>
        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-field__label">Display name</span>
            <input type="text" value={profile.displayName} onChange={updateField('displayName')} />
            <p className="settings-field__help">How teammates see you in activity feeds.</p>
          </label>

          <label className="settings-field">
            <span className="settings-field__label">Short bio</span>
            <textarea rows={3} value={profile.bio} onChange={updateField('bio')} />
            <p className="settings-field__help">A quick description that fits on your profile header.</p>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Presence</h3>
            <p>Set your default location and time zone for scheduling.</p>
          </div>
          <span className="settings-card__meta">Used in calendar invites</span>
        </div>
        <div className="settings-form settings-form--split">
          <label className="settings-field">
            <span className="settings-field__label">Location</span>
            <input type="text" value={profile.location} onChange={updateField('location')} />
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Time zone</span>
            <input type="text" value={profile.timezone} onChange={updateField('timezone')} />
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Links</h3>
            <p>Add the destinations you want to share with everyone.</p>
          </div>
          <span className="settings-card__meta">Visible on your profile</span>
        </div>
        <div className="settings-form settings-form--split">
          <label className="settings-field">
            <span className="settings-field__label">Website</span>
            <input type="url" value={profile.website} onChange={updateField('website')} />
            <p className="settings-field__help">Link to your site, portfolio, or docs.</p>
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Public contact</span>
            <input type="email" value={profile.contact} onChange={updateField('contact')} />
            <p className="settings-field__help">An email people can reach you at.</p>
          </label>
        </div>
      </div>
    </div>
  );
}

export default SettingsProfilePage;
