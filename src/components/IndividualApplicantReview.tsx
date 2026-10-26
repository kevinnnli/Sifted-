import React, { useState } from 'react';
import { notify } from '../notify';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Clock, 
  User, 
  GraduationCap, 
  Mail, 
  Download, 
  Printer, 
  Check, 
  X, 
  HelpCircle, 
  Terminal, 
  Cpu,
  BookOpen,
  Edit3,
  Calendar,
  Video,
  Link,
  ExternalLink
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { api, errorMessage, ReviewPatch } from '../api';
import { ApplicantSubmission, Question, ProfessorDecision } from '../types';
import { getEffectiveScore, getHireabilityBadgeStyle, getHireabilityShortText } from '../utils/grading';
import { normalizeMeetingLink } from './ApplicantManagement';
import { RecommendationTag } from './ProfessorDashboard';
import { ModalBehavior } from './ui/ModalBehavior';

interface IndividualApplicantReviewProps {
  submission: ApplicantSubmission;
  questions: Question[];
  onBack: () => void;
  // Saves on the server and resolves to the updated submission (null if it failed; the error is shown)
  onReviewSubmission: (submissionId: string, patch: ReviewPatch) => Promise<ApplicantSubmission | null>;
}

export const IndividualApplicantReview: React.FC<IndividualApplicantReviewProps> = ({
  submission,
  questions,
  onBack,
  onReviewSubmission,
}) => {
  const [profNotes, setProfNotes] = useState<string>(submission.professorNotes || '');
  const profDecision: ProfessorDecision = submission.professorDecision || 'Pending';
  const [meetingDateInput, setMeetingDateInput] = useState<string>(submission.interviewDate || '');
  const [meetingTimeInput, setMeetingTimeInput] = useState<string>(submission.interviewTime || '10:00 AM EST');
  const [meetingLinkInput, setMeetingLinkInput] = useState<string>(submission.meetingLink || '');
  const [showInterviewModal, setShowInterviewModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'integrity' | 'briefing'>('overview');
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Manual score overrides (unsaved edits; saved overrides live on the submission's responses)
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const hasUnsavedOverrides = Object.entries(overrides).some(
    ([qid, val]) => submission.responses[qid] && val !== getEffectiveScore(submission.responses[qid])
  );

  const save = async (patch: ReviewPatch) => {
    setSaving(true);
    const saved = await onReviewSubmission(submission.id, patch);
    setSaving(false);
    return saved;
  };

  // The server re-totals the weighted score, topic breakdown and tier from the overrides
  const handleSaveOverrides = async () => {
    const saved = await save({ scoreOverrides: overrides, professorNotes: profNotes });
    if (!saved) return;
    setOverrides({});
    notify(`Score adjustments saved. New weighted score: ${saved.overallScore}%.`);
  };

  const handleSaveDecision = async (decision: ProfessorDecision) => {
    if (decision === 'Interview') {
      setMeetingDateInput(meetingDateInput || submission.interviewDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
      setMeetingTimeInput(meetingTimeInput || submission.interviewTime || '10:00 AM EST');
      setShowInterviewModal(true);
      return;
    }
    const saved = await save({ professorDecision: decision, professorNotes: profNotes });
    if (saved) notify(decision === 'Reject' ? 'Applicant marked as not progressing. Notes saved.' : `Decision set to ${decision}. Notes saved.`);
  };

  const handleSaveNotes = async () => {
    const saved = await save({ professorNotes: profNotes });
    if (saved) notify('Notes saved.');
  };

  const handleConfirmInterviewSchedule = async () => {
    const chosenDate = meetingDateInput || submission.interviewDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
    const chosenTime = meetingTimeInput || submission.interviewTime || '10:00 AM EST';
    const chosenLink = normalizeMeetingLink(meetingLinkInput);
    const saved = await save({
      professorDecision: 'Interview',
      professorNotes: profNotes,
      interviewDate: chosenDate,
      interviewTime: chosenTime,
      meetingLink: chosenLink,
    });
    if (!saved) return;
    setMeetingDateInput(chosenDate);
    setMeetingTimeInput(chosenTime);
    setMeetingLinkInput(chosenLink);
    setShowInterviewModal(false);
    notify(`Interview scheduled for ${chosenDate} at ${chosenTime}.`);
  };

  // Inline edits of an already-scheduled interview
  const saveSchedule = (patch: Pick<ReviewPatch, 'interviewDate' | 'interviewTime' | 'meetingLink'>) => save(patch);

  const handleGenerateBriefing = async () => {
    setGeneratingBriefing(true);
    try {
      const data = await api.professor.briefing(submission.id);
      setAiBriefing(data.analysis);
    } catch (err) {
      setAiBriefing(`Could not generate a briefing: ${errorMessage(err)}`);
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const topicData = Object.entries(submission.topicBreakdown || {})
    .filter(([, data]) => data && data.total > 0)
    .map(([topic, data]) => ({
      subject: topic,
      score: data!.percentage,
      fullMark: 100,
    }));
  const integrity = submission.integrityReport || { tabSwitchCount: 0, copyPasteAttempts: 0, aiGeneratedProbability: 0, integrityFlagged: false, notes: [] };

  return (
    <div className="space-y-8 pb-20">
      {/* Back Button & Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium text-sm bg-white px-4 py-2 rounded-md border border-slate-200 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Applicant List</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 rounded-md text-xs font-medium shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export Report (PDF / Print)</span>
          </button>
        </div>
      </div>

      {/* Candidate Profile Header Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-md bg-brand-600 text-white font-bold text-xl flex items-center justify-center shadow-sm shrink-0">
            {submission.applicantName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 3)}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{submission.applicantName}</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                {submission.university}
              </span>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {submission.degreeProgram} • GPA: <span className="font-bold text-slate-900">{submission.gpa || 'N/A'}</span> • {submission.applicantEmail}
              {submission.secondaryEmail && <span className="text-slate-600"> (Personal: {submission.secondaryEmail})</span>}
            </p>
            <div className="flex items-center space-x-4 text-xs text-slate-600 pt-1">
              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-brand-500" /> Time Spent: {Math.round(submission.totalTimeSpentSeconds / 60)} minutes</span>
              <span className="flex items-center"><User className="w-3.5 h-3.5 mr-1 text-brand-700" /> Status: {submission.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Score and Decision Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 shrink-0">
          <div className="text-center sm:text-right pr-4 sm:border-r border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Weighted Score</span>
            <div className={`text-3xl font-semibold ${
              submission.overallScore >= 90 ? 'text-brand-700' : submission.overallScore >= 80 ? 'text-brand-600' : submission.overallScore >= 70 ? 'text-amber-700' : 'text-rose-600'
            }`}>
              {submission.overallScore}%
            </div>
            <span className="text-xs text-slate-600 block font-medium" title="Difficulty-Weighted Total Points">
              {submission.totalWeightedScore ?? 0} / {submission.maxTotalWeightedScore ?? 100} weighted pts
            </span>
            {submission.hireabilityLevel && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs uppercase font-bold mt-1 ${getHireabilityBadgeStyle(submission.hireabilityLevel)}`}>
                {getHireabilityShortText(submission.hireabilityLevel)}
              </span>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Current Professor Status</span>
            <span className={`px-3 py-1 rounded-md text-xs font-bold block text-center uppercase ${
              profDecision === 'Interview' ? 'bg-brand-700 text-white shadow-sm' :
              profDecision === 'Reject' ? 'bg-rose-600 text-white shadow-sm' :
              profDecision === 'Pending' || profDecision === 'Pending Professor Interview / Review' || profDecision === 'Hold for Review' || !profDecision ? 'bg-amber-500 text-slate-900 shadow-sm' :
              'bg-slate-200 text-slate-700'
            }`}>
              {profDecision === 'Interview' ? 'Accepted (Interview)' : profDecision || 'Pending'}
            </span>
            {profDecision === 'Interview' && submission.applicantResponseToInterview && (
              <span className={`mt-1 px-2.5 py-0.5 rounded text-xs font-semibold block text-center border ${
                submission.applicantResponseToInterview === 'Accepted'
                  ? 'bg-brand-50 text-brand-800 border-brand-300'
                  : submission.applicantResponseToInterview === 'Declined'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                Candidate RSVP: {submission.applicantResponseToInterview} {submission.applicantResponseToInterview === 'Accepted' ? '' : submission.applicantResponseToInterview === 'Declined' ? '' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-lg">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'questions', label: 'Answers and scores' },
          { id: 'integrity', label: 'Integrity' },
          { id: 'briefing', label: 'Interview briefing' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 font-bold text-xs border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Advisory recommendation */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recommendation (advisory)</h3>
                  <p className="text-xs text-slate-600">The decision is yours.</p>
                </div>
                <RecommendationTag submission={submission} />
              </div>

              <div className="bg-slate-50 p-5 rounded-md border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  Explanation
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-normal">
                  {submission.recommendationExplanation}
                </p>
              </div>

              <div className="bg-white text-slate-900 p-5 rounded-md border border-slate-200 text-xs space-y-2">
                <span className="block text-sm font-semibold text-slate-900">{submission.gradedWithAi ? 'AI summary' : 'Summary'}</span>
                <p className="text-slate-700 font-normal leading-relaxed text-xs">{submission.aiSummary}</p>
              </div>
            </div>

            {/* Topic Breakdown Chart */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Topic Performance Breakdown</h3>
              <p className="text-xs text-slate-600">Applicant proficiency evaluated across core academic subjects</p>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="score" fill="#28656b" radius={[6, 6, 0, 0]} barSize={45}>
                      {topicData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score >= 90 ? '#1e4549' : entry.score >= 75 ? '#28656b' : '#4f989e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Professor Decision & Feedback */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-5">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Professor Evaluation & Decision
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Private Faculty Notes</label>
                <textarea aria-label="Private Faculty Notes"
                  rows={5}
                  value={profNotes}
                  onChange={(e) => setProfNotes(e.target.value)}
                  placeholder="Leave confidential notes (e.g., 'Check proof of algorithm theorem during interview', 'Strong coding background')..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-normal leading-relaxed"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Only you can see these notes — never the candidate.</span>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving || profNotes === (submission.professorNotes || '')}
                    className="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-40 px-2.5 py-1 rounded border border-brand-200"
                  >
                    Save Notes
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">Decision</span>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={() => handleSaveDecision('Interview')}
                    className={`p-3 rounded-md font-medium text-xs flex items-center justify-center space-x-2 transition-colors ${
                      profDecision === 'Interview' ? 'bg-brand-700 text-white shadow-sm' : 'bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-200'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Mark to Interview (Invite)</span>
                  </button>

                  <button
                    onClick={() => handleSaveDecision('Pending')}
                    className={`p-3 rounded-md font-medium text-xs flex items-center justify-center space-x-2 transition-colors ${
                      profDecision === 'Pending' || profDecision === 'Pending Professor Interview' || profDecision === 'Pending Professor Interview / Review' || profDecision === 'Hold for Review' || !profDecision ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Mark as Pending Review</span>
                  </button>

                  <button
                    onClick={() => handleSaveDecision('Reject')}
                    className={`p-3 rounded-md font-medium text-xs flex items-center justify-center space-x-2 transition-colors ${
                      profDecision === 'Reject' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>Reject Candidate</span>
                  </button>
                </div>
              </div>

              {profDecision === 'Interview' && (
                <div className="bg-brand-50/80 p-4 rounded-lg border border-brand-300 space-y-3 mt-3 fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-1.5 text-brand-700" />
                      Set Meeting Date & Time (Professor Assigned)
                    </span>
                    <span className="text-xs bg-brand-200 text-brand-900 px-2 py-0.5 rounded font-bold uppercase">
                      Status: Accepted
                    </span>
                  </div>
                  <p className="text-xs text-brand-800 leading-relaxed">
                    When marked for interview, status changes to <strong>Accepted</strong>. As professor, you set the interview meeting schedule below:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-bold text-brand-900 block mb-1">Meeting Date *</label>
                      <input aria-label="Meeting Date"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={meetingDateInput || submission.interviewDate || ''}
                        onChange={(e) => {
                          setMeetingDateInput(e.target.value);
                          if (e.target.value) saveSchedule({ interviewDate: e.target.value });
                        }}
                        className="w-full bg-white border border-brand-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-brand-900 block mb-1">Time Slot *</label>
                      <select aria-label="Time Slot"
                        value={meetingTimeInput || '10:00 AM EST'}
                        onChange={(e) => {
                          setMeetingTimeInput(e.target.value);
                          saveSchedule({ interviewTime: e.target.value });
                        }}
                        className="w-full bg-white border border-brand-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="09:00 AM EST">09:00 AM EST (Morning Session)</option>
                        <option value="10:00 AM EST">10:00 AM EST (Mid-Morning)</option>
                        <option value="10:30 AM EST">10:30 AM EST (Mid-Morning)</option>
                        <option value="01:00 PM EST">01:00 PM EST (Afternoon Session)</option>
                        <option value="02:00 PM EST">02:00 PM EST (Mid-Afternoon)</option>
                        <option value="02:30 PM EST">02:30 PM EST (Mid-Afternoon)</option>
                        <option value="04:00 PM EST">04:00 PM EST (Late Afternoon)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-brand-900 flex items-center">
                        <Video className="w-3.5 h-3.5 mr-1 text-brand-700" />
                        Meeting Video Link (saved when you leave the field)
                      </label>
                    </div>
                    <input aria-label="Meeting link"
                      type="text"
                      placeholder="https://meet.google.com/..."
                      value={meetingLinkInput}
                      onChange={(e) => setMeetingLinkInput(e.target.value)}
                      onBlur={() => {
                        const link = normalizeMeetingLink(meetingLinkInput);
                        if (link !== (submission.meetingLink || '')) {
                          setMeetingLinkInput(link);
                          saveSchedule({ meetingLink: link });
                        }
                      }}
                      className="w-full bg-white border border-brand-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Integrity Summary Widget */}
            <div className={`p-5 rounded-lg border ${
              integrity.integrityFlagged ? 'bg-rose-50 border-rose-300' : 'bg-brand-50 border-brand-300'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                {integrity.integrityFlagged ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-brand-700" />
                )}
                <h4 className="font-bold text-sm text-slate-900">
                  {integrity.integrityFlagged ? 'Integrity flags raised' : 'No integrity flags'}
                </h4>
              </div>
              <p className="text-xs text-slate-700 font-medium">
                {submission.gradedWithAi && (
                  <>
                    AI-written text estimate: <span className="font-bold">{integrity.aiGeneratedProbability}%</span>.{' '}
                  </>
                )}
                Tab switches: <span className="font-bold">{integrity.tabSwitchCount}</span>.
              </p>
              <button
                onClick={() => setActiveTab('integrity')}
                className="mt-3 text-xs font-bold text-brand-700 underline"
              >
                View integrity details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTION BY QUESTION GRADING */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Detailed Question Response Audit</h3>
              <p className="text-xs text-slate-600">
                Automatic scores for written answers are provisional. Compare each answer with your rubric and change any score.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-md border border-brand-200 uppercase tracking-wider">
                {Object.keys(submission.responses).length} Questions Evaluated
              </span>
              {hasUnsavedOverrides && (
                <>
                  <button
                    onClick={() => setOverrides({})}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md border border-slate-300"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveOverrides}
                    className="text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md shadow-sm"
                  >
                    Save Score Overrides
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {(Object.values(submission.responses) as any[]).map((resp, idx) => {
              const question = questions.find((q) => q.id === resp.questionId);
              if (!question) return null;

              const savedScore = getEffectiveScore(resp);
              const currentScore = overrides[resp.questionId] !== undefined ? overrides[resp.questionId] : savedScore;
              const isOverridden = overrides[resp.questionId] !== undefined ? currentScore !== resp.aiScore : resp.professorOverride;

              return (
                <div key={resp.questionId} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-md bg-brand-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                        Q{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{question.title}</h4>
                        <span className="text-xs text-slate-600 font-medium">
                          {question.topic} • {question.type.toUpperCase()} • <strong className="text-brand-600">{question.difficulty}</strong> ({resp.difficultyWeight || 1.5}x weight)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      <div className="flex flex-col items-end space-y-1">
                        <div className="flex items-center space-x-1 bg-white px-3 py-1 rounded-md border border-slate-300 text-xs font-bold">
                          <span>Raw:</span>
                          <input aria-label="Adjusted score"
                            type="number"
                            min={0}
                            max={resp.maxScore}
                            value={currentScore}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(resp.maxScore, Number(e.target.value) || 0));
                              setOverrides({ ...overrides, [resp.questionId]: val });
                            }}
                            className="w-12 bg-white text-slate-900 text-center font-bold text-brand-600 rounded px-1 py-0.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          <span>/ {resp.maxScore}</span>
                        </div>
                        {resp.weightedScore !== undefined && (
                          <span className="text-xs text-slate-600 font-semibold">
                            Weighted: <span className="text-brand-600 font-bold">{Math.round(currentScore * (resp.difficultyWeight || 1.5) * 10) / 10}</span> / {resp.maxWeightedScore} pts
                          </span>
                        )}
                        {isOverridden && (
                          <span className="text-xs text-amber-700 font-bold">
                            Changed by you (automatic score: {resp.aiScore})
                          </span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${
                        currentScore >= resp.maxScore
                          ? 'bg-brand-100 text-brand-800'
                          : currentScore > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {currentScore >= resp.maxScore ? 'Full credit' : currentScore > 0 ? 'Partial credit' : 'No credit'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 uppercase tracking-wider text-xs block mb-1">
                        Question Prompt:
                      </span>
                      <p className="text-slate-800 font-normal bg-slate-50 p-3 rounded-md border border-slate-200 leading-relaxed">
                        {question.prompt}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-brand-900 uppercase tracking-wider text-xs block mb-1">
                        Candidate's Submitted Response:
                      </span>
                      {!String(resp.answer ?? '').trim() ? (
                        <div className="bg-slate-50 p-4 rounded-md border border-dashed border-slate-300 text-slate-600 italic">
                          No answer submitted.
                        </div>
                      ) : question.type === 'programming' ? (
                        <pre className="bg-slate-50 text-slate-900 font-mono p-4 rounded-md border border-slate-300 overflow-x-auto text-xs leading-relaxed">
                          {resp.answer}
                        </pre>
                      ) : (
                        <div className="bg-brand-50/50 p-4 rounded-md border border-brand-200 text-slate-900 font-medium leading-relaxed whitespace-pre-wrap break-words">
                          {Array.isArray(resp.answer) ? resp.answer.join(', ') : String(resp.answer)}
                          {question.type === 'multiple-choice' && question.correctAnswers && (
                            <span className="block mt-2 text-xs font-semibold text-slate-600">
                              Correct answer: {question.correctAnswers.join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold text-slate-600 uppercase tracking-wider text-xs block mb-1">
                          Professor Rubric / Model Answer:
                        </span>
                        <div className="bg-amber-50/80 p-3 rounded-md border border-amber-200 text-amber-900 font-normal italic leading-relaxed">
                          {question.rubric || question.sampleAnswer || 'No rubric provided.'}
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-600 uppercase tracking-wider text-xs block mb-1">
                          {submission.gradedWithAi ? 'AI feedback' : 'Automatic feedback'}
                        </span>
                        <div className="bg-white p-3 rounded-md border border-slate-200 text-slate-800 font-normal leading-relaxed">
                          <div>
                            <p>{resp.aiFeedback}</p>
                            <span className="block text-xs text-slate-600 mt-1 font-medium">
                              Grading confidence: {resp.aiConfidence}%{submission.gradedWithAi ? '' : ' (based on how many rubric concepts the answer mentions)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRITY & ANTI-CHEATING */}
      {activeTab === 'integrity' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-6 h-6 text-brand-600" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">Integrity record</h3>
                <p className="text-xs text-slate-600">Events recorded by the browser during the test{submission.gradedWithAi ? ', and an AI-written text estimate from the AI grading' : ''}.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Browser Tab Switches</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {integrity.tabSwitchCount} times
                </span>
                <span className="text-xs text-slate-600 mt-0.5 block font-medium">Focus lost during assessment</span>
              </div>

              <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Blocked copy or paste attempts</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {integrity.copyPasteAttempts}
                </span>
                <span className="text-xs text-slate-600 mt-0.5 block font-medium">Copy, cut and paste are blocked when enabled for the test</span>
              </div>

              {submission.gradedWithAi ? (
                <div className={`p-4 rounded-md border ${integrity.aiGeneratedProbability > 50 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">AI-written text estimate</span>
                  <span className="text-2xl font-bold mt-1 block text-slate-900">{integrity.aiGeneratedProbability}%</span>
                  <span className="text-xs text-slate-600 mt-0.5 block font-medium">Estimated by Gemini. Indicative only, not proof.</span>
                </div>
              ) : (
                <div className="p-4 rounded-md border bg-slate-50 border-slate-200">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">AI-written text estimate</span>
                  <span className="text-2xl font-bold mt-1 block text-slate-500">Not measured</span>
                  <span className="text-xs text-slate-600 mt-0.5 block font-medium">AI grading did not run for this submission.</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">Detailed Integrity Logs & Flags</h4>
              <ul className="space-y-2">
                {(integrity.notes || []).map((note, i) => (
                  <li
                    key={i}
                    className={`p-3 rounded-md border text-xs font-medium flex items-center space-x-2 ${
                      note.includes('FLAGGED') ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {note.includes('FLAGGED') ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0" />
                    )}
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BRIEFING */}
      {activeTab === 'briefing' && (
        <div className="bg-white p-6 md:p-8 rounded-lg border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Interview briefing</h3>
                <p className="text-sm text-slate-600">Notes to help you prepare for the interview with {submission.applicantName}.</p>
              </div>
            </div>
            <button
              onClick={handleGenerateBriefing}
              disabled={generatingBriefing}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-xs font-medium shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <span>{generatingBriefing ? 'Writing…' : 'Write briefing'}</span>
            </button>
          </div>

          <div className="bg-slate-50 p-6 rounded-md border border-slate-200 text-slate-800 space-y-4 font-normal text-sm leading-relaxed whitespace-pre-line">
            {aiBriefing ? (
              aiBriefing
            ) : (
              <div className="text-center py-8 text-slate-600">
                <p>Select “Write briefing” to prepare interview notes for this applicant.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professor Interview Schedule Popup Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 fade-in" onClick={() => setShowInterviewModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-md overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
            <ModalBehavior onClose={() => setShowInterviewModal(false)} />
            <div className="p-6 text-slate-900 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-400 text-slate-900 font-bold flex items-center justify-center text-base shrink-0">
                  <Calendar className="w-5 h-5 text-brand-800" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Set Interview Meeting Details</h3>
                  <p className="text-xs text-brand-800">Assign meeting link & schedule for {submission.applicantName}</p>
                </div>
              </div>
              <button onClick={() => setShowInterviewModal(false)} className="rounded-md p-1 text-brand-800 hover:text-slate-900 " aria-label="Close"><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-brand-50 p-3.5 rounded-lg border border-brand-200 text-xs text-brand-900 leading-relaxed">
                You are marking <strong>{submission.applicantName}</strong> for an interview. Their status will change to <strong>Accepted</strong>. Please set the video meeting link and date below:
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center">
                      <Video className="w-3.5 h-3.5 mr-1 text-brand-700" />
                      Meeting Video Link (optional — can be added later)
                    </label>
                  </div>
                  <input aria-label="Meeting link"
                    type="text"
                    placeholder="https://meet.google.com/..."
                    value={meetingLinkInput}
                    onChange={(e) => setMeetingLinkInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Meeting Date *</label>
                  <input aria-label="Meeting Date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={meetingDateInput || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]}
                    onChange={(e) => setMeetingDateInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time Slot *</label>
                  <select aria-label="Time Slot"
                    value={meetingTimeInput}
                    onChange={(e) => setMeetingTimeInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="09:00 AM EST">09:00 AM EST (Morning Session)</option>
                    <option value="10:00 AM EST">10:00 AM EST (Mid-Morning)</option>
                    <option value="10:30 AM EST">10:30 AM EST (Mid-Morning)</option>
                    <option value="01:00 PM EST">01:00 PM EST (Afternoon Session)</option>
                    <option value="02:00 PM EST">02:00 PM EST (Mid-Afternoon)</option>
                    <option value="02:30 PM EST">02:30 PM EST (Mid-Afternoon)</option>
                    <option value="04:00 PM EST">04:00 PM EST (Late Afternoon)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInterviewSchedule}
                disabled={saving}
                className="disabled:opacity-50 px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Save Interview</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
