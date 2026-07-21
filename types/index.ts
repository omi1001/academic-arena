import { Subject, ClassOption } from '../constants/config';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  class: ClassOption | null;
  totalEXP: number;
  rank: number;
  gamesPlayed: number;
  questionsAnswered: number;
  correctAnswers: number;
  createdAt: number;
  lastActiveAt: number;
}

export interface Question {
  _id: string;
  class: number;
  subject: string;
  question: string;
  options: string[];
  answer: number;
  difficulty: number;
  explanation?: string;
}

export interface GameRun {
  id: string;
  userId: string;
  class: ClassOption;
  subject: Subject;
  score: number;
  expEarned: number;
  questionsAnswered: number;
  correctAnswers: number;
  maxStreak: number;
  highestDifficulty: number;
  heartsRemaining: number;
  startTime: number;
  endTime: number | null;
  status: 'active' | 'completed' | 'cheat_detected' | 'timeout';
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  totalEXP: number;
  tier: string;
}

export interface GameState {
  currentQuestion: Question | null;
  questionIndex: number;
  hearts: number;
  score: number;
  expEarned: number;
  currentDifficulty: number;
  streak: number;
  maxStreak: number;
  isGameActive: boolean;
  runId: string | null;
  selectedClass: ClassOption | null;
  selectedSubject: Subject | null;
  questions: Question[];
  answeredQuestionIds: string[];
  startTime: number;
  lastAnswerTime: number | null;
}
