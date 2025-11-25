import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SignInPage } from '../components/ui/sign-in';

// Email/password sign-in flow.
export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    navigate('/register');
  };

  return (
    <SignInPage
      title={<span className="font-light text-foreground tracking-tighter">Welcome Back</span>}
      description="Access your dashboard to keep building."
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      onSignIn={handleSubmit}
      onCreateAccount={handleCreateAccount}
      submitButtonText="Sign In"
      alternateActionText="Need an account?"
      alternateActionLinkText="Register here"
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      error={error}
      submitting={submitting}
    />
  );
}
