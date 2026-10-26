# Sifted: privacy and security reference

This document records how Sifted protects accounts and data, what personal information it handles,
and the limits of the current architecture. It is written for the operator of a deployment and for
anyone reviewing the public policies (`/privacy`, `/terms`, `/cookies`, `/data-deletion`,
`/refunds`), which are generated from `src/components/legal/policies.tsx` and must stay consistent
with this file.

It describes the software. It is not legal advice, and nothing here has been reviewed by a lawyer.

## 1. Security architecture

| Area | How it works | Code |
| --- | --- | --- |
| Passwords | scrypt (N=16384, r=8, p=1), random salt, constant-time comparison. Minimum 8 characters; very common passwords and passwords containing the email name are refused. | `server/security.ts` |
| Sessions | 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie. Over HTTPS (always in production) it is `Secure` and named `__Host-sifted_session`: browsers accept that prefix only from this exact host, with `Path=/` and no `Domain`, so a site on a sibling subdomain cannot plant or overwrite it. A session issued that way is refused if it arrives in an unprefixed cookie. Sessions from before the prefix keep working and move to the prefixed cookie on their next request. Only a SHA-256 hash of the token is stored. Ends after 7 days without activity and at most 30 days after sign-in; activity renews it at most once an hour. A new token is issued at every sign-in and registration (no session fixation). A malformed cookie is ignored rather than failing the request. | `server/security.ts` |
| Session invalidation | Sign-out; password change (other devices); admin password reset, disable or delete (all devices); account deletion. Expired sessions are pruned every 30 seconds. | `server/security.ts`, `server/routes/*` |
| Authorization | Every API route checks the role on the server (`requireRole`). Every lookup is scoped to the signed-in account: students by their own id/email, professors by ownership of the assessment. Users who must change a temporary password can do nothing else first. A professor sees a student's name, university and programme only after that student starts or submits one of the professor's tests; before that, only the email the professor typed and whether an account exists for it. | `server/routes/*` |
| Admin access | Only the account defined by `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the server configuration. Nobody can create or promote an administrator through the web app. The admin can open the built-in test accounts, never a real user's account. | `server/bootstrap.ts`, `server/routes/admin.ts` |
| Test accounts | Kept separate from real accounts: sandbox professors can only invite sandbox students, real professors cannot invite sandbox addresses, sandbox questions never enter the shared bank, and the sandbox email domain cannot be registered. | `server/testAccounts.ts` |
| CSRF | State-changing requests must carry `X-Sifted-Request: 1` (which a cross-site form cannot send without a CORS preflight that the server never approves) and, when present, a matching `Origin`. No CORS headers are sent. | `server/security.ts` |
| Rate limits | Failed sign-ins: 5 per account per address and 100 per address per 15 minutes. Registrations: 60 per address per hour. Wrong current password (change password, delete account): 5 per account per 15 minutes. AI calls: 60 per professor per hour. Limits are per server instance. | `server/routes/*` |
| Headers | `Content-Security-Policy` (`script-src 'self'`, no `unsafe-eval`, no third-party origins), `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`. API responses are `Cache-Control: no-store`. Defined once and shared by the Express server and the Vercel build. | `server/securityHeaders.mjs` |
| Input validation | All request bodies are validated on the server (types, lengths, enums, http(s)-only links, multiple-choice answers must be one of the options). Bodies over 1 MB are refused. | `server/validation.ts` |
| Exams | The server owns the clock, question order, answer keys and grading. Answer keys, rubrics and model answers are never sent to students. Integrity counters can only increase. An autosave is validated in full before anything is applied, and refused while the same test is being graded. Duplicate submissions are de-duplicated, also across server instances. Each submission records whether AI grading was used (`gradedWithAi`). | `server/services/attempts.ts`, `server/views.ts` |
| Errors and logs | Users get generic error messages; stack traces stay in server logs. AI errors are logged as a message only, because they can echo student answers. | `server/security.ts`, `server/services/ai.ts` |
| Storage | Local file: atomic writes (temporary file + rename, mode 0600), group commit, a request's change is on disk before it is acknowledged. Tests in progress are also written to a small companion file (`database.attempts.json`), so an autosave does not rewrite the whole database; both copies carry a revision number and loading takes the newer one. The main file is always a complete database on its own. Vercel: Upstash Redis with compare-and-set, so concurrent instances cannot overwrite each other; sign-in, registration, sign-out, starting, autosaving and submitting a test re-apply their change to the newer data when another instance saved first (up to 8 attempts with random back-off), instead of failing. | `server/db.ts`, `server/storage.ts` |

### Findings fixed in the second October 2026 review

Each was reproduced before the fix and is covered by a test (`server/tests/cookies.test.ts`, `storage.test.ts`, `vercel.test.ts`, `policies.test.ts`).

| Finding | Severity | Fix |
| --- | --- | --- |
| A malformed `sifted_session` cookie (for example one set by another site on the same domain) made every API request fail with 500, including sign-in, until the visitor cleared their cookies. | High (availability of accounts) | Malformed cookies are ignored. |
| Vercel: concurrent writes from different function instances were refused instead of retried. In a three-instance simulation of 120 students, 95 sign-ins failed and those students could not start or submit. A submission graded by AI held its write open for the whole AI call (up to 20 s), so under steady traffic it could fail on every retry. | High (data integrity, availability) | Grading happens before the write; the write re-applies itself to newer data when another instance saved first. Same simulation afterwards: 0 failed sign-ins, starts or submissions, 0 duplicates (see section 4). |
| Professors could learn the name, university and degree programme of any registered student by entering their email in an invitation. | Medium (privacy) | Shared only after the student starts or submits one of that professor's tests. |
| Session cookies had no `__Host-` prefix, so a sibling subdomain (common on university domains) could set a cookie with the same name. | Medium | `__Host-` prefix over HTTPS, with a safe move for existing sessions. |
| An autosave arriving while the same test was being graded could change it; an over-long answer could leave an autosave half applied. | Low | Refused while grading; validated before applying. |
| Errors from the Vercel entry point used a `message` field the app does not read, so students saw "Request failed (503)" instead of the explanation. | Low | Uses `error` like the rest of the API. |
| Labels said "AI recommendation", "AI confidence" and "AI-generated probability: 0%" when no AI was used; an integrity counter was described as "bulk clipboard paste events" but counts blocked copy, cut and paste attempts; students saw "AI Grading..." while submitting. | Medium (accuracy) | Labels state what actually produced each value; "not measured" where nothing was measured. |
| Demo data gave fictional people addresses at real universities and webmail providers, photos of real people from Unsplash, and real Google Meet links. New assessments were pre-filled with a sample title and description. | Low (accuracy, privacy) | Reserved `.example` domains, fictional "Demo" institutions, no photos; new assessments start blank. |
| Eight of ten dialogs had no dialog semantics, no Escape key, no focus containment and did not return focus when closed. | Medium (accessibility) | Shared behaviour (`src/components/ui/ModalBehavior.tsx`). |

### Findings fixed in the first October 2026 audit

| Finding | Severity | Fix |
| --- | --- | --- |
| Lockfile pinned `body-parser` 1.20.6 and `qs` 6.15.3 (denial-of-service advisories) and `vite` 6.4.3 (development-server advisories). | High | Updated within the existing ranges to `body-parser` 1.20.9, `qs` 6.16.1, `express` 4.22.3, `vite` 6.4.5. `npm audit` of the installed versions: 0 known vulnerabilities. |
| No Content-Security-Policy or HSTS. | Medium | Added (see table). The exam calculator used `new Function` (eval); replaced with a parser so the policy needs no `unsafe-eval`. A confetti effect created a blob worker blocked by the policy; removed with its dependency. |
| AI calls had no timeout; a slow AI service could hold up exam submission. | Medium | 20 s timeout (`AI_TIMEOUT_MS`); the deterministic grade is used on timeout. |
| Student names and universities were sent to Google Gemini. | Medium (privacy) | No longer sent; only questions, rubrics, answers and scores. |
| Sessions had a fixed 7-day life with no renewal or absolute limit. | Low | Rolling 7-day idle timeout with a 30-day absolute limit. |
| Registration did not end an earlier session in the same browser. | Low | Earlier session is destroyed. |
| No limit on guessing the current password from a signed-in session. | Low | Limited (see rate limits). |
| Per-address sign-in and registration limits (30 / 10) could block a class on one campus network. | Usability | Raised to 100 / 60; per-account limit unchanged. |
| Deleting a student kept their submissions (name, email, answers). | Medium (privacy) | Deletion now removes every record identifying the student. |
| External images (Unsplash) loaded on every page view, disclosing visitors' IP addresses to a third party. | Low (privacy) | Removed; initials are shown instead. No third-party requests remain. |
| Test accounts could interact with real accounts. | Low | Separated (see table). |
| Unused `motion` and `canvas-confetti` dependencies. | Hygiene | Removed. |

## 2. Personal data inventory

| Data | Why | Stored in | Visible to | Shared with | Retained until |
| --- | --- | --- | --- | --- | --- |
| Name, university email | Sign-in, matching invitations | Users | The student, admin; inviting professors once the student starts their test (before that, only the email they typed) | Hosting/storage provider | Account deleted |
| University, degree programme | Context for professors | Users, submissions | Same | Same | Account / submission deleted |
| Personal email (optional) | Alternative contact for inviting professors | Users, submissions | Same | Same | Same |
| GPA (optional, per test) | Context for the professor | Submission | Student's professor, admin | Same | Submission deleted |
| Password hash | Authentication | Users | Nobody (never sent to clients) | Storage provider | Account deleted or password changed |
| Session hash, created/expiry time | Keeping the user signed in | Sessions | Nobody | Storage provider | Expiry (≤ 30 days), then pruned |
| Account created / last sign-in time | Security, admin overview | Users | Admin | Storage provider | Account deleted |
| Answers, time per question, start/finish time | Assessment | Attempt (also in `database.attempts.json` with file storage), then submission | The professor, admin; student sees scores only if released | Storage provider; Gemini (answers only) when AI is enabled | Submission deleted |
| Integrity events (tab switches, copy/paste, full-screen exits) | Integrity monitoring the professor enabled | Attempt, then submission | The professor, admin | Storage provider; Gemini receives the summary for briefings | Submission deleted |
| Scores, AI feedback and recommendation, professor notes, decision, interview details | Evaluation | Submission | Professor, admin; the student sees decision, interview details and released scores, never notes | Storage provider | Submission deleted |
| IP address | Rate limiting | Server memory only (not stored) | Nobody | Hosting provider logs | Up to 1 hour in memory; provider log retention applies |
| Browser storage `sifted-exam-launch` | Passing confirmed details to a new exam tab | The student's browser | The student | Nobody | Read once by the exam tab, or 10 minutes |
| Browser storage `sifted-consent` | Remembering the cookie notice | The visitor's browser | The visitor | Nobody | Until cleared |

Test accounts additionally store their generated password so that the administrator can see it.
Those accounts hold only sandbox data.

Sifted sends no email, has no marketing communications, no analytics, no advertising and no
third-party scripts, fonts or images.

### Third parties

* **Hosting and storage**: whichever provider the operator uses (for example Vercel and Upstash).
* **Google Gemini API**: only when `GEMINI_API_KEY` is set. Question generation sends the
  professor's topic inputs; grading sends questions, rubrics, model answers, the student's answers
  and automatic scores; briefings send scores, topic results and the integrity summary. Names,
  email addresses and institutions are not sent.

## 3. Deletion

* Students: **My account → Delete account** (password required). Removes the account, every
  submission, invitations to their address, any test in progress and all sessions, immediately.
* Administrators: deleting a student in the admin portal performs the same erasure. Professors
  who own assessments can be disabled instead of deleted so students' records are not lost.
* Not covered: storage-provider backups, hosting-provider logs, data already processed by Gemini,
  and anything professors copied outside Sifted. See `/data-deletion`.

## 4. Performance and capacity

All figures below come from `scripts/load-test.ts`, run in the development container (4 CPU cores,
Node.js 22, production build). They are measurements from one machine, not a guarantee of capacity
in any hosting environment, and no load test was run against a live deployment.

The script seeds a throwaway database, starts the production server against it and walks every
student through sign-in, the portal, starting a test, autosaving at rising concurrency, and
submitting twice at once; it then checks that every student has exactly one submission and is still
signed in. Reproduce with `npm run build && node --import tsx scripts/load-test.ts`.

### Local file storage: 300 students, 2,000 past submissions (19.6 MB of data)

"Before" is the previous commit on this branch (`fee4a07`); "after" is this change. Two runs after
the change gave similar results; one is shown.

| Scenario | Before | After |
| --- | --- | --- |
| Sign in, 50 at a time | 49 req/s, median 968 ms, p95 1,150 ms | 63 req/s, median 721 ms, p95 812 ms |
| Load student portal, 50 at a time | 1,127 req/s, p95 58 ms | 1,496 req/s, p95 56 ms |
| Start test, 50 at a time | 139 req/s, median 337 ms, p95 455 ms | 157 req/s, median 318 ms, p95 340 ms |
| Autosave, 25 concurrent | 73 req/s, median 332 ms, p95 399 ms | 1,222 req/s, median 19 ms, p95 27 ms |
| Autosave, 100 concurrent | 267 req/s, median 359 ms, p95 476 ms | 1,393 req/s, median 77 ms, p95 103 ms |
| Autosave, 300 concurrent | 476 req/s, median 474 ms, p95 602 ms | 1,159 req/s, median 133 ms, p95 225 ms |
| Every student submits twice at once | 563 req/s, p95 1,039 ms | 718 req/s, p95 798 ms |
| Failures, duplicate submissions, students signed out | 0, 0, 0 | 0, 0, 0 |
| Peak memory (RSS) | 430 MB | 411 MB |

Where the time went: every change rewrote the whole database, and serialising 23.6 MB of JSON
takes about 100 ms (during which the server can do nothing else) plus 40–190 ms of disk I/O. The
tests in progress are about 2.6 MB for 300 students and serialise in about 6 ms, so autosaves,
the most frequent request during an exam, now write only those. Sign-in is dominated by password
hashing (scrypt), which is deliberately slow; on this 4-core machine Node's default 4-thread pool
already matches the core count.

### Vercel with Redis: three function instances, 120 students

Simulated with `node --import tsx scripts/load-test.ts --vercel 3 --students 120 --history 200`:
three copies of the built Vercel function share a local stand-in for the Upstash REST API that adds
5 ms per command. It was not run against real Vercel or Upstash.

| Scenario | Before | After (two runs) |
| --- | --- | --- |
| Sign in, 50 at a time | 95 of 120 failed ("server busy") | 0 failed; median 1.4 s, p95 4.2–4.7 s |
| Start test, 50 at a time | 95 failed (not signed in) | 0 failed; median 0.8–1.4 s, p95 3.3–3.9 s |
| Autosave, 25 to 120 concurrent | 95 failed per round | 0–1 failed of 360; median 1.1–3.8 s |
| Every student submits twice at once | 215 of 240 failed | 0 failed; median 2.9 s, p95 7.3–8.2 s |
| Students without a submission, duplicates, signed out | 95, 0, 95 | 0, 0, 0 |

Correctness is restored, but the latency shows the limit of this design: every write from every
instance goes through one shared document, one at a time, so a burst of simultaneous writes
queues for seconds. Autosaves happen in the background and the student keeps working, but sign-in
and submission waits are noticeable.

### Known limits

* **Single document.** All data is one JSON document held in memory. Each full write serialises the
  whole document, so write throughput falls as the data grows, and memory use grows with it.
  Suitable for departments and moderate cohorts; for large institutions, move to a database with
  per-record storage (for example PostgreSQL).
* **Vercel.** Writes from all instances are serialised through one Redis document (roughly 15–40
  writes per second in the simulation above), and each write sends the whole document to Redis, so
  Upstash request and record-size limits apply as the data grows. For large simultaneous exams,
  prefer the single-server deployment (`npm run build && npm start`) with local file storage, which
  handled 300 simultaneous students with sub-second responses here, or a per-record database.
* **Expired tests on Vercel** are submitted by the next request an instance handles after the time
  runs out; with AI grading enabled that request can wait up to the AI timeout (`AI_TIMEOUT_MS`).
* **Rate limits** are held in memory per instance, so on Vercel they apply per instance.
* **Sign-in** is CPU-bound by design (scrypt); bursts of sign-ins queue on Node's thread pool.
* **Backups** of a file deployment must include `database.attempts.json` as well as
  `database.json` to capture tests in progress. Restoring only `database.json` loses at most the
  autosaves since its last full write; a test already submitted is never resurrected as "in
  progress".

## 5. Decisions for the operator and a lawyer

* Whether to add a sign-in limit per account across all addresses. Today failed sign-ins are limited
  per account per address (5 per 15 minutes) and per address (100 per 15 minutes), so an attacker
  with many addresses can make more guesses against one account. A per-account limit would stop
  that, but anyone could then lock a student out of their account by failing to sign in as them, for
  example just before an exam. It was not added for that reason.
* Whether to require professors to verify their email, and whether to send email at all (Sifted
  sends none today, so there is no self-service password reset: the administrator sets a temporary
  password).

* Operator name, address and contact (`SITE_OPERATOR`, `SITE_CONTACT_EMAIL`), governing law.
* Legal bases for processing, applicable data-protection regimes, international transfers.
* Whether automated grading and AI recommendations engage rules on automated decision-making.
* Retention periods for submissions and inactive accounts; backup retention at the storage provider.
* Minimum user age and any parental-consent requirements.
* Liability terms, and ownership/licensing of questions and answers.
* Data-processing agreements with the hosting provider and Google.
