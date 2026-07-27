import React, { useState } from 'react';
import { Database, Search, Filter, Plus, FileText, CheckCircle2, Code, Terminal, BookOpen, Layers, Globe, Lock, User, Sparkles } from 'lucide-react';
import { Question, TopicCategory, DifficultyLevel, QuestionType, ProfessorProfile } from '../types';

interface QuestionBankProps {
  currentProfessor?: ProfessorProfile;
  questionBank: Question[];
  onAddQuestionToBank: (question: Question) => void;
  onOpenAIGenerator: () => void;
}

export const QuestionBank: React.FC<QuestionBankProps> = ({
  currentProfessor,
  questionBank,
  onAddQuestionToBank,
  onOpenAIGenerator,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [poolView, setPoolView] = useState<'public' | 'private' | 'my-all'>('public');

  // Manual Custom Question Modal State
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualPrompt, setManualPrompt] = useState<string>('');
  const [manualTopic, setManualTopic] = useState<TopicCategory>('Machine Learning');
  const [manualDifficulty, setManualDifficulty] = useState<DifficultyLevel>('Intermediate');
  const [manualType, setManualType] = useState<QuestionType>('short-answer');
  const [manualPoints, setManualPoints] = useState<number>(15);
  const [manualRubric, setManualRubric] = useState<string>('');
  const [manualSampleAnswer, setManualSampleAnswer] = useState<string>('');
  const [manualIsPublic, setManualIsPublic] = useState<boolean>(true);

  const topics: TopicCategory[] = [
    'Machine Learning',
    'Algorithms',
    'Statistics & Prob',
    'Linear Algebra',
    'Research Methods',
    'Systems & Math',
  ];

  const difficulties: DifficultyLevel[] = ['Basic', 'Intermediate', 'Advanced', 'Research-Level'];
  const types: QuestionType[] = ['multiple-choice', 'short-answer', 'long-form-essay', 'math', 'programming', 'research'];

  // Pool Filters
  const publicQuestions = questionBank.filter((q) => q.isPublic !== false);
  const myPrivateQuestions = questionBank.filter((q) => q.isPublic === false && q.professorId === currentProfessor?.id);
  const myAllQuestions = questionBank.filter((q) => q.professorId === currentProfessor?.id || (!q.professorId && currentProfessor?.id === 'prof-elena'));

  const baseQuestions =
    poolView === 'public'
      ? publicQuestions
      : poolView === 'private'
      ? myPrivateQuestions
      : myAllQuestions;

  const filteredQuestions = baseQuestions.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTopic = selectedTopic === 'all' || q.topic === selectedTopic;
    const matchesDiff = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
    const matchesType = selectedType === 'all' || q.type === selectedType;
    return matchesSearch && matchesTopic && matchesDiff && matchesType;
  });

  const handleCreateManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualPrompt.trim()) {
      alert('Please enter a title and prompt.');
      return;
    }
    const newQ: Question = {
      id: `q-custom-${Date.now()}`,
      type: manualType,
      title: manualTitle.trim(),
      prompt: manualPrompt.trim(),
      difficulty: manualDifficulty,
      difficultyWeight: manualDifficulty === 'Basic' ? 1.0 : manualDifficulty === 'Intermediate' ? 1.5 : manualDifficulty === 'Advanced' ? 2.0 : 3.0,
      topic: manualTopic,
      points: Number(manualPoints) || 10,
      rubric: manualRubric.trim() || 'Standard evaluation criteria apply.',
      sampleAnswer: manualSampleAnswer.trim(),
      isPublic: manualIsPublic,
      professorId: currentProfessor?.id,
    };
    onAddQuestionToBank(newQ);
    setShowManualModal(false);
    // Reset fields
    setManualTitle('');
    setManualPrompt('');
    setManualRubric('');
    setManualSampleAnswer('');
    alert(`Question "${newQ.title}" added to ${manualIsPublic ? 'Public Question Bank' : 'your Private Questions'}!`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Professor Screening Question Bank</h2>
            <p className="text-xs text-slate-500">
              {publicQuestions.length} public screening problems shared across professors & your private pool
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-4 py-2.5 rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Create Custom Question</span>
          </button>
          <button
            onClick={onOpenAIGenerator}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-md text-xs font-medium shadow-sm shadow-indigo-200 transition-colors flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Generate New Question</span>
          </button>
        </div>
      </div>

      {/* Visibility Pool Selection Tabs */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Question Visibility Pool:</span>
            <span className="text-[11px] text-slate-500">
              {poolView === 'public'
                ? 'All public questions from any professor. You can pull any question from this pool into your assessments.'
                : poolView === 'private'
                ? 'Questions that only you can view and use in your assessments.'
                : 'All questions authored by you (both public and private).'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPoolView('public')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                poolView === 'public'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Public Questions ({publicQuestions.length})</span>
            </button>

            <button
              onClick={() => setPoolView('private')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                poolView === 'private'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>My Private Questions ({myPrivateQuestions.length})</span>
            </button>

            <button
              onClick={() => setPoolView('my-all')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                poolView === 'my-all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>All My Questions ({myAllQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by keyword, algorithm, or theorem..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Topics ({baseQuestions.length})</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Difficulties</option>
                {difficulties.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Question Types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setSelectedTopic('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedTopic === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Disciplines
            </button>
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedTopic === topic ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-500 shadow-sm">
            <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <h3 className="font-bold text-slate-700">No matching questions found in this pool</h3>
            <p className="text-xs mt-1">Try resetting your filters, check a different visibility tab, or create a new question.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = expandedId === q.id;
            const isPublic = q.isPublic !== false;
            const isMyQuestion = q.professorId === currentProfessor?.id || (!q.professorId && currentProfessor?.id === 'prof-elena');

            return (
              <div
                key={q.id}
                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-indigo-300"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="p-5 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{q.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          isPublic
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {isPublic ? '🌐 Public' : '🔒 Private'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                        {q.type}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                        {q.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                        {q.points} pts
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 uppercase tracking-wider">
                        {q.topic}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 max-w-3xl">{q.prompt}</p>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                    {(isMyQuestion || !q.professorId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddQuestionToBank({
                            ...q,
                            isPublic: !isPublic,
                            professorId: q.professorId || currentProfessor?.id,
                          });
                        }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded border transition-colors ${
                          isPublic
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                        }`}
                        title={`Click to make this question ${isPublic ? 'Private' : 'Public'}`}
                      >
                        {isPublic ? 'Make Private 🔒' : 'Make Public 🌐'}
                      </button>
                    )}
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-200">
                      {isExpanded ? 'Hide Rubric ▲' : 'Inspect Rubric ▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4 animate-fade-in text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                        Problem Statement / Prompt:
                      </span>
                      <div className="bg-white p-4 rounded-md border border-slate-200 text-slate-800 leading-relaxed shadow-sm">
                        {q.prompt}
                      </div>
                    </div>

                    {q.latexFormula && (
                      <div>
                        <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                          Mathematical Expression (LaTeX):
                        </span>
                        <div className="bg-[#0F172A] text-amber-300 font-mono p-3 rounded-md border border-slate-700 overflow-x-auto text-xs">
                          {q.latexFormula}
                        </div>
                      </div>
                    )}

                    {q.options && (
                      <div>
                        <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                          Multiple Choice Options:
                        </span>
                        <ul className="list-disc pl-5 space-y-1 text-slate-700 bg-white p-3 rounded-md border border-slate-200 shadow-sm">
                          {q.options.map((opt, i) => (
                            <li key={i} className={q.correctAnswers?.includes(opt) ? 'font-bold text-emerald-700' : ''}>
                              {opt} {q.correctAnswers?.includes(opt) ? '✓ (Correct)' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q.codeTemplate && (
                      <div>
                        <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                          Code Boilerplate Template ({q.language}):
                        </span>
                        <pre className="bg-[#0F172A] text-emerald-400 font-mono p-4 rounded-md border border-slate-700 overflow-x-auto text-[11px] leading-relaxed">
                          {q.codeTemplate}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                          Professor Grading Rubric:
                        </span>
                        <div className="bg-amber-50/80 p-3 rounded-md border border-amber-200 text-amber-900 italic">
                          {q.rubric || 'Standard technical evaluation criteria apply.'}
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                          Model Solution / Sample Answer:
                        </span>
                        <div className="bg-white p-3 rounded-md border border-slate-200 text-slate-800 font-mono text-[11px] shadow-sm">
                          {q.sampleAnswer || q.symbolicAnswer || 'See rubric.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Question Creator Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Create Custom Screening Question</h3>
                <p className="text-xs text-slate-300">Add a tailored problem to the public or private question bank</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualQuestion} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Question Title *</label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Asymptotic Complexity of Attention Layers"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Discipline / Topic Category</label>
                  <select
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value as TopicCategory)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Difficulty Level</label>
                  <select
                    value={manualDifficulty}
                    onChange={(e) => setManualDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {difficulties.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Question Type</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t.replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Points Value</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={manualPoints}
                    onChange={(e) => setManualPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Question Visibility *</label>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <label
                      onClick={() => setManualIsPublic(true)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-2 transition-all ${
                        manualIsPublic
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input type="radio" checked={manualIsPublic} onChange={() => setManualIsPublic(true)} className="text-indigo-600" />
                      <div>
                        <div className="text-xs">🌐 Public Question Bank</div>
                        <div className="text-[10px] font-normal text-slate-500">Available to all professors</div>
                      </div>
                    </label>

                    <label
                      onClick={() => setManualIsPublic(false)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-2 transition-all ${
                        !manualIsPublic
                          ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input type="radio" checked={!manualIsPublic} onChange={() => setManualIsPublic(false)} className="text-amber-600" />
                      <div>
                        <div className="text-xs">🔒 Private Question</div>
                        <div className="text-[10px] font-normal text-slate-500">Only visible to you</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Problem Statement / Prompt *</label>
                  <textarea
                    rows={4}
                    required
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                    placeholder="Enter the full problem formulation or question text..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Grading Rubric / Evaluation Criteria</label>
                  <textarea
                    rows={2}
                    value={manualRubric}
                    onChange={(e) => setManualRubric(e.target.value)}
                    placeholder="Describe what a top-tier answer must demonstrate..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Model Solution / Sample Answer</label>
                  <textarea
                    rows={2}
                    value={manualSampleAnswer}
                    onChange={(e) => setManualSampleAnswer(e.target.value)}
                    placeholder="Provide sample solution or key derivation steps..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-sm shadow-indigo-200"
                >
                  Add Question to Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
