import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Maximize2,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { StudentInvitationView, StudentAssessmentSummary, UserAccount } from '../../types';
import { EMAIL_PATTERN } from './examUtils';

export interface CandidateDetails {
  secondaryEmail: string;
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

/** Identity confirmation, rules and proctoring choice before a test begins. */
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
  const integrityOptions = assessment.integrityOptions;
  const applicantName = profile.name;
  const applicantEmail = profile.email;
  const [applicantPersonalEmail, setApplicantPersonalEmail] = useState(initialDetails?.secondaryEmail ?? profile.secondaryEmail ?? '');
  const [university, setUniversity] = useState(initialDetails?.university ?? profile.university ?? '');
  const [degreeProgram, setDegreeProgram] = useState(initialDetails?.degreeProgram ?? profile.degreeProgram ?? '');
  const [gpa, setGpa] = useState(initialDetails?.gpa ?? '');
  const [agreedToPledge, setAgreedToPledge] = useState(false);

  const collectDetails = (): CandidateDetails | null => {
    let problem: string | null = null;
    if (!agreedToPledge) problem = 'Please agree to the Academic Integrity Pledge before starting.';
    else if (!EMAIL_PATTERN.test(applicantPersonalEmail.trim())) problem = 'Please enter a valid Secondary Personal Email before starting.';
    else if (applicantEmail.trim().toLowerCase() === applicantPersonalEmail.trim().toLowerCase()) {
      problem = 'Your University Email and Personal Email must be distinct email addresses.';
    } else if (!university.trim() || !degreeProgram.trim()) problem = 'Please enter your current university and degree program.';
    if (problem) {
      alert(problem);
      return null;
    }
    return { secondaryEmail: applicantPersonalEmail.trim(), university: university.trim(), degreeProgram: degreeProgram.trim(), gpa: gpa.trim() };
  };

  const handleStartTest = (lockdown: boolean) => {
    const details = collectDetails();
    if (details) onStart(lockdown, details);
  };

  const handleLaunchInNewTab = () => {
    const details = collectDetails();
    if (details) onLaunchInNewTab(details);
  };

  return (
    <div className="bg-white p-8 md:p-10 rounded-lg border border-slate-200 shadow-sm space-y-8 animate-fade-in relative">
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-md border border-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Assigned Tests</span>
      </button>
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Secure University Admissions Assessment</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          {assessment.title}
        </h1>
        <p className="text-sm text-slate-600">
          You have been invited by <span className="font-bold text-slate-900">{assessment.researchGroup}</span> to complete this initial technical screening exam.
        </p>
        {assessment.description && (
          <p className="text-xs text-slate-500 leading-relaxed">{assessment.description}</p>
        )}
      </div>

      {/* Instructions Box */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
          <Clock className="w-4 h-4 mr-2 text-indigo-600" /> Assessment Rules & Instructions:
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Time Limit:</strong> You have {assessment.timeLimitMinutes} minutes once you click Start
              {invitation.graceMinutes > 0 ? `, plus a ${invitation.graceMinutes}-minute grace period` : ''}. The timer keeps running if you leave, and the test is submitted automatically when time runs out.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Questions:</strong> {assessment.questionCount} question(s)
              {assessment.isAdaptive ? ', ordered from foundational to research-level difficulty' : ''}
              {integrityOptions.randomizeQuestionOrder ? '; order is randomized for each candidate' : ''}.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><strong className="text-slate-900">Programming:</strong> Code is reviewed against the professor's rubric and test cases after you submit; it isn't executed in the browser.</span>
          </li>
          <li className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Anti-Cheating Integrity:</strong>{' '}
              {[
                integrityOptions.fullScreenMode && 'fullscreen is required',
                integrityOptions.tabSwitchDetection && 'tab switching is logged',
                integrityOptions.copyPasteDetection && 'copy/paste is blocked and logged',
                integrityOptions.aiAnswerDetection && 'answers are checked for AI-generated text',
              ]
                .filter(Boolean)
                .join('; ') || 'no monitoring is enabled for this assessment'}
              .
            </span>
          </li>
        </ul>
      </div>

      {/* Candidate Form */}
      <div className="space-y-4 pt-2">
        <h3 className="text-base font-bold text-slate-900">Verify Candidate Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Full Legal Name</label>
            <input
              type="text"
              value={applicantName}
              readOnly
              title="From your signed-in account"
              className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">University Email Address</label>
            <input
              type="email"
              value={applicantEmail}
              readOnly
              title="Your submission is linked to the email of your signed-in account"
              className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Personal Email Address *</label>
            <input
              type="email"
              required
              value={applicantPersonalEmail}
              onChange={(e) => setApplicantPersonalEmail(e.target.value)}
              placeholder="e.g. alex.personal@gmail.com"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Current University / Institution *</label>
            <input
              type="text"
              required
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Degree Program & Major *</label>
            <input
              type="text"
              required
              value={degreeProgram}
              onChange={(e) => setDegreeProgram(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Undergraduate GPA (optional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={gpa}
              onChange={(e) => setGpa(e.target.value)}
              placeholder="e.g. 3.7"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <label className="flex items-start space-x-3 p-4 rounded-lg bg-indigo-50/50 border border-indigo-200 cursor-pointer mt-4 shadow-sm">
          <input
            type="checkbox"
            checked={agreedToPledge}
            onChange={(e) => setAgreedToPledge(e.target.checked)}
            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
          />
          <span className="text-xs text-slate-800 leading-relaxed font-medium">
            <strong>Academic Integrity Pledge:</strong> I certify that I will complete this screening assessment independently without external assistance, unauthorized LLMs, or copying code from third-party sources. I understand that session tab switching is monitored.
          </span>
        </label>
      </div>

      <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700 shadow-xl space-y-4 mt-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-sm tracking-tight uppercase text-slate-100">
              Select Proctoring & Testing Environment
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
            • CollegeBoard Bluebook Standard
          </span>
        </div>
        
        <p className="text-xs text-slate-300 leading-relaxed">
          For official graduate admissions and scholarship screening, choose a secure lockdown environment. This isolates the assessment in full-screen mode and monitors integrity violations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Option A: Open in New Secure Tab */}
          <button
            onClick={handleLaunchInNewTab}
            disabled={starting}
            className="p-4 rounded-lg bg-gradient-to-br from-indigo-900/90 to-slate-900 hover:from-indigo-800 hover:to-slate-800 border-2 border-indigo-500/80 hover:border-indigo-400 text-left transition-all group shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-indigo-500 text-white font-extrabold text-[10px] tracking-wider uppercase">
                  <Lock className="w-3 h-3" />
                  <span>Recommended Official</span>
                </span>
                <ExternalLink className="w-4 h-4 text-indigo-300 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <h4 className="font-bold text-sm text-white group-hover:text-indigo-200 transition-colors">
                Launch in New Secure Tab & Lockdown
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-normal">
                Opens a dedicated, clean exam tab with auto-fullscreen and proctoring enabled.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-indigo-800/60 flex items-center justify-between text-xs font-bold text-indigo-300">
              <span>Launch Secure Window →</span>
              <span className="text-[10px] font-mono bg-indigo-950 px-2 py-0.5 rounded">Isolates Session</span>
            </div>
          </button>

          {/* Option B: Current Window Lockdown */}
          <button
            onClick={() => handleStartTest(true)}
            disabled={starting}
            className="p-4 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-left transition-all group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-bold text-[10px] tracking-wider uppercase">
                  <Monitor className="w-3 h-3" />
                  <span>Fullscreen Lockdown</span>
                </span>
                <Maximize2 className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <h4 className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors">
                Begin in Current Tab (Lockdown)
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Enters full-screen security mode immediately in your active browser window.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>Start Fullscreen Now →</span>
              <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400">Standard Proctoring</span>
            </div>
          </button>
        </div>

        {integrityOptions.fullScreenMode ? (
          <div className="flex items-center pt-3 border-t border-slate-800 text-xs text-slate-400 space-x-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Your professor requires fullscreen lockdown for this assessment.</span>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Prefer not to use fullscreen? This still counts as your graded attempt.</span>
            </span>
            <button
              onClick={() => handleStartTest(false)}
              disabled={starting}
              className="disabled:opacity-50 text-slate-300 hover:text-white underline font-semibold transition-colors"
            >
              Start Without Fullscreen Lockdown
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
