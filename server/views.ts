import type {
  ApplicantSubmission,
  Assessment,
  AssessmentInvitation,
  ExamAttemptView,
  IntegrityOptions,
  ProfessorProfile,
  Question,
  StudentAssessmentSummary,
  StudentInvitationView,
  StudentQuestion,
  StudentSubmissionView,
} from '../src/types';
import { getEffectiveScore } from '../src/utils/grading';
import type { Database } from './db';
import type { ExamAttempt, StoredUser } from './types';

export const DEFAULT_INTEGRITY_OPTIONS: IntegrityOptions = {
  fullScreenMode: true,
  tabSwitchDetection: true,
  webcamMonitoring: false,
  copyPasteDetection: true,
  aiAnswerDetection: true,
  randomizeQuestionOrder: true,
  randomizeAnswerOrder: true,
};

export const LATE_GRACE_SECONDS = 5 * 60;

export const integrityOptionsFor = (assessment: Assessment): IntegrityOptions => ({
  ...DEFAULT_INTEGRITY_OPTIONS,
  ...(assessment.integrityOptions || {}),
});

export const isPublished = (assessment: Assessment) => assessment.isActive !== false;

export function graceSecondsFor(db: Database, assessment: Assessment): number {
  const professor = db.data.professors.find((p) => p.id === assessment.professorId);
  return professor?.allowLateSubmissions ? LATE_GRACE_SECONDS : 0;
}

export function toStudentAssessmentSummary(assessment: Assessment): StudentAssessmentSummary {
  return {
    id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    researchGroup: assessment.researchGroup,
    semester: assessment.semester,
    timeLimitMinutes: assessment.timeLimitMinutes,
    questionCount: assessment.questionIds.length,
    isPublished: isPublished(assessment),
    isAdaptive: assessment.isAdaptive,
    integrityOptions: integrityOptionsFor(assessment),
  };
}

/** Strips the answer key, rubric, model answer and hidden test cases before a question reaches a student. */
export function toStudentQuestion(question: Question, optionOrder?: string[]): StudentQuestion {
  return {
    id: question.id,
    type: question.type,
    title: question.title,
    prompt: question.prompt,
    difficulty: question.difficulty,
    topic: question.topic,
    points: question.points,
    options: question.type === 'multiple-choice' ? optionOrder || question.options : undefined,
    language: question.language,
    codeTemplate: question.codeTemplate,
    latexFormula: question.latexFormula,
    testCases: question.testCases?.filter((tc) => !tc.isHidden),
    paperExcerpt: question.paperExcerpt,
    chartType: question.chartType,
    chartData: question.chartData,
    researchContext: question.researchContext,
  };
}

export function toAttemptView(db: Database, attempt: ExamAttempt, student: StoredUser): ExamAttemptView {
  const assessment = db.data.assessments.find((a) => a.id === attempt.assessmentId);
  if (!assessment) throw new Error('Assessment for attempt no longer exists');
  const questions = attempt.questionOrder
    .map((id) => db.data.questions.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined)
    .map((q) => toStudentQuestion(q, attempt.optionOrders[q.id]));
  return {
    id: attempt.id,
    invitationId: attempt.invitationId,
    assessment: toStudentAssessmentSummary(assessment),
    applicantName: student.name,
    questions,
    startedAt: attempt.startedAt,
    serverNow: new Date().toISOString(),
    timeLimitSeconds: Math.round(assessment.timeLimitMinutes * 60),
    graceSeconds: graceSecondsFor(db, assessment),
    responses: attempt.responses,
    flagged: attempt.flagged,
    currentQuestionIndex: attempt.currentQuestionIndex,
    timeSpent: attempt.timeSpent,
    tabSwitches: attempt.tabSwitches,
    copyPasteAttempts: attempt.copyPasteAttempts,
    integrityEvents: attempt.integrityEvents,
    lockdown: attempt.lockdown,
  };
}

function isPastDeadline(deadline?: string): boolean {
  if (!deadline) return false;
  const [y, m, d] = deadline.split('-').map(Number);
  // A deadline is a calendar day: allow until the end of that day (server time)
  return Date.now() > new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function findSubmissionForInvitation(db: Database, invitation: AssessmentInvitation) {
  return db.data.submissions.find((s) => s.invitationId === invitation.id);
}

/** Why a student can't start (or resume) an invitation right now, or null if they can. */
export function getStartBlocker(db: Database, invitation: AssessmentInvitation, student: StoredUser): string | null {
  if (!student.isVerified && studentVerificationRequired()) {
    return 'Your account is waiting for an administrator to verify it before you can take assessments.';
  }
  const assessment = db.data.assessments.find((a) => a.id === invitation.assessmentId);
  if (!assessment) return 'This assessment is no longer available. Please contact your professor.';
  if (!isPublished(assessment)) return 'Your professor has not published this assessment yet.';
  if (invitation.status === 'completed' || invitation.status === 'reviewed' || findSubmissionForInvitation(db, invitation)) {
    return 'You have already submitted this assessment.';
  }
  const hasAttempt = db.data.attempts.some((a) => a.invitationId === invitation.id && a.studentId === student.id);
  if (!hasAttempt && isPastDeadline(invitation.deadline)) {
    return `The deadline for this assessment (${invitation.deadline}) has passed.`;
  }
  if (!assessment.questionIds.some((id) => db.data.questions.some((q) => q.id === id))) {
    return 'This assessment has no questions yet. Please contact your professor.';
  }
  return null;
}

export function studentVerificationRequired(): boolean {
  return process.env.STUDENT_VERIFICATION !== 'auto';
}

export function toStudentInvitation(db: Database, invitation: AssessmentInvitation, student: StoredUser): StudentInvitationView {
  const assessment = db.data.assessments.find((a) => a.id === invitation.assessmentId);
  const professor = db.data.professors.find((p) => p.id === invitation.professorId);
  const submission = findSubmissionForInvitation(db, invitation);
  return {
    id: invitation.id,
    status: submission && invitation.status !== 'reviewed' ? 'completed' : invitation.status,
    assignedAt: invitation.assignedAt,
    deadline: invitation.deadline,
    notes: invitation.notes,
    professorName: professor?.name || 'Faculty Advisor',
    assessment: assessment ? toStudentAssessmentSummary(assessment) : null,
    graceMinutes: assessment ? graceSecondsFor(db, assessment) / 60 : 0,
    submissionId: submission && !submission.hiddenByApplicant ? submission.id : undefined,
    hasActiveAttempt: db.data.attempts.some((a) => a.invitationId === invitation.id && a.studentId === student.id),
    blocker: getStartBlocker(db, invitation, student),
  };
}

/**
 * A student's own submission: no private professor notes, AI recommendation, hireability tier,
 * integrity report or grading feedback; scores only when the professor made them visible.
 */
export function toStudentSubmission(db: Database, submission: ApplicantSubmission): StudentSubmissionView {
  const assessment = db.data.assessments.find((a) => a.id === submission.assessmentId);
  const decision = submission.professorDecision === 'Interview' ? 'Interview' : submission.professorDecision === 'Reject' ? 'Reject' : 'Pending';
  const scoresVisible = Boolean(assessment?.isScoreVisible);
  const view: StudentSubmissionView = {
    id: submission.id,
    invitationId: submission.invitationId,
    assessmentId: submission.assessmentId,
    assessmentTitle: assessment?.title || 'Screening Assessment (no longer available)',
    researchGroup: assessment?.researchGroup || '—',
    applicantName: submission.applicantName,
    university: submission.university,
    degreeProgram: submission.degreeProgram,
    finishTime: submission.finishTime,
    totalTimeSpentSeconds: submission.totalTimeSpentSeconds,
    decision,
    scoresVisible,
  };
  if (decision === 'Interview') {
    view.interview = {
      date: submission.interviewDate,
      time: submission.interviewTime,
      meetingLink: submission.meetingLink,
      response: submission.applicantResponseToInterview,
    };
  }
  if (scoresVisible) {
    view.overallScore = submission.overallScore;
    const order = assessment?.questionIds || Object.keys(submission.responses || {});
    view.questionResults = order
      .filter((qid) => submission.responses?.[qid])
      .map((qid) => {
        const resp = submission.responses[qid];
        const question = db.data.questions.find((q) => q.id === qid);
        return {
          questionId: qid,
          title: question?.title || 'Question',
          topic: question?.topic || 'Machine Learning',
          difficulty: question?.difficulty || 'Intermediate',
          points: resp.maxScore,
          score: getEffectiveScore(resp),
        };
      });
  }
  return view;
}

export function professorOwnsAssessment(professor: ProfessorProfile, assessment: Assessment | undefined): assessment is Assessment {
  return Boolean(assessment && assessment.professorId === professor.id);
}
