# Sifted

Sifted is a screening platform for undergraduates applying to graduate programs. Professors build assessments (from their own questions, a shared question bank, or AI-generated questions), assign them to students, and review the graded results. Students take the tests in their own private portal and see only their own invitations and decisions.

View your app in AI Studio: https://ai.studio/apps/46e38ab8-3fb3-4373-9cd0-20eba0866007

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set at least:
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters): your administrator sign-in
   - `GEMINI_API_KEY` (optional): enables AI feedback and question generation
3. Run the app: `npm run dev`, then open http://localhost:3000 and sign in with your admin email and password.

To try the app with sample data, also set `SEED_DEMO_DATA=true` and `DEMO_PASSWORD=<8+ characters>` before the first run. Every sample account (for example `evance@cs.university.edu` or `alex.chen@stanford.edu`) then signs in with that password.

## Deploy to Vercel

The repository includes `vercel.json`, so import it into Vercel as-is (no framework preset or output directory needed). Then:

1. **Add a database.** Vercel's servers don't keep files, so Sifted stores its data in Redis. In your Vercel project open **Storage → Create Database → Upstash (Redis)**, create a free database and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) automatically.
2. **Add your admin login.** Under **Settings → Environment Variables** add `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters), plus `GEMINI_API_KEY` if you want AI features.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new settings take effect, then sign in with your admin email and password.

Without step 1 the site still runs, but accounts and results disappear whenever Vercel restarts the server; the admin portal shows a warning while that's the case.

## Accounts and access

| Role | How the account is created | What it can see |
| --- | --- | --- |
| Administrator | Only from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the server configuration | Every account; can create professors, verify students, reset passwords, disable or delete accounts. Can open the built-in test accounts, but never a real user's account. |
| Professor | By the administrator, with a temporary password the professor must change at first sign-in | Only their own assessments, their own and public questions, and the candidates they invited |
| Student | Self-registration with a university email | Only their own invitations, test attempts and decisions. Never answer keys, rubrics, other students, or professor notes. |

- New students must be verified by the administrator before they can see assigned tests (set `STUDENT_VERIFICATION=auto` to skip this).
- Tests run on the server: it holds the clock, the question order and the answer keys, saves progress as the student goes, grades on submission, and auto-submits when time (plus grace) runs out. A refresh or a lost connection resumes the same attempt.
- Sessions use secure, HTTP-only cookies. They end after 7 days without activity and at most 30 days after sign-in; using the site extends them. Passwords are hashed with scrypt, sign-in is rate-limited, and every API route checks the caller's role and ownership.
- Students can delete their account and all of their submissions from **My account**.

See [`docs/privacy-and-security.md`](docs/privacy-and-security.md) for the security architecture, the personal-data inventory, measured performance and known limits.

## Policies

The Privacy Policy, Terms of Service, Cookie Policy, Data Deletion and Refund Policy pages (`/privacy`, `/terms`, `/cookies`, `/data-deletion`, `/refunds`) describe how this software actually handles data. They are drafts: each page marks the sections that need the operator's details or a lawyer's review. Set `SITE_OPERATOR` and `SITE_CONTACT_EMAIL` so the pages name who runs your deployment, and have the documents reviewed before using Sifted with real students.

Sifted uses only strictly necessary cookies and browser storage, so the cookie notice informs rather than asks. If optional tools such as analytics are ever added, they must be registered in `src/consent.ts`, which keeps them off until a visitor opts in.

## Test accounts

Every deployment comes with a sandbox for trying Sifted out, listed only in the admin portal under **Test Accounts**:

- **Dr. Test Professor**: owns a published "Sandbox Screening Exam" with two submissions to review
- **Riley Ready**: has the exam waiting to be taken
- **Sam Submitted**: has submitted it and is waiting for review
- **Ivy Interview**: has been invited to an interview and can accept or decline
- **Nova New**: just registered and still needs verifying

Each has a random password shown only to the administrator. **Open** switches your browser into that account (use **Back to admin** to return), or sign in with the email and password in another browser to use two accounts side by side. **Reset Test Data** rebuilds them from scratch; **Remove** deletes them and keeps them off. Set `SIFTED_TEST_ACCOUNTS=off` to never create them.

## Configuration

All settings are documented in [`.env.example`](.env.example). The ones you are most likely to need:

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | The administrator account. The password in the configuration is always authoritative; change it there and restart. |
| `STUDENT_VERIFICATION=auto` | Let students see their tests without admin verification |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI features |
| `SEED_DEMO_DATA`, `DEMO_PASSWORD` | Sample data for a new database |
| `DATABASE_FILE` | Where data is stored (default `./database.json`) |
| `SITE_OPERATOR`, `SITE_CONTACT_EMAIL` | Who runs the deployment, shown in the policies |
| `AI_TIMEOUT_MS` | Upper limit for one AI call (default 20000) |
| `ALLOW_EMBEDDING=true`, `COOKIE_SAMESITE=none` | Only for iframe previews such as AI Studio (HTTPS required) |

Serve the app over HTTPS in production (`npm run build && npm start`); session cookies are marked Secure when `NODE_ENV=production`.

## Upgrading an existing database

Databases created by earlier versions had no passwords. On first start they are migrated: every existing professor and student account is locked until the administrator sets a password for it from the admin portal (the user then chooses their own at next sign-in), and any old built-in admin accounts are disabled in favour of the one in your configuration.

## Scripts

- `npm run dev`: development server with hot reload
- `npm run build` / `npm start`: production build and server
- `npm run build:vercel`: the Vercel build (used automatically by `vercel.json`)
- `npm run lint`: type-check
- `npm test`: server tests: authentication, account isolation, sessions, deletion, storage

