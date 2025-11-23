import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

type ProfileForm = {
  displayName: string;
  bio: string;
  website: string;
  socialAccounts: string;
  timezoneEnabled: boolean;
  timezoneValue: string;
  avatarUrl?: string;
};

function SettingsProfilePage() {
  const { user } = useAuth();
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({
    displayName: '',
    bio: '',
    website: '',
    socialAccounts: '',
    timezoneEnabled: false,
    timezoneValue: detectedTimezone,
    avatarUrl: '',
  });
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'display_name, bio, website, social_accounts, timezone_enabled, timezone_value, avatar_url',
        )
        .eq('id', user.id)
        .single();

      setProfile((current) => ({
        ...current,
        displayName: data?.display_name ?? '',
        bio: data?.bio ?? '',
        website: data?.website ?? '',
        socialAccounts: data?.social_accounts ?? '',
        timezoneEnabled: Boolean(data?.timezone_enabled),
        timezoneValue: data?.timezone_value || detectedTimezone,
        avatarUrl: data?.avatar_url ?? '',
      }));
    };

    loadProfile();
  }, [detectedTimezone, user]);

  useEffect(() => {
    let isActive = true;

    const resolveAvatarUrl = async () => {
      if (!profile.avatarUrl) {
        setResolvedAvatarUrl('');
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        setResolvedAvatarUrl(signedData.signedUrl);
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        setResolvedAvatarUrl(publicData.publicUrl ?? '');
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [profile.avatarUrl]);

  const resolvedName = profile.displayName || user?.email || 'Profile';
  const initials = resolvedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const updateField = (key: keyof ProfileForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setProfile({ ...profile, [key]: event.target.value });
  };

  const handleToggleTimezone = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, timezoneEnabled: event.target.checked });
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploadingAvatar(true);
    setStatus(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${extension}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '0',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setProfile((current) => ({ ...current, avatarUrl: filePath }));
      setStatus('Profile picture updated');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to update profile picture');
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setStatus(null);

    try {
      const payload = {
        id: user.id,
        display_name: profile.displayName,
        bio: profile.bio,
        website: profile.website,
        social_accounts: profile.socialAccounts,
        timezone_enabled: profile.timezoneEnabled,
        timezone_value: profile.timezoneValue || detectedTimezone,
        avatar_url: profile.avatarUrl ?? null,
      };

      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) throw error;

      setStatus('Profile updated');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-panel__content">
      <h2>Profile</h2>

      <div className="settings-profile__header">
        <div
          className="settings-profile__avatar"
          onClick={() => fileInputRef.current?.click()}
          aria-busy={isUploadingAvatar}
        >
          {resolvedAvatarUrl ? <img src={resolvedAvatarUrl} alt="Profile avatar" /> : <span>{initials}</span>}
          <div className="settings-profile__avatar-overlay">
            {isUploadingAvatar ? 'Uploading…' : 'Change profile picture'}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        <div className="settings-profile__identity">
          <h3>{resolvedName}</h3>
          <p>{profile.bio || 'Because even heroes need a profile.'}</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Public details</h3>
            <p>Your profile card carries these details wherever it wanders.</p>
          </div>
        </div>
        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-field__label">Display name</span>
            <input type="text" value={profile.displayName} onChange={updateField('displayName')} />
            <p className="settings-field__help">If you leave this blank, your email graciously takes the stage.</p>
          </label>

          <label className="settings-field">
            <span className="settings-field__label">Short bio</span>
            <textarea rows={3} value={profile.bio} onChange={updateField('bio')} />
            <p className="settings-field__help">Share a tiny tale about yourself for those who peek at your profile.</p>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Links</h3>
            <p>Share the destinations you want teammates to find.</p>
          </div>
        </div>
        <div className="settings-form settings-form--split">
          <label className="settings-field">
            <span className="settings-field__label">Website</span>
            <input type="url" value={profile.website} onChange={updateField('website')} placeholder="https://" />
            <p className="settings-field__help">Portfolio, company site, or docs.</p>
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Social accounts</span>
            <input
              type="text"
              value={profile.socialAccounts}
              onChange={updateField('socialAccounts')}
              placeholder="@handle or URLs"
            />
            <p className="settings-field__help">Separate multiple handles with commas.</p>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Timezone</h3>
            <p>Show your current local time to collaborators.</p>
          </div>
        </div>
        <div className="settings-form">
          <label className="settings-toggle">
            <input type="checkbox" checked={profile.timezoneEnabled} onChange={handleToggleTimezone} />
            <div>
              <div className="settings-toggle__label">Display current local time</div>
              <p className="settings-toggle__description">
                We auto-detected {detectedTimezone}. You can store any timezone string.
              </p>
            </div>
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Timezone value</span>
            <input
              type="text"
              value={profile.timezoneValue}
              onChange={updateField('timezoneValue')}
              placeholder={detectedTimezone}
            />
            <p className="settings-field__help">Uses the IANA timezone format.</p>
          </label>
        </div>
      </div>

      <div className="settings-profile__footer">
        <button className="button button--primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Updating…' : 'Update Profile'}
        </button>
        {status ? <span className="settings-profile__status">{status}</span> : null}
      </div>
    </div>
  );
}

export default SettingsProfilePage;
