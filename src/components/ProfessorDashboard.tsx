import React, { useState } from 'react';
import { asButton } from './ui/a11y';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Filter, 
  Search, 
  Award, 
  ShieldAlert,
  FileText,
  PlusCircle,
  HelpCircle,
  Send,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Assessment, ApplicantSubmission, ProfessorProfile, InterviewRecommendation } from '../types';
import { getHireabilityBadgeStyle, getHireabilityShortText } from '../utils/grading';

interface ProfessorDashboardProps {
  currentProfessor: ProfessorProfile;
  assessments: Assessment[];
  submissions: ApplicantSubmission[];
  onSelectSubmission: (submission: ApplicantSubmission) => void;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToAssessments?: () => void;
  onNavigateToQuestionBank?: () => void;
  onOpenAIQuestionGenerator?: () => void;
  onOpenAssignModal?: () => void;
}

export const ProfessorDashboard: React.FC<ProfessorDashboardProps> = ({
  currentProfessor,
  assessments,
  submissions,
  onSelectSubmission,
  onNavigateToTab,
  onNavigateToAssessments,
  onNavigateToQuestionBank,
  onOpenAIQuestionGenerator,
  onOpenAssignModal,
}) => {
  const handleNav = (tab: string) => {
    if (tab === 'assessments' && onNavigateToAssessments) onNavigateToAssessments();
    else if (tab === 'questions' && onNavigateToQuestionBank) onNavigateToQuestionBank();
    else if (onNavigateToTab) onNavigateToTab(tab);
  };

  const handleOpenAI = () => {
    if (onOpenAIQuestionGenerator) onOpenAIQuestionGenerator();
    else if (onNavigateToQuestionBank) onNavigateToQuestionBank();
    else if (onNavigateToTab) onNavigateToTab('questions');
  };
  const [filterRecommendation, setFilterRecommendation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('all');

  // Filter submissions by professor assessments
  const profAssessmentList = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id);
  const profAssessmentIds = profAssessmentList.map((a) => a.id);
  const relevantSubmissions = submissions.filter((s) => profAssessmentIds.includes(s.assessmentId));

  const filteredSubmissions = relevantSubmissions.filter((sub) => {
    const matchesRec = filterRecommendation === 'all' || sub.interviewRecommendation === filterRecommendation;
    const matchesSearch = sub.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.university.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssessment = selectedAssessmentId === 'all' || sub.assessmentId === selectedAssessmentId;
    return matchesRec && matchesSearch && matchesAssessment;
  });

  // Calculate metrics
  const totalApplicants = relevantSubmissions.length;
  const completedCount = relevantSubmissions.filter((s) => s.status === 'completed' || s.status === 'reviewed').length;
  const scores = relevantSubmissions.map((s) => s.overallScore);
  const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  const highScore = scores.length ? Math.max(...scores).toFixed(1) : '0';
  const lowScore = scores.length ? Math.min(...scores).toFixed(1) : '0';
  const avgTimeLimit = profAssessmentList.length
    ? Math.round(profAssessmentList.reduce((a, b) => a + (b.timeLimitMinutes || 0), 0) / profAssessmentList.length)
    : 0;
  const avgTimeMinutes = relevantSubmissions.length
    ? Math.round(relevantSubmissions.reduce((a, b) => a + b.totalTimeSpentSeconds, 0) / relevantSubmissions.length / 60)
    : 0;

  // Recommendation counts
  const recCounts = {
    strongly: relevantSubmissions.filter((s) => s.interviewRecommendation === 'Strongly Recommend Interview').length,
    recommend: relevantSubmissions.filter((s) => s.interviewRecommendation === 'Recommend Interview').length,
    borderline: relevantSubmissions.filter((s) => s.interviewRecommendation === 'Borderline').length,
    no: relevantSubmissions.filter((s) => s.interviewRecommendation === 'Do Not Recommend').length,
  };

  // Recharts score distribution data
  const scoreDistribution = [
    { range: '90-100%', count: relevantSubmissions.filter((s) => s.overallScore >= 90).length, color: '#10B981' },
    { range: '80-89%', count: relevantSubmissions.filter((s) => s.overallScore >= 80 && s.overallScore < 90).length, color: '#4f989e' },
    { range: '70-79%', count: relevantSubmissions.filter((s) => s.overallScore >= 70 && s.overallScore < 80).length, color: '#F59E0B' },
    { range: '< 70%', count: relevantSubmissions.filter((s) => s.overallScore < 70).length, color: '#EF4444' },
  ];

  const getRecommendationBadge = (rec: InterviewRecommendation) => {
    switch (rec) {
      case 'Strongly Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-xs font-bold bg-emerald-100 text-emerald-700"><Award className="w-3 h-3 mr-1" /> Strongly Recommend</span>;
      case 'Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-xs font-bold bg-brand-100 text-brand-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Recommend</span>;
      case 'Borderline':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-xs font-bold bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" /> Borderline</span>;
      case 'Do Not Recommend':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-xs font-bold bg-rose-100 text-rose-700"><ShieldAlert className="w-3 h-3 mr-1" /> Do Not Recommend</span>;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner & Quick Actions */}
      <div className="bg-white rounded-xl p-6 md:p-8 text-slate-900 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {currentProfessor.name}</h1>
            <p className="text-slate-700 text-sm max-w-2xl">
              {currentProfessor.labName} • {currentProfessor.department}. You have <span className="text-slate-900 font-semibold">{totalApplicants} applicant submissions</span> across your active graduate screening assessments.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {onOpenAssignModal && (
              <button
                onClick={onOpenAssignModal}
                className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Assign Test to Candidates</span>
              </button>
            )}
            <button
              onClick={() => handleNav('assessments')}
              className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Assessment</span>
            </button>
            <button
              onClick={handleOpenAI}
              className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-100 text-brand-700 border border-slate-300 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-brand-800" />
              <span>AI Question Generator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Total Applicants</span>
            <Users className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalApplicants}</div>
          <div className="text-xs text-slate-600 mt-1">{completedCount} completed evaluations</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Average Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgScore}%</div>
          <div className="text-xs text-slate-600 mt-1">Difficulty-weighted average</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Highest Score</span>
            <Award className="w-4 h-4 text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{highScore}%</div>
          <div className="text-xs text-slate-600 mt-1">Best submission so far</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Lowest Score</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{lowScore}%</div>
          <div className="text-xs text-slate-600 mt-1">Weakest submission so far</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Avg Completion Time</span>
            <Clock className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgTimeMinutes} min</div>
          <div className="text-xs text-slate-600 mt-1">{avgTimeLimit ? `Avg. time limit ${avgTimeLimit} min` : 'No assessments yet'}</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-brand-500 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Strong Recommendations</span>
            <Sparkles className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-brand-600">{recCounts.strongly}</div>
          <div className="text-xs text-brand-700 font-medium mt-1">AI recommends an interview</div>
        </div>
      </div>

      {/* Analytics & Interview Recommendation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Score distribution</h3>
              <p className="text-xs text-slate-600">Applicant performance breakdown across your screening assessments</p>
            </div>
            <button onClick={() => handleNav('analytics')} className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center">
              <span>Open analytics</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Interview Recommendation Summary Widget */}
        <div className="bg-white text-slate-900 p-6 rounded-lg shadow-md flex flex-col justify-between border border-slate-300">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-brand-800" />
              <h3 className="text-base font-semibold text-slate-900">AI recommendations</h3>
            </div>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              When AI grading is enabled, each submission gets an advisory recommendation. Select one to filter the table below.
            </p>

            <div className="space-y-3">
              <div
                {...asButton(() => setFilterRecommendation('Strongly Recommend Interview'), { pressed: filterRecommendation === 'Strongly Recommend Interview' })}
                className="flex items-center justify-between p-3 rounded-md bg-slate-100 hover:bg-slate-100 border border-slate-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-slate-800">Strongly Recommend</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded border border-slate-300">{recCounts.strongly}</span>
              </div>

              <div
                {...asButton(() => setFilterRecommendation('Recommend Interview'), { pressed: filterRecommendation === 'Recommend Interview' })}
                className="flex items-center justify-between p-3 rounded-md bg-slate-100 hover:bg-slate-100 border border-slate-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-400" />
                  <span className="text-xs font-semibold text-slate-800">Recommend Interview</span>
                </div>
                <span className="text-xs font-bold text-brand-700 bg-white px-2.5 py-0.5 rounded border border-slate-300">{recCounts.recommend}</span>
              </div>

              <div
                {...asButton(() => setFilterRecommendation('Borderline'), { pressed: filterRecommendation === 'Borderline' })}
                className="flex items-center justify-between p-3 rounded-md bg-slate-100 hover:bg-slate-100 border border-slate-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-slate-800">Borderline Review</span>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-white px-2.5 py-0.5 rounded border border-slate-300">{recCounts.borderline}</span>
              </div>

              <div
                {...asButton(() => setFilterRecommendation('Do Not Recommend'), { pressed: filterRecommendation === 'Do Not Recommend' })}
                className="flex items-center justify-between p-3 rounded-md bg-slate-100 hover:bg-slate-100 border border-slate-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-xs font-semibold text-slate-800">Do not recommend</span>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-white px-2.5 py-0.5 rounded border border-slate-300">{recCounts.no}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setFilterRecommendation('all')}
            className="mt-6 w-full py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-100 rounded-md transition-colors border border-slate-300"
          >
            Reset Recommendation Filters
          </button>
        </div>
      </div>

      {/* Applicant Submissions Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Applicant Submissions</h3>
            <p className="text-xs text-slate-600">Select an applicant to see their answers, scores and integrity record.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
              <input aria-label="Search applicants"
                type="text"
                placeholder="Search applicant or university..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
              />
            </div>

            {/* Assessment Filter */}
            <select aria-label="Filter by assessment"
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Assessments ({profAssessmentList.length})</option>
              {profAssessmentList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title.length > 35 ? a.title.substring(0, 35) + '...' : a.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-6">Applicant Name</th>
                <th className="py-3 px-6">University & Degree</th>
                <th className="py-3 px-6">Overall Score</th>
                <th className="py-3 px-6">AI Confidence</th>
                <th className="py-3 px-6">AI Interview Recommendation</th>
                <th className="py-3 px-6">Integrity Check</th>
                <th className="py-3 px-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-600 text-sm">
                    No submissions found matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => onSelectSubmission(sub)}
                    className="hover:bg-brand-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-slate-900 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                        {sub.applicantName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 3)}
                      </div>
                      <div>
                        <span>{sub.applicantName}</span>
                        <span className="block text-xs font-normal text-slate-600">
                          {sub.applicantEmail}
                          {sub.secondaryEmail && <span className="text-slate-600"> • {sub.secondaryEmail}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700">
                      <span className="font-medium text-slate-800">{sub.university}</span>
                      <span className="block text-xs text-slate-600">{sub.degreeProgram} • GPA: {sub.gpa || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-start space-y-1">
                        <span className={`text-base font-bold ${
                          sub.overallScore >= 90 ? 'text-emerald-700' : sub.overallScore >= 80 ? 'text-brand-600' : sub.overallScore >= 70 ? 'text-amber-700' : 'text-red-600'
                        }`}>
                          {sub.overallScore}%
                        </span>
                        {sub.hireabilityLevel && (
                          <span className={`px-2 py-0.5 rounded text-xs ${getHireabilityBadgeStyle(sub.hireabilityLevel)}`}>
                            {getHireabilityShortText(sub.hireabilityLevel)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-brand-600 h-1.5 rounded-full" 
                            style={{ width: `${sub.confidenceScore}%` }} 
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600">{sub.confidenceScore}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getRecommendationBadge(sub.interviewRecommendation)}
                    </td>
                    <td className="py-4 px-6">
                      {sub.integrityReport?.integrityFlagged ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Flagged (AI estimate {sub.integrityReport.aiGeneratedProbability}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" aria-hidden /> No flags
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <button className="text-xs font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md border border-brand-200 transition-colors">
                        Review Full Report
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
