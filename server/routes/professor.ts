import crypto from 'crypto';
import { Router, type Request } from 'express';
import type {
  ApplicantSubmission,
  Assessment,
  AssessmentInvitation,
  IntegrityOptions,
  ProfessorCandidate,
  ProfessorProfile,
  Question,
} from '../../src/types';
import { applyScoreOverrides, getHireabilityLevel, isEmptyOrTrivialResponse } from '../../src/utils/grading';
import type { Database } from '../db';
import { requireRole } from '../security';
import { DIFFICULTIES, generateQuestion, QUESTION_TYPES, TOPICS, writeBriefing } from '../services/ai';
import {
  asyncHandler,
  badRequest,
  forbidden,
  isPlainObject,
  notFound,
  optionalDate,
  optionalHttpUrl,
  optionalString,
  optionalText,
  requireBoolean,
  requireEmail,
  requireEnum,
  requireNumber,
  requireString,
  requireStringArray,
} from '../validation';
import { DEFAULT_INTEGRITY_OPTIONS } from '../views';

const LANGUAGES = ['Python', 'Java', 'C++', 'JavaScript', 'R', 'MATLAB'] as const;
const DECISIONS = ['Pending', 'Interview', 'Reject'] as const;
const INTEGRITY_KEYS = Object.keys(DEFAULT_INTEGRITY_OPTIONS) as (keyof IntegrityOptions)[];

export function professorRoutes(db: Database) {
  const router = Router();
  router.use(requireRole('professor'));

  const getProfessor = (req: Request): ProfessorProfile => {
    const professor = db.data.professors.find((p) => p.id === req.user!.professorId);
    if (!professor) throw forbidden('No professor profile is linked to this account');
    return professor;
  };
  const ownAssessments = (professor: ProfessorProfile) => db.data.assessments.filter((a) => a.professorId === professor.id);
  const ownAssessment = (professor: ProfessorProfile, id: string) => {
    const assessment = db.data.assessments.find((a) => a.id === id);
    if (!assessment || assessment.professorId !== professor.id) throw notFound('Assessment not found');
    return assessment;
  };
  const visibleQuestions = (professor: ProfessorProfile) =>
    db.data.questions.filter((q) => q.isPublic !== false || q.professorId === professor.id);
  const ownSubmission = (professor: ProfessorProfile, id: string) => {
    const submission = db.data.submissions.find((s) => s.id === id);
    const assessment = submission && db.data.assessments.find((a) => a.id === submission.assessmentId);
    if (!submission || !assessment || assessment.professorId !== professor.id) throw notFound('Submission not found');
    return submission;
  };

  router.get('/workspace', (req, res) => {
    const professor = getProfessor(req);
    const assessmentIds = new Set(ownAssessments(professor).map((a) => a.id));
    const submissions = db.data.submissions.filter((s) => assessmentIds.has(s.assessmentId));
    const invitations = db.data.invitations.filter((i) => i.professorId === professor.id);

    // Only students connected to this professor (invited or submitted), never the whole student body
    const candidates = new Map<string, ProfessorCandidate>();
    const addCandidate = (email: string, fallbackName?: string) => {
      const key = email.toLowerCase();
      if (candidates.has(key)) return;
      const account = db.findUserByEmail(key);
      const isStudent = account?.role === 'applicant';
      candidates.set(key, {
        email: key,
        name: (isStudent && account?.name) || fallbackName || key.split('@')[0],
        university: isStudent ? account?.university : undefined,
        degreeProgram: isStudent ? account?.degreeProgram : undefined,
        registered: Boolean(isStudent),
      });
    };
    invitations.forEach((i) => addCandidate(i.applicantEmail, i.applicantName));
    submissions.forEach((s) => addCandidate(s.applicantEmail, s.applicantName));

    res.json({
      success: true,
      professor,
      assessments: ownAssessments(professor),
      questions: visibleQuestions(professor),
      submissions,
      invitations,
      candidates: [...candidates.values()],
    });
  });

  router.put('/profile', (req, res) => {
    const professor = getProfessor(req);
    const body = req.body || {};
    professor.labName = requireString(body.labName, 'Lab name', { max: 200 });
    professor.email = requireEmail(body.email, 'Notification email');
    professor.aiSensitivity = requireEnum(body.aiSensitivity, ['high', 'medium', 'low'] as const, 'AI sensitivity');
    professor.allowLateSubmissions = requireBoolean(body.allowLateSubmissions, 'Allow late submissions');
    const account = req.user!;
    account.labName = professor.labName;
    db.save();
    res.json({ success: true, professor });
  });

  // ---- Assessments ----

  const parseAssessment = (professor: ProfessorProfile, body: any) => {
    if (!isPlainObject(body)) throw badRequest('Missing assessment');
    const integrityInput = isPlainObject(body.integrityOptions) ? body.integrityOptions : {};
    const integrityOptions = Object.fromEntries(
      INTEGRITY_KEYS.map((key) => [key, typeof integrityInput[key] === 'boolean' ? integrityInput[key] : DEFAULT_INTEGRITY_OPTIONS[key]])
    ) as unknown as IntegrityOptions;
    const visible = new Set(visibleQuestions(professor).map((q) => q.id));
    const questionIds = [...new Set(requireStringArray(body.questionIds, 'Questions', { maxItems: 200, maxLength: 100 }))];
    if (questionIds.length === 0) throw badRequest('Add at least one question');
    if (questionIds.some((id) => !visible.has(id))) throw badRequest('One or more questions are not available to you');
    const published = requireBoolean(body.isPublished, 'Published');
    return {
      title: requireString(body.title, 'Title', { max: 200 }),
      description: optionalText(body.description, 'Description', 5000) || '',
      researchGroup: optionalString(body.researchGroup, 'Research group', 200) || professor.labName,
      semester: optionalString(body.semester, 'Semester', 100) || '',
      timeLimitMinutes: requireNumber(body.timeLimitMinutes, 'Time limit (minutes)', 1, 600),
      isAdaptive: requireBoolean(body.isAdaptive, 'Adaptive difficulty'),
      isScoreVisible: requireBoolean(body.isScoreVisible, 'Score visibility'),
      integrityOptions,
      questionIds,
      isActive: published,
      isPublished: published,
      status: (published ? 'Published' : 'Draft') as Assessment['status'],
    };
  };

  router.post('/assessments', (req, res) => {
    const professor = getProfessor(req);
    const today = new Date().toISOString();
    const assessment: Assessment = {
      id: crypto.randomUUID(),
      professorId: professor.id,
      ...parseAssessment(professor, req.body?.assessment),
      createdAt: today,
      updatedAt: today,
    };
    db.data.assessments.unshift(assessment);
    db.save();
    res.status(201).json({ success: true, assessment });
  });

  router.put('/assessments/:id', (req, res) => {
    const professor = getProfessor(req);
    const assessment = ownAssessment(professor, req.params.id);
    Object.assign(assessment, parseAssessment(professor, req.body?.assessment), { updatedAt: new Date().toISOString() });
    db.save();
    res.json({ success: true, assessment });
  });

  // ---- Question bank ----

  const parseQuestion = (body: any, existing?: Question) => {
    if (!isPlainObject(body)) throw badRequest('Missing question');
    const type = requireEnum(body.type, QUESTION_TYPES, 'Question type');
    const difficulty = requireEnum(body.difficulty, DIFFICULTIES, 'Difficulty');
    const question: Omit<Question, 'id'> = {
      ...(existing || {}),
      type,
      title: requireString(body.title, 'Title', { max: 200 }),
      prompt: requireString(body.prompt, 'Prompt', { max: 20000 }),
      difficulty,
      difficultyWeight: { Basic: 1.0, Intermediate: 1.5, Advanced: 2.0, 'Research-Level': 3.0 }[difficulty],
      topic: requireEnum(body.topic, TOPICS, 'Topic'),
      points: Math.round(requireNumber(body.points, 'Points', 1, 100)),
      rubric: optionalText(body.rubric, 'Rubric', 10000) || 'Standard evaluation criteria apply.',
      sampleAnswer: optionalText(body.sampleAnswer, 'Sample answer', 20000) || '',
      isPublic: body.isPublic !== false,
      options: undefined,
      correctAnswers: undefined,
      language: undefined,
      codeTemplate: undefined,
      latexFormula: undefined,
    };
    if (type === 'multiple-choice') {
      const options = requireStringArray(body.options, 'Options', { maxItems: 8, maxLength: 500 }).map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) throw badRequest('A multiple-choice question needs at least two options');
      if (new Set(options).size !== options.length) throw badRequest('Answer options must all be different');
      const correctAnswers = requireStringArray(body.correctAnswers, 'Correct answer', { maxItems: 8, maxLength: 500 }).map((o) => o.trim());
      if (correctAnswers.length === 0 || correctAnswers.some((c) => !options.includes(c))) {
        throw badRequest('The correct answer must be one of the options');
      }
      question.options = options;
      question.correctAnswers = correctAnswers;
    }
    if (type === 'programming') {
      question.language = body.language ? requireEnum(body.language, LANGUAGES, 'Language') : 'Python';
      question.codeTemplate = optionalText(body.codeTemplate, 'Code template', 20000) || '';
      question.testCases = existing?.type === 'programming' ? existing.testCases : undefined;
    } else {
      question.testCases = undefined;
    }
    if (type === 'math') question.latexFormula = optionalString(body.latexFormula, 'Formula', 2000);
    return question;
  };

  router.post('/questions', (req, res) => {
    const professor = getProfessor(req);
    const question: Question = { id: crypto.randomUUID(), ...parseQuestion(req.body?.question), professorId: professor.id };
    db.data.questions.unshift(question);
    db.save();
    res.status(201).json({ success: true, question });
  });

  router.put('/questions/:id', (req, res) => {
    const professor = getProfessor(req);
    const index = db.data.questions.findIndex((q) => q.id === req.params.id);
    const existing = db.data.questions[index];
    if (!existing || existing.professorId !== professor.id) throw notFound('Question not found');
    db.data.questions[index] = { ...parseQuestion(req.body?.question, existing), id: existing.id, professorId: professor.id };
    db.save();
    res.json({ success: true, question: db.data.questions[index] });
  });

  router.post(
    '/ai/generate-question',
    asyncHandler(async (req, res) => {
      getProfessor(req);
      const body = req.body || {};
      const text = (v: unknown, field: string) => optionalString(v, field, 500);
      const result = await generateQuestion({
        field: text(body.field, 'Field'),
        course: text(body.course, 'Course'),
        specialization: text(body.specialization, 'Specialization'),
        desiredDifficulty: text(body.desiredDifficulty, 'Difficulty'),
        learningObjectives: optionalString(body.learningObjectives, 'Learning objectives', 2000),
        questionType: text(body.questionType, 'Question type'),
      });
      res.json({ success: true, ...result });
    })
  );

  // ---- Invitations ----

  router.post('/invitations', (req, res) => {
    const professor = getProfessor(req);
    const body = req.body || {};
    const assessment = ownAssessment(professor, requireString(body.assessmentId, 'Assessment', { max: 100 }));
    const emails = [...new Set(requireStringArray(body.emails, 'Emails', { maxItems: 100, maxLength: 254 }).map((e) => requireEmail(e)))];
    if (emails.length === 0) throw badRequest('Add at least one candidate email');
    const deadline = optionalDate(body.deadline, 'Deadline');
    if (deadline && deadline < new Date().toISOString().slice(0, 10)) throw badRequest('The deadline cannot be in the past');
    const notes = optionalString(body.notes, 'Instructions', 1000);

    const created: AssessmentInvitation[] = [];
    const skipped: { email: string; reason: string }[] = [];
    for (const email of emails) {
      const account = db.findUserByEmail(email);
      if (account && account.role !== 'applicant') {
        skipped.push({ email, reason: 'belongs to a staff account' });
        continue;
      }
      const open = db.data.invitations.some(
        (i) => i.assessmentId === assessment.id && i.applicantEmail.toLowerCase() === email && i.status !== 'completed' && i.status !== 'reviewed'
      );
      if (open) {
        skipped.push({ email, reason: 'already has an open invitation' });
        continue;
      }
      const invitation: AssessmentInvitation = {
        id: crypto.randomUUID(),
        assessmentId: assessment.id,
        professorId: professor.id,
        applicantEmail: email,
        applicantName: account?.name || email.split('@')[0],
        assignedAt: new Date().toISOString(),
        status: 'pending',
        deadline,
        notes,
      };
      db.data.invitations.unshift(invitation);
      created.push(invitation);
    }
    db.save();
    res.status(201).json({ success: true, created, skipped });
  });

  // ---- Submissions ----

  router.put('/submissions/:id/review', (req, res) => {
    const professor = getProfessor(req);
    const submission = ownSubmission(professor, req.params.id);
    const body = req.body || {};
    let updated: ApplicantSubmission = { ...submission };

    if (body.professorNotes !== undefined) updated.professorNotes = optionalText(body.professorNotes, 'Notes', 5000) || '';
    if (body.professorDecision !== undefined) {
      updated.professorDecision = requireEnum(body.professorDecision, DECISIONS, 'Decision');
      updated.status = updated.professorDecision === 'Pending' ? 'completed' : 'reviewed';
    }
    const scheduleChanged =
      (body.interviewDate !== undefined && (body.interviewDate || undefined) !== submission.interviewDate) ||
      (body.interviewTime !== undefined && (body.interviewTime || undefined) !== submission.interviewTime);
    if (body.interviewDate !== undefined) updated.interviewDate = optionalDate(body.interviewDate, 'Interview date');
    if (body.interviewTime !== undefined) updated.interviewTime = optionalString(body.interviewTime, 'Interview time', 40);
    if (body.meetingLink !== undefined) updated.meetingLink = optionalHttpUrl(body.meetingLink, 'Meeting link');
    if (updated.professorDecision === 'Interview') updated.meetingConfirmed = true;
    // The candidate must RSVP again when the interview is moved
    if (scheduleChanged) updated.applicantResponseToInterview = undefined;

    if (body.scoreOverrides !== undefined) {
      if (!isPlainObject(body.scoreOverrides)) throw badRequest('Invalid score overrides');
      const overrides: Record<string, number> = {};
      for (const [qid, value] of Object.entries(body.scoreOverrides)) {
        const response = submission.responses[qid];
        if (!response) throw badRequest('Score override for an unknown question');
        overrides[qid] = requireNumber(value, 'Score', 0, response.maxScore);
      }
      const questions = db.data.questions;
      updated = applyScoreOverrides(updated, overrides, questions);
      const responseList = Object.values(updated.responses);
      const emptyCount = responseList.filter((r) => isEmptyOrTrivialResponse(r.answer, questions.find((q) => q.id === r.questionId))).length;
      updated.hireabilityLevel = getHireabilityLevel(updated.overallScore, emptyCount, responseList.length);
    }

    Object.assign(submission, updated);
    const invitation = submission.invitationId && db.data.invitations.find((i) => i.id === submission.invitationId);
    if (invitation && body.professorDecision !== undefined) {
      invitation.status = submission.status === 'reviewed' ? 'reviewed' : 'completed';
      invitation.reviewedAt = submission.status === 'reviewed' ? new Date().toISOString() : invitation.reviewedAt;
    }
    db.save();
    res.json({ success: true, submission });
  });

  router.delete('/submissions/:id', (req, res) => {
    const professor = getProfessor(req);
    const submission = ownSubmission(professor, req.params.id);
    db.data.submissions = db.data.submissions.filter((s) => s.id !== submission.id);
    db.save();
    res.json({ success: true });
  });

  router.post(
    '/submissions/:id/briefing',
    asyncHandler(async (req, res) => {
      const professor = getProfessor(req);
      const submission = ownSubmission(professor, req.params.id);
      res.json({ success: true, ...(await writeBriefing(submission)) });
    })
  );

  return router;
}
