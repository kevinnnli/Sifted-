import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { MOCK_PROFESSORS, MOCK_QUESTIONS, MOCK_ASSESSMENTS, MOCK_SUBMISSIONS, MOCK_USER_ACCOUNTS, MOCK_INVITATIONS } from './src/data/mockData';
import { INTERVIEW_RECOMMENDATIONS } from './src/utils/grading';

// .env.local (documented in the README) takes precedence over .env
dotenv.config({ path: ['.env.local', '.env'] });

const DB_FILE = path.join(process.cwd(), 'database.json');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const TOPICS = ['Machine Learning', 'Algorithms', 'Statistics & Prob', 'Linear Algebra', 'Research Methods', 'Systems & Math'];
const DIFFICULTIES = ['Basic', 'Intermediate', 'Advanced', 'Research-Level'];

// A deep copy, so writes to the database never mutate the in-memory sample data used by "reset"
function getDefaultData() {
  return structuredClone({
    professors: MOCK_PROFESSORS,
    assessments: MOCK_ASSESSMENTS,
    questionBank: MOCK_QUESTIONS,
    submissions: MOCK_SUBMISSIONS,
    userAccounts: MOCK_USER_ACCOUNTS,
    invitations: MOCK_INVITATIONS,
  });
}

function getDbData() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      // Older database files may be missing collections added later
      const defaults = getDefaultData();
      for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
        if (!Array.isArray(parsed[key])) parsed[key] = defaults[key];
      }
      return parsed;
    } catch (e) {
      // Never silently overwrite a database we couldn't parse: keep a copy for recovery
      const backup = `${DB_FILE}.corrupt-${Date.now()}`;
      console.error(`Error reading database.json, backing it up to ${backup} and starting fresh:`, e);
      try {
        fs.copyFileSync(DB_FILE, backup);
      } catch (copyErr) {
        console.error('Failed to back up database.json:', copyErr);
      }
    }
  }
  const defaultData = getDefaultData();
  saveDbData(defaultData);
  return defaultData;
}

function pickAllowed(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function saveDbData(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing database.json:', e);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper for lazy Gemini initialization with proper User-Agent header
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !isAiConfigured()) {
    console.warn('GEMINI_API_KEY is missing or set to placeholder. AI features will use fallback simulations.');
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isAiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

// 1. API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), aiConfigured: isAiConfigured(), aiModel: GEMINI_MODEL });
});

// 2. API: AI Question Generator
app.post('/api/ai/generate-question', async (req, res) => {
  const { field, course, specialization, desiredDifficulty, learningObjectives, questionType } = req.body || {};
  const type = pickAllowed(questionType, ['multiple-choice', 'short-answer', 'long-form-essay', 'math', 'programming', 'research'], 'long-form-essay');
  const difficulty = pickAllowed(desiredDifficulty, DIFFICULTIES, 'Advanced');
  const isMC = type === 'multiple-choice';

  // Template question used when no API key is configured or the AI call fails
  const buildFallback = (errorMsg?: string) => ({
    success: true,
    question: {
      id: `q-ai-${Date.now()}`,
      type,
      title: `${difficulty} ${specialization || field || 'Research'} Problem`,
      prompt: isMC
        ? `In the context of ${course || field || 'Graduate Computer Science'}, what is the asymptotic time complexity of standard dense self-attention over a sequence of length N with embedding dimension D?`
        : `In the context of ${course || field || 'Graduate Computer Science'}, analyze the fundamental trade-offs involved when ${learningObjectives || 'optimizing computational scaling and memory footprint'}. Propose a mathematical framework or algorithmic modification to address standard baseline limitations.`,
      difficulty,
      topic: 'Machine Learning',
      points: 20,
      rubric: isMC
        ? 'Correct answer: O(N² · D), from the N × N query-key dot products of dimension D.'
        : `Strong candidates must demonstrate rigorous mastery of ${specialization || field || 'the subject'}. They should articulate trade-offs clearly, reference relevant computational bounds, and propose structurally sound improvements rather than high-level generalizations.`,
      sampleAnswer: isMC
        ? 'O(N² · D)'
        : 'An optimal approach involves decomposing the computational pipeline into localized memory-efficient tiles or utilizing low-rank parameterization. This achieves linear scaling while preserving most of the associative capacity.',
      options: isMC ? ['O(N · D²)', 'O(N² · D)', 'O(N · log N · D)', 'O(N³ + D²)'] : undefined,
      correctAnswers: isMC ? ['O(N² · D)'] : undefined,
    },
    isFallback: true,
    ...(errorMsg ? { errorMsg } : {}),
  });

  const ai = getGenAIClient();
  if (!ai) return res.json(buildFallback());

  try {
    const prompt = `You are an expert university professor in ${field || 'Computer Science and Engineering'} teaching ${course || 'Graduate Research Methods'}.
Create a challenging screening exam question for undergraduate students applying to graduate (MS/PhD) programs.
Specialization: ${specialization || 'General'}
Desired Difficulty Level: ${difficulty}
Learning Objectives: ${learningObjectives || 'Assess technical depth and research intuition'}
Requested Question Type: ${type}
${isMC ? 'Because this is a multiple-choice question, provide exactly 4 distinct answer options and state which option is correct (copy its text exactly).' : ''}

Return a structured JSON object representing the generated question. Make the question intellectually rigorous, unambiguous, and suitable for university screening.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise academic title for the question' },
            prompt: { type: Type.STRING, description: 'The detailed question text or problem statement presented to the applicant' },
            difficulty: { type: Type.STRING, description: DIFFICULTIES.join(', ') },
            topic: { type: Type.STRING, description: `One of: ${TOPICS.join(', ')}` },
            points: { type: Type.INTEGER, description: 'Recommended point value between 10 and 30' },
            rubric: { type: Type.STRING, description: 'Detailed grading rubric for the professor explaining what constitutes a top response' },
            sampleAnswer: { type: Type.STRING, description: 'An ideal model answer or solution' },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Multiple-choice options (only for multiple-choice questions)' },
            correctAnswer: { type: Type.STRING, description: 'The exact text of the correct option (only for multiple-choice questions)' },
          },
          required: ['title', 'prompt', 'difficulty', 'topic', 'points', 'rubric'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from AI model');
    }

    const parsed = JSON.parse(text);
    let options: string[] | undefined;
    let correctAnswers: string[] | undefined;
    if (isMC) {
      options = Array.isArray(parsed.options) ? parsed.options.filter((o: unknown) => typeof o === 'string' && o.trim()) : [];
      if (!options || options.length < 2 || !options.includes(parsed.correctAnswer)) {
        throw new Error('AI returned a multiple-choice question without valid options and a matching correct answer');
      }
      correctAnswers = [parsed.correctAnswer];
    }

    const generatedQuestion = {
      id: `q-ai-${Date.now()}`,
      type,
      title: parsed.title,
      prompt: parsed.prompt,
      difficulty: pickAllowed(parsed.difficulty, DIFFICULTIES, difficulty),
      topic: pickAllowed(parsed.topic, TOPICS, 'Machine Learning'),
      points: Math.round(clampNumber(parsed.points, 1, 100, 20)),
      rubric: parsed.rubric,
      sampleAnswer: parsed.sampleAnswer || (isMC ? parsed.correctAnswer : 'See grading rubric.'),
      options,
      correctAnswers,
    };

    res.json({ success: true, question: generatedQuestion, isFallback: false });
  } catch (error: any) {
    console.error('Error generating question with AI:', error);
    // Return graceful fallback on error or quota limit
    res.json(buildFallback(error?.message));
  }
});

// 3. API: AI Automated Grading & Interview Recommendation
app.post('/api/ai/grade-submission', async (req, res) => {
  const { applicantName, responses, questions, overallScore, totalWeightedScore, maxTotalWeightedScore } = req.body || {};
  const ai = getGenAIClient();

  // Without AI the client keeps its own deterministic grading; don't invent numbers here
  if (!ai) {
    return res.json({ success: true, isFallback: true });
  }

  try {
    const questionList: any[] = Array.isArray(questions) ? questions : [];
    const responseMap: Record<string, any> = responses && typeof responses === 'object' ? responses : {};
    const gradable = questionList.filter((q) => q && q.type !== 'multiple-choice');

    const items = questionList.map((q) => ({
      questionId: q.id,
      type: q.type,
      title: q.title,
      prompt: q.prompt,
      maxPoints: q.points,
      rubric: q.rubric,
      modelAnswer: q.sampleAnswer || q.symbolicAnswer,
      correctOption: q.type === 'multiple-choice' ? q.correctAnswers : undefined,
      applicantAnswer: String(responseMap[q.id]?.answer ?? '').slice(0, 4000),
      autoScore: q.type === 'multiple-choice' ? responseMap[q.id]?.aiScore : undefined,
    }));

    const prompt = `You are a Senior Faculty Admissions Evaluator at a top graduate university.
Review the following screening assessment submission for graduate applicant "${applicantName || 'Applicant'}".
A provisional difficulty-weighted score of ${totalWeightedScore ?? 'N/A'}/${maxTotalWeightedScore ?? 'N/A'} (${overallScore ?? 'N/A'}%) was computed automatically.
Multiple-choice questions are already graded exactly (see autoScore). Grade every other question against its rubric and model answer.
Empty, trivial, off-topic, or boilerplate responses must receive 0 points.

Questions and Applicant Responses:
${JSON.stringify(items, null, 2)}

Provide your evaluation as a JSON object with:
1. "questionScores": one entry for each non-multiple-choice question: { "questionId", "score" (integer from 0 to that question's maxPoints), "feedback" (1-2 sentences referencing the rubric) }.
2. "interviewRecommendation": Strictly one of ${JSON.stringify(INTERVIEW_RECOMMENDATIONS)}.
3. "recommendationExplanation": A thorough, multi-sentence written explanation justifying why the applicant should or should not advance to an interview based on their difficulty-weighted performance and specific answers.
4. "aiSummary": A concise 2-sentence executive summary of the applicant's top strengths and potential weaknesses.
5. "confidenceScore": An integer from 0 to 100 estimating grading confidence.
6. "aiGeneratedProbability": An integer from 0 to 100 estimating the probability that the applicant pasted unauthorized LLM-generated text.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionScores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING },
                },
                required: ['questionId', 'score', 'feedback'],
              },
            },
            interviewRecommendation: { type: Type.STRING },
            recommendationExplanation: { type: Type.STRING },
            aiSummary: { type: Type.STRING },
            confidenceScore: { type: Type.INTEGER },
            aiGeneratedProbability: { type: Type.INTEGER },
          },
          required: ['questionScores', 'interviewRecommendation', 'recommendationExplanation', 'aiSummary', 'confidenceScore', 'aiGeneratedProbability'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const parsed = JSON.parse(text);

    const questionScores = (Array.isArray(parsed.questionScores) ? parsed.questionScores : [])
      .map((qs: any) => {
        const q = gradable.find((g) => g.id === qs?.questionId);
        if (!q) return null;
        return {
          questionId: q.id,
          score: Math.round(clampNumber(qs.score, 0, Number(q.points) || 0, 0)),
          feedback: typeof qs.feedback === 'string' ? qs.feedback : '',
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      isFallback: false,
      questionScores,
      interviewRecommendation: INTERVIEW_RECOMMENDATIONS.includes(parsed.interviewRecommendation) ? parsed.interviewRecommendation : undefined,
      recommendationExplanation: typeof parsed.recommendationExplanation === 'string' ? parsed.recommendationExplanation : undefined,
      aiSummary: typeof parsed.aiSummary === 'string' ? parsed.aiSummary : undefined,
      confidenceScore: clampNumber(parsed.confidenceScore, 0, 100, 0) || undefined,
      aiGeneratedProbability: clampNumber(parsed.aiGeneratedProbability, 0, 100, 0),
    });
  } catch (error: any) {
    console.error('Error grading with AI:', error);
    res.json({ success: true, isFallback: true, errorMsg: error?.message });
  }
});

// 4. API: AI Applicant Deep Analysis
function buildFallbackBriefing(submission: any): string {
  const name = submission?.applicantName || 'Candidate';
  const score = submission?.overallScore ?? 'N/A';
  const topics = Object.entries(submission?.topicBreakdown || {}) as [string, any][];
  const sorted = topics.filter(([, t]) => t && t.total > 0).sort((a, b) => b[1].percentage - a[1].percentage);
  const strongest = sorted[0];
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;
  const integrity = submission?.integrityReport;
  return `Executive Faculty Review for ${name}:
This applicant achieved an overall difficulty-weighted score of ${score}%.${strongest ? ` Their strongest area was ${strongest[0]} (${strongest[1].percentage}%).` : ''}${weakest ? ` The weakest area was ${weakest[0]} (${weakest[1].percentage}%), which is worth probing during the interview.` : ''}
Integrity: ${integrity ? `${integrity.tabSwitchCount ?? 0} tab switch(es), ${integrity.copyPasteAttempts ?? 0} clipboard event(s), ${integrity.integrityFlagged ? 'session FLAGGED for review' : 'no integrity flags'}.` : 'no integrity data recorded.'}
(Automated summary — configure GEMINI_API_KEY for an AI-written briefing.)`;
}

app.post('/api/ai/analyze-applicant', async (req, res) => {
  const { submission } = req.body || {};
  if (!submission) {
    return res.status(400).json({ success: false, error: 'Missing submission' });
  }
  const ai = getGenAIClient();

  if (!ai) {
    return res.json({ success: true, analysis: buildFallbackBriefing(submission), isFallback: true });
  }

  try {
    const prompt = `You are an Admissions AI Advisor for a university professor. Write a concise, 3-paragraph executive briefing for the professor preparing to interview graduate applicant "${submission.applicantName}" from ${submission.university}.
Score: ${submission.overallScore}%. Recommendation: ${submission.interviewRecommendation}.
Topic Breakdown: ${JSON.stringify(submission.topicBreakdown)}
Integrity Report: ${JSON.stringify(submission.integrityReport)}

Highlight their exceptional areas, identify any theoretical gaps to test during the live interview, and comment on their academic integrity profile. Keep the tone professional, insightful, and collegiate.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    res.json({
      success: true,
      analysis: response.text || buildFallbackBriefing(submission),
    });
  } catch (error: any) {
    console.error('Error analyzing applicant:', error);
    res.json({ success: true, analysis: buildFallbackBriefing(submission), isFallback: true });
  }
});

// 5. API: Get all persistent database state
app.get('/api/data', (req, res) => {
  const data = getDbData();
  res.json({ success: true, ...data });
});

// 6. API: Save/update assessment
app.post('/api/data/assessments', (req, res) => {
  const { assessment } = req.body || {};
  if (!assessment?.id) return res.status(400).json({ success: false, error: 'Missing assessment' });
  const db = getDbData();
  const idx = db.assessments.findIndex((a: any) => a.id === assessment.id);
  if (idx >= 0) {
    db.assessments[idx] = assessment;
  } else {
    db.assessments.unshift(assessment);
  }
  saveDbData(db);
  res.json({ success: true, assessments: db.assessments });
});

// 7. API: Add question to bank
app.post('/api/data/questions', (req, res) => {
  const { question } = req.body || {};
  if (!question?.id) return res.status(400).json({ success: false, error: 'Missing question' });
  const db = getDbData();
  const idx = db.questionBank.findIndex((q: any) => q.id === question.id);
  if (idx >= 0) {
    db.questionBank[idx] = question;
  } else {
    db.questionBank.unshift(question);
  }
  saveDbData(db);
  res.json({ success: true, questionBank: db.questionBank });
});

// 8. API: Save/update submission
app.post('/api/data/submissions', (req, res) => {
  const { submission } = req.body || {};
  if (!submission?.id) return res.status(400).json({ success: false, error: 'Missing submission' });
  const db = getDbData();
  const idx = db.submissions.findIndex((s: any) => s.id === submission.id);
  if (idx >= 0) {
    db.submissions[idx] = submission;
  } else {
    db.submissions.unshift(submission);
  }
  saveDbData(db);
  res.json({ success: true, submissions: db.submissions });
});

// 8b. API: Delete submission
app.delete('/api/data/submissions/:id', (req, res) => {
  const { id } = req.params;
  const db = getDbData();
  db.submissions = db.submissions.filter((s: any) => s.id !== id);
  saveDbData(db);
  res.json({ success: true, submissions: db.submissions });
});

// 9. API: Update professor profile
app.post('/api/data/professors', (req, res) => {
  const { professor } = req.body || {};
  if (!professor?.id) return res.status(400).json({ success: false, error: 'Missing professor' });
  const db = getDbData();
  const idx = db.professors.findIndex((p: any) => p.id === professor.id);
  if (idx >= 0) {
    db.professors[idx] = professor;
  } else {
    db.professors.push(professor);
  }
  saveDbData(db);
  res.json({ success: true, professors: db.professors });
});

// 10. API: Save/update invitation
app.post('/api/data/invitations', (req, res) => {
  const { invitation } = req.body || {};
  if (!invitation?.id) return res.status(400).json({ success: false, error: 'Missing invitation' });
  const db = getDbData();
  const idx = db.invitations.findIndex((i: any) => i.id === invitation.id);
  if (idx >= 0) {
    db.invitations[idx] = invitation;
  } else {
    db.invitations.unshift(invitation);
  }
  saveDbData(db);
  res.json({ success: true, invitations: db.invitations });
});

// 11. API: Save/update user account
app.post('/api/data/accounts', (req, res) => {
  const { account } = req.body || {};
  if (!account?.id || typeof account.email !== 'string') return res.status(400).json({ success: false, error: 'Missing account' });
  const db = getDbData();
  // An email address belongs to exactly one account: never let a new account overwrite another one
  const emailOwner = db.userAccounts.find((a: any) => a.email?.toLowerCase() === account.email.toLowerCase());
  if (emailOwner && emailOwner.id !== account.id) {
    return res.status(409).json({ success: false, error: 'An account with this email already exists' });
  }
  const idx = db.userAccounts.findIndex((a: any) => a.id === account.id);
  if (idx >= 0) {
    db.userAccounts[idx] = account;
  } else {
    db.userAccounts.push(account);
  }
  saveDbData(db);
  res.json({ success: true, userAccounts: db.userAccounts });
});

// 12. API: Reset database back to initial mock data
app.post('/api/data/reset', (req, res) => {
  const defaultData = getDefaultData();
  saveDbData(defaultData);
  res.json({ success: true, ...defaultData });
});

// Vite middleware setup for full-stack SPA serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 4 wildcard ('*all' is Express 5 syntax and would only match paths ending in "all")
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sifted server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
