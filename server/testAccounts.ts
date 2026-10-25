import crypto from 'crypto';
import type { Assessment, AssessmentInvitation, ProfessorProfile, Question } from '../src/types';
import type { Database } from './db';
import { MOCK_QUESTIONS } from './demoData';
import { hashPassword } from './security';
import { createAttempt, finalizeAttempt } from './services/attempts';
import type { StoredUser } from './types';

/**
 * A ready-made sandbox for the administrator: one professor with a published exam and students in
 * every stage of the process. Their passwords are random per deployment and shown only in the admin
 * portal, and the admin can open these (and only these) accounts directly. They are ordinary
 * accounts otherwise, so they go through exactly the same permission checks as real ones.
 *
 * Created automatically unless SIFTED_TEST_ACCOUNTS=off, or the admin removed them.
 */

const DOMAIN = 'sandbox.sifted.test';
const AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
const QUESTION_SOURCES = ['q-mc-1', 'q-math-1', 'q-sa-1', 'q-prog-1', 'q-essay-1'];

type Stage = 'ready' | 'submitted' | 'interview' | 'unverified';

const PROFESSOR = {
  name: 'Dr. Test Professor',
  email: `professor@${DOMAIN}`,
  department: 'Computer Science',
  labName: 'Sandbox Research Lab',
  note: 'Owns the "Sandbox Screening Exam". Review submissions, schedule interviews, build exams and invite students.',
};

const STUDENTS: Array<{ stage: Stage; name: string; email: string; university: string; degreeProgram: string; note: string }> = [
  {
    stage: 'ready',
    name: 'Riley Ready',
    email: `ready.student@${DOMAIN}`,
    university: 'Sandbox State University',
    degreeProgram: 'B.S. in Computer Science',
    note: 'Has the sandbox exam waiting. Take the exam as this student.',
  },
  {
    stage: 'submitted',
    name: 'Sam Submitted',
    email: `submitted.student@${DOMAIN}`,
    university: 'Sandbox Institute of Technology',
    degreeProgram: 'B.S. in Mathematics',
    note: 'Already submitted the exam. Waiting for the professor to review it.',
  },
  {
    stage: 'interview',
    name: 'Ivy Interview',
    email: `interview.student@${DOMAIN}`,
    university: 'Sandbox College',
    degreeProgram: 'B.S. in Data Science',
    note: 'Invited to an interview. Accept or decline it as this student.',
  },
  {
    stage: 'unverified',
    name: 'Nova New',
    email: `new.student@${DOMAIN}`,
    university: 'Sandbox Polytechnic',
    degreeProgram: 'B.A. in Physics',
    note: 'Just registered and not verified yet. Verify them in the directory, then invite them.',
  },
];

const NOTES = new Map<string, string>([[PROFESSOR.email, PROFESSOR.note], ...STUDENTS.map((s) => [s.email, s.note] as [string, string])]);

export function testAccountNote(email: string) {
  return NOTES.get(email);
}

export function testAccountsEnabled(db: Database) {
  return process.env.SIFTED_TEST_ACCOUNTS !== 'off' && db.data.settings.testAccounts !== 'off';
}

/** Creates the sandbox if it's enabled and doesn't exist yet. */
export async function ensureTestAccounts(db: Database) {
  if (!testAccountsEnabled(db) || db.data.users.some((u) => u.isTestAccount)) return false;
  await createTestAccounts(db);
  return true;
}

/** Deletes every test account and everything connected to one. */
export function removeTestAccounts(db: Database) {
  const testUsers = db.data.users.filter((u) => u.isTestAccount);
  const userIds = new Set(testUsers.map((u) => u.id));
  const emails = new Set(testUsers.map((u) => u.email));
  const professorIds = new Set(testUsers.map((u) => u.professorId).filter(Boolean));
  const assessmentIds = new Set(db.data.assessments.filter((a) => professorIds.has(a.professorId)).map((a) => a.id));

  db.data.users = db.data.users.filter((u) => !userIds.has(u.id));
  db.data.professors = db.data.professors.filter((p) => !professorIds.has(p.id));
  db.data.assessments = db.data.assessments.filter((a) => !assessmentIds.has(a.id));
  db.data.questions = db.data.questions.filter((q) => !q.professorId || !professorIds.has(q.professorId));
  db.data.invitations = db.data.invitations.filter((i) => !professorIds.has(i.professorId) && !emails.has(i.applicantEmail.toLowerCase()));
  db.data.submissions = db.data.submissions.filter(
    (s) => !assessmentIds.has(s.assessmentId) && !(s.studentId && userIds.has(s.studentId)) && !emails.has(s.applicantEmail.toLowerCase())
  );
  db.data.attempts = db.data.attempts.filter((a) => !userIds.has(a.studentId) && !assessmentIds.has(a.assessmentId));
  db.data.sessions = db.data.sessions.filter((s) => !userIds.has(s.userId));
  db.save();
}

/** Throws away all sandbox data and builds a fresh copy. */
export async function resetTestAccounts(db: Database) {
  removeTestAccounts(db);
  db.data.settings.testAccounts = 'on';
  await createTestAccounts(db);
}

const newPassword = () => `Test-${crypto.randomBytes(9).toString('base64url')}`;
const isoDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

async function testUser(fields: Omit<StoredUser, 'id' | 'createdAt' | 'passwordHash' | 'isTestAccount' | 'testPassword'>): Promise<StoredUser> {
  const password = newPassword();
  return {
    ...fields,
    id: crypto.randomUUID(),
    isTestAccount: true,
    testPassword: password,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
}

// A plausible answer per question; `strong` decides whether multiple-choice answers are right
function sampleAnswer(question: Question, strong: boolean): string {
  switch (question.type) {
    case 'multiple-choice': {
      const correct = question.correctAnswers?.[0] || '';
      return strong ? correct : question.options?.find((o) => o !== correct) || correct;
    }
    case 'math':
      return strong ? question.symbolicAnswer || '' : 'I would compute the norm first, but I am not sure of the final value.';
    case 'programming':
      return `${question.codeTemplate || ''}\n# Sandbox answer: vectorised gradient with the bias term excluded from regularisation\n`;
    default:
      return strong
        ? `Sandbox answer. ${question.rubric || question.prompt}`
        : 'Sandbox answer: a short attempt that covers the main idea only briefly.';
  }
}

async function createTestAccounts(db: Database) {
  const now = new Date().toISOString();

  // Professor with a private copy of a few sample questions and one published exam
  const professor: ProfessorProfile = {
    id: crypto.randomUUID(),
    name: PROFESSOR.name,
    email: PROFESSOR.email,
    department: PROFESSOR.department,
    labName: PROFESSOR.labName,
    avatar: AVATAR,
    aiSensitivity: 'medium',
    allowLateSubmissions: false,
  };
  const professorUser = await testUser({
    name: PROFESSOR.name,
    email: PROFESSOR.email,
    role: 'professor',
    professorId: professor.id,
    avatar: AVATAR,
    department: PROFESSOR.department,
    labName: PROFESSOR.labName,
    isVerified: true,
  });
  const questions: Question[] = QUESTION_SOURCES.map((id) => MOCK_QUESTIONS.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined)
    .map((q) => ({ ...structuredClone(q), id: crypto.randomUUID(), professorId: professor.id, isPublic: false }));
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    professorId: professor.id,
    title: 'Sandbox Screening Exam',
    description: 'A practice exam for trying out Sifted: multiple choice, math, short answer, programming and an essay.',
    researchGroup: PROFESSOR.labName,
    semester: 'Sandbox',
    timeLimitMinutes: 30,
    isAdaptive: false,
    isScoreVisible: true,
    integrityOptions: {
      fullScreenMode: false,
      tabSwitchDetection: true,
      webcamMonitoring: false,
      copyPasteDetection: true,
      aiAnswerDetection: false,
      randomizeQuestionOrder: false,
      randomizeAnswerOrder: false,
    },
    questionIds: questions.map((q) => q.id),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
  db.data.professors.push(professor);
  db.data.users.push(professorUser);
  db.data.questions.push(...questions);
  db.data.assessments.push(assessment);

  for (const spec of STUDENTS) {
    const student = await testUser({
      name: spec.name,
      email: spec.email,
      secondaryEmail: `${spec.email.split('@')[0]}.personal@${DOMAIN}`,
      role: 'applicant',
      avatar: AVATAR,
      university: spec.university,
      degreeProgram: spec.degreeProgram,
      isVerified: spec.stage !== 'unverified',
    });
    db.data.users.push(student);
    if (spec.stage === 'unverified') continue;

    const invitation: AssessmentInvitation = {
      id: crypto.randomUUID(),
      assessmentId: assessment.id,
      professorId: professor.id,
      applicantEmail: student.email,
      applicantName: student.name,
      assignedAt: now,
      status: 'pending',
      deadline: isoDate(14),
      notes: 'Sandbox invitation: take your time.',
    };
    db.data.invitations.push(invitation);
    if (spec.stage === 'ready') continue;

    // Take the exam on the student's behalf, through the same code path as a real attempt
    const attempt = createAttempt(db, {
      invitationId: invitation.id,
      assessmentId: assessment.id,
      student,
      lockdown: false,
      details: { secondaryEmail: student.secondaryEmail!, university: spec.university, degreeProgram: spec.degreeProgram, gpa: '3.7' },
    });
    const strong = spec.stage === 'interview';
    attempt.startedAt = new Date(Date.now() - 22 * 60_000).toISOString();
    questions.forEach((q, i) => {
      attempt.responses[q.id] = sampleAnswer(q, strong || i % 2 === 0);
      attempt.timeSpent[q.id] = 120 + i * 45;
    });
    const submission = await finalizeAttempt(db, attempt.id, { autoSubmitted: false, skipAi: true });

    if (spec.stage === 'interview') {
      const stored = db.data.submissions.find((s) => s.id === submission.id)!;
      Object.assign(stored, {
        professorDecision: 'Interview',
        status: 'reviewed',
        interviewDate: isoDate(7),
        interviewTime: '2:00 PM',
        meetingLink: 'https://meet.example.com/sifted-sandbox',
        meetingConfirmed: true,
        professorNotes: 'Sandbox: strong answers, invited to interview.',
      });
      invitation.status = 'reviewed';
      invitation.reviewedAt = new Date().toISOString();
    }
  }
  db.save();
}
