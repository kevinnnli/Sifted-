import { Router } from 'express';
import type { Database } from '../db';
import { AttemptLimiter, clearSessionCookie, requireRole, toPublicUser, verifyPassword } from '../security';
import { eraseStudent } from '../services/accounts';
import { applyProgress, attemptTiming, createAttempt, finalizeAttempt, isBeingSubmitted, validateProgress } from '../services/attempts';
import type { ExamAttempt } from '../types';
import { asyncHandler, badRequest, conflict, forbidden, notFound, optionalEmail, optionalString, requireEnum, requireString } from '../validation';
import { getStartBlocker, studentVerificationRequired, toAttemptView, toStudentInvitation, toStudentSubmission } from '../views';

export function studentRoutes(db: Database) {
  const router = Router();
  router.use(requireRole('applicant'));
  const deleteLimiter = new AttemptLimiter(5, 15 * 60 * 1000); // wrong passwords when deleting, per account

  // Everything below is looked up through the signed-in student's own email / id only
  const myInvitations = (email: string) => db.data.invitations.filter((i) => i.applicantEmail.toLowerCase() === email);
  const mySubmission = (studentId: string, email: string, id: string) =>
    db.data.submissions.find((s) => s.id === id && (s.studentId ? s.studentId === studentId : s.applicantEmail.toLowerCase() === email));
  const myAttempt = (studentId: string, id: string) => db.data.attempts.find((a) => a.id === id && a.studentId === studentId);

  router.get('/portal', (req, res) => {
    const user = req.user!;
    // Unverified students don't see invitations until an administrator confirms who they are
    const invitations = !user.isVerified && studentVerificationRequired() ? [] : myInvitations(user.email);
    const submissions = db.data.submissions.filter(
      (s) => (s.studentId ? s.studentId === user.id : s.applicantEmail.toLowerCase() === user.email) && !s.hiddenByApplicant
    );
    res.json({
      success: true,
      profile: toPublicUser(user),
      invitations: invitations.map((i) => toStudentInvitation(db, i, user)),
      submissions: submissions.map((s) => toStudentSubmission(db, s)),
    });
  });

  router.put('/profile', (req, res) => {
    const user = req.user!;
    const secondaryEmail = optionalEmail(req.body?.secondaryEmail, 'Personal email');
    if (secondaryEmail === user.email) throw badRequest('Your personal email must be different from your university email');
    user.secondaryEmail = secondaryEmail;
    user.university = requireString(req.body?.university, 'University', { max: 200 });
    user.degreeProgram = requireString(req.body?.degreeProgram, 'Degree program', { max: 200 });
    db.save();
    res.json({ success: true, profile: toPublicUser(user) });
  });

  // Starts a test, or resumes the one already in progress for this invitation
  router.post(
    '/invitations/:id/attempt',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      if (!user.isVerified && studentVerificationRequired()) {
        throw forbidden('Your account is waiting for an administrator to verify it before you can take assessments.');
      }
      const invitation = myInvitations(user.email).find((i) => i.id === req.params.id);
      if (!invitation) throw notFound('Invitation not found');

      const existing = db.data.attempts.find((a) => a.invitationId === invitation.id && a.studentId === user.id);
      if (existing) {
        if (attemptTiming(db, existing).isExpired) {
          await finalizeAttempt(db, existing.id, { autoSubmitted: true });
          throw conflict('Your time for this test ran out, so it was submitted automatically.');
        }
        if (req.body?.lockdown === true && !existing.lockdown) {
          const attemptId = existing.id;
          await db.commit(
            () => {
              const current = db.data.attempts.find((a) => a.id === attemptId);
              if (current) current.lockdown = true;
            },
            { attemptsOnly: true }
          );
        }
        const resumed = db.data.attempts.find((a) => a.invitationId === invitation.id && a.studentId === user.id);
        if (!resumed) throw conflict('You have already submitted this assessment.');
        return res.json({ success: true, attempt: toAttemptView(db, resumed, db.findUser(user.id) || user) });
      }

      const blocker = getStartBlocker(db, invitation, user);
      if (blocker) throw conflict(blocker);

      const details = req.body?.details || {};
      const secondaryEmail = optionalEmail(details.secondaryEmail, 'Personal email');
      if (secondaryEmail === user.email) throw badRequest('Your university email and personal email must be different addresses');
      const attemptDetails: ExamAttempt['details'] = {
        secondaryEmail,
        university: requireString(details.university, 'University', { max: 200 }),
        degreeProgram: requireString(details.degreeProgram, 'Degree program', { max: 200 }),
        gpa: optionalString(details.gpa, 'GPA', 10),
      };
      const studentId = user.id;
      const invitationId = invitation.id;
      const lockdown = req.body?.lockdown === true;
      // Looked up again inside the commit: with several server instances it may run on newer data
      const attempt = await db.commit(() => {
        const student = db.findUser(studentId);
        const current = student && myInvitations(student.email).find((i) => i.id === invitationId);
        if (!student || !current) throw notFound('Invitation not found');
        // Started meanwhile from another tab: carry on with that one
        const started = db.data.attempts.find((a) => a.invitationId === invitationId && a.studentId === studentId);
        if (started) return started;
        const blocked = getStartBlocker(db, current, student);
        if (blocked) throw conflict(blocked);
        const created = createAttempt(db, { invitationId, assessmentId: current.assessmentId, student, lockdown, details: attemptDetails });
        current.status = 'in-progress';
        current.startedAt = current.startedAt || created.startedAt;
        // Remember the candidate details for next time
        student.secondaryEmail = attemptDetails.secondaryEmail;
        student.university = attemptDetails.university;
        student.degreeProgram = attemptDetails.degreeProgram;
        return created;
      });
      res.status(201).json({ success: true, attempt: toAttemptView(db, attempt, db.findUser(studentId) || user) });
    })
  );

  router.put(
    '/attempts/:id',
    asyncHandler(async (req, res) => {
      const attempt = myAttempt(req.user!.id, req.params.id);
      if (!attempt) throw notFound('This test is no longer in progress');
      if (attemptTiming(db, attempt).isExpired) {
        const submission = await finalizeAttempt(db, attempt.id, { autoSubmitted: true });
        return res.status(409).json({
          success: false,
          error: 'Time is up — your test was submitted automatically.',
          submission: toStudentSubmission(db, submission),
        });
      }
      // A submission of this test is being graded: it already has the final answers
      if (isBeingSubmitted(db, attempt.id)) throw conflict('This test is being submitted.');
      const progress = req.body || {};
      validateProgress(progress);
      const studentId = req.user!.id;
      const attemptId = attempt.id;
      // Only the test in progress changes, so only it is written (see Database.saveAttempts)
      const saved = await db.commit(
        () => {
          const current = myAttempt(studentId, attemptId);
          if (!current) throw notFound('This test is no longer in progress');
          applyProgress(db, current, progress);
          return current;
        },
        { attemptsOnly: true }
      );
      res.json({ success: true, savedAt: saved.updatedAt, serverNow: new Date().toISOString() });
    })
  );

  router.post(
    '/attempts/:id/submit',
    asyncHandler(async (req, res) => {
      const attempt = myAttempt(req.user!.id, req.params.id);
      if (!attempt) throw notFound('This test is no longer in progress');
      const timing = attemptTiming(db, attempt);
      // Answers sent after the hard cut-off are ignored: the last autosave before it is graded
      if (!timing.isExpired) applyProgress(db, attempt, req.body || {});
      const submission = await finalizeAttempt(db, attempt.id, { autoSubmitted: req.body?.auto === true || timing.isExpired });
      res.json({ success: true, submission: toStudentSubmission(db, submission) });
    })
  );

  router.post('/submissions/:id/rsvp', (req, res) => {
    const user = req.user!;
    const submission = mySubmission(user.id, user.email, req.params.id);
    if (!submission || submission.professorDecision !== 'Interview') throw notFound('Interview invitation not found');
    submission.applicantResponseToInterview = requireEnum(req.body?.response, ['Accepted', 'Declined'] as const, 'Response');
    db.save();
    res.json({ success: true, submission: toStudentSubmission(db, submission) });
  });

  // Hides a submission from the student's own dashboard only; the professor's record is untouched
  router.post('/submissions/:id/hide', (req, res) => {
    const user = req.user!;
    const submission = mySubmission(user.id, user.email, req.params.id);
    if (!submission) throw notFound('Submission not found');
    submission.hiddenByApplicant = true;
    db.save();
    res.json({ success: true });
  });

  // Deletes the student's account and all of their data, after confirming their password
  router.delete(
    '/account',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      if (user.isTestAccount) throw badRequest('Test accounts are managed from the admin portal');
      deleteLimiter.check(user.id);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!(await verifyPassword(password, user.passwordHash))) {
        deleteLimiter.record(user.id);
        throw badRequest('Your password is incorrect');
      }
      const removed = eraseStudent(db, user);
      clearSessionCookie(req, res);
      res.json({ success: true, removed });
    })
  );

  return router;
}
