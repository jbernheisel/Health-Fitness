import { useEffect, useState } from 'react';
import { addFood, deleteFood, getDay, restoreFood, updateDay, useStore } from '../lib/store';
import { checks, foodsFor, totalsFor, fmt } from '../lib/calc';
import { timeIn } from '../lib/dates';
import type { CheckKey, Product } from '../lib/types';
import { Icon, toast } from './ui';

export function useDay(date: string) {
  const s = useStore();
  const day = s.days[date] ?? getDay(date);
  const totals = totalsFor(s.foods, date);
  const foods = foodsFor(s.foods, date);
  return { s, settings: s.settings, day, totals, foods, checks: checks(s.settings, day, totals) };
}

export function quickAdd(p: Product, date: string) {
  const f = addFood({ date, name: p.name, calories: p.calories, protein: p.protein, fiber: p.fiber, kind: p.kind, productId: p.id });
  const bits = [p.protein != null ? `+${p.protein}g protein` : null, p.calories != null ? `+${p.calories} cal` : null].filter(Boolean).join(', ');
  toast(`Added ${p.name}${bits ? ` (${bits})` : ''}`, () => deleteFood(f.id));
  return f;
}

export function QuickAddGrid({ date, limit, compact }: { date: string; limit?: number; compact?: boolean }) {
  const { products } = useStore();
  const list = products.filter((p) => !p.hidden).sort((a, b) => a.order - b.order).slice(0, limit);
  if (!list.length) return <p className="muted">No quick-add items. Add favorites under Food.</p>;
  return (
    <div className={`quick-grid ${compact ? 'compact' : ''}`}>
      {list.map((p) => (
        <button key={p.id} type="button" className="quick-btn" onClick={() => quickAdd(p, date)} data-testid={`quick-${p.id}`}>
          <span className="quick-plus"><Icon name="plus" size={18} /></span>
          <span className="quick-name">{p.name}</span>
          <span className="quick-macros">
            {p.protein != null ? `${p.protein}g protein` : 'protein not set'} · {p.calories != null ? `${p.calories} cal` : 'cal not set'}
          </span>
        </button>
      ))}
    </div>
  );
}

export const CHECK_ITEMS: { key: CheckKey; label: string; hint: string }[] = [
  { key: 'med', label: 'Wegovy taken', hint: 'Medication' },
  { key: 'protein', label: 'Protein goal', hint: 'Protein' },
  { key: 'calories', label: 'Calories recorded', hint: 'Food log' },
  { key: 'steps', label: 'Steps entered', hint: 'Steps' },
  { key: 'workout', label: 'Workout or walk', hint: 'Movement' },
  { key: 'water', label: 'Water recorded', hint: 'Hydration' },
  { key: 'symptoms', label: 'Symptoms checked', hint: 'Check-in' },
  { key: 'bp', label: 'Blood pressure', hint: 'If applicable' },
];

/** Toggle a checklist item. Medication & symptoms also update their underlying record. */
export function toggleCheck(date: string, key: CheckKey, next: boolean, tz: string, fallbackDose: number | null) {
  void updateDay(date, (d) => {
    if (key === 'med') {
      d.med.taken = next;
      if (next && !d.med.time) { d.med.time = timeIn(tz); d.med.takenAt = new Date().toISOString(); }
      if (next && d.med.doseMg == null) d.med.doseMg = fallbackDose;
      delete d.checks.med;
      return d;
    }
    if (key === 'symptoms') {
      d.symptomsChecked = next;
      delete d.checks.symptoms;
      return d;
    }
    d.checks[key] = next;
    return d;
  });
}

/** Last dose the user actually recorded (never increased automatically). */
export function lastRecordedDose(days: Record<string, { med: { doseMg: number | null } }>, before: string): number | null {
  const keys = Object.keys(days).filter((k) => k < before && days[k].med.doseMg != null).sort();
  const k = keys[keys.length - 1];
  return k ? days[k].med.doseMg : null;
}

export function WaitTimer({ takenAt, onDismiss }: { takenAt: string; onDismiss: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const end = Date.parse(takenAt) + 30 * 60_000;
  const left = end - now;
  if (left <= -60 * 60_000) return null; // stop showing an hour after it finished
  const mm = Math.floor(Math.max(0, left) / 60000);
  const ss = Math.floor((Math.max(0, left) % 60000) / 1000);
  const pct = Math.min(100, Math.max(0, 100 - (left / (30 * 60_000)) * 100));
  return (
    <div className={`timer ${left <= 0 ? 'done' : ''}`} data-testid="wait-timer">
      <div className="timer-ring" style={{ ['--p' as string]: `${pct}%` }}>
        <span>{left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : 'Done'}</span>
      </div>
      <div className="timer-text">
        <strong>{left > 0 ? '30-minute wait' : 'Wait complete'}</strong>
        <span>{left > 0 ? 'Hold off on food, drinks, and other oral medicines.' : 'You can have breakfast and other medicines now.'}</span>
      </div>
      <button type="button" className="icon-btn" aria-label="Hide timer" onClick={onDismiss}><Icon name="x" size={18} /></button>
    </div>
  );
}

export function FoodRow({ f, onEdit }: { f: { id: string; name: string; calories: number | null; protein: number | null; fiber: number | null; kind: string }; onEdit: () => void }) {
  const s = useStore();
  return (
    <li className="food-row" data-testid="food-row">
      <div className="food-main">
        <span className="food-name">{f.name}</span>
        <span className="food-macros">
          <b>{f.protein != null ? `${fmt(f.protein)}g` : '—'}</b> protein · <b>{f.calories != null ? fmt(f.calories) : '—'}</b> cal
          {f.fiber != null && <> · {fmt(f.fiber)}g fiber</>}
          {f.calories == null && <span className="pill pill-soft">calories not entered</span>}
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label={`Edit ${f.name}`} onClick={onEdit}><Icon name="edit" size={18} /></button>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Remove ${f.name}`}
        data-testid="food-delete"
        onClick={() => {
          const full = s.foods.find((x) => x.id === f.id);
          void deleteFood(f.id);
          if (full) toast(`Removed ${f.name}`, () => restoreFood(full));
        }}
      >
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}
