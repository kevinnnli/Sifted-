import React from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  FileText, 
  Database, 
  Users, 
  BarChart3, 
  ShieldCheck, 
  User,
  Send,
  LogOut
} from 'lucide-react';
import { ProfessorProfile, UserAccount } from '../types';

interface NavbarProps {
  currentProfessor: ProfessorProfile;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onSignOut: () => void;
  currentUserAccount?: UserAccount | null;
  onOpenAccount?: () => void;
  onOpenAssignModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfessor,
  activeTab,
  onSelectTab,
  onSignOut,
  currentUserAccount,
  onOpenAccount,
  onOpenAssignModal,
}) => {

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
          <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => onSelectTab('dashboard')}>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white font-bold shrink-0">
              <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="shrink-0">
              <span className="font-semibold text-base md:text-lg tracking-tight text-white block leading-tight">
                Sifted
              </span>
              <span className="hidden xl:block text-[9px] md:text-[10px] uppercase tracking-wider text-indigo-400 font-semibold leading-tight">
                Graduate Admissions
              </span>
            </div>
          </div>

          {/* Professor Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 shrink">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
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

          {/* Role & Profile Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Assign Test button for professors */}
            {onOpenAssignModal && (
              <button
                onClick={onOpenAssignModal}
                className="hidden sm:flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Assign Test</span>
              </button>
            )}

            <button
              onClick={onSignOut}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Account Switcher Badge */}
            <div className="flex items-center space-x-2 border-l border-slate-800 pl-2 sm:pl-3 shrink-0">
              <button
                onClick={() => onOpenAccount && onOpenAccount()}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md border border-slate-700 text-xs font-medium transition-colors cursor-pointer group"
                title="Account settings"
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
      <div className="lg:hidden flex overflow-x-auto border-t border-slate-800 px-4 py-2 space-x-2 bg-[#0F172A]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
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
    </header>
  );
};
