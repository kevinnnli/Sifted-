import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronRight, FilePlus2, Library, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Assessment, ApplicantSubmission, ProfessorProfile, InterviewRecommendation } from '../types';
import { getHireabilityShortText } from '../utils/grading';
import { SummaryRow } from './ui/SummaryRow';

interface ProfessorDashboardProps {
  currentProfessor: ProfessorProfile;
  assessments: Assessment[];
  submissions: ApplicantSubmission[];
  onSelectSubmission: (submission: ApplicantSubmission) => void;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToAssessments?: () => void;
  onNavigateToQuestionBank?: () => void;
}

// Advisory recommendations, in order, with a restrained marker colour for each
export const RECOMMENDATIONS: { value: InterviewRecommendation; label: string; dot: string }[] = [
  { value: 'Strongly Recommend Interview', label: 'Strongly recommend interview', dot: 'bg-brand-700' },
  { value: 'Recommend Interview', label: 'Recommend interview', dot: 'bg-brand-400' },
  { value: 'Borderline', label: 'Borderline', dot: 'bg-amber-500' },
  { value: 'Do Not Recommend', label: 'Do not recommend', dot: 'bg-slate-400' },
];

/** The advisory recommendation, with where it came from: Gemini or the built-in scoring. */
export function RecommendationTag({ submission }: { submission: ApplicantSubmission }) {
  const rec = RECOMMENDATIONS.find((r) => r.value === submission.interviewRecommendation);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-800">
        <span className={`h-2 w-2 shrink-0 rounded-full ${rec?.dot || 'bg-slate-300'}`} aria-hidden />
        {rec?.label || submission.interviewRecommendation}
      </span>
      <span className="text-xs text-slate-500">{gradingSource(submission)}</span>
    </span>
  );
}

/** Who produced the automatic grade and recommendation. Older submissions did not record it. */
export function gradingSource(submission: ApplicantSubmission) {
  if (submission.gradedWithAi === true) return 'Graded with AI assistance';
  if (submission.gradedWithAi === false) return 'Built-in grading (no AI)';
  return 'Automatic grading';
}

// Score bands in one hue, darker for higher scores (readable without relying on red/green)
const BANDS = [
  { range: '90–100%', min: 90, max: 101, color: '#1e4549' },
  { range: '80–89%', min: 80, max: 90, color: '#28656b' },
  { range: '70–79%', min: 70, max: 80, color: '#4f989e' },
  { range: 'Below 70%', min: -1, max: 70, color: '#64748b' },
];

export const ProfessorDashboard: React.FC<ProfessorDashboardProps> = ({
  currentProfessor,
  assessments,
  submissions,
  onSelectSubmission,
  onNavigateToTab,
  onNavigateToAssessments,
  onNavigateToQuestionBank,
}) => {
  const [filterRecommendation, setFilterRecommendation] = useState<InterviewRecommendation | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('all');

  const ownAssessments = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id);
  const ownIds = new Set(ownAssessments.map((a) => a.id));
  const relevant = submissions.filter((s) => ownIds.has(s.assessmentId));

  const query = searchQuery.trim().toLowerCase();
  const filtered = relevant.filter(
    (sub) =>
      (filterRecommendation === 'all' || sub.interviewRecommendation === filterRecommendation) &&
      (selectedAssessmentId === 'all' || sub.assessmentId === selectedAssessmentId) &&
      (!query || sub.applicantName.toLowerCase().includes(query) || (sub.university || '').toLowerCase().includes(query))
  );

  const scores = relevant.map((s) => s.overallScore);
  const reviewed = relevant.filter((s) => s.status === 'reviewed').length;
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const averageMinutes = relevant.length ? Math.round(relevant.reduce((a, b) => a + b.totalTimeSpentSeconds, 0) / relevant.length / 60) : null;
  const averageLimit = ownAssessments.length ? Math.round(ownAssessments.reduce((a, b) => a + (b.timeLimitMinutes || 0), 0) / ownAssessments.length) : null;
  const distribution = BANDS.map((band) => ({ ...band, count: relevant.filter((s) => s.overallScore >= band.min && s.overallScore < band.max).length }));
  const countFor = (value: InterviewRecommendation) => relevant.filter((s) => s.interviewRecommendation === value).length;

  const goTo = (tab: 'assessments' | 'questions' | 'analytics') => {
    if (tab === 'assessments' && onNavigateToAssessments) return onNavigateToAssessments();
    if (tab === 'questions' && onNavigateToQuestionBank) return onNavigateToQuestionBank();
    onNavigateToTab?.(tab);
  };

  const summary = [
    { label: 'Submissions', value: String(relevant.length), note: `${reviewed} reviewed` },
    { label: 'Average score', value: average === null ? '—' : `${average}%`, note: 'Difficulty-weighted' },
    { label: 'Score range', value: scores.length ? `${Math.min(...scores)}–${Math.max(...scores)}%` : '—', note: 'Lowest to highest' },
    {
      label: 'Average time taken',
      value: averageMinutes === null ? '—' : `${averageMinutes} min`,
      note: averageLimit ? `Average limit ${averageLimit} min` : 'No assessments yet',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProfessor.labName} · {currentProfessor.department}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => goTo('assessments')}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <FilePlus2 className="h-4 w-4 text-slate-600" aria-hidden />
            New assessment
          </button>
          <button
            onClick={() => goTo('questions')}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Library className="h-4 w-4 text-slate-600" aria-hidden />
            Question bank
          </button>
        </div>
      </div>

      <SummaryRow items={summary} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-labelledby="distribution-title" className="rounded-lg border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="distribution-title" className="text-lg font-semibold">
                Score distribution
              </h2>
              <p className="text-sm text-slate-600">Submissions per score band, across your assessments.</p>
            </div>
            <button onClick={() => goTo('analytics')} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">
              Analytics
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="h-60 w-full" role="img" aria-label={distribution.map((d) => `${d.range}: ${d.count}`).join(', ')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="count" name="Submissions" radius={[3, 3, 0, 0]} barSize={36}>
                  {distribution.map((entry) => (
                    <Cell key={entry.range} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section aria-labelledby="recommendations-title" className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 id="recommendations-title" className="text-lg font-semibold">
            Recommendations
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Each submission gets an advisory recommendation from its score, and from AI grading if it is enabled. The decision is yours. Select one
            to filter the list.
          </p>
          <ul className="mt-4 space-y-1.5">
            {RECOMMENDATIONS.map((rec) => {
              const active = filterRecommendation === rec.value;
              return (
                <li key={rec.value}>
                  <button
                    onClick={() => setFilterRecommendation(active ? 'all' : rec.value)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${rec.dot}`} aria-hidden />
                      {rec.label}
                    </span>
                    <span className="font-semibold tabular-nums">{countFor(rec.value)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filterRecommendation !== 'all' && (
            <button onClick={() => setFilterRecommendation('all')} className="mt-3 text-sm font-semibold text-brand-700 underline underline-offset-2">
              Show all submissions
            </button>
          )}
        </section>
      </div>

      <section aria-labelledby="submissions-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="submissions-title" className="text-lg font-semibold">
              Submissions
            </h2>
            <p className="text-sm text-slate-600">Open a submission to see the answers, scores and integrity record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
              <input
                aria-label="Search by name or university"
                type="search"
                placeholder="Name or university"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
              />
            </div>
            <select
              aria-label="Filter by assessment"
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="max-w-[16rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
            >
              <option value="all">All assessments ({ownAssessments.length})</option>
              {ownAssessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <caption className="sr-only">Submissions to your assessments</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th scope="col" className="px-6 py-3">Applicant</th>
                <th scope="col" className="px-4 py-3">Institution</th>
                <th scope="col" className="px-4 py-3">Score</th>
                <th scope="col" className="px-4 py-3">Recommendation</th>
                <th scope="col" className="px-4 py-3">Integrity</th>
                <th scope="col" className="px-6 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-600">
                    {relevant.length === 0 ? 'No submissions yet. They appear here when candidates finish a test.' : 'No submissions match these filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr key={sub.id} onClick={() => onSelectSubmission(sub)} className="cursor-pointer align-top transition-colors hover:bg-brand-50/50">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900">{sub.applicantName}</span>
                      <span className="block break-all text-xs text-slate-600">{sub.applicantEmail}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <span className="block">{sub.university}</span>
                      <span className="block text-xs text-slate-600">
                        {sub.degreeProgram}
                        {sub.gpa ? ` · GPA ${sub.gpa}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="font-serif text-lg font-semibold text-slate-900">{sub.overallScore}%</span>
                      {sub.hireabilityLevel && <span className="block text-xs text-slate-600">{getHireabilityShortText(sub.hireabilityLevel)}</span>}
                    </td>
                    <td className="px-4 py-4">
                      <RecommendationTag submission={sub} />
                    </td>
                    <td className="px-4 py-4">
                      {sub.integrityReport?.integrityFlagged ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-800">
                          <AlertTriangle className="h-4 w-4" aria-hidden /> Flagged
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">No flags</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSubmission(sub);
                        }}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                      >
                        Review
                        <span className="sr-only"> submission from {sub.applicantName}</span>
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
