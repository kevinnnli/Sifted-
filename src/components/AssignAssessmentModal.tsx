import React, { useState } from 'react';
import { Assessment, UserAccount, AssessmentInvitation, ProfessorProfile } from '../types';
import { Send, UserCheck, Calendar, FileText, CheckCircle2, AlertCircle, X, Mail, Plus } from 'lucide-react';

interface AssignAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessments?: Assessment[];
  accounts?: UserAccount[];
  userAccounts?: UserAccount[];
  currentProfessor?: ProfessorProfile;
  preselectedAssessmentId?: string;
  initialAssessmentId?: string;
  onAssign: (invitation: AssessmentInvitation) => void;
}

export const AssignAssessmentModal: React.FC<AssignAssessmentModalProps> = ({
  isOpen,
  onClose,
  assessments = [],
  accounts,
  userAccounts,
  currentProfessor,
  preselectedAssessmentId,
  initialAssessmentId,
  onAssign,
}) => {
  const safeAccounts = accounts || userAccounts || [];
  const safeAssessments = assessments || [];
  const initId = preselectedAssessmentId || initialAssessmentId || (safeAssessments[0]?.id || '');

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(initId);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [deadline, setDeadline] = useState('2026-08-30');
  const [notes, setNotes] = useState('Please complete this screening exam in full-screen mode at your earliest convenience.');
  const [successMsg, setSuccessMsg] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedAssessmentId(preselectedAssessmentId || initialAssessmentId || (safeAssessments[0]?.id || ''));
    }
  }, [isOpen, preselectedAssessmentId, initialAssessmentId, safeAssessments]);

  if (!isOpen) return null;

  const applicantAccounts = safeAccounts.filter((a) => a?.role === 'applicant');
  const selectedAssessment = safeAssessments.find((a) => a?.id === selectedAssessmentId) || safeAssessments[0] || {
    id: 'as-ai-phd-2026',
    title: 'Default Graduate Screening Assessment',
    researchGroup: 'Admissions Lab',
    questionIds: []
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleAddCustomEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) return;
    const emailLower = customEmail.trim().toLowerCase();
    if (!selectedEmails.includes(emailLower)) {
      setSelectedEmails((prev) => [...prev, emailLower]);
    }
    setCustomEmail('');
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmails.length === 0) return;

    selectedEmails.forEach((email) => {
      const acc = safeAccounts.find((a) => a?.email.toLowerCase() === email.toLowerCase());
      const inv: AssessmentInvitation = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        assessmentId: selectedAssessment.id || selectedAssessmentId || 'as-ai-phd-2026',
        professorId: currentProfessor?.id || 'prof-elena',
        applicantEmail: email,
        applicantName: acc?.name || customName || email.split('@')[0],
        assignedAt: new Date().toISOString(),
        status: 'pending',
        deadline: deadline || undefined,
        notes: notes || undefined,
      };
      onAssign(inv);
    });

    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      setSelectedEmails([]);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-white/10 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Assign Assessment to Candidate Account</h2>
              <p className="text-xs text-indigo-200">
                Directly invite applicants so they take their assigned exam rather than random screening tests
              </p>
            </div>
          </div>
        </div>

        {successMsg ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Test Assigned Successfully!</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              The selected candidates will see <strong className="text-slate-900">{selectedAssessment?.title}</strong> in their Candidate Portal upon sign-in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAssignSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Step 1: Select Assessment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-indigo-600" />
                Select Screening Assessment
              </label>
              <select
                value={selectedAssessmentId}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {safeAssessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.researchGroup}) • {a?.questionIds?.length || 0} Questions
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Applicant Accounts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <UserCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Select Registered Candidate Accounts
                </label>
                <span className="text-xs font-semibold text-indigo-600">
                  {selectedEmails.length} Selected
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Click candidate accounts below to direct this test to their portal profile:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50/50">
                {applicantAccounts.map((acc) => {
                  const isSelected = selectedEmails.includes(acc.email.toLowerCase());
                  return (
                    <div
                      key={acc.id}
                      onClick={() => toggleEmail(acc.email.toLowerCase())}
                      className={`p-2.5 rounded-md border cursor-pointer transition-all flex items-center space-x-2.5 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <img src={acc.avatar} alt={acc.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{acc.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{acc.email}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Or input custom email */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center space-x-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Or type candidate email (e.g. new.student@univ.edu)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomEmail}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Email</span>
                </button>
              </div>

              {selectedEmails.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md text-xs font-medium"
                    >
                      <Mail className="w-3 h-3 text-indigo-500" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => toggleEmail(email)}
                        className="hover:text-indigo-900 ml-1 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Deadline & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                  Completion Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Instructions / Faculty Notes for Candidate
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please complete all algorithmic coding problems..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Candidate will see this assignment instantly in their portal
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedEmails.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Assign Test to {selectedEmails.length || 0} Candidate(s)</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
