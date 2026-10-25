import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, Save, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { ProfessorProfile, UserAccount } from '../types';
import { ChangePasswordForm } from './ChangePasswordForm';

interface SettingsPanelProps {
  currentProfessor: ProfessorProfile;
  onUpdateProfessor: (prof: ProfessorProfile) => Promise<boolean>;
  aiConfigured?: boolean | null;
  onPasswordChanged?: (user: UserAccount) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  currentProfessor,
  onUpdateProfessor,
  aiConfigured = null,
  onPasswordChanged,
}) => {
  const [labName, setLabName] = useState(currentProfessor.labName);
  const [email, setEmail] = useState(currentProfessor.email);
  const [aiSensitivity, setAiSensitivity] = useState<'high' | 'medium' | 'low'>(currentProfessor.aiSensitivity || 'medium');
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(currentProfessor.allowLateSubmissions ?? false);

  const handleSave = async () => {
    if (!labName.trim()) {
      alert('Lab or research group name cannot be empty.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      alert('Please enter a valid notification email address.');
      return;
    }
    const ok = await onUpdateProfessor({
      ...currentProfessor,
      labName: labName.trim(),
      email: email.trim(),
      aiSensitivity,
      allowLateSubmissions,
    });
    if (ok) alert('Settings saved successfully!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Platform Integrity & Lab Settings</h2>
            <p className="text-xs text-slate-500">Configure anti-cheating thresholds, AI model integration, and professor notifications</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md text-xs font-medium shadow-sm shadow-indigo-200 flex items-center space-x-1.5 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Configuration</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Lab Profile Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">1. Research Lab Profile</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Professor Name</label>
                <input
                  type="text"
                  disabled
                  value={currentProfessor.name}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-xs font-medium text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Lab or Research Group Name</label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Notification Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* AI Integrity Sensitivity Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">2. Gemini AI Detector & Grading Thresholds</h3>
            </div>

            <p className="text-xs text-slate-500">
              Adjust how aggressively Gemini flags synthetic LLM generation signatures and clipboard anomalies during screening.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { id: 'low', label: 'Low Sensitivity', desc: 'Flag only extreme verbatim copies (>85% AI score)' },
                { id: 'medium', label: 'Balanced (Default)', desc: 'Flag sessions above 50% AI score' },
                { id: 'high', label: 'Strict Auditing', desc: 'Flag sessions above 35% AI score' },
              ].map((lvl) => (
                <div
                  key={lvl.id}
                  onClick={() => setAiSensitivity(lvl.id as any)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors text-center shadow-sm ${
                    aiSensitivity === lvl.id
                      ? 'bg-indigo-50 border-indigo-600 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 block capitalize">{lvl.label}</span>
                  <span className="text-[10px] text-slate-500 block mt-1">{lvl.desc}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Allow Late Submissions (Grace Period)</span>
                  <span className="text-[10px] text-slate-500">Allow candidates 5 extra minutes before auto-submitting</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowLateSubmissions}
                  onChange={(e) => setAllowLateSubmissions(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Password Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">3. Account Password</h3>
            <ChangePasswordForm onChanged={(user) => onPasswordChanged?.(user)} />
          </div>
        </div>

        {/* Right Col: System Status */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System & API Status</h3>

            <div className="space-y-3 text-xs">
              {aiConfigured ? (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-center space-x-2 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-900 block">Gemini AI Server Route</span>
                    <span className="text-[10px] text-emerald-700">API key configured on the server</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 flex items-center space-x-2 shadow-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-900 block">Gemini AI Server Route</span>
                    <span className="text-[10px] text-amber-700">
                      {aiConfigured === null ? 'Checking server status…' : 'No GEMINI_API_KEY set — built-in grading and template questions are used'}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-md bg-blue-50 border border-blue-200 flex items-center space-x-2 shadow-sm">
                <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold text-blue-900 block">Server-Side SDK Privacy</span>
                  <span className="text-[10px] text-blue-700">API keys hidden from client browser</span>
                </div>
              </div>

              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center space-x-2 shadow-sm">
                <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">Storage Resilience</span>
                  <span className="text-[10px] text-slate-500">Saved to database.json on the server</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
