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
} from 'lucide-react';
import { api, errorMessage } from '../api';
import { AdminAccountDetail, AdminOverview, UserAccount } from '../types';

interface AdminPortalProps {
  currentAccount: UserAccount;
  onSignOut: () => void;
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
  'w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500';

export const AdminPortal: React.FC<AdminPortalProps> = ({ currentAccount, onSignOut }) => {
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
      <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center gap-3 text-sm">
        {loadError ? (
          <>
            <span className="font-semibold text-rose-300">{loadError}</span>
            <button onClick={load} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold">
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
      className={`px-3 py-1 rounded ${roleFilter === value ? `${active} text-white` : 'text-slate-400 hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white pb-16">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-white tracking-tight flex items-center">
                SIFTED <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 uppercase font-bold border border-purple-500/30">Administration</span>
              </span>
              <span className="text-[11px] text-slate-400 block">Accounts & access control</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-slate-200">{currentAccount.name}</span>
              <span className="text-slate-400">{currentAccount.email}</span>
            </div>
            <button
              onClick={onSignOut}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              message.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
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

        <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-3">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>Institutional Access Control</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Faculty Authorization & Campus Accounts</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Students register their own isolated accounts and only ever see their own tests and results. Professor accounts can only be created here, and each
              professor sees only their own assessments and candidates.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-5 h-5" />
            <span>Create Professor Account</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard label="Professors" value={overview.stats.professors} hint="Faculty accounts" icon={<Building2 className="w-6 h-6" />} tone="indigo" />
          <StatCard label="Students" value={overview.stats.students} hint={`${pendingCount} awaiting verification`} icon={<GraduationCap className="w-6 h-6" />} tone="emerald" />
          <StatCard label="Assessments" value={overview.stats.assessments} hint={`${overview.stats.invitations} invitations sent`} icon={<Award className="w-6 h-6" />} tone="amber" />
          <StatCard label="Submissions" value={overview.stats.submissions} hint={`${overview.stats.admins} administrator account(s)`} icon={<ShieldCheck className="w-6 h-6" />} tone="purple" />
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
          <StatusPill ok={overview.studentVerificationRequired} label={overview.studentVerificationRequired ? 'New students need your verification before they see tests' : 'Students are verified automatically (STUDENT_VERIFICATION=auto)'} />
          <StatusPill ok={overview.aiConfigured} label={overview.aiConfigured ? 'AI grading & generation configured' : 'AI not configured (GEMINI_API_KEY missing) — deterministic grading only'} />
          {overview.demoMode && <StatusPill ok={false} label="Demo mode is on (SEED_DEMO_DATA=true)" />}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Account Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">Verify students, reset passwords, disable or remove accounts, and review what each account owns.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name, email, lab…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
                />
              </div>
              <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-bold">
                {filterButton('all', 'All', 'bg-purple-600')}
                {filterButton('professor', 'Professors', 'bg-indigo-600')}
                {filterButton('applicant', 'Students', 'bg-emerald-600')}
                {filterButton('pending', `Pending (${pendingCount})`, 'bg-amber-600')}
                {filterButton('admin', 'Admins', 'bg-purple-600')}
              </div>
              <button onClick={load} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-bold">Account</th>
                  <th className="py-3.5 px-6 font-bold">Role</th>
                  <th className="py-3.5 px-6 font-bold">Institution / Lab</th>
                  <th className="py-3.5 px-6 font-bold">Status</th>
                  <th className="py-3.5 px-6 font-bold">Last Sign-in</th>
                  <th className="py-3.5 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No accounts match your search.
                    </td>
                  </tr>
                )}
                {filteredAccounts.map((acc) => {
                  const protectedAccount = acc.id === currentAccount.id || acc.managedByEnv;
                  const busy = busyId === acc.id;
                  return (
                    <tr key={acc.id} className={`hover:bg-slate-800/40 transition-colors ${acc.disabled ? 'opacity-60' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="font-bold text-white text-sm block">{acc.name}</span>
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span>{acc.email}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <RoleBadge account={acc} />
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-300">
                        {acc.role === 'professor' ? (
                          <>
                            <span className="text-white font-bold block">{acc.labName || '—'}</span>
                            <span className="text-slate-400 text-[11px]">{acc.department}</span>
                          </>
                        ) : acc.role === 'applicant' ? (
                          <>
                            <span className="text-white font-bold block">{acc.university || '—'}</span>
                            <span className="text-slate-400 text-[11px]">{acc.degreeProgram}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">{acc.managedByEnv ? 'Configured via environment' : acc.adminTitle || '—'}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <AccountStatus account={acc} />
                      </td>
                      <td className="py-4 px-6 text-slate-400">{formatDateTime(acc.lastLoginAt)}</td>
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

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start space-x-3">
          <Lock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-200 block mb-1">Your administrator account</span>
            This account is configured by the server's <code className="text-purple-300">ADMIN_EMAIL</code> and{' '}
            <code className="text-purple-300">ADMIN_PASSWORD</code> settings. To change its password, update those values and restart the server. Administrators can
            view and manage accounts, but they cannot sign in as another user.
          </div>
        </div>

        {overview.demoMode && (
          <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white">Reset Demo Data</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Restore the sample accounts, assessments and submissions. Every change since is permanently discarded. Only available while demo mode is enabled.
              </p>
            </div>
            <button
              onClick={resetDemo}
              className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors flex items-center space-x-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        )}
      </main>

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
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  default: 'text-slate-300 bg-slate-800 border-slate-700',
};

const StatCard: React.FC<{ label: string; value: number; hint: string; icon: React.ReactNode; tone: keyof typeof toneClasses }> = ({
  label,
  value,
  hint,
  icon,
  tone,
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
    <div>
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <span className="text-3xl font-extrabold text-white mt-1 block">{value}</span>
      <span className="text-[11px] text-slate-500 mt-1 block">{hint}</span>
    </div>
    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${toneClasses[tone]}`}>{icon}</div>
  </div>
);

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

const RoleBadge: React.FC<{ account: UserAccount }> = ({ account }) => {
  if (account.role === 'professor') {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
        <Building2 className="w-3 h-3" />
        <span>Professor</span>
      </span>
    );
  }
  if (account.role === 'admin') {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
        <ShieldCheck className="w-3 h-3" />
        <span>Admin</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
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
        ? row('text-rose-400', <Ban className="w-3.5 h-3.5" />, 'Disabled')
        : account.role === 'applicant' && !account.isVerified
          ? row('text-amber-400', <AlertCircle className="w-3.5 h-3.5" />, 'Awaiting verification')
          : row('text-emerald-400', <CheckCircle2 className="w-3.5 h-3.5" />, 'Active')}
      {account.hasPassword === false && row('text-rose-300', <Lock className="w-3.5 h-3.5" />, 'Locked: set a password')}
      {account.hasPassword !== false && account.mustChangePassword && row('text-slate-400', <KeyRound className="w-3.5 h-3.5" />, 'Must change password')}
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
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full p-6 md:p-8 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/60" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const PasswordField: React.FC<{ value: string; onChange: (value: string) => void; label: string }> = ({ value, onChange, label }) => (
  <div>
    <label className="block font-bold text-slate-300 mb-1">{label}</label>
    <div className="flex gap-2">
      <input
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
        className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold shrink-0"
      >
        Generate
      </button>
    </div>
    <p className="text-[11px] text-slate-500 mt-1">At least {MIN_PASSWORD_LENGTH} characters. The user must replace it with their own at first sign-in.</p>
  </div>
);

const CreateProfessorModal: React.FC<{ onClose: () => void; onCreated: (account: UserAccount, password: string) => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [labName, setLabName] = useState('');
  const [avatar, setAvatar] = useState('');
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
        avatar: avatar.trim() || undefined,
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
        {error && <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-rose-300 font-medium">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Full name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Arthur Pendelton" className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">University email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. apendelton@cs.univ.edu" className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Department *</label>
            <input required value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Lab / research group *</label>
            <input required value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. Neural Computation Lab" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block font-bold text-slate-300 mb-1">Avatar image URL (optional)</label>
          <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" className={inputClass} />
        </div>
        <PasswordField label="Temporary password *" value={password} onChange={setPassword} />
        <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800 mt-6">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-700 font-bold text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg shadow-purple-600/30 flex items-center space-x-2"
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
        {error && <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-rose-300 font-medium">{error}</div>}
        <p className="text-slate-400 leading-relaxed">
          The account is signed out everywhere. Share this password with its owner through a trusted channel; they will be asked to choose their own when they
          sign in.
        </p>
        <PasswordField label="New temporary password" value={password} onChange={setPassword} />
        <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800 mt-6">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-700 font-bold text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-bold">
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
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">{label}</span>
      <span className="text-slate-200 font-medium break-all">{value || '—'}</span>
    </div>
  );

  return (
    <ModalShell title={account.name} subtitle={account.email} icon={<Eye className="w-5 h-5" />} onClose={onClose} wide>
      <div className="space-y-6 text-xs max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Assessments ({assessments.length})</h4>
            {assessments.length === 0 ? (
              <p className="text-slate-500">No assessments yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
                {assessments.map((a) => (
                  <div key={a.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{a.title}</span>
                      <span className="text-slate-500">
                        {a.questionIds.length} questions • {a.timeLimitMinutes} min • {a.semester}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${a.isActive !== false ? toneClasses.emerald : toneClasses.default}`}>
                      {a.isActive !== false ? 'Published' : 'Draft'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Invitations ({invitations.length})</h4>
          {invitations.length === 0 ? (
            <p className="text-slate-500">No invitations.</p>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {invitations.map((i) => (
                <div key={i.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-white block">{professor ? i.applicantName || i.applicantEmail : assessmentTitle(i.assessmentId)}</span>
                    <span className="text-slate-500">
                      {professor ? i.applicantEmail : `Assigned ${formatDateTime(i.assignedAt)}`}
                      {i.deadline ? ` • due ${i.deadline}` : ''}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase text-slate-300 bg-slate-800 border-slate-700">{i.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Submissions ({submissions.length})</h4>
          {submissions.length === 0 ? (
            <p className="text-slate-500">No submissions.</p>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {submissions.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-white block">{professor ? s.applicantName : assessmentTitle(s.assessmentId)}</span>
                    <span className="text-slate-500">
                      {professor ? `${s.applicantEmail} • ` : ''}submitted {formatDateTime(s.finishTime)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-white block">{Math.round(s.overallScore)}%</span>
                    <span className="text-slate-400">{s.professorDecision}</span>
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
