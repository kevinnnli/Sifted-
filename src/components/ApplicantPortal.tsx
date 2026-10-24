import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Code, 
  Terminal, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Calendar,
  FileText,
  PlusCircle,
  Flag,
  Calculator,
  Grid,
  Scissors,
  X,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  List,
  LayoutGrid,
  Lock,
  ExternalLink,
  ShieldAlert,
  Monitor,
  AlertOctagon,
  Trash2,
  Video,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import {
  Assessment,
  Question,
  ApplicantSubmission,
  UserAccount,
  AssessmentInvitation,
  ProfessorProfile,
  IntegrityOptions,
  DifficultyLevel,
  QuestionResponseItem,
} from '../types';
import {
  applyScoreOverrides,
  calculateSubmissionGrading,
  getAiFlagThreshold,
  getEffectiveScore,
  getHireabilityBadgeStyle,
  getHireabilityLevel,
  getRecommendationFromLevel,
} from '../utils/grading';

interface ApplicantPortalProps {
  assessments: Assessment[];
  questionBank: Question[];
  professors?: ProfessorProfile[];
  submissions?: ApplicantSubmission[];
  onCompleteAssessment: (submission: ApplicantSubmission) => void;
  onUpdateSubmission?: (submission: ApplicantSubmission) => void;
  onExitPortal: () => void;
  currentUserAccount?: UserAccount | null;
  invitations?: AssessmentInvitation[];
  onUpdateInvitationStatus?: (id: string, status: 'pending' | 'in-progress' | 'completed') => void;
  onOpenAuthModal?: () => void;
  onAssignDemoTest?: (email: string) => void;
}

type ResponseDraft = Record<string, { answer: any; timeSpentSeconds: number }>;

// Persisted while a test is in progress so a reload or accidental exit can resume it
interface SavedProgress {
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
  responses: ResponseDraft;
  startedAtMs: number;
  currentQuestionIndex: number;
  tabSwitches: number;
  copyPasteAttempts: number;
  flaggedQuestions: Record<string, boolean>;
  timeSpent: Record<string, number>;
  integrityEvents: string[];
  isLockdownActive: boolean;
}

const DEFAULT_INTEGRITY_OPTIONS: IntegrityOptions = {
  fullScreenMode: true,
  tabSwitchDetection: true,
  webcamMonitoring: false,
  copyPasteDetection: true,
  aiAnswerDetection: true,
  randomizeQuestionOrder: true,
  randomizeAnswerOrder: true,
};

const DIFFICULTY_ORDER: Record<DifficultyLevel, number> = {
  Basic: 0,
  Intermediate: 1,
  Advanced: 2,
  'Research-Level': 3,
};

const LATE_GRACE_SECONDS = 5 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 'YYYY-MM-DD' values are calendar dates: parse them in local time. new Date('2026-08-04') is UTC
// midnight, which displays as the previous day for users west of UTC.
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatLocalDate(value?: string): string {
  const date = value ? parseLocalDate(value) : null;
  return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending Assignment';
}

function isPastDeadline(deadline?: string): boolean {
  const date = deadline ? parseLocalDate(deadline) : null;
  if (!date) return false;
  date.setHours(23, 59, 59, 999);
  return Date.now() > date.getTime();
}

// Evaluates calculator input restricted to digits, arithmetic operators, parentheses, '.' and '%'
function evaluateArithmetic(expression: string): string {
  const sanitized = expression.replace(/[^0-9+\-*/().%]/g, '');
  if (!sanitized) return '';
  try {
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return typeof result === 'number' && Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : 'Error';
  } catch {
    return 'Error';
  }
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota); the test still works without resume support
  }
}

export const ApplicantPortal: React.FC<ApplicantPortalProps> = ({
  assessments,
  questionBank,
  professors = [],
  submissions = [],
  onCompleteAssessment,
  onUpdateSubmission,
  onExitPortal,
  currentUserAccount,
  invitations = [],
  onUpdateInvitationStatus,
  onOpenAuthModal,
  onAssignDemoTest,
}) => {
  // The portal only ever shows data belonging to the signed-in student
  const lookupEmail = (currentUserAccount?.email || '').toLowerCase();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [activeInvitationId, setActiveInvitationId] = useState<string>('');
  const [portalNotice, setPortalNotice] = useState<string | null>(null);

  const showNotice = (message: string, ms = 4500) => {
    setPortalNotice(message);
    setTimeout(() => setPortalNotice(null), ms);
  };

  const getAssessment = (id?: string) => assessments.find((a) => a.id === id);
  const activeAssessment = getAssessment(selectedAssessmentId);
  const integrityOptions: IntegrityOptions = { ...DEFAULT_INTEGRITY_OPTIONS, ...(activeAssessment?.integrityOptions || {}) };
  const assessmentProfessor = professors.find((p) => p.id === activeAssessment?.professorId);
  const timeLimitSeconds = (activeAssessment?.timeLimitMinutes || 60) * 60;
  const graceSeconds = assessmentProfessor?.allowLateSubmissions ? LATE_GRACE_SECONDS : 0;

  const mySubmissions = submissions.filter((s) => s.applicantEmail.toLowerCase() === lookupEmail && !s.hiddenByApplicant);
  const myInterviews = mySubmissions.filter((s) => s.professorDecision === 'Interview');
  const myInvites = invitations.filter((i) => i.applicantEmail.toLowerCase() === lookupEmail);
  // Scores are only shown to students when the professor enabled "Applicant Score Visibility"
  const canSeeScore = (sub: ApplicantSubmission) => Boolean(getAssessment(sub.assessmentId)?.isScoreVisible);
  const findSubmissionForInvite = (inv: AssessmentInvitation) =>
    submissions.find((s) => s.invitationId === inv.id) ||
    submissions.find((s) => !s.invitationId && s.assessmentId === inv.assessmentId && s.applicantEmail.toLowerCase() === lookupEmail);

  const handleRSVP = (status: 'Accepted' | 'Declined', sub: ApplicantSubmission) => {
    if (onUpdateSubmission) {
      onUpdateSubmission({ ...sub, applicantResponseToInterview: status });
    }
    showNotice(`You have successfully ${status === 'Accepted' ? 'accepted' : 'declined'} the interview invitation.`);
  };

  const handleHideSubmission = (sub: ApplicantSubmission) => {
    // Only hides it from the student's dashboard; the professor's records are untouched
    if (onUpdateSubmission) onUpdateSubmission({ ...sub, hiddenByApplicant: true });
  };

  const openSubmissionStatus = (sub: ApplicantSubmission) => {
    setCompletedSubmissionId(sub.id);
    setSelectedAssessmentId(sub.assessmentId);
    setStep('completed');
  };

  // Portal Steps: 'dashboard' -> 'invite' -> 'testing' -> 'completed'
  const [step, setStep] = useState<'dashboard' | 'invite' | 'testing' | 'completed'>('dashboard');
  const [dashboardSection, setDashboardSection] = useState<'all' | 'interviews'>('all');

  // Candidate identity comes from the signed-in account; only supplementary details are editable
  const applicantName = currentUserAccount?.name || '';
  const applicantEmail = currentUserAccount?.email || '';
  const [applicantPersonalEmail, setApplicantPersonalEmail] = useState(currentUserAccount?.secondaryEmail || '');
  const [university, setUniversity] = useState(currentUserAccount?.university || '');
  const [degreeProgram, setDegreeProgram] = useState(currentUserAccount?.degreeProgram || '');
  const [gpa, setGpa] = useState('');
  const [agreedToPledge, setAgreedToPledge] = useState(false);

  const activeInterviewCount = myInterviews.length;
  const [lastSeenInterviewCount, setLastSeenInterviewCount] = useState(-1);

  useEffect(() => {
    if (activeInterviewCount > 0 && (lastSeenInterviewCount === -1 || activeInterviewCount > lastSeenInterviewCount)) {
      if (step === 'dashboard') {
        setDashboardSection('interviews');
      }
    }
    if (activeInterviewCount !== lastSeenInterviewCount) {
      setLastSeenInterviewCount(activeInterviewCount);
    }
  }, [activeInterviewCount, step, lastSeenInterviewCount]);

  // Testing State
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [optionOrders, setOptionOrders] = useState<Record<string, string[]>>({});
  const examQuestions = questionOrder
    .map((id) => questionBank.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseDraft>({});
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [testCaseResults, setTestCaseResults] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [completedSubmissionId, setCompletedSubmissionId] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<ApplicantSubmission | null>(null);
  const [integrityEvents, setIntegrityEvents] = useState<string[]>([]);
  const submittingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const timeSpentRef = useRef<Record<string, number>>({});
  const activeQuestionRef = useRef<{ id: string | null; enteredAt: number }>({ id: null, enteredAt: Date.now() });

  // Always show the latest saved version (professor decisions and RSVPs update it after submission)
  const completedSubmission =
    (completedSubmissionId && submissions.find((s) => s.id === completedSubmissionId)) ||
    (justSubmitted && justSubmitted.id === completedSubmissionId ? justSubmitted : null);

  const elapsedSeconds = startedAtMs ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)) : 0;
  const timeLeftSeconds = Math.max(0, timeLimitSeconds - elapsedSeconds);
  const isInGracePeriod = step === 'testing' && graceSeconds > 0 && elapsedSeconds >= timeLimitSeconds;
  const graceLeftSeconds = Math.max(0, timeLimitSeconds + graceSeconds - elapsedSeconds);

  // CollegeBoard Digital SAT Layout States
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [showQuestionMenu, setShowQuestionMenu] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showSatReviewScreen, setShowSatReviewScreen] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({});
  const [isEliminatorActive, setIsEliminatorActive] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [scratchpadText, setScratchpadText] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'flagged' | 'unanswered'>('all');

  // Bluebook Security & Lockdown States
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'lockdown' || params.get('lockdown') === 'true';
  });
  const [copyPasteAttempts, setCopyPasteAttempts] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [lockdownAlert, setLockdownAlert] = useState<string | null>(null);

  const progressKey = (inviteOrAssessmentId: string) => `sifted-progress:${lookupEmail}:${inviteOrAssessmentId}`;
  const detailsKey = `sifted-candidate-details:${lookupEmail}`;

  // Reset everything when a different student signs in while the portal stays mounted
  const previousAccountIdRef = useRef(currentUserAccount?.id);
  useEffect(() => {
    if (previousAccountIdRef.current === currentUserAccount?.id) return;
    previousAccountIdRef.current = currentUserAccount?.id;
    setApplicantPersonalEmail(currentUserAccount?.secondaryEmail || '');
    setUniversity(currentUserAccount?.university || '');
    setDegreeProgram(currentUserAccount?.degreeProgram || '');
    setGpa('');
    setAgreedToPledge(false);
    setStep('dashboard');
    setDashboardSection('all');
    setSelectedAssessmentId('');
    setActiveInvitationId('');
    setCompletedSubmissionId(null);
    setLastSeenInterviewCount(-1);
  }, [currentUserAccount?.id]);

  const logIntegrityEvent = (message: string) => {
    const elapsed = startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
    setIntegrityEvents((prev) => [...prev, `[${formatTime(elapsed)}] ${message}`]);
  };

  const showLockdownAlert = (message: string, ms = 4000) => {
    setLockdownAlert(message);
    setTimeout(() => setLockdownAlert(null), ms);
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const toggleEliminateOption = (questionId: string, option: string) => {
    const current = eliminatedOptions[questionId] || [];
    const exists = current.includes(option);
    setEliminatedOptions({
      ...eliminatedOptions,
      [questionId]: exists ? current.filter((o) => o !== option) : [...current, option],
    });
    // Striking out the currently selected option also deselects it
    if (!exists && responses[questionId]?.answer === option) {
      setResponses((prev) => ({ ...prev, [questionId]: { ...prev[questionId], answer: '' } }));
    }
  };

  const isQuestionAnswered = (questionId: string) => {
    const question = questionBank.find((q) => q.id === questionId);
    const ans = responses[questionId]?.answer;
    if (ans === undefined || ans === null) return false;
    if (typeof ans === 'string') {
      // Untouched starter code doesn't count as an answer
      if (question?.type === 'programming' && question.codeTemplate && ans.trim() === question.codeTemplate.trim()) return false;
      return ans.trim().length > 0;
    }
    if (Array.isArray(ans)) return ans.length > 0;
    return true;
  };

  const handleCalcButton = (btn: string) => {
    if (btn === 'C') {
      setCalcInput('');
      setCalcResult('');
    } else if (btn === 'CE') {
      setCalcInput((prev) => prev.slice(0, -1));
    } else if (btn === '=') {
      setCalcResult(evaluateArithmetic(calcInput));
    } else if (btn === '√' || btn === 'x²') {
      const base = calcInput ? evaluateArithmetic(calcInput) : calcResult || '0';
      const val = parseFloat(base);
      if (!Number.isFinite(val)) {
        setCalcResult('Error');
      } else {
        const result = btn === '√' ? Math.sqrt(val) : val * val;
        setCalcResult(Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : 'Error');
      }
    } else {
      // Continue calculating from the previous result when starting a new expression with an operator
      setCalcInput((prev) => (!prev && calcResult && calcResult !== 'Error' && /[+\-*/%]/.test(btn) ? calcResult + btn : prev + btn));
    }
  };

  const currentQuestion = examQuestions[currentQuestionIndex];

  const flushActiveQuestionTime = () => {
    const { id, enteredAt } = activeQuestionRef.current;
    const now = Date.now();
    if (id) {
      timeSpentRef.current[id] = (timeSpentRef.current[id] || 0) + (now - enteredAt) / 1000;
    }
    activeQuestionRef.current = { id, enteredAt: now };
  };

  // Track how long the candidate spends on each question
  const visibleQuestionId = step === 'testing' && !showSatReviewScreen ? currentQuestion?.id ?? null : null;
  useEffect(() => {
    flushActiveQuestionTime();
    activeQuestionRef.current = { id: visibleQuestionId, enteredAt: Date.now() };
  }, [visibleQuestionId]);

  // Exam clock
  useEffect(() => {
    if (step !== 'testing') return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Integrity monitoring, according to the professor's assessment settings
  useEffect(() => {
    if (step !== 'testing') return;

    const handleVisibilityChange = () => {
      if (document.hidden && integrityOptions.tabSwitchDetection) {
        setTabSwitches((prev) => prev + 1);
        logIntegrityEvent('Browser tab/window focus lost.');
        setShowCheatWarning(true);
        setTimeout(() => setShowCheatWarning(false), 5000);
      }
    };

    const handleClipboard = (e: ClipboardEvent) => {
      if (!integrityOptions.copyPasteDetection) return;
      e.preventDefault();
      setCopyPasteAttempts((prev) => prev + 1);
      logIntegrityEvent(`Blocked ${e.type} attempt.`);
      showLockdownAlert(
        e.type === 'paste'
          ? '⚠️ Security Violation: Pasting external content or code is strictly disabled.'
          : '⚠️ Security Violation: Copying assessment content is prohibited in Bluebook Secure Mode.'
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!isLockdownActive) return;
      e.preventDefault();
      showLockdownAlert('⚠️ Security Violation: Right-click context menu is locked during testing.', 3000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isClipboardShortcut = (e.ctrlKey || e.metaKey) && (key === 'c' || key === 'v' || key === 'x');
      const isDevtoolsShortcut = e.key === 'F12' || (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'c' || key === 'j'));
      if ((isClipboardShortcut && integrityOptions.copyPasteDetection) || (isDevtoolsShortcut && isLockdownActive)) {
        e.preventDefault();
        if (isClipboardShortcut) {
          setCopyPasteAttempts((prev) => prev + 1);
          logIntegrityEvent(`Blocked clipboard shortcut (${e.key}).`);
        }
        showLockdownAlert(`⚠️ Security Alert: Shortcut "${e.key}" is intercepted by Bluebook Proctoring Engine.`, 3500);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && isLockdownActive) {
        setTabSwitches((prev) => prev + 1);
        logIntegrityEvent('Exited fullscreen lockdown.');
        showLockdownAlert('⚠️ Integrity Alert: Fullscreen lockdown exited! This event is logged to your faculty report.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [step, isLockdownActive, integrityOptions.tabSwitchDetection, integrityOptions.copyPasteDetection]);

  // Save in-progress answers so the test can be resumed after a reload
  useEffect(() => {
    if (step !== 'testing' || !startedAtMs) return;
    const progress: SavedProgress = {
      questionOrder,
      optionOrders,
      responses,
      startedAtMs,
      currentQuestionIndex,
      tabSwitches,
      copyPasteAttempts,
      flaggedQuestions,
      timeSpent: timeSpentRef.current,
      integrityEvents,
      isLockdownActive,
    };
    writeStorage(progressKey(activeInvitationId || selectedAssessmentId), progress);
  }, [step, responses, currentQuestionIndex, tabSwitches, copyPasteAttempts, flaggedQuestions, integrityEvents, isLockdownActive]);

  const getStartBlocker = (inv: AssessmentInvitation): string | null => {
    const assessment = getAssessment(inv.assessmentId);
    if (!assessment) return 'This assessment is no longer available. Please contact your professor.';
    if (assessment.isActive === false) return 'Your professor has not published this assessment yet.';
    if (inv.status === 'completed' || inv.status === 'reviewed' || findSubmissionForInvite(inv)) {
      return 'You have already submitted this assessment.';
    }
    if (inv.status !== 'in-progress' && isPastDeadline(inv.deadline)) {
      return `The deadline for this assessment (${formatLocalDate(inv.deadline)}) has passed.`;
    }
    if (!assessment.questionIds?.some((id) => questionBank.some((q) => q.id === id))) {
      return 'This assessment has no questions yet. Please contact your professor.';
    }
    return null;
  };

  const validateCandidateDetails = (): string | null => {
    if (!agreedToPledge) return 'Please agree to the Academic Integrity Pledge before starting.';
    if (!EMAIL_PATTERN.test(applicantPersonalEmail.trim())) return 'Please enter a valid Secondary Personal Email before starting.';
    if (applicantEmail.trim().toLowerCase() === applicantPersonalEmail.trim().toLowerCase()) {
      return 'Your University Email and Personal Email must be distinct email addresses.';
    }
    if (!university.trim() || !degreeProgram.trim()) return 'Please enter your current university and degree program.';
    return null;
  };

  const startTest = (assessment: Assessment, invitationId: string, enableLockdown: boolean) => {
    const saved = readStorage<SavedProgress>(progressKey(invitationId || assessment.id));
    const questions = (assessment.questionIds || [])
      .map((id) => questionBank.find((q) => q.id === id))
      .filter((q): q is Question => q !== undefined);
    if (questions.length === 0) {
      alert('This assessment has no questions yet. Please contact your professor.');
      return;
    }
    const options: IntegrityOptions = { ...DEFAULT_INTEGRITY_OPTIONS, ...(assessment.integrityOptions || {}) };

    setSelectedAssessmentId(assessment.id);
    setActiveInvitationId(invitationId);

    if (saved && saved.questionOrder?.length) {
      // Resume: the clock keeps running from the original start time
      setQuestionOrder(saved.questionOrder);
      setOptionOrders(saved.optionOrders || {});
      setResponses(saved.responses || {});
      setStartedAtMs(saved.startedAtMs);
      startedAtRef.current = saved.startedAtMs;
      setCurrentQuestionIndex(Math.min(saved.currentQuestionIndex || 0, saved.questionOrder.length - 1));
      setTabSwitches(saved.tabSwitches || 0);
      setCopyPasteAttempts(saved.copyPasteAttempts || 0);
      setFlaggedQuestions(saved.flaggedQuestions || {});
      setIntegrityEvents([...(saved.integrityEvents || []), 'Session resumed.']);
      timeSpentRef.current = saved.timeSpent || {};
    } else {
      // Question order: shuffled per candidate if enabled; adaptive tests progress Basic → Research-Level
      let ordered = options.randomizeQuestionOrder ? shuffle(questions) : [...questions];
      if (assessment.isAdaptive) {
        ordered = ordered.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1));
      }
      const orders: Record<string, string[]> = {};
      const initialResponses: ResponseDraft = {};
      ordered.forEach((q) => {
        if (q.type === 'multiple-choice' && q.options) {
          orders[q.id] = options.randomizeAnswerOrder && q.randomizeOptions !== false ? shuffle(q.options) : [...q.options];
        }
        initialResponses[q.id] = {
          answer: q.type === 'programming' ? q.codeTemplate || '' : '',
          timeSpentSeconds: 0,
        };
      });
      const now = Date.now();
      setQuestionOrder(ordered.map((q) => q.id));
      setOptionOrders(orders);
      setResponses(initialResponses);
      setStartedAtMs(now);
      startedAtRef.current = now;
      setCurrentQuestionIndex(0);
      setTabSwitches(0);
      setCopyPasteAttempts(0);
      setFlaggedQuestions({});
      setIntegrityEvents([]);
      timeSpentRef.current = {};
    }

    setShowSatReviewScreen(false);
    setShowQuestionMenu(false);
    setEliminatedOptions({});
    setTestCaseResults({});
    setScratchpadText('');
    setCalcInput('');
    setCalcResult('');
    setLockdownAlert(null);
    setShowCheatWarning(false);
    setIsGrading(false);
    submittingRef.current = false;
    setNowMs(Date.now());

    const invitation = invitations.find((i) => i.id === invitationId);
    if (invitation && invitation.status === 'pending' && onUpdateInvitationStatus) {
      onUpdateInvitationStatus(invitationId, 'in-progress');
    }
    if (enableLockdown || options.fullScreenMode || isLockdownActive) {
      setIsLockdownActive(true);
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}
    }
    setStep('testing');
  };

  const handleStartTest = (enableLockdown: boolean) => {
    if (!activeAssessment) return;
    const problem = validateCandidateDetails();
    if (problem) {
      alert(problem);
      return;
    }
    startTest(activeAssessment, activeInvitationId, enableLockdown);
  };

  const handleOpenInvitation = (inv: AssessmentInvitation) => {
    const blocker = getStartBlocker(inv);
    if (blocker) {
      showNotice(blocker);
      return;
    }
    setSelectedAssessmentId(inv.assessmentId);
    setActiveInvitationId(inv.id);
    setStep('invite');
  };

  const handleLaunchInNewTab = () => {
    if (!activeAssessment) return;
    const problem = validateCandidateDetails();
    if (problem) {
      alert(problem);
      return;
    }
    // Hand the candidate details to the new tab; it signs in as the same student and starts this invitation
    writeStorage(detailsKey, { applicantPersonalEmail, university, degreeProgram, gpa });
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'lockdown');
    url.searchParams.set('autostart', 'true');
    if (currentUserAccount?.id) url.searchParams.set('accountId', currentUserAccount.id);
    if (activeInvitationId) url.searchParams.set('invitationId', activeInvitationId);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    setStep('dashboard');
    showNotice('Your secure exam opened in a new tab. Complete it there — your progress is saved automatically.', 7000);
  };

  // Secure-tab launch: start the requested invitation once on load
  const autostartHandledRef = useRef(false);
  useEffect(() => {
    if (autostartHandledRef.current) return;
    autostartHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') !== 'true') return;
    const invitationId = params.get('invitationId');
    // These parameters are one-shot: a reload should land on the dashboard (and offer "Resume")
    params.delete('autostart');
    params.delete('invitationId');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);

    const inv = myInvites.find((i) => i.id === invitationId);
    if (!inv) return;
    const blocker = getStartBlocker(inv);
    const assessment = getAssessment(inv.assessmentId);
    if (blocker || !assessment) {
      showNotice(blocker || 'This assessment is no longer available.');
      return;
    }
    const details = readStorage<{ applicantPersonalEmail: string; university: string; degreeProgram: string; gpa: string }>(detailsKey);
    if (details) {
      setApplicantPersonalEmail(details.applicantPersonalEmail || '');
      setUniversity(details.university || '');
      setDegreeProgram(details.degreeProgram || '');
      setGpa(details.gpa || '');
    }
    setAgreedToPledge(true);
    startTest(assessment, inv.id, true);
  }, []);

  const handleAnswerChange = (val: any) => {
    if (!currentQuestion) return;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        answer: val,
      },
    }));
  };

  const handleRunTestCases = () => {
    if (!currentQuestion) return;
    const visibleCases = (currentQuestion.testCases || []).filter((tc) => !tc.isHidden);
    const summary = visibleCases.length
      ? visibleCases.map((tc, i) => `Test ${i + 1}: input ${tc.input} → expected ${tc.expectedOutput}`).join('\n')
      : 'No sample test cases were provided for this question.';
    setTestCaseResults({
      ...testCaseResults,
      [currentQuestion.id]: `Code is not executed in the browser. Your solution is saved and will be reviewed against the professor's test cases after submission.\n${summary}`,
    });
  };

  // Lets the code editor indent with Tab instead of moving focus out of the textarea
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const indent = '    ';
    const next = value.slice(0, selectionStart) + indent + value.slice(selectionEnd);
    handleAnswerChange(next);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + indent.length;
    });
  };

  const handleSubmitAssessment = async (isAutoSubmit = false) => {
    if (submittingRef.current || !activeAssessment) return;
    if (!isAutoSubmit) {
      const unanswered = examQuestions.filter((q) => !isQuestionAnswered(q.id)).length;
      if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit your assessment anyway?`)) {
        return;
      }
    }
    submittingRef.current = true;
    setIsGrading(true);
    flushActiveQuestionTime();

    const finishedAt = Date.now();
    const timeAnalysis: Record<string, number> = {};
    const timedResponses: ResponseDraft = {};
    examQuestions.forEach((q) => {
      const seconds = Math.round(timeSpentRef.current[q.id] || 0);
      timeAnalysis[q.id] = seconds;
      timedResponses[q.id] = { answer: responses[q.id]?.answer ?? '', timeSpentSeconds: seconds };
    });

    // Calculate difficulty-weighted score and enforce zero points on empty/trivial answers
    const graded = calculateSubmissionGrading(examQuestions, timedResponses);
    let evaluatedResponses: Record<string, QuestionResponseItem> = graded.evaluatedResponses;

    // Ask the server-side AI to grade open-ended answers against the rubrics (when configured)
    let ai: any = null;
    try {
      const res = await fetch('/api/ai/grade-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          responses: evaluatedResponses,
          questions: examQuestions,
          overallScore: graded.overallScore,
          totalWeightedScore: graded.totalWeightedScore,
          maxTotalWeightedScore: graded.maxTotalWeightedScore,
        }),
      });
      const data = await res.json();
      if (data && data.success && !data.isFallback) ai = data;
    } catch (err) {
      console.error('Server AI grading unavailable, using built-in grading:', err);
    }

    if (ai && Array.isArray(ai.questionScores)) {
      evaluatedResponses = { ...evaluatedResponses };
      ai.questionScores.forEach((qs: { questionId: string; score: number; feedback: string }) => {
        const existing = evaluatedResponses[qs.questionId];
        if (!existing || graded.emptyCount === examQuestions.length) return;
        evaluatedResponses[qs.questionId] = {
          ...existing,
          aiScore: existing.aiScore === 0 && existing.aiConfidence === 99 ? 0 : qs.score, // empty answers stay at zero
          aiFeedback: qs.feedback || existing.aiFeedback,
          aiConfidence: ai.confidenceScore ?? 85,
          isCorrect: qs.score >= existing.maxScore * 0.7,
        };
      });
    }

    const responseList = Object.values(evaluatedResponses);
    const avgConfidence = responseList.length
      ? Math.round((responseList.reduce((a, r) => a + r.aiConfidence, 0) / responseList.length) * 10) / 10
      : 0;
    const aiDetectionEnabled = integrityOptions.aiAnswerDetection && ai !== null;
    const aiProb = aiDetectionEnabled ? Number(ai.aiGeneratedProbability) || 0 : 0;
    const flagThreshold = getAiFlagThreshold(assessmentProfessor?.aiSensitivity);
    const fullscreenExits = integrityEvents.filter((e) => e.includes('Exited fullscreen')).length;

    const draft: ApplicantSubmission = {
      id: `sub-${finishedAt}`,
      assessmentId: activeAssessment.id,
      invitationId: activeInvitationId || undefined,
      applicantName,
      applicantEmail: applicantEmail.toLowerCase(),
      secondaryEmail: applicantPersonalEmail.trim(),
      university: university.trim(),
      degreeProgram: degreeProgram.trim(),
      gpa: gpa.trim() || undefined,
      status: 'completed',
      startTime: new Date(startedAtRef.current || finishedAt).toISOString(),
      finishTime: new Date(finishedAt).toISOString(),
      totalTimeSpentSeconds: Math.min(
        timeLimitSeconds + graceSeconds,
        Math.round((finishedAt - (startedAtRef.current || finishedAt)) / 1000)
      ),
      responses: evaluatedResponses,
      overallScore: graded.overallScore,
      totalWeightedScore: graded.totalWeightedScore,
      maxTotalWeightedScore: graded.maxTotalWeightedScore,
      topicBreakdown: graded.topicBreakdown,
      timeAnalysis,
      confidenceScore: ai?.confidenceScore ?? avgConfidence,
      interviewRecommendation: graded.interviewRecommendation,
      recommendationExplanation: graded.recommendationExplanation,
      aiSummary: graded.aiSummary,
      integrityReport: {
        tabSwitchCount: tabSwitches,
        copyPasteAttempts,
        aiGeneratedProbability: aiProb,
        integrityFlagged: tabSwitches > 5 || copyPasteAttempts > 3 || (aiDetectionEnabled && aiProb > flagThreshold) || graded.emptyCount > 0,
        notes: [
          `Tab switches recorded: ${tabSwitches}${integrityOptions.tabSwitchDetection ? '' : ' (tab switch detection disabled)'}.`,
          `Blocked copy/paste attempts: ${copyPasteAttempts}${integrityOptions.copyPasteDetection ? '' : ' (copy/paste detection disabled)'}.`,
          isLockdownActive || fullscreenExits > 0
            ? `Full screen session monitored${fullscreenExits ? ` — FLAGGED: exited fullscreen ${fullscreenExits} time(s)` : ''}.`
            : 'Taken without fullscreen lockdown.',
          !integrityOptions.aiAnswerDetection
            ? 'AI-generated answer detection disabled for this assessment.'
            : ai
            ? `AI-generated text probability: ${aiProb}% (flag threshold ${flagThreshold}%).`
            : 'AI-generated text analysis unavailable (Gemini AI not configured).',
          ...(isAutoSubmit ? ['Auto-submitted when the time limit expired.'] : []),
          ...(graded.emptyCount > 0
            ? [`FLAGGED: ${graded.emptyCount} empty or unmodified boilerplate answers submitted (0 points awarded).`]
            : []),
          ...integrityEvents,
        ],
      },
      professorNotes: '',
      professorDecision: 'Pending',
    };

    // Re-total with any AI per-question scores, then derive the tier from the final score
    const submission = ai ? applyScoreOverrides(draft, {}, examQuestions) : draft;
    const level = getHireabilityLevel(submission.overallScore, graded.emptyCount, examQuestions.length);
    submission.hireabilityLevel = level;
    submission.interviewRecommendation = ai?.interviewRecommendation || getRecommendationFromLevel(level);
    if (ai?.recommendationExplanation) submission.recommendationExplanation = ai.recommendationExplanation;
    if (ai?.aiSummary) submission.aiSummary = ai.aiSummary;

    // Strict rule: never recommend a candidate who left half the test empty or scored under 50%
    if (graded.emptyCount >= Math.ceil(examQuestions.length / 2) || submission.overallScore < 50) {
      submission.hireabilityLevel = 'Tier 4: Does Not Meet Technical Bar';
      submission.interviewRecommendation = 'Do Not Recommend';
    }

    setIsGrading(false);
    if (activeInvitationId && onUpdateInvitationStatus) {
      onUpdateInvitationStatus(activeInvitationId, 'completed');
    }
    writeStorage(progressKey(activeInvitationId || activeAssessment.id), null);
    setJustSubmitted(submission);
    setCompletedSubmissionId(submission.id);
    onCompleteAssessment(submission);
    setStep('completed');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    // Confetti celebration!
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.error('Confetti error:', e);
    }
  };

  // Auto-submit once the time limit (plus any late-submission grace period) runs out
  useEffect(() => {
    if (step === 'testing' && startedAtMs && elapsedSeconds >= timeLimitSeconds + graceSeconds) {
      handleSubmitAssessment(true);
    }
  }, [step, startedAtMs, elapsedSeconds, timeLimitSeconds, graceSeconds]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-[#0F172A] text-white p-4 rounded-lg shadow-sm border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block">Sifted • Candidate Portal</span>
            <span className="text-[11px] text-slate-400">
              {activeAssessment?.title || 'Graduate Admissions Screening Exam'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            if (
              step === 'testing' &&
              !window.confirm('Leave the exam? Your answers are saved, but the timer keeps running. You can resume from your dashboard.')
            ) {
              return;
            }
            onExitPortal();
          }}
          className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-1.5 rounded-md border border-slate-700 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Notification Banner */}
      {portalNotice && (
        <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between text-sm font-bold animate-fade-in border border-emerald-500">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
            <span>{portalNotice}</span>
          </div>
          <button onClick={() => setPortalNotice(null)} className="text-white hover:text-emerald-200 font-extrabold px-2 py-1">✕</button>
        </div>
      )}

      {/* STEP 0: ASSIGNED ASSESSMENTS DASHBOARD */}
      {step === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Candidate Welcome & Identity Card */}
          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center space-x-4">
                <img
                  src={currentUserAccount?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                  alt={applicantName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 shadow-md"
                />
                <div>
                  <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded text-[11px] font-bold border border-emerald-200 uppercase tracking-wider mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Candidate Profile</span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {applicantName}
                  </h1>
                  <p className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span>{lookupEmail}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{university}</span>
                    <span>•</span>
                    <span>{degreeProgram}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => onOpenAuthModal && onOpenAuthModal()}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Switch Account / Sign In</span>
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-600">
                Showing test invitations & status for <strong className="text-slate-900">{lookupEmail}</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                All application status changes remain synchronized with the faculty portal.
              </span>
            </div>
          </div>

          {/* Quick Metrics & Overview Bar */}
          {(() => {
            const pendingInterviews = mySubmissions.filter((s) => s.professorDecision !== 'Interview' && s.professorDecision !== 'Reject').length;
            const acceptedInterviews = myInterviews.length;
            const scoredSubmissions = mySubmissions.filter(canSeeScore);
            const avgScore = scoredSubmissions.length > 0 ? `${Math.round(scoredSubmissions.reduce((acc, curr) => acc + curr.overallScore, 0) / scoredSubmissions.length)}%` : '—';

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Submitted Applications</span>
                    <span className="text-2xl font-extrabold text-slate-900">{mySubmissions.length}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Pending Professor Review</span>
                    <span className="text-2xl font-extrabold text-amber-600">{pendingInterviews}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Accepted for Interview</span>
                    <span className="text-2xl font-extrabold text-emerald-600">{acceptedInterviews}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Avg Screening Score</span>
                    <span className="text-2xl font-extrabold text-blue-600" title={scoredSubmissions.length === 0 ? 'Your professors have not released scores yet' : undefined}>{avgScore}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Dashboard Section Switcher (Home vs Interviews) */}
          <div className="flex items-center space-x-3 border-b border-slate-200 pb-2">
            <button
              onClick={() => setDashboardSection('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                dashboardSection === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Overview & Applications</span>
            </button>
            <button
              onClick={() => setDashboardSection('interviews')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                dashboardSection === 'interviews'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                  : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Interviews</span>
              {(() => {
                const count = myInterviews.length;
                return count > 0 ? (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${dashboardSection === 'interviews' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'}`}>
                    {count}
                  </span>
                ) : null;
              })()}
            </button>
          </div>

          {/* SECTION: INTERVIEWS */}
          {dashboardSection === 'interviews' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 sm:p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                    <Video className="w-3.5 h-3.5" />
                    <span>Faculty Interview Schedule & Video Meeting Links</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Your Scheduled 1-on-1 Faculty Interviews
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
                    When a professor reviews your PhD screening exam and invites you to an interview, your confirmed meeting date, time slot, and Google Meet video link will be synchronized here.
                  </p>
                </div>
              </div>

              {(() => {
                if (myInterviews.length === 0) {
                  return (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900">No Scheduled Interviews Yet</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          Once your application status changes to <strong>Accepted</strong> and a faculty professor assigns your meeting details, your date and meeting link will appear in this section.
                        </p>
                      </div>
                      <button
                        onClick={() => setDashboardSection('all')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                      >
                        ← Return to Overview & Applications
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-6">
                    {myInterviews.map((sub) => {
                      const assessment = assessments.find((a) => a.id === sub.assessmentId);
                      const meetingLinkUrl = sub.meetingLink || '';

                      return (
                        <div key={sub.id} className="bg-white rounded-2xl border-2 border-emerald-400 shadow-lg overflow-hidden transition-all hover:shadow-xl">
                          <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-5 text-white flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner">
                                📅
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm">
                                  Status: Accepted for Interview 🎉
                                </span>
                                <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                                  {assessment?.title || 'PhD Research Lab Screening'}
                                </h3>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-emerald-200 block">Candidate Email</span>
                              <span className="text-xs font-bold text-white">{sub.applicantEmail}</span>
                            </div>
                          </div>

                          <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                                <span className="text-xs font-bold text-slate-500 flex items-center">
                                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                                  Confirmed Meeting Date
                                </span>
                                <span className="text-sm font-extrabold text-slate-900 block">
                                  {formatLocalDate(sub.interviewDate)}
                                </span>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                                <span className="text-xs font-bold text-slate-500 flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                                  Time Slot (EST)
                                </span>
                                <span className="text-sm font-extrabold text-emerald-700 block">
                                  {sub.interviewTime || '10:00 AM EST'}
                                </span>
                              </div>

                              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-300 space-y-1">
                                <span className="text-xs font-bold text-emerald-900 flex items-center">
                                  <Video className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                                  Video Conference Room
                                </span>
                                <span className="text-xs font-mono font-bold text-emerald-800 truncate block">
                                  {meetingLinkUrl || 'Link pending — your professor will add it'}
                                </span>
                              </div>
                            </div>

                            {/* Candidate RSVP / Acceptance Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div>
                                <span className="text-xs font-bold text-slate-700 block">
                                  Interview Invitation RSVP Status:
                                </span>
                                {sub.applicantResponseToInterview === 'Accepted' ? (
                                  <span className="inline-flex items-center text-xs font-extrabold text-emerald-600 mt-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> You accepted this interview invitation.
                                  </span>
                                ) : sub.applicantResponseToInterview === 'Declined' ? (
                                  <span className="inline-flex items-center text-xs font-extrabold text-rose-600 mt-1 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                                    <X className="w-4 h-4 mr-1 text-rose-600" /> You denied/declined this interview invitation.
                                  </span>
                                ) : (
                                  <span className="text-xs text-amber-700 font-semibold block mt-0.5">
                                    Please confirm whether you will attend this faculty interview.
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                                <button
                                  onClick={() => handleRSVP('Accepted', sub)}
                                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-sm ${
                                    sub.applicantResponseToInterview === 'Accepted'
                                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-2'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{sub.applicantResponseToInterview === 'Accepted' ? 'Accepted ✓' : 'Accept Invitation'}</span>
                                </button>
                                <button
                                  onClick={() => handleRSVP('Declined', sub)}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                    sub.applicantResponseToInterview === 'Declined'
                                      ? 'bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-2'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>{sub.applicantResponseToInterview === 'Declined' ? 'Declined ✓' : 'Deny Invitation'}</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500">
                                💡 Please join the video link 5 minutes before your scheduled start time.
                              </span>
                              <div className="flex items-center space-x-3 w-full sm:w-auto">
                                <button
                                  onClick={() => openSubmissionStatus(sub)}
                                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-300 flex items-center justify-center space-x-1.5"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Screening Report</span>
                                </button>
                                {meetingLinkUrl ? (
                                  <a
                                    href={meetingLinkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                                  >
                                    <Video className="w-4 h-4" />
                                    <span>Join Video Meeting 🎥</span>
                                  </a>
                                ) : (
                                  <span className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-not-allowed">
                                    <Video className="w-4 h-4" />
                                    <span>Meeting link pending</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {dashboardSection === 'all' && (
            <>
              {/* My Applications & Synchronized Interview Status */}
          {(() => {
            if (mySubmissions.length > 0) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
                      <GraduationCap className="w-5 h-5 mr-2 text-indigo-600" />
                      My Submitted Applications & Faculty Status
                    </h2>
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                      Live Synchronized with Professor Portal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {mySubmissions.map((sub) => {
                      const isAccepted = sub.professorDecision === 'Interview';
                      const isRejected = sub.professorDecision === 'Reject';
                      const isPending = !isAccepted && !isRejected;
                      const assessment = assessments.find((a) => a.id === sub.assessmentId);

                      return (
                        <div
                          key={sub.id}
                          className={`bg-white rounded-xl border p-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm ${
                            isAccepted ? 'border-emerald-300 bg-emerald-50/20' : isRejected ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              {isAccepted && (
                                <span className="inline-flex items-center space-x-1 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm animate-pulse">
                                  <CheckCircle2 className="w-4 h-4 mr-1" /> 🎉 Status: Accepted — Interview Scheduled by Professor
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center space-x-1 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                  <X className="w-4 h-4 mr-1" /> Not Selected for Interview
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center space-x-1 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                  <Clock className="w-4 h-4 mr-1" /> ⏳ Status: Pending Faculty Review
                                </span>
                              )}

                              {canSeeScore(sub) && (
                                <>
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded border border-slate-200">
                                    Score: <strong className="text-slate-900 font-bold">{sub.overallScore}%</strong>
                                  </span>

                                  {sub.hireabilityLevel && (
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${getHireabilityBadgeStyle(sub.hireabilityLevel)}`}>
                                      {sub.hireabilityLevel}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                              {assessment?.title || 'Screening Assessment (no longer available)'}
                            </h3>

                            <p className="text-xs text-slate-600">
                              <strong>Research Group:</strong> {assessment?.researchGroup || '—'} • <strong>University:</strong> {sub.university} • <strong>Degree:</strong> {sub.degreeProgram}
                            </p>

                            {isAccepted && (
                              <div className="bg-emerald-100/70 p-3 rounded-lg border border-emerald-300 text-xs text-emerald-950 font-medium space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                                    <span><strong>Congratulations! Status: Accepted.</strong> The faculty committee has reviewed your AI screening results and invited you to a formal professor interview. {sub.interviewDate ? `Your interview meeting has been scheduled by the professor for ${formatLocalDate(sub.interviewDate)} at ${sub.interviewTime || 'a time to be confirmed'}.` : 'The professor will assign your meeting date and time shortly.'}</span>
                                  </div>
                                  <button
                                    onClick={() => setDashboardSection('interviews')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-colors shrink-0 flex items-center space-x-1"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>View Meeting Link 🎥</span>
                                  </button>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-emerald-200/80">
                                  <div>
                                    {sub.applicantResponseToInterview === 'Accepted' ? (
                                      <span className="font-bold text-emerald-800 flex items-center">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" /> RSVP Status: Accepted ✓
                                      </span>
                                    ) : sub.applicantResponseToInterview === 'Declined' ? (
                                      <span className="font-bold text-rose-800 flex items-center">
                                        <X className="w-3.5 h-3.5 mr-1 text-rose-700" /> RSVP Status: Declined ✗
                                      </span>
                                    ) : (
                                      <span className="font-bold text-amber-900">
                                        ⚠️ RSVP Required: Please accept or deny this interview invitation.
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                                    <button
                                      onClick={() => handleRSVP('Accepted', sub)}
                                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${
                                        sub.applicantResponseToInterview === 'Accepted'
                                          ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-sm'
                                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                      }`}
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>{sub.applicantResponseToInterview === 'Accepted' ? 'Accepted ✓' : 'Accept'}</span>
                                    </button>
                                    <button
                                      onClick={() => handleRSVP('Declined', sub)}
                                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${
                                        sub.applicantResponseToInterview === 'Declined'
                                          ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-sm'
                                          : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 shadow-sm'
                                      }`}
                                    >
                                      <X className="w-3 h-3" />
                                      <span>{sub.applicantResponseToInterview === 'Declined' ? 'Declined ✓' : 'Deny'}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {isRejected && (
                              <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-xs text-rose-900 font-medium flex items-center justify-between flex-wrap gap-2">
                                <span>The professor has completed their review for this research lab position and decided not to proceed with an interview at this time.</span>
                                {onUpdateSubmission && (
                                  <button
                                    onClick={() => handleHideSubmission(sub)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm shrink-0"
                                    title="Remove this rejected application from your dashboard"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove from Dashboard</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => openSubmissionStatus(sub)}
                              className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 shadow-sm ${
                                isAccepted
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : isRejected
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                              }`}
                            >
                              <Calendar className={`w-4 h-4 ${isAccepted ? 'text-white' : isRejected ? 'text-rose-600' : 'text-indigo-600'}`} />
                              <span>{isAccepted ? 'View Accepted Status & Meeting 🎉' : 'View Professor Review Status'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Assigned Assessments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                Your Assigned Screening Assessments
              </h2>
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200">
                {myInvites.length} Directed Invitation(s)
              </span>
            </div>

            {(() => {
              if (myInvites.length === 0) {
                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-lg font-bold text-slate-900">No Assessments Assigned</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        To prevent candidates from taking random tests, you can only access screening exams specifically assigned to <strong className="text-slate-900">{lookupEmail}</strong> by a university faculty professor.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => onOpenAuthModal && onOpenAuthModal()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Switch Account</span>
                      </button>
                      {onAssignDemoTest && (
                        <button
                          onClick={() => onAssignDemoTest(lookupEmail)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Demo: Assign Sample Exam to My Email Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4">
                  {myInvites.map((inv) => {
                    const assessment = getAssessment(inv.assessmentId);
                    const submission = findSubmissionForInvite(inv);
                    const isDone = inv.status === 'completed' || inv.status === 'reviewed' || Boolean(submission);
                    const isProg = !isDone && inv.status === 'in-progress';
                    const blocker = isDone ? null : getStartBlocker(inv);
                    const assigningProfessor = professors.find((p) => p.id === inv.professorId);

                    return (
                      <div
                        key={inv.id}
                        className={`bg-white rounded-xl border p-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm ${
                          isDone ? 'border-slate-200 bg-slate-50/50' : isProg ? 'border-amber-300 bg-amber-50/30' : blocker ? 'border-slate-200' : 'border-indigo-200 hover:border-indigo-400 hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            {isDone ? (
                              <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" /> Completed & Submitted
                              </span>
                            ) : isProg ? (
                              <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-amber-600 mr-1" /> In Progress
                              </span>
                            ) : blocker ? (
                              <span className="inline-flex items-center space-x-1 bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                                <Lock className="w-3.5 h-3.5 mr-1" /> Unavailable
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 mr-1" /> Ready to Take
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-500">
                              Assigned by <strong className="text-slate-800">{assigningProfessor?.name || 'Faculty Advisor'}</strong>
                            </span>
                            {inv.deadline && (
                              <span className={`text-xs px-2 py-0.5 rounded border flex items-center ${
                                !isDone && isPastDeadline(inv.deadline) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                <Calendar className="w-3 h-3 mr-1 text-slate-500" /> Deadline: {formatLocalDate(inv.deadline)}
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                            {assessment?.title || 'Assessment no longer available'}
                          </h3>
                          
                          {assessment && (
                            <p className="text-xs text-slate-600">
                              <strong>Research Lab:</strong> {assessment.researchGroup} • <strong>Semester:</strong> {assessment.semester} • <strong>Time Limit:</strong> {assessment.timeLimitMinutes} Minutes
                            </p>
                          )}

                          {inv.notes && (
                            <div className="bg-indigo-50/70 p-2.5 rounded-md border border-indigo-100 text-xs text-indigo-900 flex items-start space-x-2 mt-2">
                              <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <span><strong>Professor's Instructions:</strong> "{inv.notes}"</span>
                            </div>
                          )}

                          {blocker && (
                            <p className="text-xs text-slate-600 font-semibold flex items-center">
                              <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
                              {blocker}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-2">
                          {isDone ? (
                            submission && !submission.hiddenByApplicant ? (
                              <button
                                onClick={() => openSubmissionStatus(submission)}
                                className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 shadow-sm ${
                                  submission.professorDecision === 'Interview'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                    : submission.professorDecision === 'Reject'
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                                }`}
                              >
                                <Calendar className="w-4 h-4" />
                                <span>{submission.professorDecision === 'Interview' ? 'View Accepted Status & Meeting 🎉' : 'View Professor Review Status'}</span>
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">Submitted</span>
                            )
                          ) : (
                            <button
                              onClick={() => handleOpenInvitation(inv)}
                              disabled={Boolean(blocker)}
                              className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 transition-colors flex items-center justify-center space-x-2"
                            >
                              <span>{isProg ? 'Resume Directed Test' : 'Start Directed Test'}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* PhD Screening Roadmap Guide */}
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-lg space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">Admissions Roadmap</span>
              <h3 className="text-xl font-bold tracking-tight">Understanding Your Candidate Journey</h3>
              <p className="text-xs text-slate-400">
                How Sifted bridges applicants with top-tier university faculty labs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                  01
                </div>
                <h4 className="text-sm font-bold text-white">Directed Exam</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Complete customized technical assessments assigned directly by faculty advisors.
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                  02
                </div>
                <h4 className="text-sm font-bold text-white">AI Evaluation</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gemini AI verifies your code, mathematical proofs, and research rationale in real-time.
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  03
                </div>
                <h4 className="text-sm font-bold text-white">Faculty Review</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Professors review your report and schedule interviews directly through the portal.
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  04
                </div>
                <h4 className="text-sm font-bold text-white">Lab Offer</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Top tier fellows receive direct interview invitations and graduate fellowship offers.
                </p>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* STEP 1: INVITATION & VERIFICATION */}
      {step === 'invite' && activeAssessment && (
        <div className="bg-white p-8 md:p-10 rounded-lg border border-slate-200 shadow-sm space-y-8 animate-fade-in relative">
          <button
            onClick={() => {
              if (activeInterviewCount > 0) {
                setDashboardSection('interviews');
              }
              setStep('dashboard');
            }}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-md border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Assigned Tests</span>
          </button>
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure University Admissions Assessment</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeAssessment.title}
            </h1>
            <p className="text-sm text-slate-600">
              You have been invited by <span className="font-bold text-slate-900">{activeAssessment.researchGroup}</span> to complete this initial technical screening exam.
            </p>
            {activeAssessment.description && (
              <p className="text-xs text-slate-500 leading-relaxed">{activeAssessment.description}</p>
            )}
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <Clock className="w-4 h-4 mr-2 text-indigo-600" /> Assessment Rules & Instructions:
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900">Time Limit:</strong> You have {activeAssessment.timeLimitMinutes} minutes once you click Start
                  {graceSeconds > 0 ? ', plus a 5-minute grace period' : ''}. The timer keeps running if you leave, and the test is submitted automatically when time runs out.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900">Questions:</strong> {activeAssessment.questionIds.length} question(s)
                  {activeAssessment.isAdaptive ? ', ordered from foundational to research-level difficulty' : ''}
                  {integrityOptions.randomizeQuestionOrder ? '; order is randomized for each candidate' : ''}.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong className="text-slate-900">Programming:</strong> Code is reviewed against the professor's rubric and test cases after you submit; it isn't executed in the browser.</span>
              </li>
              <li className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900">Anti-Cheating Integrity:</strong>{' '}
                  {[
                    integrityOptions.fullScreenMode && 'fullscreen is required',
                    integrityOptions.tabSwitchDetection && 'tab switching is logged',
                    integrityOptions.copyPasteDetection && 'copy/paste is blocked and logged',
                    integrityOptions.aiAnswerDetection && 'answers are checked for AI-generated text',
                  ]
                    .filter(Boolean)
                    .join('; ') || 'no monitoring is enabled for this assessment'}
                  .
                </span>
              </li>
            </ul>
          </div>

          {/* Candidate Form */}
          <div className="space-y-4 pt-2">
            <h3 className="text-base font-bold text-slate-900">Verify Candidate Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Legal Name</label>
                <input
                  type="text"
                  value={applicantName}
                  readOnly
                  title="From your signed-in account"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">University Email Address</label>
                <input
                  type="email"
                  value={applicantEmail}
                  readOnly
                  title="Your submission is linked to the email of your signed-in account"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Personal Email Address *</label>
                <input
                  type="email"
                  required
                  value={applicantPersonalEmail}
                  onChange={(e) => setApplicantPersonalEmail(e.target.value)}
                  placeholder="e.g. alex.personal@gmail.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Current University / Institution *</label>
                <input
                  type="text"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Degree Program & Major *</label>
                <input
                  type="text"
                  required
                  value={degreeProgram}
                  onChange={(e) => setDegreeProgram(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Undergraduate GPA (optional)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  placeholder="e.g. 3.7"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <label className="flex items-start space-x-3 p-4 rounded-lg bg-indigo-50/50 border border-indigo-200 cursor-pointer mt-4 shadow-sm">
              <input
                type="checkbox"
                checked={agreedToPledge}
                onChange={(e) => setAgreedToPledge(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
              />
              <span className="text-xs text-slate-800 leading-relaxed font-medium">
                <strong>Academic Integrity Pledge:</strong> I certify that I will complete this screening assessment independently without external assistance, unauthorized LLMs, or copying code from third-party sources. I understand that session tab switching is monitored.
              </span>
            </label>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700 shadow-xl space-y-4 mt-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm tracking-tight uppercase text-slate-100">
                  Select Proctoring & Testing Environment
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                • CollegeBoard Bluebook Standard
              </span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              For official graduate admissions and scholarship screening, choose a secure lockdown environment. This isolates the assessment in full-screen mode and monitors integrity violations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Option A: Open in New Secure Tab */}
              <button
                onClick={handleLaunchInNewTab}
                className="p-4 rounded-lg bg-gradient-to-br from-indigo-900/90 to-slate-900 hover:from-indigo-800 hover:to-slate-800 border-2 border-indigo-500/80 hover:border-indigo-400 text-left transition-all group shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-indigo-500 text-white font-extrabold text-[10px] tracking-wider uppercase">
                      <Lock className="w-3 h-3" />
                      <span>Recommended Official</span>
                    </span>
                    <ExternalLink className="w-4 h-4 text-indigo-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <h4 className="font-bold text-sm text-white group-hover:text-indigo-200 transition-colors">
                    Launch in New Secure Tab & Lockdown
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-normal">
                    Opens a dedicated, clean exam tab with auto-fullscreen and proctoring enabled.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-indigo-800/60 flex items-center justify-between text-xs font-bold text-indigo-300">
                  <span>Launch Secure Window →</span>
                  <span className="text-[10px] font-mono bg-indigo-950 px-2 py-0.5 rounded">Isolates Session</span>
                </div>
              </button>

              {/* Option B: Current Window Lockdown */}
              <button
                onClick={() => handleStartTest(true)}
                className="p-4 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-left transition-all group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-bold text-[10px] tracking-wider uppercase">
                      <Monitor className="w-3 h-3" />
                      <span>Fullscreen Lockdown</span>
                    </span>
                    <Maximize2 className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors">
                    Begin in Current Tab (Lockdown)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Enters full-screen security mode immediately in your active browser window.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>Start Fullscreen Now →</span>
                  <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400">Standard Proctoring</span>
                </div>
              </button>
            </div>

            {integrityOptions.fullScreenMode ? (
              <div className="flex items-center pt-3 border-t border-slate-800 text-xs text-slate-400 space-x-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Your professor requires fullscreen lockdown for this assessment.</span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-400 flex items-center space-x-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Prefer not to use fullscreen? This still counts as your graded attempt.</span>
                </span>
                <button
                  onClick={() => handleStartTest(false)}
                  className="text-slate-300 hover:text-white underline font-semibold transition-colors"
                >
                  Start Without Fullscreen Lockdown
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ACTIVE TESTING (COLLEGEBOARD DIGITAL SAT / BLUEBOOK LAYOUT) */}
      {step === 'testing' && currentQuestion && (
        <div className="space-y-4 animate-fade-in pb-12">
          {/* SECURE LOCKDOWN & PROCTORING STATUS RIBBON */}
          <div className="bg-slate-950 text-slate-200 px-5 py-2.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono shadow-inner gap-3">
            <div className="flex items-center space-x-3">
              <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded font-bold border ${
                isLockdownActive 
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 shadow-xs' 
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full inline-block mr-1 ${isLockdownActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {isLockdownActive ? '🔒 BLUEBOOK SECURE LOCKDOWN ACTIVE' : '🛡️ PROCTORING EYE MONITORING ON'}
              </span>
              <span className="text-slate-400 hidden lg:inline">
                Session: <span className="text-slate-200">#{activeAssessment?.id?.slice(0, 12).toUpperCase()}</span>
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 text-[11px]">Security Log:</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                  tabSwitches + copyPasteAttempts > 0 
                    ? 'bg-rose-900/90 text-rose-200 border border-rose-600 animate-pulse' 
                    : 'bg-slate-800 text-emerald-400 border border-slate-700'
                }`}>
                  {tabSwitches + copyPasteAttempts === 0 ? '✓ Zero Violations' : `⚠️ ${tabSwitches + copyPasteAttempts} Violations`}
                </span>
              </div>
              <button
                onClick={toggleFullscreen}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded border border-slate-700 flex items-center space-x-1 font-sans font-semibold text-[11px] transition-colors"
                title="Toggle Fullscreen Lockdown Mode"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
              {isLockdownActive && !integrityOptions.fullScreenMode && (
                <button
                  onClick={() => {
                    if (window.confirm('WARNING: Exiting Lockdown Mode will terminate your secure proctoring session and log an immediate integrity violation. Do you wish to proceed?')) {
                      setIsLockdownActive(false);
                      setTabSwitches((prev) => prev + 1);
                      logIntegrityEvent('Candidate exited lockdown mode manually.');
                      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    }
                  }}
                  className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 px-2.5 py-1 rounded border border-rose-800 text-[11px] font-sans font-bold transition-colors"
                >
                  Exit Lockdown
                </button>
              )}
            </div>
          </div>

          {isLockdownActive && !isFullscreen && (
            <div className="bg-amber-500 text-slate-950 p-3.5 rounded-lg shadow-xl flex items-center justify-between text-xs font-bold border border-amber-300">
              <div className="flex items-center space-x-2.5">
                <Monitor className="w-5 h-5 shrink-0" />
                <span>This assessment runs in fullscreen lockdown. Please return to fullscreen to continue.</span>
              </div>
              <button
                onClick={toggleFullscreen}
                className="bg-slate-950 text-amber-300 px-3 py-1.5 rounded font-bold hover:bg-slate-800 transition-colors shrink-0"
              >
                Enter Fullscreen
              </button>
            </div>
          )}

          {isInGracePeriod && (
            <div className="bg-amber-600 text-white p-3.5 rounded-lg shadow-xl flex items-center justify-between text-xs font-bold border border-amber-400">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-5 h-5 shrink-0" />
                <span>Time is up — you're in the late-submission grace period. Your answers will be submitted automatically in {formatTime(graceLeftSeconds)}.</span>
              </div>
            </div>
          )}

          {/* Floating Security Violation Alerts */}
          {showCheatWarning && (
            <div className="bg-red-600 text-white p-3.5 rounded-lg shadow-xl flex items-center justify-between text-xs font-bold animate-bounce border border-red-400">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>INTEGRITY ALERT: Browser tab focus loss detected! This event has been logged to your faculty report.</span>
              </div>
              <span className="bg-red-950 px-2.5 py-1 rounded text-[10px] uppercase font-mono tracking-wider">Warning #{tabSwitches}</span>
            </div>
          )}

          {lockdownAlert && (
            <div className="bg-rose-600 text-white p-3.5 rounded-lg shadow-xl flex items-center justify-between text-xs font-bold animate-bounce border border-rose-400">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0 animate-pulse text-amber-300" />
                <span>{lockdownAlert}</span>
              </div>
              <span className="bg-rose-950 px-2.5 py-1 rounded text-[10px] uppercase font-mono tracking-wider">Logged Violation</span>
            </div>
          )}

          {/* 1. COLLEGEBOARD DIGITAL SAT TOP NAVBAR */}
          <div className="bg-[#0F172A] text-white px-6 py-3.5 rounded-t-lg shadow-md border-b border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="font-extrabold tracking-tight text-sm text-white">
                Section 1: {activeAssessment?.title || 'Technical & Algorithmic Screening'}
              </span>
              <span className="hidden md:inline-block text-[11px] text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700 font-medium">
                Directions: Answer each prompt. Use scratchpad & calculator as needed.
              </span>
            </div>

            {/* Timer Box */}
            <div className="flex items-center space-x-3 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700">
              <Clock className={`w-4 h-4 ${timeLeftSeconds < 300 && !isTimerHidden ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`} />
              <span className={`font-mono font-bold text-xs ${timeLeftSeconds < 300 && !isTimerHidden ? 'text-rose-400 animate-pulse' : 'text-slate-100'}`}>
                {isTimerHidden ? 'Timer Hidden' : isInGracePeriod ? `Grace ${formatTime(graceLeftSeconds)}` : formatTime(timeLeftSeconds)}
              </span>
              <button
                onClick={() => setIsTimerHidden(!isTimerHidden)}
                className="text-slate-400 hover:text-white transition-colors focus:outline-none flex items-center space-x-1 pl-2 border-l border-slate-600 text-[11px] font-medium"
                title={isTimerHidden ? 'Show Timer' : 'Hide Timer'}
              >
                {isTimerHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isTimerHidden ? 'Show' : 'Hide'}</span>
              </button>
            </div>

            {/* Right Tools (Calculator & Reference) */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => { setShowCalculator(!showCalculator); setShowReferenceSheet(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-colors border ${
                  showCalculator ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculator & Scratchpad</span>
              </button>
              <button
                onClick={() => { setShowReferenceSheet(!showReferenceSheet); setShowCalculator(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-colors border ${
                  showReferenceSheet ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reference</span>
              </button>
            </div>
          </div>

          {/* 2. ON-SCREEN CALCULATOR & SCRATCHPAD DRAWER */}
          {showCalculator && (
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg text-white shadow-xl animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              <button
                onClick={() => setShowCalculator(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Scientific / Basic Calculator */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">On-Screen SAT Scientific Calculator</h3>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-right font-mono space-y-1">
                  <div className="text-xs text-slate-500 min-h-[16px]">{calcInput || '0'}</div>
                  <div className="text-xl font-bold text-emerald-400 overflow-x-auto min-h-[28px]">{calcResult || calcInput || '0'}</div>
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-xs font-mono font-bold">
                  {['C', 'CE', '(', ')', '√', '7', '8', '9', '/', 'x²', '4', '5', '6', '*', '%', '1', '2', '3', '-', '.', '0', '00', '+', '='].map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleCalcButton(btn)}
                      className={`py-2.5 rounded transition-all active:scale-95 border ${
                        btn === '=' ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 col-span-2' :
                        ['C', 'CE'].includes(btn) ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border-rose-800' :
                        ['/', '*', '-', '+', '√', 'x²', '%'].includes(btn) ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700' :
                        'bg-slate-800/80 hover:bg-slate-700 text-slate-100 border-slate-700'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Digital Scratchpad */}
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">Digital Scratchpad & Notes</h3>
                  </div>
                  <button
                    onClick={() => setScratchpadText('')}
                    className="text-[10px] text-slate-400 hover:text-rose-400 underline font-medium"
                  >
                    Clear Notes
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Jot down intermediate algebraic steps, complexity bounds, or pseudo-code.</p>
                <textarea
                  rows={8}
                  value={scratchpadText}
                  onChange={(e) => setScratchpadText(e.target.value)}
                  placeholder="Type your scratchpad calculations here... (persist during session)"
                  className="w-full flex-1 p-3 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* 3. SAT FORMULA & REFERENCE SHEET MODAL */}
          {showReferenceSheet && (
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg text-white shadow-xl animate-fade-in space-y-4 relative">
              <button
                onClick={() => setShowReferenceSheet(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">SAT / Graduate Research Standard Reference & Cheat Sheet</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2 font-mono">
                  <div className="text-indigo-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1">Linear Algebra & SVD</div>
                  <div className="text-slate-300">A = U Σ Vᵀ</div>
                  <div className="text-slate-400 text-[11px]">UᵀU = I, VᵀV = I</div>
                  <div className="text-slate-300 pt-1">Ridge Regression (L2):</div>
                  <div className="text-amber-300">w = (XᵀX + λI)⁻¹ Xᵀy</div>
                </div>
                <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2 font-mono">
                  <div className="text-emerald-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1">Asymptotic Big-O Complexity</div>
                  <div className="text-slate-300">Merge Sort: O(N log N)</div>
                  <div className="text-slate-300">Quick Sort (Avg): O(N log N)</div>
                  <div className="text-slate-300">Matrix Mult (Naive): O(N³)</div>
                  <div className="text-amber-300">Attention (Self): O(N² • d)</div>
                </div>
                <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2 font-mono">
                  <div className="text-purple-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1">Probability & ML Bounds</div>
                  <div className="text-slate-300">Bayes' Rule:</div>
                  <div className="text-amber-300">P(A|B) = [P(B|A)P(A)] / P(B)</div>
                  <div className="text-slate-300 pt-1">Softmax: σ(z)ᵢ = e^(zᵢ) / Σ e^(zⱼ)</div>
                </div>
              </div>
            </div>
          )}

          {/* 4. SAT CHECK YOUR WORK / SUMMARY SCREEN OR SINGLE QUESTION VIEW */}
          {showSatReviewScreen ? (
            <div className="bg-white p-6 md:p-8 rounded-b-lg border border-slate-200 shadow-sm space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Check Your Work • Section Summary</h2>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    On the Digital SAT and this doctoral screening, you can check any questions you flagged for review or left unanswered before submitting.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowSatReviewScreen(false)}
                    className="px-4 py-2 rounded-md font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center space-x-1.5 border border-slate-300"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Questions</span>
                  </button>
                  <button
                    onClick={() => handleSubmitAssessment()}
                    disabled={isGrading}
                    className="px-6 py-2 rounded-md font-bold text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition-colors flex items-center space-x-2"
                  >
                    {isGrading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>AI Grading...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Submit Assessment</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Stats Overview Pill Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div 
                  onClick={() => setReviewFilter('all')}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'all' ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Questions</span>
                  <span className="text-2xl font-extrabold text-slate-900">{examQuestions.length}</span>
                </div>
                <div 
                  onClick={() => setReviewFilter('all')}
                  className="p-4 rounded-lg border bg-emerald-50/50 border-emerald-200 cursor-pointer"
                >
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Answered
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {examQuestions.filter(q => isQuestionAnswered(q.id)).length}
                  </span>
                </div>
                <div 
                  onClick={() => setReviewFilter('unanswered')}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'unanswered' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200' : 'bg-amber-50/40 border-amber-200 hover:bg-amber-100/50'}`}
                >
                  <span className="text-[11px] font-bold text-amber-800 uppercase block flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Unanswered
                  </span>
                  <span className="text-2xl font-extrabold text-amber-800">
                    {examQuestions.filter(q => !isQuestionAnswered(q.id)).length}
                  </span>
                </div>
                <div 
                  onClick={() => setReviewFilter('flagged')}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'flagged' ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200' : 'bg-rose-50/40 border-rose-200 hover:bg-rose-100/50'}`}
                >
                  <span className="text-[11px] font-bold text-rose-800 uppercase block flex items-center gap-1">
                    <Flag className="w-3.5 h-3.5 fill-current" /> Marked for Review
                  </span>
                  <span className="text-2xl font-extrabold text-rose-800">
                    {Object.values(flaggedQuestions).filter(Boolean).length}
                  </span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-500 mr-2">Filter View:</span>
                {(['all', 'unanswered', 'flagged'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReviewFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${
                      reviewFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter === 'all' ? `All (${examQuestions.length})` : filter === 'unanswered' ? `Unanswered (${examQuestions.filter(q => !isQuestionAnswered(q.id)).length})` : `Marked for Review (${Object.values(flaggedQuestions).filter(Boolean).length})`}
                  </button>
                ))}
              </div>

              {/* Question Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {examQuestions
                  .map((q, idx) => ({ q, idx }))
                  .filter(({ q }) => {
                    if (reviewFilter === 'unanswered') return !isQuestionAnswered(q.id);
                    if (reviewFilter === 'flagged') return flaggedQuestions[q.id];
                    return true;
                  })
                  .map(({ q, idx }) => {
                    const answered = isQuestionAnswered(q.id);
                    const flagged = flaggedQuestions[q.id];
                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setShowSatReviewScreen(false);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md flex flex-col justify-between space-y-3 relative ${
                          flagged ? 'border-amber-500 bg-amber-50/30' : answered ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-dashed border-rose-300 bg-rose-50/20'
                        }`}
                      >
                        {flagged && (
                          <div className="absolute top-3 right-3 text-amber-600 flex items-center space-x-1 bg-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">
                            <Flag className="w-3 h-3 fill-current" />
                            <span>Flagged</span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-500 truncate">{q.topic}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">{q.title}</h4>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className={`font-bold ${answered ? 'text-emerald-600 flex items-center gap-1' : 'text-rose-600 flex items-center gap-1'}`}>
                            {answered ? <><CheckCircle2 className="w-3.5 h-3.5" /> Answered</> : <><AlertCircle className="w-3.5 h-3.5" /> Unanswered</>}
                          </span>
                          <span className="text-indigo-600 font-semibold hover:underline">Jump to # {idx + 1} →</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* SINGLE QUESTION VIEW (SAT BLUEBOOK STYLE) */
            <div className="bg-white p-6 md:p-8 rounded-b-lg border border-t-0 border-slate-200 shadow-sm space-y-6">
              {/* Question Header Bar */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-3">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-md bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    {currentQuestionIndex + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-extrabold text-slate-900">{currentQuestion.title}</h2>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {currentQuestion.difficulty}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{currentQuestion.topic} • {currentQuestion.points} Points</span>
                  </div>
                </div>

                {/* Right Action Ribbon: Eliminator & Flag */}
                <div className="flex items-center space-x-2">
                  {currentQuestion.type === 'multiple-choice' && (
                    <button
                      onClick={() => setIsEliminatorActive(!isEliminatorActive)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-all border ${
                        isEliminatorActive
                          ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                      title="SAT Option Eliminator: Cross out choices you know are incorrect"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>{isEliminatorActive ? 'Eliminator On' : 'Eliminate Choices'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-all border ${
                      flaggedQuestions[currentQuestion.id]
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${flaggedQuestions[currentQuestion.id] ? 'fill-current' : ''}`} />
                    <span>{flaggedQuestions[currentQuestion.id] ? 'Marked for Review' : 'Mark for Review'}</span>
                  </button>
                </div>
              </div>

              {/* Question Prompt */}
              <div className="space-y-3">
                <p className="text-sm text-slate-800 font-normal leading-relaxed whitespace-pre-wrap">{currentQuestion.prompt}</p>

                {/* Research materials referenced by the prompt */}
                {currentQuestion.researchContext && (
                  <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Context: </span>
                    {currentQuestion.researchContext}
                  </div>
                )}
                {currentQuestion.paperExcerpt && (
                  <blockquote className="bg-white p-3 rounded-md border-l-4 border-indigo-400 text-xs text-slate-700 italic whitespace-pre-wrap">
                    {currentQuestion.paperExcerpt}
                  </blockquote>
                )}
                {currentQuestion.chartData && currentQuestion.chartData.length > 0 && currentQuestion.chartType !== 'none' && (
                  <div className="h-64 w-full bg-white rounded-md border border-slate-200 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      {currentQuestion.chartType === 'bar' ? (
                        <BarChart data={currentQuestion.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="y" name="Series 1" fill="#6366f1" />
                          {currentQuestion.chartData.some((d) => d.y2 !== undefined) && <Bar dataKey="y2" name="Series 2" fill="#f59e0b" />}
                        </BarChart>
                      ) : currentQuestion.chartType === 'scatter' ? (
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
                          <YAxis dataKey="y" tick={{ fill: '#475569', fontSize: 11 }} />
                          <Tooltip />
                          <Scatter data={currentQuestion.chartData} fill="#6366f1" />
                        </ScatterChart>
                      ) : (
                        <LineChart data={currentQuestion.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="y" name="Series 1" stroke="#6366f1" strokeWidth={2} />
                          {currentQuestion.chartData.some((d) => d.y2 !== undefined) && (
                            <Line type="monotone" dataKey="y2" name="Series 2" stroke="#f59e0b" strokeWidth={2} />
                          )}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}

                {/* If Math LaTeX */}
                {currentQuestion.latexFormula && (
                  <div className="bg-[#0F172A] text-amber-300 font-mono p-4 rounded-md border border-slate-700 overflow-x-auto text-xs my-3">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-1">Mathematical Formula / Expression:</span>
                    {currentQuestion.latexFormula}
                  </div>
                )}
              </div>

              {/* If Multiple Choice (With SAT Option Eliminator / Strikethrough) */}
              {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                <div className="space-y-3 pt-2">
                  {(optionOrders[currentQuestion.id] || currentQuestion.options).map((opt, i) => {
                    const isSelected = responses[currentQuestion.id]?.answer === opt;
                    const isEliminated = (eliminatedOptions[currentQuestion.id] || []).includes(opt);

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (isEliminatorActive) {
                            toggleEliminateOption(currentQuestion.id, opt);
                          } else {
                            if (!isEliminated) handleAnswerChange(opt);
                          }
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between shadow-sm ${
                          isEliminated
                            ? 'bg-slate-100/60 border-slate-200 opacity-60 line-through text-slate-400'
                            : isSelected
                            ? 'bg-indigo-50/90 border-indigo-600 ring-1 ring-indigo-600'
                            : 'bg-white border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center font-bold text-xs justify-center shrink-0 ${
                            isEliminated ? 'border-slate-300 bg-slate-200 text-slate-500' :
                            isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400 text-slate-600'
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className={`text-sm font-medium ${isEliminated ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {opt}
                          </span>
                        </div>

                        {/* Strikethrough Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEliminateOption(currentQuestion.id, opt);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors border ${
                            isEliminated
                              ? 'bg-slate-300 text-slate-700 border-slate-400'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-800'
                          }`}
                          title="Strike through option"
                        >
                          {isEliminated ? 'Undo Strike' : '~~ Strike'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* If Short Answer or Essay */}
              {(currentQuestion.type === 'short-answer' || currentQuestion.type === 'long-form-essay' || currentQuestion.type === 'math' || currentQuestion.type === 'research') && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Your Written Response / Derivation:</span>
                    <span className="text-[11px] font-normal text-slate-400">Math expressions & detailed steps accepted</span>
                  </label>
                  <textarea
                    rows={currentQuestion.type === 'long-form-essay' ? 8 : 4}
                    value={responses[currentQuestion.id]?.answer || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your rigorous answer or mathematical steps here..."
                    className="w-full p-4 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal leading-relaxed shadow-sm"
                  />
                </div>
              )}

              {/* If Programming */}
              {currentQuestion.type === 'programming' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center">
                      <Code className="w-4 h-4 mr-1.5 text-indigo-600" />
                      Interactive Code Editor ({currentQuestion.language || 'Python'})
                    </span>
                    <button
                      onClick={handleRunTestCases}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-xs font-medium shadow-sm flex items-center space-x-1.5 transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>View Sample Test Cases</span>
                    </button>
                  </div>

                  <textarea
                    rows={10}
                    spellCheck={false}
                    value={responses[currentQuestion.id]?.answer ?? currentQuestion.codeTemplate ?? ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    onKeyDown={handleCodeKeyDown}
                    className="w-full p-4 bg-[#0F172A] text-emerald-400 font-mono rounded-md border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed shadow-sm"
                  />

                  {/* Test Case Output */}
                  {testCaseResults[currentQuestion.id] && (
                    <div className="bg-emerald-50/80 border border-emerald-300 p-4 rounded-md text-emerald-900 text-xs font-mono animate-fade-in shadow-sm whitespace-pre-wrap">
                      <span className="font-bold uppercase tracking-wider block mb-1">Test Cases:</span>
                      {testCaseResults[currentQuestion.id]}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. COLLEGEBOARD DIGITAL SAT QUESTION MENU & BOTTOM NAVBAR */}
          <div className="bg-[#0F172A] text-white px-6 py-4 rounded-lg shadow-md border border-slate-700 flex flex-wrap items-center justify-between gap-4 mt-6 relative">
            {/* Left: Applicant Name & Question Menu Toggle */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 border-r border-slate-700 pr-4">
                <User className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">{applicantName || 'Applicant'}</span>
              </div>
              <button
                onClick={() => setShowQuestionMenu(!showQuestionMenu)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-md border border-slate-600 flex items-center space-x-2 text-xs shadow-sm transition-colors"
              >
                <Grid className="w-3.5 h-3.5 text-indigo-400" />
                <span>Question {currentQuestionIndex + 1} of {examQuestions.length}</span>
                {showQuestionMenu ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Right: Navigation Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (showSatReviewScreen) {
                    setShowSatReviewScreen(false);
                  } else {
                    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
                  }
                }}
                disabled={currentQuestionIndex === 0 && !showSatReviewScreen}
                className="px-4 py-2 rounded-md font-bold text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center space-x-1 border border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {!showSatReviewScreen && currentQuestionIndex < examQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
                  className="px-5 py-2 rounded-md font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : !showSatReviewScreen ? (
                <button
                  onClick={() => setShowSatReviewScreen(true)}
                  className="px-5 py-2 rounded-md font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Check Your Work</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSubmitAssessment()}
                  disabled={isGrading}
                  className="px-6 py-2 rounded-md font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  {isGrading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Grading...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Submit Final Assessment</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* INTERACTIVE SAT QUESTION MATRIX POPOVER / BOTTOM SHEET */}
            {showQuestionMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-3 bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl animate-fade-in z-50 text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Grid className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">Section 1: Question Menu & Navigation</h3>
                  </div>
                  <button
                    onClick={() => setShowQuestionMenu(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pb-4 mb-4 border-b border-slate-800 font-medium">
                  <span className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 bg-indigo-600 rounded-sm" /> Answered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-slate-500 rounded-sm" /> Unanswered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-amber-500 fill-current" /> Marked for Review
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 ring-2 ring-blue-300/40 rounded-sm" /> Current
                  </span>
                </div>

                {/* Grid of Number Tiles */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {examQuestions.map((q, idx) => {
                    const isCurrent = idx === currentQuestionIndex && !showSatReviewScreen;
                    const answered = isQuestionAnswered(q.id);
                    const flagged = flaggedQuestions[q.id];

                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setShowQuestionMenu(false);
                          setShowSatReviewScreen(false);
                        }}
                        className={`h-11 rounded-md font-bold text-xs flex items-center justify-center relative transition-all border ${
                          isCurrent
                            ? 'border-blue-400 ring-2 ring-blue-400/50 bg-blue-900/60 text-white shadow-md scale-105'
                            : answered
                            ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500'
                            : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        <span>{idx + 1}</span>
                        {flagged && (
                          <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm" title="Marked for Review">
                            <Flag className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => {
                      setShowQuestionMenu(false);
                      setShowSatReviewScreen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold px-4 py-2 rounded border border-slate-700 text-xs flex items-center space-x-1.5"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Go to Section Summary (Check Your Work) →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: PROFESSOR REVIEW STATUS & MEETING SETUP */}
      {step === 'completed' && completedSubmission && (() => {
        const decision = completedSubmission.professorDecision || 'Pending';
        const isAccepted = decision === 'Interview';
        const isDenied = decision === 'Reject';
        const isPending = !isAccepted && !isDenied;
        const subAssessment = getAssessment(completedSubmission.assessmentId);
        const groupName = subAssessment?.researchGroup || 'the Faculty Committee';
        const showScore = canSeeScore(completedSubmission);

        return (
          <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-xl space-y-8 animate-fade-in max-w-3xl mx-auto text-left">
            {/* Header & Status Banner */}
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left ${
              isAccepted
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/50 border-emerald-300 text-emerald-950 shadow-sm'
                : isDenied
                ? 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-200 text-rose-950'
                : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/50 border-amber-200 text-amber-950'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                isAccepted ? 'bg-emerald-600 text-white animate-bounce' : isDenied ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white animate-pulse'
              }`}>
                {isAccepted && <CheckCircle2 className="w-9 h-9" />}
                {isDenied && <X className="w-9 h-9" />}
                {isPending && <Clock className="w-9 h-9" />}
              </div>
              
              <div className="space-y-1.5 flex-1">
                <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isAccepted ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300' : isDenied ? 'bg-rose-200/80 text-rose-900 border border-rose-300' : 'bg-amber-200/80 text-amber-900 border border-amber-300'
                }`}>
                  {isAccepted && <span>🎉 Status: Accepted — Interview Requested</span>}
                  {isDenied && <span>❌ Status: Review Completed — Denied</span>}
                  {isPending && <span>⏳ Status: Pending Faculty Review</span>}
                </span>

                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1">
                  {isAccepted ? 'Congratulations! Faculty Interview Invitation' : isDenied ? 'Application Status Update' : 'Professor Review in Progress'}
                </h1>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  {isAccepted && (
                    <span>
                      Great news, <strong>{completedSubmission.applicantName}</strong>! The faculty committee for <strong>{groupName}</strong> has reviewed your screening credentials and selected you for a formal 1-on-1 interview.
                    </span>
                  )}
                  {isDenied && (
                    <span>
                      Thank you for applying, <strong>{completedSubmission.applicantName}</strong>. After careful review of your screening assessment by <strong>{groupName}</strong>, the professor has decided not to proceed with an interview for this lab position at this time. We wish you the best in your graduate research career.
                    </span>
                  )}
                  {isPending && (
                    <span>
                      Thank you for completing your screening assessment, <strong>{completedSubmission.applicantName}</strong>. Your candidate file has been securely routed to <strong>{groupName}</strong>. You'll see the professor's decision here once they have reviewed your answers.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Faculty Meeting Schedule (Assigned by Professor) (Only visible if Accepted!) */}
            {isAccepted && (
              <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                      📅
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Your 1-on-1 Faculty Interview Schedule</h3>
                      <p className="text-xs text-slate-400">Meeting date and time assigned by your faculty professor.</p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold border border-emerald-500/30">
                    Status: Accepted
                  </span>
                </div>

                {completedSubmission.interviewDate ? (
                  <div className="bg-slate-800/80 rounded-xl p-6 border border-emerald-500/40 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="inline-flex items-center text-xs font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> ✅ Meeting Date Confirmed by Professor
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
                        <span className="text-xs text-slate-400 font-medium block">Confirmed Date</span>
                        <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                          {formatLocalDate(completedSubmission.interviewDate)}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
                        <span className="text-xs text-slate-400 font-medium block">Confirmed Time Slot</span>
                        <span className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 block">
                          {completedSubmission.interviewTime || 'To be confirmed'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-4 rounded-lg border border-emerald-500/40 flex flex-col justify-between gap-2">
                        <div>
                          <span className="text-xs text-emerald-300 font-bold flex items-center">
                            <Video className="w-3.5 h-3.5 mr-1" />
                            Meeting Link
                          </span>
                          <span className="text-xs font-mono text-slate-300 truncate block mt-0.5">
                            {completedSubmission.meetingLink || 'Link pending'}
                          </span>
                        </div>
                        {completedSubmission.meetingLink && (
                          <a
                            href={completedSubmission.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded text-xs transition-colors text-center flex items-center justify-center space-x-1 shadow-sm"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Join Video 🎥</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                      💡 Join the video link 5 minutes before your scheduled start time. If you need to request a rescheduling, please contact your faculty coordinator directly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700/80 text-center py-8">
                    <Clock className="w-8 h-8 text-amber-400 mx-auto animate-pulse mb-2" />
                    <h4 className="text-base font-bold text-white">Waiting for Professor to Assign Meeting Date</h4>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      Congratulations! Your application status is <strong>Accepted</strong> for an interview. The professor will set your meeting date and time slot shortly. Please check back soon.
                    </p>
                  </div>
                )}

                {/* RSVP Controls inside Completed View */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">
                      Your Interview Invitation RSVP Status:
                    </span>
                    {completedSubmission.applicantResponseToInterview === 'Accepted' ? (
                      <span className="inline-flex items-center text-xs font-extrabold text-emerald-400 mt-1 bg-emerald-950/60 px-3 py-1 rounded border border-emerald-500/50">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> You accepted this interview invitation.
                      </span>
                    ) : completedSubmission.applicantResponseToInterview === 'Declined' ? (
                      <span className="inline-flex items-center text-xs font-extrabold text-rose-400 mt-1 bg-rose-950/60 px-3 py-1 rounded border border-rose-500/50">
                        <X className="w-4 h-4 mr-1 text-rose-400" /> You declined this interview invitation.
                      </span>
                    ) : (
                      <span className="text-xs text-amber-300 font-semibold block mt-0.5">
                        Please confirm whether you will attend this faculty interview.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleRSVP('Accepted', completedSubmission)}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-sm ${
                        completedSubmission.applicantResponseToInterview === 'Accepted'
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{completedSubmission.applicantResponseToInterview === 'Accepted' ? 'Accepted ✓' : 'Accept Invitation'}</span>
                    </button>
                    <button
                      onClick={() => handleRSVP('Declined', completedSubmission)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        completedSubmission.applicantResponseToInterview === 'Declined'
                          ? 'bg-rose-600 text-white ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900'
                          : 'bg-slate-700 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{completedSubmission.applicantResponseToInterview === 'Declined' ? 'Declined ✓' : 'Deny Invitation'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Application Details Summary Box */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Submitted Application Summary
                </h3>
                {!showScore && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-800 border border-amber-300">
                    <Lock className="w-3 h-3 mr-1" /> Scores not released by your professor
                  </span>
                )}
              </div>

              {!showScore ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-slate-400 block">University / Institution</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">{completedSubmission.university}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-slate-400 block">Target Degree Program</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">{completedSubmission.degreeProgram}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-slate-400 block">Exam Review Status</span>
                      <span className={`text-xs font-bold mt-0.5 block ${isPending ? 'text-amber-700' : 'text-slate-800'}`}>
                        {isPending ? '⏳ Under Faculty Review' : '✓ Review Completed'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50/90 p-4 rounded-xl border border-amber-200 text-amber-950 text-xs flex items-start space-x-3 shadow-sm">
                    <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="font-bold block text-sm">Exam Performance & Score Hidden</strong>
                      <p className="leading-relaxed text-slate-700 font-medium">
                        To preserve academic testing integrity, your professor has chosen not to show screening scores, correct and incorrect answers, or grading feedback to candidates for this assessment.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                (() => {
                  const itemsToDisplay = (subAssessment?.questionIds || Object.keys(completedSubmission.responses || {}))
                    .map((qid, idx) => {
                      const resp = completedSubmission.responses?.[qid];
                      if (!resp) return null;
                      const q = questionBank.find((qb) => qb.id === qid);
                      const score = getEffectiveScore(resp);
                      return {
                        id: qid,
                        number: idx + 1,
                        title: q?.title || `Question ${idx + 1}`,
                        topic: q?.topic || 'General',
                        difficulty: q?.difficulty || 'Intermediate',
                        points: resp.maxScore || q?.points || 10,
                        score,
                        isFull: score >= resp.maxScore,
                        isPartial: score > 0 && score < resp.maxScore,
                      };
                    })
                    .filter((item): item is NonNullable<typeof item> => item !== null)
                    .map((item, idx) => ({ ...item, number: idx + 1 }));

                  const totalEvaluated = itemsToDisplay.length;
                  const correctCount = itemsToDisplay.filter((item) => item.isFull).length;
                  const partialCount = itemsToDisplay.filter((item) => item.isPartial).length;
                  const wrongCount = totalEvaluated - correctCount - partialCount;
                  const timeSpentSec = completedSubmission.totalTimeSpentSeconds || 0;
                  const timeSpentFormatted = timeSpentSec > 0 ? `${Math.floor(timeSpentSec / 60)}m ${timeSpentSec % 60}s` : 'N/A';

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-semibold text-slate-400 block">Institution</span>
                          <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate" title={completedSubmission.university}>{completedSubmission.university}</span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-semibold text-slate-400 block">Degree Program</span>
                          <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate" title={completedSubmission.degreeProgram}>{completedSubmission.degreeProgram}</span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-semibold text-slate-400 block">Overall Score</span>
                          <span className="text-xs font-extrabold text-indigo-600 mt-0.5 block">{completedSubmission.overallScore}%</span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs bg-emerald-50/30">
                          <span className="text-[10px] font-semibold text-emerald-700 block">Full Credit</span>
                          <span className="text-xs font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 shrink-0" />
                            <span>{correctCount} / {totalEvaluated}</span>
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-rose-200 shadow-2xs bg-rose-50/30">
                          <span className="text-[10px] font-semibold text-rose-700 block">Partial / No Credit</span>
                          <span className="text-xs font-extrabold text-rose-700 mt-0.5 flex items-center gap-1">
                            <X className="w-3.5 h-3.5 inline text-rose-600 shrink-0" />
                            <span>{partialCount + wrongCount} / {totalEvaluated}</span>
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-semibold text-slate-400 block">Time Spent</span>
                          <span className="text-xs font-bold text-slate-800 mt-0.5 block">{timeSpentFormatted}</span>
                        </div>
                      </div>

                      {/* Question-by-Question Breakdown */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Exam Question Performance Breakdown
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {correctCount} Full • {partialCount} Partial • {wrongCount} No Credit
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                          {itemsToDisplay.map((item) => (
                            <div key={item.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 ${
                                  item.isFull ? 'bg-emerald-100 text-emerald-800' : item.isPartial ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  Q{item.number}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-slate-800 block truncate">{item.title}</span>
                                  <span className="text-[10px] text-slate-500">{item.topic} • {item.difficulty} • {item.points} Pts</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3 shrink-0">
                                <span className="text-xs font-bold text-slate-600">
                                  {item.score} / {item.points} pts
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center space-x-1 border ${
                                  item.isFull
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : item.isPartial
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                  {item.isFull ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Full Credit</span>
                                    </>
                                  ) : item.isPartial ? (
                                    <span>Partial Credit</span>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3" />
                                      <span>0 Pts</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 italic">
                        * Note: To preserve testing integrity and academic fairness, detailed automated derivation rubrics and step-by-step AI solutions are reserved for faculty committee review only.
                        {isPending ? ' Scores may still change after professor review.' : ''}
                      </p>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Footer Navigation Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setDashboardSection(isAccepted ? 'interviews' : 'all');
                  setStep('dashboard');
                }}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-bold text-xs border border-slate-300 transition-colors shadow-sm"
              >
                ← Return to Student Dashboard
              </button>
              <button
                onClick={onExitPortal}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold text-xs shadow-sm shadow-indigo-200 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
