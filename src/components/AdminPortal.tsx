import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Building2,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Search,
  LogOut,
  Award,
  Lock,
  Mail,
  UserPlus,
  RotateCcw,
  Eye,
  KeyRound,
  Ban,
  Trash2,
  BadgeCheck,
  X,
  RefreshCw,
  Copy,
  FlaskConical,
  LogIn,
} from 'lucide-react';
import { api, errorMessage } from '../api';
import { SummaryRow } from './ui/SummaryRow';
import { SiteFooter } from './ui/SiteFooter';
import { Wordmark } from './ui/Wordmark';
import { AdminAccountDetail, AdminOverview, TestAccount, UserAccount } from '../types';
import { ModalBehavior } from './ui/ModalBehavior';

interface AdminPortalProps {
  currentAccount: UserAccount;
  onSignOut: () => void;
  // Called after the server has switched this browser into a test account
  onOpenTestAccount: (account: UserAccount) => void;
}

type RoleFilter = 'all' | 'professor' | 'applicant' | 'admin' | 'pending';

const MIN_PASSWORD_LENGTH = 8;

// Random password that satisfies the server's strength rules; shown to the admin once to hand over
function generatePassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-paper border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500';

export const AdminPortal: React.FC<AdminPortalProps> = ({ currentAccount, onSignOut, onOpenTestAccount }) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<UserAccount | null>(null);
  const [detail, setDetail] = useState<AdminAccountDetail | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await api.admin.overview());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // persist: keep the message until dismissed (e.g. a temporary password the admin still has to copy)
  const flash = (ok: boolean, text: string, persist = false) => {
    setMessage({ ok, text });
    if (!persist) setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), 6000);
  };

  const replaceAccount = (account: UserAccount) =>
    setOverview((prev) => prev && { ...prev, accounts: prev.accounts.map((a) => (a.id === account.id ? account : a)) });

  const runAction = async (accountId: string, action: () => Promise<string>) => {
    setBusyId(accountId);
    try {
      flash(true, await action());
    } catch (e) {
      flash(false, errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleVerified = (account: UserAccount) =>
    runAction(account.id, async () => {
      const { account: updated } = await api.admin.updateAccount(account.id, { isVerified: !account.isVerified });
      replaceAccount(updated);
      return updated.isVerified ? `${updated.name} is verified and can now see assigned tests.` : `${updated.name} is no longer verified.`;
    });

  const toggleDisabled = (account: UserAccount) => {
    if (!account.disabled && !window.confirm(`Disable ${account.name}? They are signed out everywhere and cannot sign in until re-enabled.`)) return;
    runAction(account.id, async () => {
      const { account: updated } = await api.admin.updateAccount(account.id, { disabled: !account.disabled });
      replaceAccount(updated);
      return updated.disabled ? `${updated.name} has been disabled and signed out.` : `${updated.name} has been re-enabled.`;
    });
  };

  const deleteAccount = (account: UserAccount) => {
    if (!window.confirm(`Permanently delete ${account.name} (${account.email})? This cannot be undone.`)) return;
    runAction(account.id, async () => {
      await api.admin.deleteAccount(account.id);
      await load();
      return `${account.name} has been deleted.`;
    });
  };

  const openDetail = async (account: UserAccount) => {
    setBusyId(account.id);
    try {
      setDetail(await api.admin.account(account.id));
    } catch (e) {
      flash(false, errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openTestAccount = async (account: UserAccount) => {
    setBusyId(account.id);
    try {
      const { user } = await api.admin.openTestAccount(account.id);
      onOpenTestAccount(user);
    } catch (e) {
      flash(false, errorMessage(e));
      setBusyId(null);
    }
  };

  const resetTestAccounts = async () => {
    if (!window.confirm('Reset the test accounts? All test data (exams taken, reviews, changes) is deleted and rebuilt with new passwords.')) return;
    try {
      await api.admin.resetTestAccounts();
      await load();
      flash(true, 'Test accounts reset to a fresh start.');
    } catch (e) {
      flash(false, errorMessage(e));
    }
  };

  const removeTestAccounts = async () => {
    if (!window.confirm('Remove all test accounts and their data? They will not come back until you create them again.')) return;
    try {
      await api.admin.removeTestAccounts();
      await load();
      flash(true, 'Test accounts removed.');
    } catch (e) {
      flash(false, errorMessage(e));
    }
  };

  const resetDemo = async () => {
    if (!window.confirm('Reset all data to the sample data? Every account, exam, question and submission created since will be deleted (your administrator account is kept).')) return;
    try {
      await api.admin.resetDemo();
      await load();
      flash(true, 'Demo data restored.');
    } catch (e) {
      flash(false, errorMessage(e));
    }
  };

  if (!overview) {
    return (
      <div className="min-h-screen bg-paper text-slate-700 flex flex-col items-center justify-center gap-3 text-sm">
        {loadError ? (
          <>
            <span className="font-semibold text-rose-800">{loadError}</span>
            <button onClick={load} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold">
              Try Again
            </button>
          </>
        ) : (
          <span className="font-semibold">Loading administration console…</span>
        )}
      </div>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredAccounts = overview.accounts.filter((a) => {
    const haystack = [a.name, a.email, a.department, a.university, a.labName, a.degreeProgram].filter(Boolean).join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (roleFilter === 'pending') return a.role === 'applicant' && !a.isVerified;
    return roleFilter === 'all' || a.role === roleFilter;
  });
  const pendingCount = overview.accounts.filter((a) => a.role === 'applicant' && !a.isVerified).length;

  const filterButton = (value: RoleFilter, label: string, active: string) => (
    <button
      key={value}
      onClick={() => setRoleFilter(value)}
      className={`px-3 py-1 rounded ${roleFilter === value ? `${active} text-white` : 'text-slate-600 hover:text-slate-900'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Wordmark subtitle="Administration" />
          <div className="flex items-center gap-4">
            <div className="hidden text-right text-xs md:block">
              <span className="block font-semibold text-slate-800">{currentAccount.name}</span>
              <span className="text-slate-600">{currentAccount.email}</span>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 text-slate-600" aria-hidden />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              message.ok ? 'bg-brand-50 border-brand-200 text-brand-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              {message.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="text-sm font-semibold select-all">{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-xs underline font-bold">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold">Accounts and access</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Students register their own accounts and see only their own tests and results. Professor accounts are created here, and each professor sees only
              their own assessments and the students they invited.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            <span>Create professor account</span>
          </button>
        </div>

        <SummaryRow
          items={[
            { label: 'Professors', value: overview.stats.professors, note: 'Faculty accounts' },
            { label: 'Students', value: overview.stats.students, note: `${pendingCount} awaiting verification` },
            { label: 'Assessments', value: overview.stats.assessments, note: `${overview.stats.invitations} invitations sent` },
            { label: 'Submissions', value: overview.stats.submissions, note: 'Completed tests' },
          ]}
        />

        {overview.storage === 'temporary' && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-800 mt-0.5" />
            <span>
              <strong className="text-slate-900">Data is not being saved permanently.</strong> This deployment has no database connected, so accounts and results
              are lost whenever the server restarts. On Vercel, add an Upstash Redis store to the project (Storage tab) and redeploy.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <StatusPill ok={overview.studentVerificationRequired} label={overview.studentVerificationRequired ? 'New students need your verification before they see tests' : 'Students are verified automatically (STUDENT_VERIFICATION=auto)'} />
          <StatusPill ok={overview.aiConfigured} label={overview.aiConfigured ? 'AI grading & generation configured' : 'AI not configured (GEMINI_API_KEY missing) — deterministic grading only'} />
          {overview.demoMode && <StatusPill ok={false} label="Demo mode is on (SEED_DEMO_DATA=true)" />}
        </div>

        <TestAccountsPanel
          accounts={overview.testAccounts}
          enabled={overview.testAccountsEnabled}
          busyId={busyId}
          onOpen={openTestAccount}
          onReset={resetTestAccounts}
          onRemove={removeTestAccounts}
        />

        <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Account Directory</h2>
              <p className="text-xs text-slate-600 mt-0.5">Verify students, reset passwords, disable or remove accounts, and review what each account owns.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                <input aria-label="Search accounts"
                  type="text"
                  placeholder="Search by name, email, lab…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-paper border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
                />
              </div>
              <div className="flex flex-wrap gap-1 bg-paper p-1 rounded-lg border border-slate-200 text-xs font-bold">
                {filterButton('all', 'All', 'bg-brand-600')}
                {filterButton('professor', 'Professors', 'bg-brand-600')}
                {filterButton('applicant', 'Students', 'bg-brand-700')}
                {filterButton('pending', `Pending (${pendingCount})`, 'bg-amber-600')}
                {filterButton('admin', 'Admins', 'bg-brand-600')}
              </div>
              <button onClick={load} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-100 border border-slate-300 text-slate-700" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-bold">Account</th>
                  <th className="py-3.5 px-6 font-bold">Role</th>
                  <th className="py-3.5 px-6 font-bold">Institution / Lab</th>
                  <th className="py-3.5 px-6 font-bold">Status</th>
                  <th className="py-3.5 px-6 font-bold">Last Sign-in</th>
                  <th className="py-3.5 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-600">
                      No accounts match your search.
                    </td>
                  </tr>
                )}
                {filteredAccounts.map((acc) => {
                  const protectedAccount = acc.id === currentAccount.id || acc.managedByEnv;
                  const busy = busyId === acc.id;
                  return (
                    <tr key={acc.id} className={`hover:bg-slate-100 transition-colors ${acc.disabled ? 'opacity-60' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 text-sm block">{acc.name}</span>
                        <span className="text-slate-600 flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span>{acc.email}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <RoleBadge account={acc} />
                        {acc.isTestAccount && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 uppercase">
                            Test
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-700">
                        {acc.role === 'professor' ? (
                          <>
                            <span className="text-slate-900 font-bold block">{acc.labName || '—'}</span>
                            <span className="text-slate-600 text-xs">{acc.department}</span>
                          </>
                        ) : acc.role === 'applicant' ? (
                          <>
                            <span className="text-slate-900 font-bold block">{acc.university || '—'}</span>
                            <span className="text-slate-600 text-xs">{acc.degreeProgram}</span>
                          </>
                        ) : (
                          <span className="text-slate-600">{acc.managedByEnv ? 'Configured via environment' : acc.adminTitle || '—'}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <AccountStatus account={acc} />
                      </td>
                      <td className="py-4 px-6 text-slate-600">{formatDateTime(acc.lastLoginAt)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton title="View account details" onClick={() => openDetail(acc)} disabled={busy}>
                            <Eye className="w-3.5 h-3.5" />
                          </IconButton>
                          {acc.role === 'applicant' && (
                            <IconButton
                              title={acc.isVerified ? 'Revoke verification' : 'Verify student'}
                              onClick={() => toggleVerified(acc)}
                              disabled={busy}
                              tone={acc.isVerified ? 'default' : 'emerald'}
                            >
                              <BadgeCheck className="w-3.5 h-3.5" />
                            </IconButton>
                          )}
                          {!protectedAccount && (
                            <>
                              <IconButton title="Set a new password" onClick={() => setPasswordTarget(acc)} disabled={busy}>
                                <KeyRound className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton
                                title={acc.disabled ? 'Re-enable account' : 'Disable account'}
                                onClick={() => toggleDisabled(acc)}
                                disabled={busy}
                                tone={acc.disabled ? 'emerald' : 'amber'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton title="Delete account" onClick={() => deleteAccount(acc)} disabled={busy} tone="rose">
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start space-x-3">
          <Lock className="w-5 h-5 text-brand-800 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800 block mb-1">Your administrator account</span>
            This account is configured by the server's <code className="text-brand-700">ADMIN_EMAIL</code> and{' '}
            <code className="text-brand-800">ADMIN_PASSWORD</code> settings. To change its password, update those values and restart the server. Administrators can
            view and manage accounts, but the only accounts they can open directly are the test accounts.
          </div>
        </div>

        {overview.demoMode && (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Reset Demo Data</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Restore the sample accounts, assessments and submissions. Every change since is permanently discarded. Only available while demo mode is enabled.
              </p>
            </div>
            <button
              onClick={resetDemo}
              className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition-colors flex items-center space-x-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        )}
      </main>
      <SiteFooter width="max-w-7xl" />

      {showCreateModal && (
        <CreateProfessorModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async (account, password) => {
            setShowCreateModal(false);
            await load();
            flash(true, `Created ${account.name}. Temporary password: ${password} — share it securely; they must change it at first sign-in.`, true);
          }}
        />
      )}

      {passwordTarget && (
        <SetPasswordModal
          account={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={(account, password) => {
            replaceAccount(account);
            setPasswordTarget(null);
            flash(true, `New password set for ${account.name}: ${password} — they have been signed out and must choose their own at next sign-in.`, true);
          }}
        />
      )}

      {detail && <AccountDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

const toneClasses = {
  brand: 'text-brand-800 bg-brand-50 border-brand-200',
  emerald: 'text-brand-800 bg-brand-50 border-brand-200',
  amber: 'text-amber-800 bg-amber-50 border-amber-200',
  slate: 'text-slate-700 bg-slate-50 border-slate-200',
  rose: 'text-rose-800 bg-rose-50 border-rose-200',
  default: 'text-slate-700 bg-slate-100 border-slate-300',
};

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${ok ? toneClasses.emerald : toneClasses.amber}`}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
    <span>{label}</span>
  </span>
);

const IconButton: React.FC<{ title: string; onClick: () => void; disabled?: boolean; tone?: keyof typeof toneClasses; children: React.ReactNode }> = ({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}) => (
  <button
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded-lg border hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed transition ${toneClasses[tone]}`}
  >
    {children}
  </button>
);

const TestAccountsPanel: React.FC<{
  accounts: TestAccount[];
  enabled: boolean;
  busyId: string | null;
  onOpen: (account: TestAccount) => void;
  onReset: () => void;
  onRemove: () => void;
}> = ({ accounts, enabled, busyId, onOpen, onReset, onRemove }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
      },
      () => {}
    );
  };
  // Professor first, then students in the order they move through the process
  const sorted = [...accounts].sort((a, b) => (a.role === b.role ? 0 : a.role === 'professor' ? -1 : 1));

  return (
    <div className="bg-white border border-brand-200 rounded-2xl shadow-md overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Test Accounts</h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              A ready-made professor and students for trying everything out. Click <strong className="text-slate-800">Open</strong> to use an account in this
              browser (a <em>Back to admin</em> button brings you back), or sign in with its email and password in another browser. Only you can see these
              passwords.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onReset}
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{accounts.length ? 'Reset Test Data' : 'Create Test Accounts'}</span>
          </button>
          {accounts.length > 0 && (
            <button
              onClick={onRemove}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="p-6 text-xs text-slate-600">
          {enabled ? 'No test accounts yet.' : 'Test accounts are turned off.'} Click “Create Test Accounts” to set them up.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {sorted.map((acc) => (
            <div key={acc.id} className={`bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 ${acc.disabled ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-sm block truncate">{acc.name}</span>
                  <div className="mt-1">
                    <RoleBadge account={acc} />
                  </div>
                </div>
                <button
                  onClick={() => onOpen(acc)}
                  disabled={busyId === acc.id || acc.disabled}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1.5 shrink-0"
                  title={acc.disabled ? 'This account is disabled' : `Use Sifted as ${acc.name}`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{busyId === acc.id ? 'Opening…' : 'Open'}</span>
                </button>
              </div>
              {acc.testNote && <p className="text-xs text-slate-600 leading-relaxed">{acc.testNote}</p>}
              <div className="space-y-1.5 text-xs mt-auto">
                {[
                  ['Email', acc.email],
                  ['Password', acc.testPassword || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
                    <span className="text-slate-600 font-semibold w-16 shrink-0">{label}</span>
                    <code className="text-slate-800 truncate flex-1 select-all">{value}</code>
                    <button onClick={() => copy(value)} className="text-slate-600 hover:text-slate-900 shrink-0" title={`Copy ${label.toLowerCase()}`} aria-label={`Copy ${label.toLowerCase()}`}>
                      {copied === value ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-800" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RoleBadge: React.FC<{ account: UserAccount }> = ({ account }) => {
  if (account.role === 'professor') {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 uppercase">
        <Building2 className="w-3 h-3" />
        <span>Professor</span>
      </span>
    );
  }
  if (account.role === 'admin') {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 uppercase">
        <ShieldCheck className="w-3 h-3" />
        <span>Admin</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 uppercase">
      <GraduationCap className="w-3 h-3" />
      <span>Student</span>
    </span>
  );
};

const AccountStatus: React.FC<{ account: UserAccount }> = ({ account }) => {
  const row = (className: string, icon: React.ReactNode, text: string) => (
    <span className={`flex items-center space-x-1 font-semibold ${className}`}>
      {icon}
      <span>{text}</span>
    </span>
  );
  return (
    <div className="space-y-1">
      {account.disabled
        ? row('text-rose-800', <Ban className="w-3.5 h-3.5" />, 'Disabled')
        : account.role === 'applicant' && !account.isVerified
          ? row('text-amber-800', <AlertCircle className="w-3.5 h-3.5" />, 'Awaiting verification')
          : row('text-brand-800', <CheckCircle2 className="w-3.5 h-3.5" />, 'Active')}
      {account.hasPassword === false && row('text-rose-800', <Lock className="w-3.5 h-3.5" />, 'Locked: set a password')}
      {account.hasPassword !== false && account.mustChangePassword && row('text-slate-600', <KeyRound className="w-3.5 h-3.5" />, 'Must change password')}
    </div>
  );
};

const ModalShell: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({
  title,
  subtitle,
  icon,
  onClose,
  wide,
  children,
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 flex items-center justify-center p-4">
    <div className={`bg-white border border-slate-200 rounded-2xl w-full p-6 md:p-8 shadow-md ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
      <ModalBehavior onClose={onClose} />
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 flex items-center justify-center">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg bg-slate-100" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const PasswordField: React.FC<{ value: string; onChange: (value: string) => void; label: string }> = ({ value, onChange, label }) => (
  <div>
    <label className="block font-bold text-slate-700 mb-1">{label}</label>
    <div className="flex gap-2">
      <input aria-label={label}
        type="text"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        className={`${inputClass} font-mono`}
      />
      <button
        type="button"
        onClick={() => onChange(generatePassword())}
        className="px-3 rounded-lg bg-slate-100 hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold shrink-0"
      >
        Generate
      </button>
    </div>
    <p className="text-xs text-slate-600 mt-1">At least {MIN_PASSWORD_LENGTH} characters. The user must replace it with their own at first sign-in.</p>
  </div>
);

const CreateProfessorModal: React.FC<{ onClose: () => void; onCreated: (account: UserAccount, password: string) => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [labName, setLabName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { account } = await api.admin.createProfessor({
        name,
        email,
        department,
        labName,
        temporaryPassword: password,
      });
      onCreated(account, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Create Professor Account" subtitle="Faculty accounts can author assessments and invite students." icon={<UserPlus className="w-5 h-5" />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-800 font-medium">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full name *</label>
            <input aria-label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Arthur Pendelton" className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">University email *</label>
            <input aria-label="University email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. apendelton@cs.univ.edu" className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Department *</label>
            <input aria-label="Department" required value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Lab / research group *</label>
            <input aria-label="Lab / research group" required value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. Neural Computation Lab" className={inputClass} />
          </div>
        </div>
        <PasswordField label="Temporary password *" value={password} onChange={setPassword} />
        <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200 mt-6">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{saving ? 'Creating…' : 'Create Account'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const SetPasswordModal: React.FC<{ account: UserAccount; onClose: () => void; onSaved: (account: UserAccount, password: string) => void }> = ({ account, onClose, onSaved }) => {
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { account: updated } = await api.admin.setPassword(account.id, password);
      onSaved(updated, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Set a New Password" subtitle={`${account.name} • ${account.email}`} icon={<KeyRound className="w-5 h-5" />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-800 font-medium">{error}</div>}
        <p className="text-slate-600 leading-relaxed">
          The account is signed out everywhere. Share this password with its owner through a trusted channel; they will be asked to choose their own when they
          sign in.
        </p>
        <PasswordField label="New temporary password" value={password} onChange={setPassword} />
        <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200 mt-6">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-bold">
            {saving ? 'Saving…' : 'Set Password'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const AccountDetailModal: React.FC<{ detail: AdminAccountDetail; onClose: () => void }> = ({ detail, onClose }) => {
  const { account, professor, assessments, invitations, submissions } = detail;
  const assessmentTitle = (id: string) => assessments.find((a) => a.id === id)?.title || id;
  const field = (label: string, value?: string) => (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-600 font-bold block">{label}</span>
      <span className="text-slate-800 font-medium break-all">{value || '—'}</span>
    </div>
  );

  return (
    <ModalShell title={account.name} subtitle={account.email} icon={<Eye className="w-5 h-5" />} onClose={onClose} wide>
      <div className="space-y-6 text-xs max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          {field('Role', account.role === 'applicant' ? 'Student' : account.role)}
          {field('Created', formatDateTime(account.createdAt))}
          {field('Last sign-in', formatDateTime(account.lastLoginAt))}
          {field('Status', account.disabled ? 'Disabled' : account.isVerified ? 'Verified' : 'Unverified')}
          {account.role === 'applicant' && (
            <>
              {field('Personal email', account.secondaryEmail)}
              {field('University', account.university)}
              {field('Degree program', account.degreeProgram)}
            </>
          )}
          {professor && (
            <>
              {field('Department', professor.department)}
              {field('Lab', professor.labName)}
            </>
          )}
        </div>

        {professor && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Assessments ({assessments.length})</h4>
            {assessments.length === 0 ? (
              <p className="text-slate-600">No assessments yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {assessments.map((a) => (
                  <div key={a.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{a.title}</span>
                      <span className="text-slate-600">
                        {a.questionIds.length} questions • {a.timeLimitMinutes} min • {a.semester}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${a.isActive !== false ? toneClasses.emerald : toneClasses.default}`}>
                      {a.isActive !== false ? 'Published' : 'Draft'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Invitations ({invitations.length})</h4>
          {invitations.length === 0 ? (
            <p className="text-slate-600">No invitations.</p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {invitations.map((i) => (
                <div key={i.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 block">{professor ? i.applicantName || i.applicantEmail : assessmentTitle(i.assessmentId)}</span>
                    <span className="text-slate-600">
                      {professor ? i.applicantEmail : `Assigned ${formatDateTime(i.assignedAt)}`}
                      {i.deadline ? ` • due ${i.deadline}` : ''}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-bold border uppercase text-slate-700 bg-slate-100 border-slate-300">{i.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Submissions ({submissions.length})</h4>
          {submissions.length === 0 ? (
            <p className="text-slate-600">No submissions.</p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {submissions.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 block">{professor ? s.applicantName : assessmentTitle(s.assessmentId)}</span>
                    <span className="text-slate-600">
                      {professor ? `${s.applicantEmail} • ` : ''}submitted {formatDateTime(s.finishTime)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">{Math.round(s.overallScore)}%</span>
                    <span className="text-slate-600">{s.professorDecision}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
};
