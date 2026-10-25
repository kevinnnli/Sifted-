import type {
  ApplicantSubmission,
  Assessment,
  AssessmentInvitation,
  ProfessorProfile,
  Question,
  UserAccount,
} from '../src/types';

// Server-only account record: the password hash never leaves the server
export interface StoredUser extends UserAccount {
  passwordHash?: string;
  createdAt: string;
  // Test accounts only: the password, shown to the administrator so they can hand it out or use it
  testPassword?: string;
}

export interface Session {
  tokenHash: string; // SHA-256 of the cookie token; the raw token is never stored
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ExamAttempt {
  id: string;
  invitationId: string;
  assessmentId: string;
  studentId: string;
  startedAt: string;
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
  responses: Record<string, any>;
  flagged: Record<string, boolean>;
  currentQuestionIndex: number;
  timeSpent: Record<string, number>;
  tabSwitches: number;
  copyPasteAttempts: number;
  integrityEvents: string[];
  lockdown: boolean;
  details: { secondaryEmail: string; university: string; degreeProgram: string; gpa?: string };
  updatedAt: string;
}

export interface DatabaseShape {
  version: number;
  users: StoredUser[];
  professors: ProfessorProfile[];
  assessments: Assessment[];
  questions: Question[];
  invitations: AssessmentInvitation[];
  submissions: ApplicantSubmission[];
  attempts: ExamAttempt[];
  sessions: Session[];
  settings: { testAccounts?: 'on' | 'off' };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: StoredUser;
    }
  }
}
