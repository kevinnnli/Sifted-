/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ProfessorDashboard } from './components/ProfessorDashboard';
import { AssessmentBuilder } from './components/AssessmentBuilder';
import { QuestionBank } from './components/QuestionBank';
import { ApplicantManagement } from './components/ApplicantManagement';
import { IndividualApplicantReview } from './components/IndividualApplicantReview';
import { ApplicantPortal } from './components/ApplicantPortal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsPanel } from './components/SettingsPanel';

import { AuthModal } from './components/AuthModal';
import { AssignAssessmentModal } from './components/AssignAssessmentModal';
import { LandingPage } from './components/LandingPage';
import { AdminPortal } from './components/AdminPortal';

import { MOCK_PROFESSORS, MOCK_ASSESSMENTS, MOCK_QUESTIONS, MOCK_SUBMISSIONS, MOCK_USER_ACCOUNTS, MOCK_INVITATIONS } from './data/mockData';
import { Assessment, Question, ApplicantSubmission, ProfessorProfile, UserAccount, AssessmentInvitation, ActiveRole } from './types';

export default function App() {
  // Application Data State
  const [professors, setProfessors] = useState<ProfessorProfile[]>(MOCK_PROFESSORS);
  const [currentProfId, setCurrentProfId] = useState<string>(MOCK_PROFESSORS[0]?.id || 'prof-1');
  const [assessments, setAssessments] = useState<Assessment[]>(MOCK_ASSESSMENTS);
  const [questionBank, setQuestionBank] = useState<Question[]>(MOCK_QUESTIONS);
  const [submissions, setSubmissions] = useState<ApplicantSubmission[]>(MOCK_SUBMISSIONS);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>(MOCK_USER_ACCOUNTS);
  const [invitations, setInvitations] = useState<AssessmentInvitation[]>(MOCK_INVITATIONS);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assessments' | 'questions' | 'applicants' | 'analytics' | 'settings'>('dashboard');
  const [selectedSubmission, setSelectedSubmission] = useState<ApplicantSubmission | null>(null);
  const [activeRole, setActiveRole] = useState<ActiveRole>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'lockdown' || params.get('lockdown') === 'true' || params.get('role') === 'applicant') {
      return 'applicant-portal';
    }
    return 'landing';
  });
  const [showAIGeneratorOnOpen, setShowAIGeneratorOnOpen] = useState<boolean>(false);

  // Account & Modals State
  const [currentAccount, setCurrentAccount] = useState<UserAccount>(MOCK_USER_ACCOUNTS[0]);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignAssessmentId, setAssignAssessmentId] = useState<string | undefined>(undefined);

  // Load persistent backend data on boot
  useEffect(() => {
    fetch('/api/data')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success) {
          if (data.professors) setProfessors(data.professors);
          if (data.assessments) setAssessments(data.assessments);
          if (data.questionBank) setQuestionBank(data.questionBank);
          if (data.submissions) setSubmissions(data.submissions);
          if (data.userAccounts) setUserAccounts(data.userAccounts);
          if (data.invitations) setInvitations(data.invitations);
        }
      })
      .catch((err) => console.log('Using fallback local state:', err));
  }, []);

  const currentProfessor = professors.find((p) => p.id === currentProfId) || professors[0];

  // Handler for saving/updating assessment
  const handleSaveAssessment = (newAssessment: Assessment) => {
    setAssessments((prev) => {
      const idx = prev.findIndex((a) => a.id === newAssessment.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newAssessment;
        return copy;
      }
      return [newAssessment, ...prev];
    });
    fetch('/api/data/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment: newAssessment }),
    }).catch(console.error);
  };

  // Handler for adding or updating a question in bank
  const handleAddQuestionToBank = (newQuestion: Question) => {
    setQuestionBank((prev) => {
      const idx = prev.findIndex((q) => q.id === newQuestion.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newQuestion;
        return copy;
      }
      return [newQuestion, ...prev];
    });
    fetch('/api/data/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: newQuestion }),
    }).catch(console.error);
  };

  // Handler for updating a submission (e.g. professor decision or notes)
  const handleUpdateSubmission = (updated: ApplicantSubmission) => {
    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (selectedSubmission?.id === updated.id) {
      setSelectedSubmission(updated);
    }
    fetch('/api/data/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission: updated }),
    }).catch(console.error);
  };

  // Handler for completing assessment from Applicant Portal
  const handleCompleteAssessment = (newSubmission: ApplicantSubmission) => {
    setSubmissions((prev) => [newSubmission, ...prev]);
    fetch('/api/data/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission: newSubmission }),
    }).catch(console.error);
  };

  const handleRemoveSubmission = (submissionId: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    fetch(`/api/data/submissions/${submissionId}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleSwitchAccount = (account: UserAccount) => {
    setCurrentAccount(account);
    if (account.role === 'admin') {
      setActiveRole('admin-portal');
    } else if (account.role === 'professor' && account.professorId) {
      setCurrentProfId(account.professorId);
      setActiveRole('professor');
    } else if (account.role === 'applicant') {
      setActiveRole('applicant-portal');
    }
  };

  const handleCreateAccount = (newAcc: UserAccount) => {
    setUserAccounts((prev) => [newAcc, ...prev]);
    setCurrentAccount(newAcc);
    if (newAcc.role === 'admin') {
      setActiveRole('admin-portal');
    } else if (newAcc.role === 'professor' && newAcc.professorId) {
      setCurrentProfId(newAcc.professorId);
      setActiveRole('professor');
    } else {
      setActiveRole('applicant-portal');
    }
    fetch('/api/data/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: newAcc }),
    }).catch(console.error);
  };

  const handleCreateProfessorAccount = (newProfAcc: UserAccount, newProfProfile: ProfessorProfile) => {
    setUserAccounts((prev) => [newProfAcc, ...prev]);
    setProfessors((prev) => [newProfProfile, ...prev]);
    fetch('/api/data/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: newProfAcc }),
    }).catch(console.error);
    fetch('/api/data/professors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professor: newProfProfile }),
    }).catch(console.error);
  };

  const handleAssignAssessment = (inv: AssessmentInvitation) => {
    setInvitations((prev) => [inv, ...prev]);
    fetch('/api/data/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation: inv }),
    }).catch(console.error);
  };

  const handleUpdateInvitationStatus = (id: string, status: 'pending' | 'in-progress' | 'completed') => {
    setInvitations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status } : i))
    );
    const updated = invitations.find((i) => i.id === id);
    if (updated) {
      fetch('/api/data/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation: { ...updated, status } }),
      }).catch(console.error);
    }
  };

  const handleAssignDemoTest = (email: string) => {
    const defaultAssessment = assessments[0] || MOCK_ASSESSMENTS[0];
    const newInv: AssessmentInvitation = {
      id: `inv-${Date.now()}`,
      assessmentId: defaultAssessment?.id || 'as-ai-phd-2026',
      professorId: currentProfId,
      applicantEmail: email,
      assignedAt: new Date().toISOString().split('T')[0],
      deadline: '2026-08-15',
      status: 'pending',
      notes: 'Demo invitation automatically assigned for testing and verification purposes.',
    };
    handleAssignAssessment(newInv);
  };

  // If Landing Page is active, render Landing Page
  if (activeRole === 'landing') {
    return (
      <>
        <LandingPage
          accounts={userAccounts}
          onSelectAccount={handleSwitchAccount}
          onCreateStudentAccount={handleCreateAccount}
          assessmentsCount={assessments.length}
          questionsCount={questionBank.length}
          submissionsCount={submissions.length}
        />
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            currentAccount={currentAccount}
            accounts={userAccounts}
            onSelectAccount={handleSwitchAccount}
            onCreateAccount={handleCreateAccount}
          />
        )}
      </>
    );
  }

  // If Admin Portal is active, render Admin Portal
  if (activeRole === 'admin-portal') {
    return (
      <>
        <AdminPortal
          currentAccount={currentAccount}
          accounts={userAccounts}
          professors={professors}
          onCreateProfessor={handleCreateProfessorAccount}
          onSwitchAccount={handleSwitchAccount}
          onExitToLanding={() => setActiveRole('landing')}
        />
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            currentAccount={currentAccount}
            accounts={userAccounts}
            onSelectAccount={handleSwitchAccount}
            onCreateAccount={handleCreateAccount}
          />
        )}
      </>
    );
  }

  // If Candidate Portal is active, render full screen portal
  if (activeRole === 'applicant-portal') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 relative">
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">
              Isolated Student Portal: <strong className="text-white">{currentAccount.name}</strong> ({currentAccount.email})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveRole('landing')}
              className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              ← Home / Landing
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg border border-indigo-500/30 transition-colors"
            >
              Switch Account
            </button>
          </div>
        </div>
        <ApplicantPortal
          assessments={assessments}
          questionBank={questionBank}
          submissions={submissions}
          onCompleteAssessment={handleCompleteAssessment}
          onRemoveSubmission={handleRemoveSubmission}
          onUpdateSubmission={handleUpdateSubmission}
          onExitPortal={() => setActiveRole('landing')}
          currentUserAccount={currentAccount}
          invitations={invitations}
          onUpdateInvitationStatus={handleUpdateInvitationStatus}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onAssignDemoTest={handleAssignDemoTest}
        />
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            currentAccount={currentAccount}
            accounts={userAccounts}
            onSelectAccount={handleSwitchAccount}
            onCreateAccount={handleCreateAccount}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentProfessor={currentProfessor}
        allProfessors={professors}
        onSelectProfessor={(id) => {
          setCurrentProfId(id);
          setSelectedSubmission(null);
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedSubmission(null);
          setShowAIGeneratorOnOpen(false);
        }}
        onOpenCandidatePortal={() => setActiveRole('applicant-portal')}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        currentUserAccount={currentAccount}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenAssignModal={() => {
          setAssignAssessmentId(assessments[0]?.id);
          setShowAssignModal(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If an individual applicant submission is selected for review */}
        {selectedSubmission ? (
          <IndividualApplicantReview
            submission={selectedSubmission}
            questions={questionBank}
            onBack={() => setSelectedSubmission(null)}
            onUpdateSubmission={handleUpdateSubmission}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <ProfessorDashboard
                currentProfessor={currentProfessor}
                assessments={assessments}
                submissions={submissions}
                onNavigateToAssessments={() => setActiveTab('assessments')}
                onNavigateToQuestionBank={() => setActiveTab('questions')}
                onSelectSubmission={(sub) => setSelectedSubmission(sub)}
                onOpenCandidatePortal={() => setActiveRole('applicant-portal')}
                onOpenAssignModal={() => {
                  setAssignAssessmentId(assessments[0]?.id);
                  setShowAssignModal(true);
                }}
              />
            )}

            {activeTab === 'assessments' && (
              <AssessmentBuilder
                currentProfessor={currentProfessor}
                assessments={assessments}
                questionBank={questionBank}
                onSaveAssessment={handleSaveAssessment}
                onAddQuestionToBank={handleAddQuestionToBank}
                showAIGeneratorOnOpen={showAIGeneratorOnOpen}
                onCloseAIGenerator={() => setShowAIGeneratorOnOpen(false)}
                onOpenAssignModal={(assId) => {
                  setAssignAssessmentId(assId || assessments[0]?.id);
                  setShowAssignModal(true);
                }}
              />
            )}

            {activeTab === 'questions' && (
              <QuestionBank
                currentProfessor={currentProfessor}
                questionBank={questionBank}
                onAddQuestionToBank={handleAddQuestionToBank}
                onOpenAIGenerator={() => {
                  setShowAIGeneratorOnOpen(true);
                  setActiveTab('assessments');
                }}
              />
            )}

            {activeTab === 'applicants' && (
              <ApplicantManagement
                currentProfessor={currentProfessor}
                submissions={submissions}
                assessments={assessments}
                onSelectSubmission={(sub) => setSelectedSubmission(sub)}
                onUpdateSubmission={handleUpdateSubmission}
                onRemoveSubmission={handleRemoveSubmission}
                onOpenAssignModal={() => {
                  setAssignAssessmentId(assessments[0]?.id);
                  setShowAssignModal(true);
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                currentProfessor={currentProfessor}
                assessments={assessments}
                submissions={submissions}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                currentProfessor={currentProfessor}
                onUpdateProfessor={(updatedProf) => {
                  setProfessors((prev) => prev.map((p) => (p.id === updatedProf.id ? updatedProf : p)));
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">ScholarScreen AI</span>
            <span>• Graduate Admissions & Faculty Screening System</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-600 font-semibold">Gemini 3.6 Flash Server-Side Connected</span>
            <span>•</span>
            <button
              onClick={() => setActiveRole('applicant-portal')}
              className="text-indigo-600 hover:text-indigo-800 font-bold underline"
            >
              Test Student Experience →
            </button>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          currentAccount={currentAccount}
          accounts={userAccounts}
          onSelectAccount={handleSwitchAccount}
          onCreateAccount={handleCreateAccount}
        />
      )}

      {showAssignModal && (
        <AssignAssessmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          currentProfessor={currentProfessor}
          assessments={assessments}
          accounts={userAccounts}
          userAccounts={userAccounts}
          onAssign={handleAssignAssessment}
          preselectedAssessmentId={assignAssessmentId}
          initialAssessmentId={assignAssessmentId}
        />
      )}
    </div>
  );
}

