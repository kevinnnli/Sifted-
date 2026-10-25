import type { AddressInfo } from 'net';
import { createApp } from '../app';
import { ensureEnvAdmin } from '../bootstrap';
import { Database } from '../db';

export const ADMIN_EMAIL = 'owner@sifted.test';
export const ADMIN_PASSWORD = 'correct-horse-battery-staple';

export async function startTestServer(env: Record<string, string | undefined> = {}) {
  Object.assign(process.env, { ADMIN_EMAIL, ADMIN_PASSWORD, STUDENT_VERIFICATION: undefined, GEMINI_API_KEY: '' }, env);
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
  const db = new Database(null);
  await ensureEnvAdmin(db);
  const app = createApp(db);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    db,
    base,
    client: () => new TestClient(base),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A browser-like client that keeps its own cookies. */
export class TestClient {
  readonly cookies = new Map<string, string>();
  constructor(private readonly base: string) {}

  /** The Cookie header this client sends; assigning one replaces all cookies (to replay a stolen header). */
  get cookie() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
  set cookie(header: string) {
    this.cookies.clear();
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name) this.cookies.set(name, rest.join('='));
    }
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sifted-Request': '1',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (!value || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // empty body
    }
    return { status: res.status, data, headers: res.headers };
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body?: unknown) => this.request('POST', path, body ?? {});
  put = (path: string, body?: unknown) => this.request('PUT', path, body ?? {});
  patch = (path: string, body?: unknown) => this.request('PATCH', path, body ?? {});
  del = (path: string) => this.request('DELETE', path);

  async login(email: string, password: string) {
    const res = await this.post('/api/auth/login', { email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.user;
  }
}

export const studentSignup = (overrides: Record<string, string> = {}) => ({
  name: 'Jordan Taylor',
  email: 'jtaylor@uni.edu',
  secondaryEmail: 'jordan.personal@gmail.com',
  university: 'State University',
  degreeProgram: 'B.S. Computer Science',
  password: 'student-pass-123',
  ...overrides,
});

/** Admin creates a professor; the professor signs in and replaces the temporary password. */
export async function createProfessor(
  admin: TestClient,
  professor: TestClient,
  email = 'prof@uni.edu',
  password = 'professor-pass-123'
) {
  const created = await admin.post('/api/admin/professors', {
    name: 'Dr. Ada Lovelace',
    email,
    department: 'Computer Science',
    labName: 'Analytical Engines Lab',
    temporaryPassword: 'temporary-pass-1',
  });
  if (created.status !== 201) throw new Error(`create professor failed: ${JSON.stringify(created.data)}`);
  await professor.login(email, 'temporary-pass-1');
  const changed = await professor.post('/api/auth/change-password', { currentPassword: 'temporary-pass-1', newPassword: password });
  if (changed.status !== 200) throw new Error(`password change failed: ${JSON.stringify(changed.data)}`);
  return created.data.account;
}

export const mcQuestion = {
  type: 'multiple-choice',
  title: 'Primes',
  prompt: 'Which number is prime?',
  difficulty: 'Basic',
  topic: 'Algorithms',
  points: 10,
  rubric: 'Seven is the only prime option.',
  sampleAnswer: '7',
  options: ['4', '7', '9'],
  correctAnswers: ['7'],
  isPublic: false,
};

export const essayQuestion = {
  type: 'short-answer',
  title: 'Overfitting',
  prompt: 'Explain overfitting.',
  difficulty: 'Intermediate',
  topic: 'Machine Learning',
  points: 10,
  rubric: 'Training loss decreases while validation loss increases; regularization, early stopping, dropout.',
  sampleAnswer: 'The model memorizes training noise.',
  isPublic: false,
};

export function assessmentBody(questionIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    title: 'Fall Screening',
    description: 'Screening exam',
    researchGroup: 'Lab',
    semester: 'Fall 2027',
    timeLimitMinutes: 30,
    isAdaptive: false,
    isScoreVisible: false,
    isPublished: true,
    integrityOptions: { fullScreenMode: false, randomizeQuestionOrder: false, randomizeAnswerOrder: false },
    questionIds,
    ...overrides,
  };
}
