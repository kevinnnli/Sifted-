import React from 'react';
import { BarChart3, TrendingUp, Clock, Users, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Assessment, ApplicantSubmission, ProfessorProfile } from '../types';

interface AnalyticsDashboardProps {
  currentProfessor: ProfessorProfile;
  assessments: Assessment[];
  submissions: ApplicantSubmission[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  currentProfessor,
  assessments,
  submissions,
}) => {
  const profAssessmentIds = assessments.filter((a) => a.professorId === currentProfessor.id).map((a) => a.id);
  const relevantSubmissions = submissions.filter((s) => profAssessmentIds.includes(s.assessmentId));

  // Average time per question chart
  const timePerQuestionData = [
    { question: 'Q1: Attention Complexity (MC)', timeSeconds: 110, avgMinutes: 1.8 },
    { question: 'Q2: SVD Spectral Norm (Math)', timeSeconds: 460, avgMinutes: 7.7 },
    { question: 'Q3: Ridge GD (Python)', timeSeconds: 850, avgMinutes: 14.2 },
    { question: 'Q4: Training Loss Overfit (Res)', timeSeconds: 680, avgMinutes: 11.3 },
    { question: 'Q5: PAC VC Dim (Short Ans)', timeSeconds: 380, avgMinutes: 6.3 },
    { question: 'Q6: Sub-Quad Attention (Essay)', timeSeconds: 815, avgMinutes: 13.6 },
  ];

  // Subject performance averages
  const subjectAverages = [
    { subject: 'Machine Learning', score: 80, fullMark: 100 },
    { subject: 'Linear Algebra', score: 86, fullMark: 100 },
    { subject: 'Algorithms & Code', score: 91, fullMark: 100 },
    { subject: 'Research Methods', score: 79, fullMark: 100 },
    { subject: 'Statistics & Prob', score: 93, fullMark: 100 },
    { subject: 'Systems & Math', score: 84, fullMark: 100 },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Professor Screening Analytics & Insights</h2>
            <p className="text-xs text-slate-500">
              Aggregated metrics, topic difficulties, and time expenditure across your screening assessments
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <span className="bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
            {relevantSubmissions.length} Submissions Analyzed
          </span>
        </div>
      </div>

      {/* Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Chart: Topic Proficiency */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Average Topic Proficiency Radar</h3>
            <p className="text-xs text-slate-500">Identifies research disciplines where applicant cohort excels or struggles</p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subjectAverages}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Radar
                  name="Avg Applicant Score"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.35}
                />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Time Spent Per Question */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Average Time Spent per Screening Question</h3>
            <p className="text-xs text-slate-500">Identifies time-consuming bottlenecks and programming challenge duration</p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={timePerQuestionData} margin={{ top: 10, right: 30, left: 120, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" unit=" min" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis type="category" dataKey="question" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11 }} width={120} />
                <Tooltip 
                  formatter={(value: any) => [`${value} minutes`, 'Avg Duration']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }} 
                />
                <Bar dataKey="avgMinutes" fill="#3B82F6" radius={[0, 6, 6, 0]} barSize={24}>
                  {timePerQuestionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.avgMinutes > 13 ? '#8B5CF6' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interview Invitation Rate</span>
            <span className="text-2xl font-bold text-slate-900 block mt-0.5">62.5%</span>
            <span className="text-[11px] text-emerald-600 font-medium">5 of 8 candidates recommended</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Exam Completion Time</span>
            <span className="text-2xl font-bold text-slate-900 block mt-0.5">54.2 min</span>
            <span className="text-[11px] text-slate-500">Within 60 min time limit</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-md bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Integrity Cheating Flags</span>
            <span className="text-2xl font-bold text-red-600 block mt-0.5">1 candidate</span>
            <span className="text-[11px] text-red-600 font-medium">12.5% flagged for AI/tab switching</span>
          </div>
        </div>
      </div>
    </div>
  );
};
