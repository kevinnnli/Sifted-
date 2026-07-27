import React, { useState } from 'react';
import { Users, Search, Filter, Award, CheckCircle2, AlertTriangle, ShieldAlert, ArrowUpDown, FileText, Download, Mail, Send, MoreVertical, Eye, User, Calendar, X, Check, Clock, GraduationCap, Building2, Video, Trash2 } from 'lucide-react';
import { ApplicantSubmission, Assessment, ProfessorProfile, InterviewRecommendation } from '../types';
import { getHireabilityBadgeStyle, getHireabilityShortText } from '../utils/grading';

interface ApplicantManagementProps {
  currentProfessor: ProfessorProfile;
  submissions: ApplicantSubmission[];
  assessments: Assessment[];
  onSelectSubmission: (submission: ApplicantSubmission) => void;
  onUpdateSubmission?: (submission: ApplicantSubmission) => void;
  onOpenAssignModal?: () => void;
  onRemoveSubmission?: (submissionId: string) => void;
}

export const ApplicantManagement: React.FC<ApplicantManagementProps> = ({
  currentProfessor,
  submissions,
  assessments,
  onSelectSubmission,
  onUpdateSubmission,
  onOpenAssignModal,
  onRemoveSubmission,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRec, setSelectedRec] = useState('all');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'time' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [profileModalSub, setProfileModalSub] = useState<ApplicantSubmission | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [schedulingSub, setSchedulingSub] = useState<ApplicantSubmission | null>(null);
  const [meetingDate, setMeetingDate] = useState<string>('');
  const [meetingTime, setMeetingTime] = useState<string>('10:00 AM EST');
  const [meetingLink, setMeetingLink] = useState<string>('https://meet.google.com/faculty-research-interview');

  const profAssessmentIds = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id).map((a) => a.id);
  const relevantSubmissions = submissions.filter((s) => profAssessmentIds.includes(s.assessmentId));

  const filteredSubmissions = relevantSubmissions
    .filter((sub) => {
      const matchesSearch =
        sub.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.applicantEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRec = selectedRec === 'all' || sub.interviewRecommendation === selectedRec;
      const matchesAssessment = selectedAssessmentId === 'all' || sub.assessmentId === selectedAssessmentId;
      return matchesSearch && matchesRec && matchesAssessment;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') comparison = a.overallScore - b.overallScore;
      if (sortBy === 'time') comparison = a.totalTimeSpentSeconds - b.totalTimeSpentSeconds;
      if (sortBy === 'name') comparison = a.applicantName.localeCompare(b.applicantName);
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const getRecommendationBadge = (rec: InterviewRecommendation) => {
    switch (rec) {
      case 'Strongly Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-emerald-100 text-emerald-700"><Award className="w-3.5 h-3.5 mr-1" /> Strongly Recommend</span>;
      case 'Recommend Interview':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-indigo-100 text-indigo-700"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Recommend</span>;
      case 'Borderline':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-amber-100 text-amber-700"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Borderline Review</span>;
      case 'Do Not Recommend':
        return <span className="inline-flex items-center px-2 py-1 rounded uppercase text-[10px] font-bold bg-rose-100 text-rose-700"><ShieldAlert className="w-3.5 h-3.5 mr-1" /> Do Not Recommend</span>;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Applicant Screening & Admissions Management</h2>
            <p className="text-xs text-slate-500">
              Review completed screening tests, AI interview recommendations, and academic integrity profiles
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenAssignModal && (
            <button 
              onClick={onOpenAssignModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Assign Test to Accounts</span>
            </button>
          )}
          <button 
            onClick={() => alert("Simulating invitation link copy... The shareable link has been copied to clipboard!")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-xs font-medium shadow-sm shadow-indigo-200 flex items-center space-x-1.5 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Copy General Link</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search candidate name, email, or university..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedRec}
              onChange={(e) => setSelectedRec(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All AI Recommendations</option>
              <option value="Strongly Recommend Interview">Strongly Recommend Interview</option>
              <option value="Recommend Interview">Recommend Interview</option>
              <option value="Borderline">Borderline</option>
              <option value="Do Not Recommend">Do Not Recommend</option>
            </select>

            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
            >
              <option value="all">All Assessments ({assessments.filter(a => !a.professorId || a.professorId === currentProfessor.id).length})</option>
              {assessments
                .filter((a) => !a.professorId || a.professorId === currentProfessor.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>

            <button
              onClick={() => {
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-xs font-semibold flex items-center space-x-1 border border-slate-300 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort: {sortBy.toUpperCase()} ({sortOrder})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-6 cursor-pointer hover:bg-slate-100" onClick={() => setSortBy('name')}>
                  Applicant Profile
                </th>
                <th className="py-3 px-6">University & Degree</th>
                <th className="py-3 px-6 cursor-pointer hover:bg-slate-100" onClick={() => setSortBy('score')}>
                  Overall Score ↕
                </th>
                <th className="py-3 px-6 cursor-pointer hover:bg-slate-100" onClick={() => setSortBy('time')}>
                  Time Spent ↕
                </th>
                <th className="py-3 px-6">AI Recommendation</th>
                <th className="py-3 px-6">Integrity Check</th>
                <th className="py-3 px-6">Professor Status</th>
                <th className="py-3 px-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    No applicant submissions found matching your criteria.
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
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                        {sub.applicantName.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{sub.applicantName}</span>
                        <span className="block text-xs font-normal text-slate-500">{sub.applicantEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700">
                      <span className="font-semibold text-slate-800 block">{sub.university}</span>
                      <span className="text-xs text-slate-500 block">{sub.degreeProgram} • GPA: {sub.gpa}</span>
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
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      {Math.round(sub.totalTimeSpentSeconds / 60)} min
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
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          sub.professorDecision === 'Interview' ? 'bg-emerald-600 text-white' :
                          sub.professorDecision === 'Reject' ? 'bg-rose-600 text-white' :
                          sub.professorDecision === 'Pending' || sub.professorDecision === 'Pending Professor Interview' || sub.professorDecision === 'Pending Professor Interview / Review' || sub.professorDecision === 'Hold for Review' || !sub.professorDecision ? 'bg-amber-500 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {sub.professorDecision === 'Interview' ? 'Accepted (Interview)' : sub.professorDecision || 'Pending'}
                        </span>
                        {sub.professorDecision === 'Interview' && sub.applicantResponseToInterview && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            sub.applicantResponseToInterview === 'Accepted'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : sub.applicantResponseToInterview === 'Declined'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            RSVP: {sub.applicantResponseToInterview} {sub.applicantResponseToInterview === 'Accepted' ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 relative" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSelectSubmission(sub)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md border border-indigo-200 transition-colors"
                        >
                          Review Report
                        </button>
                        <button
                          onClick={() => {
                            const defaultDate = sub.interviewDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
                            setMeetingDate(defaultDate);
                            setMeetingTime(sub.interviewTime || '10:00 AM EST');
                            setMeetingLink(sub.meetingLink || 'https://meet.google.com/faculty-research-interview');
                            setSchedulingSub(sub);
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md border border-emerald-300 transition-colors flex items-center space-x-1"
                          title="Schedule Interview with Candidate"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Interview</span>
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === sub.id ? null : sub.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors border border-transparent hover:border-slate-300"
                            title="More actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activeMenuId === sub.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-left">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onSelectSubmission(sub);
                                }}
                                className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center space-x-2 font-medium"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View Student Details</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setProfileModalSub(sub);
                                }}
                                className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center space-x-2 font-medium"
                              >
                                <User className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Profile</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  const defaultDate = sub.interviewDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
                                  setMeetingDate(defaultDate);
                                  setMeetingTime(sub.interviewTime || '10:00 AM EST');
                                  setMeetingLink(sub.meetingLink || 'https://meet.google.com/faculty-research-interview');
                                  setSchedulingSub(sub);
                                }}
                                className="w-full px-4 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 font-bold"
                              >
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Schedule Interview</span>
                              </button>
                              {onRemoveSubmission && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    onRemoveSubmission(sub.id);
                                    setNotification(`Removed ${sub.applicantName} from applicant pool.`);
                                    setTimeout(() => setNotification(null), 3500);
                                  }}
                                  className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 font-medium border-t border-slate-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Remove from Pool</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl border border-emerald-500 flex items-center space-x-3 z-50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Assign Interview Meeting Modal (Professor Sets Date) */}
      {schedulingSub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setSchedulingSub(null)}>
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-800 to-slate-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/30 border border-emerald-400 text-white font-bold flex items-center justify-center text-base shrink-0">
                  <Calendar className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Set Interview Meeting Date</h3>
                  <p className="text-xs text-emerald-200">Mark student Accepted & assign meeting schedule</p>
                </div>
              </div>
              <button onClick={() => setSchedulingSub(null)} className="text-emerald-200 hover:text-white font-bold text-lg">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                You are marking <strong>{schedulingSub.applicantName}</strong> for an interview. Their status will change to <strong>Accepted</strong>. Please select the mandatory meeting date and time slot below:
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center">
                      <Video className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Meeting Video Link *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.random().toString(36).substring(2, 6);
                        setMeetingLink(`https://meet.google.com/phd-lab-${rand}`);
                      }}
                      className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded transition-colors"
                    >
                      ⚡ Auto-Generate Link
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="https://meet.google.com/..."
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Meeting Date *</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time Slot *</label>
                  <select
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                onClick={() => setSchedulingSub(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onUpdateSubmission) {
                    const chosenDate = meetingDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
                    const chosenLink = meetingLink || 'https://meet.google.com/faculty-research-interview';
                    const updated = {
                      ...schedulingSub,
                      professorDecision: 'Interview' as const,
                      interviewDate: chosenDate,
                      interviewTime: meetingTime,
                      meetingLink: chosenLink,
                      meetingConfirmed: true,
                    };
                    onUpdateSubmission(updated);
                    setNotification(`Status set to Accepted! Interview scheduled for ${schedulingSub.applicantName} on ${chosenDate} at ${meetingTime} with video link.`);
                    setTimeout(() => setNotification(null), 5000);
                  }
                  setSchedulingSub(null);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Set Accepted Status & Save Date 🎉</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {profileModalSub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div id="student-profile-modal" className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/30 border-2 border-indigo-400 text-white font-bold flex items-center justify-center text-lg">
                  {profileModalSub.applicantName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{profileModalSub.applicantName}</h3>
                  <p className="text-xs text-indigo-200">{profileModalSub.applicantEmail}</p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalSub(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">University</span>
                  <span className="text-sm font-bold text-slate-900 flex items-center mt-1">
                    <Building2 className="w-4 h-4 mr-1.5 text-indigo-600" />
                    {profileModalSub.university}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree & GPA</span>
                  <span className="text-sm font-bold text-slate-900 flex items-center mt-1">
                    <GraduationCap className="w-4 h-4 mr-1.5 text-indigo-600" />
                    {profileModalSub.degreeProgram} (GPA: {profileModalSub.gpa || 'N/A'})
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Assessment Performance</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-center">
                    <span className="text-xs text-slate-500 block">Overall Score</span>
                    <span className="text-lg font-extrabold text-indigo-600 mt-0.5 block">{profileModalSub.overallScore}%</span>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-center">
                    <span className="text-xs text-slate-500 block">Time Taken</span>
                    <span className="text-lg font-extrabold text-indigo-600 mt-0.5 block">{Math.round(profileModalSub.totalTimeSpentSeconds / 60)} min</span>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-center">
                    <span className="text-xs text-slate-500 block">AI Confidence</span>
                    <span className="text-lg font-extrabold text-indigo-600 mt-0.5 block">{profileModalSub.confidenceScore}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Topic Proficiency Breakdown</h4>
                <div className="space-y-2">
                  {Object.entries(profileModalSub.topicBreakdown || {}).map(([topic, data]: [string, any]) => (
                    <div key={topic} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded border border-slate-200">
                      <span className="font-semibold text-slate-700">{topic}</span>
                      <span className="font-bold text-slate-900">{data.scored} / {data.total} pts ({Math.round(data.percentage)}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {profileModalSub.aiSummary && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">AI Qualitative Summary</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{profileModalSub.aiSummary}</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => setProfileModalSub(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors"
              >
                Close Profile
              </button>
              <button
                onClick={() => {
                  setProfileModalSub(null);
                  onSelectSubmission(profileModalSub);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Open Full Evaluation Report →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
