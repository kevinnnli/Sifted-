import React, { useId, useState } from 'react';
import { notify } from '../../notify';
import { AlertTriangle, ArrowLeft, Clock, ExternalLink, Maximize2 } from 'lucide-react';
import { StudentInvitationView, StudentAssessmentSummary, UserAccount } from '../../types';
import { EMAIL_PATTERN } from './examUtils';

export interface CandidateDetails {
  secondaryEmail?: string;
  university: string;
  degreeProgram: string;
  gpa: string;
}

interface PreExamCheckProps {
  invitation: StudentInvitationView;
  assessment: StudentAssessmentSummary;
  profile: UserAccount;
  initialDetails?: Partial<CandidateDetails>;
  starting: boolean;
  onBack: () => void;
  onStart: (lockdown: boolean, details: CandidateDetails) => void;
  onLaunchInNewTab: (details: CandidateDetails) => void;
}

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25';

/** Rules, details confirmation and the choice of how to take the test, shown before it starts. */
export const PreExamCheck: React.FC<PreExamCheckProps> = ({
  invitation,
  assessment,
  profile,
  initialDetails,
  starting,
  onBack,
  onStart,
  onLaunchInNewTab,
}) => {
  const id = useId();
  const integrityOptions = assessment.integrityOptions;
  const [personalEmail, setPersonalEmail] = useState(initialDetails?.secondaryEmail ?? profile.secondaryEmail ?? '');
  const [university, setUniversity] = useState(initialDetails?.university ?? profile.university ?? '');
  const [degreeProgram, setDegreeProgram] = useState(initialDetails?.degreeProgram ?? profile.degreeProgram ?? '');
  const [gpa, setGpa] = useState(initialDetails?.gpa ?? '');
  const [agreedToPledge, setAgreedToPledge] = useState(false);

  const collectDetails = (): CandidateDetails | null => {
    const personal = personalEmail.trim();
    let problem: string | null = null;
    if (!agreedToPledge) problem = 'Please confirm the academic integrity statement before starting.';
    else if (personal && !EMAIL_PATTERN.test(personal)) problem = 'Please enter a valid personal email, or leave it blank.';
    else if (personal && personal.toLowerCase() === profile.email.toLowerCase()) problem = 'Your personal email must be different from your university email.';
    else if (!university.trim() || !degreeProgram.trim()) problem = 'Please enter your university and degree programme.';
    if (problem) {
      notify(problem, 'error');
      return null;
    }
    return { secondaryEmail: personal || undefined, university: university.trim(), degreeProgram: degreeProgram.trim(), gpa: gpa.trim() };
  };

  const handleStartTest = (lockdown: boolean) => {
    const details = collectDetails();
    if (details) onStart(lockdown, details);
  };

  const handleLaunchInNewTab = () => {
    const details = collectDetails();
    if (details) onLaunchInNewTab(details);
  };

  const monitoring = [
    integrityOptions.fullScreenMode && 'the test runs in full-screen mode',
    integrityOptions.tabSwitchDetection && 'leaving the test window is recorded',
    integrityOptions.copyPasteDetection && 'copy and paste are disabled and attempts are recorded',
    integrityOptions.aiAnswerDetection && 'written answers may be assessed by an AI service for signs of AI-generated text',
  ].filter(Boolean) as string[];

  return (
    <div className="fade-in space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to your tests
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-sm font-medium text-slate-600">{assessment.researchGroup}</p>
        <h1 className="mt-1 text-3xl font-semibold">{assessment.title}</h1>
        {assessment.description && <p className="mt-3 max-w-3xl leading-relaxed text-slate-700">{assessment.description}</p>}

        <h2 className="mt-8 flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5 text-brand-700" aria-hidden />
          Before you begin
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-700">
          <li>
            <strong className="font-semibold text-slate-900">Time limit.</strong> {assessment.timeLimitMinutes} minutes from when you start
            {invitation.graceMinutes > 0 ? `, plus a ${invitation.graceMinutes}-minute grace period` : ''}. The timer keeps running if you leave, and the test
            is submitted automatically when time runs out.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Questions.</strong> {assessment.questionCount} question{assessment.questionCount === 1 ? '' : 's'}
            {assessment.isAdaptive ? ', ordered from foundational to research level' : ''}
            {integrityOptions.randomizeQuestionOrder ? ', in an order unique to you' : ''}. Your answers are saved as you go.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Programming questions</strong> are reviewed against the professor’s rubric after you submit; code
            is not run in the browser.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Integrity.</strong>{' '}
            {monitoring.length ? `During this test ${monitoring.join('; ')}.` : 'No monitoring is enabled for this test.'} Recorded events are shown to the
            professor.
          </li>
        </ul>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8" onSubmit={(e) => e.preventDefault()} aria-labelledby={`${id}-details`}>
        <h2 id={`${id}-details`} className="text-lg font-semibold">
          Confirm your details
        </h2>
        <p className="mt-1 text-sm text-slate-600">These are shared with the professor together with your submission.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-name`} className="block text-sm font-medium text-slate-800">
              Name
            </label>
            <input id={`${id}-name`} value={profile.name} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className="block text-sm font-medium text-slate-800">
              University email
            </label>
            <input id={`${id}-email`} value={profile.email} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
          </div>
          <div>
            <label htmlFor={`${id}-university`} className="block text-sm font-medium text-slate-800">
              University
            </label>
            <input id={`${id}-university`} required value={university} onChange={(e) => setUniversity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${id}-degree`} className="block text-sm font-medium text-slate-800">
              Degree programme
            </label>
            <input id={`${id}-degree`} required value={degreeProgram} onChange={(e) => setDegreeProgram(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${id}-personal`} className="block text-sm font-medium text-slate-800">
              Personal email (optional)
            </label>
            <input id={`${id}-personal`} type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${id}-gpa`} className="block text-sm font-medium text-slate-800">
              Undergraduate GPA (optional)
            </label>
            <input id={`${id}-gpa`} inputMode="decimal" value={gpa} onChange={(e) => setGpa(e.target.value)} className={inputClass} />
          </div>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input type="checkbox" checked={agreedToPledge} onChange={(e) => setAgreedToPledge(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-700" />
          <span className="text-sm leading-relaxed text-slate-800">
            <strong className="font-semibold">Academic integrity.</strong> I will complete this assessment on my own, without help from other people, AI tools or
            copied code.
          </span>
        </label>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8" aria-labelledby={`${id}-start`}>
        <h2 id={`${id}-start`} className="text-lg font-semibold">
          Start the test
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Full-screen mode keeps the test free of distractions. Leaving it is recorded{integrityOptions.fullScreenMode ? ', and your professor requires it for this test' : ''}.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <button
            onClick={handleLaunchInNewTab}
            disabled={starting}
            className="group rounded-lg border-2 border-brand-600 bg-white p-4 text-left transition-colors hover:bg-brand-50 disabled:opacity-60"
          >
            <span className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Open in a new tab, full screen</span>
              <ExternalLink className="h-4 w-4 text-brand-700" aria-hidden />
            </span>
            <span className="mt-1 block text-sm text-slate-600">Recommended. Opens the test on its own in a separate tab.</span>
          </button>
          <button
            onClick={() => handleStartTest(true)}
            disabled={starting}
            className="group rounded-lg border border-slate-300 bg-white p-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <span className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Start here, full screen</span>
              <Maximize2 className="h-4 w-4 text-slate-600" aria-hidden />
            </span>
            <span className="mt-1 block text-sm text-slate-600">Switches this tab to full-screen mode and starts the timer.</span>
          </button>
        </div>
        {integrityOptions.fullScreenMode ? (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-600">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            Full-screen mode is required for this test.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Prefer not to use full screen?{' '}
            <button onClick={() => handleStartTest(false)} disabled={starting} className="font-semibold text-brand-700 underline underline-offset-2 disabled:opacity-60">
              Start without full-screen mode
            </button>
            . It counts as your graded attempt.
          </p>
        )}
      </section>
    </div>
  );
};
