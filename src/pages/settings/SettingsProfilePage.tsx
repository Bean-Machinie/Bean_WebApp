import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

type ProfileForm = {
  displayName: string;
  bio: string;
  website: string;
  socialAccounts: string[];
  avatarUrl?: string;
};

function SettingsProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({
    displayName: '',
    bio: '',
    website: '',
    socialAccounts: ['', '', ''],
    avatarUrl: '',
  });
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, bio, website, social_accounts, avatar_url')
          .eq('id', user.id)
          .single();

        const parsedSocialAccounts = (data?.social_accounts || '')
          .split('\n')
          .map((account: string) => account.trim())
          .filter(Boolean);

        setProfile((current) => ({
          ...current,
          displayName: data?.display_name ?? '',
          bio: data?.bio ?? '',
          website: data?.website ?? '',
          socialAccounts: [parsedSocialAccounts[0] ?? '', parsedSocialAccounts[1] ?? '', parsedSocialAccounts[2] ?? ''],
          avatarUrl: data?.avatar_url ?? '',
        }));
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

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

  const handleSocialAccountChange = (index: number) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setProfile((current) => {
      const updated = [...current.socialAccounts];
      updated[index] = event.target.value;
      return { ...current, socialAccounts: updated };
    });
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
        social_accounts: profile.socialAccounts.map((account) => account.trim()).filter(Boolean).join('\n'),
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
          className={`settings-profile__avatar ${isProfileLoading ? 'settings-profile__avatar--loading' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          aria-busy={isUploadingAvatar}
        >
          {isProfileLoading ? (
            <div className="settings-profile__avatar-skeleton" />
          ) : resolvedAvatarUrl ? (
            <img src={resolvedAvatarUrl} alt="Profile avatar" />
          ) : (
            <span>{initials}</span>
          )}
          {!isProfileLoading && (
            <div className="settings-profile__avatar-overlay">
              {isUploadingAvatar ? 'Uploading…' : 'Change profile picture'}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        <div className="settings-profile__identity">
          {isProfileLoading ? (
            <>
              <div className="settings-profile__name-skeleton" />
              <div className="settings-profile__bio-skeleton" />
            </>
          ) : (
            <>
              <h3>{resolvedName}</h3>
              <p>{profile.bio || 'Because even heroes need a profile.'}</p>
            </>
          )}
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
        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-field__label">Website</span>
            <input type="url" value={profile.website} onChange={updateField('website')} placeholder="https://" />
            <p className="settings-field__help">Portfolio, company site, or docs.</p>
          </label>

          <hr className="settings-divider" />

          <div className="settings-social">
            <div className="settings-social__title">Social accounts</div>
            <div className="settings-social__list">
              {profile.socialAccounts.map((account, index) => (
                <label key={index} className="settings-field settings-field--inline">
                  <span className="settings-social__icon" aria-hidden="true">
                    <svg
                      width="20px"
                      height="20px"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.6666 13.3333L10.0808 12.7475C9.29978 11.9664 9.29978 10.7001 10.0808 9.91905L14.5857 5.41416C15.3668 4.63311 16.6331 4.63311 17.4142 5.41415L18.5857 6.58572C19.3668 7.36677 19.3668 8.6331 18.5857 9.41415L16.9999 10.9999M13.3333 10.6666L13.919 11.2524C14.7001 12.0335 14.7001 13.2998 13.919 14.0808L9.41415 18.5857C8.6331 19.3668 7.36677 19.3668 6.58572 18.5857L5.41416 17.4142C4.63311 16.6331 4.63311 15.3668 5.41416 14.5857L6.99994 12.9999"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={account}
                    onChange={handleSocialAccountChange(index)}
                    placeholder="Profile URL or handle"
                  />
                </label>
              ))}
            </div>
            <p className="settings-field__help">Share up to three profiles for teammates to follow.</p>
          </div>
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
