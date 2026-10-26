import type { Database } from '../db';
import type { StoredUser } from '../types';

/**
 * Permanently removes a student account and every record that identifies them: sessions, tests in
 * progress, submissions (with answers, scores and professor notes), invitations sent to their
 * email, and admin "return" sessions pointing at them. Used for both a student deleting their own
 * account and an administrator handling a deletion request.
 *
 * Returns what was removed so the caller can report it.
 */
export function eraseStudent(db: Database, student: StoredUser) {
  const email = student.email.toLowerCase();
  const belongsToStudent = (s: { studentId?: string; applicantEmail: string }) =>
    s.studentId ? s.studentId === student.id : s.applicantEmail.toLowerCase() === email;

  const removed = {
    submissions: db.data.submissions.filter(belongsToStudent).length,
    invitations: db.data.invitations.filter((i) => i.applicantEmail.toLowerCase() === email).length,
    attempts: db.data.attempts.filter((a) => a.studentId === student.id).length,
  };
  db.data.submissions = db.data.submissions.filter((s) => !belongsToStudent(s));
  db.data.invitations = db.data.invitations.filter((i) => i.applicantEmail.toLowerCase() !== email);
  db.data.attempts = db.data.attempts.filter((a) => a.studentId !== student.id);
  db.data.sessions = db.data.sessions.filter((s) => s.userId !== student.id);
  db.data.users = db.data.users.filter((u) => u.id !== student.id);
  db.save();
  return removed;
}
