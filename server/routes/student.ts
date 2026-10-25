import { Router } from 'express';
import type { Database } from '../db';
import { requireRole, toPublicUser } from '../security';
import { applyProgress, attemptTiming, createAttempt, finalizeAttempt } from '../services/attempts';
import type { ExamAttempt } from '../types';
import { asyncHandler, badRequest, conflict, forbidden, notFound, optionalString, requireEmail, requireEnum, requireString } from '../validation';
import { getStartBlocker, studentVerificationRequired, toAttemptView, toStudentInvitation, toStudentSubmission } from '../views';

export function studentRoutes(db: Database) {
  const router = Router();
  router.use(requireRole('applicant'));

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
    const secondaryEmail = requireEmail(req.body?.secondaryEmail, 'Personal email');
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
        if (req.body?.lockdown === true && !existing.lockdown) existing.lockdown = true;
        db.save();
        return res.json({ success: true, attempt: toAttemptView(db, existing, user) });
      }

      const blocker = getStartBlocker(db, invitation, user);
      if (blocker) throw conflict(blocker);

      const details = req.body?.details || {};
      const secondaryEmail = requireEmail(details.secondaryEmail, 'Personal email');
      if (secondaryEmail === user.email) throw badRequest('Your university email and personal email must be different addresses');
      const attemptDetails: ExamAttempt['details'] = {
        secondaryEmail,
        university: requireString(details.university, 'University', { max: 200 }),
        degreeProgram: requireString(details.degreeProgram, 'Degree program', { max: 200 }),
        gpa: optionalString(details.gpa, 'GPA', 10),
      };
      const attempt = createAttempt(db, {
        invitationId: invitation.id,
        assessmentId: invitation.assessmentId,
        student: user,
        lockdown: req.body?.lockdown === true,
        details: attemptDetails,
      });
      invitation.status = 'in-progress';
      invitation.startedAt = invitation.startedAt || attempt.startedAt;
      // Remember the candidate details for next time
      user.secondaryEmail = attemptDetails.secondaryEmail;
      user.university = attemptDetails.university;
      user.degreeProgram = attemptDetails.degreeProgram;
      db.save();
      res.status(201).json({ success: true, attempt: toAttemptView(db, attempt, user) });
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
      applyProgress(db, attempt, req.body || {});
      db.save();
      res.json({ success: true, savedAt: attempt.updatedAt, serverNow: new Date().toISOString() });
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

  return router;
}
