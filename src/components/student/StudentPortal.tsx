import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api, errorMessage } from '../../api';
import { notify } from '../../notify';
import { ExamAttemptView, StudentInvitationView, StudentPortalData, StudentSubmissionView, UserAccount } from '../../types';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { ExamSession } from './ExamSession';
import { CandidateDetails, PreExamCheck } from './PreExamCheck';
import { StudentDashboard } from './StudentDashboard';
import { SubmissionStatus } from './SubmissionStatus';
import { EMAIL_PATTERN } from './examUtils';
import { SiteFooter } from '../ui/SiteFooter';
import { Wordmark } from '../ui/Wordmark';

interface StudentPortalProps {
  user: UserAccount;
  onSignOut: () => void;
  onUserUpdated: (user: UserAccount) => void;
}

// Candidate details handed from this tab to the exam tab (same browser, same signed-in student).
// Removed as soon as the exam tab reads them, or after LAUNCH_DETAILS_TTL_MS if it never opens.
const LAUNCH_DETAILS_KEY = 'sifted-exam-launch';
const LAUNCH_DETAILS_TTL_MS = 10 * 60 * 1000;

function clearStaleLaunchDetails() {
  try {
    const raw = window.localStorage.getItem(LAUNCH_DETAILS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - Date.parse(parsed.savedAt) > LAUNCH_DETAILS_TTL_MS) window.localStorage.removeItem(LAUNCH_DETAILS_KEY);
  } catch {
    // storage unavailable or unreadable: nothing to clean up
  }
}

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
  const [showAccount, setShowAccount] = useState(false);

  const showNotice = (message: string, kind: 'success' | 'error' | 'info' = 'info') => notify(message, kind);

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
      showNotice(errorMessage(e), 'error');
      await load();
      setStep('dashboard');
      return false;
    } finally {
      setStarting(false);
    }
  };

  // First load, plus the secure exam tab opened with ?exam=<invitation id>
  useEffect(() => {
    clearStaleLaunchDetails();
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
        showNotice('That test could not be found for your account.', 'error');
        return;
      }
      let details: CandidateDetails | undefined;
      try {
        const raw = window.localStorage.getItem(LAUNCH_DETAILS_KEY);
        window.localStorage.removeItem(LAUNCH_DETAILS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const fresh = parsed?.savedAt && Date.now() - Date.parse(parsed.savedAt) <= LAUNCH_DETAILS_TTL_MS;
        if (fresh && parsed.invitationId === examId && parsed.userId === user.id) details = parsed.details;
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-700" role={loadError ? 'alert' : 'status'}>
        {loadError ? (
          <>
            <span className="font-medium text-rose-800">{loadError}</span>
            <button onClick={load} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Try again
            </button>
          </>
        ) : (
          <span className="font-medium">Loading your portal…</span>
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
      showNotice(invitation.blocker, 'info');
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
      window.localStorage.setItem(
        LAUNCH_DETAILS_KEY,
        JSON.stringify({ invitationId: activeInvitation.id, userId: user.id, details, savedAt: new Date().toISOString() })
      );
    } catch {
      showNotice('Your browser blocked local storage, so the test will start in this tab instead.');
      handleStart(true, details);
      return;
    }
    window.open(`${window.location.pathname}?exam=${encodeURIComponent(activeInvitation.id)}`, '_blank', 'noopener,noreferrer');
    setStep('dashboard');
    showNotice('Your test opened in a new tab. Complete it there; your answers are saved automatically.');
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
      showNotice(`You have ${response === 'Accepted' ? 'accepted' : 'declined'} the interview invitation.`, 'success');
    } catch (e) {
      showNotice(errorMessage(e), 'error');
    }
  };

  const handleHideSubmission = async (submission: StudentSubmissionView) => {
    try {
      await api.student.hideSubmission(submission.id);
      setData((prev) => prev && { ...prev, submissions: prev.submissions.filter((s) => s.id !== submission.id) });
    } catch (e) {
      showNotice(errorMessage(e), 'error');
    }
  };

  const handleSignOut = () => {
    if (step === 'testing' && !window.confirm('Sign out during the exam? Your answers are saved, but the timer keeps running. You can resume after signing back in.')) {
      return;
    }
    onSignOut();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 ${step === 'testing' ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Wordmark subtitle={step === 'testing' && attempt ? attempt.assessment.title : 'Student portal'} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
            {step !== 'testing' && (
              <button onClick={() => setShowAccount(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                My account
              </button>
            )}
            <button onClick={handleSignOut} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main id="main" className={`mx-auto w-full flex-1 space-y-8 px-4 pb-20 pt-8 sm:px-6 ${step === 'testing' ? 'max-w-7xl' : 'max-w-5xl'}`}>

      {step === 'dashboard' && (
        <StudentDashboard
          data={data}
          section={dashboardSection}
          onChangeSection={setDashboardSection}
          onOpenInvitation={handleOpenInvitation}
          onOpenSubmission={openSubmission}
          onRSVP={handleRSVP}
          onHideSubmission={handleHideSubmission}
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
          onDeleted={() => {
            notify('Your account and all of your data have been deleted.', 'success');
            onSignOut();
          }}
        />
      )}
      </main>
      <SiteFooter />
    </div>
  );
};

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25';

const AccountPanel: React.FC<{
  profile: UserAccount;
  onClose: () => void;
  onProfileSaved: (profile: UserAccount) => void;
  onPasswordChanged: (user: UserAccount) => void;
  onDeleted: () => void;
}> = ({ profile, onClose, onProfileSaved, onPasswordChanged, onDeleted }) => {
  const [secondaryEmail, setSecondaryEmail] = useState(profile.secondaryEmail || '');
  const [university, setUniversity] = useState(profile.university || '');
  const [degreeProgram, setDegreeProgram] = useState(profile.degreeProgram || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    const personal = secondaryEmail.trim();
    if (personal && !EMAIL_PATTERN.test(personal)) {
      setProfileError('Please enter a valid personal email, or leave it blank.');
      return;
    }
    setSaving(true);
    try {
      const { profile: saved } = await api.student.updateProfile({ secondaryEmail: personal || undefined, university, degreeProgram });
      onProfileSaved(saved);
      notify('Profile saved.', 'success');
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (!confirmDelete) {
      setDeleteError('Please tick the box to confirm that you understand this cannot be undone.');
      return;
    }
    setDeleting(true);
    try {
      await api.student.deleteAccount(deletePassword);
      onDeleted();
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(e) => e.stopPropagation()}
        className="fade-in w-full max-w-lg rounded-xl bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 id="account-title" className="text-xl font-semibold">
              My account
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {profile.name} · {profile.email}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[75vh] space-y-8 overflow-y-auto p-5">
          <form onSubmit={handleSave} className="space-y-4" aria-labelledby="profile-heading">
            <h3 id="profile-heading" className="text-lg font-semibold">
              Profile
            </h3>
            {profileError && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {profileError}
              </p>
            )}
            <div>
              <label htmlFor="acct-email" className="block text-sm font-medium text-slate-800">
                University email
              </label>
              <input id="acct-email" value={profile.email} readOnly aria-describedby="acct-email-hint" className={`${inputClass} bg-slate-50 text-slate-600`} />
              <p id="acct-email-hint" className="mt-1 text-xs text-slate-600">
                Used to sign in. It cannot be changed.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="acct-university" className="block text-sm font-medium text-slate-800">
                  University
                </label>
                <input id="acct-university" value={university} onChange={(e) => setUniversity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="acct-degree" className="block text-sm font-medium text-slate-800">
                  Degree programme
                </label>
                <input id="acct-degree" value={degreeProgram} onChange={(e) => setDegreeProgram(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="acct-personal" className="block text-sm font-medium text-slate-800">
                Personal email (optional)
              </label>
              <input id="acct-personal" type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>

          <section aria-labelledby="password-heading" className="space-y-4 border-t border-slate-200 pt-6">
            <h3 id="password-heading" className="text-lg font-semibold">
              Password
            </h3>
            <ChangePasswordForm onChanged={onPasswordChanged} />
          </section>

          <form onSubmit={handleDelete} aria-labelledby="delete-heading" className="space-y-4 border-t border-slate-200 pt-6">
            <h3 id="delete-heading" className="text-lg font-semibold">
              Delete account
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              This permanently deletes your account and every submission you have made, including answers, scores and interview details. Professors will no
              longer see them. It cannot be undone. See{' '}
              <a href="/data-deletion" className="font-medium text-brand-700 underline underline-offset-2">
                Data Deletion
              </a>{' '}
              for details.
            </p>
            {deleteError && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {deleteError}
              </p>
            )}
            <div>
              <label htmlFor="acct-delete-password" className="block text-sm font-medium text-slate-800">
                Your password
              </label>
              <input
                id="acct-delete-password"
                type="password"
                autoComplete="current-password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-700" />
              <span>I understand that my account and all of my submissions will be deleted permanently.</span>
            </label>
            <button type="submit" disabled={deleting} className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
