import React from 'react';
import { LayoutDashboard, FileText, Database, Users, BarChart3, Settings, Send, LogOut } from 'lucide-react';
import { ProfessorProfile, UserAccount } from '../types';
import { Wordmark } from './ui/Wordmark';

interface NavbarProps {
  currentProfessor: ProfessorProfile;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onSignOut: () => void;
  currentUserAccount?: UserAccount | null;
  onOpenAccount?: () => void;
  onOpenAssignModal?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assessments', label: 'Assessments', icon: FileText },
  { id: 'questions', label: 'Questions', icon: Database },
  { id: 'applicants', label: 'Applicants', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const initials = (name: string) =>
  name
    .replace(/^(Dr|Prof)\.?\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const Navbar: React.FC<NavbarProps> = ({ currentProfessor, activeTab, onSelectTab, onSignOut, currentUserAccount, onOpenAccount, onOpenAssignModal }) => {
  const name = currentUserAccount?.name || currentProfessor.name;

  const item = (entry: (typeof NAV_ITEMS)[number], compact = false) => {
    const Icon = entry.icon;
    const active = activeTab === entry.id;
    return (
      <li key={entry.id}>
        <button
          onClick={() => onSelectTab(entry.id)}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active ? 'bg-brand-50 text-brand-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          } ${compact ? 'text-xs' : ''}`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-700' : 'text-slate-600'}`} aria-hidden />
          {entry.label}
        </button>
      </li>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <button onClick={() => onSelectTab('dashboard')} className="shrink-0 rounded-md text-left" aria-label="Sifted, go to dashboard">
            <Wordmark subtitle="Faculty workspace" />
          </button>

          <nav aria-label="Workspace" className="hidden xl:block">
            <ul className="flex items-center gap-1">{NAV_ITEMS.map((entry) => item(entry))}</ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {onOpenAssignModal && (
              <button
                onClick={onOpenAssignModal}
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 sm:flex"
              >
                <Send className="h-4 w-4" aria-hidden />
                Assign test
              </button>
            )}
            <button
              onClick={() => onOpenAccount && onOpenAccount()}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              title="Account settings"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 font-serif text-xs font-semibold text-brand-800 ring-1 ring-brand-200" aria-hidden>
                {initials(name)}
              </span>
              <span className="hidden max-w-[10rem] truncate 2xl:inline">{name}</span>
              <span className="sr-only 2xl:hidden">Account settings</span>
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      <nav aria-label="Workspace" className="border-t border-slate-200 xl:hidden">
        <ul className="flex gap-1 overflow-x-auto px-4 py-2">{NAV_ITEMS.map((entry) => item(entry, true))}</ul>
      </nav>
    </header>
  );
};
