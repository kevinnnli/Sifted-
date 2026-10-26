import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { notify } from '../../notify';
import { asButton } from '../ui/a11y';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Grid,
  List,
  Maximize2,
  Minimize2,
  Monitor,
  Scissors,
  ShieldAlert,
  Terminal,
  User,
  X,
} from 'lucide-react';
// The chart library is large and only research questions need it, so it loads on demand
const QuestionChart = lazy(() => import('./QuestionChart'));
import { ApiError, api, errorMessage } from '../../api';
import { AttemptProgress, ExamAttemptView, StudentSubmissionView } from '../../types';
import { evaluateArithmetic, formatTime } from './examUtils';

interface ExamSessionProps {
  attempt: ExamAttemptView;
  onSubmitted: (submission: StudentSubmissionView) => void;
  // The attempt no longer exists on the server (submitted from another tab, or removed)
  onAttemptGone: (message: string) => void;
}

const AUTOSAVE_DELAY_MS = 1500;

/**
 * One in-progress test. The server owns the start time, question order and answer key: this
 * component autosaves answers and integrity events, and the server grades on submit.
 */
export const ExamSession: React.FC<ExamSessionProps> = ({ attempt, onSubmitted, onAttemptGone }) => {
  const assessment = attempt.assessment;
  const integrityOptions = assessment.integrityOptions;
  const applicantName = attempt.applicantName;
  const examQuestions = attempt.questions;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(Math.min(attempt.currentQuestionIndex, Math.max(0, examQuestions.length - 1)));
  const [responses, setResponses] = useState<Record<string, any>>(attempt.responses);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>(attempt.flagged);
  const [tabSwitches, setTabSwitches] = useState(attempt.tabSwitches);
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(attempt.copyPasteAttempts);
  const [integrityEvents, setIntegrityEvents] = useState<string[]>(attempt.integrityEvents);
  const [isLockdownActive, setIsLockdownActive] = useState(attempt.lockdown);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [testCaseResults, setTestCaseResults] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');

  // Exam layout state
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [lockdownAlert, setLockdownAlert] = useState<string | null>(null);
  // Move keyboard and screen-reader focus to the review screen's heading when it opens
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (showSatReviewScreen) reviewHeadingRef.current?.focus();
  }, [showSatReviewScreen]);

  // The clock follows the server: correct for any difference between this device's clock and the server's
  const clockOffsetRef = useRef(Date.parse(attempt.serverNow) - Date.now());
  const startedAtMs = Date.parse(attempt.startedAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const elapsedSeconds = Math.max(0, Math.floor((nowMs + clockOffsetRef.current - startedAtMs) / 1000));
  const timeLimitSeconds = attempt.timeLimitSeconds;
  const graceSeconds = attempt.graceSeconds;
  const timeLeftSeconds = Math.max(0, timeLimitSeconds - elapsedSeconds);
  const isInGracePeriod = graceSeconds > 0 && elapsedSeconds >= timeLimitSeconds;
  const graceLeftSeconds = Math.max(0, timeLimitSeconds + graceSeconds - elapsedSeconds);

  const submittingRef = useRef(false);
  const finishedRef = useRef(false);
  const timeSpentRef = useRef<Record<string, number>>({ ...attempt.timeSpent });
  const activeQuestionRef = useRef<{ id: string | null; enteredAt: number }>({ id: null, enteredAt: Date.now() });

  const currentQuestion = examQuestions[currentQuestionIndex];

  const logIntegrityEvent = (message: string) => {
    const elapsed = Math.floor((Date.now() + clockOffsetRef.current - startedAtMs) / 1000);
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
    if (!exists && responses[questionId] === option) {
      setResponses((prev) => ({ ...prev, [questionId]: '' }));
    }
  };

  const isQuestionAnswered = (questionId: string) => {
    const question = examQuestions.find((q) => q.id === questionId);
    const ans = responses[questionId];
    if (ans === undefined || ans === null) return false;
    if (typeof ans === 'string') {
      // Untouched starter code doesn't count as an answer
      if (question?.type === 'programming' && question.codeTemplate && ans.trim() === question.codeTemplate.trim()) return false;
      return ans.trim().length > 0;
    }
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

  const flushActiveQuestionTime = () => {
    const { id, enteredAt } = activeQuestionRef.current;
    const now = Date.now();
    if (id) timeSpentRef.current[id] = (timeSpentRef.current[id] || 0) + (now - enteredAt) / 1000;
    activeQuestionRef.current = { id, enteredAt: now };
  };

  // Track how long the candidate spends on each question
  const visibleQuestionId = !showSatReviewScreen ? currentQuestion?.id ?? null : null;
  useEffect(() => {
    flushActiveQuestionTime();
    activeQuestionRef.current = { id: visibleQuestionId, enteredAt: Date.now() };
  }, [visibleQuestionId]);

  // Exam clock
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buildProgress = (): AttemptProgress => {
    flushActiveQuestionTime();
    return {
      responses,
      flagged: flaggedQuestions,
      currentQuestionIndex,
      timeSpent: { ...timeSpentRef.current },
      tabSwitches,
      copyPasteAttempts,
      integrityEvents,
      lockdown: isLockdownActive,
    };
  };

  const handleServerRejection = (e: unknown) => {
    if (e instanceof ApiError && e.status === 409 && e.data?.submission) {
      finishedRef.current = true;
      onSubmitted(e.data.submission);
      return true;
    }
    if (e instanceof ApiError && e.status === 404) {
      finishedRef.current = true;
      onAttemptGone('This test is no longer in progress — it may have been submitted from another tab.');
      return true;
    }
    return false;
  };

  const saveProgress = async () => {
    if (finishedRef.current || submittingRef.current) return;
    setSaveState('saving');
    try {
      await api.student.saveAttempt(attempt.id, buildProgress());
      setSaveState('saved');
    } catch (e) {
      if (!handleServerRejection(e)) setSaveState('error');
    }
  };

  // Autosave shortly after any change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState('pending');
    const timeout = setTimeout(saveProgress, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [responses, flaggedQuestions, currentQuestionIndex, tabSwitches, copyPasteAttempts, integrityEvents, isLockdownActive]);

  // Retry a failed autosave (e.g. a dropped connection) every few seconds
  useEffect(() => {
    if (saveState !== 'error') return;
    const timeout = setTimeout(saveProgress, 5000);
    return () => clearTimeout(timeout);
  }, [saveState]);

  // Best-effort save when the tab is closed or reloaded
  const latestProgressRef = useRef<() => AttemptProgress>(buildProgress);
  latestProgressRef.current = buildProgress;
  useEffect(() => {
    const handlePageHide = () => {
      if (finishedRef.current || submittingRef.current) return;
      fetch(`/api/student/attempts/${encodeURIComponent(attempt.id)}`, {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Sifted-Request': '1' },
        body: JSON.stringify(latestProgressRef.current()),
      }).catch(() => {});
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [attempt.id]);

  // Integrity monitoring, according to the professor's assessment settings
  useEffect(() => {
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
          ? 'Pasting is disabled during this test. The attempt has been recorded.'
          : 'Copying test content is disabled. The attempt has been recorded.'
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!isLockdownActive) return;
      e.preventDefault();
      showLockdownAlert('The right-click menu is disabled during this test.', 3000);
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
        showLockdownAlert(`The ${e.key} shortcut is disabled during this test.`, 3500);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && isLockdownActive && !finishedRef.current) {
        setTabSwitches((prev) => prev + 1);
        logIntegrityEvent('Exited fullscreen lockdown.');
        showLockdownAlert('You left full-screen mode. This is recorded in the integrity report your professor sees.');
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
  }, [isLockdownActive, integrityOptions.tabSwitchDetection, integrityOptions.copyPasteDetection]);

  const handleAnswerChange = (val: any) => {
    if (!currentQuestion) return;
    setResponses((prev) => ({ ...prev, [currentQuestion.id]: val }));
  };

  const handleRunTestCases = () => {
    if (!currentQuestion) return;
    const visibleCases = currentQuestion.testCases || [];
    const summary = visibleCases.length
      ? visibleCases.map((tc, i) => `Test ${i + 1}: input ${tc.input} → expected ${tc.expectedOutput}`).join('\n')
      : 'No sample test cases were provided for this question.';
    setTestCaseResults({
      ...testCaseResults,
      [currentQuestion.id]: `Code is not executed in the browser. Your solution is saved and will be reviewed against the professor's test cases after submission.\n${summary}`,
    });
  };

  // Tab indents inside the code editor. So keyboard users are never trapped there, Escape followed by
  // Tab (or Shift+Tab at any time) moves focus on as usual.
  const releaseTabRef = useRef(false);
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      releaseTabRef.current = true;
      return;
    }
    if (e.key !== 'Tab' || e.shiftKey || releaseTabRef.current) {
      releaseTabRef.current = false;
      return;
    }
    e.preventDefault();
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const indent = '    ';
    handleAnswerChange(value.slice(0, selectionStart) + indent + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + indent.length;
    });
  };

  const handleSubmitAssessment = async (isAutoSubmit = false) => {
    if (submittingRef.current || finishedRef.current) return;
    if (!isAutoSubmit) {
      const unanswered = examQuestions.filter((q) => !isQuestionAnswered(q.id)).length;
      if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit your assessment anyway?`)) {
        return;
      }
    }
    submittingRef.current = true;
    setIsGrading(true);
    try {
      const { submission } = await api.student.submitAttempt(attempt.id, { ...buildProgress(), auto: isAutoSubmit });
      finishedRef.current = true;
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      onSubmitted(submission);
    } catch (e) {
      submittingRef.current = false;
      setIsGrading(false);
      if (!handleServerRejection(e)) {
        notify(`Your test could not be submitted: ${errorMessage(e)}. Your answers are still here; please try again.`, 'error');
      }
    }
  };

  // Auto-submit once the time limit (plus any late-submission grace period) runs out
  useEffect(() => {
    if (elapsedSeconds >= timeLimitSeconds + graceSeconds) handleSubmitAssessment(true);
  }, [elapsedSeconds, timeLimitSeconds, graceSeconds]);

  if (!currentQuestion) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-sm text-slate-600">
        This assessment has no questions. Please contact your professor.
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in pb-12">
      {/* Test status: mode, autosave and integrity events */}
      <div className="bg-white text-slate-800 px-5 py-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center space-x-3">
          <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded font-bold border ${
            isLockdownActive 
              ? 'bg-brand-50 text-brand-800 border-brand-200 shadow-xs' 
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            <span aria-hidden className={`w-2 h-2 rounded-full inline-block mr-1 ${isLockdownActive ? 'bg-brand-700' : 'bg-slate-400'}`} />
            {isLockdownActive ? 'Full-screen test mode' : 'Integrity monitoring on'}
          </span>
          <span className="text-slate-600 hidden lg:inline">
            Reference <span className="font-mono text-slate-800">{assessment.id.slice(0, 8).toUpperCase()}</span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span
            className={`px-2 py-0.5 rounded font-bold text-xs border ${
              saveState === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-600'
                : saveState === 'saved'
                ? 'bg-brand-50 text-brand-800 border-brand-200'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
            role="status"
            title="Your answers are saved to the server automatically"
          >
            {saveState === 'error' ? 'Not saved, retrying' : saveState === 'saved' ? 'Answers saved' : 'Saving…'}
          </span>
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 text-xs">Integrity events:</span>
            <span className={`px-2 py-0.5 rounded font-bold text-xs ${
              tabSwitches + copyPasteAttempts > 0 
                ? 'bg-rose-50 text-rose-800 border border-rose-600' 
                : 'bg-brand-50 text-brand-800 border border-brand-200'
            }`}>
              {tabSwitches + copyPasteAttempts === 0 ? 'None' : tabSwitches + copyPasteAttempts}
            </span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="bg-slate-100 hover:bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300 flex items-center space-x-1 font-sans font-semibold text-xs transition-colors"
            title="Enter or leave full-screen mode"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-brand-800" /> : <Maximize2 className="w-3.5 h-3.5 text-brand-800" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
          {isLockdownActive && !integrityOptions.fullScreenMode && (
            <button
              onClick={() => {
                if (window.confirm('Leave full-screen mode? You can keep working, but leaving is recorded in the integrity report your professor sees.')) {
                  setIsLockdownActive(false);
                  setTabSwitches((prev) => prev + 1);
                  logIntegrityEvent('Candidate exited lockdown mode manually.');
                  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
                }
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold transition-colors"
            >
              Leave full-screen mode
            </button>
          )}
        </div>
      </div>

      {isLockdownActive && !isFullscreen && (
        <div role="alert" className="bg-amber-50 text-amber-950 p-3.5 rounded-lg flex items-center justify-between text-sm border border-amber-300">
          <div className="flex items-center space-x-2.5">
            <Monitor className="w-5 h-5 shrink-0 text-amber-700" aria-hidden />
            <span>This test runs in full-screen mode. Please return to full screen to continue.</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="bg-amber-900 text-white px-3 py-1.5 rounded font-semibold hover:bg-amber-950 transition-colors shrink-0"
          >
            Enter Fullscreen
          </button>
        </div>
      )}

      {isInGracePeriod && (
        <div className="bg-amber-600 text-white p-3.5 rounded-lg shadow-md flex items-center justify-between text-xs font-bold border border-amber-400">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 shrink-0" />
            <span>Time is up — you're in the late-submission grace period. Your answers will be submitted automatically in {formatTime(graceLeftSeconds)}.</span>
          </div>
        </div>
      )}

      {/* Integrity messages */}
      {showCheatWarning && (
        <div role="alert" className="bg-amber-50 text-amber-950 p-3.5 rounded-lg flex items-center justify-between text-sm border border-amber-300">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" aria-hidden />
            <span>You left the test window. This is recorded in the integrity report your professor sees.</span>
          </div>
          <span className="rounded bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">Event {tabSwitches}</span>
        </div>
      )}

      {lockdownAlert && (
        <div role="alert" className="bg-amber-50 text-amber-950 p-3.5 rounded-lg flex items-center text-sm border border-amber-300">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-700" aria-hidden />
            <span>{lockdownAlert}</span>
          </div>
        </div>
      )}

      {/* 1. Test header: section, timer and tools */}
      <div className="bg-white text-slate-900 px-6 py-3.5 rounded-t-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="font-semibold tracking-tight text-sm text-slate-900">
            Section 1: {assessment.title || 'Technical & Algorithmic Screening'}
          </span>
          <span className="hidden md:inline-block text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300 font-medium">
            Directions: Answer each prompt. Use scratchpad & calculator as needed.
          </span>
        </div>

        {/* Timer Box */}
        <div className="flex items-center space-x-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-300">
          <Clock className={`w-4 h-4 ${timeLeftSeconds < 300 && !isTimerHidden ? 'text-rose-800' : 'text-slate-700'}`} />
          <span className={`font-mono font-bold text-xs ${timeLeftSeconds < 300 && !isTimerHidden ? 'text-rose-800' : 'text-slate-900'}`}>
            {isTimerHidden ? 'Timer Hidden' : isInGracePeriod ? `Grace ${formatTime(graceLeftSeconds)}` : formatTime(timeLeftSeconds)}
          </span>
          <button
            onClick={() => setIsTimerHidden(!isTimerHidden)}
            className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none flex items-center space-x-1 pl-2 border-l border-slate-300 text-xs font-medium"
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
              showCalculator ? 'bg-brand-600 text-white border-brand-500' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Calculator & Scratchpad</span>
          </button>
          <button
            onClick={() => { setShowReferenceSheet(!showReferenceSheet); setShowCalculator(false); }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-colors border ${
              showReferenceSheet ? 'bg-brand-600 text-white border-brand-500' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Reference</span>
          </button>
        </div>
      </div>

      {/* 2. ON-SCREEN CALCULATOR & SCRATCHPAD DRAWER */}
      {showCalculator && (
        <div className="bg-white border border-slate-300 p-6 rounded-lg text-slate-900 shadow-md fade-in grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <button
            onClick={() => setShowCalculator(false)}
            className="absolute top-4 right-4 text-slate-600 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scientific / Basic Calculator */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <Calculator className="w-4 h-4 text-brand-800" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Calculator</h3>
            </div>
            <div className="bg-paper p-3 rounded border border-slate-200 text-right font-mono space-y-1">
              <div className="text-xs text-slate-600 min-h-[16px]">{calcInput || '0'}</div>
              <div className="text-xl font-bold text-brand-800 overflow-x-auto min-h-[28px]">{calcResult || calcInput || '0'}</div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-xs font-mono font-bold">
              {['C', 'CE', '(', ')', '√', '7', '8', '9', '/', 'x²', '4', '5', '6', '*', '%', '1', '2', '3', '-', '.', '0', '00', '+', '='].map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCalcButton(btn)}
                  className={`py-2.5 rounded transition-all active:scale-95 border ${
                    btn === '=' ? 'bg-brand-600 hover:bg-brand-500 text-white border-brand-500 col-span-2' :
                    ['C', 'CE'].includes(btn) ? 'bg-rose-50 hover:bg-rose-800 text-rose-800 border-rose-800' :
                    ['/', '*', '-', '+', '√', 'x²', '%'].includes(btn) ? 'bg-slate-100 hover:bg-slate-100 text-brand-700 border-slate-300' :
                    'bg-slate-100 hover:bg-slate-100 text-slate-900 border-slate-300'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>

          {/* Digital Scratchpad */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-amber-800" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Digital Scratchpad & Notes</h3>
              </div>
              <button
                onClick={() => setScratchpadText('')}
                className="text-xs text-slate-600 hover:text-rose-800 underline font-medium"
              >
                Clear Notes
              </button>
            </div>
            <p className="text-xs text-slate-600">Jot down intermediate algebraic steps, complexity bounds, or pseudo-code.</p>
            <textarea aria-label="Scratchpad"
              rows={8}
              value={scratchpadText}
              onChange={(e) => setScratchpadText(e.target.value)}
              placeholder="Type your scratchpad calculations here... (persist during session)"
              className="w-full flex-1 p-3 bg-paper border border-slate-200 rounded font-mono text-xs text-amber-800 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 leading-relaxed resize-none"
            />
          </div>
        </div>
      )}

      {/* 3. Reference sheet */}
      {showReferenceSheet && (
        <div className="bg-white border border-slate-300 p-6 rounded-lg text-slate-900 shadow-md fade-in space-y-4 relative">
          <button
            onClick={() => setShowReferenceSheet(false)}
            className="absolute top-4 right-4 text-slate-600 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <BookOpen className="w-5 h-5 text-brand-800" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-800">Reference sheet</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-paper p-4 rounded border border-slate-200 space-y-2 font-mono">
              <div className="text-brand-800 font-bold uppercase text-xs border-b border-slate-200 pb-1">Linear Algebra & SVD</div>
              <div className="text-slate-700">A = U Σ Vᵀ</div>
              <div className="text-slate-600 text-xs">UᵀU = I, VᵀV = I</div>
              <div className="text-slate-700 pt-1">Ridge Regression (L2):</div>
              <div className="text-amber-800">w = (XᵀX + λI)⁻¹ Xᵀy</div>
            </div>
            <div className="bg-paper p-4 rounded border border-slate-200 space-y-2 font-mono">
              <div className="text-brand-800 font-bold uppercase text-xs border-b border-slate-200 pb-1">Asymptotic Big-O Complexity</div>
              <div className="text-slate-700">Merge Sort: O(N log N)</div>
              <div className="text-slate-700">Quick Sort (Avg): O(N log N)</div>
              <div className="text-slate-700">Matrix Mult (Naive): O(N³)</div>
              <div className="text-amber-800">Attention (Self): O(N² • d)</div>
            </div>
            <div className="bg-paper p-4 rounded border border-slate-200 space-y-2 font-mono">
              <div className="text-brand-800 font-bold uppercase text-xs border-b border-slate-200 pb-1">Probability & ML Bounds</div>
              <div className="text-slate-700">Bayes' Rule:</div>
              <div className="text-amber-800">P(A|B) = [P(B|A)P(A)] / P(B)</div>
              <div className="text-slate-700 pt-1">Softmax: σ(z)ᵢ = e^(zᵢ) / Σ e^(zⱼ)</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Review screen, or a single question */}
      {showSatReviewScreen ? (
        <div className="bg-white p-6 md:p-8 rounded-b-lg border border-slate-200 shadow-sm space-y-6 fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-6 h-6 text-brand-600" />
                <h2 ref={reviewHeadingRef} tabIndex={-1} className="text-xl font-semibold text-slate-900 tracking-tight outline-none">Check your work</h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Before you submit, you can return to any question you marked for review or left unanswered.
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
                className="px-6 py-2 rounded-md font-bold text-xs bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white shadow-sm transition-colors flex items-center space-x-2"
              >
                {isGrading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting…</span>
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
              className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'all' ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              <span className="text-xs font-bold text-slate-600 uppercase block">Total Questions</span>
              <span className="text-2xl font-semibold text-slate-900">{examQuestions.length}</span>
            </div>
            <div 
              onClick={() => setReviewFilter('all')}
              className="p-4 rounded-lg border bg-brand-50/50 border-brand-200 cursor-pointer"
            >
              <span className="text-xs font-bold text-brand-700 uppercase block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Answered
              </span>
              <span className="text-2xl font-semibold text-brand-700">
                {examQuestions.filter(q => isQuestionAnswered(q.id)).length}
              </span>
            </div>
            <div 
              onClick={() => setReviewFilter('unanswered')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'unanswered' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200' : 'bg-amber-50/40 border-amber-200 hover:bg-amber-100/50'}`}
            >
              <span className="text-xs font-bold text-amber-800 uppercase block flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Unanswered
              </span>
              <span className="text-2xl font-semibold text-amber-800">
                {examQuestions.filter(q => !isQuestionAnswered(q.id)).length}
              </span>
            </div>
            <div 
              onClick={() => setReviewFilter('flagged')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${reviewFilter === 'flagged' ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200' : 'bg-rose-50/40 border-rose-200 hover:bg-rose-100/50'}`}
            >
              <span className="text-xs font-bold text-rose-800 uppercase block flex items-center gap-1">
                <Flag className="w-3.5 h-3.5 fill-current" /> Marked for Review
              </span>
              <span className="text-2xl font-semibold text-rose-800">
                {Object.values(flaggedQuestions).filter(Boolean).length}
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-600 mr-2">Filter View:</span>
            {(['all', 'unanswered', 'flagged'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setReviewFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${
                  reviewFilter === filter
                    ? 'bg-brand-700 text-white'
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
                    {...asButton(() => {
                      setCurrentQuestionIndex(idx);
                      setShowSatReviewScreen(false);
                    })}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md flex flex-col justify-between space-y-3 relative ${
                      flagged ? 'border-amber-500 bg-amber-50/30' : answered ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-dashed border-rose-300 bg-rose-50/20'
                    }`}
                  >
                    {flagged && (
                      <div className="absolute top-3 right-3 text-amber-700 flex items-center space-x-1 bg-amber-100 px-2 py-0.5 rounded text-xs font-bold">
                        <Flag className="w-3 h-3 fill-current" />
                        <span>Flagged</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded bg-brand-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-600 truncate">{q.topic}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">{q.title}</h4>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className={`font-bold ${answered ? 'text-brand-700 flex items-center gap-1' : 'text-rose-600 flex items-center gap-1'}`}>
                        {answered ? <><CheckCircle2 className="w-3.5 h-3.5" /> Answered</> : <><AlertCircle className="w-3.5 h-3.5" /> Unanswered</>}
                      </span>
                      <span className="text-brand-600 font-semibold hover:underline">Jump to # {idx + 1} →</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* Single question view */
        <div className="bg-white p-6 md:p-8 rounded-b-lg border border-t-0 border-slate-200 shadow-sm space-y-6">
          {/* Question Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-md bg-brand-700 text-white font-semibold text-sm flex items-center justify-center shadow-xs">
                {currentQuestionIndex + 1}
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-semibold text-slate-900">{currentQuestion.title}</h2>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    {currentQuestion.difficulty}
                  </span>
                </div>
                <span className="text-xs text-slate-600 font-medium">{currentQuestion.topic} • {currentQuestion.points} Points</span>
              </div>
            </div>

            {/* Right Action Ribbon: Eliminator & Flag */}
            <div className="flex items-center space-x-2">
              {currentQuestion.type === 'multiple-choice' && (
                <button
                  onClick={() => setIsEliminatorActive(!isEliminatorActive)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-all border ${
                    isEliminatorActive
                      ? 'bg-brand-600 text-white border-brand-700 shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                  title="Cross out options you have ruled out"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{isEliminatorActive ? 'Eliminator On' : 'Eliminate Choices'}</span>
                </button>
              )}

              <button
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-all border ${
                  flaggedQuestions[currentQuestion.id]
                    ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-sm'
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
              <blockquote className="bg-white p-3 rounded-md border-l-4 border-brand-400 text-xs text-slate-700 italic whitespace-pre-wrap">
                {currentQuestion.paperExcerpt}
              </blockquote>
            )}
            {currentQuestion.chartData && currentQuestion.chartData.length > 0 && currentQuestion.chartType !== 'none' && (
              <Suspense fallback={<div className="h-64 w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Loading chart…</div>}>
                <QuestionChart chartType={currentQuestion.chartType} data={currentQuestion.chartData} />
              </Suspense>
            )}

            {/* If Math LaTeX */}
            {currentQuestion.latexFormula && (
              <div className="bg-slate-50 text-slate-900 font-mono p-4 rounded-md border border-slate-200 overflow-x-auto text-sm my-3">
                <span className="text-slate-600 block text-xs uppercase tracking-wider mb-1">Mathematical Formula / Expression:</span>
                {currentQuestion.latexFormula}
              </div>
            )}
          </div>

          {/* Multiple choice, with optional cross-out of ruled-out options */}
          {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
            <fieldset className="space-y-3 pt-2">
              <legend className="sr-only">Answer options</legend>
              {currentQuestion.options.map((opt, i) => {
                const isSelected = responses[currentQuestion.id] === opt;
                const isEliminated = (eliminatedOptions[currentQuestion.id] || []).includes(opt);
                const letter = String.fromCharCode(65 + i);

                return (
                  <div key={i} className="flex items-stretch gap-2">
                    <label
                      onClick={(e) => {
                        // In cross-out mode a click rules the option out instead of choosing it
                        if (isEliminatorActive) {
                          e.preventDefault();
                          toggleEliminateOption(currentQuestion.id, opt);
                        }
                      }}
                      className={`flex flex-1 cursor-pointer items-center gap-3.5 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 has-[:focus-visible]:ring-offset-2 ${
                        isEliminated
                          ? 'border-slate-200 bg-slate-50 text-slate-600'
                          : isSelected
                            ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                            : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={opt}
                        checked={isSelected}
                        disabled={isEliminated && !isEliminatorActive}
                        onChange={() => {
                          if (!isEliminated) handleAnswerChange(opt);
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                          isEliminated ? 'border-slate-300 bg-slate-100 text-slate-600' : isSelected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-400 text-slate-600'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className={`text-sm font-medium ${isEliminated ? 'line-through' : 'text-slate-900'}`}>
                        <span className="sr-only">Option {letter}: </span>
                        {opt}
                        {isEliminated && <span className="sr-only"> (crossed out)</span>}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleEliminateOption(currentQuestion.id, opt)}
                      aria-pressed={isEliminated}
                      aria-label={isEliminated ? `Restore option ${letter}` : `Cross out option ${letter}`}
                      className={`shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                        isEliminated ? 'border-slate-400 bg-slate-200 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {isEliminated ? 'Restore' : 'Cross out'}
                    </button>
                  </div>
                );
              })}
            </fieldset>
          )}

          {/* If Short Answer or Essay */}
          {(currentQuestion.type === 'short-answer' || currentQuestion.type === 'long-form-essay' || currentQuestion.type === 'math' || currentQuestion.type === 'research') && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Your Written Response / Derivation:</span>
                <span className="text-xs font-normal text-slate-600">Math expressions & detailed steps accepted</span>
              </label>
              <textarea aria-label="Your answer"
                rows={currentQuestion.type === 'long-form-essay' ? 8 : 4}
                value={responses[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Type your rigorous answer or mathematical steps here..."
                className="w-full p-4 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-normal leading-relaxed shadow-sm"
              />
            </div>
          )}

          {/* If Programming */}
          {currentQuestion.type === 'programming' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center">
                  <Code className="w-4 h-4 mr-1.5 text-brand-600" />
                  Interactive Code Editor ({currentQuestion.language || 'Python'})
                </span>
                <button
                  onClick={handleRunTestCases}
                  className="bg-brand-700 hover:bg-brand-800 text-white px-4 py-1.5 rounded-md text-xs font-medium shadow-sm flex items-center space-x-1.5 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>View Sample Test Cases</span>
                </button>
              </div>

              <p id="code-keys-hint" className="text-xs text-slate-600">
                Tab inserts spaces. To move to the next control, press Esc and then Tab.
              </p>
              <textarea aria-label="Your code"
                aria-describedby="code-keys-hint"
                rows={10}
                spellCheck={false}
                value={responses[currentQuestion.id] ?? currentQuestion.codeTemplate ?? ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                onKeyDown={handleCodeKeyDown}
                className="w-full p-4 bg-slate-50 text-slate-900 font-mono rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 leading-relaxed"
              />

              {/* Test Case Output */}
              {testCaseResults[currentQuestion.id] && (
                <div className="bg-brand-50/80 border border-brand-300 p-4 rounded-md text-brand-900 text-xs font-mono fade-in shadow-sm whitespace-pre-wrap">
                  <span className="font-bold uppercase tracking-wider block mb-1">Test Cases:</span>
                  {testCaseResults[currentQuestion.id]}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Question menu and navigation */}
      <div className="bg-white text-slate-900 px-6 py-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4 mt-6 relative">
        {/* Left: Applicant Name & Question Menu Toggle */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 border-r border-slate-300 pr-4">
            <User className="w-4 h-4 text-brand-800" />
            <span className="text-xs font-bold text-slate-800">{applicantName || 'Applicant'}</span>
          </div>
          <button
            onClick={() => setShowQuestionMenu(!showQuestionMenu)}
            className="bg-white hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2 rounded-md border border-slate-300 flex items-center space-x-2 text-xs shadow-sm transition-colors"
          >
            <Grid className="w-3.5 h-3.5 text-brand-800" />
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
            className="px-4 py-2 rounded-md font-bold text-xs bg-slate-100 text-slate-800 hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center space-x-1 border border-slate-300 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {!showSatReviewScreen && currentQuestionIndex < examQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
              className="px-5 py-2 rounded-md font-bold text-xs bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors flex items-center space-x-1"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : !showSatReviewScreen ? (
            <button
              onClick={() => setShowSatReviewScreen(true)}
              className="px-5 py-2 rounded-md font-bold text-xs bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <List className="w-3.5 h-3.5" />
              <span>Check Your Work</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmitAssessment()}
              disabled={isGrading}
              className="px-6 py-2 rounded-md font-bold text-xs bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white shadow-sm transition-colors flex items-center space-x-1.5"
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

        {/* Question overview popover */}
        {showQuestionMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-3 bg-white border border-slate-300 p-6 rounded-lg shadow-md fade-in z-50 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Grid className="w-4 h-4 text-brand-800" />
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Section 1: Question Menu & Navigation</h3>
              </div>
              <button
                onClick={() => setShowQuestionMenu(false)}
                className="text-slate-600 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 pb-4 mb-4 border-b border-slate-200 font-medium">
              <span className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-brand-600 rounded-sm" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2 border-slate-500 rounded-sm" /> Unanswered
              </span>
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-amber-700 fill-current" /> Marked for Review
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2 border-brand-400 ring-2 ring-brand-200 rounded-sm" /> Current
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
                        ? 'border-brand-400 ring-2 ring-brand-200 bg-brand-50 text-slate-900 shadow-md scale-105'
                        : answered
                        ? 'bg-brand-600 text-white border-brand-500 hover:bg-brand-500'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {flagged && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-900 rounded-full p-0.5 shadow-sm" title="Marked for Review">
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
                className="bg-slate-100 hover:bg-slate-100 text-brand-700 font-bold px-4 py-2 rounded border border-slate-300 text-xs flex items-center space-x-1.5"
              >
                <List className="w-3.5 h-3.5" />
                <span>Go to Section Summary (Check Your Work) →</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
