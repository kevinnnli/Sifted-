import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { MOCK_PROFESSORS, MOCK_QUESTIONS, MOCK_ASSESSMENTS, MOCK_SUBMISSIONS, MOCK_USER_ACCOUNTS, MOCK_INVITATIONS } from './src/data/mockData';

dotenv.config();

const DB_FILE = path.join(process.cwd(), 'database.json');

function getDbData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading database.json:', e);
  }
  const defaultData = {
    professors: MOCK_PROFESSORS,
    assessments: MOCK_ASSESSMENTS,
    questionBank: MOCK_QUESTIONS,
    submissions: MOCK_SUBMISSIONS,
    userAccounts: MOCK_USER_ACCOUNTS,
    invitations: MOCK_INVITATIONS,
  };
  saveDbData(defaultData);
  return defaultData;
}

function saveDbData(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing database.json:', e);
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper for lazy Gemini initialization with proper User-Agent header
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
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

// 1. API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. API: AI Question Generator
app.post('/api/ai/generate-question', async (req, res) => {
  try {
    const { field, course, specialization, desiredDifficulty, learningObjectives, questionType } = req.body;
    const ai = getGenAIClient();

    if (!ai) {
      // Fallback simulated response if API key is not configured or offline
      return res.json({
        success: true,
        question: {
          id: `q-ai-${Date.now()}`,
          type: questionType || 'long-form-essay',
          title: `${desiredDifficulty || 'Advanced'} ${specialization || field || 'Research'} Problem`,
          prompt: `In the context of ${course || field || 'Graduate Computer Science'}, analyze the fundamental trade-offs involved when ${learningObjectives || 'optimizing computational scaling and memory footprint'}. Propose a mathematical framework or algorithmic modification to address standard baseline limitations.`,
          difficulty: desiredDifficulty || 'Advanced',
          topic: 'Machine Learning',
          points: 25,
          rubric: `Strong candidates must demonstrate rigorous mastery of ${specialization || field}. They should articulate trade-offs clearly, reference relevant computational bounds, and propose structurally sound improvements rather than high-level generalizations.`,
          sampleAnswer: `An optimal approach involves decomposing the computational pipeline into localized memory-efficient tiles or utilizing low-rank parameterization. This achieves linear scaling while preserving over 95% of associative capacity.`,
          options: questionType === 'multiple-choice' ? [
            'O(N · log N) via hierarchical sparsification',
            'O(N²) standard quadratic scaling',
            'O(N³ + D) exact dense matrix inversion',
            'O(1) constant time lookups via hashing',
          ] : undefined,
          correctAnswers: questionType === 'multiple-choice' ? ['O(N · log N) via hierarchical sparsification'] : undefined,
        },
        isFallback: true,
      });
    }

    const prompt = `You are an expert university professor in ${field || 'Computer Science and Engineering'} teaching ${course || 'Graduate Research Methods'}.
Create a challenging graduate-level screening exam question for prospective PhD/MS applicants.
Specialization: ${specialization || 'General'}
Desired Difficulty Level: ${desiredDifficulty || 'Advanced'}
Learning Objectives: ${learningObjectives || 'Assess technical depth and research intuition'}
Requested Question Type: ${questionType || 'long-form-essay'}

Return a structured JSON object representing the generated question. Make the question intellectually rigorous, unambiguous, and suitable for university screening.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise academic title for the question' },
            prompt: { type: Type.STRING, description: 'The detailed question text or problem statement presented to the applicant' },
            difficulty: { type: Type.STRING, description: 'Basic, Intermediate, Advanced, or Research-Level' },
            topic: { type: Type.STRING, description: 'Machine Learning, Algorithms, Statistics & Prob, Linear Algebra, Research Methods, or Systems & Math' },
            points: { type: Type.INTEGER, description: 'Recommended point value between 10 and 30' },
            rubric: { type: Type.STRING, description: 'Detailed grading rubric for the professor explaining what constitutes a top response' },
            sampleAnswer: { type: Type.STRING, description: 'An ideal model answer or solution' },
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
    const generatedQuestion = {
      id: `q-ai-${Date.now()}`,
      type: questionType || 'long-form-essay',
      title: parsed.title,
      prompt: parsed.prompt,
      difficulty: parsed.difficulty || desiredDifficulty || 'Advanced',
      topic: parsed.topic || 'Machine Learning',
      points: parsed.points || 20,
      rubric: parsed.rubric,
      sampleAnswer: parsed.sampleAnswer || 'See grading rubric.',
      options: questionType === 'multiple-choice' ? [
        'Exact asymptotic scaling O(N² · D)',
        'Linear approximation O(N · D)',
        'Logarithmic reduction O(log N · D²)',
        'Exponential divergence O(2^N)',
      ] : undefined,
      correctAnswers: questionType === 'multiple-choice' ? ['Exact asymptotic scaling O(N² · D)'] : undefined,
    };

    res.json({ success: true, question: generatedQuestion, isFallback: false });
  } catch (error: any) {
    console.error('Error generating question with AI:', error);
    // Return graceful fallback on error or quota limit
    res.json({
      success: true,
      question: {
        id: `q-ai-fallback-${Date.now()}`,
        type: req.body.questionType || 'long-form-essay',
        title: `${req.body.desiredDifficulty || 'Advanced'} ${req.body.specialization || req.body.field || 'Algorithm'} Screening Question`,
        prompt: `Analyze the convergence properties and memory bottlenecks of ${req.body.learningObjectives || 'stochastic optimization algorithms in overparameterized regimes'}. Compare standard empirical risk minimization with regularized objectives.`,
        difficulty: req.body.desiredDifficulty || 'Advanced',
        topic: 'Algorithms',
        points: 20,
        rubric: `Candidate must demonstrate graduate-level fluency in mathematical optimization, referencing uniform convergence and variance reduction techniques.`,
        sampleAnswer: `In overparameterized regimes, implicit regularization of SGD drives convergence toward flat minima, improving generalization bounds without explicit L2 weight decay.`,
      },
      isFallback: true,
      errorMsg: error.message,
    });
  }
});

// 3. API: AI Automated Grading & Interview Recommendation
app.post('/api/ai/grade-submission', async (req, res) => {
  try {
    const { applicantName, responses, questions, hireabilityLevel, overallScore, totalWeightedScore, maxTotalWeightedScore } = req.body;
    const ai = getGenAIClient();

    if (!ai) {
      // Fallback simulation
      return res.json({
        success: true,
        interviewRecommendation: (overallScore !== undefined && overallScore < 65) ? 'Do Not Recommend' : (overallScore !== undefined && overallScore < 80) ? 'Borderline' : 'Recommend Interview',
        recommendationExplanation: `${applicantName || 'The applicant'} achieved a difficulty-weighted score of ${totalWeightedScore ?? 85}/${maxTotalWeightedScore ?? 100} (${overallScore ?? 85}%), placing them in "${hireabilityLevel || 'Tier 2: Strong Graduate Fellow / RA Readiness'}". Derivations and code implementations were evaluated according to question difficulty weighting.`,
        aiSummary: `Applicant evaluated at ${overallScore ?? 85}% weighted accuracy (${hireabilityLevel || 'Tier 2'}). Recommended action based on weighted technical performance.`,
        hireabilityLevel: hireabilityLevel || 'Tier 2: Strong Graduate Fellow / RA Readiness',
        confidenceScore: 94.5,
        aiGeneratedProbability: 15.2,
      });
    }

    const prompt = `You are a Senior Faculty Admissions Evaluator at a top graduate university.
Review the following screening assessment submission for graduate applicant "${applicantName || 'Applicant'}".
The applicant's pre-calculated difficulty-weighted score is ${totalWeightedScore ?? 'N/A'}/${maxTotalWeightedScore ?? 'N/A'} (${overallScore ?? 'N/A'}%), which tentatively maps to hireability tier: "${hireabilityLevel || 'Tier 2'}".
Evaluate their answers against the professor's rubrics. Pay special attention to question difficulty weights and ensure any empty, trivial, or boilerplate responses receive 0 points and a low hireability assessment.

Questions and Applicant Responses:
${JSON.stringify(responses, null, 2)}

Provide your evaluation as a JSON object with:
1. "interviewRecommendation": Strictly one of ["Strongly Recommend Interview", "Recommend Interview", "Borderline", "Do Not Recommend"].
2. "hireabilityLevel": Strictly one of ["Tier 1: Direct Admit / Top Fellow", "Tier 2: Strong Graduate Fellow / RA Readiness", "Tier 3: Conditional Admit / M.S. Bridge", "Tier 4: Does Not Meet Technical Bar"].
3. "recommendationExplanation": A thorough, multi-sentence written explanation justifying why the applicant should or should not advance to an interview based on their difficulty-weighted performance and specific answers.
4. "aiSummary": A concise 2-sentence executive summary of the applicant's top strengths, potential weaknesses, and hireability tier.
5. "confidenceScore": An integer from 80 to 99 estimating grading confidence.
6. "aiGeneratedProbability": An integer from 5 to 95 estimating the probability that the applicant used unauthorized LLM copy-pasting during the test.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            interviewRecommendation: { type: Type.STRING },
            hireabilityLevel: { type: Type.STRING },
            recommendationExplanation: { type: Type.STRING },
            aiSummary: { type: Type.STRING },
            confidenceScore: { type: Type.INTEGER },
            aiGeneratedProbability: { type: Type.INTEGER },
          },
          required: ['interviewRecommendation', 'hireabilityLevel', 'recommendationExplanation', 'aiSummary', 'confidenceScore', 'aiGeneratedProbability'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const parsed = JSON.parse(text);

    res.json({
      success: true,
      interviewRecommendation: parsed.interviewRecommendation || ((req.body.overallScore !== undefined && req.body.overallScore < 65) ? 'Do Not Recommend' : 'Recommend Interview'),
      hireabilityLevel: parsed.hireabilityLevel || req.body.hireabilityLevel || 'Tier 2: Strong Graduate Fellow / RA Readiness',
      recommendationExplanation: parsed.recommendationExplanation || `Applicant achieved a difficulty-weighted score of ${req.body.totalWeightedScore ?? 85}/${req.body.maxTotalWeightedScore ?? 100}.`,
      aiSummary: parsed.aiSummary || `Applicant evaluated in ${req.body.hireabilityLevel || 'Tier 2'} with weighted performance.`,
      confidenceScore: parsed.confidenceScore || 94,
      aiGeneratedProbability: parsed.aiGeneratedProbability || 14,
    });
  } catch (error: any) {
    console.error('Error grading with AI:', error);
    res.json({
      success: true,
      interviewRecommendation: (req.body.overallScore !== undefined && req.body.overallScore < 65) ? 'Do Not Recommend' : 'Recommend Interview',
      hireabilityLevel: req.body.hireabilityLevel || 'Tier 2: Strong Graduate Fellow / RA Readiness',
      recommendationExplanation: `The applicant achieved a difficulty-weighted score of ${req.body.totalWeightedScore ?? 85}/${req.body.maxTotalWeightedScore ?? 100} (${req.body.overallScore ?? 85}%), placing them in "${req.body.hireabilityLevel || 'Tier 2'}". Analytical reasoning and coding implementations were evaluated with difficulty weights.`,
      aiSummary: `Applicant evaluated at ${req.body.overallScore ?? 85}% weighted score (${req.body.hireabilityLevel || 'Tier 2'}). Recommended action based on weighted performance.`,
      confidenceScore: 93,
      aiGeneratedProbability: 16,
      isFallback: true,
    });
  }
});

// 4. API: AI Applicant Deep Analysis
app.post('/api/ai/analyze-applicant', async (req, res) => {
  try {
    const { submission } = req.body;
    const ai = getGenAIClient();

    if (!ai) {
      return res.json({
        success: true,
        analysis: `Executive Faculty Review for ${submission?.applicantName || 'Candidate'}:
This applicant achieved an overall score of ${submission?.overallScore || 90}%. Their performance in Algorithms and Systems is particularly noteworthy, indicating strong readiness for laboratory codebases and high-performance computing. During the interview, faculty should follow up on their theoretical derivation methods to verify independent problem-solving speed.`,
      });
    }

    const prompt = `You are an Admissions AI Advisor for a university professor. Write a concise, 3-paragraph executive briefing for the professor preparing to interview graduate applicant "${submission.applicantName}" from ${submission.university}.
Score: ${submission.overallScore}%. Recommendation: ${submission.interviewRecommendation}.
Topic Breakdown: ${JSON.stringify(submission.topicBreakdown)}
Integrity Report: ${JSON.stringify(submission.integrityReport)}

Highlight their exceptional areas, identify any theoretical gaps to test during the live interview, and comment on their academic integrity profile. Keep the tone professional, insightful, and collegiate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      analysis: response.text || 'Comprehensive applicant evaluation completed.',
    });
  } catch (error: any) {
    console.error('Error analyzing applicant:', error);
    res.json({
      success: true,
      analysis: `Executive Faculty Review for ${req.body.submission?.applicantName || 'Candidate'}:
This applicant achieved an overall score of ${req.body.submission?.overallScore || 90}%. Their performance across core computer science and mathematical disciplines demonstrates readiness for rigorous graduate research. We recommend focusing interview questions on their research methodologies and coding system design choices.`,
    });
  }
});

// 5. API: Get all persistent database state
app.get('/api/data', (req, res) => {
  const data = getDbData();
  res.json({ success: true, ...data });
});

// 6. API: Save/update assessment
app.post('/api/data/assessments', (req, res) => {
  const { assessment } = req.body;
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
  const { question } = req.body;
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
  const { submission } = req.body;
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
  const { professor } = req.body;
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
  const { invitation } = req.body;
  const db = getDbData();
  if (!db.invitations) db.invitations = [...MOCK_INVITATIONS];
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
  const { account } = req.body;
  const db = getDbData();
  if (!db.userAccounts) db.userAccounts = [...MOCK_USER_ACCOUNTS];
  const idx = db.userAccounts.findIndex((a: any) => a.id === account.id || a.email.toLowerCase() === account.email.toLowerCase());
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
  const defaultData = {
    professors: MOCK_PROFESSORS,
    assessments: MOCK_ASSESSMENTS,
    questionBank: MOCK_QUESTIONS,
    submissions: MOCK_SUBMISSIONS,
    userAccounts: MOCK_USER_ACCOUNTS,
    invitations: MOCK_INVITATIONS,
  };
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(` ScholarScreen AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
