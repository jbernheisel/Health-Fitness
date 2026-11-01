import type { DayLog, Product, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  age: 48,
  heightIn: 69,
  startWeight: 195,
  goalWeight: 175,
  activityLevel: 'Sedentary',
  baselineSteps: 3000,
  calMin: 1700,
  calMax: 1800,
  proteinGoal: 120,
  waterGoalOz: 64,
  programStart: '2026-11-02',
  programEnd: '2026-12-31',
  timeZone: 'America/Los_Angeles',
  stepTargets: [
    { fromWeek: 1, toWeek: 1, target: 3500 },
    { fromWeek: 2, toWeek: 2, target: 4000 },
    { fromWeek: 3, toWeek: 3, target: 4500 },
    { fromWeek: 4, toWeek: 4, target: 5000 },
    { fromWeek: 5, toWeek: 6, target: 5500 },
    { fromWeek: 7, toWeek: 9, target: 6000 },
  ],
  //            Sun     Mon         Tue     Wed         Thu     Fri         Sat
  weeklyPlan: ['walk', 'strength', 'walk', 'strength', 'walk', 'strength', 'walk'],
  exercises: ['Goblet squats', 'Kettlebell deadlifts', 'Single-arm rows', 'Dumbbell floor presses', 'Farmer carries'],
  defaultSets: 2,
  prescribedDoseMg: null,
  medicationName: 'Oral Wegovy',
  trackBP: true,
  theme: 'system',
  lastBackupAt: null,
};

// Nutrition values as supplied from packaging. null = not verified; the user fills it in.
export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'huel-black-choc', name: 'Huel Black Chocolate', detail: '1 bottle', calories: 390, protein: 35, fiber: 7, kind: 'drink', builtIn: true, order: 0 },
  { id: 'oikos-vanilla', name: 'Oikos Vanilla Shake', detail: '1 bottle', calories: 170, protein: 30, fiber: 5, kind: 'drink', builtIn: true, order: 1 },
  { id: 'chobani-berry', name: 'Chobani Mixed Berry Vanilla', detail: 'Greek yogurt drink, 1 bottle', calories: 170, protein: 20, fiber: null, kind: 'drink', builtIn: true, order: 2 },
  { id: 'tillamook-jerky', name: 'Tillamook Zero Sugar Jerky', detail: 'Original beef', calories: null, protein: 13, fiber: null, kind: 'food', builtIn: true, order: 3, note: '13g protein as advertised. Confirm serving size and calories from your package.' },
  { id: 'monster-ultra', name: 'Monster Zero Ultra', detail: 'Optional', calories: null, protein: null, fiber: null, kind: 'drink', builtIn: true, order: 4, note: 'No nutrition or caffeine figures assigned. Add them from the can if you want them counted.' },
];

export function emptyDay(date: string): DayLog {
  return {
    date,
    steps: null,
    waterOz: null,
    weight: null,
    bpSys: null,
    bpDia: null,
    restingHR: null,
    appetite: null,
    hoursFasted: null,
    med: { taken: false, doseMg: null, time: null, takenAt: null, timerDismissed: false, notes: '' },
    symptoms: {},
    otherSymptom: '',
    otherSeverity: null,
    symptomsChecked: false,
    workout: { planOverride: null, completed: false, durationMin: null, walkMinutes: null, exercises: [], notes: '' },
    checks: {},
    notes: '',
    updatedAt: new Date(0).toISOString(),
  };
}

/** Reference only. Never applied automatically. */
export const TITRATION_REFERENCE = [
  { label: 'Days 1–30', dose: '1.5 mg daily' },
  { label: 'Days 31–60', dose: '4 mg daily' },
  { label: 'Days 61–90', dose: '9 mg daily' },
  { label: 'Day 91 onward', dose: '25 mg daily (maintenance)' },
];
