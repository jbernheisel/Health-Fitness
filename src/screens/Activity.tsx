import { useState } from 'react';
import type { ScreenProps } from '../App';
import { useDay } from '../components/shared';
import { BarChart, LineChart, RangeTabs } from '../components/charts';
import { Card, Icon, NumField, Segmented, Stat, TextField, Toggle } from '../components/ui';
import { addDays, formatDow, rangeDates, weekday } from '../lib/dates';
import { fmt, mean, metricsFor, planFor, programDay, programWeek, stepTargetFor, weekSummaries } from '../lib/calc';
import { updateDay, useStore } from '../lib/store';
import type { DayLog, DayPlan, ExerciseLog } from '../lib/types';

const PLAN_OPTS: { value: DayPlan; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'walk', label: 'Walk' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'rest', label: 'Rest' },
];

function lastSession(days: Record<string, DayLog>, before: string): ExerciseLog[] | null {
  const ks = Object.keys(days).filter((k) => k < before && days[k].workout.exercises.length).sort();
  const k = ks[ks.length - 1];
  return k ? days[k].workout.exercises : null;
}

export default function Activity({ date, today }: ScreenProps) {
  const { s, settings, day, checks } = useDay(date);
  const store = useStore();
  const plan = planFor(settings, day);
  const target = stepTargetFor(settings, date);
  const baseline = settings.baselineSteps;
  const [range, setRange] = useState<'14' | 'program'>('14');

  const week = programWeek(settings, date);
  const weekStart = week >= 1 ? addDays(settings.programStart, (week - 1) * 7) : addDays(date, -6);
  const weekDates = rangeDates(weekStart, addDays(weekStart, 6));
  const weekMetrics = metricsFor(settings, s.days, s.foods, weekDates);
  const weekAvg = mean(weekMetrics.filter((m) => m.date <= today).map((m) => m.steps));
  const weekLogged = weekMetrics.filter((m) => m.steps != null).length;

  const chartDates = range === '14' ? rangeDates(addDays(date, -13), date) : rangeDates(settings.programStart, settings.programEnd);
  const chartMetrics = metricsFor(settings, s.days, s.foods, chartDates);
  const summaries = weekSummaries(settings, metricsFor(settings, s.days, s.foods, rangeDates(settings.programStart, settings.programEnd)), today);

  const setPlan = (p: DayPlan | null) => updateDay(date, (d) => ({ ...d, workout: { ...d.workout, planOverride: p && p !== settings.weeklyPlan[weekday(date)] ? p : null } }));

  const startWorkout = () =>
    updateDay(date, (d) => {
      const prev = lastSession(store.days, date);
      d.workout.exercises = settings.exercises.map((name) => {
        const p = prev?.find((e) => e.name === name);
        const n = Math.max(1, p?.sets.length ?? settings.defaultSets);
        return { name, sets: Array.from({ length: n }, (_, i) => ({ reps: p?.sets[i]?.reps ?? null, weight: p?.sets[i]?.weight ?? null, done: false })) };
      });
      return d;
    });

  const setEx = (i: number, fn: (e: ExerciseLog) => ExerciseLog) =>
    updateDay(date, (d) => ({ ...d, workout: { ...d.workout, exercises: d.workout.exercises.map((e, j) => (j === i ? fn(e) : e)) } }));

  const vsBaseline = day.steps != null && baseline ? ((day.steps - baseline) / baseline) * 100 : null;

  return (
    <div className="screen activity">
      <div className="stats-row">
        <Stat label="Steps today" value={<span data-testid="steps-today">{day.steps == null ? 'Not logged' : fmt(day.steps)}</span>} sub={target ? `Week ${week} target ${fmt(target)}` : 'Program not started'} />
        <Stat label="This week's average" value={weekAvg == null ? 'Not enough data' : fmt(weekAvg)} sub={`${weekLogged} day${weekLogged === 1 ? '' : 's'} logged`} testId="steps-week-avg" />
        <Stat label="vs. 3,000 baseline" value={vsBaseline == null ? '—' : `${vsBaseline >= 0 ? '+' : ''}${fmt(vsBaseline)}%`} sub={baseline ? `baseline ${fmt(baseline)}` : undefined} />
        <Stat label="Movement" value={checks.workout ? 'Done' : 'Not logged yet'} sub={PLAN_OPTS.find((p) => p.value === plan)?.label + ' day'} />
      </div>

      <div className="grid two">
        <Card title="Steps">
          <div className="fields">
            <NumField label="Total steps today" value={day.steps} onChange={(v) => updateDay(date, (d) => ({ ...d, steps: v }))} testId="steps-input" max={200000} wide />
          </div>
          <div className="chip-row">
            {[500, 1000, 2000].map((n) => (
              <button key={n} type="button" className="chip" onClick={() => updateDay(date, (d) => ({ ...d, steps: (d.steps ?? 0) + n }))}>+{fmt(n)}</button>
            ))}
            {day.steps != null && <button type="button" className="chip chip-ghost" onClick={() => updateDay(date, (d) => ({ ...d, steps: null }))}>Clear</button>}
          </div>
          <p className="muted small">Copy today's total from the Health app or your watch. Automatic import isn't available in this version.</p>
        </Card>

        <Card title="Workout" testId="workout-card">
          <div className="field">
            <span className="field-label">Today's plan</span>
            <Segmented label="Plan" allowClear={false} value={plan} onChange={(v) => setPlan(v)} options={PLAN_OPTS} testId="plan-select" />
          </div>
          {day.workout.planOverride && <p className="muted small">Changed from your usual {settings.weeklyPlan[weekday(date)]} day. <button type="button" className="link-btn" onClick={() => setPlan(null)}>Reset</button></p>}

          {plan === 'strength' && day.workout.exercises.length === 0 && (
            <button type="button" className="btn btn-primary wide" onClick={startWorkout} data-testid="start-workout"><Icon name="plus" size={18} /> Start strength workout</button>
          )}
          {plan === 'strength' && day.workout.exercises.length > 0 && (
            <div className="exercises">
              {day.workout.exercises.map((ex, i) => (
                <div className="exercise" key={ex.name + i} data-testid="exercise">
                  <div className="exercise-head">
                    <strong>{ex.name}</strong>
                    <span className="row-actions">
                      <button type="button" className="btn btn-small" onClick={() => setEx(i, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? { reps: null, weight: null }), done: false }] }))} data-testid="add-set">+ Set</button>
                      {ex.sets.length > 1 && <button type="button" className="btn btn-small" onClick={() => setEx(i, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>− Set</button>}
                    </span>
                  </div>
                  {ex.sets.map((set, k) => (
                    <div className="set-row" key={k}>
                      <span className="set-n">Set {k + 1}</span>
                      <NumField label="Reps" value={set.reps} onChange={(v) => setEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, reps: v } : x)) }))} testId={`reps-${i}-${k}`} max={500} />
                      <NumField label="Weight" unit="lb" step={0.5} value={set.weight} onChange={(v) => setEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, weight: v } : x)) }))} testId={`weight-${i}-${k}`} max={1000} />
                      <button
                        type="button"
                        className={`set-done ${set.done ? 'on' : ''}`}
                        aria-pressed={set.done}
                        aria-label={`Set ${k + 1} done`}
                        onClick={() => setEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, done: !x.done } : x)) }))}
                        data-testid={`set-done-${i}-${k}`}
                      >
                        <Icon name="check" size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <p className="muted small">Start with 1–2 sets at a weight you can control comfortably. Values carry over from your last session.</p>
            </div>
          )}
          {plan === 'recovery' && <p className="muted">Recovery day: an easy walk, stretching, or mobility is plenty. Log minutes below if you moved.</p>}
          {plan === 'rest' && <p className="muted">Rest day. Nothing required.</p>}

          <div className="fields">
            {plan === 'strength' && <NumField label="Workout duration" unit="min" value={day.workout.durationMin} onChange={(v) => updateDay(date, (d) => ({ ...d, workout: { ...d.workout, durationMin: v } }))} testId="workout-duration" max={600} />}
            <NumField label={plan === 'strength' ? 'Walking (optional)' : 'Walking / activity'} unit="min" value={day.workout.walkMinutes} onChange={(v) => updateDay(date, (d) => ({ ...d, workout: { ...d.workout, walkMinutes: v } }))} testId="walk-minutes" max={1440} />
            <div className="field">
              <span className="field-label">{plan === 'strength' ? 'Workout complete' : 'Activity complete'}</span>
              <Toggle checked={day.workout.completed} onChange={(v) => updateDay(date, (d) => ({ ...d, workout: { ...d.workout, completed: v } }))} label="Workout complete" testId="workout-complete" />
            </div>
            <TextField label="Notes" value={day.workout.notes} onChange={(v) => updateDay(date, (d) => ({ ...d, workout: { ...d.workout, notes: v } }))} placeholder="How it felt, weights to try next time…" />
          </div>
        </Card>
      </div>

      <Card title="This week" testId="week-schedule">
        <div className="week-strip">
          {weekDates.map((d, i) => {
            const m = weekMetrics[i];
            const pd = programDay(settings, d);
            return (
              <div key={d} className={`week-day ${d === date ? 'current' : ''} ${m.workoutDone ? 'done' : ''}`}>
                <span className="wd-dow">{formatDow(d)}</span>
                <span className={`pill plan-${m.plan}`}>{PLAN_OPTS.find((p) => p.value === m.plan)?.label}</span>
                <span className="wd-steps">{m.steps == null ? '—' : fmt(m.steps)}</span>
                <span className="wd-state">{d > today ? '' : m.workoutDone ? 'Done' : 'Not logged'}</span>
                {pd >= 1 && <span className="wd-n">Day {pd}</span>}
              </div>
            );
          })}
        </div>
        <p className="muted small">Strength three days a week, walking the rest. Change the weekly pattern in Settings, or switch any single day above.</p>
      </Card>

      <Card title="Step trend" action={<RangeTabs value={range} onChange={setRange} options={[{ value: '14', label: '14 days' }, { value: 'program', label: 'Program' }]} />}>
        <LineChart
          testId="steps-chart"
          zeroBased
          series={[
            { name: 'Steps', points: chartMetrics.map((m) => ({ date: m.date, value: m.steps })), color: 'var(--series-1)', style: 'line+dots' },
            { name: 'Target', points: chartDates.map((d) => ({ date: d, value: stepTargetFor(settings, d) })), color: 'var(--series-ref)', style: 'line' },
          ]}
          reference={baseline ? [{ value: baseline, label: `Baseline ${fmt(baseline)}` }] : undefined}
          minPoints={2}
        />
      </Card>

      <Card title="Weekly step averages">
        <BarChart
          testId="steps-weekly"
          bars={summaries.map((w) => ({ label: `Wk ${w.week}`, value: w.avgSteps, sub: w.stepsDays ? `${w.stepsDays}d` : undefined }))}
          target={summaries.map((w) => w.target)}
        />
        <p className="muted small">Averages use only days with steps entered. The tick shows each week's target.</p>
      </Card>
    </div>
  );
}
