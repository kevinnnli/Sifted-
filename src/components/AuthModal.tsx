import React, { useState } from 'react';
import { UserAccount, ActiveRole } from '../types';
import { User, GraduationCap, Building2, Mail, CheckCircle2, ShieldCheck, Sparkles, X, PlusCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: UserAccount[];
  currentAccount: UserAccount | null;
  onSelectAccount: (account: UserAccount) => void;
  onCreateAccount: (account: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currentAccount,
  onSelectAccount,
  onCreateAccount,
}) => {
  const [tab, setTab] = useState<'switch' | 'register'>('switch');
  const role: 'applicant' = 'applicant';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [programOrLab, setProgramOrLab] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !secondaryEmail.trim()) {
      setError('Both Primary University Email and Secondary Personal Email are required.');
      return;
    }
    if (email.trim().toLowerCase() === secondaryEmail.trim().toLowerCase()) {
      setError('University email and personal email must be distinct email addresses.');
      return;
    }
    const freeProviders = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@aol.com', '@icloud.com', '@protonmail.com', '@mail.com'];
    if (freeProviders.some(p => email.trim().toLowerCase().endsWith(p))) {
      setError('Primary email must be an institutional or academic address (e.g. ending in .edu), not a free webmail domain.');
      return;
    }

    const newAcc: UserAccount = {
      id: `acc-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      secondaryEmail: secondaryEmail.trim().toLowerCase(),
      isVerified: true,
      role: 'applicant',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      university: institution || 'University',
      degreeProgram: programOrLab || 'Graduate Applicant',
    };

    onCreateAccount(newAcc);
    onSelectAccount(newAcc);
    onClose();
  };

  const professors = accounts.filter((a) => a.role === 'professor');
  const applicants = accounts.filter((a) => a.role === 'applicant');
  const admins = accounts.filter((a) => a.role === 'admin');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-white/10 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">ScholarScreen Account & Role Switcher</h2>
              <p className="text-xs text-indigo-200">
                Sign in to assign tests as a Faculty Professor or take directed exams as an Applicant
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-2 mt-4 bg-slate-800/80 p-1 rounded-lg border border-slate-700 w-fit">
            <button
              onClick={() => setTab('switch')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                tab === 'switch' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Select Existing Test Account</span>
            </button>
            <button
              onClick={() => setTab('register')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                tab === 'register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create / Sign In New Account</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {tab === 'switch' ? (
            <div className="space-y-6">
              {/* Admin Accounts Section */}
              {admins.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5 text-purple-600" />
                      Institutional Admin Accounts (Can Create Professor Accounts)
                    </h3>
                    <span className="text-[11px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-100">
                      {admins.length} Accounts
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {admins.map((acc) => {
                      const isSelected = currentAccount?.id === acc.id || currentAccount?.email === acc.email;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            onSelectAccount(acc);
                            onClose();
                          }}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50/60 shadow-sm ring-1 ring-purple-600'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <img
                            src={acc.avatar}
                            alt={acc.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900 truncate">{acc.name}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                            </div>
                            <span className="text-xs text-slate-500 block truncate">{acc.email}</span>
                            <span className="text-[11px] text-purple-700 font-medium mt-1 block truncate">
                              {acc.adminTitle || 'Institutional Admin'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Professor Accounts Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                    <Building2 className="w-4 h-4 mr-1.5 text-indigo-600" />
                    Faculty & Professor Accounts (Can Assign Tests)
                  </h3>
                  <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">
                    {professors.length} Accounts
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {professors.map((acc) => {
                    const isSelected = currentAccount?.id === acc.id || currentAccount?.email === acc.email;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          onSelectAccount(acc);
                          onClose();
                        }}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={acc.avatar}
                          alt={acc.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 truncate">{acc.name}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </div>
                          <span className="text-xs text-slate-500 block truncate">{acc.email}</span>
                          <span className="text-[11px] text-indigo-600 font-medium mt-1 block truncate">
                            {acc.labName || acc.department}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Applicant Accounts Section */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                    <GraduationCap className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Applicant & Candidate Accounts (Take Directed Tests)
                  </h3>
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-100">
                    {applicants.length} Accounts
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {applicants.map((acc) => {
                    const isSelected = currentAccount?.id === acc.id || currentAccount?.email === acc.email;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          onSelectAccount(acc);
                          onClose();
                        }}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-600'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={acc.avatar}
                          alt={acc.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 truncate">{acc.name}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                          <span className="text-xs text-slate-500 block truncate">{acc.email}</span>
                          <span className="text-[11px] text-emerald-700 font-medium mt-1 block truncate">
                            {acc.university} • {acc.degreeProgram}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center space-x-2.5 text-xs text-rose-800 font-medium">
                  <span className="font-bold">Error:</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-800">
                  <strong>Role Isolation Enforced:</strong> Self-registration is restricted to Student / Applicant accounts. Faculty Professor accounts must be created by an Institutional Admin.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jordan Taylor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary University Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jtaylor@stanford.edu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Secondary Personal Email *</label>
                <input
                  type="email"
                  required
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  placeholder="e.g. jordan.personal@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">University / Institution *</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Stanford University"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Degree Program *</label>
                  <input
                    type="text"
                    value={programOrLab}
                    onChange={(e) => setProgramOrLab(e.target.value)}
                    placeholder="PhD in Artificial Intelligence"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Student Account</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
