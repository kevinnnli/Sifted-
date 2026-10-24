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

type ProfessorTab = 'dashboard' | 'assessments' | 'questions' | 'applicants' | 'analytics' | 'settings';

const ROLE_FOR_ACCOUNT: Record<UserAccount['role'], ActiveRole> = {
  admin: 'admin-portal',
  professor: 'professor',
  applicant: 'applicant-portal',
};

function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.error(`Failed to save to ${url}:`, err);
  });
}

export default function App() {
  // Application Data State
  const [professors, setProfessors] = useState<ProfessorProfile[]>(MOCK_PROFESSORS);
  const [currentProfId, setCurrentProfId] = useState<string>(MOCK_PROFESSORS[0]?.id || 'prof-1');
  const [assessments, setAssessments] = useState<Assessment[]>(MOCK_ASSESSMENTS);
  const [questionBank, setQuestionBank] = useState<Question[]>(MOCK_QUESTIONS);
  const [submissions, setSubmissions] = useState<ApplicantSubmission[]>(MOCK_SUBMISSIONS);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>(MOCK_USER_ACCOUNTS);
  const [invitations, setInvitations] = useState<AssessmentInvitation[]>(MOCK_INVITATIONS);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ProfessorTab>('dashboard');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<ActiveRole>('landing');
  const [showAIGeneratorOnOpen, setShowAIGeneratorOnOpen] = useState<boolean>(false);

  // Account & Modals State (nobody is signed in until they pick an account)
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignAssessmentId, setAssignAssessmentId] = useState<string | undefined>(undefined);

  // Load persistent backend data on boot
  useEffect(() => {
    const applyAccountFromUrl = (accounts: UserAccount[]) => {
      // The secure exam tab is opened with ?accountId=... so it continues as the same signed-in student
      const accountId = new URLSearchParams(window.location.search).get('accountId');
      const account = accountId ? accounts.find((a) => a.id === accountId) : undefined;
      if (account) handleSwitchAccount(account);
    };

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
        applyAccountFromUrl(data?.userAccounts || MOCK_USER_ACCOUNTS);
      })
      .catch((err) => {
        console.log('Using fallback local state:', err);
        applyAccountFromUrl(MOCK_USER_ACCOUNTS);
      })
      .finally(() => setDataLoaded(true));

    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setAiConfigured(Boolean(data?.aiConfigured)))
      .catch(() => setAiConfigured(false));
  }, []);

  const currentProfessor = professors.find((p) => p.id === currentProfId) || professors[0];
  // Look the selected submission up by id so the review screen always shows the latest saved version
  const selectedSubmission = selectedSubmissionId ? submissions.find((s) => s.id === selectedSubmissionId) || null : null;
  const professorAssessments = assessments.filter((a) => !a.professorId || a.professorId === currentProfId);

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
    postJson('/api/data/assessments', { assessment: newAssessment });
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
    postJson('/api/data/questions', { question: newQuestion });
  };

  // Handler for adding or updating a submission (professor decisions, notes, applicant RSVPs...)
  const handleUpdateSubmission = (updated: ApplicantSubmission) => {
    setSubmissions((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
    postJson('/api/data/submissions', { submission: updated });
  };

  const handleRemoveSubmission = (submissionId: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    if (selectedSubmissionId === submissionId) setSelectedSubmissionId(null);
    fetch(`/api/data/submissions/${encodeURIComponent(submissionId)}`, { method: 'DELETE' }).catch(console.error);
  };

  function handleSwitchAccount(account: UserAccount) {
    setCurrentAccount(account);
    setSelectedSubmissionId(null);
    setActiveTab('dashboard');
    setShowAIGeneratorOnOpen(false);
    if (account.role === 'professor' && account.professorId) {
      setCurrentProfId(account.professorId);
    }
    setActiveRole(ROLE_FOR_ACCOUNT[account.role] || 'landing');
  }

  const handleSignOut = () => {
    setCurrentAccount(null);
    setSelectedSubmissionId(null);
    setActiveRole('landing');
  };

  const handleCreateAccount = (newAcc: UserAccount) => {
    setUserAccounts((prev) => [newAcc, ...prev]);
    handleSwitchAccount(newAcc);
    postJson('/api/data/accounts', { account: newAcc });
  };

  const handleCreateProfessorAccount = (newProfAcc: UserAccount, newProfProfile: ProfessorProfile) => {
    setUserAccounts((prev) => [newProfAcc, ...prev]);
    setProfessors((prev) => [newProfProfile, ...prev]);
    postJson('/api/data/accounts', { account: newProfAcc });
    postJson('/api/data/professors', { professor: newProfProfile });
  };

  const handleUpdateProfessor = (updatedProf: ProfessorProfile) => {
    setProfessors((prev) => prev.map((p) => (p.id === updatedProf.id ? updatedProf : p)));
    postJson('/api/data/professors', { professor: updatedProf });
    // Keep the professor's sign-in account in sync with their lab profile
    const linkedAccount = userAccounts.find((a) => a.professorId === updatedProf.id);
    if (linkedAccount && linkedAccount.labName !== updatedProf.labName) {
      const updatedAccount = { ...linkedAccount, labName: updatedProf.labName };
      setUserAccounts((prev) => prev.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)));
      if (currentAccount?.id === updatedAccount.id) setCurrentAccount(updatedAccount);
      postJson('/api/data/accounts', { account: updatedAccount });
    }
  };

  const handleAssignAssessment = (inv: AssessmentInvitation) => {
    setInvitations((prev) => [inv, ...prev]);
    postJson('/api/data/invitations', { invitation: inv });
  };

  const handleUpdateInvitationStatus = (id: string, status: 'pending' | 'in-progress' | 'completed') => {
    const existing = invitations.find((i) => i.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const updated: AssessmentInvitation = {
      ...existing,
      status,
      startedAt: status === 'in-progress' ? existing.startedAt || now : existing.startedAt,
      submittedAt: status === 'completed' ? now : existing.submittedAt,
    };
    setInvitations((prev) => prev.map((i) => (i.id === id ? updated : i)));
    postJson('/api/data/invitations', { invitation: updated });
  };

  const handleAssignDemoTest = (email: string) => {
    const alreadyAssigned = new Set(
      invitations.filter((i) => i.applicantEmail.toLowerCase() === email.toLowerCase()).map((i) => i.assessmentId)
    );
    const demoAssessment =
      assessments.find((a) => a.isActive !== false && !alreadyAssigned.has(a.id)) || assessments.find((a) => a.isActive !== false);
    if (!demoAssessment) {
      alert('There are no published assessments to assign yet.');
      return;
    }
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    handleAssignAssessment({
      id: `inv-${Date.now()}`,
      assessmentId: demoAssessment.id,
      professorId: demoAssessment.professorId,
      applicantEmail: email.toLowerCase(),
      applicantName: currentAccount?.name,
      assignedAt: new Date().toISOString(),
      deadline,
      status: 'pending',
      notes: 'Demo invitation automatically assigned for testing and verification purposes.',
    });
  };

  const handleResetData = async () => {
    try {
      const res = await fetch('/api/data/reset', { method: 'POST' });
      const data = await res.json();
      if (!data?.success) throw new Error('Reset failed');
      setProfessors(data.professors);
      setAssessments(data.assessments);
      setQuestionBank(data.questionBank);
      setSubmissions(data.submissions);
      setUserAccounts(data.userAccounts);
      setInvitations(data.invitations);
      handleSignOut();
    } catch (err) {
      console.error(err);
      alert('Could not reset the demo data. Is the server running?');
    }
  };

  const openAssignModal = (assessmentId?: string) => {
    // The modal resolves the id against the latest assessments (a just-saved exam may not be in this render's list yet)
    setAssignAssessmentId(assessmentId);
    setShowAssignModal(true);
  };

  const authModal = showAuthModal && (
    <AuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      currentAccount={currentAccount}
      accounts={userAccounts}
      onSelectAccount={handleSwitchAccount}
      onCreateAccount={handleCreateAccount}
    />
  );

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm font-semibold">
        Loading Sifted…
      </div>
    );
  }

  // Each portal is only reachable by an account with the matching role
  const effectiveRole: ActiveRole = currentAccount && activeRole === ROLE_FOR_ACCOUNT[currentAccount.role] ? activeRole : 'landing';

  // If Landing Page is active, render Landing Page
  if (effectiveRole === 'landing' || !currentAccount) {
    const params = new URLSearchParams(window.location.search);
    return (
      <>
        <LandingPage
          accounts={userAccounts}
          onSelectAccount={handleSwitchAccount}
          onCreateStudentAccount={handleCreateAccount}
          initialTab={params.get('role') === 'applicant' ? 'login' : 'overview'}
          assessmentsCount={assessments.length}
          questionsCount={questionBank.length}
          submissionsCount={submissions.length}
        />
        {authModal}
      </>
    );
  }

  // If Admin Portal is active, render Admin Portal
  if (effectiveRole === 'admin-portal') {
    return (
      <>
        <AdminPortal
          currentAccount={currentAccount}
          accounts={userAccounts}
          professors={professors}
          onCreateProfessor={handleCreateProfessorAccount}
          onSwitchAccount={handleSwitchAccount}
          onExitToLanding={handleSignOut}
          onResetData={handleResetData}
        />
        {authModal}
      </>
    );
  }

  // If Candidate Portal is active, render full screen portal
  if (effectiveRole === 'applicant-portal') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 relative">
        <ApplicantPortal
          assessments={assessments}
          questionBank={questionBank}
          professors={professors}
          submissions={submissions}
          onCompleteAssessment={handleUpdateSubmission}
          onUpdateSubmission={handleUpdateSubmission}
          onExitPortal={handleSignOut}
          currentUserAccount={currentAccount}
          invitations={invitations}
          onUpdateInvitationStatus={handleUpdateInvitationStatus}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onAssignDemoTest={handleAssignDemoTest}
        />
        {authModal}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentProfessor={currentProfessor}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedSubmissionId(null);
          setShowAIGeneratorOnOpen(false);
        }}
        onGoHome={handleSignOut}
        currentUserAccount={currentAccount}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenAssignModal={() => openAssignModal()}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If an individual applicant submission is selected for review */}
        {selectedSubmission ? (
          <IndividualApplicantReview
            key={selectedSubmission.id}
            submission={selectedSubmission}
            questions={questionBank}
            onBack={() => setSelectedSubmissionId(null)}
            onUpdateSubmission={handleUpdateSubmission}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <ProfessorDashboard
                currentProfessor={currentProfessor}
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
                key={currentProfessor.id}
                currentProfessor={currentProfessor}
                assessments={assessments}
                questionBank={questionBank}
                onSaveAssessment={handleSaveAssessment}
                onAddQuestionToBank={handleAddQuestionToBank}
                showAIGeneratorOnOpen={showAIGeneratorOnOpen}
                onCloseAIGenerator={() => setShowAIGeneratorOnOpen(false)}
                onOpenAssignModal={openAssignModal}
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
                onSelectSubmission={(sub) => setSelectedSubmissionId(sub.id)}
                onUpdateSubmission={handleUpdateSubmission}
                onRemoveSubmission={handleRemoveSubmission}
                onOpenAssignModal={() => openAssignModal()}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                currentProfessor={currentProfessor}
                assessments={assessments}
                submissions={submissions}
                questionBank={questionBank}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                key={currentProfessor.id}
                currentProfessor={currentProfessor}
                onUpdateProfessor={handleUpdateProfessor}
                aiConfigured={aiConfigured}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
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

      {authModal}

      {showAssignModal && (
        <AssignAssessmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          currentProfessor={currentProfessor}
          assessments={professorAssessments}
          accounts={userAccounts}
          invitations={invitations}
          onAssign={handleAssignAssessment}
          preselectedAssessmentId={assignAssessmentId}
        />
      )}
    </div>
  );
}
