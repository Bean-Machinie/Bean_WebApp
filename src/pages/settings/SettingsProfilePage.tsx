import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCachedProfile, updateCachedProfile } from '../../lib/profileCache';
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
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [, setDisplayNameTimestamp] = useState(0);
  const [, setAvatarTimestamp] = useState(0);
  const [avatarSourceTimestamp, setAvatarSourceTimestamp] = useState(0);

  const applyDisplayNameCandidate = useCallback((value: string, candidateTimestamp: number) => {
    let applied = false;
    setDisplayNameTimestamp((current) => {
      if (candidateTimestamp >= current) {
        applied = true;
        setProfile((currentProfile) => ({ ...currentProfile, displayName: value }));
        return candidateTimestamp;
      }
      return current;
    });
    return applied;
  }, []);

  const applyAvatarCandidate = useCallback(
    (value: string, candidateTimestamp: number) => {
      let applied = false;
      setAvatarTimestamp((current) => {
        if (candidateTimestamp >= current) {
          applied = true;
          setResolvedAvatarUrl(value);
          return candidateTimestamp;
        }
        return current;
      });
      return applied;
    },
    [],
  );

  useEffect(() => {
    if (!user?.id) {
      setProfile({
        displayName: '',
        bio: '',
        website: '',
        socialAccounts: ['', '', ''],
        avatarUrl: '',
      });
      setResolvedAvatarUrl('');
      setAvatarPreviewUrl('');
      setAvatarTimestamp(0);
      setDisplayNameTimestamp(0);
      setIsProfileLoading(false);
      return;
    }

    const cached = getCachedProfile(user.id);
    if (cached?.displayName) {
      applyDisplayNameCandidate(cached.displayName, cached.displayNameUpdatedAt ?? 0);
    }
    if (cached?.avatarPreviewUrl) {
      setAvatarPreviewUrl(cached.avatarPreviewUrl);
      applyAvatarCandidate(cached.avatarPreviewUrl, cached.avatarUpdatedAt ?? 0);
    }
    setIsProfileLoading(!cached);

    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, bio, website, social_accounts, avatar_url, updated_at')
          .eq('id', user.id)
          .single();

        const parsedSocialAccounts = (data?.social_accounts || '')
          .split('\n')
          .map((account: string) => account.trim())
          .filter(Boolean);

        const serverUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;

        setProfile((current) => ({
          ...current,
          bio: data?.bio ?? '',
          website: data?.website ?? '',
          socialAccounts: [parsedSocialAccounts[0] ?? '', parsedSocialAccounts[1] ?? '', parsedSocialAccounts[2] ?? ''],
          avatarUrl: data?.avatar_url ?? '',
        }));

        const appliedName = applyDisplayNameCandidate(data?.display_name ?? '', serverUpdatedAt);
        setAvatarSourceTimestamp(serverUpdatedAt);

        if (appliedName) {
          updateCachedProfile(user.id, { displayName: data?.display_name ?? '' }, serverUpdatedAt);
        }
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfile();
  }, [applyAvatarCandidate, applyDisplayNameCandidate, user]);

  useEffect(() => {
    let isActive = true;

    const resolveAvatarUrl = async () => {
      if (
        profile.avatarUrl &&
        (profile.avatarUrl.startsWith('http') ||
          profile.avatarUrl.startsWith('data:') ||
          profile.avatarUrl.startsWith('blob:'))
      ) {
        applyAvatarCandidate(profile.avatarUrl, avatarSourceTimestamp);
        return;
      }

      if (!profile.avatarUrl) {
        applyAvatarCandidate(avatarPreviewUrl, avatarSourceTimestamp);
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        const applied = applyAvatarCandidate(signedData.signedUrl, avatarSourceTimestamp);
        if (applied) {
          updateCachedProfile(user?.id, { avatarPreviewUrl: signedData.signedUrl }, avatarSourceTimestamp);
        }
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        const fallbackUrl = publicData.publicUrl ?? '';
        const applied = applyAvatarCandidate(fallbackUrl, avatarSourceTimestamp);
        if (applied) {
          updateCachedProfile(user?.id, { avatarPreviewUrl: fallbackUrl }, avatarSourceTimestamp);
        }
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [applyAvatarCandidate, avatarPreviewUrl, avatarSourceTimestamp, profile.avatarUrl, user?.id]);

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
    const value = event.target.value;
    if (key === 'displayName' && user?.id) {
      const timestamp = Date.now();
      const applied = applyDisplayNameCandidate(value, timestamp);
      if (applied) {
        updateCachedProfile(user.id, { displayName: value }, timestamp);
      }
      return;
    }

    setProfile({ ...profile, [key]: value });
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

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}-${Date.now()}.${fileExt}`;

    try {
      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const previewTimestamp = Date.now();
      setAvatarPreviewUrl(previewUrl);
      const appliedPreview = applyAvatarCandidate(previewUrl, previewTimestamp);
      if (appliedPreview) {
        updateCachedProfile(user.id, { avatarPreviewUrl: previewUrl }, previewTimestamp);
      }

      const { data, error } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (error) throw error;

      const publicUrl = data?.path;
      if (!publicUrl) throw new Error('Upload failed');

      setAvatarSourceTimestamp(previewTimestamp);
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
