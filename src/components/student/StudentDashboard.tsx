import React from 'react';
import { ArrowRight, Calendar, Clock, ExternalLink, Lock, RefreshCw, ShieldAlert, ShieldCheck, Video } from 'lucide-react';
import { StudentInvitationView, StudentPortalData, StudentSubmissionView } from '../../types';
import { formatLocalDate, isPastDeadline } from './examUtils';

interface StudentDashboardProps {
  data: StudentPortalData;
  section: 'all' | 'interviews';
  onChangeSection: (section: 'all' | 'interviews') => void;
  onOpenInvitation: (invitation: StudentInvitationView) => void;
  onOpenSubmission: (submission: StudentSubmissionView) => void;
  onRSVP: (submission: StudentSubmissionView, response: 'Accepted' | 'Declined') => void;
  onHideSubmission: (submission: StudentSubmissionView) => void;
  onRefresh: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const DECISION_LABEL: Record<StudentSubmissionView['decision'], { text: string; className: string }> = {
  Pending: { text: 'Awaiting review', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  Interview: { text: 'Invited to interview', className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  Reject: { text: 'Not progressing', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};

const card = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  data,
  section,
  onChangeSection,
  onOpenInvitation,
  onOpenSubmission,
  onRSVP,
  onHideSubmission,
  onRefresh,
}) => {
  const { profile, invitations, submissions } = data;
  const interviews = submissions.filter((s) => s.decision === 'Interview');
  const awaiting = submissions.filter((s) => s.decision === 'Pending').length;
  const scored = submissions.filter((s) => s.scoresVisible && typeof s.overallScore === 'number');
  const averageScore = scored.length ? `${Math.round(scored.reduce((a, s) => a + (s.overallScore || 0), 0) / scored.length)}%` : '—';
  const openTests = invitations.filter((i) => i.status !== 'completed' && i.status !== 'reviewed');

  const tab = (value: 'all' | 'interviews', label: React.ReactNode) => (
    <button
      role="tab"
      id={`tab-${value}`}
      aria-selected={section === value}
      aria-controls={`panel-${value}`}
      onClick={() => onChangeSection(value)}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        section === value ? 'border-brand-700 text-brand-900' : 'border-transparent text-slate-600 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fade-in space-y-8">
      <section className={card} aria-labelledby="welcome-name">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 font-serif text-lg font-semibold text-brand-800 ring-1 ring-brand-200"
              aria-hidden
            >
              {initials(profile.name)}
            </div>
            <div>
              {profile.isVerified ? (
                <span className="mb-1 inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Verified account
                </span>
              ) : (
                <span className="mb-1 inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                  Awaiting verification
                </span>
              )}
              <h1 id="welcome-name" className="text-2xl font-semibold md:text-3xl">
                {profile.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                {profile.email}
                {profile.university && <> · {profile.university}</>}
                {profile.degreeProgram && <> · {profile.degreeProgram}</>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh} className={secondaryButton} title="Check for updates from your professors">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          Only you, the professors who assigned you a test, and your administrator can see your results.
        </p>
      </section>

      {!profile.isVerified && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950" role="status">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div className="text-sm leading-relaxed">
            <strong className="block font-semibold">Your account is waiting to be verified</strong>
            An administrator confirms each new student account before assigned tests appear, so that nobody can sign up with someone else’s email address.
            Your tests will appear here once your account is verified.
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Tests to take', value: openTests.length },
          { label: 'Awaiting a decision', value: awaiting },
          { label: 'Interview invitations', value: interviews.length },
          { label: 'Average score', value: averageScore, title: scored.length === 0 ? 'Your professors have not released scores' : undefined },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4" title={stat.title}>
            <dt className="text-sm text-slate-600">{stat.label}</dt>
            <dd className="mt-1 font-serif text-3xl font-semibold text-slate-900">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <div role="tablist" aria-label="Dashboard" className="flex border-b border-slate-200">
          {tab('all', 'Tests and decisions')}
          {tab(
            'interviews',
            <>
              Interviews
              {interviews.length > 0 && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">{interviews.length}</span>
              )}
            </>
          )}
        </div>

        {section === 'interviews' ? (
          <div id="panel-interviews" role="tabpanel" aria-labelledby="tab-interviews" className="space-y-4 pt-6">
            {interviews.length === 0 ? (
              <div className={`${card} text-center`}>
                <Calendar className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
                <h2 className="mt-3 text-lg font-semibold">No interviews yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                  When a professor invites you to an interview, the date, time and meeting link appear here.
                </p>
              </div>
            ) : (
              interviews.map((sub) => (
                <article key={sub.id} className={card} aria-labelledby={`interview-${sub.id}`}>
                  <p className="text-sm text-slate-600">{sub.researchGroup}</p>
                  <h2 id={`interview-${sub.id}`} className="text-xl font-semibold">
                    {sub.assessmentTitle}
                  </h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" aria-hidden />
                        Date
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">{sub.interview?.date ? formatLocalDate(sub.interview.date) : 'To be confirmed'}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Clock className="h-4 w-4" aria-hidden />
                        Time
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">{sub.interview?.time || 'To be confirmed'}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Video className="h-4 w-4" aria-hidden />
                        Meeting link
                      </dt>
                      <dd className="mt-1 truncate font-medium">
                        {sub.interview?.meetingLink ? (
                          <a href={sub.interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
                            Join meeting
                            <ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : (
                          <span className="text-slate-600">Not added yet</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700" role="status">
                      {sub.interview?.response === 'Accepted'
                        ? 'You accepted this interview.'
                        : sub.interview?.response === 'Declined'
                          ? 'You declined this interview.'
                          : 'Please let the professor know whether you will attend.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onRSVP(sub, 'Accepted')}
                        aria-pressed={sub.interview?.response === 'Accepted'}
                        className={
                          sub.interview?.response === 'Accepted'
                            ? 'rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white'
                            : 'rounded-md border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50'
                        }
                      >
                        {sub.interview?.response === 'Accepted' ? 'Accepted' : 'Accept interview'}
                      </button>
                      <button
                        onClick={() => onRSVP(sub, 'Declined')}
                        aria-pressed={sub.interview?.response === 'Declined'}
                        className={
                          sub.interview?.response === 'Declined'
                            ? 'rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white'
                            : 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                        }
                      >
                        {sub.interview?.response === 'Declined' ? 'Declined' : 'Decline'}
                      </button>
                      <button onClick={() => onOpenSubmission(sub)} className={secondaryButton}>
                        View result
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div id="panel-all" role="tabpanel" aria-labelledby="tab-all" className="space-y-10 pt-6">
            <section aria-labelledby="tests-heading" className="space-y-4">
              <h2 id="tests-heading" className="text-xl font-semibold">
                Your tests
              </h2>
              {invitations.length === 0 ? (
                <div className={card}>
                  <p className="text-sm leading-relaxed text-slate-600">
                    No tests have been assigned to <strong className="font-semibold text-slate-900">{profile.email}</strong> yet. When a professor assigns
                    one, it appears here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {invitations.map((inv) => {
                    const assessment = inv.assessment;
                    const done = inv.status === 'completed' || inv.status === 'reviewed';
                    const inProgress = !done && inv.hasActiveAttempt;
                    const submission = inv.submissionId ? submissions.find((s) => s.id === inv.submissionId) : undefined;
                    const overdue = !done && inv.deadline && isPastDeadline(inv.deadline);
                    const status = done
                      ? { text: 'Submitted', className: 'border-slate-300 bg-slate-100 text-slate-700' }
                      : inProgress
                        ? { text: 'In progress', className: 'border-amber-200 bg-amber-50 text-amber-900' }
                        : inv.blocker
                          ? { text: 'Unavailable', className: 'border-slate-300 bg-slate-100 text-slate-700' }
                          : { text: 'Ready to start', className: 'border-brand-200 bg-brand-50 text-brand-900' };
                    return (
                      <li key={inv.id} className={`${card} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.text}</span>
                            <span className="text-slate-600">From {inv.professorName}</span>
                            {inv.deadline && (
                              <span className={overdue ? 'font-medium text-rose-700' : 'text-slate-600'}>· Due {formatLocalDate(inv.deadline)}</span>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold">{assessment?.title || 'This assessment is no longer available'}</h3>
                          {assessment && (
                            <p className="text-sm text-slate-600">
                              {assessment.researchGroup} · {assessment.timeLimitMinutes} minutes · {assessment.questionCount} question
                              {assessment.questionCount === 1 ? '' : 's'}
                            </p>
                          )}
                          {inv.notes && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Professor’s note: {inv.notes}</p>}
                          {!done && inv.blocker && <p className="text-sm text-slate-600">{inv.blocker}</p>}
                        </div>
                        <div className="shrink-0">
                          {done ? (
                            submission ? (
                              <button onClick={() => onOpenSubmission(submission)} className={secondaryButton}>
                                View result
                              </button>
                            ) : (
                              <span className="text-sm text-slate-600">Submitted</span>
                            )
                          ) : (
                            <button onClick={() => onOpenInvitation(inv)} disabled={Boolean(inv.blocker)} className={primaryButton}>
                              {inProgress ? 'Resume test' : 'Start test'}
                              <ArrowRight className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {submissions.length > 0 && (
              <section aria-labelledby="decisions-heading" className="space-y-4">
                <h2 id="decisions-heading" className="text-xl font-semibold">
                  Decisions
                </h2>
                <ul className="space-y-4">
                  {submissions.map((sub) => (
                    <li key={sub.id} className={`${card} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${DECISION_LABEL[sub.decision].className}`}>
                            {DECISION_LABEL[sub.decision].text}
                          </span>
                          {sub.scoresVisible && typeof sub.overallScore === 'number' && <span className="text-slate-600">Score {sub.overallScore}%</span>}
                        </div>
                        <h3 className="text-lg font-semibold">{sub.assessmentTitle}</h3>
                        <p className="text-sm text-slate-600">{sub.researchGroup}</p>
                        {sub.decision === 'Interview' && (
                          <p className="text-sm text-emerald-900">
                            {sub.interview?.date
                              ? `Interview on ${formatLocalDate(sub.interview.date)}${sub.interview.time ? ` at ${sub.interview.time}` : ''}.`
                              : 'The professor will add the interview date and time.'}
                          </p>
                        )}
                        {sub.decision === 'Reject' && (
                          <p className="text-sm text-slate-600">The professor has reviewed your submission and will not be inviting you to an interview.</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {sub.decision === 'Interview' && (
                          <button onClick={() => onChangeSection('interviews')} className={primaryButton}>
                            Interview details
                          </button>
                        )}
                        <button onClick={() => onOpenSubmission(sub)} className={secondaryButton}>
                          View result
                        </button>
                        {sub.decision === 'Reject' && (
                          <button
                            onClick={() => onHideSubmission(sub)}
                            className={secondaryButton}
                            title="Hides this from your dashboard. The professor’s record is not affected."
                          >
                            Hide
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
