import React from 'react';
import { BarChart3, Clock, Award, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Assessment, ApplicantSubmission, ProfessorProfile, Question } from '../types';

interface AnalyticsDashboardProps {
  currentProfessor: ProfessorProfile;
  assessments: Assessment[];
  submissions: ApplicantSubmission[];
  questionBank: Question[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  currentProfessor,
  assessments,
  submissions,
  questionBank,
}) => {
  // Same ownership rule as the dashboard and applicant list
  const profAssessmentIds = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id).map((a) => a.id);
  const relevantSubmissions = submissions.filter((s) => profAssessmentIds.includes(s.assessmentId));
  const total = relevantSubmissions.length;

  // Average time per question chart (from recorded per-question time)
  const timeByQuestion: Record<string, { totalSeconds: number; count: number }> = {};
  relevantSubmissions.forEach((sub) => {
    Object.values(sub.responses || {}).forEach((resp) => {
      const seconds = sub.timeAnalysis?.[resp.questionId] ?? resp.timeSpentSeconds;
      if (!seconds) return;
      const entry = (timeByQuestion[resp.questionId] ||= { totalSeconds: 0, count: 0 });
      entry.totalSeconds += seconds;
      entry.count += 1;
    });
  });
  const timePerQuestionData = Object.entries(timeByQuestion)
    .map(([questionId, { totalSeconds, count }]) => {
      const question = questionBank.find((q) => q.id === questionId);
      const title = question?.title || questionId;
      return {
        question: title.length > 28 ? `${title.slice(0, 28)}…` : title,
        avgMinutes: Math.round((totalSeconds / count / 60) * 10) / 10,
      };
    })
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, 8);
  const slowThreshold = timePerQuestionData.length
    ? timePerQuestionData.reduce((a, b) => a + b.avgMinutes, 0) / timePerQuestionData.length
    : 0;

  // Subject performance averages (only topics the cohort was actually tested on)
  const topicTotals: Record<string, { sum: number; count: number }> = {};
  relevantSubmissions.forEach((sub) => {
    Object.entries(sub.topicBreakdown || {}).forEach(([topic, data]) => {
      if (!data || data.total <= 0) return;
      const entry = (topicTotals[topic] ||= { sum: 0, count: 0 });
      entry.sum += data.percentage;
      entry.count += 1;
    });
  });
  const subjectAverages = Object.entries(topicTotals).map(([subject, { sum, count }]) => ({
    subject,
    score: Math.round(sum / count),
    fullMark: 100,
  }));

  const interviewCount = relevantSubmissions.filter((s) => s.professorDecision === 'Interview').length;
  const recommendedCount = relevantSubmissions.filter(
    (s) => s.interviewRecommendation === 'Strongly Recommend Interview' || s.interviewRecommendation === 'Recommend Interview'
  ).length;
  const avgMinutes = total ? Math.round((relevantSubmissions.reduce((a, b) => a + (b.totalTimeSpentSeconds || 0), 0) / total / 60) * 10) / 10 : 0;
  const flaggedCount = relevantSubmissions.filter((s) => s.integrityReport?.integrityFlagged).length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 1000) / 10}%` : '0%');

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center font-bold shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Professor Screening Analytics & Insights</h2>
            <p className="text-xs text-slate-600">
              Aggregated metrics, topic difficulties, and time expenditure across your screening assessments
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <span className="bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
            {total} Submissions Analyzed
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="bg-white p-12 rounded-lg border border-slate-200 shadow-sm text-center text-slate-600">
          <BarChart3 className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <h3 className="font-bold text-slate-700">No submissions yet</h3>
          <p className="text-xs mt-1">Analytics will appear once students complete one of your assessments.</p>
        </div>
      ) : (
        <>
          {/* Grid Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar Chart: Topic Proficiency */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Average Topic Proficiency</h3>
                <p className="text-xs text-slate-600">Identifies research disciplines where applicant cohort excels or struggles</p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {subjectAverages.length >= 3 ? (
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subjectAverages}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Radar
                        name="Avg Applicant Score (%)"
                        dataKey="score"
                        stroke="#28656b"
                        fill="#28656b"
                        fillOpacity={0.35}
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    </RadarChart>
                  ) : (
                    // A radar needs at least three axes; fall back to bars for one or two topics
                    <BarChart data={subjectAverages} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="score" name="Avg Applicant Score (%)" fill="#28656b" radius={[6, 6, 0, 0]} barSize={45} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Time Spent Per Question */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Average Time Spent per Screening Question</h3>
                <p className="text-xs text-slate-600">Identifies time-consuming bottlenecks and programming challenge duration</p>
              </div>

              <div className="h-80 w-full">
                {timePerQuestionData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-600">No per-question timing recorded yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={timePerQuestionData} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" unit=" min" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="question" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11 }} width={160} />
                      <Tooltip
                        formatter={(value: any) => [`${value} minutes`, 'Avg Duration']}
                        contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Bar dataKey="avgMinutes" fill="#4f989e" radius={[0, 6, 6, 0]} barSize={24}>
                        {timePerQuestionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.avgMinutes > slowThreshold * 1.5 ? '#b45309' : '#4f989e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Interview Invitation Rate</span>
                <span className="text-2xl font-bold text-slate-900 block mt-0.5">{pct(interviewCount)}</span>
                <span className="text-xs text-brand-700 font-medium">
                  {interviewCount} of {total} invited • {recommendedCount} AI-recommended
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Avg Exam Completion Time</span>
                <span className="text-2xl font-bold text-slate-900 block mt-0.5">{avgMinutes} min</span>
                <span className="text-xs text-slate-600">Across {total} submission{total === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-md bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Integrity flags</span>
                <span className="text-2xl font-bold text-red-600 block mt-0.5">
                  {flaggedCount} candidate{flaggedCount === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-red-600 font-medium">{pct(flaggedCount)} flagged for AI/tab switching</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
