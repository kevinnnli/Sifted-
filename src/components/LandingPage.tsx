import React, { useState } from 'react';
import { GraduationCap, Building2, ShieldCheck, Sparkles, ArrowRight, CheckCircle2, UserCheck, Lock, Users, FileText, Cpu, Eye, PlusCircle, LogIn } from 'lucide-react';
import { UserAccount } from '../types';

interface LandingPageProps {
  onSelectAccount: (account: UserAccount) => void;
  onCreateStudentAccount: (newAcc: UserAccount) => void;
  accounts: UserAccount[];
  assessmentsCount: number;
  questionsCount: number;
  submissionsCount: number;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectAccount,
  onCreateStudentAccount,
  accounts,
  assessmentsCount,
  questionsCount,
  submissionsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'student-signup' | 'login'>('overview');
  const [loginRoleFilter, setLoginRoleFilter] = useState<'all' | 'applicant' | 'professor' | 'admin'>('all');

  // Student Sign Up Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStudentRegister = (e: React.FormEvent) => {
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
      id: `acc-app-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      secondaryEmail: secondaryEmail.trim().toLowerCase(),
      isVerified: true,
      role: 'applicant',
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
      university: university || 'Target University',
      degreeProgram: degreeProgram || 'PhD / MS Applicant',
    };

    onCreateStudentAccount(newAcc);
  };

  const filteredAccounts = accounts.filter((a) => {
    if (loginRoleFilter === 'all') return true;
    return a.role === loginRoleFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Powered Graduate Research Screening & Institutional Portal</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Elevating Faculty Evaluation & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">Isolated Student Screening</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
            ScholarScreen connects university research labs with prospective PhD and MS candidates. Students create isolated, verified accounts to take custom technical screening exams, while faculty evaluate algorithmic rigor and research intuition with automated AI grading rubrics.
          </p>

          {/* Quick Stats Bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-center">
              <span className="block text-2xl font-extrabold text-indigo-400">{assessmentsCount}+</span>
              <span className="text-xs text-slate-400 font-medium">Active Research Screening Exams</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-center">
              <span className="block text-2xl font-extrabold text-purple-400">{questionsCount}+</span>
              <span className="text-xs text-slate-400 font-medium">LaTeX & Code Rubric Questions</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-center">
              <span className="block text-2xl font-extrabold text-emerald-400">{submissionsCount}+</span>
              <span className="text-xs text-slate-400 font-medium">Candidate Evaluations Completed</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-center">
              <span className="block text-2xl font-extrabold text-pink-400">100%</span>
              <span className="text-xs text-slate-400 font-medium">Isolated Role Security</span>
            </div>
          </div>

          {/* Call to Action Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setActiveTab('student-signup')}
              className="px-8 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2"
            >
              <GraduationCap className="w-5 h-5" />
              <span>Student / Candidate Sign Up</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('login');
                setLoginRoleFilter('all');
              }}
              className="px-8 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
            >
              <LogIn className="w-5 h-5" />
              <span>Portal Sign In (All Roles)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Navigation Tabs for Overview / Sign Up / Login */}
        <div className="flex justify-center mb-10">
          <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Role Architecture & Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('student-signup')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'student-signup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Isolated Student Account</span>
            </button>
            <button
              onClick={() => setActiveTab('login')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'login'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Role Access</span>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW & ARCHITECTURE */}
        {activeTab === 'overview' && (
          <div className="space-y-12">
            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1: Student / Candidate */}
              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-emerald-500/60 transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase tracking-wider">
                    Self-Service Registration
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">Student & Applicant Portal</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Students create their own isolated accounts. Once registered, applicants can view screening exams assigned to their university email, submit LaTeX/Python solutions, and view automated evaluation feedback.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-400">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Strict data isolation: only see your own assigned tests</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Take timed adaptive exams with full integrity logs</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Receive AI diagnostic feedback on mathematical rigor</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Instant Access</span>
                  <button
                    onClick={() => setActiveTab('student-signup')}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
                  >
                    <span>Create Student Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 2: Faculty / Professor */}
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-indigo-500/60 transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                    Admin-Provisioned Role
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">Faculty Professor Portal</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Designed for research lab directors and faculty. Create custom screening exams, generate LaTeX/coding questions using AI, assign tests to prospective applicants, and review detailed candidate rubrics.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-400">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Author adaptive screening exams with custom time limits</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Review AI-graded submissions and cheating probability</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-amber-300 font-semibold">Authorized by Institutional Admin</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Faculty Access</span>
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setLoginRoleFilter('professor');
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                  >
                    <span>Sign In as Faculty</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 3: Institutional Admin */}
              <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-purple-500/60 transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 uppercase tracking-wider">
                    Institutional Governance
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">Institutional Admin Portal</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Exclusive governance portal for provosts and system administrators. Authorize and create new faculty professor accounts, manage research lab credentials, and oversee platform-wide integrity security.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-400">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Create and authorize new Professor accounts</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Audit institutional screening metrics across departments</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Manage verification status for campus user accounts</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Provost Governance</span>
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setLoginRoleFilter('admin');
                    }}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                  >
                    <span>Admin Portal Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Highlights Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">AI Rubric Evaluation</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Advanced semantic grading models evaluate open-ended research essays and mathematical LaTeX derivations with human-equivalent precision.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Adaptive Difficulty Engine</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Dynamically scales question difficulty from undergraduate fundamentals to PhD research tier based on real-time candidate responses.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Anti-Cheating Integrity</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Logs tab switching, clipboard events, and computes statistical AI-generation probabilities to ensure authentic technical evaluation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENT SIGN UP FORM */}
        {activeTab === 'student-signup' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center space-x-3 pb-6 border-b border-slate-800 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Create Isolated Student Account</h3>
                <p className="text-xs text-slate-400">
                  Register as an applicant to access exams assigned to your email address. Your data is strictly isolated from other candidates.
                </p>
              </div>
            </div>

            <form onSubmit={handleStudentRegister} className="space-y-4">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-lg text-xs text-rose-300 font-medium flex items-center space-x-2">
                  <span className="font-bold">Error:</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-lg flex items-center space-x-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300">
                  <strong>Role Isolation Enforced:</strong> Self-registration creates a Student account. Faculty accounts must be created by an Institutional Admin.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jordan Taylor"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">University Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jtaylor@stanford.edu"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">University / Institution *</label>
                  <input
                    type="text"
                    required
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="e.g. Stanford University"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Degree Program *</label>
                  <input
                    type="text"
                    required
                    value={degreeProgram}
                    onChange={(e) => setDegreeProgram(e.target.value)}
                    placeholder="e.g. PhD in Artificial Intelligence"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Secondary Personal Email *</label>
                <input
                  type="email"
                  required
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  placeholder="e.g. jordan.personal@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-5 py-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Create Account & Enter Portal</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: SIGN IN / ROLE SELECTOR */}
        {activeTab === 'login' && (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Select Account to Enter Portal</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose your role below to access your isolated environment. Notice that Admin accounts have exclusive faculty creation permissions.
                </p>
              </div>

              {/* Role Filter Tabs */}
              <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLoginRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    loginRoleFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({accounts.length})
                </button>
                <button
                  onClick={() => setLoginRoleFilter('applicant')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    loginRoleFilter === 'applicant' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Students
                </button>
                <button
                  onClick={() => setLoginRoleFilter('professor')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    loginRoleFilter === 'professor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Faculty
                </button>
                <button
                  onClick={() => setLoginRoleFilter('admin')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    loginRoleFilter === 'admin' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* List of Accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {filteredAccounts.map((acc) => {
                const isProf = acc.role === 'professor';
                const isAdmin = acc.role === 'admin';
                const isStudent = acc.role === 'applicant';

                let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                let borderHover = 'hover:border-emerald-500/60';
                let icon = <GraduationCap className="w-4 h-4 text-emerald-400" />;

                if (isProf) {
                  badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                  borderHover = 'hover:border-indigo-500/60';
                  icon = <Building2 className="w-4 h-4 text-indigo-400" />;
                } else if (isAdmin) {
                  badgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                  borderHover = 'hover:border-purple-500/60';
                  icon = <ShieldCheck className="w-4 h-4 text-purple-400" />;
                }

                return (
                  <div
                    key={acc.id}
                    onClick={() => onSelectAccount(acc)}
                    className={`p-4 rounded-xl bg-slate-950/60 border border-slate-800 ${borderHover} cursor-pointer transition-all flex items-start justify-between group shadow-md hover:shadow-xl`}
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <img
                        src={acc.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                        alt={acc.name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white truncate group-hover:text-indigo-300 transition-colors">
                            {acc.name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 block truncate">{acc.email}</span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass} uppercase`}>
                            {icon}
                            <span>{acc.role}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {acc.labName || acc.department || acc.university || acc.adminTitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="self-center shrink-0 ml-2">
                      <div className="w-8 h-8 rounded-full bg-slate-900 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
