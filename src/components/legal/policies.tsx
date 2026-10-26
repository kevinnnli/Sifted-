import React from 'react';

/**
 * Policy texts. Each statement describes what this codebase actually does; anything the code
 * cannot establish (who operates a deployment, its jurisdiction, legal bases, provider retention)
 * is either filled from the operator's configuration or marked as needing review.
 * Keep these in step with the code: see docs/privacy-and-security.md for the data inventory.
 */

export interface SiteInfo {
  operator: string | null;
  contactEmail: string | null;
}

export interface PolicySection {
  title: string;
  body: React.ReactNode;
  /** Shown as a visible note: what a lawyer or the operator still has to decide. */
  review?: string;
}

export interface PolicyDocument {
  slug: string;
  title: string;
  summary: string;
  sections: (site: SiteInfo) => PolicySection[];
}

const LAST_UPDATED = '25 October 2026';
export { LAST_UPDATED };

const P = ({ children }: { children: React.ReactNode }) => <p className="leading-relaxed">{children}</p>;
const List = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

function Contact({ site }: { site: SiteInfo }) {
  if (site.operator || site.contactEmail) {
    return (
      <P>
        This deployment of Sifted is operated by <strong>{site.operator || 'its administrator'}</strong>.
        {site.contactEmail ? (
          <>
            {' '}
            Contact:{' '}
            <a className="font-medium text-brand-700 underline underline-offset-2" href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            .
          </>
        ) : (
          ' No contact email has been published; please contact the administrator of your institution.'
        )}
      </P>
    );
  }
  return (
    <P>
      The operator of this deployment has not yet published their name and contact details. Until they do, please direct questions to the administrator
      of the institution or programme that invited you to use Sifted.
    </P>
  );
}

const privacy: PolicyDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: 'What information Sifted collects, why, who can see it, how long it is kept and how to have it deleted.',
  sections: (site) => [
    {
      title: 'Who is responsible',
      body: <Contact site={site} />,
      review:
        'The operator must state their legal name, address and contact details, and, where applicable, a data protection officer or representative.',
    },
    {
      title: 'Information we collect',
      body: (
        <>
          <P>When you create a student account:</P>
          <List
            items={[
              'your name and university email address (used to sign in and to match invitations sent to you);',
              'your university and degree programme;',
              'optionally, a personal email address, which is shown only to professors who invite you, as an alternative contact;',
              'your password, stored only as a salted scrypt hash. The password itself is never stored.',
            ]}
          />
          <P>When you take a test:</P>
          <List
            items={[
              'your answers, which question you are on, and how long you spend on each question;',
              'the start and finish time, and whether the test was submitted automatically when time ran out;',
              'integrity events when the professor has enabled monitoring: switching away from the tab, copy and paste attempts, and leaving full-screen mode;',
              'the details you confirm before starting (university, degree programme, optional personal email and optional GPA);',
              'the resulting scores and grading feedback.',
            ]}
          />
          <P>Professors may add decisions, private notes, score adjustments and interview details to your submission.</P>
          <P>
            For security, the server records when each account was created and last signed in, and keeps a hash of each active session. Your IP address is
            used in memory to limit repeated failed sign-in attempts; Sifted does not store it. The hosting provider may keep its own access logs.
          </P>
        </>
      ),
      review: 'Confirm the hosting provider’s access-log retention for this deployment and add it here.',
    },
    {
      title: 'Why we use it',
      body: (
        <List
          items={[
            'to provide your account and the tests you are invited to take;',
            'to let the professors who invited you evaluate your results and contact you about interviews;',
            'to protect accounts and the integrity of tests (rate limiting, session security, integrity monitoring the professor has enabled).',
          ]}
        />
      ),
      review:
        'Identify the legal basis for each purpose (for example contract, legitimate interests or consent) under the laws that apply to the operator and its users.',
    },
    {
      title: 'Automated grading',
      body: (
        <>
          <P>
            Multiple-choice answers are graded automatically. If the operator has enabled AI grading, written answers are also scored by Google’s Gemini
            service against the professor’s rubric, and an AI summary and recommendation are produced for the professor. AI output is advisory: admission
            and interview decisions are made by professors, who can review and override every score.
          </P>
        </>
      ),
      review: 'Assess whether rules on automated decision-making (for example Article 22 GDPR) apply and whether additional notices or safeguards are needed.',
    },
    {
      title: 'Who can see your information',
      body: (
        <List
          items={[
            'You can see your own invitations, decisions and, where the professor allows it, your scores.',
            'A professor can see the submissions of students they invited to their own assessments, including answers, scores, integrity events and the details you confirmed. Professors cannot see other professors’ students.',
            'The administrator of this deployment can see all accounts and records in order to run the service, verify students and handle requests such as deletion.',
            'Other students cannot see anything about you.',
          ]}
        />
      ),
    },
    {
      title: 'Service providers',
      body: (
        <>
          <List
            items={[
              <>
                <strong>Hosting.</strong> The application and its data are stored by the operator’s hosting provider (for example Vercel, with Upstash Redis
                for storage, when deployed there).
              </>,
              <>
                <strong>Google Gemini</strong> (only if the operator enables AI features). For grading, Sifted sends the questions, rubrics, model answers and
                your answers and automatic scores. For interview briefings it sends scores, topic results and the integrity summary. It does not send your
                name, email address or institution, although anything you type into an answer is sent as written.
              </>,
            ]}
          />
          <P>Sifted does not sell personal information and does not use advertising or analytics services.</P>
        </>
      ),
      review:
        'List the actual providers and data-processing agreements for this deployment, the regions where data is stored, and the safeguards for any international transfers.',
    },
    {
      title: 'How long we keep it',
      body: (
        <List
          items={[
            'Accounts are kept until they are deleted by the student or the administrator.',
            'Submissions are kept until the professor deletes them, the administrator deletes them, or the student deletes their account.',
            'Sessions end after 7 days without activity and at most 30 days after sign-in; expired sessions are removed automatically.',
            'Tests in progress are converted into submissions when they are submitted or when the time limit passes.',
          ]}
        />
      ),
      review: 'The operator should set and publish a maximum retention period for submissions and inactive accounts, and check backup retention with its storage provider.',
    },
    {
      title: 'Your choices and rights',
      body: (
        <>
          <P>
            You can update your university, degree programme and personal email from <strong>My Account</strong>, and you can delete your account and all of
            your submissions there at any time (see the{' '}
            <a className="font-medium text-brand-700 underline underline-offset-2" href="/data-deletion">
              Data Deletion
            </a>{' '}
            page). For other requests, such as a copy of your data, contact the operator.
          </P>
        </>
      ),
      review: 'Describe the rights available under the applicable law (for example access, rectification, portability, objection, complaint to a supervisory authority) and response times.',
    },
    {
      title: 'Security',
      body: (
        <P>
          Passwords are hashed, sessions use secure, HTTP-only cookies, every request is checked on the server against the signed-in account’s permissions,
          and sign-in attempts are rate limited. No system is perfectly secure; the operator is responsible for keeping the deployment and its configuration
          secure.
        </P>
      ),
    },
    {
      title: 'Children',
      body: <P>Sifted is intended for university students and staff.</P>,
      review: 'State the minimum age for users and any parental-consent requirements in the jurisdictions where the service is offered.',
    },
    {
      title: 'Changes to this policy',
      body: <P>Changes will be published on this page with a new “last updated” date.</P>,
    },
  ],
};

const terms: PolicyDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: 'The rules for using Sifted as a student, professor or administrator.',
  sections: (site) => [
    { title: 'Who provides the service', body: <Contact site={site} />, review: 'Add the operator’s legal name and the governing law and jurisdiction.' },
    {
      title: 'What Sifted is',
      body: (
        <P>
          Sifted is a tool for professors to set screening assessments for prospective graduate students and to review the results. Using Sifted does not
          guarantee admission, an interview or any other outcome; those decisions belong to the professors and institutions involved.
        </P>
      ),
    },
    {
      title: 'Accounts',
      body: (
        <List
          items={[
            'Students create their own accounts using their university email address and must give accurate information.',
            'Professor accounts are created by the administrator. Administrator access is configured by the operator.',
            'Keep your password private. You are responsible for activity under your account; tell the operator if you believe it has been compromised.',
            'The administrator may verify, disable or delete accounts to protect the service and its users.',
          ]}
        />
      ),
    },
    {
      title: 'Academic integrity',
      body: (
        <P>
          When you take a test you agree to complete it yourself, without unauthorised help or tools. Professors may enable monitoring of tab switches, copy
          and paste and full-screen exits; these events are recorded and shown to the professor. Attempts to interfere with the service or access other
          people’s information are prohibited.
        </P>
      ),
    },
    {
      title: 'Content',
      body: (
        <P>
          Professors are responsible for the questions and materials they add and for having the right to use them. Students’ answers are shared with the
          professors who invited them for the purpose of evaluation.
        </P>
      ),
      review: 'Decide and state who owns, and what licence applies to, questions and answers submitted through the service.',
    },
    {
      title: 'Availability and changes',
      body: (
        <P>
          The service may be changed, interrupted or discontinued. Tests are saved as you work and resume after a lost connection, but you should contact the
          professor if a technical problem affects your test.
        </P>
      ),
    },
    {
      title: 'Liability',
      body: <P>To the extent permitted by law, the service is provided as is, without warranties.</P>,
      review: 'Liability limits and disclaimers depend on the jurisdiction and must be drafted by a lawyer before publication.',
    },
    { title: 'Fees', body: <P>Sifted does not charge students or professors any fees. See the Refund Policy.</P> },
  ],
};

const cookies: PolicyDocument = {
  slug: 'cookies',
  title: 'Cookie Policy',
  summary: 'The cookies and browser storage Sifted uses. All of them are strictly necessary; there are no analytics or advertising cookies.',
  sections: () => [
    {
      title: 'Cookies',
      body: (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <caption className="sr-only">Cookies set by Sifted</caption>
            <thead>
              <tr className="border-b border-slate-300 text-slate-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Name</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Purpose</th>
                <th scope="col" className="py-2 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-4 font-mono text-xs">sifted_session</td>
                <td className="py-2 pr-4">Keeps you signed in. Contains a random identifier only; it is HTTP-only (not readable by scripts) and sent only over HTTPS.</td>
                <td className="py-2">Until 7 days without activity, and at most 30 days after sign-in. Removed when you sign out.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">sifted_admin_return</td>
                <td className="py-2 pr-4">Administrators only: remembers the administrator’s session while they use a test account, so they can switch back.</td>
                <td className="py-2">Until the administrator switches back or signs out.</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      title: 'Browser storage',
      body: (
        <List
          items={[
            <>
              <span className="font-mono text-xs">sifted-exam-launch</span>: when you choose to open a test in a new tab, the details you confirmed are passed to
              that tab and deleted as soon as it opens (or after ten minutes if it never does).
            </>,
            <>
              <span className="font-mono text-xs">sifted-consent</span>: remembers that you have seen the cookie notice.
            </>,
          ]}
        />
      ),
    },
    {
      title: 'Third-party cookies',
      body: (
        <P>
          Sifted does not load third-party scripts, fonts or images, and sets no analytics or advertising cookies. A hosting provider may set its own cookie
          on protected preview deployments (for example Vercel’s deployment protection).
        </P>
      ),
    },
    {
      title: 'Your choices',
      body: (
        <P>
          Because these cookies are needed for the site to work, they cannot be switched off in Sifted; blocking them in your browser will prevent you from
          signing in. You can review this information at any time with the “Cookie settings” link at the bottom of every page. If optional cookies are ever
          introduced, they will be off until you choose to allow them.
        </P>
      ),
      review: 'Confirm that the strictly-necessary exemption applies under the ePrivacy rules (or equivalent) of the jurisdictions where the service is offered.',
    },
  ],
};

const deletion: PolicyDocument = {
  slug: 'data-deletion',
  title: 'Data Deletion',
  summary: 'How to delete your account and data, what is removed, and what cannot be removed immediately.',
  sections: (site) => [
    {
      title: 'Students: delete your account yourself',
      body: (
        <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed">
          <li>Sign in and open <strong>My Account</strong>.</li>
          <li>Under <strong>Delete account</strong>, enter your password and confirm.</li>
        </ol>
      ),
    },
    {
      title: 'What is deleted',
      body: (
        <>
          <P>Deletion is immediate and permanent. It removes:</P>
          <List
            items={[
              'your account and profile;',
              'every submission you made, including answers, scores, integrity events, professor notes and interview details;',
              'invitations sent to your email address, and any test in progress;',
              'all of your sign-in sessions.',
            ]}
          />
          <P>Professors lose access to your submissions at the same moment.</P>
        </>
      ),
    },
    {
      title: 'Professors and other requests',
      body: (
        <>
          <P>
            Professor accounts, and requests from students who can no longer sign in, are handled by the administrator, who can delete an account and all of
            its data from the admin portal. A professor who has created assessments can be disabled rather than deleted, so that students’ records are not
            lost unexpectedly.
          </P>
          <Contact site={site} />
        </>
      ),
      review: 'Set and publish the response time for deletion requests sent to the operator.',
    },
    {
      title: 'Limits',
      body: (
        <List
          items={[
            'Copies in the hosting or storage provider’s backups are not removed by Sifted and expire according to that provider’s retention.',
            'Answers already sent to Google Gemini for AI grading are subject to Google’s data retention for the API.',
            'Information a professor has copied outside Sifted (for example into their own notes) is outside Sifted’s control.',
          ]}
        />
      ),
      review: 'Confirm backup retention with the storage provider and Google’s retention terms for the Gemini API plan in use, and state the periods here.',
    },
  ],
};

const refunds: PolicyDocument = {
  slug: 'refunds',
  title: 'Refund Policy',
  summary: 'Sifted does not take payments, so there is nothing to refund.',
  sections: () => [
    {
      title: 'No payments',
      body: (
        <P>
          Sifted has no paid plans, purchases or fees, and does not collect payment details, so no refunds arise. If the operator introduces paid services,
          this policy must be updated with the refund conditions before any payment is taken.
        </P>
      ),
      review: 'If the operator charges institutions or users outside this application, describe those arrangements and their refund terms here.',
    },
  ],
};

export const POLICIES: PolicyDocument[] = [privacy, terms, cookies, deletion, refunds];
export const policyForPath = (pathname: string) => POLICIES.find((p) => pathname.replace(/\/+$/, '') === `/${p.slug}`);
