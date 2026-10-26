import React, { useId, useState } from 'react';
import { api, errorMessage } from '../api';
import { UserAccount } from '../types';
import { SiteFooter } from './ui/SiteFooter';
import { Wordmark } from './ui/Wordmark';

interface ChangePasswordFormProps {
  onChanged: (user: UserAccount) => void;
  submitLabel?: string;
}

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25';

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onChanged, submitLabel = 'Change password' }) => {
  const id = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { user } = await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      onChanged(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Password changed. Any other devices have been signed out.
        </p>
      )}
      <div>
        <label htmlFor={`${id}-current`} className="block text-sm font-medium text-slate-800">
          Current password
        </label>
        <input id={`${id}-current`} type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-new`} className="block text-sm font-medium text-slate-800">
          New password
        </label>
        <input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby={`${id}-hint`}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          At least 8 characters. Avoid common passwords and your email name.
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-confirm`} className="block text-sm font-medium text-slate-800">
          Confirm new password
        </label>
        <input id={`${id}-confirm`} type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
      </div>
      <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
};

export const ForcedPasswordChange: React.FC<{ user: UserAccount; onChanged: (user: UserAccount) => void; onSignOut: () => void }> = ({
  user,
  onChanged,
  onSignOut,
}) => (
  <div className="flex min-h-screen flex-col">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark subtitle="Graduate admissions screening" />
        <button onClick={onSignOut} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Sign out
        </button>
      </div>
    </header>
    <main id="main" className="flex flex-1 items-start justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold">Choose your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Welcome, {user.name}. Your account was set up with a temporary password. Please choose your own before continuing.
        </p>
        <div className="mt-6">
          <ChangePasswordForm onChanged={onChanged} submitLabel="Save and continue" />
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
);
