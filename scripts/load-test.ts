/**
 * Controlled load test for a local production build. Never point this at a live deployment.
 *
 *   npm run build
 *   node --import tsx scripts/load-test.ts [--students 300] [--history 2000] [--out results.json] [--keep]
 *
 * Or the Vercel set-up: several function instances sharing one store, through a local stand-in for
 * the Upstash REST API (with simulated network latency):
 *
 *   npm run build:vercel
 *   node --import tsx scripts/load-test.ts --vercel 3 [--redis-latency 5] [--function .vercel/output/functions/api.func/index.cjs]
 *
 * It seeds a throwaway database (one professor, N verified students with an invitation each, and
 * H historical submissions so the data has a realistic size), starts `dist/server.cjs` against it
 * on a free port, and then walks every student through a real exam journey:
 *
 *   sign in → load the portal → start the test → autosave at rising concurrency → submit twice at once
 *
 * It reports throughput, latency percentiles, failures and the server's peak memory per phase, and
 * checks correctness: exactly one submission per student, nobody signed out by the journey.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Database } from '../server/db';
import { MOCK_QUESTIONS } from '../server/demoData';
import { hashPassword } from '../server/security';
import type { StoredUser } from '../server/types';
import type { ApplicantSubmission, Assessment, AssessmentInvitation, ProfessorProfile, Question } from '../src/types';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const STUDENTS = Number(arg('students', '300'));
const HISTORY = Number(arg('history', '2000'));
const OUT = arg('out', '');
// Keep the database afterwards (prints its path), e.g. to profile serialisation
const KEEP = args.includes('--keep');
const SERVER = path.resolve(arg('server', 'dist/server.cjs'));
const VERCEL_INSTANCES = Number(arg('vercel', '0'));
const FUNCTION = path.resolve(arg('function', '.vercel/output/functions/api.func/index.cjs'));
const REDIS_LATENCY_MS = Number(arg('redis-latency', '5'));
const PASSWORD = 'load-test-password-1';

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

const words = 'gradient regularisation variance estimator eigenvalue convergence attention complexity sampling bias overfitting kernel'.split(' ');
const essay = (n: number) => Array.from({ length: n }, (_, i) => words[(i * 7 + n) % words.length]).join(' ');

async function seed(file: string | null) {
  const db = new Database(file);
  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date().toISOString();
  const professor: ProfessorProfile = { id: crypto.randomUUID(), name: 'Dr. Load', email: 'load.prof@uni.example', department: 'CS', labName: 'Load Lab', avatar: '' };
  db.data.professors.push(professor);
  db.data.users.push({ id: crypto.randomUUID(), name: professor.name, email: professor.email, role: 'professor', professorId: professor.id, isVerified: true, passwordHash, createdAt: now });
  const questions: Question[] = ['q-mc-1', 'q-math-1', 'q-sa-1', 'q-prog-1', 'q-essay-1']
    .map((id) => MOCK_QUESTIONS.find((q) => q.id === id)!)
    .map((q) => ({ ...structuredClone(q), id: crypto.randomUUID(), professorId: professor.id, isPublic: false }));
  db.data.questions.push(...questions);
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    professorId: professor.id,
    title: 'Load Test Exam',
    description: '',
    researchGroup: 'Load Lab',
    semester: 'Load',
    timeLimitMinutes: 120,
    isAdaptive: false,
    isScoreVisible: false,
    integrityOptions: { fullScreenMode: false, tabSwitchDetection: true, webcamMonitoring: false, copyPasteDetection: true, aiAnswerDetection: false, randomizeQuestionOrder: true, randomizeAnswerOrder: true },
    questionIds: questions.map((q) => q.id),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
  db.data.assessments.push(assessment);

  const students: { email: string; invitationId: string }[] = [];
  for (let i = 0; i < STUDENTS; i++) {
    const email = `student${i}@uni.example`;
    const user: StoredUser = { id: crypto.randomUUID(), name: `Student ${i}`, email, role: 'applicant', university: 'Example University', degreeProgram: 'B.S.', isVerified: true, passwordHash, createdAt: now };
    db.data.users.push(user);
    const invitation: AssessmentInvitation = { id: crypto.randomUUID(), assessmentId: assessment.id, professorId: professor.id, applicantEmail: email, applicantName: user.name, assignedAt: now, status: 'pending' };
    db.data.invitations.push(invitation);
    students.push({ email, invitationId: invitation.id });
  }

  // Past submissions from people who have since left: they only make the data realistically large
  for (let i = 0; i < HISTORY; i++) {
    const responses: ApplicantSubmission['responses'] = {};
    for (const q of questions) {
      responses[q.id] = { questionId: q.id, answer: essay(120), timeSpentSeconds: 300, aiScore: 10, maxScore: q.points, difficultyWeight: 1.5, weightedScore: 15, maxWeightedScore: q.points * 1.5, aiConfidence: 60, aiFeedback: essay(30), isCorrect: true };
    }
    db.data.submissions.push({
      id: crypto.randomUUID(), assessmentId: assessment.id, applicantName: `Past ${i}`, applicantEmail: `past${i}@uni.example`, university: 'Example University', degreeProgram: 'B.S.',
      status: 'completed', startTime: now, finishTime: now, totalTimeSpentSeconds: 3000, responses, overallScore: 70, topicBreakdown: {}, timeAnalysis: {}, confidenceScore: 60,
      interviewRecommendation: 'Borderline', recommendationExplanation: essay(40), aiSummary: essay(20),
      integrityReport: { tabSwitchCount: 0, copyPasteAttempts: 0, aiGeneratedProbability: 0, integrityFlagged: false, notes: [] }, professorNotes: '', professorDecision: 'Pending',
    });
  }
  db.save();
  await db.flush();
  const json = JSON.stringify(db.data);
  return { students, data: db.data, sizeBytes: file ? fs.statSync(file).size : Buffer.byteLength(json) };
}

class Client {
  cookies = new Map<string, string>();
  private n: number;
  // With several bases (function instances) each request goes to the next one, like a load balancer
  constructor(private bases: string[], private ip: string, offset = 0) {
    this.n = offset;
  }
  async request(method: string, url: string, body?: unknown) {
    const started = performance.now();
    const base = this.bases[this.n++ % this.bases.length];
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sifted-Request': '1',
        'X-Forwarded-For': this.ip,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...rest] = pair.split('=');
      if (/max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, rest.join('='));
    }
    const data: any = await res.json().catch(() => null);
    return { status: res.status, data, ms: performance.now() - started };
  }
}

interface PhaseResult {
  phase: string;
  requests: number;
  failed: number;
  reqPerSec: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  peakRssMb: number;
}

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);

function rssMb(pids: number[]) {
  let kb = 0;
  for (const pid of pids) {
    try {
      kb += Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1]) || 0;
    } catch {
      // process gone
    }
  }
  return Math.round(kb / 1024);
}

async function phase(name: string, pid: number[], jobs: (() => Promise<{ ok: boolean; ms: number }>)[], concurrency: number): Promise<PhaseResult> {
  let peak = rssMb(pid);
  const sampler = setInterval(() => (peak = Math.max(peak, rssMb(pid))), 50);
  const times: number[] = [];
  let failed = 0;
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          const r = await job();
          times.push(r.ms);
          if (!r.ok) failed++;
        } catch {
          failed++;
        }
      }
    })
  );
  const seconds = (performance.now() - started) / 1000;
  clearInterval(sampler);
  times.sort((a, b) => a - b);
  const round = (n: number) => Math.round(n);
  const result = { phase: name, requests: jobs.length, failed, reqPerSec: round(jobs.length / seconds), p50: round(pct(times, 50)), p95: round(pct(times, 95)), p99: round(pct(times, 99)), max: round(times.at(-1) || 0), peakRssMb: peak };
  console.log(
    `${name.padEnd(28)} ${String(result.requests).padStart(5)} req  ${String(result.failed).padStart(4)} failed  ${String(result.reqPerSec).padStart(5)} req/s  p50 ${result.p50} ms  p95 ${result.p95} ms  p99 ${result.p99} ms  max ${result.max} ms  peak RSS ${peak} MB`
  );
  return result;
}

const SERVER_ENV = {
  NODE_ENV: 'production',
  ADMIN_EMAIL: 'admin@uni.example',
  ADMIN_PASSWORD: 'load-test-admin-password',
  SIFTED_TEST_ACCOUNTS: 'off',
  GEMINI_API_KEY: '',
  SEED_DEMO_DATA: '',
};

async function waitUntilUp(base: string) {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) return;
    } catch {
      // not up yet
    }
    if (i > 200) throw new Error(`${base} did not start`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Stand-in for the Upstash REST API with the two commands Sifted uses: GET, and the compare-and-set
 * EVAL from server/storage.ts (applied atomically here rather than by running Lua).
 */
async function fakeRedis(initial: unknown) {
  const kv = new Map<string, string>([
    ['sifted:database', JSON.stringify({ revision: 1, data: initial })],
    ['sifted:revision', '1'],
  ]);
  let writes = 0;
  let refused = 0;
  const http = await import('http');
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () =>
      setTimeout(() => {
        const cmd = JSON.parse(Buffer.concat(chunks).toString()) as string[];
        let result: unknown = null;
        if (cmd[0] === 'GET') result = kv.get(cmd[1]) ?? null;
        else if (cmd[0] === 'EVAL') {
          const [, , , dataKey, revisionKey, value, expected, next] = cmd;
          if (Number(kv.get(revisionKey) || 0) !== Number(expected)) {
            refused++;
            result = 0;
          } else {
            kv.set(dataKey, value);
            kv.set(revisionKey, next);
            writes++;
            result = 1;
          }
        } else {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: `unsupported ${cmd[0]}` }));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ result }));
      }, REDIS_LATENCY_MS)
    );
  });
  const port = await freePort();
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  return { url: `http://127.0.0.1:${port}`, stats: () => ({ writes, refused }), close: () => server.close() };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sifted-load-'));
  const file = VERCEL_INSTANCES ? null : path.join(dir, 'database.json');
  console.log(`Seeding ${STUDENTS} students and ${HISTORY} past submissions…`);
  const { students, data, sizeBytes } = await seed(file);
  console.log(`Database: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB`);

  const processes: ReturnType<typeof spawn>[] = [];
  const bases: string[] = [];
  let redis: Awaited<ReturnType<typeof fakeRedis>> | null = null;
  if (VERCEL_INSTANCES) {
    if (!fs.existsSync(FUNCTION)) throw new Error(`${FUNCTION} not found: run npm run build:vercel first`);
    redis = await fakeRedis(data);
    console.log(`${VERCEL_INSTANCES} function instances, store latency ${REDIS_LATENCY_MS} ms per command`);
    for (let i = 0; i < VERCEL_INSTANCES; i++) {
      const port = await freePort();
      const child = spawn(process.execPath, ['-e', `require('http').createServer(require(${JSON.stringify(FUNCTION)})).listen(${port}, '127.0.0.1')`], {
        env: { ...process.env, ...SERVER_ENV, KV_REST_API_URL: redis.url, KV_REST_API_TOKEN: 'load-test' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stderr!.on('data', (d) => process.stderr.write(`[instance ${i}] ${d}`));
      processes.push(child);
      bases.push(`http://127.0.0.1:${port}`);
    }
  } else {
    if (!fs.existsSync(SERVER)) throw new Error(`${SERVER} not found: run npm run build first`);
    const port = await freePort();
    const child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, ...SERVER_ENV, PORT: String(port), DATABASE_FILE: file! },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr!.on('data', (d) => process.stderr.write(`[server] ${d}`));
    processes.push(child);
    bases.push(`http://127.0.0.1:${port}`);
  }
  for (const base of bases) await waitUntilUp(base);

  const pid = processes.map((p) => p.pid!);
  // Each student behind their own address, as on a real network
  const clients = students.map((s, i) => ({
    ...s,
    client: new Client(bases, `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, i),
    attemptId: '',
    responses: {} as Record<string, string>,
  }));
  const results: PhaseResult[] = [];
  const ok = (status: number, expected = [200, 201]) => expected.includes(status);

  results.push(await phase('sign in (50 at a time)', pid, clients.map((c) => async () => {
    const r = await c.client.request('POST', '/api/auth/login', { email: c.email, password: PASSWORD });
    return { ok: ok(r.status), ms: r.ms };
  }), 50));

  results.push(await phase('portal (50 at a time)', pid, clients.map((c) => async () => {
    const r = await c.client.request('GET', '/api/student/portal');
    return { ok: ok(r.status), ms: r.ms };
  }), 50));

  results.push(await phase('start test (50 at a time)', pid, clients.map((c) => async () => {
    const r = await c.client.request('POST', `/api/student/invitations/${c.invitationId}/attempt`, { lockdown: false, details: { university: 'Example University', degreeProgram: 'B.S.' } });
    if (r.data?.attempt) {
      c.attemptId = r.data.attempt.id;
      // A realistic autosave carries every answer so far: the first option, or a paragraph of text
      for (const q of r.data.attempt.questions) c.responses[q.id] = q.options ? q.options[0] : essay(150);
    }
    return { ok: ok(r.status), ms: r.ms };
  }), 50));

  for (const concurrency of [25, 100, STUDENTS]) {
    results.push(await phase(`autosave (${concurrency} concurrent)`, pid, clients.map((c, i) => async () => {
      const r = await c.client.request('PUT', `/api/student/attempts/${c.attemptId}`, { responses: c.responses, currentQuestionIndex: i % 5, timeSpent: {}, tabSwitches: 0, copyPasteAttempts: 0, integrityEvents: [] });
      return { ok: ok(r.status), ms: r.ms };
    }), concurrency));
  }

  // Every student double-submits (two tabs, or a retry racing the first request)
  const submissionIds = new Map<string, Set<string>>();
  results.push(await phase('submit twice at once', pid, clients.flatMap((c) => [0, 1].map(() => async () => {
    const r = await c.client.request('POST', `/api/student/attempts/${c.attemptId}/submit`, { responses: c.responses });
    const id = r.data?.submission?.id;
    if (id) (submissionIds.get(c.email) ?? submissionIds.set(c.email, new Set()).get(c.email)!).add(id);
    // The second of a pair may find the attempt already submitted; that is the expected answer
    return { ok: ok(r.status) || r.status === 404 || r.status === 400, ms: r.ms };
  })), STUDENTS));

  let signedOut = 0;
  let missing = 0;
  let duplicates = 0;
  for (const c of clients) {
    const me = await c.client.request('GET', '/api/auth/me');
    if (!me.data?.user) signedOut++;
    const portal = await c.client.request('GET', '/api/student/portal');
    const mine = (portal.data?.submissions || []).length;
    if (mine === 0) missing++;
    if (mine > 1) duplicates++;
  }
  console.log(`After submitting: ${signedOut} signed out, ${missing} without a submission, ${duplicates} with duplicates`);

  const storeStats = redis?.stats();
  if (storeStats) console.log(`Store: ${storeStats.writes} writes accepted, ${storeStats.refused} refused because another instance wrote first`);
  for (const p of processes) p.kill('SIGTERM');
  redis?.close();
  if (KEEP && file) console.log(`Database kept at ${file}`);
  else fs.rmSync(dir, { recursive: true, force: true });
  if (OUT) {
    const summary = { students: STUDENTS, history: HISTORY, vercelInstances: VERCEL_INSTANCES, databaseMb: +(sizeBytes / 1024 / 1024).toFixed(1), results, signedOut, missing, duplicates, store: storeStats };
    fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
