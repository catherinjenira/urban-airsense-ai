import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { AuthHeroPanel } from '../components/auth/AuthHeroPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { CITIES } from '../data/cities';
import { ThemeMode } from '../hooks/useTheme';
import { fetchModelInfo, loginUser, signupUser } from '../services/api';
import { CityId, ModelInfo, UserProfile } from '../types';

interface AuthPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

type AuthMode = 'login' | 'signup';

export function AuthPage({
  theme,
  onToggleTheme,
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredCity, setPreferredCity] = useState<CityId>('chennai');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch(() => {
        // Ignore if backend is still starting up
      });
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setError('Password must be at least 8 characters and include a letter and a number.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const res = await signupUser({
          fullName: fullName.trim(),
          email: trimmedEmail,
          password,
          preferredCity,
        });
        onAuthenticated(res.user);
      } else {
        const res = await loginUser({
          email: trimmedEmail,
          password,
        });
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the SQL authentication server.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <header className="border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/95">
        <div className="mx-auto flex h-16 max-w-[1220px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg sm:text-[21px] font-medium tracking-tight text-[#173D30] dark:text-[#ECF0EC]">
              Urban AirSense AI
            </span>
            <span className="hidden sm:inline-flex items-center rounded-sm border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-mono-tabular text-[var(--text-muted)]">
              MySQL + Random Forest
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <AuthHeroPanel modelInfo={modelInfo} />

        {/* Right Auth Card */}
        <section className="lg:col-span-6">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm">
            {/* Tab Switcher */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1 mb-6"
            >
              <button
                id="auth-tab-login"
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                aria-controls="auth-form-panel"
                onClick={() => switchMode('login')}
                className={`py-2 text-sm font-medium rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                  mode === 'login'
                    ? 'bg-[#245C45] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Log In
              </button>
              <button
                id="auth-tab-signup"
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                aria-controls="auth-form-panel"
                onClick={() => switchMode('signup')}
                className={`py-2 text-sm font-medium rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                  mode === 'signup'
                    ? 'bg-[#245C45] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Sign Up
              </button>
            </div>

            <div
              id="auth-form-panel"
              role="tabpanel"
              aria-labelledby={mode === 'login' ? 'auth-tab-login' : 'auth-tab-signup'}
            >
            <div className="mb-5">
              <h2 className="font-display text-2xl font-normal text-[var(--text-primary)]">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {mode === 'login'
                  ? 'Sign in with your registered email and password.'
                  : 'Register to save Random Forest predictions and personal exposure logs in MySQL.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aarav Nair"
                      className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[#245C45]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[#245C45]"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-city"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Default Monitoring City
                  </label>
                  <select
                    id="auth-city"
                    value={preferredCity}
                    onChange={(e) => setPreferredCity(e.target.value as CityId)}
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#245C45]"
                  >
                    {CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'signup' ? 8 : 1}
                    aria-describedby={mode === 'signup' ? 'auth-password-help' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'signup'
                        ? 'At least 8 characters'
                        : 'Enter your password'
                    }
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[#245C45]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p id="auth-password-help" className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Use at least 8 characters with both letters and numbers. Stored as PBKDF2-SHA256 in SQL with HttpOnly session cookies.
                  </p>
                )}
              </div>

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[#245C45]"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-md border border-[#D65C50]/40 bg-[#D65C50]/10 px-3 py-2.5 text-xs text-[#B43D32] dark:text-[#E57368]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#245C45] hover:bg-[#173D30] disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
              >
                <span>
                  {submitting
                    ? mode === 'login'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'login'
                    ? 'Log In to Dashboard'
                    : 'Create Account & Continue'}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)]">
              {mode === 'login' ? (
                <>
                  New to Urban AirSense AI?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-medium text-[#245C45] dark:text-[#66BA86] hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-medium text-[#245C45] dark:text-[#66BA86] hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
