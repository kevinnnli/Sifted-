import React, { useId, useState } from 'react';
import { api, errorMessage } from '../api';
import { UserAccount } from '../types';
import { SiteFooter } from './ui/SiteFooter';
import { Wordmark } from './ui/Wordmark';

interface LandingPageProps {
  onAuthenticated: (user: UserAccount) => void;
  initialTab?: 'overview' | 'student-signup' | 'login';
}

type Mode = 'login' | 'register';

const FREE_EMAIL_PROVIDERS = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@aol.com', '@icloud.com', '@protonmail.com', '@mail.com'];

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 aria-[invalid=true]:border-rose-500';

function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: (props: { id: string; 'aria-describedby'?: string }) => React.ReactNode;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthenticated, initialTab = 'overview' }) => {
  const [mode, setMode] = useState<Mode>(initialTab === 'student-signup' ? 'register' : 'login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
  const continuingToTest = new URLSearchParams(window.location.search).has('exam');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await api.auth.login(loginEmail, loginPassword);
      setLoginPassword('');
      onAuthenticated(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const primary = email.trim().toLowerCase();
    const personal = secondaryEmail.trim().toLowerCase();
    if (!name.trim() || !primary || !university.trim() || !degreeProgram.trim()) {
      setError('Please enter your name, university email, university and degree programme.');
      return;
    }
    if (FREE_EMAIL_PROVIDERS.some((p) => primary.endsWith(p))) {
      setError('Please use your university email address (for example one ending in .edu), not a personal webmail address.');
      return;
    }
    if (personal && personal === primary) {
      setError('Your personal email must be different from your university email, or leave it blank.');
      return;
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await api.auth.register({
        name: name.trim(),
        email: primary,
        secondaryEmail: personal || undefined,
        university: university.trim(),
        degreeProgram: degreeProgram.trim(),
        password,
      });
      setPassword('');
      setConfirmPassword('');
      onAuthenticated(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${ids}-tab-${value}`}
      aria-selected={mode === value}
      aria-controls={`${ids}-panel`}
      onClick={() => switchMode(value)}
      className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
        mode === value ? 'border-brand-700 text-brand-900' : 'border-transparent text-slate-600 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Wordmark subtitle="Graduate admissions screening" />
          <nav aria-label="Account" className="flex items-center gap-2 text-sm">
            <button onClick={() => switchMode('login')} className="whitespace-nowrap rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Sign in
            </button>
            <button
              onClick={() => switchMode('register')}
              className="hidden whitespace-nowrap rounded-md bg-brand-700 px-3 py-2 font-semibold text-white hover:bg-brand-800 sm:inline-block"
            >
              Create student account
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_26rem] lg:px-8 lg:py-16">
          <section aria-label="Sign in or create an account" className="lg:col-start-2 lg:row-start-1 lg:pt-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div role="tablist" aria-label="Account" className="flex border-b border-slate-200">
                {tab('login', 'Sign in')}
                {tab('register', 'Create student account')}
              </div>

              <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${mode}`} className="p-6">
                {continuingToTest && mode === 'login' && (
                  <p className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">Sign in to continue to your test.</p>
                )}
                {error && (
                  <div role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {error}
                  </div>
                )}

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    <Field label="Email" id={`${ids}-login-email`}>
                      {(p) => (
                        <input
                          {...p}
                          type="email"
                          autoComplete="username"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className={inputClass}
                          aria-invalid={Boolean(error) || undefined}
                        />
                      )}
                    </Field>
                    <Field label="Password" id={`${ids}-login-password`}>
                      {(p) => (
                        <input
                          {...p}
                          type="password"
                          autoComplete="current-password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={inputClass}
                          aria-invalid={Boolean(error) || undefined}
                        />
                      )}
                    </Field>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                    >
                      {submitting ? 'Signing in…' : 'Sign in'}
                    </button>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Forgotten your password? Ask your administrator to set a new one; you will choose your own when you next sign in.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4" noValidate>
                    <Field label="Full name" id={`${ids}-name`}>
                      {(p) => <input {...p} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />}
                    </Field>
                    <Field label="University email" hint="Used to sign in and to receive test invitations." id={`${ids}-email`}>
                      {(p) => (
                        <input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                      )}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <Field label="University" id={`${ids}-university`}>
                        {(p) => (
                          <input {...p} autoComplete="organization" required value={university} onChange={(e) => setUniversity(e.target.value)} className={inputClass} />
                        )}
                      </Field>
                      <Field label="Degree programme" id={`${ids}-degree`}>
                        {(p) => <input {...p} required value={degreeProgram} onChange={(e) => setDegreeProgram(e.target.value)} className={inputClass} />}
                      </Field>
                    </div>
                    <Field label="Personal email (optional)" hint="Shown only to professors who invite you, as another way to reach you." id={`${ids}-personal`}>
                      {(p) => <input {...p} type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} className={inputClass} />}
                    </Field>
                    <Field label="Password" hint="At least 8 characters. Avoid common passwords and your email name." id={`${ids}-password`}>
                      {(p) => (
                        <input
                          {...p}
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </Field>
                    <Field label="Confirm password" id={`${ids}-confirm`}>
                      {(p) => (
                        <input
                          {...p}
                          type="password"
                          autoComplete="new-password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </Field>
                    <p className="text-xs leading-relaxed text-slate-600">
                      By creating an account you agree to the{' '}
                      <a href="/terms" className="font-medium text-brand-700 underline underline-offset-2">
                        Terms of Service
                      </a>{' '}
                      and confirm you have read the{' '}
                      <a href="/privacy" className="font-medium text-brand-700 underline underline-offset-2">
                        Privacy Policy
                      </a>
                      .
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                    >
                      {submitting ? 'Creating account…' : 'Create account'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
          <section aria-labelledby="intro-title" className="max-w-2xl lg:col-start-1 lg:row-start-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">For prospective graduate students and their professors</p>
            <h1 id="intro-title" className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Screening assessments for graduate admissions
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Professors set short technical assessments for students applying to their research groups. Students take them online, in a private account, and
              hear back here when the professor has reviewed their work.
            </p>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">For students</h2>
                <ol className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                  <li className="flex gap-3">
                    <span className="font-serif text-base font-semibold text-brand-700" aria-hidden>
                      1
                    </span>
                    <span>Create an account with your university email. Your administrator confirms it before tests appear.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-serif text-base font-semibold text-brand-700" aria-hidden>
                      2
                    </span>
                    <span>Take the tests professors assign to you. Your answers are saved as you go, so a lost connection does not lose work.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-serif text-base font-semibold text-brand-700" aria-hidden>
                      3
                    </span>
                    <span>See each professor’s decision, and accept or decline interview invitations.</span>
                  </li>
                </ol>
              </div>
              <div>
                <h2 className="text-lg font-semibold">For professors</h2>
                <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                  <li>Build assessments from your own questions or a shared question bank.</li>
                  <li>Invite candidates by email and set deadlines and time limits.</li>
                  <li>Review graded submissions, adjust scores and schedule interviews.</li>
                  <li className="text-slate-600">Professor accounts are created by your administrator.</li>
                </ul>
              </div>
            </div>

            <div className="mt-10 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">Your information</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Students see only their own tests and results. Professors see only the students they invited. Sifted has no advertising or analytics, and you
                can delete your account and submissions at any time. Read the{' '}
                <a href="/privacy" className="font-medium text-brand-700 underline underline-offset-2">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </div>
  );
};
