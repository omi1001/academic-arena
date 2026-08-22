import { Subject, ClassOption } from '../constants/config';

export interface User {
  uid: string;
  email: string;
  name: string;
  username?: string;
  arenaTag?: string;
  class: ClassOption | null;
  totalEXP: number;
  gamesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  highestStreak: number;
  highestDifficulty: number;
  challengeWins?: number;
  challengeLosses?: number;
  challengeGamesPlayed?: number;
  highestChallengeDifficulty?: number;
  role?: 'user' | 'admin';
  upiId?: string;
  badges?: string[];
  activeBorder?: 'default' | 'glowing_gold' | 'neon_cyan' | 'fire_ring';
  avatar?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
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
  packet?: number;
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
  displayName?: string;
  name?: string;
  totalEXP: number;
  exp?: number;
  tier?: string;
  challengeWins?: number;
  challengeLosses?: number;
  challengeGamesPlayed?: number;
  highestChallengeDifficulty?: number;
  activeBorder?: 'default' | 'glowing_gold' | 'neon_cyan' | 'fire_ring';
  badges?: string[];
  avatar?: string;
}

export interface GameState {
  currentQuestion: Question | null;
  questionIndex: number;
  totalQuestionsAnswered: number;
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
  selectedPacket?: number | null;
  questions: Question[];
  answeredQuestionIds: string[];
  startTime: number;
  lastAnswerTime: number | null;
}

export interface Friend {
  uid: string;
  name: string;
  username: string;
  arenaTag: string;
  class: number;
  totalEXP: number;
  avatar: string;
  status?: 'online' | 'in_game' | 'offline';
  addedAt?: number;
}

export interface TauntItem {
  id: string;
  type: 'emoji' | 'text';
  content: string;
  label?: string;
}

export interface FriendlyRoom {
  roomCode: string;
  hostUid: string;
  hostName: string;
  hostAvatar: string;
  hostTag: string;
  guestUid?: string;
  guestName?: string;
  guestAvatar?: string;
  guestTag?: string;
  classNum: number;
  subject: string;
  status: 'waiting' | 'starting' | 'in_progress' | 'completed';
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderUsername: string;
  senderTag: string;
  senderAvatar: string;
  senderClass: number;
  senderExp: number;
  recipientUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}
