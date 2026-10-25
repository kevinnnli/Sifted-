import type {
  AdminAccountDetail,
  AdminOverview,
  ApplicantSubmission,
  Assessment,
  AssessmentInvitation,
  AttemptProgress,
  ExamAttemptView,
  ProfessorDecision,
  ProfessorProfile,
  ProfessorWorkspaceData,
  Question,
  StudentPortalData,
  StudentSubmissionView,
  UserAccount,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when the server reports the session is gone (expired, signed out elsewhere, account disabled). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        // Required by the server's cross-site request forgery guard
        'X-Sifted-Request': '1',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/') && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
  }
  return data as T;
}

const get = <T>(url: string) => request<T>('GET', url);
const post = <T>(url: string, body: unknown = {}) => request<T>('POST', url, body);
const put = <T>(url: string, body: unknown = {}) => request<T>('PUT', url, body);
const patch = <T>(url: string, body: unknown = {}) => request<T>('PATCH', url, body);
const del = <T>(url: string) => request<T>('DELETE', url);
const id = encodeURIComponent;

export interface SignupInput {
  name: string;
  email: string;
  secondaryEmail: string;
  university: string;
  degreeProgram: string;
  password: string;
}

export interface ReviewPatch {
  professorDecision?: ProfessorDecision;
  professorNotes?: string;
  interviewDate?: string;
  interviewTime?: string;
  meetingLink?: string;
  scoreOverrides?: Record<string, number>;
}

export type AssessmentInput = Pick<
  Assessment,
  'title' | 'description' | 'researchGroup' | 'semester' | 'timeLimitMinutes' | 'isAdaptive' | 'isScoreVisible' | 'integrityOptions' | 'questionIds'
> & { isPublished: boolean };

export const api = {
  health: () => get<{ status: string; aiConfigured: boolean }>('/api/health'),

  auth: {
    me: () => get<{ user: UserAccount | null }>('/api/auth/me'),
    login: (email: string, password: string) => post<{ user: UserAccount }>('/api/auth/login', { email, password }),
    register: (input: SignupInput) => post<{ user: UserAccount }>('/api/auth/register', input),
    logout: () => post<{ success: boolean }>('/api/auth/logout'),
    changePassword: (currentPassword: string, newPassword: string) =>
      post<{ user: UserAccount }>('/api/auth/change-password', { currentPassword, newPassword }),
  },

  professor: {
    workspace: () => get<ProfessorWorkspaceData>('/api/professor/workspace'),
    updateProfile: (profile: Pick<ProfessorProfile, 'labName' | 'email' | 'aiSensitivity' | 'allowLateSubmissions'>) =>
      put<{ professor: ProfessorProfile }>('/api/professor/profile', profile),
    createAssessment: (assessment: AssessmentInput) => post<{ assessment: Assessment }>('/api/professor/assessments', { assessment }),
    updateAssessment: (assessmentId: string, assessment: AssessmentInput) =>
      put<{ assessment: Assessment }>(`/api/professor/assessments/${id(assessmentId)}`, { assessment }),
    createQuestion: (question: Partial<Question>) => post<{ question: Question }>('/api/professor/questions', { question }),
    updateQuestion: (questionId: string, question: Partial<Question>) =>
      put<{ question: Question }>(`/api/professor/questions/${id(questionId)}`, { question }),
    generateQuestion: (input: Record<string, string>) =>
      post<{ question: Partial<Question>; isFallback: boolean }>('/api/professor/ai/generate-question', input),
    invite: (input: { assessmentId: string; emails: string[]; deadline?: string; notes?: string }) =>
      post<{ created: AssessmentInvitation[]; skipped: { email: string; reason: string }[] }>('/api/professor/invitations', input),
    reviewSubmission: (submissionId: string, patch: ReviewPatch) =>
      put<{ submission: ApplicantSubmission }>(`/api/professor/submissions/${id(submissionId)}/review`, patch),
    deleteSubmission: (submissionId: string) => del<{ success: boolean }>(`/api/professor/submissions/${id(submissionId)}`),
    briefing: (submissionId: string) =>
      post<{ analysis: string; isFallback: boolean }>(`/api/professor/submissions/${id(submissionId)}/briefing`),
  },

  student: {
    portal: () => get<StudentPortalData>('/api/student/portal'),
    updateProfile: (profile: { secondaryEmail: string; university: string; degreeProgram: string }) =>
      put<{ profile: UserAccount }>('/api/student/profile', profile),
    startAttempt: (invitationId: string, input: { lockdown: boolean; details?: Record<string, string> }) =>
      post<{ attempt: ExamAttemptView }>(`/api/student/invitations/${id(invitationId)}/attempt`, input),
    saveAttempt: (attemptId: string, progress: AttemptProgress) =>
      put<{ savedAt: string; serverNow: string }>(`/api/student/attempts/${id(attemptId)}`, progress),
    submitAttempt: (attemptId: string, progress: AttemptProgress & { auto?: boolean }) =>
      post<{ submission: StudentSubmissionView }>(`/api/student/attempts/${id(attemptId)}/submit`, progress),
    rsvp: (submissionId: string, response: 'Accepted' | 'Declined') =>
      post<{ submission: StudentSubmissionView }>(`/api/student/submissions/${id(submissionId)}/rsvp`, { response }),
    hideSubmission: (submissionId: string) => post<{ success: boolean }>(`/api/student/submissions/${id(submissionId)}/hide`),
  },

  admin: {
    overview: () => get<AdminOverview>('/api/admin/overview'),
    account: (accountId: string) => get<AdminAccountDetail>(`/api/admin/accounts/${id(accountId)}`),
    createProfessor: (input: { name: string; email: string; department: string; labName: string; avatar?: string; temporaryPassword: string }) =>
      post<{ account: UserAccount }>('/api/admin/professors', input),
    setPassword: (accountId: string, newPassword: string) =>
      post<{ account: UserAccount }>(`/api/admin/accounts/${id(accountId)}/password`, { newPassword }),
    updateAccount: (accountId: string, changes: { disabled?: boolean; isVerified?: boolean }) =>
      patch<{ account: UserAccount }>(`/api/admin/accounts/${id(accountId)}`, changes),
    deleteAccount: (accountId: string) => del<{ success: boolean }>(`/api/admin/accounts/${id(accountId)}`),
    resetDemo: () => post<{ success: boolean }>('/api/admin/reset-demo'),
  },
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
