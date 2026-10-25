import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, GraduationCap, X } from 'lucide-react';
import { api, errorMessage } from '../../api';
import { ExamAttemptView, StudentInvitationView, StudentPortalData, StudentSubmissionView, UserAccount } from '../../types';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { ExamSession } from './ExamSession';
import { CandidateDetails, PreExamCheck } from './PreExamCheck';
import { StudentDashboard } from './StudentDashboard';
import { SubmissionStatus } from './SubmissionStatus';
import { EMAIL_PATTERN } from './examUtils';

interface StudentPortalProps {
  user: UserAccount;
  onSignOut: () => void;
  onUserUpdated: (user: UserAccount) => void;
}

// Candidate details handed from this tab to the secure exam tab (same browser, same signed-in student)
const LAUNCH_DETAILS_KEY = 'sifted-exam-launch';

type Step = 'dashboard' | 'invite' | 'testing' | 'completed';

export const StudentPortal: React.FC<StudentPortalProps> = ({ user, onSignOut, onUserUpdated }) => {
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('dashboard');
  const [dashboardSection, setDashboardSection] = useState<'all' | 'interviews'>('all');
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ExamAttemptView | null>(null);
  const [completedSubmissionId, setCompletedSubmissionId] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<StudentSubmissionView | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  const showNotice = (message: string, ms = 6000) => {
    setNotice(message);
    setTimeout(() => setNotice(null), ms);
  };

  const load = useCallback(async () => {
    try {
      const portal = await api.student.portal();
      setData(portal);
      setLoadError(null);
      return portal;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    }
  }, []);

  // Jump to interviews the first time an interview invitation shows up
  const seenInterviewsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!data) return;
    const count = data.submissions.filter((s) => s.decision === 'Interview').length;
    if (seenInterviewsRef.current === null || count > seenInterviewsRef.current) {
      if (count > 0 && step === 'dashboard') setDashboardSection('interviews');
    }
    seenInterviewsRef.current = count;
  }, [data]);

  // Keep the dashboard in sync with professors' decisions while it's open
  useEffect(() => {
    if (step === 'testing') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    const interval = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [step, load]);

  const beginAttempt = async (invitationId: string, lockdown: boolean, details?: CandidateDetails) => {
    setStarting(true);
    try {
      const { attempt: started } = await api.student.startAttempt(invitationId, {
        lockdown,
        details: details ? { ...details } : undefined,
      });
      setAttempt(started);
      setActiveInvitationId(invitationId);
      setStep('testing');
      return true;
    } catch (e) {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      showNotice(errorMessage(e));
      await load();
      setStep('dashboard');
      return false;
    } finally {
      setStarting(false);
    }
  };

  // First load, plus the secure exam tab opened with ?exam=<invitation id>
  useEffect(() => {
    (async () => {
      const portal = await load();
      const params = new URLSearchParams(window.location.search);
      const examId = params.get('exam');
      if (!examId) return;
      params.delete('exam');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      const invitation = portal?.invitations.find((i) => i.id === examId);
      if (!invitation) {
        showNotice('That test could not be found for your account.');
        return;
      }
      let details: CandidateDetails | undefined;
      try {
        const raw = window.localStorage.getItem(LAUNCH_DETAILS_KEY);
        window.localStorage.removeItem(LAUNCH_DETAILS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.invitationId === examId && parsed.userId === user.id) details = parsed.details;
      } catch {
        // storage unavailable: the student can start from the dashboard instead
      }
      if (invitation.hasActiveAttempt || details) {
        await beginAttempt(examId, true, details);
      } else {
        setActiveInvitationId(examId);
        setStep('invite');
      }
    })();
  }, []);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-24 flex flex-col items-center gap-3 text-sm text-slate-300">
        {loadError ? (
          <>
            <span className="font-semibold text-rose-300">{loadError}</span>
            <button onClick={load} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-bold">
              Try Again
            </button>
          </>
        ) : (
          <span className="font-semibold">Loading your portal…</span>
        )}
      </div>
    );
  }

  const activeInvitation = activeInvitationId ? data.invitations.find((i) => i.id === activeInvitationId) : undefined;
  const completedSubmission =
    (completedSubmissionId && data.submissions.find((s) => s.id === completedSubmissionId)) ||
    (justSubmitted && justSubmitted.id === completedSubmissionId ? justSubmitted : null);

  const handleOpenInvitation = (invitation: StudentInvitationView) => {
    if (invitation.blocker) {
      showNotice(invitation.blocker);
      return;
    }
    if (invitation.hasActiveAttempt) {
      // Resume immediately: the clock has been running on the server since the test started
      if (invitation.assessment?.integrityOptions.fullScreenMode) requestFullscreen();
      beginAttempt(invitation.id, true);
      return;
    }
    setActiveInvitationId(invitation.id);
    setStep('invite');
  };

  const requestFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // fullscreen not supported
    }
  };

  const handleStart = (lockdown: boolean, details: CandidateDetails) => {
    if (!activeInvitation) return;
    // Request fullscreen while the click still counts as a user gesture
    if (lockdown || activeInvitation.assessment?.integrityOptions.fullScreenMode) requestFullscreen();
    beginAttempt(activeInvitation.id, lockdown, details);
  };

  const handleLaunchInNewTab = (details: CandidateDetails) => {
    if (!activeInvitation) return;
    try {
      window.localStorage.setItem(LAUNCH_DETAILS_KEY, JSON.stringify({ invitationId: activeInvitation.id, userId: user.id, details }));
    } catch {
      showNotice('Your browser blocked local storage, so the test will start in this tab instead.');
      handleStart(true, details);
      return;
    }
    window.open(`${window.location.pathname}?exam=${encodeURIComponent(activeInvitation.id)}`, '_blank', 'noopener,noreferrer');
    setStep('dashboard');
    showNotice('Your secure exam opened in a new tab. Complete it there — your answers are saved automatically.', 8000);
  };

  const handleSubmitted = async (submission: StudentSubmissionView) => {
    setJustSubmitted(submission);
    setCompletedSubmissionId(submission.id);
    setAttempt(null);
    setStep('completed');
    await load();
  };

  const handleAttemptGone = async (message: string) => {
    setAttempt(null);
    showNotice(message);
    await load();
    setStep('dashboard');
  };

  const openSubmission = (submission: StudentSubmissionView) => {
    setCompletedSubmissionId(submission.id);
    setStep('completed');
  };

  const handleRSVP = async (submission: StudentSubmissionView, response: 'Accepted' | 'Declined') => {
    try {
      const { submission: updated } = await api.student.rsvp(submission.id, response);
      setData((prev) => prev && { ...prev, submissions: prev.submissions.map((s) => (s.id === updated.id ? updated : s)) });
      showNotice(`You have ${response === 'Accepted' ? 'accepted' : 'declined'} the interview invitation.`, 4500);
    } catch (e) {
      showNotice(errorMessage(e));
    }
  };

  const handleHideSubmission = async (submission: StudentSubmissionView) => {
    try {
      await api.student.hideSubmission(submission.id);
      setData((prev) => prev && { ...prev, submissions: prev.submissions.filter((s) => s.id !== submission.id) });
    } catch (e) {
      showNotice(errorMessage(e));
    }
  };

  const handleSignOut = () => {
    if (step === 'testing' && !window.confirm('Sign out during the exam? Your answers are saved, but the timer keeps running. You can resume after signing back in.')) {
      return;
    }
    onSignOut();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-[#0F172A] text-white p-4 rounded-lg shadow-sm border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block">Sifted • Candidate Portal</span>
            <span className="text-[11px] text-slate-400">
              {step === 'testing' && attempt ? attempt.assessment.title : `Signed in as ${user.name}`}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-1.5 rounded-md border border-slate-700 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between text-sm font-bold animate-fade-in border border-emerald-500">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-white hover:text-emerald-200 font-extrabold px-2 py-1">
            ✕
          </button>
        </div>
      )}

      {step === 'dashboard' && (
        <StudentDashboard
          data={data}
          section={dashboardSection}
          onChangeSection={setDashboardSection}
          onOpenInvitation={handleOpenInvitation}
          onOpenSubmission={openSubmission}
          onRSVP={handleRSVP}
          onHideSubmission={handleHideSubmission}
          onOpenAccount={() => setShowAccount(true)}
          onRefresh={load}
        />
      )}

      {step === 'invite' && activeInvitation?.assessment && (
        <PreExamCheck
          invitation={activeInvitation}
          assessment={activeInvitation.assessment}
          profile={data.profile}
          starting={starting}
          onBack={() => setStep('dashboard')}
          onStart={handleStart}
          onLaunchInNewTab={handleLaunchInNewTab}
        />
      )}

      {step === 'testing' && attempt && (
        <ExamSession key={attempt.id} attempt={attempt} onSubmitted={handleSubmitted} onAttemptGone={handleAttemptGone} />
      )}

      {step === 'completed' && completedSubmission && (
        <SubmissionStatus
          submission={completedSubmission}
          onRSVP={(response) => handleRSVP(completedSubmission, response)}
          onBack={() => {
            setDashboardSection(completedSubmission.decision === 'Interview' ? 'interviews' : 'all');
            setStep('dashboard');
          }}
          onSignOut={handleSignOut}
        />
      )}

      {showAccount && (
        <AccountPanel
          profile={data.profile}
          onClose={() => setShowAccount(false)}
          onProfileSaved={(profile) => {
            setData((prev) => prev && { ...prev, profile });
            onUserUpdated(profile);
          }}
          onPasswordChanged={onUserUpdated}
        />
      )}
    </div>
  );
};

const AccountPanel: React.FC<{
  profile: UserAccount;
  onClose: () => void;
  onProfileSaved: (profile: UserAccount) => void;
  onPasswordChanged: (user: UserAccount) => void;
}> = ({ profile, onClose, onProfileSaved, onPasswordChanged }) => {
  const [secondaryEmail, setSecondaryEmail] = useState(profile.secondaryEmail || '');
  const [university, setUniversity] = useState(profile.university || '');
  const [degreeProgram, setDegreeProgram] = useState(profile.degreeProgram || '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!EMAIL_PATTERN.test(secondaryEmail.trim())) {
      setMessage({ ok: false, text: 'Please enter a valid personal email.' });
      return;
    }
    setSaving(true);
    try {
      const { profile: saved } = await api.student.updateProfile({ secondaryEmail, university, degreeProgram });
      onProfileSaved(saved);
      setMessage({ ok: true, text: 'Profile saved.' });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden text-slate-900">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">My Account</h2>
            <p className="text-xs text-slate-400">
              {profile.name} • {profile.email}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <form onSubmit={handleSave} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile</h3>
            {message && (
              <div className={`p-3 rounded-lg text-xs font-medium ${message.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                {message.text}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">University email (sign-in, can't be changed)</label>
              <input value={profile.email} readOnly className={`${inputClass} bg-slate-100 text-slate-500 cursor-not-allowed`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Personal email</label>
              <input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">University</label>
                <input value={university} onChange={(e) => setUniversity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Degree program</label>
                <input value={degreeProgram} onChange={(e) => setDegreeProgram(e.target.value)} className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Change Password</h3>
            <ChangePasswordForm onChanged={onPasswordChanged} />
          </div>
        </div>
      </div>
    </div>
  );
};
