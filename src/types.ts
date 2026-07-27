export type QuestionType =
  | 'multiple-choice'
  | 'short-answer'
  | 'long-form-essay'
  | 'math'
  | 'programming'
  | 'research';

export type DifficultyLevel =
  | 'Basic'
  | 'Intermediate'
  | 'Advanced'
  | 'Research-Level';

export type TopicCategory =
  | 'Machine Learning'
  | 'Algorithms'
  | 'Statistics & Prob'
  | 'Linear Algebra'
  | 'Research Methods'
  | 'Systems & Math';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  prompt: string;
  difficulty: DifficultyLevel;
  difficultyWeight?: number; // e.g. 1.0 (Basic), 1.5 (Intermediate), 2.0 (Advanced), 3.0 (Research-Level)
  topic: TopicCategory;
  points: number;
  isPublic?: boolean; // Defaults to true if undefined. If false, question is private to professorId
  professorId?: string; // ID of the professor who authored this question
  // Multiple Choice
  options?: string[];
  correctAnswers?: string[];
  randomizeOptions?: boolean;
  // Short Answer & Essay
  rubric?: string;
  sampleAnswer?: string;
  // Math & LaTeX
  latexFormula?: string;
  symbolicAnswer?: string;
  numericalTolerance?: number;
  // Programming
  language?: 'Python' | 'Java' | 'C++' | 'JavaScript' | 'R' | 'MATLAB';
  codeTemplate?: string;
  testCases?: TestCase[];
  // Research
  paperExcerpt?: string;
  chartType?: 'bar' | 'line' | 'scatter' | 'none';
  chartData?: Array<{ x: string | number; y: number; y2?: number; label?: string }>;
  researchContext?: string;
}

export interface IntegrityOptions {
  fullScreenMode: boolean;
  tabSwitchDetection: boolean;
  webcamMonitoring: boolean;
  copyPasteDetection: boolean;
  aiAnswerDetection: boolean;
  randomizeQuestionOrder: boolean;
  randomizeAnswerOrder: boolean;
}

export interface Assessment {
  id: string;
  professorId: string;
  title: string;
  description: string;
  researchGroup: string;
  semester: string;
  timeLimitMinutes: number;
  isAdaptive: boolean;
  isScoreVisible: boolean;
  integrityOptions: IntegrityOptions;
  questionIds: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isPublished?: boolean;
  status?: 'Published' | 'Draft';
}

export type InterviewRecommendation =
  | 'Strongly Recommend Interview'
  | 'Recommend Interview'
  | 'Borderline'
  | 'Do Not Recommend';

export type HireabilityLevel =
  | 'Tier 1: Direct Admit / Top Fellow'
  | 'Tier 2: Strong Interview Contender'
  | 'Tier 3: Conditional / Needs Review'
  | 'Tier 4: Does Not Meet Technical Bar';

export type ProfessorDecision =
  | 'Pending'
  | 'Interview'
  | 'Reject'
  | 'Pending Professor Interview'
  | 'Pending Professor Interview / Review'
  | 'Hold for Review'; // keeping Hold for Review as fallback compatibility

export interface QuestionResponseItem {
  questionId: string;
  answer: any; // string, string[], or code string
  timeSpentSeconds: number;
  aiScore: number;
  maxScore: number;
  difficultyWeight?: number; // difficulty weight (1.0x to 3.0x)
  weightedScore?: number; // aiScore * difficultyWeight
  maxWeightedScore?: number; // maxScore * difficultyWeight
  aiConfidence: number; // 0 to 100 percentage
  aiFeedback: string;
  isCorrect?: boolean;
  manualScore?: number;
  professorOverride?: boolean;
}

export interface IntegrityReport {
  tabSwitchCount: number;
  copyPasteAttempts: number;
  aiGeneratedProbability: number; // 0 to 100 percentage
  integrityFlagged: boolean;
  notes: string[];
}

export interface ApplicantSubmission {
  id: string;
  assessmentId: string;
  applicantName: string;
  applicantEmail: string;
  secondaryEmail?: string;
  university: string;
  degreeProgram: string;
  gpa?: string;
  status: 'invited' | 'in-progress' | 'completed' | 'reviewed';
  startTime?: string;
  finishTime?: string;
  totalTimeSpentSeconds: number;
  responses: Record<string, QuestionResponseItem>;
  overallScore: number; // percentage 0-100
  totalWeightedScore?: number;
  maxTotalWeightedScore?: number;
  hireabilityLevel?: HireabilityLevel;
  topicBreakdown: Record<TopicCategory, { scored: number; total: number; percentage: number }>;
  timeAnalysis: Record<string, number>; // questionId -> seconds
  confidenceScore: number;
  interviewRecommendation: InterviewRecommendation;
  recommendationExplanation: string;
  aiSummary: string;
  integrityReport: IntegrityReport;
  professorNotes: string;
  professorDecision: ProfessorDecision;
  interviewDate?: string;
  interviewTime?: string;
  meetingLink?: string;
  meetingConfirmed?: boolean;
  applicantResponseToInterview?: 'Accepted' | 'Declined' | 'Pending';
}

export interface ProfessorProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  labName: string;
  avatar: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  secondaryEmail?: string;
  isVerified?: boolean;
  role: 'professor' | 'applicant' | 'admin';
  professorId?: string;
  avatar?: string;
  department?: string;
  labName?: string;
  university?: string;
  degreeProgram?: string;
  adminTitle?: string;
}

export interface AssessmentInvitation {
  id: string;
  assessmentId: string;
  professorId: string;
  applicantEmail: string;
  applicantName?: string;
  assignedAt: string;
  startedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'reviewed';
  notes?: string;
  deadline?: string;
}

export type ActiveRole = 'professor' | 'applicant-portal' | 'admin-portal' | 'landing';


