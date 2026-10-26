import React, { useState } from 'react';
import { asButton } from './ui/a11y';
import { errorMessage } from '../api';
import { Assessment, AssessmentInvitation, ProfessorCandidate } from '../types';
import { Send, UserCheck, Calendar, FileText, CheckCircle2, AlertCircle, X, Mail, Plus } from 'lucide-react';

export interface AssignInput {
  assessmentId: string;
  emails: string[];
  deadline?: string;
  notes?: string;
}

interface AssignAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessments?: Assessment[];
  // Only students already connected to this professor; others are invited by typing their email
  candidates?: ProfessorCandidate[];
  invitations?: AssessmentInvitation[];
  preselectedAssessmentId?: string;
  onAssign: (input: AssignInput) => Promise<{ created: AssessmentInvitation[]; skipped: { email: string; reason: string }[] }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toDateInputValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

export const AssignAssessmentModal: React.FC<AssignAssessmentModalProps> = ({
  isOpen,
  onClose,
  assessments = [],
  candidates = [],
  invitations = [],
  preselectedAssessmentId,
  onAssign,
}) => {
  const today = toDateInputValue(new Date());
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    assessments.some((a) => a.id === preselectedAssessmentId) ? preselectedAssessmentId! : assessments[0]?.id || ''
  );
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [customEmailError, setCustomEmailError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(toDateInputValue(new Date(Date.now() + 14 * 86400000)));
  const [notes, setNotes] = useState('Please complete this screening exam in full-screen mode at your earliest convenience.');
  const [assignedSummary, setAssignedSummary] = useState<{ assigned: number; skipped: { email: string; reason: string }[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedAssessment = assessments.find((a) => a.id === selectedAssessmentId);

  // Students who already have an open (not yet submitted) invitation for this assessment
  const alreadyInvited = new Set(
    invitations
      .filter((i) => i.assessmentId === selectedAssessmentId && i.status !== 'completed' && i.status !== 'reviewed')
      .map((i) => i.applicantEmail.toLowerCase())
  );

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleAddCustomEmail = () => {
    const emailLower = customEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(emailLower)) {
      setCustomEmailError('Please enter a valid email address.');
      return;
    }
    setCustomEmailError(null);
    if (!selectedEmails.includes(emailLower)) {
      setSelectedEmails((prev) => [...prev, emailLower]);
    }
    setCustomEmail('');
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmails.length === 0 || !selectedAssessment) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onAssign({
        assessmentId: selectedAssessment.id,
        emails: selectedEmails,
        deadline: deadline || undefined,
        notes: notes.trim() || undefined,
      });
      setAssignedSummary({ assigned: result.created.length, skipped: result.skipped });
      setTimeout(() => {
        setAssignedSummary(null);
        setSelectedEmails([]);
        onClose();
      }, result.skipped.length ? 3500 : 1800);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 max-w-2xl w-full overflow-hidden fade-in">
        {/* Header */}
        <div className="p-6 text-slate-900 relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-slate-600 hover:text-slate-900 transition-colors p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
              <Send className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Assign Assessment to Candidate Account</h2>
              <p className="text-xs text-brand-800">
                Directly invite applicants so they take their assigned exam rather than random screening tests
              </p>
            </div>
          </div>
        </div>

        {assignedSummary ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {assignedSummary.assigned > 0 ? 'Test assigned' : 'Nothing new to assign'}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {assignedSummary.assigned > 0 && (
                <>
                  {assignedSummary.assigned} candidate(s) will see <strong className="text-slate-900">{selectedAssessment?.title}</strong> in their Candidate Portal upon sign-in.{' '}
                </>
              )}
              {assignedSummary.skipped.map((skip) => (
                <span key={skip.email} className="block text-xs text-amber-700 mt-1">
                  Skipped {skip.email}: {skip.reason}.
                </span>
              ))}
            </p>
          </div>
        ) : assessments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-700 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">No Assessments Yet</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Create and save an assessment in the Assessment Builder before assigning it to candidates.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleAssignSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Step 1: Select Assessment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-brand-600" />
                Select Screening Assessment
              </label>
              <select aria-label="Assessment"
                value={selectedAssessmentId}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.researchGroup}) • {a?.questionIds?.length || 0} Questions{a.isActive === false ? ' • DRAFT' : ''}
                  </option>
                ))}
              </select>
              {selectedAssessment && selectedAssessment.isActive === false && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  This assessment is still a draft. Candidates will see the invitation but can't start it until you publish it.
                </p>
              )}
            </div>

            {/* Step 2: Select Applicant Accounts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <UserCheck className="w-4 h-4 mr-1.5 text-emerald-700" />
                  Your Candidates
                </label>
                <span className="text-xs font-semibold text-brand-600">
                  {selectedEmails.length} Selected
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Students you've invited or reviewed before. To invite someone new, type their university email below.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50/50">
                {candidates.length === 0 && (
                  <p className="text-xs text-slate-600 p-3 md:col-span-2">No candidates yet. Add an email address below instead.</p>
                )}
                {candidates.map((acc) => {
                  const email = acc.email.toLowerCase();
                  const isSelected = selectedEmails.includes(email);
                  const hasOpenInvite = alreadyInvited.has(email);
                  return (
                    <div
                      key={acc.email}
                      {...asButton(() => !hasOpenInvite && toggleEmail(email), { pressed: isSelected })}
                      aria-disabled={hasOpenInvite || undefined}
                      className={`p-2.5 rounded-md border transition-all flex items-center space-x-2.5 ${
                        hasOpenInvite
                          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'cursor-pointer border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-600'
                          : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      title={hasOpenInvite ? 'Already invited to this assessment' : undefined}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {acc.name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{acc.name}</div>
                        <div className="text-xs text-slate-600 truncate">
                          {hasOpenInvite ? 'Already invited' : acc.email}
                          {!acc.registered && !hasOpenInvite ? ' • not registered yet' : ''}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Or input custom email */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center space-x-2">
                <div className="flex-1">
                  <input aria-label="Candidate email"
                    type="email"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      setCustomEmailError(null);
                    }}
                    onKeyDown={(e) => {
                      // Enter adds the email instead of submitting the whole assignment form
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomEmail();
                      }
                    }}
                    placeholder="Or type candidate email (e.g. new.student@univ.edu)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomEmail}
                  className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-md text-xs font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Email</span>
                </button>
              </div>
              {customEmailError && <p className="mt-1 text-xs text-rose-600">{customEmailError}</p>}

              {selectedEmails.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedEmails.map((email) => (
                    <span
                      key={email}
                      className={`inline-flex items-center space-x-1 border px-2 py-1 rounded-md text-xs font-medium ${
                        alreadyInvited.has(email)
                          ? 'bg-slate-100 text-slate-600 border-slate-200 line-through'
                          : 'bg-brand-50 text-brand-700 border-brand-200'
                      }`}
                      title={alreadyInvited.has(email) ? 'Already invited to this assessment — will be skipped' : undefined}
                    >
                      <Mail className="w-3 h-3 text-brand-500" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => toggleEmail(email)}
                        className="hover:text-brand-900 ml-1 font-bold"
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
                  <Calendar className="w-3.5 h-3.5 mr-1 text-brand-600" />
                  Completion Deadline
                </label>
                <input aria-label="Deadline"
                  type="date"
                  min={today}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Instructions / Faculty Notes for Candidate
                </label>
                <input aria-label="Instructions for candidates"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please complete all algorithmic coding problems..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {submitError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800 font-medium">{submitError}</div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-700" />
                Verified students see the test in their portal straight away
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
                  disabled={submitting || selectedEmails.length === 0 || !selectedAssessment || (deadline !== '' && deadline < today)}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
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
