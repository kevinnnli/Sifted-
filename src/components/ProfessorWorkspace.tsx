import React, { useCallback, useEffect, useState } from 'react';
import { api, AssessmentInput, errorMessage, ReviewPatch } from '../api';
import {
  ApplicantSubmission,
  Assessment,
  ProfessorProfile,
  ProfessorWorkspaceData,
  Question,
  UserAccount,
} from '../types';
import { Navbar } from './Navbar';
import { ProfessorDashboard } from './ProfessorDashboard';
import { AssessmentBuilder } from './AssessmentBuilder';
import { QuestionBank } from './QuestionBank';
import { ApplicantManagement } from './ApplicantManagement';
import { IndividualApplicantReview } from './IndividualApplicantReview';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { SettingsPanel } from './SettingsPanel';
import { AssignAssessmentModal, AssignInput } from './AssignAssessmentModal';

type ProfessorTab = 'dashboard' | 'assessments' | 'questions' | 'applicants' | 'analytics' | 'settings';

interface ProfessorWorkspaceProps {
  user: UserAccount;
  aiConfigured: boolean | null;
  onSignOut: () => void;
  onUserUpdated: (user: UserAccount) => void;
}

const toAssessmentInput = (assessment: Assessment): AssessmentInput => ({
  title: assessment.title,
  description: assessment.description,
  researchGroup: assessment.researchGroup,
  semester: assessment.semester,
  timeLimitMinutes: assessment.timeLimitMinutes,
  isAdaptive: assessment.isAdaptive,
  isScoreVisible: assessment.isScoreVisible,
  integrityOptions: assessment.integrityOptions,
  questionIds: assessment.questionIds,
  isPublished: assessment.isActive !== false,
});

export const ProfessorWorkspace: React.FC<ProfessorWorkspaceProps> = ({ user, aiConfigured, onSignOut, onUserUpdated }) => {
  const [data, setData] = useState<ProfessorWorkspaceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfessorTab>('dashboard');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [showAIGeneratorOnOpen, setShowAIGeneratorOnOpen] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAssessmentId, setAssignAssessmentId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setData(await api.professor.workspace());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-sm text-slate-600">
        {loadError ? (
          <>
            <span className="font-semibold text-rose-700">{loadError}</span>
            <button onClick={load} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-bold">
              Try Again
            </button>
          </>
        ) : (
          <span className="font-semibold">Loading your workspace…</span>
        )}
      </div>
    );
  }

  const { professor, assessments, questions, submissions } = data;
  const selectedSubmission = selectedSubmissionId ? submissions.find((s) => s.id === selectedSubmissionId) || null : null;

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

  // The server assigns ids to new records; callers get the saved copy back (or null on failure)
  const handleSaveAssessment = async (assessment: Assessment): Promise<Assessment | null> => {
    try {
      const isNew = !assessments.some((a) => a.id === assessment.id);
      const { assessment: saved } = isNew
        ? await api.professor.createAssessment(toAssessmentInput(assessment))
        : await api.professor.updateAssessment(assessment.id, toAssessmentInput(assessment));
      setData((prev) => prev && { ...prev, assessments: upsert(prev.assessments, saved) });
      return saved;
    } catch (e) {
      alert(`Could not save the assessment: ${errorMessage(e)}`);
      return null;
    }
  };

  const handleSaveQuestion = async (question: Question): Promise<Question | null> => {
    try {
      const isOwnExisting = questions.some((q) => q.id === question.id && q.professorId === professor.id);
      const { question: saved } = isOwnExisting
        ? await api.professor.updateQuestion(question.id, question)
        : await api.professor.createQuestion(question);
      setData((prev) => prev && { ...prev, questions: upsert(prev.questions, saved) });
      return saved;
    } catch (e) {
      alert(`Could not save the question: ${errorMessage(e)}`);
      return null;
    }
  };

  const handleReviewSubmission = async (submissionId: string, patch: ReviewPatch): Promise<ApplicantSubmission | null> => {
    try {
      const { submission } = await api.professor.reviewSubmission(submissionId, patch);
      setData((prev) => prev && { ...prev, submissions: upsert(prev.submissions, submission) });
      return submission;
    } catch (e) {
      alert(`Could not save: ${errorMessage(e)}`);
      return null;
    }
  };

  const handleRemoveSubmission = async (submissionId: string) => {
    try {
      await api.professor.deleteSubmission(submissionId);
      setData((prev) => prev && { ...prev, submissions: prev.submissions.filter((s) => s.id !== submissionId) });
      if (selectedSubmissionId === submissionId) setSelectedSubmissionId(null);
    } catch (e) {
      alert(`Could not remove the submission: ${errorMessage(e)}`);
    }
  };

  const handleAssign = async (input: AssignInput) => {
    const result = await api.professor.invite(input);
    await load();
    return result;
  };

  const handleUpdateProfessor = async (updated: ProfessorProfile): Promise<boolean> => {
    try {
      const { professor: saved } = await api.professor.updateProfile({
        labName: updated.labName,
        email: updated.email,
        aiSensitivity: updated.aiSensitivity || 'medium',
        allowLateSubmissions: Boolean(updated.allowLateSubmissions),
      });
      setData((prev) => prev && { ...prev, professor: saved });
      onUserUpdated({ ...user, labName: saved.labName });
      return true;
    } catch (e) {
      alert(`Could not save settings: ${errorMessage(e)}`);
      return false;
    }
  };

  const openAssignModal = (assessmentId?: string) => {
    setAssignAssessmentId(assessmentId);
    setShowAssignModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar
        currentProfessor={professor}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedSubmissionId(null);
          setShowAIGeneratorOnOpen(false);
        }}
        onSignOut={onSignOut}
        currentUserAccount={user}
        onOpenAccount={() => {
          setActiveTab('settings');
          setSelectedSubmissionId(null);
        }}
        onOpenAssignModal={() => openAssignModal()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedSubmission ? (
          <IndividualApplicantReview
            key={selectedSubmission.id}
            submission={selectedSubmission}
            questions={questions}
            onBack={() => setSelectedSubmissionId(null)}
            onReviewSubmission={handleReviewSubmission}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <ProfessorDashboard
                currentProfessor={professor}
                assessments={assessments}
                submissions={submissions}
                onNavigateToTab={(tab) => setActiveTab(tab as ProfessorTab)}
                onNavigateToAssessments={() => setActiveTab('assessments')}
                onNavigateToQuestionBank={() => setActiveTab('questions')}
                onOpenAIQuestionGenerator={() => {
                  setShowAIGeneratorOnOpen(true);
                  setActiveTab('assessments');
                }}
                onSelectSubmission={(sub) => setSelectedSubmissionId(sub.id)}
                onOpenAssignModal={() => openAssignModal()}
              />
            )}

            {activeTab === 'assessments' && (
              <AssessmentBuilder
                key={professor.id}
                currentProfessor={professor}
                assessments={assessments}
                questionBank={questions}
                onSaveAssessment={handleSaveAssessment}
                onAddQuestionToBank={handleSaveQuestion}
                showAIGeneratorOnOpen={showAIGeneratorOnOpen}
                onCloseAIGenerator={() => setShowAIGeneratorOnOpen(false)}
                onOpenAssignModal={openAssignModal}
              />
            )}

            {activeTab === 'questions' && (
              <QuestionBank
                currentProfessor={professor}
                questionBank={questions}
                onAddQuestionToBank={handleSaveQuestion}
                onOpenAIGenerator={() => {
                  setShowAIGeneratorOnOpen(true);
                  setActiveTab('assessments');
                }}
              />
            )}

            {activeTab === 'applicants' && (
              <ApplicantManagement
                currentProfessor={professor}
                submissions={submissions}
                assessments={assessments}
                onSelectSubmission={(sub) => setSelectedSubmissionId(sub.id)}
                onReviewSubmission={handleReviewSubmission}
                onRemoveSubmission={handleRemoveSubmission}
                onOpenAssignModal={() => openAssignModal()}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard currentProfessor={professor} assessments={assessments} submissions={submissions} questionBank={questions} />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                key={professor.id}
                currentProfessor={professor}
                onUpdateProfessor={handleUpdateProfessor}
                aiConfigured={aiConfigured}
                onPasswordChanged={onUserUpdated}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">Sifted</span>
            <span>• Graduate Admissions & Faculty Screening System</span>
          </div>
          <div className="flex items-center space-x-4">
            {aiConfigured === null ? (
              <span className="text-slate-400 font-semibold">Checking AI status…</span>
            ) : aiConfigured ? (
              <span className="text-emerald-600 font-semibold">Gemini AI connected (server-side)</span>
            ) : (
              <span className="text-amber-600 font-semibold">AI not configured — using built-in grading</span>
            )}
          </div>
        </div>
      </footer>

      {showAssignModal && (
        <AssignAssessmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          assessments={assessments}
          candidates={data.candidates}
          invitations={data.invitations}
          onAssign={handleAssign}
          preselectedAssessmentId={assignAssessmentId}
        />
      )}
    </div>
  );
};
