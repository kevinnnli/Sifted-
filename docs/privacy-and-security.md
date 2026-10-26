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
| Sessions | 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` in production. Only a SHA-256 hash is stored. Ends after 7 days without activity and at most 30 days after sign-in; activity renews it at most once an hour. A new token is issued at every sign-in and registration (no session fixation). | `server/security.ts` |
| Session invalidation | Sign-out; password change (other devices); admin password reset, disable or delete (all devices); account deletion. Expired sessions are pruned every 30 seconds. | `server/security.ts`, `server/routes/*` |
| Authorization | Every API route checks the role on the server (`requireRole`). Every lookup is scoped to the signed-in account: students by their own id/email, professors by ownership of the assessment. Users who must change a temporary password can do nothing else first. | `server/routes/*` |
| Admin access | Only the account defined by `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the server configuration. Nobody can create or promote an administrator through the web app. The admin can open the built-in test accounts, never a real user's account. | `server/bootstrap.ts`, `server/routes/admin.ts` |
| Test accounts | Kept separate from real accounts: sandbox professors can only invite sandbox students, real professors cannot invite sandbox addresses, sandbox questions never enter the shared bank, and the sandbox email domain cannot be registered. | `server/testAccounts.ts` |
| CSRF | State-changing requests must carry `X-Sifted-Request: 1` (which a cross-site form cannot send without a CORS preflight that the server never approves) and, when present, a matching `Origin`. No CORS headers are sent. | `server/security.ts` |
| Rate limits | Failed sign-ins: 5 per account per address and 100 per address per 15 minutes. Registrations: 60 per address per hour. Wrong current password (change password, delete account): 5 per account per 15 minutes. AI calls: 60 per professor per hour. Limits are per server instance. | `server/routes/*` |
| Headers | `Content-Security-Policy` (`script-src 'self'`, no `unsafe-eval`, no third-party origins), `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`. API responses are `Cache-Control: no-store`. Defined once and shared by the Express server and the Vercel build. | `server/securityHeaders.mjs` |
| Input validation | All request bodies are validated on the server (types, lengths, enums, http(s)-only links, multiple-choice answers must be one of the options). Bodies over 1 MB are refused. | `server/validation.ts` |
| Exams | The server owns the clock, question order, answer keys and grading. Answer keys, rubrics and model answers are never sent to students. Integrity counters can only increase. Duplicate submissions are de-duplicated. | `server/services/attempts.ts`, `server/views.ts` |
| Errors and logs | Users get generic error messages; stack traces stay in server logs. AI errors are logged as a message only, because they can echo student answers. | `server/security.ts`, `server/services/ai.ts` |
| Storage | Local file: atomic writes (temporary file + rename, mode 0600), group commit, a request's change is on disk before it is acknowledged. Vercel: Upstash Redis with compare-and-set, so concurrent instances cannot overwrite each other. | `server/db.ts`, `server/storage.ts` |

### Findings fixed in the October 2026 audit

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
| Name, university email | Sign-in, matching invitations | Users | The student, inviting professors, admin | Hosting/storage provider | Account deleted |
| University, degree programme | Context for professors | Users, submissions | Same | Same | Account / submission deleted |
| Personal email (optional) | Alternative contact for inviting professors | Users, submissions | Same | Same | Same |
| GPA (optional, per test) | Context for the professor | Submission | Student's professor, admin | Same | Submission deleted |
| Password hash | Authentication | Users | Nobody (never sent to clients) | Storage provider | Account deleted or password changed |
| Session hash, created/expiry time | Keeping the user signed in | Sessions | Nobody | Storage provider | Expiry (≤ 30 days), then pruned |
| Account created / last sign-in time | Security, admin overview | Users | Admin | Storage provider | Account deleted |
| Answers, time per question, start/finish time | Assessment | Attempt, then submission | The professor, admin; student sees scores only if released | Storage provider; Gemini (answers only) when AI is enabled | Submission deleted |
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

Measured in the development container (a single Node.js 22 production-mode process with local file
storage) against a database of 300 active students and 2,000 historical submissions. The load
script signs everyone in, starts their tests, sends autosaves at rising concurrency and submits
every test twice at once. These are measurements from one machine, not a guarantee of capacity in
any particular hosting environment.

Before the change, every write rewrote the whole database synchronously, so all requests queued
behind each write. Writes are now batched and asynchronous (group commit), and a request that
changed something still waits until its change is on disk.

| Scenario (300 students) | Before | After |
| --- | --- | --- |
| Sign-in burst, 50 at a time | 6 req/s, median 7.7 s, 6 failed | 47 req/s, median 0.97 s, p95 1.1 s, 0 failed |
| Load student portal, 50 at a time | 891 req/s, p95 291 ms, 6 failed | 963 req/s, p95 87 ms, 0 failed |
| Start test, 50 at a time | 6 req/s, p99 36 s, 23 failed | 154 req/s, p99 361 ms, 0 failed |
| Autosave, 25 concurrent | 6 req/s, median 4.0 s | 79 req/s, median 315 ms, p95 364 ms |
| Autosave, 100 concurrent | 6 req/s, p95 87 s, 18 failed | 248 req/s, p95 473 ms, 0 failed |
| Autosave, 300 concurrent | did not complete within 10 minutes | 557 req/s, p95 723 ms, 0 failed |
| Two simultaneous submissions per student | not reached | 0 duplicates, 0 students signed out |
| Peak memory (RSS) | 288 MB | 481 MB |
| Database file | 16.1 MB (indented JSON) | 11.0 MB (compact JSON) |

The higher peak memory comes from many more requests being in flight at once and from building the
serialised document for each batch. Static assets: the first page used to download one 1,015 kB
(268 kB gzipped) script; it now downloads 244 kB (75 kB gzipped), with each portal and the chart
library loaded only when needed.

### Known limits

* **Single document.** All data is one JSON document held in memory. Each batch of changes
  serialises the whole document, so write throughput falls as the data grows, and memory use
  grows with it. Suitable for departments and moderate cohorts; for large institutions, move to a
  database with per-record storage (for example PostgreSQL).
* **Vercel.** Each write sends the whole document to Redis, and Upstash plans limit request and
  record sizes. Under heavy concurrent writing across several function instances, some requests
  are refused with "please try again" (never silently lost). The Vercel/Redis path was verified
  for correctness with a local simulator, not load-tested against Upstash.
* **Rate limits** are held in memory per instance, so on Vercel they apply per instance.
* **Sign-in** is CPU-bound by design (scrypt); bursts of sign-ins queue on Node's thread pool.

## 5. Decisions for the operator and a lawyer

* Operator name, address and contact (`SITE_OPERATOR`, `SITE_CONTACT_EMAIL`), governing law.
* Legal bases for processing, applicable data-protection regimes, international transfers.
* Whether automated grading and AI recommendations engage rules on automated decision-making.
* Retention periods for submissions and inactive accounts; backup retention at the storage provider.
* Minimum user age and any parental-consent requirements.
* Liability terms, and ownership/licensing of questions and answers.
* Data-processing agreements with the hosting provider and Google.
