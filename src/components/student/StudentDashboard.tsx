import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  LayoutGrid,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Video,
  X,
} from 'lucide-react';
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
  onOpenAccount: () => void;
  onRefresh: () => void;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  data,
  section,
  onChangeSection,
  onOpenInvitation,
  onOpenSubmission,
  onRSVP,
  onHideSubmission,
  onOpenAccount,
  onRefresh,
}) => {
  const { profile, invitations, submissions } = data;
  const interviews = submissions.filter((s) => s.decision === 'Interview');
  const pendingReview = submissions.filter((s) => s.decision === 'Pending').length;
  const scored = submissions.filter((s) => s.scoresVisible && typeof s.overallScore === 'number');
  const avgScore = scored.length ? `${Math.round(scored.reduce((a, s) => a + (s.overallScore || 0), 0) / scored.length)}%` : '—';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Candidate Welcome & Identity Card */}
      <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <img
              src={profile.avatar || DEFAULT_AVATAR}
              alt={profile.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 shadow-md"
            />
            <div>
              {profile.isVerified ? (
                <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded text-[11px] font-bold border border-emerald-200 uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Candidate Profile</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded text-[11px] font-bold border border-amber-200 uppercase tracking-wider mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Verification Pending</span>
                </div>
              )}
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">{profile.name}</h1>
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 mt-0.5">
                <span>{profile.email}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{profile.university}</span>
                <span>•</span>
                <span>{profile.degreeProgram}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-sm"
              title="Check for updates from your professors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenAccount}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>My Account</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-600">
            Your account is private: only you, the professors who assigned you a test, and your administrator can see your results.
          </span>
        </div>
      </div>

      {!profile.isVerified && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex items-start space-x-3 text-amber-950">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block text-sm mb-0.5">Your account is waiting for verification</strong>
            To protect candidates, an administrator confirms each new student account before any assigned tests appear. You'll see your
            assessments here as soon as your account is verified.
          </div>
        </div>
      )}

      {/* Quick Metrics & Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Submitted Applications</span>
            <span className="text-2xl font-extrabold text-slate-900">{submissions.length}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Pending Professor Review</span>
            <span className="text-2xl font-extrabold text-amber-600">{pendingReview}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Accepted for Interview</span>
            <span className="text-2xl font-extrabold text-emerald-600">{interviews.length}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Avg Screening Score</span>
            <span className="text-2xl font-extrabold text-blue-600" title={scored.length === 0 ? 'Your professors have not released scores yet' : undefined}>
              {avgScore}
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Section Switcher (Home vs Interviews) */}
      <div className="flex items-center space-x-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => onChangeSection('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
            section === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Overview & Applications</span>
        </button>
        <button
          onClick={() => onChangeSection('interviews')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
            section === 'interviews'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Interviews</span>
          {interviews.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${section === 'interviews' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'}`}>
              {interviews.length}
            </span>
          )}
        </button>
      </div>

      {/* SECTION: INTERVIEWS */}
      {section === 'interviews' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 sm:p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                <Video className="w-3.5 h-3.5" />
                <span>Faculty Interview Schedule & Video Meeting Links</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Your Scheduled 1-on-1 Faculty Interviews</h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
                When a professor reviews your screening exam and invites you to an interview, your confirmed meeting date, time slot, and video link appear here.
              </p>
            </div>
          </div>

          {interviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">No Scheduled Interviews Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Once your application status changes to <strong>Accepted</strong> and a professor assigns your meeting details, your date and meeting link will appear in this section.
                </p>
              </div>
              <button
                onClick={() => onChangeSection('all')}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
              >
                ← Return to Overview & Applications
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {interviews.map((sub) => (
                <div key={sub.id} className="bg-white rounded-2xl border-2 border-emerald-400 shadow-lg overflow-hidden transition-all hover:shadow-xl">
                  <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-5 text-white flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner">
                        📅
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm">
                          Status: Accepted for Interview 🎉
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white mt-1">{sub.assessmentTitle}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          Confirmed Meeting Date
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 block">{formatLocalDate(sub.interview?.date)}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          Time Slot
                        </span>
                        <span className="text-sm font-extrabold text-emerald-700 block">{sub.interview?.time || 'To be confirmed'}</span>
                      </div>
                      <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-300 space-y-1">
                        <span className="text-xs font-bold text-emerald-900 flex items-center">
                          <Video className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                          Video Conference Room
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-800 truncate block">
                          {sub.interview?.meetingLink || 'Link pending — your professor will add it'}
                        </span>
                      </div>
                    </div>

                    {/* Candidate RSVP */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Interview Invitation RSVP Status:</span>
                        {sub.interview?.response === 'Accepted' ? (
                          <span className="inline-flex items-center text-xs font-extrabold text-emerald-600 mt-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> You accepted this interview invitation.
                          </span>
                        ) : sub.interview?.response === 'Declined' ? (
                          <span className="inline-flex items-center text-xs font-extrabold text-rose-600 mt-1 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                            <X className="w-4 h-4 mr-1 text-rose-600" /> You declined this interview invitation.
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 font-semibold block mt-0.5">Please confirm whether you will attend this faculty interview.</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => onRSVP(sub, 'Accepted')}
                          className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-sm ${
                            sub.interview?.response === 'Accepted' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-2' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{sub.interview?.response === 'Accepted' ? 'Accepted ✓' : 'Accept Invitation'}</span>
                        </button>
                        <button
                          onClick={() => onRSVP(sub, 'Declined')}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                            sub.interview?.response === 'Declined'
                              ? 'bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-2'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{sub.interview?.response === 'Declined' ? 'Declined ✓' : 'Deny Invitation'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500">💡 Please join the video link 5 minutes before your scheduled start time.</span>
                      <div className="flex items-center space-x-3 w-full sm:w-auto">
                        <button
                          onClick={() => onOpenSubmission(sub)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-300 flex items-center justify-center space-x-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Screening Report</span>
                        </button>
                        {sub.interview?.meetingLink ? (
                          <a
                            href={sub.interview.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                          >
                            <Video className="w-4 h-4" />
                            <span>Join Video Meeting 🎥</span>
                          </a>
                        ) : (
                          <span className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-not-allowed">
                            <Video className="w-4 h-4" />
                            <span>Meeting link pending</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'all' && (
        <>
          {/* My Applications & Faculty Status */}
          {submissions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
                  <GraduationCap className="w-5 h-5 mr-2 text-indigo-600" />
                  My Submitted Applications & Faculty Status
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {submissions.map((sub) => {
                  const isAccepted = sub.decision === 'Interview';
                  const isRejected = sub.decision === 'Reject';
                  return (
                    <div
                      key={sub.id}
                      className={`bg-white rounded-xl border p-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm ${
                        isAccepted ? 'border-emerald-300 bg-emerald-50/20' : isRejected ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {isAccepted && (
                            <span className="inline-flex items-center space-x-1 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm animate-pulse">
                              <CheckCircle2 className="w-4 h-4 mr-1" /> 🎉 Status: Accepted — Interview Scheduled by Professor
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center space-x-1 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                              <X className="w-4 h-4 mr-1" /> Not Selected for Interview
                            </span>
                          )}
                          {!isAccepted && !isRejected && (
                            <span className="inline-flex items-center space-x-1 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                              <Clock className="w-4 h-4 mr-1" /> ⏳ Status: Pending Faculty Review
                            </span>
                          )}
                          {sub.scoresVisible && typeof sub.overallScore === 'number' && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded border border-slate-200">
                              Score: <strong className="text-slate-900 font-bold">{sub.overallScore}%</strong>
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">{sub.assessmentTitle}</h3>
                        <p className="text-xs text-slate-600">
                          <strong>Research Group:</strong> {sub.researchGroup} • <strong>University:</strong> {sub.university} • <strong>Degree:</strong> {sub.degreeProgram}
                        </p>

                        {isAccepted && (
                          <div className="bg-emerald-100/70 p-3 rounded-lg border border-emerald-300 text-xs text-emerald-950 font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span>
                                <strong>Congratulations! Status: Accepted.</strong>{' '}
                                {sub.interview?.date
                                  ? `Your interview is scheduled for ${formatLocalDate(sub.interview.date)} at ${sub.interview.time || 'a time to be confirmed'}.`
                                  : 'The professor will assign your meeting date and time shortly.'}
                              </span>
                            </div>
                            <button
                              onClick={() => onChangeSection('interviews')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-colors shrink-0 flex items-center space-x-1"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>View Interview & RSVP 🎥</span>
                            </button>
                          </div>
                        )}

                        {isRejected && (
                          <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-xs text-rose-900 font-medium flex items-center justify-between flex-wrap gap-2">
                            <span>The professor has completed their review and decided not to proceed with an interview at this time.</span>
                            <button
                              onClick={() => onHideSubmission(sub)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm shrink-0"
                              title="Remove this application from your dashboard (your professor's records are not affected)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove from Dashboard</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 w-full md:w-auto">
                        <button
                          onClick={() => onOpenSubmission(sub)}
                          className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 shadow-sm ${
                            isAccepted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                              : isRejected
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{isAccepted ? 'View Accepted Status & Meeting 🎉' : 'View Professor Review Status'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assigned Assessments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                Your Assigned Screening Assessments
              </h2>
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200">
                {invitations.length} Directed Invitation(s)
              </span>
            </div>

            {invitations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">No Assessments Assigned</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You can only take screening exams that a professor has assigned to <strong className="text-slate-900">{profile.email}</strong>. They'll appear here automatically.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {invitations.map((inv) => {
                  const assessment = inv.assessment;
                  const isDone = inv.status === 'completed' || inv.status === 'reviewed';
                  const isProg = !isDone && inv.hasActiveAttempt;
                  const submission = inv.submissionId ? submissions.find((s) => s.id === inv.submissionId) : undefined;
                  return (
                    <div
                      key={inv.id}
                      className={`bg-white rounded-xl border p-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm ${
                        isDone ? 'border-slate-200 bg-slate-50/50' : isProg ? 'border-amber-300 bg-amber-50/30' : inv.blocker ? 'border-slate-200' : 'border-indigo-200 hover:border-indigo-400 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {isDone ? (
                            <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" /> Completed & Submitted
                            </span>
                          ) : isProg ? (
                            <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600 mr-1" /> In Progress
                            </span>
                          ) : inv.blocker ? (
                            <span className="inline-flex items-center space-x-1 bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                              <Lock className="w-3.5 h-3.5 mr-1" /> Unavailable
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 mr-1" /> Ready to Take
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-500">
                            Assigned by <strong className="text-slate-800">{inv.professorName}</strong>
                          </span>
                          {inv.deadline && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded border flex items-center ${
                                !isDone && isPastDeadline(inv.deadline) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              <Calendar className="w-3 h-3 mr-1 text-slate-500" /> Deadline: {formatLocalDate(inv.deadline)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{assessment?.title || 'Assessment no longer available'}</h3>
                        {assessment && (
                          <p className="text-xs text-slate-600">
                            <strong>Research Lab:</strong> {assessment.researchGroup} • <strong>Semester:</strong> {assessment.semester} • <strong>Time Limit:</strong>{' '}
                            {assessment.timeLimitMinutes} Minutes
                          </p>
                        )}
                        {inv.notes && (
                          <div className="bg-indigo-50/70 p-2.5 rounded-md border border-indigo-100 text-xs text-indigo-900 flex items-start space-x-2 mt-2">
                            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Professor's Instructions:</strong> "{inv.notes}"
                            </span>
                          </div>
                        )}
                        {!isDone && inv.blocker && (
                          <p className="text-xs text-slate-600 font-semibold flex items-center">
                            <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
                            {inv.blocker}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-2">
                        {isDone ? (
                          submission ? (
                            <button
                              onClick={() => onOpenSubmission(submission)}
                              className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 shadow-sm ${
                                submission.decision === 'Interview'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : submission.decision === 'Reject'
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                              }`}
                            >
                              <Calendar className="w-4 h-4" />
                              <span>{submission.decision === 'Interview' ? 'View Accepted Status & Meeting 🎉' : 'View Professor Review Status'}</span>
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">Submitted</span>
                          )
                        ) : (
                          <button
                            onClick={() => onOpenInvitation(inv)}
                            disabled={Boolean(inv.blocker)}
                            className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 transition-colors flex items-center justify-center space-x-2"
                          >
                            <span>{isProg ? 'Resume Directed Test' : 'Start Directed Test'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Screening Roadmap Guide */}
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-lg space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">Admissions Roadmap</span>
              <h3 className="text-xl font-bold tracking-tight">Understanding Your Candidate Journey</h3>
              <p className="text-xs text-slate-400">How Sifted bridges applicants with university faculty labs.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { n: '01', title: 'Directed Exam', text: 'Complete technical assessments assigned directly by faculty advisors.', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
                { n: '02', title: 'Evaluation', text: 'Your answers are graded on the server against the professor’s rubric.', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                { n: '03', title: 'Faculty Review', text: 'Professors review your results and schedule interviews through the portal.', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                { n: '04', title: 'Lab Offer', text: 'Successful candidates receive interview invitations and program offers.', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
              ].map((stepItem) => (
                <div key={stepItem.n} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border ${stepItem.badge}`}>
                    {stepItem.n}
                  </div>
                  <h4 className="text-sm font-bold text-white">{stepItem.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{stepItem.text}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
