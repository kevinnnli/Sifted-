import React, { useState } from 'react';
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
  onOpenCandidatePortal?: () => void;
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
  onOpenCandidatePortal,
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
  const profAssessmentIds = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id).map((a) => a.id);
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
    { range: '80-89%', count: relevantSubmissions.filter((s) => s.overallScore >= 80 && s.overallScore < 90).length, color: '#3B82F6' },
    { range: '70-79%', count: relevantSubmissions.filter((s) => s.overallScore >= 70 && s.overallScore < 80).length, color: '#F59E0B' },
    { range: '< 70%', count: relevantSubmissions.filter((s) => s.overallScore < 70).length, color: '#EF4444' },
  ];

  const getRecommendationBadge = (rec: InterviewRecommendation) => {
    switch (rec) {
      case 'Strongly Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-emerald-100 text-emerald-700"><Award className="w-3 h-3 mr-1" /> Strongly Recommend</span>;
      case 'Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-indigo-100 text-indigo-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Recommend</span>;
      case 'Borderline':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" /> Borderline</span>;
      case 'Do Not Recommend':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-rose-100 text-rose-700"><ShieldAlert className="w-3 h-3 mr-1" /> Do Not Recommend</span>;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner & Quick Actions */}
      <div className="bg-[#0F172A] rounded-lg p-6 md:p-8 text-white shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-indigo-600/10 px-3 py-1 rounded border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span>AI Admissions Screening Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Welcome back, {currentProfessor.name}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              {currentProfessor.labName} • {currentProfessor.department}. You have <span className="text-white font-semibold">{totalApplicants} applicant submissions</span> across your active graduate screening assessments.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {onOpenAssignModal && (
              <button
                onClick={onOpenAssignModal}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Assign Test to Candidates</span>
              </button>
            )}
            <button
              onClick={() => handleNav('assessments')}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm shadow-indigo-200 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Assessment</span>
            </button>
            <button
              onClick={handleOpenAI}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>AI Question Generator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Total Applicants</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalApplicants}</div>
          <div className="text-[11px] text-slate-500 mt-1">{completedCount} completed evaluations</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Average Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgScore}%</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">+4.2% vs last semester</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Highest Score</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{highScore}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Top 1% candidate tier</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Lowest Score</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{lowScore}%</div>
          <div className="text-[11px] text-rose-500 mt-1">Needs foundation review</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Avg Completion Time</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgTimeMinutes} min</div>
          <div className="text-[11px] text-slate-500 mt-1">Within 60 min time limit</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Strong Recommendations</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">{recCounts.strongly}</div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Ready for campus interview</div>
        </div>
      </div>

      {/* Analytics & Interview Recommendation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Score Distribution Histogram</h3>
              <p className="text-xs text-slate-500">Applicant performance breakdown across your screening assessments</p>
            </div>
            <button onClick={() => handleNav('analytics')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center">
              <span>View Deep Analytics</span>
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
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
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
        <div className="bg-[#1E293B] text-white p-6 rounded-lg shadow-md flex flex-col justify-between border border-slate-700">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-sm tracking-wide uppercase text-white">AI Interview Recommendations</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Gemini evaluates technical accuracy, mathematical rigor, and coding test case efficiency to generate written interview guidance.
            </p>

            <div className="space-y-3">
              <div 
                onClick={() => { setFilterRecommendation('Strongly Recommend Interview'); }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Strongly Recommend</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">{recCounts.strongly}</span>
              </div>

              <div 
                onClick={() => { setFilterRecommendation('Recommend Interview'); }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span className="text-xs font-semibold text-slate-200">Recommend Interview</span>
                </div>
                <span className="text-xs font-bold text-indigo-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">{recCounts.recommend}</span>
              </div>

              <div 
                onClick={() => { setFilterRecommendation('Borderline'); }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">Borderline Review</span>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">{recCounts.borderline}</span>
              </div>

              <div 
                onClick={() => { setFilterRecommendation('Do Not Recommend'); }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-xs font-semibold text-slate-200">Do Not Recommend / Cheating Alert</span>
                </div>
                <span className="text-xs font-bold text-rose-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">{recCounts.no}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setFilterRecommendation('all')}
            className="mt-6 w-full py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700"
          >
            Reset Recommendation Filters
          </button>
        </div>
      </div>

      {/* Applicant Submissions Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Completed Applicant Submissions</h3>
            <p className="text-xs text-slate-500">Click any applicant to inspect full AI grading rubrics, integrity checks, and written interview explanations.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search applicant or university..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              />
            </div>

            {/* Assessment Filter */}
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Assessments ({assessments.filter(a => !a.professorId || a.professorId === currentProfessor.id).length})</option>
              {assessments
                .filter((a) => !a.professorId || a.professorId === currentProfessor.id)
                .map((a) => (
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
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
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
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                    No submissions found matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => onSelectSubmission(sub)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-slate-900 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {sub.applicantName.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <span>{sub.applicantName}</span>
                        <span className="block text-[11px] font-normal text-slate-500">
                          {sub.applicantEmail}
                          {sub.secondaryEmail && <span className="text-slate-400"> • {sub.secondaryEmail}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700">
                      <span className="font-medium text-slate-800">{sub.university}</span>
                      <span className="block text-xs text-slate-500">{sub.degreeProgram} • GPA: {sub.gpa || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-start space-y-1">
                        <span className={`text-base font-bold ${
                          sub.overallScore >= 90 ? 'text-emerald-600' : sub.overallScore >= 80 ? 'text-blue-600' : sub.overallScore >= 70 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {sub.overallScore}%
                        </span>
                        {sub.hireabilityLevel && (
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getHireabilityBadgeStyle(sub.hireabilityLevel)}`}>
                            {getHireabilityShortText(sub.hireabilityLevel)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-1.5 rounded-full" 
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
                      {sub.integrityReport.integrityFlagged ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Flagged ({sub.integrityReport.aiGeneratedProbability}% AI)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Clean Session
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md border border-indigo-200 transition-colors">
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
