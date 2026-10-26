import React, { useState } from 'react';
import { notify } from '../notify';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Check, 
  Search, 
  Database, 
  ArrowUp, 
  ArrowDown, 
  HelpCircle,
  Cpu,
  Sliders,
  Eye,
  AlertCircle,
  Send,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../api';
import { Assessment, Question, QuestionType, DifficultyLevel, ProfessorProfile, IntegrityOptions } from '../types';

const DEFAULT_INTEGRITY_OPTIONS: IntegrityOptions = {
  fullScreenMode: true,
  tabSwitchDetection: true,
  webcamMonitoring: false,
  copyPasteDetection: true,
  aiAnswerDetection: true,
  randomizeQuestionOrder: true,
  randomizeAnswerOrder: true,
};

interface AssessmentBuilderProps {
  currentProfessor: ProfessorProfile;
  assessments: Assessment[];
  questionBank: Question[];
  // Both resolve to the copy saved on the server (with its server-assigned id), or null if saving failed
  onSaveAssessment: (assessment: Assessment) => Promise<Assessment | null>;
  onAddQuestionToBank: (question: Question) => Promise<Question | null>;
  showAIGeneratorOnOpen?: boolean;
  onCloseAIGenerator?: () => void;
  onOpenAssignModal?: (assessmentId?: string) => void;
}

export const AssessmentBuilder: React.FC<AssessmentBuilderProps> = ({
  currentProfessor,
  assessments,
  questionBank,
  onSaveAssessment,
  onAddQuestionToBank,
  showAIGeneratorOnOpen = false,
  onCloseAIGenerator,
  onOpenAssignModal,
}) => {
  const profAssessments = assessments.filter((a) => !a.professorId || a.professorId === currentProfessor.id);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string>(profAssessments[0]?.id || 'new');

  // Active form state
  const activeAssessment = profAssessments.find((a) => a.id === activeAssessmentId);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(activeAssessment?.isActive ?? activeAssessment?.isPublished ?? true);

  const [title, setTitle] = useState(activeAssessment?.title || 'Fall 2026 PhD AI Research Screening');
  const [description, setDescription] = useState(activeAssessment?.description || 'Custom technical screening exam evaluating machine learning theory, algorithms, and research intuition.');
  const [researchGroup, setResearchGroup] = useState(activeAssessment?.researchGroup || currentProfessor.labName);
  const [semester, setSemester] = useState(activeAssessment?.semester || 'Fall 2026 Admissions');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(activeAssessment?.timeLimitMinutes || 60);
  const [isAdaptive, setIsAdaptive] = useState(activeAssessment?.isAdaptive ?? true);
  const [isScoreVisible, setIsScoreVisible] = useState(activeAssessment?.isScoreVisible ?? false);
  const [integrityOptions, setIntegrityOptions] = useState<IntegrityOptions>(activeAssessment?.integrityOptions || DEFAULT_INTEGRITY_OPTIONS);

  const [questionIds, setQuestionIds] = useState<string[]>(activeAssessment?.questionIds || []);

  // UI state for modals
  const [showQuestionBankModal, setShowQuestionBankModal] = useState<boolean>(false);
  const [showAIGeneratorModal, setShowAIGeneratorModal] = useState<boolean>(showAIGeneratorOnOpen);
  const [searchBankQuery, setSearchBankQuery] = useState<string>('');

  // AI Question Generator Form State
  const [aiField, setAiField] = useState('Computer Science & Artificial Intelligence');
  const [aiCourse, setAiCourse] = useState('Graduate Machine Learning & Systems');
  const [aiSpecialization, setAiSpecialization] = useState('Attention Mechanisms & State Space Models');
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyLevel>('Advanced');
  const [aiLearningObjectives, setAiLearningObjectives] = useState('Evaluate understanding of sub-quadratic memory scaling and architectural trade-offs in Transformers.');
  const [aiQuestionType, setAiQuestionType] = useState<QuestionType>('long-form-essay');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<Question | null>(null);
  const [aiIsFallback, setAiIsFallback] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [aiIsPublic, setAiIsPublic] = useState<boolean>(true);

  const currentQuestions = questionIds
    .map((id) => questionBank.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined);

  const totalPoints = currentQuestions.reduce((a, b) => a + b.points, 0);

  const handleSelectAssessment = (id: string) => {
    setActiveAssessmentId(id);
    setCurrentStep(1);
    const found = profAssessments.find((a) => a.id === id);
    if (found) {
      setTitle(found.title);
      setDescription(found.description);
      setResearchGroup(found.researchGroup);
      setSemester(found.semester);
      setTimeLimitMinutes(found.timeLimitMinutes);
      setIsAdaptive(found.isAdaptive);
      setIsScoreVisible(found.isScoreVisible);
      setIntegrityOptions(found.integrityOptions || DEFAULT_INTEGRITY_OPTIONS);
      setQuestionIds(found.questionIds || []);
      setIsPublished(found.isActive ?? found.isPublished ?? true);
    }
  };

  const handleCreateNew = () => {
    setActiveAssessmentId('new');
    setCurrentStep(1);
    setIsPublished(false);
    setTitle('New Graduate Research Screening Exam');
    setDescription('Comprehensive technical evaluation for incoming graduate school applicants.');
    setResearchGroup(currentProfessor.labName);
    setSemester('Spring 2027 Admissions');
    setTimeLimitMinutes(60);
    setIsAdaptive(true);
    setIsScoreVisible(false);
    setIntegrityOptions(DEFAULT_INTEGRITY_OPTIONS);
    setQuestionIds([]);
  };

  // Saves the assessment and returns its id, or null if it isn't valid yet or saving failed
  const handleSave = async (): Promise<string | null> => {
    if (!title.trim()) {
      notify('Please give the assessment a title (step 1).', 'error');
      setCurrentStep(1);
      return null;
    }
    if (currentQuestions.length === 0) {
      notify('Add at least one question before saving the assessment (step 2).', 'error');
      setCurrentStep(2);
      return null;
    }
    const newAssessment: Assessment = {
      id: activeAssessmentId === 'new' ? '' : activeAssessmentId,
      professorId: currentProfessor.id,
      title: title.trim(),
      description,
      researchGroup,
      semester,
      timeLimitMinutes,
      isAdaptive,
      isScoreVisible,
      integrityOptions,
      // Drop ids of questions that no longer exist in the bank
      questionIds: currentQuestions.map((q) => q.id),
      createdAt: activeAssessment?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      isActive: isPublished,
      isPublished,
      status: isPublished ? 'Published' : 'Draft',
    };
    setSaving(true);
    const saved = await onSaveAssessment(newAssessment);
    setSaving(false);
    if (!saved) return null;
    setActiveAssessmentId(saved.id);
    notify(`Assessment "${saved.title}" saved.`);
    return saved.id;
  };

  const handleSaveAndAssign = async () => {
    if (!onOpenAssignModal) return;
    const savedId = await handleSave();
    if (savedId) onOpenAssignModal(savedId);
  };

  const moveQuestion = (idx: number, direction: -1 | 1) => {
    const ids = currentQuestions.map((q) => q.id);
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setQuestionIds(ids);
  };

  const handleGenerateAIQuestion = async () => {
    setAiGenerating(true);
    setAiGeneratedResult(null);
    setAiIsFallback(false);
    try {
      const data = await api.professor.generateQuestion({
        field: aiField,
        course: aiCourse,
        specialization: aiSpecialization,
        desiredDifficulty: aiDifficulty,
        learningObjectives: aiLearningObjectives,
        questionType: aiQuestionType,
      });
      setAiGeneratedResult({ id: '', ...data.question } as Question);
      setAiIsFallback(Boolean(data.isFallback));
    } catch (error) {
      notify(`Could not generate a question: ${errorMessage(error)}`, 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddGeneratedQuestion = async () => {
    if (!aiGeneratedResult) return;
    const saved = await onAddQuestionToBank({ ...aiGeneratedResult, isPublic: aiIsPublic });
    if (!saved) return;
    setQuestionIds((prev) => (prev.includes(saved.id) ? prev : [...prev, saved.id]));
    setShowAIGeneratorModal(false);
    if (onCloseAIGenerator) onCloseAIGenerator();
    setAiGeneratedResult(null);
  };


  return (
    <div className="space-y-8 pb-16">
      {/* Top Controls & Switcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center font-bold shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assessment Builder & Configuration</h2>
            <p className="text-xs text-slate-600">Design customized screening tests for your graduate research group</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Assessment to edit"
            value={activeAssessmentId}
            onChange={(e) => handleSelectAssessment(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {profAssessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.semester})
              </option>
            ))}
            <option value="new">+ Create New Screening Assessment</option>
          </select>

          <button
            onClick={handleCreateNew}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-md text-xs font-medium border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Exam</span>
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Assessment</span>
          </button>

          {onOpenAssignModal && (
            <button
              onClick={() => (activeAssessmentId === 'new' ? handleSaveAndAssign() : onOpenAssignModal(activeAssessmentId))}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Assign to Candidates</span>
            </button>
          )}
        </div>
      </div>

      {/* 6-Step Workflow Navigation Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
        {[
          { step: 1, label: '1. Details', icon: FileText },
          { step: 2, label: '2. Questions', icon: Database },
          { step: 3, label: '3. Scoring & Time', icon: Sliders },
          { step: 4, label: '4. Review', icon: Eye },
          { step: 5, label: '5. Publish', icon: Check },
          { step: 6, label: '6. Assign', icon: Send },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = currentStep === s.step;
          return (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Assessment Details */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Step 1: Assessment Details & Scope</h3>
              <p className="text-xs text-slate-600">Define general metadata and applicant instructions</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-brand-50 text-brand-700 border border-brand-100">Step 1 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Assessment Title</label>
              <input aria-label="Assessment Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. Fall 2026 PhD AI Research Fellowship Screening"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Description & Applicant Instructions</label>
              <textarea aria-label="Description & Applicant Instructions"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Research Group / Lab</label>
              <input aria-label="Research Group / Lab"
                type="text"
                value={researchGroup}
                onChange={(e) => setResearchGroup(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Semester / Admissions Cycle</label>
              <input aria-label="Semester / Admissions Cycle"
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-xs font-bold shadow-sm transition-colors"
            >
              Next: Add Questions →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Add Questions */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Step 2: Screening Question Pool</h3>
              <p className="text-xs text-slate-600">
                {currentQuestions.length} questions included ({totalPoints} total points). Supported: MC, Short Answer, Essay, Math (LaTeX), Code, Research.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowQuestionBankModal(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-md text-xs font-medium border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-sm"
              >
                <Database className="w-3.5 h-3.5 text-brand-600" />
                <span>Add from Bank</span>
              </button>
              <button
                onClick={() => setShowAIGeneratorModal(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-800" />
                <span>AI Generate Question</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {currentQuestions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-slate-600 shadow-sm">
                <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-medium">No questions currently in this assessment.</p>
                <p className="text-xs mt-1">Click "Add from Bank" or "AI Generate Question" above to begin.</p>
              </div>
            ) : (
              currentQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-md border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-brand-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-md bg-brand-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{q.title}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-100 text-brand-800 uppercase tracking-wider">
                          {q.type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                          {q.difficulty}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                          {q.points} pts
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 max-w-2xl font-normal">{q.prompt}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => moveQuestion(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-md text-slate-600 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveQuestion(idx, 1)}
                      disabled={idx === currentQuestions.length - 1}
                      className="p-1.5 rounded-md text-slate-600 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setQuestionIds(questionIds.filter((id) => id !== q.id))}
                      className="p-1.5 rounded-md text-red-800 hover:text-red-700 hover:bg-red-50"
                      title="Remove Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-xs font-bold border border-slate-300 transition-colors"
            >
              ← Back: Details
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-xs font-bold shadow-sm transition-colors"
            >
              Next: Scoring & Time →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Scoring & Administration Parameters */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Sliders className="w-5 h-5 text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Scoring & Administration Parameters</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200 shadow-sm">
                <div>
                  <span className="text-xs font-bold text-slate-800">Progressive Adaptive Difficulty</span>
                  <span className="block text-xs text-slate-600">Auto-balance Basic → Research tiers</span>
                </div>
                <input
                  type="checkbox"
                  checked={isAdaptive}
                  onChange={(e) => setIsAdaptive(e.target.checked)}
                  className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200 shadow-sm">
                <div>
                  <span className="text-xs font-bold text-slate-800">Applicant Score Visibility</span>
                  <span className="block text-xs text-slate-600">Show score upon completion</span>
                </div>
                <input
                  type="checkbox"
                  checked={isScoreVisible}
                  onChange={(e) => setIsScoreVisible(e.target.checked)}
                  className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Time Limit (Minutes)</span>
                  <span className="text-brand-600 font-bold text-sm">{timeLimitMinutes} min</span>
                </label>
                <input aria-label="Time limit in minutes"
                  type="range"
                  min={15}
                  max={180}
                  step={15}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-semibold text-slate-900">Integrity settings</h3>
            </div>

            <p className="text-xs text-slate-600">
              Configure automated integrity monitors. Gemini analyzes written and coded answers for synthetic LLM generation signatures.
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {[
                { key: 'fullScreenMode', label: 'Full-Screen Assessment Mode', desc: 'Enforce full screen before start' },
                { key: 'tabSwitchDetection', label: 'Tab Switching & Focus Loss Log', desc: 'Log when applicant switches tabs' },
                { key: 'copyPasteDetection', label: 'Bulk Copy/Paste Detection', desc: 'Flag abnormal clipboard inserts' },
                { key: 'aiAnswerDetection', label: 'Estimate AI-written answers', desc: 'When AI is configured, Gemini estimates how likely written answers are AI-generated. Advisory only, not evidence.' },
                { key: 'randomizeQuestionOrder', label: 'Randomize Question Order', desc: 'Unique question sequence per candidate' },
                { key: 'randomizeAnswerOrder', label: 'Randomize MC Answer Order', desc: 'Prevent option memorization' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 cursor-pointer transition-colors shadow-sm"
                >
                  <div className="pr-2">
                    <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                    <span className="text-xs text-slate-600 block">{item.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={(integrityOptions as any)[item.key]}
                    onChange={(e) =>
                      setIntegrityOptions({
                        ...integrityOptions,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-xs font-bold border border-slate-300 transition-colors"
            >
              ← Back: Questions
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-xs font-bold shadow-sm transition-colors"
            >
              Next: Review Summary →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review Assessment Summary */}
      {currentStep === 4 && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Step 4: Review Assessment Summary</h3>
              <p className="text-xs text-slate-600">Verify all configuration parameters before publishing</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Step 4 of 6</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase block">Total Questions</span>
              <span className="text-xl font-semibold text-slate-900">{currentQuestions.length}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase block">Total Points</span>
              <span className="text-xl font-semibold text-brand-600">{totalPoints} pts</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase block">Time Limit</span>
              <span className="text-xl font-semibold text-slate-900">{timeLimitMinutes} minutes</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <p><strong className="text-slate-900">Title:</strong> {title}</p>
            <p><strong className="text-slate-900">Description:</strong> {description}</p>
            <p><strong className="text-slate-900">Research Group / Semester:</strong> {researchGroup} ({semester})</p>
            <p><strong className="text-slate-900">Adaptive Difficulty:</strong> {isAdaptive ? 'Enabled (Auto-scales questions)' : 'Disabled'}</p>
            <p><strong className="text-slate-900">Score Visibility:</strong> {isScoreVisible ? 'Visible to candidate immediately' : 'Hidden from candidate'}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Included Questions Preview</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50">
              {currentQuestions.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-900">{i + 1}. {q.title}</span>
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded text-xs bg-brand-100 text-brand-800 uppercase font-semibold">{q.type}</span>
                    <span className="font-bold text-slate-600">{q.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(3)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-xs font-bold border border-slate-300 transition-colors"
            >
              ← Back: Scoring & Time
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-xs font-bold shadow-sm transition-colors"
            >
              Next: Publish Toggle →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Publish/Unpublish Toggle */}
      {currentStep === 5 && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
            <Check className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Step 5: Assessment Publication Status</h3>
            <p className="text-xs text-slate-600 mt-1">
              Toggle whether this screening exam is actively published and available for applicant assignments.
            </p>
          </div>

          <div className={`p-6 rounded-lg border-2 transition-all ${
            isPublished
              ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
              : 'bg-amber-50 border-amber-500 text-amber-900'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider block mb-1">Current Status</span>
            <span className="text-2xl font-semibold block">
              {isPublished ? 'PUBLISHED & ACTIVE' : 'DRAFT (UNPUBLISHED)'}
            </span>
            <p className="text-xs mt-2 opacity-80 max-w-md mx-auto">
              {isPublished
                ? 'Applicants assigned to this exam can access it immediately from their portal.'
                : 'This assessment is currently hidden. Applicants cannot start or view this exam until published.'}
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setIsPublished(!isPublished)}
              className={`px-6 py-2.5 rounded-md font-bold text-xs shadow-sm transition-all flex items-center space-x-2 ${
                isPublished
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <span>{isPublished ? 'Switch to Draft (Unpublish)' : 'Publish Assessment Now'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-xs font-bold border border-slate-300 transition-colors"
            >
              ← Back: Review Summary
            </button>
            <button
              onClick={() => setCurrentStep(6)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-xs font-bold shadow-sm transition-colors"
            >
              Next: Assign Applicants →
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Assign Applicants */}
      {currentStep === 6 && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
            <Send className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Step 6: Assign to Graduate Candidates</h3>
            <p className="text-xs text-slate-600 mt-1">
              Send invitations directly to candidate email addresses to begin screening.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-left space-y-3 text-xs text-slate-700">
            <p>
              By clicking the button below, you can select candidates from your verified applicant pool or enter custom university email addresses to send secure test links.
            </p>
            <p className="font-semibold text-brand-700">
              Note: Remember to click "Finish & Save Assessment" below to persist all your changes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {onOpenAssignModal && (
              <button
                onClick={handleSaveAndAssign}
                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-md text-xs font-bold shadow-sm transition-colors flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Save & Open Assign Applicants Dialog</span>
              </button>
            )}

            <button
              onClick={() => handleSave()}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-md text-xs font-bold shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Finish & Save Assessment</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-start">
            <button
              onClick={() => setCurrentStep(5)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-xs font-bold border border-slate-300 transition-colors"
            >
              ← Back: Publish Status
            </button>
          </div>
        </div>
      )}

      {/* QUESTION BANK MODAL */}
      {showQuestionBankModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-md border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Question Bank Pool</h3>
                <p className="text-xs text-slate-600">Select questions to include in "{title}"</p>
              </div>
              <button
                onClick={() => setShowQuestionBankModal(false)}
                className="rounded-md p-1 text-slate-600 hover:text-slate-700  px-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                <input aria-label="Search questions"
                  type="text"
                  placeholder="Search questions by keyword or topic..."
                  value={searchBankQuery}
                  onChange={(e) => setSearchBankQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {questionBank
                .filter((q) => q.isPublic !== false || q.professorId === currentProfessor.id)
                .filter((q) => q.title.toLowerCase().includes(searchBankQuery.toLowerCase()) || q.topic.toLowerCase().includes(searchBankQuery.toLowerCase()))
                .map((q) => {
                  const isAlreadyAdded = questionIds.includes(q.id);
                  const isPublic = q.isPublic !== false;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-md border transition-all flex items-center justify-between shadow-sm ${
                        isAlreadyAdded ? 'bg-brand-50/50 border-brand-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{q.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isPublic
                                ? 'bg-brand-100 text-brand-800 border border-brand-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {isPublic ? 'Public' : 'Private'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">{q.type}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-100 text-brand-800 uppercase tracking-wider">{q.difficulty}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 max-w-xl">{q.prompt}</p>
                      </div>

                      <button
                        onClick={() => {
                          if (isAlreadyAdded) {
                            setQuestionIds(questionIds.filter((id) => id !== q.id));
                          } else {
                            setQuestionIds([...questionIds, q.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                          isAlreadyAdded
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                        }`}
                      >
                        {isAlreadyAdded ? 'Remove' : '+ Add Question'}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowQuestionBankModal(false)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-md text-xs font-medium shadow-sm"
              >
                Done ({currentQuestions.length} questions selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI QUESTION GENERATOR MODAL */}
      {showAIGeneratorModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-md border border-brand-200">
            <div className="p-6 border-b border-slate-200 text-slate-900 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-6 h-6 text-brand-800 animate-spin" style={{ animationDuration: '6s' }} />
                <div>
                  <h3 className="text-lg font-semibold">Generate a question with AI</h3>
                  <p className="text-sm text-slate-600">Drafts a question with an answer and rubric for you to review and edit.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAIGeneratorModal(false);
                  if (onCloseAIGenerator) onCloseAIGenerator();
                }}
                className="rounded-md p-1 text-slate-600 hover:text-slate-900  px-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Form Input Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Research Field / Department</label>
                  <input aria-label="Research Field / Department"
                    type="text"
                    value={aiField}
                    onChange={(e) => setAiField(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Course / Discipline</label>
                  <input aria-label="Course / Discipline"
                    type="text"
                    value={aiCourse}
                    onChange={(e) => setAiCourse(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Specialization or Topic Focus</label>
                  <input aria-label="Specialization or Topic Focus"
                    type="text"
                    value={aiSpecialization}
                    onChange={(e) => setAiSpecialization(e.target.value)}
                    placeholder="e.g. Transformers, Spectral Graph Theory, Bayesian Nonparametrics..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Question Type</label>
                  <select aria-label="Question Type"
                    value={aiQuestionType}
                    onChange={(e) => setAiQuestionType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="short-answer">Short Answer</option>
                    <option value="long-form-essay">Long-Form Essay</option>
                    <option value="math">Mathematical (LaTeX)</option>
                    <option value="programming">Programming Question</option>
                    <option value="research">Research Critique</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Desired Difficulty</label>
                  <select aria-label="Desired Difficulty"
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Basic">Basic (Undergrad Fundamentals)</option>
                    <option value="Intermediate">Intermediate (MS Core)</option>
                    <option value="Advanced">Advanced (PhD Qualifying)</option>
                    <option value="Research-Level">Research level</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Question Visibility</label>
                  <select aria-label="Question Visibility"
                    value={aiIsPublic ? 'public' : 'private'}
                    onChange={(e) => setAiIsPublic(e.target.value === 'public')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="public">Public (Available to all professors in Question Bank)</option>
                    <option value="private">Private (Only visible to you)</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Specific Learning Objectives / Evaluative Goals</label>
                  <textarea aria-label="Specific Learning Objectives / Evaluative Goals"
                    rows={2}
                    value={aiLearningObjectives}
                    onChange={(e) => setAiLearningObjectives(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Must evaluate asymptotic scaling limits and proposed hardware memory IO trade-offs."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerateAIQuestion}
                  disabled={aiGenerating}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${aiGenerating ? 'animate-spin' : ''}`} />
                  <span>{aiGenerating ? 'Generating…' : 'Generate question'}</span>
                </button>
              </div>

              {/* Generated Result Preview */}
              {aiGeneratedResult && aiIsFallback && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    AI generation isn't available (no API key configured or the request failed), so this is a <strong>template question</strong>. Review and edit it in the Question Bank before using it.
                  </span>
                </div>
              )}
              {aiGeneratedResult && (
                <div className="p-5 rounded-lg bg-brand-50/70 border border-brand-200 space-y-4 fade-in shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-brand-600 text-white text-xs font-bold uppercase tracking-wider">
                        AI Generated
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                          aiIsPublic
                            ? 'bg-brand-100 text-brand-800 border border-brand-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {aiIsPublic ? 'Public' : 'Private'}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{aiGeneratedResult.title}</h4>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">
                      {aiGeneratedResult.points} points
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700">Prompt / Problem Statement:</span>
                      <p className="text-slate-800 bg-white p-3 rounded-md border border-brand-100 mt-1 font-normal leading-relaxed shadow-sm">
                        {aiGeneratedResult.prompt}
                      </p>
                    </div>

                    {aiGeneratedResult.options && (
                      <div>
                        <span className="font-semibold text-slate-700">Generated Options:</span>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-700 bg-white p-3 rounded-md border border-brand-100 shadow-sm">
                          {aiGeneratedResult.options.map((opt, i) => (
                            <li key={i} className={aiGeneratedResult.correctAnswers?.includes(opt) ? 'font-bold text-emerald-700' : ''}>
                              {opt} {aiGeneratedResult.correctAnswers?.includes(opt) ? '(Correct)' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <span className="font-semibold text-slate-700">Professor Grading Rubric:</span>
                      <p className="text-slate-700 bg-white/80 p-3 rounded-md border border-brand-100 mt-1 italic shadow-sm">
                        {aiGeneratedResult.rubric}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-700">Model Solution / Sample Answer:</span>
                      <p className="text-slate-800 bg-white p-3 rounded-md border border-brand-100 mt-1 font-mono text-xs shadow-sm">
                        {aiGeneratedResult.sampleAnswer}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleAddGeneratedQuestion}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Insert into Assessment Pool</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-600">
              <span>Powered by the Gemini API (server-side)</span>
              <button
                onClick={() => {
                  setShowAIGeneratorModal(false);
                  if (onCloseAIGenerator) onCloseAIGenerator();
                }}
                className="px-4 py-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
