import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SignInPage } from '../components/ui/sign-in';

// Email/password sign-up flow.
export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password);
      // You can redirect to /login if you want users to confirm email first.
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <SignInPage
      title={<span className="font-light text-foreground tracking-tighter">Create an Account</span>}
      description="Set up access to the app and future features."
      heroImageSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=2160&q=80"
      onSignIn={handleSubmit}
      onCreateAccount={handleGoToLogin}
      submitButtonText="Create Account"
      alternateActionText="Already registered?"
      alternateActionLinkText="Log in here"
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      error={error}
      submitting={submitting}
    />
  );
}
