import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { api, errorMessage } from '../api';
import { UserAccount } from '../types';

interface ChangePasswordFormProps {
  onChanged: (user: UserAccount) => void;
  submitLabel?: string;
  dark?: boolean;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onChanged, submitLabel = 'Update Password', dark = false }) => {
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

  const inputClass = dark
    ? 'w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500'
    : 'w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = dark ? 'block text-xs font-semibold text-slate-300 mb-1.5' : 'text-xs font-semibold text-slate-700 block mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className={`p-3 rounded-lg text-xs font-medium ${dark ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {error}
        </div>
      )}
      {success && (
        <div className={`p-3 rounded-lg text-xs font-medium ${dark ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          Password updated. Other devices have been signed out.
        </div>
      )}
      <div>
        <label className={labelClass}>Current password</label>
        <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>New password (at least 8 characters)</label>
        <input type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Confirm new password</label>
        <input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center space-x-2"
      >
        <KeyRound className="w-4 h-4" />
        <span>{saving ? 'Saving…' : submitLabel}</span>
      </button>
    </form>
  );
};

export const ForcedPasswordChange: React.FC<{ user: UserAccount; onChanged: (user: UserAccount) => void; onSignOut: () => void }> = ({
  user,
  onChanged,
  onSignOut,
}) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Set Your Own Password</h1>
          <p className="text-xs text-slate-400">
            Welcome, {user.name}. Your account was set up with a temporary password — choose a new one to continue.
          </p>
        </div>
      </div>
      <ChangePasswordForm onChanged={onChanged} submitLabel="Save Password & Continue" dark />
      <button onClick={onSignOut} className="text-xs text-slate-400 hover:text-white underline">
        Sign out
      </button>
    </div>
  </div>
);
