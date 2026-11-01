import { isValidDate } from './dates';
import { allDatesRange, metricsFor } from './calc';
import type { AppState } from './store';
import type { BackupFile, DayLog, FoodEntry, Product } from './types';
import { SYMPTOMS } from './types';

export function buildBackup(s: AppState): BackupFile {
  return {
    app: 'momentum',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: s.settings,
    products: s.products,
    days: Object.values(s.days).sort((a, b) => a.date.localeCompare(b.date)),
    foods: [...s.foods].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  data?: BackupFile;
  summary?: { days: number; foods: number; products: number; from?: string; to?: string };
}

const numOrNull = (v: unknown) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v));

export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['File is not a Momentum backup (not a JSON object).'] };
  const b = raw as Partial<BackupFile>;
  if (b.app !== 'momentum') errors.push('Missing "app": "momentum" marker. This does not look like a Momentum backup.');
  if (b.version !== 1) errors.push(`Unsupported backup version: ${String(b.version)}.`);
  if (!b.settings || typeof b.settings !== 'object') errors.push('Missing settings.');
  else {
    if (!isValidDate(b.settings.programStart) || !isValidDate(b.settings.programEnd)) errors.push('Settings have invalid program dates.');
  }
  if (!Array.isArray(b.days)) errors.push('Missing daily records.');
  if (!Array.isArray(b.foods)) errors.push('Missing food log.');
  if (!Array.isArray(b.products)) errors.push('Missing quick-add items.');
  if (errors.length) return { ok: false, errors };

  const seen = new Set<string>();
  (b.days as DayLog[]).forEach((d, i) => {
    if (!d || !isValidDate(d.date)) errors.push(`Day #${i + 1} has an invalid date.`);
    else if (seen.has(d.date)) errors.push(`Duplicate day ${d.date}.`);
    else seen.add(d.date);
    if (d && !['steps', 'waterOz', 'weight', 'bpSys', 'bpDia', 'restingHR'].every((k) => numOrNull((d as unknown as Record<string, unknown>)[k])))
      errors.push(`Day ${d?.date} has a non-numeric measurement.`);
  });
  (b.foods as FoodEntry[]).forEach((f, i) => {
    if (!f || typeof f.id !== 'string' || !isValidDate(f.date) || typeof f.name !== 'string') errors.push(`Food entry #${i + 1} is malformed.`);
    else if (!numOrNull(f.calories) || !numOrNull(f.protein)) errors.push(`Food entry "${f.name}" has non-numeric nutrition.`);
  });
  (b.products as Product[]).forEach((p, i) => {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') errors.push(`Quick-add item #${i + 1} is malformed.`);
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  const dates = [...(b.days as DayLog[]).map((d) => d.date), ...(b.foods as FoodEntry[]).map((f) => f.date)].sort();
  return {
    ok: true,
    errors: [],
    data: b as BackupFile,
    summary: { days: b.days!.length, foods: b.foods!.length, products: b.products!.length, from: dates[0], to: dates[dates.length - 1] },
  };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function dailyCSV(s: AppState, today: string): string {
  const dates = allDatesRange(s.settings, s.days, s.foods, today);
  const metrics = metricsFor(s.settings, s.days, s.foods, dates);
  const header = [
    'date', 'program_day', 'weight_lb', 'calories', 'protein_g', 'steps', 'water_oz', 'bp_systolic', 'bp_diastolic', 'resting_hr',
    'appetite_1_10', 'hours_fasted', 'med_taken', 'dose_mg', 'dose_time', 'plan', 'workout_done', 'workout_minutes', 'walk_minutes',
    ...SYMPTOMS.map((k) => `sym_${k}`), 'other_symptom', 'other_severity', 'notes',
  ];
  const rows: unknown[][] = [header];
  const start = s.settings.programStart;
  metrics.forEach((m) => {
    const d = s.days[m.date];
    const hasFood = s.foods.some((f) => f.date === m.date);
    if (!d && !hasFood) return; // don't emit empty rows
    const pd = Math.round((Date.parse(m.date) - Date.parse(start)) / 86400000) + 1;
    rows.push([
      m.date, pd, m.weight, m.calories, m.protein, m.steps, m.water, m.bpSys, m.bpDia, m.hr,
      d?.appetite, d?.hoursFasted, d ? (d.med.taken ? 'yes' : 'no') : '', d?.med.doseMg, d?.med.time, m.plan, m.workoutDone ? 'yes' : 'no',
      d?.workout.durationMin, d?.workout.walkMinutes,
      ...SYMPTOMS.map((k) => d?.symptoms[k]), d?.otherSymptom, d?.otherSeverity, d?.notes,
    ]);
  });
  return csv(rows);
}

export function foodCSV(s: AppState): string {
  const rows: unknown[][] = [['date', 'time_logged', 'item', 'type', 'calories', 'protein_g', 'fiber_g']];
  [...s.foods]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .forEach((f) => rows.push([f.date, f.createdAt, f.name, f.kind, f.calories, f.protein, f.fiber]));
  return csv(rows);
}

export function workoutCSV(s: AppState): string {
  const rows: unknown[][] = [['date', 'exercise', 'set', 'reps', 'weight_lb', 'done']];
  Object.values(s.days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => d.workout.exercises.forEach((e) => e.sets.forEach((x, i) => rows.push([d.date, e.name, i + 1, x.reps, x.weight, x.done ? 'yes' : 'no']))));
  return csv(rows);
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
