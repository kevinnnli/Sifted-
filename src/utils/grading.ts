import { 
  Question, 
  QuestionResponseItem, 
  HireabilityLevel, 
  InterviewRecommendation, 
  TopicCategory,
  ApplicantSubmission,
} from '../types';

export const HIREABILITY_LEVELS: HireabilityLevel[] = [
  'Tier 1: Direct Admit / Top Fellow',
  'Tier 2: Strong Interview Contender',
  'Tier 3: Conditional / Needs Review',
  'Tier 4: Does Not Meet Technical Bar',
];

export const INTERVIEW_RECOMMENDATIONS: InterviewRecommendation[] = [
  'Strongly Recommend Interview',
  'Recommend Interview',
  'Borderline',
  'Do Not Recommend',
];

/**
 * Maps difficulty level string to a point multiplier weight.
 * Harder questions contribute significantly more to the total evaluation.
 */
export function getDifficultyMultiplier(difficulty?: string): number {
  switch (difficulty) {
    case 'Basic':
      return 1.0;
    case 'Intermediate':
      return 1.5;
    case 'Advanced':
      return 2.0;
    case 'Research-Level':
      return 3.0;
    default:
      return 1.5;
  }
}

/**
 * Strictly verifies if a candidate's submitted answer is empty, trivial,
 * whitespace-only, or unmodified from the provided starting code template.
 */
export function isEmptyOrTrivialResponse(answer: any, question?: Question): boolean {
  if (answer === null || answer === undefined) return true;
  
  if (Array.isArray(answer)) {
    return answer.length === 0 || answer.every((a) => isEmptyOrTrivialResponse(a, question));
  }

  const str = String(answer).trim();
  if (!str) return true;

  // A multiple-choice selection is never "trivial" content: an option like "No" is a real answer
  if (question?.type === 'multiple-choice') return false;

  // Check for common trivial placeholders
  const lower = str.toLowerCase();
  const trivialStrings = ['na', 'n/a', 'none', 'nothing', 'test', 'no answer', 'empty', 'idk', '.', '..', '...', '-', 'abc'];
  if (trivialStrings.includes(lower)) return true;
  if (str.length < 3 && !/^-?\d+(\.\d+)?$/.test(str)) return true;

  // For programming questions, check against code template or extreme brevity
  if (question?.type === 'programming') {
    if (question.codeTemplate) {
      const trimmedTemplate = question.codeTemplate.trim();
      if (str === trimmedTemplate) return true;
      // Strip whitespace to catch trivial formatting changes
      const strippedStr = str.replace(/\s+/g, '');
      const strippedTemplate = trimmedTemplate.replace(/\s+/g, '');
      if (strippedStr === strippedTemplate) return true;
    }
    // Check if code contains only comments or is less than 20 characters
    const withoutComments = str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
    if (withoutComments.length < 15) return true;
  }

  return false;
}

const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'also', 'among', 'answer', 'answers', 'applicant', 'applicants',
  'approach', 'based', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'candidate', 'candidates',
  'clear', 'clearly', 'correct', 'correctly', 'could', 'crucially', 'demonstrate', 'describe', 'detailed', 'does',
  'doing', 'down', 'during', 'each', 'excellent', 'explain', 'explains', 'from', 'further', 'good', 'have', 'having',
  'here', 'into', 'just', 'like', 'mention', 'more', 'most', 'must', 'need', 'only', 'other', 'over', 'propose',
  'rather', 'same', 'should', 'show', 'since', 'some', 'state', 'states', 'strong', 'such', 'than', 'that', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until', 'using', 'valid', 'very',
  'well', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'within', 'without', 'would', 'your',
]);

function extractConcepts(text: string): Set<string> {
  const concepts = new Set<string>();
  (text.toLowerCase().match(/[\p{L}\p{N}.]+/gu) || []).forEach((raw) => {
    const token = raw.replace(/^\.+|\.+$/g, '');
    const isNumber = /^-?\d+(\.\d+)?$/.test(token);
    if (isNumber ? token.replace('-', '').length < 2 : token.length < 4 || STOPWORDS.has(token)) return;
    concepts.add(!isNumber && token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token);
  });
  return concepts;
}

/**
 * Counts how many key concepts of the reference text (rubric / model answer) appear in a response.
 * Returns null when there is no reference text to compare against.
 */
export function getConceptCoverage(response: string, reference: string) {
  const expected = [...extractConcepts(reference)];
  if (expected.length === 0) return null;
  const answerConcepts = extractConcepts(response);
  const matched = expected.filter((c) => answerConcepts.has(c)).length;
  // Long rubrics shouldn't demand every word: cap the expected concept count
  return { matched: Math.min(matched, 15), expected: Math.min(expected.length, 15) };
}

/**
 * Evaluates a single question response, factoring in difficulty weight
 * and enforcing zero points for empty or unmodified answers.
 */
export function evaluateQuestionResponse(
  question: Question,
  responseVal: any,
  timeSpentSeconds: number = 120
): QuestionResponseItem {
  const multiplier = getDifficultyMultiplier(question.difficulty);
  const maxScore = question.points || 20;
  const maxWeightedScore = Math.round(maxScore * multiplier * 10) / 10;
  
  const isEmpty = isEmptyOrTrivialResponse(responseVal, question);

  if (isEmpty) {
    return {
      questionId: question.id,
      answer: responseVal || '',
      timeSpentSeconds,
      aiScore: 0,
      maxScore,
      difficultyWeight: multiplier,
      weightedScore: 0,
      maxWeightedScore,
      aiConfidence: 99,
      aiFeedback: `0/${maxScore} pts (0.0/${maxWeightedScore} weighted pts): Submission was empty, trivial, or unmodified from the code template. Zero credit awarded.`,
      isCorrect: false,
    };
  }

  // Evaluate real submissions based on question type
  let isCorrect = true;
  let rawScore = maxScore;
  let feedback = 'Exemplary technical response demonstrating thorough understanding and rigorous derivation.';
  let confidence = 95;

  if (question.type === 'multiple-choice') {
    const selected = Array.isArray(responseVal) ? responseVal : [responseVal];
    const correct = question.correctAnswers || [];
    isCorrect = correct.length > 0 && selected.length > 0 && selected.every((s) => correct.includes(s));
    rawScore = isCorrect ? maxScore : 0;
    feedback = isCorrect
      ? `Correct selection (+${maxScore} pts · ${multiplier}x difficulty multiplier).`
      : `Incorrect option selected (0/${maxScore} pts).`;
  } else {
    // Short answer, essay, math, research and programming have no exact answer key, so the
    // automated score is provisional: it measures how many key concepts from the professor's
    // rubric / model answer appear in the response. AI grading or the professor finalizes it.
    const str = String(responseVal).trim();
    const reference = [question.rubric, question.sampleAnswer, question.symbolicAnswer].filter(Boolean).join(' ');
    const coverage = getConceptCoverage(str, reference);
    confidence = 60;

    if (question.type === 'programming') {
      // Code is not executed in the browser, so award a provisional score for a structurally complete
      // implementation plus a bonus for addressing the rubric's key points
      const hasLogic = /\b(return|for|while|if|def|function|class)\b/.test(str);
      if (!hasLogic && str.length < 50) {
        rawScore = Math.round(maxScore * 0.2);
        feedback = `Provisional: incomplete implementation (${rawScore}/${maxScore} pts). Code lacks core control flow or algorithmic logic.`;
      } else {
        const ratio = coverage ? Math.min(1, coverage.matched / Math.max(1, coverage.expected * 0.5)) : 0.5;
        rawScore = Math.round(maxScore * (0.5 + 0.5 * ratio));
        feedback = `Provisional automated score (${rawScore}/${maxScore} pts): implementation is structurally complete${coverage ? ` and addresses ${coverage.matched} of ${coverage.expected} rubric concepts` : ''}. Test cases are not executed automatically — professor should verify correctness.`;
      }
      confidence = 50;
    } else if (coverage === null) {
      // No rubric or model answer to compare against: needs manual grading
      rawScore = Math.round(maxScore * (str.length < 30 ? 0.3 : 0.5));
      confidence = 30;
      feedback = `Provisional placeholder (${rawScore}/${maxScore} pts). No rubric or model answer is defined for this question, so it requires manual grading by the professor.`;
    } else {
      const ratio = Math.min(1, coverage.matched / Math.max(1, coverage.expected * 0.6));
      let fraction = 0.1 + 0.9 * ratio;
      if (str.length < 30) fraction = Math.min(fraction, 0.4);
      rawScore = Math.round(maxScore * fraction);
      feedback = `Provisional automated score (${rawScore}/${maxScore} pts): response covers ${coverage.matched} of ${coverage.expected} key concepts from the rubric/model answer. Professor review recommended.`;
    }
    isCorrect = rawScore >= maxScore * 0.7;
  }

  const weightedScore = Math.round(rawScore * multiplier * 10) / 10;

  return {
    questionId: question.id,
    answer: responseVal,
    timeSpentSeconds,
    aiScore: rawScore,
    maxScore,
    difficultyWeight: multiplier,
    weightedScore,
    maxWeightedScore,
    aiConfidence: confidence,
    aiFeedback: feedback,
    isCorrect,
  };
}

/**
 * Determines the hireability level / tier based on weighted score percentage
 * and whether empty submissions were detected.
 */
export function getHireabilityLevel(
  overallPercentage: number,
  emptyCount: number,
  totalQuestions: number
): HireabilityLevel {
  // If half or more of the test is empty, immediately disqualify
  if (totalQuestions > 0 && emptyCount >= Math.ceil(totalQuestions / 2)) {
    return 'Tier 4: Does Not Meet Technical Bar';
  }
  if (overallPercentage < 50) {
    return 'Tier 4: Does Not Meet Technical Bar';
  }
  if (overallPercentage >= 90 && emptyCount === 0) {
    return 'Tier 1: Direct Admit / Top Fellow';
  }
  if (overallPercentage >= 75) {
    return 'Tier 2: Strong Interview Contender';
  }
  return 'Tier 3: Conditional / Needs Review';
}

/**
 * Maps hireability level to an interview recommendation string.
 */
export function getRecommendationFromLevel(level: HireabilityLevel): InterviewRecommendation {
  switch (level) {
    case 'Tier 1: Direct Admit / Top Fellow':
      return 'Strongly Recommend Interview';
    case 'Tier 2: Strong Interview Contender':
      return 'Recommend Interview';
    case 'Tier 3: Conditional / Needs Review':
      return 'Borderline';
    case 'Tier 4: Does Not Meet Technical Bar':
      return 'Do Not Recommend';
    default:
      return 'Recommend Interview';
  }
}

/**
 * Computes full submission grading across all questions with weighted point system.
 */
export function calculateSubmissionGrading(
  questions: Question[],
  responsesMap: Record<string, { answer: any; timeSpentSeconds?: number }>
) {
  const evaluatedResponses: Record<string, QuestionResponseItem> = {};
  let totalWeightedScore = 0;
  let maxTotalWeightedScore = 0;
  let emptyCount = 0;

  // Only topics covered by the assessment get an entry, so untested topics don't show up as 100%
  const topicTotals: Partial<Record<TopicCategory, { scored: number; total: number; percentage: number }>> = {};

  questions.forEach((q) => {
    const rawResp = responsesMap[q.id] || { answer: '', timeSpentSeconds: 120 };
    const evalItem = evaluateQuestionResponse(q, rawResp.answer, rawResp.timeSpentSeconds || 120);
    
    evaluatedResponses[q.id] = evalItem;
    totalWeightedScore += evalItem.weightedScore || 0;
    maxTotalWeightedScore += evalItem.maxWeightedScore || (q.points * 1.5);

    if (isEmptyOrTrivialResponse(rawResp.answer, q)) {
      emptyCount++;
    }

    // Accumulate topic breakdown
    const topic = q.topic || 'Machine Learning';
    if (!topicTotals[topic]) {
      topicTotals[topic] = { scored: 0, total: 0, percentage: 0 };
    }
    topicTotals[topic]!.scored += evalItem.weightedScore || 0;
    topicTotals[topic]!.total += evalItem.maxWeightedScore || (q.points * 1.5);
  });

  finalizeTopicPercentages(topicTotals);

  const overallScore = maxTotalWeightedScore > 0
    ? Math.round((totalWeightedScore / maxTotalWeightedScore) * 100)
    : 0;

  const hireabilityLevel = getHireabilityLevel(overallScore, emptyCount, questions.length);
  const interviewRecommendation = getRecommendationFromLevel(hireabilityLevel);

  let recommendationExplanation = `Applicant scored ${overallScore}% overall on the difficulty-weighted evaluation (${Math.round(totalWeightedScore)}/${Math.round(maxTotalWeightedScore)} weighted points). `;
  if (emptyCount > 0) {
    recommendationExplanation += `Warning: ${emptyCount} question(s) were submitted empty or unmodified from boilerplate templates, receiving 0 points. `;
  }
  if (hireabilityLevel === 'Tier 1: Direct Admit / Top Fellow') {
    recommendationExplanation += 'Exemplary technical depth and rigorous mathematical derivations. Highly recommended for immediate doctoral fellowship or research admission.';
  } else if (hireabilityLevel === 'Tier 2: Strong Interview Contender') {
    recommendationExplanation += 'Solid performance across advanced and intermediate problems. Recommended for faculty interview to evaluate specialized research fit.';
  } else if (hireabilityLevel === 'Tier 3: Conditional / Needs Review') {
    recommendationExplanation += 'Moderate technical execution with gaps in advanced algorithmic or theoretical sections. Faculty should review manual derivations before advancing.';
  } else {
    recommendationExplanation += 'Did not meet the graduate technical screening threshold due to low scores or missing/empty answers.';
  }

  const strongestTopic = Object.entries(topicTotals).sort((a, b) => b[1]!.percentage - a[1]!.percentage)[0]?.[0];
  const aiSummary = emptyCount > 0
    ? `Flagged: ${emptyCount} empty or boilerplate answer(s). Weighted Score: ${overallScore}% (${hireabilityLevel}).`
    : `Weighted Score: ${overallScore}% (${hireabilityLevel}).${strongestTopic ? ` Strongest in ${strongestTopic}.` : ''}`;

  return {
    evaluatedResponses,
    totalWeightedScore: Math.round(totalWeightedScore * 10) / 10,
    maxTotalWeightedScore: Math.round(maxTotalWeightedScore * 10) / 10,
    overallScore,
    hireabilityLevel,
    interviewRecommendation,
    recommendationExplanation,
    aiSummary,
    topicBreakdown: topicTotals,
    emptyCount,
  };
}

function finalizeTopicPercentages(
  topicTotals: Partial<Record<TopicCategory, { scored: number; total: number; percentage: number }>>
) {
  Object.values(topicTotals).forEach((item) => {
    if (!item) return;
    item.scored = Math.round(item.scored * 10) / 10;
    item.total = Math.round(item.total * 10) / 10;
    item.percentage = item.total > 0 ? Math.round((item.scored / item.total) * 100) : 0;
  });
}

/**
 * The score that counts for a response: the professor's manual override when present, else the AI score.
 */
export function getEffectiveScore(resp: QuestionResponseItem): number {
  return resp.professorOverride && typeof resp.manualScore === 'number' ? resp.manualScore : resp.aiScore;
}

/**
 * Applies professor manual score overrides to a submission and recomputes the weighted totals,
 * overall percentage and topic breakdown so every view stays consistent with the overrides.
 */
export function applyScoreOverrides(
  submission: ApplicantSubmission,
  overrides: Record<string, number>,
  questions: Question[]
): ApplicantSubmission {
  const responses: Record<string, QuestionResponseItem> = {};
  const topicTotals: Partial<Record<TopicCategory, { scored: number; total: number; percentage: number }>> = {};
  let totalWeighted = 0;
  let maxTotalWeighted = 0;

  Object.entries(submission.responses).forEach(([qid, resp]) => {
    const question = questions.find((q) => q.id === resp.questionId || q.id === qid);
    const weight = resp.difficultyWeight || getDifficultyMultiplier(question?.difficulty);
    let updated: QuestionResponseItem = { ...resp };
    if (overrides[qid] !== undefined) {
      const clamped = Math.max(0, Math.min(resp.maxScore, overrides[qid]));
      updated = {
        ...updated,
        manualScore: clamped,
        professorOverride: clamped !== resp.aiScore,
        isCorrect: clamped >= resp.maxScore * 0.7,
      };
    }
    const score = getEffectiveScore(updated);
    const maxWeighted = resp.maxWeightedScore ?? Math.round(resp.maxScore * weight * 10) / 10;
    updated.weightedScore = Math.round(score * weight * 10) / 10;
    updated.maxWeightedScore = maxWeighted;
    responses[qid] = updated;

    totalWeighted += updated.weightedScore;
    maxTotalWeighted += maxWeighted;
    const topic = question?.topic || 'Machine Learning';
    if (!topicTotals[topic]) topicTotals[topic] = { scored: 0, total: 0, percentage: 0 };
    topicTotals[topic]!.scored += updated.weightedScore;
    topicTotals[topic]!.total += maxWeighted;
  });

  finalizeTopicPercentages(topicTotals);
  const overallScore = maxTotalWeighted > 0 ? Math.round((totalWeighted / maxTotalWeighted) * 100) : 0;

  return {
    ...submission,
    responses,
    totalWeightedScore: Math.round(totalWeighted * 10) / 10,
    maxTotalWeightedScore: Math.round(maxTotalWeighted * 10) / 10,
    overallScore,
    topicBreakdown: topicTotals,
  };
}

/**
 * AI-generated probability (%) above which a session is flagged, per the professor's sensitivity setting.
 */
export function getAiFlagThreshold(sensitivity?: 'high' | 'medium' | 'low'): number {
  if (sensitivity === 'low') return 85;
  if (sensitivity === 'high') return 35;
  return 50;
}

/**
 * Returns Tailwind CSS badge classes for a given hireability level.
 */
export function getHireabilityBadgeStyle(level?: string): string {
  if (!level) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (level.includes('Tier 1')) {
    return 'bg-purple-100 text-purple-800 border border-purple-300 font-bold shadow-xs';
  }
  if (level.includes('Tier 2')) {
    return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
  }
  if (level.includes('Tier 3')) {
    return 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold';
  }
  return 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
}

/**
 * Returns short badge text for the hireability level.
 */
export function getHireabilityShortText(level?: string): string {
  if (!level) return 'Review Pending';
  if (level.includes('Tier 1')) return 'Tier 1: Direct Admit';
  if (level.includes('Tier 2')) return 'Tier 2: Strong Interview';
  if (level.includes('Tier 3')) return 'Tier 3: Conditional';
  return 'Tier 4: Do Not Admit';
}
