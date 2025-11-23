import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
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
  const { profile, loading, resolvedAvatarUrl, avatarLoading, refreshProfile, updateProfileLocally } = useProfile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    displayName: '',
    bio: '',
    website: '',
    socialAccounts: ['', '', ''],
    avatarUrl: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      displayName: profile.displayName,
      bio: profile.bio,
      website: profile.website,
      socialAccounts: profile.socialAccounts.length
        ? profile.socialAccounts
        : ['', '', ''],
      avatarUrl: profile.avatarUrl,
    });
  }, [profile]);

  const resolvedName = useMemo(() => {
    return profile?.displayName || profile?.emailFallback || user?.email || 'Profile';
  }, [profile?.displayName, profile?.emailFallback, user?.email]);

  const initials = useMemo(() => {
    const source = resolvedName || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [resolvedName]);

  const isProfileHydrating = loading && (!profile || (!profile.displayName && !profile.avatarUrl));
  const showAvatarSkeleton = isProfileHydrating || avatarLoading;

  const updateField = (key: keyof ProfileForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setProfileForm({ ...profileForm, [key]: event.target.value });
  };

  const handleSocialAccountChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm((current) => {
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

      setProfileForm((current) => ({ ...current, avatarUrl: filePath }));
      updateProfileLocally({ avatarUrl: filePath });
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
        display_name: profileForm.displayName,
        bio: profileForm.bio,
        website: profileForm.website,
        social_accounts: profileForm.socialAccounts.map((account) => account.trim()).filter(Boolean).join('\n'),
        avatar_url: profileForm.avatarUrl ?? null,
      };

      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) throw error;

      updateProfileLocally({
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        website: profileForm.website,
        socialAccounts: profileForm.socialAccounts,
        avatarUrl: profileForm.avatarUrl ?? '',
        emailFallback: profile?.emailFallback ?? user.email ?? '',
      });
      await refreshProfile();
      setStatus('Profile updated');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const renderProfileHeader = () => {
    return (
      <div className="settings-profile__header">
        <div
          className="settings-profile__avatar"
          onClick={() => fileInputRef.current?.click()}
          aria-busy={isUploadingAvatar || showAvatarSkeleton}
        >
          {showAvatarSkeleton ? (
            <span className="skeleton skeleton--circle skeleton--avatar-lg" />
          ) : resolvedAvatarUrl ? (
            <img src={resolvedAvatarUrl} alt="Profile avatar" />
          ) : (
            <span>{initials}</span>
          )}
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
          {isProfileHydrating ? (
            <>
              <span className="skeleton skeleton--text skeleton--heading" />
              <span className="skeleton skeleton--text skeleton--body" />
            </>
          ) : (
            <>
              <h3>{resolvedName}</h3>
              <p>{profileForm.bio || 'Because even heroes need a profile.'}</p>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderFormSkeleton = () => (
    <div className="settings-form settings-form--skeleton">
      <span className="skeleton skeleton--text skeleton--input" />
      <span className="skeleton skeleton--text skeleton--textarea" />
      <span className="skeleton skeleton--text skeleton--input" />
      <span className="skeleton skeleton--text skeleton--input" />
      <span className="skeleton skeleton--text skeleton--input" />
      <span className="skeleton skeleton--text skeleton--input" />
    </div>
  );

  return (
    <div className="settings-panel__content">
      <h2>Profile</h2>

      {renderProfileHeader()}

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Public details</h3>
            <p>Your profile card carries these details wherever it wanders.</p>
          </div>
        </div>
        {isProfileHydrating ? (
          renderFormSkeleton()
        ) : (
          <div className="settings-form">
            <label className="settings-field">
              <span className="settings-field__label">Display name</span>
              <input type="text" value={profileForm.displayName} onChange={updateField('displayName')} />
              <p className="settings-field__help">If you leave this blank, your email graciously takes the stage.</p>
            </label>

            <label className="settings-field">
              <span className="settings-field__label">Short bio</span>
              <textarea rows={3} value={profileForm.bio} onChange={updateField('bio')} />
              <p className="settings-field__help">Share a tiny tale about yourself for those who peek at your profile.</p>
            </label>
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Links</h3>
            <p>Share the destinations you want teammates to find.</p>
          </div>
        </div>
        {isProfileHydrating ? (
          renderFormSkeleton()
        ) : (
          <div className="settings-form">
            <label className="settings-field">
              <span className="settings-field__label">Website</span>
              <input type="url" value={profileForm.website} onChange={updateField('website')} placeholder="https://" />
              <p className="settings-field__help">Portfolio, company site, or docs.</p>
            </label>

            <hr className="settings-divider" />

            <div className="settings-social">
              <div className="settings-social__title">Social accounts</div>
              <div className="settings-social__list">
                {profileForm.socialAccounts.map((account, index) => (
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
        )}
      </div>

      <div className="settings-profile__footer">
        <button className="button button--primary" onClick={handleSave} disabled={isSaving || isProfileHydrating}>
          {isSaving ? 'Updating…' : 'Update Profile'}
        </button>
        {status ? <span className="settings-profile__status">{status}</span> : null}
      </div>
    </div>
  );
}

export default SettingsProfilePage;
