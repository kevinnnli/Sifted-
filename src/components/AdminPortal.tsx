import React, { useState } from 'react';
import { ShieldCheck, Building2, GraduationCap, Users, PlusCircle, CheckCircle2, Search, LogOut, Award, Lock, Mail, UserPlus } from 'lucide-react';
import { UserAccount, ProfessorProfile } from '../types';

interface AdminPortalProps {
  currentAccount: UserAccount;
  accounts: UserAccount[];
  professors: ProfessorProfile[];
  onCreateProfessor: (newProfAcc: UserAccount, newProfProfile: ProfessorProfile) => void;
  onSwitchAccount: (account: UserAccount) => void;
  onExitToLanding: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentAccount,
  accounts,
  professors,
  onCreateProfessor,
  onSwitchAccount,
  onExitToLanding,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'professor' | 'applicant' | 'admin'>('all');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Professor Form State
  const [profName, setProfName] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profDepartment, setProfDepartment] = useState('Computer Science & Engineering');
  const [profLabName, setProfLabName] = useState('');
  const [profAvatar, setProfAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80');

  const handleCreateProfessorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim() || !profEmail.trim() || !profLabName.trim()) return;

    const profId = `prof-${Date.now()}`;
    const accId = `acc-prof-${Date.now()}`;

    const newProfProfile: ProfessorProfile = {
      id: profId,
      name: profName.trim(),
      email: profEmail.trim().toLowerCase(),
      department: profDepartment.trim(),
      labName: profLabName.trim(),
      avatar: profAvatar,
    };

    const newProfAcc: UserAccount = {
      id: accId,
      name: profName.trim(),
      email: profEmail.trim().toLowerCase(),
      isVerified: true,
      role: 'professor',
      professorId: profId,
      avatar: profAvatar,
      department: profDepartment.trim(),
      labName: profLabName.trim(),
    };

    onCreateProfessor(newProfAcc, newProfProfile);
    setSuccessMsg(`Authorized faculty account for ${newProfProfile.name} (${newProfProfile.labName}).`);
    setTimeout(() => setSuccessMsg(null), 5000);
    setShowCreateModal(false);

    // Reset Form
    setProfName('');
    setProfEmail('');
    setProfLabName('');
  };

  const filteredAccounts = accounts.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.department && a.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.university && a.university.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.labName && a.labName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    return true;
  });

  const totalProfessors = accounts.filter((a) => a.role === 'professor').length;
  const totalStudents = accounts.filter((a) => a.role === 'applicant').length;
  const totalAdmins = accounts.filter((a) => a.role === 'admin').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white pb-16">
      {/* Admin Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-white tracking-tight flex items-center">
                SCHOLARSCREEN <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 uppercase font-bold border border-purple-500/30">Provost Governance</span>
              </span>
              <span className="text-[11px] text-slate-400 block">Institutional Admin & Access Authorization</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <img
                src={currentAccount.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80'}
                alt={currentAccount.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="font-bold text-slate-200">{currentAccount.name}</span>
              <span className="text-purple-400 font-semibold">(Admin)</span>
            </div>
            <button
              onClick={onExitToLanding}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Exit Admin Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-400 underline font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Institutional Summary */}
        <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-3">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>Institutional Access Control</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Faculty Access Authorization & Campus Accounts
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              To enforce strict data isolation and institutional integrity, students can self-register their own accounts, whereas Faculty Professor accounts must be explicitly provisioned by you.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-5 h-5" />
            <span>Authorize New Professor Account</span>
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Faculty Professors</span>
              <span className="text-3xl font-extrabold text-indigo-400 mt-1 block">{totalProfessors}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Authorized lab directors</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Isolated Students</span>
              <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">{totalStudents}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Self-registered applicants</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">System Admins</span>
              <span className="text-3xl font-extrabold text-purple-400 mt-1 block">{totalAdmins}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Provost & IT governance</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Directory Table Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Campus Account Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage roles, verify institutional emails, and impersonate or switch into user environments for verification.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search accounts by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
                />
              </div>

              <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1 rounded ${roleFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setRoleFilter('professor')}
                  className={`px-3 py-1 rounded ${roleFilter === 'professor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Professors
                </button>
                <button
                  onClick={() => setRoleFilter('applicant')}
                  className={`px-3 py-1 rounded ${roleFilter === 'applicant' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Students
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-bold">User Account</th>
                  <th className="py-3.5 px-6 font-bold">Role & Isolation Type</th>
                  <th className="py-3.5 px-6 font-bold">Institution / Lab / Department</th>
                  <th className="py-3.5 px-6 font-bold">Security Status</th>
                  <th className="py-3.5 px-6 font-bold text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAccounts.map((acc) => {
                  const isProf = acc.role === 'professor';
                  const isAdmin = acc.role === 'admin';
                  const isStudent = acc.role === 'applicant';

                  let badge = (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      <GraduationCap className="w-3 h-3" />
                      <span>Isolated Student</span>
                    </span>
                  );

                  if (isProf) {
                    badge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                        <Building2 className="w-3 h-3" />
                        <span>Faculty Professor</span>
                      </span>
                    );
                  } else if (isAdmin) {
                    badge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                        <ShieldCheck className="w-3 h-3" />
                        <span>System Admin</span>
                      </span>
                    );
                  }

                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <img
                            src={acc.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                            alt={acc.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white text-sm block">{acc.name}</span>
                            <span className="text-slate-400 flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span>{acc.email}</span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">{badge}</td>
                      <td className="py-4 px-6 font-medium text-slate-300">
                        {acc.labName ? (
                          <div>
                            <span className="text-white font-bold block">{acc.labName}</span>
                            <span className="text-slate-400 text-[11px]">{acc.department}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-white font-bold block">{acc.university || 'University'}</span>
                            <span className="text-slate-400 text-[11px]">{acc.degreeProgram || acc.adminTitle || 'N/A'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified & Active</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => onSwitchAccount(acc)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors border border-slate-700"
                          title="Switch into this user's portal view"
                        >
                          Switch to Portal →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* CREATE PROFESSOR MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Authorize New Professor Account</h3>
                  <p className="text-xs text-slate-400">
                    Provision a verified faculty account with assessment authoring privileges.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProfessorSubmit} className="space-y-4 text-xs">
              <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-purple-300 flex items-center space-x-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Admin Authority:</strong> By creating this account, the faculty member can immediately publish exams and invite student candidates.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Faculty Full Name *</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    placeholder="e.g. Dr. Arthur Pendelton"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">University Email Address *</label>
                  <input
                    type="email"
                    required
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    placeholder="e.g. apendelton@cs.univ.edu"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Academic Department *</label>
                  <input
                    type="text"
                    required
                    value={profDepartment}
                    onChange={(e) => setProfDepartment(e.target.value)}
                    placeholder="e.g. Computer Science & AI"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Research Group / Lab Name *</label>
                  <input
                    type="text"
                    required
                    value={profLabName}
                    onChange={(e) => setProfLabName(e.target.value)}
                    placeholder="e.g. Neural Computation & Reasoning Lab"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Avatar Image URL (Optional)</label>
                <input
                  type="text"
                  value={profAvatar}
                  onChange={(e) => setProfAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-lg border border-slate-700 font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Authorize & Create Professor Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
