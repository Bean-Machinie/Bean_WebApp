import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsProfilePage from './SettingsProfilePage';
import { clearProfileCache, updateCachedProfile } from '../../lib/profileCache';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'hero@example.com' } }),
}));

let serverProfile: {
  display_name?: string;
  avatar_url?: string;
  updated_at?: string;
  bio?: string;
  website?: string;
  social_accounts?: string;
};

const singleMock = vi.fn(async () => ({ data: serverProfile }));
const createSignedUrlMock = vi.fn(async () => ({ data: { signedUrl: 'https://cdn.example.com/avatar' }, error: null }));
const getPublicUrlMock = vi.fn(() => ({ publicUrl: 'https://cdn.example.com/public-avatar' }));

vi.mock('../../lib/supabaseClient', () => {
  const eq = vi.fn(() => ({ single: singleMock }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    supabase: {
      from,
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
          getPublicUrl: getPublicUrlMock,
        })),
      },
    },
  };
});

describe('SettingsProfilePage', () => {
  beforeEach(() => {
    serverProfile = {
      display_name: 'Server Name',
      avatar_url: 'avatars/server.png',
      updated_at: '2024-01-01T00:00:00.000Z',
      bio: '',
      website: '',
      social_accounts: '',
    };

    singleMock.mockClear();
    createSignedUrlMock.mockClear();
    getPublicUrlMock.mockClear();
    clearProfileCache();
  });

  it('renders cached profile data immediately and keeps the newer local entry', async () => {
    const cacheTimestamp = Date.parse('2024-02-01T00:00:00.000Z');
    updateCachedProfile('user-1', { displayName: 'Cached Name', avatarPreviewUrl: 'data:image/png;base64,cached' }, cacheTimestamp);

    render(<SettingsProfilePage />);

    expect(await screen.findByDisplayValue('Cached Name')).toBeInTheDocument();
    const avatar = await screen.findByAltText('Profile avatar');
    expect(avatar).toHaveAttribute('src', 'data:image/png;base64,cached');

    await waitFor(() => expect(singleMock).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Cached Name')).toBeInTheDocument();
  });

  it('falls back to server data when it is newer than the cache', async () => {
    const cacheTimestamp = Date.parse('2023-01-01T00:00:00.000Z');
    updateCachedProfile('user-1', { displayName: 'Old Cache', avatarPreviewUrl: 'data:image/png;base64,old' }, cacheTimestamp);

    serverProfile.updated_at = '2024-03-01T00:00:00.000Z';
    serverProfile.display_name = 'Fresh Server Name';

    render(<SettingsProfilePage />);

    await waitFor(() => expect(screen.getByDisplayValue('Fresh Server Name')).toBeInTheDocument());
    const avatar = await screen.findByAltText('Profile avatar');
    expect(avatar).toHaveAttribute('src', 'https://cdn.example.com/avatar');
  });
});
