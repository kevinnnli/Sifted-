import React from 'react';
import { Check, CheckCircle2, Clock, Lock, Video, X } from 'lucide-react';
import { StudentSubmissionView } from '../../types';
import { formatLocalDate } from './examUtils';

interface SubmissionStatusProps {
  submission: StudentSubmissionView;
  onRSVP: (response: 'Accepted' | 'Declined') => void;
  onBack: () => void;
  onSignOut: () => void;
}

export const SubmissionStatus: React.FC<SubmissionStatusProps> = ({ submission, onRSVP, onBack, onSignOut }) => {
  const isAccepted = submission.decision === 'Interview';
  const isDenied = submission.decision === 'Reject';
  const isPending = !isAccepted && !isDenied;
  const groupName = submission.researchGroup !== '—' ? submission.researchGroup : 'the Faculty Committee';
  const interview = submission.interview;

  const results = submission.questionResults || [];
  const correctCount = results.filter((r) => r.score >= r.points).length;
  const partialCount = results.filter((r) => r.score > 0 && r.score < r.points).length;
  const wrongCount = results.length - correctCount - partialCount;
  const timeSpentSec = submission.totalTimeSpentSeconds || 0;
  const timeSpentFormatted = timeSpentSec > 0 ? `${Math.floor(timeSpentSec / 60)}m ${timeSpentSec % 60}s` : 'N/A';

  return (
    <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-xl space-y-8 animate-fade-in max-w-3xl mx-auto text-left">
      {/* Header & Status Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left ${
        isAccepted
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/50 border-emerald-300 text-emerald-950 shadow-sm'
          : isDenied
          ? 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-200 text-rose-950'
          : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/50 border-amber-200 text-amber-950'
      }`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
          isAccepted ? 'bg-emerald-600 text-white animate-bounce' : isDenied ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white animate-pulse'
        }`}>
          {isAccepted && <CheckCircle2 className="w-9 h-9" />}
          {isDenied && <X className="w-9 h-9" />}
          {isPending && <Clock className="w-9 h-9" />}
        </div>

        <div className="space-y-1.5 flex-1">
          <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
            isAccepted ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300' : isDenied ? 'bg-rose-200/80 text-rose-900 border border-rose-300' : 'bg-amber-200/80 text-amber-900 border border-amber-300'
          }`}>
            {isAccepted && <span>🎉 Status: Accepted — Interview Requested</span>}
            {isDenied && <span>❌ Status: Review Completed — Denied</span>}
            {isPending && <span>⏳ Status: Pending Faculty Review</span>}
          </span>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1">
            {isAccepted ? 'Congratulations! Faculty Interview Invitation' : isDenied ? 'Application Status Update' : 'Professor Review in Progress'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
            {isAccepted && (
              <span>
                Great news, <strong>{submission.applicantName}</strong>! The faculty committee for <strong>{groupName}</strong> has reviewed your screening credentials and selected you for a formal 1-on-1 interview.
              </span>
            )}
            {isDenied && (
              <span>
                Thank you for applying, <strong>{submission.applicantName}</strong>. After careful review of your screening assessment by <strong>{groupName}</strong>, the professor has decided not to proceed with an interview for this lab position at this time. We wish you the best in your graduate research career.
              </span>
            )}
            {isPending && (
              <span>
                Thank you for completing your screening assessment, <strong>{submission.applicantName}</strong>. Your candidate file has been securely routed to <strong>{groupName}</strong>. You'll see the professor's decision here once they have reviewed your answers.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Faculty Meeting Schedule (only when accepted) */}
      {isAccepted && (
        <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                📅
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Your 1-on-1 Faculty Interview Schedule</h3>
                <p className="text-xs text-slate-400">Meeting date and time assigned by your faculty professor.</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold border border-emerald-500/30">
              Status: Accepted
            </span>
          </div>

          {interview?.date ? (
            <div className="bg-slate-800/80 rounded-xl p-6 border border-emerald-500/40 space-y-4">
              <span className="inline-flex items-center text-xs font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> ✅ Meeting Date Confirmed by Professor
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400 font-medium block">Confirmed Date</span>
                  <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">{formatLocalDate(interview.date)}</span>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400 font-medium block">Confirmed Time Slot</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 block">{interview.time || 'To be confirmed'}</span>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-lg border border-emerald-500/40 flex flex-col justify-between gap-2">
                  <div>
                    <span className="text-xs text-emerald-300 font-bold flex items-center">
                      <Video className="w-3.5 h-3.5 mr-1" />
                      Meeting Link
                    </span>
                    <span className="text-xs font-mono text-slate-300 truncate block mt-0.5">{interview.meetingLink || 'Link pending'}</span>
                  </div>
                  {interview.meetingLink && (
                    <a
                      href={interview.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded text-xs transition-colors text-center flex items-center justify-center space-x-1 shadow-sm"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Video 🎥</span>
                    </a>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                💡 Join the video link 5 minutes before your scheduled start time. If you need to request a rescheduling, please contact your faculty coordinator directly.
              </p>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700/80 text-center py-8">
              <Clock className="w-8 h-8 text-amber-400 mx-auto animate-pulse mb-2" />
              <h4 className="text-base font-bold text-white">Waiting for Professor to Assign Meeting Date</h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Congratulations! Your application status is <strong>Accepted</strong> for an interview. The professor will set your meeting date and time slot shortly. Please check back soon.
              </p>
            </div>
          )}

          {/* RSVP Controls */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-300 block">Your Interview Invitation RSVP Status:</span>
              {interview?.response === 'Accepted' ? (
                <span className="inline-flex items-center text-xs font-extrabold text-emerald-400 mt-1 bg-emerald-950/60 px-3 py-1 rounded border border-emerald-500/50">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> You accepted this interview invitation.
                </span>
              ) : interview?.response === 'Declined' ? (
                <span className="inline-flex items-center text-xs font-extrabold text-rose-400 mt-1 bg-rose-950/60 px-3 py-1 rounded border border-rose-500/50">
                  <X className="w-4 h-4 mr-1 text-rose-400" /> You declined this interview invitation.
                </span>
              ) : (
                <span className="text-xs text-amber-300 font-semibold block mt-0.5">Please confirm whether you will attend this faculty interview.</span>
              )}
            </div>
            <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={() => onRSVP('Accepted')}
                className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-sm ${
                  interview?.response === 'Accepted'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{interview?.response === 'Accepted' ? 'Accepted ✓' : 'Accept Invitation'}</span>
              </button>
              <button
                onClick={() => onRSVP('Declined')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  interview?.response === 'Declined'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900'
                    : 'bg-slate-700 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>{interview?.response === 'Declined' ? 'Declined ✓' : 'Deny Invitation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Details Summary Box */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted Application Summary</h3>
          {!submission.scoresVisible && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-800 border border-amber-300">
              <Lock className="w-3 h-3 mr-1" /> Scores not released by your professor
            </span>
          )}
        </div>

        {!submission.scoresVisible ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 block">University / Institution</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">{submission.university}</span>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 block">Target Degree Program</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">{submission.degreeProgram}</span>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 block">Exam Review Status</span>
                <span className={`text-xs font-bold mt-0.5 block ${isPending ? 'text-amber-700' : 'text-slate-800'}`}>
                  {isPending ? '⏳ Under Faculty Review' : '✓ Review Completed'}
                </span>
              </div>
            </div>

            <div className="bg-amber-50/90 p-4 rounded-xl border border-amber-200 text-amber-950 text-xs flex items-start space-x-3 shadow-sm">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold block text-sm">Exam Performance & Score Hidden</strong>
                <p className="leading-relaxed text-slate-700 font-medium">
                  To preserve academic testing integrity, your professor has chosen not to show screening scores, correct and incorrect answers, or grading feedback to candidates for this assessment.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 block">Institution</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate" title={submission.university}>{submission.university}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 block">Degree Program</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate" title={submission.degreeProgram}>{submission.degreeProgram}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 block">Overall Score</span>
                <span className="text-xs font-extrabold text-indigo-600 mt-0.5 block">{submission.overallScore}%</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs bg-emerald-50/30">
                <span className="text-[10px] font-semibold text-emerald-700 block">Full Credit</span>
                <span className="text-xs font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 shrink-0" />
                  <span>{correctCount} / {results.length}</span>
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-rose-200 shadow-2xs bg-rose-50/30">
                <span className="text-[10px] font-semibold text-rose-700 block">Partial / No Credit</span>
                <span className="text-xs font-extrabold text-rose-700 mt-0.5 flex items-center gap-1">
                  <X className="w-3.5 h-3.5 inline text-rose-600 shrink-0" />
                  <span>{partialCount + wrongCount} / {results.length}</span>
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 block">Time Spent</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{timeSpentFormatted}</span>
              </div>
            </div>

            {/* Question-by-Question Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Exam Question Performance Breakdown</h4>
                <span className="text-[11px] font-semibold text-slate-500">
                  {correctCount} Full • {partialCount} Partial • {wrongCount} No Credit
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {results.map((item, index) => {
                  const isFull = item.score >= item.points;
                  const isPartial = item.score > 0 && !isFull;
                  return (
                    <div key={item.questionId} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 ${
                          isFull ? 'bg-emerald-100 text-emerald-800' : isPartial ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          Q{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-800 block truncate">{item.title}</span>
                          <span className="text-[10px] text-slate-500">{item.topic} • {item.difficulty} • {item.points} Pts</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="text-xs font-bold text-slate-600">{item.score} / {item.points} pts</span>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center space-x-1 border ${
                          isFull ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isPartial ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {isFull ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Full Credit</span>
                            </>
                          ) : isPartial ? (
                            <span>Partial Credit</span>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              <span>0 Pts</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-slate-500 italic">
              * Note: To preserve testing integrity and academic fairness, detailed automated derivation rubrics and step-by-step AI solutions are reserved for faculty committee review only.
              {isPending ? ' Scores may still change after professor review.' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-200">
        <button
          onClick={onBack}
          className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-bold text-xs border border-slate-300 transition-colors shadow-sm"
        >
          ← Return to Student Dashboard
        </button>
        <button
          onClick={onSignOut}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold text-xs shadow-sm shadow-indigo-200 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
