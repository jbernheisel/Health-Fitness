import { addDays, diffDays, rangeDates, weekday } from './dates';
import type { CheckKey, DayLog, DayPlan, FoodEntry, Settings } from './types';
import { SYMPTOMS } from './types';

export function programLength(s: Settings) {
  return Math.max(1, diffDays(s.programStart, s.programEnd) + 1);
}

/** 1-based program day, may be <1 (before start) or > length (after end). */
export function programDay(s: Settings, date: string) {
  return diffDays(s.programStart, date) + 1;
}

export function programWeek(s: Settings, date: string) {
  const d = programDay(s, date);
  return d < 1 ? 0 : Math.floor((d - 1) / 7) + 1;
}

export function stepTargetFor(s: Settings, date: string): number | null {
  const w = programWeek(s, date);
  if (w < 1) return null;
  const hit = s.stepTargets.find((t) => w >= t.fromWeek && w <= t.toWeek);
  if (hit) return hit.target;
  const last = [...s.stepTargets].sort((a, b) => b.toWeek - a.toWeek)[0];
  return last && w > last.toWeek ? last.target : null;
}

export function planFor(s: Settings, day: DayLog): DayPlan {
  return day.workout.planOverride ?? s.weeklyPlan[weekday(day.date)] ?? 'walk';
}

export interface Totals {
  calories: number;
  protein: number;
  fiber: number;
  count: number;
  missingCalories: number;
  missingProtein: number;
}

export function foodsFor(foods: FoodEntry[], date: string) {
  return foods.filter((f) => f.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function totalsFor(foods: FoodEntry[], date: string): Totals {
  const list = foodsFor(foods, date);
  const t: Totals = { calories: 0, protein: 0, fiber: 0, count: list.length, missingCalories: 0, missingProtein: 0 };
  for (const f of list) {
    if (f.calories == null) t.missingCalories++; else t.calories += f.calories;
    if (f.protein == null) t.missingProtein++; else t.protein += f.protein;
    if (f.fiber != null) t.fiber += f.fiber;
  }
  return t;
}

/** Checklist state: an explicit tap wins, otherwise it's inferred from what's been logged. */
export function autoChecks(s: Settings, day: DayLog, totals: Totals): Record<CheckKey, boolean> {
  const plan = planFor(s, day);
  const workoutDone =
    day.workout.completed ||
    (day.workout.walkMinutes ?? 0) > 0 ||
    (plan === 'strength' && day.workout.exercises.some((e) => e.sets.some((x) => x.done)));
  return {
    med: day.med.taken,
    protein: s.proteinGoal != null && totals.protein >= s.proteinGoal,
    calories: totals.count > 0,
    steps: day.steps != null,
    workout: workoutDone,
    water: day.waterOz != null && day.waterOz > 0,
    symptoms: day.symptomsChecked,
    bp: day.bpSys != null && day.bpDia != null,
  };
}

export function checks(s: Settings, day: DayLog, totals: Totals): Record<CheckKey, boolean> {
  const auto = autoChecks(s, day, totals);
  const out = { ...auto };
  for (const k of Object.keys(day.checks) as CheckKey[]) {
    const v = day.checks[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function symptomScore(day: DayLog): number | null {
  if (!day.symptomsChecked && Object.values(day.symptoms).every((v) => v == null) && day.otherSeverity == null) return null;
  let total = 0;
  for (const k of SYMPTOMS) total += day.symptoms[k] ?? 0;
  total += day.otherSeverity ?? 0;
  return total;
}

// ---------- series & averages: missing values stay missing ----------

export type Point = { date: string; value: number | null };

export function mean(vals: (number | null | undefined)[]): number | null {
  const v = vals.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export interface Metrics {
  date: string;
  weight: number | null;
  calories: number | null; // null when nothing logged
  protein: number | null;
  steps: number | null;
  water: number | null;
  bpSys: number | null;
  bpDia: number | null;
  hr: number | null;
  symptoms: number | null;
  medTaken: boolean;
  medLogged: boolean;
  plan: DayPlan;
  workoutDone: boolean;
  appetite: number | null;
}

export function metricsFor(s: Settings, days: Record<string, DayLog>, foods: FoodEntry[], dates: string[]): Metrics[] {
  const byDate = new Map<string, FoodEntry[]>();
  for (const f of foods) {
    const arr = byDate.get(f.date);
    if (arr) arr.push(f); else byDate.set(f.date, [f]);
  }
  return dates.map((date) => {
    const d = days[date];
    const list = byDate.get(date) ?? [];
    const cal = list.filter((f) => f.calories != null);
    const pro = list.filter((f) => f.protein != null);
    const plan = d ? planFor(s, d) : s.weeklyPlan[weekday(date)] ?? 'walk';
    let workoutDone = false;
    if (d) {
      const t = totalsFor(list, date);
      workoutDone = checks(s, d, t).workout;
    }
    return {
      date,
      weight: d?.weight ?? null,
      calories: cal.length ? cal.reduce((a, f) => a + (f.calories ?? 0), 0) : null,
      protein: pro.length ? pro.reduce((a, f) => a + (f.protein ?? 0), 0) : null,
      steps: d?.steps ?? null,
      water: d?.waterOz ?? null,
      bpSys: d?.bpSys ?? null,
      bpDia: d?.bpDia ?? null,
      hr: d?.restingHR ?? null,
      symptoms: d ? symptomScore(d) : null,
      medTaken: !!d?.med.taken,
      medLogged: !!d,
      plan,
      workoutDone,
      appetite: d?.appetite ?? null,
    };
  });
}

/** Trailing average over `window` days, using only days that have a value; needs `min` values. */
export function rolling(points: Point[], window = 7, min = 2): Point[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).map((x) => x.value);
    const n = slice.filter((x) => x != null).length;
    return { date: p.date, value: n >= min ? mean(slice) : null };
  });
}

export interface WeekSummary {
  week: number;
  from: string;
  to: string;
  avgWeight: number | null;
  avgSteps: number | null;
  stepsDays: number;
  target: number | null;
  strengthPlanned: number;
  strengthDone: number;
  activeDays: number;
  medTaken: number;
  elapsed: number;
}

export function weekSummaries(s: Settings, metrics: Metrics[], today: string): WeekSummary[] {
  const len = programLength(s);
  const weeks = Math.ceil(len / 7);
  const out: WeekSummary[] = [];
  for (let w = 1; w <= weeks; w++) {
    const from = addDays(s.programStart, (w - 1) * 7);
    const to = w === weeks ? s.programEnd : addDays(from, 6);
    const ms = metrics.filter((m) => m.date >= from && m.date <= to);
    const elapsed = ms.filter((m) => m.date <= today);
    out.push({
      week: w,
      from,
      to,
      avgWeight: mean(ms.map((m) => m.weight)),
      avgSteps: mean(ms.map((m) => m.steps)),
      stepsDays: ms.filter((m) => m.steps != null).length,
      target: stepTargetFor(s, from),
      strengthPlanned: elapsed.filter((m) => m.plan === 'strength').length,
      strengthDone: elapsed.filter((m) => m.plan === 'strength' && m.workoutDone).length,
      activeDays: elapsed.filter((m) => m.workoutDone).length,
      medTaken: elapsed.filter((m) => m.medTaken).length,
      elapsed: elapsed.length,
    });
  }
  return out;
}

export interface PeriodSummary {
  label: string;
  from: string;
  to: string;
  daysElapsed: number;
  firstWeight: number | null;
  lastWeight: number | null;
  weightReadings: number;
  avgCalories: number | null;
  calorieDays: number;
  avgProtein: number | null;
  proteinDays: number;
  avgSteps: number | null;
  stepDays: number;
  workouts: number;
  strengthDone: number;
  strengthPlanned: number;
  medTaken: number;
  avgSymptoms: number | null;
  symptomDays: number;
  avgSys: number | null;
  avgDia: number | null;
  bpReadings: number;
}

export function periodSummary(label: string, metrics: Metrics[], from: string, to: string, today: string): PeriodSummary {
  const ms = metrics.filter((m) => m.date >= from && m.date <= to && m.date <= today);
  const w = ms.filter((m) => m.weight != null);
  const bp = ms.filter((m) => m.bpSys != null && m.bpDia != null);
  return {
    label,
    from,
    to,
    daysElapsed: ms.length,
    firstWeight: w[0]?.weight ?? null,
    lastWeight: w[w.length - 1]?.weight ?? null,
    weightReadings: w.length,
    avgCalories: mean(ms.map((m) => m.calories)),
    calorieDays: ms.filter((m) => m.calories != null).length,
    avgProtein: mean(ms.map((m) => m.protein)),
    proteinDays: ms.filter((m) => m.protein != null).length,
    avgSteps: mean(ms.map((m) => m.steps)),
    stepDays: ms.filter((m) => m.steps != null).length,
    workouts: ms.filter((m) => m.workoutDone).length,
    strengthDone: ms.filter((m) => m.plan === 'strength' && m.workoutDone).length,
    strengthPlanned: ms.filter((m) => m.plan === 'strength').length,
    medTaken: ms.filter((m) => m.medTaken).length,
    avgSymptoms: mean(ms.map((m) => m.symptoms)),
    symptomDays: ms.filter((m) => m.symptoms != null).length,
    avgSys: mean(bp.map((m) => m.bpSys)),
    avgDia: mean(bp.map((m) => m.bpDia)),
    bpReadings: bp.length,
  };
}

export function latestWeight(days: Record<string, DayLog>, upTo?: string): { date: string; weight: number } | null {
  const ds = Object.values(days)
    .filter((d) => d.weight != null && (!upTo || d.date <= upTo))
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = ds[ds.length - 1];
  return last ? { date: last.date, weight: last.weight! } : null;
}

export function allDatesRange(s: Settings, days: Record<string, DayLog>, foods: FoodEntry[], today: string) {
  const keys = [...Object.keys(days), ...foods.map((f) => f.date)].sort();
  const from = keys[0] && keys[0] < s.programStart ? keys[0] : s.programStart;
  const last = keys[keys.length - 1];
  let to = today < s.programStart ? s.programStart : today;
  if (last && last > to) to = last;
  return rangeDates(from, to);
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
