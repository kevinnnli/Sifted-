import crypto from 'crypto';
import type { ApplicantSubmission, AttemptProgress, DifficultyLevel, Question, QuestionResponseItem } from '../../src/types';
import {
  applyScoreOverrides,
  calculateSubmissionGrading,
  getAiFlagThreshold,
  getHireabilityLevel,
  getRecommendationFromLevel,
} from '../../src/utils/grading';
import type { Database } from '../db';
import type { ExamAttempt, StoredUser } from '../types';
import { badRequest } from '../validation';
import { graceSecondsFor, integrityOptionsFor } from '../views';
import { gradeWithAI } from './ai';

const DIFFICULTY_ORDER: Record<DifficultyLevel, number> = {
  Basic: 0,
  Intermediate: 1,
  Advanced: 2,
  'Research-Level': 3,
};

// Extra time allowed for the final autosave/submit to reach the server after the clock runs out
export const SUBMIT_SLACK_SECONDS = 60;
const MAX_ANSWER_LENGTH = 20000;
const MAX_EVENTS = 200;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createAttempt(
  db: Database,
  input: { invitationId: string; assessmentId: string; student: StoredUser; lockdown: boolean; details: ExamAttempt['details'] }
): ExamAttempt {
  const assessment = db.data.assessments.find((a) => a.id === input.assessmentId)!;
  const options = integrityOptionsFor(assessment);
  const questions = assessment.questionIds
    .map((id) => db.data.questions.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined);

  // Question order: shuffled per candidate if enabled; adaptive tests progress Basic → Research-Level
  let ordered = options.randomizeQuestionOrder ? shuffle(questions) : [...questions];
  if (assessment.isAdaptive) {
    ordered = ordered.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1));
  }
  const optionOrders: Record<string, string[]> = {};
  const responses: Record<string, any> = {};
  ordered.forEach((q) => {
    if (q.type === 'multiple-choice' && q.options) {
      optionOrders[q.id] = options.randomizeAnswerOrder && q.randomizeOptions !== false ? shuffle(q.options) : [...q.options];
    }
    responses[q.id] = q.type === 'programming' ? q.codeTemplate || '' : '';
  });

  const now = new Date().toISOString();
  const attempt: ExamAttempt = {
    id: crypto.randomUUID(),
    invitationId: input.invitationId,
    assessmentId: assessment.id,
    studentId: input.student.id,
    startedAt: now,
    questionOrder: ordered.map((q) => q.id),
    optionOrders,
    responses,
    flagged: {},
    currentQuestionIndex: 0,
    timeSpent: {},
    tabSwitches: 0,
    copyPasteAttempts: 0,
    integrityEvents: [],
    lockdown: input.lockdown || options.fullScreenMode,
    details: input.details,
    updatedAt: now,
  };
  db.data.attempts.push(attempt);
  return attempt;
}

/** Seconds since the attempt started, and the hard cut-off including any grace period. */
export function attemptTiming(db: Database, attempt: ExamAttempt) {
  const assessment = db.data.assessments.find((a) => a.id === attempt.assessmentId);
  const limitSeconds = Math.round((assessment?.timeLimitMinutes || 60) * 60);
  const graceSeconds = assessment ? graceSecondsFor(db, assessment) : 0;
  const elapsedSeconds = (Date.now() - Date.parse(attempt.startedAt)) / 1000;
  return {
    limitSeconds,
    graceSeconds,
    elapsedSeconds,
    isExpired: elapsedSeconds > limitSeconds + graceSeconds + SUBMIT_SLACK_SECONDS,
  };
}

/** Rejects a malformed autosave before anything is changed, so a bad request never half-applies. */
export function validateProgress(progress: Partial<AttemptProgress>) {
  if (progress.responses === undefined) return;
  if (typeof progress.responses !== 'object' || progress.responses === null || Array.isArray(progress.responses)) throw badRequest('Invalid answers');
  for (const value of Object.values(progress.responses)) {
    if (typeof value === 'string' && value.length > MAX_ANSWER_LENGTH) throw badRequest('An answer is too long');
  }
}

/**
 * Applies an autosave from the browser. Only answers to this attempt's questions are accepted,
 * multiple-choice answers must be one of the offered options, and integrity counters can only go up.
 */
export function applyProgress(db: Database, attempt: ExamAttempt, progress: Partial<AttemptProgress>) {
  validateProgress(progress);
  if (progress.responses) {
    for (const qid of attempt.questionOrder) {
      if (!(qid in progress.responses)) continue;
      const value = progress.responses[qid];
      if (typeof value !== 'string') continue;
      const options = attempt.optionOrders[qid];
      if (options && value !== '' && !options.includes(value)) continue;
      attempt.responses[qid] = value;
    }
  }
  if (progress.flagged && typeof progress.flagged === 'object') {
    attempt.flagged = Object.fromEntries(
      attempt.questionOrder.filter((qid) => (progress.flagged as Record<string, unknown>)[qid] === true).map((qid) => [qid, true])
    );
  }
  if (Number.isInteger(progress.currentQuestionIndex)) {
    attempt.currentQuestionIndex = Math.max(0, Math.min(attempt.questionOrder.length - 1, progress.currentQuestionIndex!));
  }
  const elapsed = (Date.now() - Date.parse(attempt.startedAt)) / 1000;
  if (progress.timeSpent && typeof progress.timeSpent === 'object') {
    for (const qid of attempt.questionOrder) {
      const seconds = Number((progress.timeSpent as Record<string, unknown>)[qid]);
      if (Number.isFinite(seconds) && seconds >= 0) attempt.timeSpent[qid] = Math.min(seconds, elapsed);
    }
  }
  const counter = (value: unknown, current: number) => (Number.isInteger(value) ? Math.min(10000, Math.max(current, value as number)) : current);
  attempt.tabSwitches = counter(progress.tabSwitches, attempt.tabSwitches);
  attempt.copyPasteAttempts = counter(progress.copyPasteAttempts, attempt.copyPasteAttempts);
  if (Array.isArray(progress.integrityEvents) && progress.integrityEvents.length >= attempt.integrityEvents.length) {
    attempt.integrityEvents = progress.integrityEvents
      .filter((e): e is string => typeof e === 'string')
      .slice(0, MAX_EVENTS)
      .map((e) => e.slice(0, 300));
  }
  if (typeof progress.lockdown === 'boolean') attempt.lockdown = progress.lockdown;
  attempt.updatedAt = new Date().toISOString();
}

// Submissions being graded, per database
const inFlightByDb = new WeakMap<Database, Map<string, Promise<ApplicantSubmission>>>();
const inFlightFor = (db: Database) => {
  let map = inFlightByDb.get(db);
  if (!map) inFlightByDb.set(db, (map = new Map()));
  return map;
};

/** True while an attempt is being graded and stored; autosaves for it are refused meanwhile. */
export const isBeingSubmitted = (db: Database, attemptId: string) => inFlightFor(db).has(attemptId);

/**
 * Grades an attempt on the server and turns it into a submission. Concurrent calls for the same
 * attempt (e.g. a manual submit racing the expiry sweep) share one result.
 */
export function finalizeAttempt(db: Database, attemptId: string, opts: { autoSubmitted: boolean; skipAi?: boolean }): Promise<ApplicantSubmission> {
  const inFlight = inFlightFor(db);
  const existing = inFlight.get(attemptId);
  if (existing) return existing;
  const promise = gradeAndStore(db, attemptId, opts).finally(() => inFlight.delete(attemptId));
  inFlight.set(attemptId, promise);
  return promise;
}

async function gradeAndStore(db: Database, attemptId: string, opts: { autoSubmitted: boolean; skipAi?: boolean }): Promise<ApplicantSubmission> {
  const attempt = db.data.attempts.find((a) => a.id === attemptId);
  if (!attempt) throw badRequest('This test has already been submitted');
  const assessment = db.data.assessments.find((a) => a.id === attempt.assessmentId);
  const student = db.findUser(attempt.studentId);
  const professor = db.data.professors.find((p) => p.id === assessment?.professorId);
  const integrityOptions = assessment ? integrityOptionsFor(assessment) : integrityOptionsFor({} as any);
  const examQuestions = attempt.questionOrder
    .map((id) => db.data.questions.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined);

  const { limitSeconds, graceSeconds, elapsedSeconds } = attemptTiming(db, attempt);
  const timedResponses: Record<string, { answer: any; timeSpentSeconds: number }> = {};
  const timeAnalysis: Record<string, number> = {};
  examQuestions.forEach((q) => {
    const seconds = Math.round(attempt.timeSpent[q.id] || 0);
    timeAnalysis[q.id] = seconds;
    timedResponses[q.id] = { answer: attempt.responses[q.id] ?? '', timeSpentSeconds: seconds };
  });

  // Deterministic grading first; empty and boilerplate answers always score zero
  const graded = calculateSubmissionGrading(examQuestions, timedResponses);
  let evaluatedResponses: Record<string, QuestionResponseItem> = graded.evaluatedResponses;

  // AI grading of open-ended answers against the rubrics, when configured
  const ai = opts.skipAi
    ? null
    : await gradeWithAI({
        questions: examQuestions,
        responses: evaluatedResponses,
        overallScore: graded.overallScore,
        totalWeightedScore: graded.totalWeightedScore,
        maxTotalWeightedScore: graded.maxTotalWeightedScore,
      });
  if (ai) {
    evaluatedResponses = { ...evaluatedResponses };
    ai.questionScores.forEach((qs) => {
      const item = evaluatedResponses[qs.questionId];
      const question = examQuestions.find((q) => q.id === qs.questionId);
      if (!item || !question) return;
      const isEmpty = item.aiScore === 0 && item.aiConfidence === 99; // empty answers stay at zero
      evaluatedResponses[qs.questionId] = {
        ...item,
        aiScore: isEmpty ? 0 : qs.score,
        aiFeedback: qs.feedback || item.aiFeedback,
        aiConfidence: ai.confidenceScore ?? 85,
        isCorrect: !isEmpty && qs.score >= item.maxScore * 0.7,
      };
    });
  }

  const responseList = Object.values(evaluatedResponses);
  const avgConfidence = responseList.length
    ? Math.round((responseList.reduce((a, r) => a + r.aiConfidence, 0) / responseList.length) * 10) / 10
    : 0;
  const aiDetectionEnabled = integrityOptions.aiAnswerDetection && ai !== null;
  const aiProb = aiDetectionEnabled ? ai!.aiGeneratedProbability : 0;
  const flagThreshold = getAiFlagThreshold(professor?.aiSensitivity);
  const fullscreenExits = attempt.integrityEvents.filter((e) => e.includes('Exited fullscreen')).length;
  const lateSeconds = Math.max(0, Math.round(elapsedSeconds - limitSeconds - graceSeconds));
  const finishedAt = new Date();

  const draft: ApplicantSubmission = {
    id: crypto.randomUUID(),
    assessmentId: attempt.assessmentId,
    invitationId: attempt.invitationId,
    studentId: attempt.studentId,
    applicantName: student?.name || 'Applicant',
    applicantEmail: student?.email || '',
    secondaryEmail: attempt.details.secondaryEmail,
    university: attempt.details.university,
    degreeProgram: attempt.details.degreeProgram,
    gpa: attempt.details.gpa,
    status: 'completed',
    startTime: attempt.startedAt,
    finishTime: finishedAt.toISOString(),
    totalTimeSpentSeconds: Math.round(Math.min(elapsedSeconds, limitSeconds + graceSeconds)),
    responses: evaluatedResponses,
    overallScore: graded.overallScore,
    totalWeightedScore: graded.totalWeightedScore,
    maxTotalWeightedScore: graded.maxTotalWeightedScore,
    topicBreakdown: graded.topicBreakdown,
    timeAnalysis,
    confidenceScore: ai?.confidenceScore ?? avgConfidence,
    interviewRecommendation: graded.interviewRecommendation,
    recommendationExplanation: graded.recommendationExplanation,
    aiSummary: graded.aiSummary,
    integrityReport: {
      tabSwitchCount: attempt.tabSwitches,
      copyPasteAttempts: attempt.copyPasteAttempts,
      aiGeneratedProbability: aiProb,
      integrityFlagged:
        attempt.tabSwitches > 5 ||
        attempt.copyPasteAttempts > 3 ||
        (aiDetectionEnabled && aiProb > flagThreshold) ||
        graded.emptyCount > 0 ||
        lateSeconds > 0,
      notes: [
        `Tab switches recorded: ${attempt.tabSwitches}${integrityOptions.tabSwitchDetection ? '' : ' (tab switch detection disabled)'}.`,
        `Blocked copy/paste attempts: ${attempt.copyPasteAttempts}${integrityOptions.copyPasteDetection ? '' : ' (copy/paste detection disabled)'}.`,
        attempt.lockdown || fullscreenExits > 0
          ? `Full screen session monitored${fullscreenExits ? ` — FLAGGED: exited fullscreen ${fullscreenExits} time(s)` : ''}.`
          : 'Taken without fullscreen lockdown.',
        !integrityOptions.aiAnswerDetection
          ? 'AI-generated answer detection disabled for this assessment.'
          : ai
          ? `AI-generated text probability: ${aiProb}% (flag threshold ${flagThreshold}%).`
          : 'AI-generated text analysis unavailable (Gemini AI not configured).',
        ...(opts.autoSubmitted ? ['Submitted automatically when the time limit expired.'] : []),
        ...(lateSeconds > 0 ? [`FLAGGED: received ${Math.ceil(lateSeconds / 60)} minute(s) after the time limit.`] : []),
        ...(graded.emptyCount > 0
          ? [`FLAGGED: ${graded.emptyCount} empty or unmodified boilerplate answers submitted (0 points awarded).`]
          : []),
        ...attempt.integrityEvents,
      ],
    },
    professorNotes: '',
    professorDecision: 'Pending',
    gradedWithAi: ai !== null,
  };

  // Re-total with any AI per-question scores, then derive the tier from the final score
  const submission = ai ? applyScoreOverrides(draft, {}, examQuestions) : draft;
  const level = getHireabilityLevel(submission.overallScore, graded.emptyCount, examQuestions.length);
  submission.hireabilityLevel = level;
  submission.interviewRecommendation = ai?.interviewRecommendation || getRecommendationFromLevel(level);
  if (ai?.recommendationExplanation) submission.recommendationExplanation = ai.recommendationExplanation;
  if (ai?.aiSummary) submission.aiSummary = ai.aiSummary;
  // Never recommend a candidate who left half the test empty or scored under 50%
  if (graded.emptyCount >= Math.ceil(examQuestions.length / 2) || submission.overallScore < 50) {
    submission.hireabilityLevel = 'Tier 4: Does Not Meet Technical Bar';
    submission.interviewRecommendation = 'Do Not Recommend';
  }

  // Store it. The data may have changed while the AI was grading (and, with a remote store, another
  // instance may save first, in which case this runs again on the newer data).
  return db.commit(() => {
    if (!db.data.attempts.some((a) => a.id === attemptId)) {
      // Submitted meanwhile from another tab or server instance: that submission stands
      const earlier = db.data.submissions.find((s) => s.invitationId === attempt.invitationId && s.studentId === attempt.studentId);
      if (earlier) return earlier;
      throw badRequest('This test has already been submitted');
    }
    db.data.attempts = db.data.attempts.filter((a) => a.id !== attemptId);
    db.data.submissions.unshift(submission);
    const invitation = db.data.invitations.find((i) => i.id === attempt.invitationId);
    if (invitation) {
      invitation.status = 'completed';
      invitation.submittedAt = finishedAt.toISOString();
    }
    return submission;
  });
}

/** Submits attempts whose time (plus grace and network slack) ran out while the student was away. */
export async function sweepExpiredAttempts(db: Database) {
  const expired = db.data.attempts.filter((a) => attemptTiming(db, a).isExpired);
  for (const attempt of expired) {
    try {
      await finalizeAttempt(db, attempt.id, { autoSubmitted: true });
    } catch (e) {
      console.error(`Could not auto-submit attempt ${attempt.id}:`, e);
    }
  }
}
