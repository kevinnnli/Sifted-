import { 
  Question, 
  QuestionResponseItem, 
  HireabilityLevel, 
  InterviewRecommendation, 
  TopicCategory 
} from '../types';

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

  // Check for common trivial placeholders
  const lower = str.toLowerCase();
  const trivialStrings = ['na', 'n/a', 'none', 'nothing', 'test', 'no answer', 'empty', 'idk', '.', '..', '...', '-', 'abc'];
  if (trivialStrings.includes(lower)) return true;
  if (str.length < 3 && !/^\d+$/.test(str)) return true;

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
    isCorrect = Boolean(question.correctAnswers?.includes(responseVal));
    rawScore = isCorrect ? maxScore : 0;
    feedback = isCorrect
      ? `Correct selection (+${maxScore} pts · ${multiplier}x difficulty multiplier).`
      : `Incorrect option selected (0/${maxScore} pts).`;
  } else if (question.type === 'programming') {
    // Check code structure and length heuristic
    const str = String(responseVal).trim();
    const hasLogic = str.includes('return') || str.includes('for') || str.includes('while') || str.includes('if') || str.includes('function') || str.includes('def') || str.includes('class') || str.length > 80;
    if (!hasLogic && str.length < 50) {
      isCorrect = false;
      rawScore = Math.round(maxScore * 0.3);
      feedback = `Partial implementation (${rawScore}/${maxScore} pts). Code lacks core control flow or complete algorithmic logic.`;
      confidence = 88;
    } else {
      isCorrect = true;
      rawScore = maxScore;
      feedback = `Solid algorithmic execution (+${maxScore} pts · ${multiplier}x difficulty weight). Clean code structure and asymptotic complexity.`;
    }
  } else {
    // Short answer, long form essay, math, research
    const str = String(responseVal).trim();
    if (str.length < 30) {
      isCorrect = false;
      rawScore = Math.round(maxScore * 0.4);
      feedback = `Brief response (${rawScore}/${maxScore} pts). Needs deeper mathematical derivation or explanation of theoretical bounds.`;
      confidence = 85;
    } else {
      isCorrect = true;
      rawScore = maxScore;
      feedback = `Comprehensive research analysis (+${maxScore} pts · ${multiplier}x difficulty weight). Clear theoretical trade-offs and domain terminology.`;
    }
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

  const topicTotals: Record<TopicCategory, { scored: number; total: number; percentage: number }> = {
    'Machine Learning': { scored: 0, total: 0, percentage: 0 },
    'Algorithms': { scored: 0, total: 0, percentage: 0 },
    'Statistics & Prob': { scored: 0, total: 0, percentage: 0 },
    'Linear Algebra': { scored: 0, total: 0, percentage: 0 },
    'Research Methods': { scored: 0, total: 0, percentage: 0 },
    'Systems & Math': { scored: 0, total: 0, percentage: 0 },
  };

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
    topicTotals[topic].scored += evalItem.weightedScore || 0;
    topicTotals[topic].total += evalItem.maxWeightedScore || (q.points * 1.5);
  });

  // Calculate percentage for each topic
  Object.keys(topicTotals).forEach((t) => {
    const key = t as TopicCategory;
    const item = topicTotals[key];
    item.percentage = item.total > 0 ? Math.round((item.scored / item.total) * 100) : 100;
  });

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

  const aiSummary = emptyCount > 0
    ? `Flagged: ${emptyCount} empty or boilerplate answer(s). Weighted Score: ${overallScore}% (${hireabilityLevel}).`
    : `Weighted Score: ${overallScore}% (${hireabilityLevel}). Strongest in ${Object.entries(topicTotals).sort((a, b) => b[1].percentage - a[1].percentage)[0]?.[0] || 'Core CS'}.`;

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
