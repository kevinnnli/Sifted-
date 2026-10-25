import React, { useState } from 'react';
import { GraduationCap, Building2, ShieldCheck, Sparkles, ArrowRight, CheckCircle2, UserCheck, Lock, Users, FileText, Cpu, Eye, PlusCircle, LogIn } from 'lucide-react';
import { api, errorMessage } from '../api';
import { UserAccount } from '../types';

interface LandingPageProps {
  onAuthenticated: (user: UserAccount) => void;
  initialTab?: 'overview' | 'student-signup' | 'login';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthenticated, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'student-signup' | 'login'>(initialTab);
  const [submitting, setSubmitting] = useState(false);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Student Sign Up Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      const { user } = await api.auth.login(loginEmail, loginPassword);
      setLoginPassword('');
      onAuthenticated(user);
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !secondaryEmail.trim() || !university.trim() || !degreeProgram.trim()) {
      setError('Please fill in your name, university, degree program, and both email addresses.');
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
    if (email.trim().toLowerCase() === secondaryEmail.trim().toLowerCase()) {
      setError('University email and personal email must be distinct email addresses.');
      return;
    }
    const freeProviders = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@aol.com', '@icloud.com', '@protonmail.com', '@mail.com'];
    if (freeProviders.some(p => email.trim().toLowerCase().endsWith(p))) {
      setError('Primary email must be an institutional or academic address (e.g. ending in .edu), not a free webmail domain.');
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await api.auth.register({
        name: name.trim(),
        email: email.trim(),
        secondaryEmail: secondaryEmail.trim(),
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
            Sifted connects university research labs with prospective PhD and MS candidates. Students create isolated, verified accounts to take custom technical screening exams, while faculty evaluate algorithmic rigor and research intuition with automated AI grading rubrics.
          </p>

          {/* Platform Guarantees */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { title: 'Private', text: 'Students only ever see their own tests and results', color: 'text-indigo-400' },
              { title: 'Secure', text: 'Password-protected accounts with server-side sessions', color: 'text-purple-400' },
              { title: 'Fair', text: 'Exams are timed and graded on the server', color: 'text-emerald-400' },
              { title: 'Controlled', text: 'Faculty accounts are created by your administrator', color: 'text-pink-400' },
            ].map((item) => (
              <div key={item.title} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-center">
                <span className={`block text-xl font-extrabold ${item.color}`}>{item.title}</span>
                <span className="text-xs text-slate-400 font-medium">{item.text}</span>
              </div>
            ))}
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
              onClick={() => setActiveTab('login')}
              className="px-8 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
            >
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
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
              <span>Sign In</span>
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
                    Students create their own private, password-protected accounts. Once an administrator verifies the account, applicants can take the screening exams assigned to their university email and follow their application status.
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
                  <span className="text-xs text-slate-400">Verified by your administrator</span>
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
                    onClick={() => setActiveTab('login')}
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
                    Restricted to the administrator account configured on the server. Create faculty accounts, verify students, reset passwords, and review every account's records.
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
                    onClick={() => setActiveTab('login')}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password * (at least 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
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
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{submitting ? 'Creating Account…' : 'Create Account & Enter Portal'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: SIGN IN */}
        {activeTab === 'login' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center space-x-3 pb-6 border-b border-slate-800 mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Sign In</h3>
                <p className="text-xs text-slate-400">Students, faculty and administrators all sign in here with their own email and password.</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-lg text-xs text-rose-300 font-medium">
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{submitting ? 'Signing In…' : 'Sign In'}</span>
              </button>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                New student?{' '}
                <button type="button" onClick={() => setActiveTab('student-signup')} className="text-emerald-400 hover:text-emerald-300 font-semibold underline">
                  Create an account
                </button>
                . Faculty accounts are created by your administrator; forgotten passwords can be reset by the administrator.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
