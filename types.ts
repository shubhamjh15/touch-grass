export enum Page {
  HOME = 'HOME',
  DASHBOARD = 'DASHBOARD',
  TRACKER = 'TRACKER',
  EDUCATION = 'EDUCATION',
  COMMUNITY = 'COMMUNITY',
  ASSISTANT = 'ASSISTANT',
  MISSIONS = 'MISSIONS'
}

export interface UserStats {
  xp: number;
  level: number;
  co2Saved: number; // in kg
  streak: number;
  badges: string[];
}

export interface ActionLog {
  id: string;
  type: string;
  co2Impact: number;
  xpReward: number;
  date: string;
  icon: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardXP: number;
  completed: boolean;
  type: 'daily' | 'weekly';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface EducationModule {
  id: string;
  title: string;
  description: string;
  readTime: string;
  category: 'Climate' | 'Waste' | 'Energy';
  completed: boolean;
  content: string;
}