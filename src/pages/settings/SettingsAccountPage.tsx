import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

function SettingsAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ email: '', password: '', confirmText: '' });
  const [deleting, setDeleting] = useState(false);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    setResetStatus(error ? error.message : 'Reset email sent. Check your inbox.');
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || !user.email) return;
    if (deleteForm.email !== user.email || deleteForm.confirmText !== 'DELETE' || !deleteForm.password) return;
    setDeleting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deleteForm.password,
      });
      if (signInError) throw signInError;

      const tables = ['projects', 'assets', 'canvases'];
      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', user.id);
      }

      await supabase.storage.from('avatars').remove([`avatars/${user.id}.jpg`]);
      await supabase.from('profiles').delete().eq('id', user.id);

      await supabase.auth.admin.deleteUser(user.id);
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setResetStatus(err instanceof Error ? err.message : 'Unable to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="settings-panel__content">
      <h2>Account</h2>
      <p>Manage your credentials, recovery, and the nuclear option to delete everything.</p>

      <div className="settings-card">
        <div className="settings-card__header">
          <div>
            <h3>Login details</h3>
            <p>Your email is how you sign in and receive account updates.</p>
          </div>
          <span className="settings-card__meta">Private</span>
        </div>
        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-field__label">Email address</span>
            <input type="email" value={user?.email ?? ''} readOnly />
            <p className="settings-field__help">This comes from Supabase auth and cannot be edited here.</p>
          </label>
          <button className="button button--primary" type="button" onClick={handleResetPassword}>
            Reset password
          </button>
          {resetStatus ? <p className="settings-field__help">{resetStatus}</p> : null}
        </div>
      </div>

      <div className="settings-card settings-card--danger">
        <div className="settings-card__header">
          <div>
            <h3>Delete account</h3>
            <p>This permanently removes your account, data, and files.</p>
          </div>
        </div>
        <button className="button button--danger" type="button" onClick={() => setDeleteModalOpen(true)}>
          Delete Account
        </button>
      </div>

      {deleteModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <header className="modal__header">
              <h3>Confirm deletion</h3>
              <button className="modal__close" onClick={() => setDeleteModalOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="modal__body">
              <p>Type your email and password to confirm. Paste is disabled to prevent mistakes.</p>
              <label className="settings-field">
                <span className="settings-field__label">Email</span>
                <input
                  type="email"
                  value={deleteForm.email}
                  onChange={(event) => setDeleteForm({ ...deleteForm, email: event.target.value })}
                  onPaste={(event) => event.preventDefault()}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Password</span>
                <input
                  type="password"
                  value={deleteForm.password}
                  onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })}
                  onPaste={(event) => event.preventDefault()}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Confirmation text</span>
                <input
                  type="text"
                  value={deleteForm.confirmText}
                  placeholder="Type DELETE"
                  onChange={(event) => setDeleteForm({ ...deleteForm, confirmText: event.target.value })}
                  onPaste={(event) => event.preventDefault()}
                />
              </label>
              <p className="modal__warning">
                This action will delete projects, assets, canvases, and your Supabase account. It cannot be undone.
              </p>
            </div>
            <footer className="modal__footer">
              <button className="button" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="button button--danger"
                onClick={handleDeleteAccount}
                disabled={
                  deleting ||
                  !deleteForm.email ||
                  !deleteForm.password ||
                  deleteForm.email !== user?.email ||
                  deleteForm.confirmText !== 'DELETE'
                }
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SettingsAccountPage;
