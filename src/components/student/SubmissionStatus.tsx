import React from 'react';
import { ArrowLeft, Calendar, Clock, ExternalLink, Lock, Video } from 'lucide-react';
import { StudentSubmissionView } from '../../types';
import { formatLocalDate } from './examUtils';

interface SubmissionStatusProps {
  submission: StudentSubmissionView;
  onRSVP: (response: 'Accepted' | 'Declined') => void;
  onBack: () => void;
}

const STATUS = {
  Interview: {
    label: 'Invited to interview',
    title: 'You have been invited to an interview',
    badge: 'border-brand-200 bg-brand-50 text-brand-900',
  },
  Reject: {
    label: 'Not progressing',
    title: 'Decision on your application',
    badge: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  Pending: {
    label: 'Awaiting review',
    title: 'Your test has been submitted',
    badge: 'border-amber-200 bg-amber-50 text-amber-900',
  },
} as const;

const card = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8';

/** A submitted test: the professor's decision, interview details and, if released, the scores. */
export const SubmissionStatus: React.FC<SubmissionStatusProps> = ({ submission, onRSVP, onBack }) => {
  const status = STATUS[submission.decision] || STATUS.Pending;
  const group = submission.researchGroup && submission.researchGroup !== '—' ? submission.researchGroup : 'the research group';
  const interview = submission.interview;
  const results = submission.questionResults || [];
  const full = results.filter((r) => r.score >= r.points).length;
  const partial = results.filter((r) => r.score > 0 && r.score < r.points).length;
  const seconds = submission.totalTimeSpentSeconds || 0;
  const timeSpent = seconds > 0 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : 'Not recorded';

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </button>

      <section className={card} aria-labelledby="result-title">
        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${status.badge}`}>{status.label}</span>
        <h1 id="result-title" className="mt-3 text-3xl font-semibold">
          {status.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{submission.assessmentTitle}</p>
        <p className="mt-4 leading-relaxed text-slate-700">
          {submission.decision === 'Interview' &&
            `The professor for ${group} has reviewed your test and would like to interview you. Details are below.`}
          {submission.decision === 'Reject' &&
            `The professor for ${group} has reviewed your test and will not be inviting you to an interview for this position. Thank you for taking the time to complete it.`}
          {submission.decision === 'Pending' && `Your answers have been sent to ${group}. The professor’s decision will appear here once they have reviewed your work.`}
        </p>
      </section>

      {submission.decision === 'Interview' && (
        <section className={card} aria-labelledby="interview-title">
          <h2 id="interview-title" className="text-xl font-semibold">
            Interview
          </h2>
          {interview?.date ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Calendar className="h-4 w-4" aria-hidden />
                  Date
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">{formatLocalDate(interview.date)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock className="h-4 w-4" aria-hidden />
                  Time
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">{interview.time || 'To be confirmed'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Video className="h-4 w-4" aria-hidden />
                  Meeting link
                </dt>
                <dd className="mt-1 truncate font-medium">
                  {interview.meetingLink ? (
                    <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
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
          ) : (
            <p className="mt-3 text-sm text-slate-600">The professor has not set a date yet. It will appear here when they do.</p>
          )}
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700" role="status">
              {interview?.response === 'Accepted'
                ? 'You accepted this interview.'
                : interview?.response === 'Declined'
                  ? 'You declined this interview.'
                  : 'Please let the professor know whether you will attend.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onRSVP('Accepted')}
                aria-pressed={interview?.response === 'Accepted'}
                className={
                  interview?.response === 'Accepted'
                    ? 'rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50'
                }
              >
                {interview?.response === 'Accepted' ? 'Accepted' : 'Accept interview'}
              </button>
              <button
                onClick={() => onRSVP('Declined')}
                aria-pressed={interview?.response === 'Declined'}
                className={
                  interview?.response === 'Declined'
                    ? 'rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                }
              >
                {interview?.response === 'Declined' ? 'Declined' : 'Decline'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className={card} aria-labelledby="scores-title">
        <h2 id="scores-title" className="text-xl font-semibold">
          Your submission
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-600">University</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{submission.university}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Degree programme</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{submission.degreeProgram}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Time spent</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{timeSpent}</dd>
          </div>
        </dl>

        {!submission.scoresVisible ? (
          <p className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            The professor has chosen not to release scores for this assessment.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-slate-100 pt-5">
              <p>
                <span className="font-serif text-4xl font-semibold text-slate-900">{submission.overallScore}%</span>
                <span className="ml-2 text-sm text-slate-600">overall</span>
              </p>
              <p className="text-sm text-slate-600">
                {full} full credit · {partial} partial · {results.length - full - partial} no credit
              </p>
            </div>
            <table className="mt-5 w-full text-left text-sm">
              <caption className="sr-only">Score for each question</caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Question
                  </th>
                  <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
                    Topic
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((item, index) => (
                  <tr key={item.questionId}>
                    <td className="py-2.5 pr-3">
                      <span className="mr-2 text-slate-600">{index + 1}.</span>
                      <span className="text-slate-900">{item.title}</span>
                    </td>
                    <td className="hidden py-2.5 pr-3 text-slate-600 sm:table-cell">{item.topic}</td>
                    <td className="py-2.5 text-right font-medium text-slate-900">
                      {item.score} / {item.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {submission.decision === 'Pending' && <p className="mt-4 text-sm text-slate-600">Scores may change after the professor’s review.</p>}
          </>
        )}
      </section>
    </div>
  );
};
