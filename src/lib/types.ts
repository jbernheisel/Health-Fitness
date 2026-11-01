export type ISODate = string; // 'YYYY-MM-DD' in the user's configured time zone

export type DayPlan = 'strength' | 'walk' | 'recovery' | 'rest';

export interface StepTarget { fromWeek: number; toWeek: number; target: number }

export interface Settings {
  age: number | null;
  heightIn: number | null;
  startWeight: number | null;
  goalWeight: number | null;
  activityLevel: string;
  baselineSteps: number | null;
  calMin: number | null;
  calMax: number | null;
  proteinGoal: number | null;
  waterGoalOz: number | null;
  programStart: ISODate;
  programEnd: ISODate;
  timeZone: string;
  stepTargets: StepTarget[];
  /** index 0 = Sunday ... 6 = Saturday */
  weeklyPlan: DayPlan[];
  exercises: string[];
  defaultSets: number;
  prescribedDoseMg: number | null;
  medicationName: string;
  trackBP: boolean;
  theme: 'system' | 'light' | 'dark';
  lastBackupAt: string | null;
}

export interface Product {
  id: string;
  name: string;
  detail?: string;
  calories: number | null;
  protein: number | null;
  fiber: number | null;
  kind: 'food' | 'drink';
  /** Shown as a gentle note, e.g. "Confirm serving size and calories from package" */
  note?: string;
  builtIn?: boolean;
  hidden?: boolean;
  order: number;
}

export interface FoodEntry {
  id: string;
  date: ISODate;
  name: string;
  calories: number | null;
  protein: number | null;
  fiber: number | null;
  kind: 'food' | 'drink';
  productId?: string;
  createdAt: string;
}

export interface SetLog { reps: number | null; weight: number | null; done: boolean }
export interface ExerciseLog { name: string; sets: SetLog[] }

export interface WorkoutLog {
  /** null = follow weekly plan */
  planOverride: DayPlan | null;
  completed: boolean;
  durationMin: number | null;
  walkMinutes: number | null;
  exercises: ExerciseLog[];
  notes: string;
}

export const SYMPTOMS = ['nausea', 'constipation', 'diarrhea', 'bloating', 'reflux', 'dizziness', 'fatigue'] as const;
export type SymptomKey = (typeof SYMPTOMS)[number];

export interface MedLog {
  taken: boolean;
  doseMg: number | null;
  time: string | null; // 'HH:MM' local
  takenAt: string | null; // ISO timestamp, drives the wait timer
  timerDismissed: boolean;
  notes: string;
}

export type CheckKey = 'med' | 'protein' | 'calories' | 'steps' | 'workout' | 'water' | 'symptoms' | 'bp';

export interface DayLog {
  date: ISODate;
  steps: number | null;
  waterOz: number | null;
  weight: number | null;
  bpSys: number | null;
  bpDia: number | null;
  restingHR: number | null;
  appetite: number | null;
  hoursFasted: number | null;
  med: MedLog;
  symptoms: Partial<Record<SymptomKey, number | null>>;
  otherSymptom: string;
  otherSeverity: number | null;
  symptomsChecked: boolean;
  workout: WorkoutLog;
  /** Manual overrides of the auto-detected checklist state */
  checks: Partial<Record<CheckKey, boolean>>;
  notes: string;
  updatedAt: string;
}

export interface BackupFile {
  app: 'momentum';
  version: 1;
  exportedAt: string;
  settings: Settings;
  products: Product[];
  days: DayLog[];
  foods: FoodEntry[];
}
