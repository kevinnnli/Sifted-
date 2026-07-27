import React from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  FileText, 
  Database, 
  Users, 
  BarChart3, 
  Settings, 
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  PlayCircle,
  User,
  Send,
  LogOut
} from 'lucide-react';
import { ActiveRole, ProfessorProfile, UserAccount } from '../types';

interface NavbarProps {
  currentProfessor: ProfessorProfile;
  allProfessors?: ProfessorProfile[];
  professors?: ProfessorProfile[];
  onSelectProfessor?: (id: string) => void;
  setCurrentProfessor?: (prof: ProfessorProfile) => void;
  activeTab: string;
  onSelectTab?: (tab: any) => void;
  setActiveTab?: (tab: any) => void;
  onOpenCandidatePortal?: () => void;
  activeRole?: ActiveRole;
  setActiveRole?: (role: ActiveRole) => void;
  currentUserAccount?: UserAccount | null;
  onOpenAuthModal?: () => void;
  onOpenAssignModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfessor,
  allProfessors,
  professors,
  onSelectProfessor,
  setCurrentProfessor,
  activeTab,
  onSelectTab,
  setActiveTab,
  onOpenCandidatePortal,
  activeRole = 'professor',
  setActiveRole,
  currentUserAccount,
  onOpenAuthModal,
  onOpenAssignModal,
}) => {

  const handleTabChange = (tab: string) => {
    if (onSelectTab) onSelectTab(tab);
    else if (setActiveTab) setActiveTab(tab);
  };

  const profList = allProfessors || professors || [];

  const handleProfChange = (id: string) => {
    if (onSelectProfessor) onSelectProfessor(id);
    else if (setCurrentProfessor) {
      const prof = profList.find((p) => p.id === id);
      if (prof) setCurrentProfessor(prof);
    }
  };

  const handleOpenPortal = () => {
    if (onOpenCandidatePortal) onOpenCandidatePortal();
    else if (setActiveRole) setActiveRole('applicant-portal');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assessments', label: 'Assessments', icon: FileText },
    { id: 'questions', label: 'Questions', icon: Database },
    { id: 'applicants', label: 'Applicants', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: ShieldCheck },
  ];

  return (
    <header className="bg-[#0F172A] text-slate-300 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => {
            if (setActiveRole) setActiveRole('landing');
            else handleTabChange('dashboard');
          }}>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white font-bold shrink-0">
              <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="shrink-0">
              <span className="font-semibold text-base md:text-lg tracking-tight text-white block leading-tight">
                ScholarScreen AI
              </span>
              <span className="hidden xl:block text-[9px] md:text-[10px] uppercase tracking-wider text-indigo-400 font-semibold leading-tight">
                Graduate Admissions
              </span>
            </div>
          </div>

          {/* Professor Tabs (only visible in professor role) */}
          {activeRole === 'professor' && (
            <nav className="hidden lg:flex items-center space-x-1 shrink">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Role & Profile Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Assign Test button for professors */}
            {activeRole === 'professor' && onOpenAssignModal && (
              <button
                onClick={onOpenAssignModal}
                className="hidden sm:flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Assign Test</span>
              </button>
            )}

            {/* Switch to Portal Modes button group */}
            <div className="bg-slate-800/80 p-1 rounded-md border border-slate-700/60 flex items-center space-x-1 shrink-0">
              <button
                onClick={() => {
                  if (setActiveRole) setActiveRole('landing');
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  activeRole === 'landing'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Return to Landing Page"
              >
                <span>Home</span>
              </button>
              <button
                onClick={() => {
                  if (setActiveRole) setActiveRole('professor');
                  else handleTabChange('dashboard');
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  activeRole === 'professor'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Professor</span>
              </button>
              <button
                onClick={handleOpenPortal}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  activeRole === 'applicant-portal'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Student</span>
              </button>
              <button
                onClick={() => {
                  if (setActiveRole) setActiveRole('admin-portal');
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  activeRole === 'admin-portal'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            </div>

            {/* Account Switcher Badge */}
            <div className="flex items-center space-x-2 border-l border-slate-800 pl-2 sm:pl-3 shrink-0">
              <button
                onClick={() => onOpenAuthModal && onOpenAuthModal()}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md border border-slate-700 text-xs font-medium transition-colors cursor-pointer group"
                title="Click to switch account or sign in"
              >
                <img
                  src={currentUserAccount?.avatar || currentProfessor.avatar}
                  alt={currentUserAccount?.name || currentProfessor.name}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-600 group-hover:border-indigo-400 shrink-0"
                />
                <div className="text-left hidden xl:block max-w-[100px] truncate">
                  <span className="font-bold text-white block truncate text-[11px] leading-tight">
                    {currentUserAccount?.name || currentProfessor.name}
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate uppercase leading-tight">
                    {currentUserAccount?.role || 'Prof'}
                  </span>
                </div>
                <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-white ml-0.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation bar for small screens */}
      {activeRole === 'professor' && (
        <div className="lg:hidden flex overflow-x-auto border-t border-slate-800 px-4 py-2 space-x-2 bg-[#0F172A]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
