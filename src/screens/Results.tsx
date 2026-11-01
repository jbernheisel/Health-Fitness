import { useState } from 'react';
import type { ScreenProps } from '../App';
import { BarChart, LineChart, RangeTabs } from '../components/charts';
import { Card, Stat } from '../components/ui';
import { addDays, formatShort, rangeDates } from '../lib/dates';
import { allDatesRange, fmt, latestWeight, mean, metricsFor, periodSummary, programDay, programLength, rolling, weekSummaries, type PeriodSummary } from '../lib/calc';
import { useStore } from '../lib/store';

type Range = '7' | '30' | '60' | 'all';

export default function Results({ today }: ScreenProps) {
  const s = useStore();
  const st = s.settings;
  const [range, setRange] = useState<Range>('30');
  const end = today;
  // Fixed ranges don't reach back before the program start (there is nothing to show there).
  const from = addDays(end, -(Number(range) - 1));
  const dates = range === 'all' ? allDatesRange(st, s.days, s.foods, today) : rangeDates(from < st.programStart && end >= st.programStart ? st.programStart : from, end);
  const m = metricsFor(st, s.days, s.foods, dates);
  const programDates = rangeDates(st.programStart, st.programEnd);
  const pm = metricsFor(st, s.days, s.foods, programDates);
  const weeks = weekSummaries(st, pm, today);

  const latest = latestWeight(s.days, today);
  const lost = latest && st.startWeight != null ? st.startWeight - latest.weight : null;
  const pctLost = lost != null && st.startWeight ? (lost / st.startWeight) * 100 : null;
  const toGoal = lost != null && st.startWeight != null && st.goalWeight != null && st.startWeight !== st.goalWeight ? (lost / (st.startWeight - st.goalWeight)) * 100 : null;

  const last7 = metricsFor(st, s.days, s.foods, rangeDates(addDays(today, -6), today));
  const avgCal7 = mean(last7.map((x) => x.calories));
  const avgPro7 = mean(last7.map((x) => x.protein));
  const avgSteps7 = mean(last7.map((x) => x.steps));
  const n7 = (k: 'calories' | 'protein' | 'steps') => last7.filter((x) => x[k] != null).length;

  const elapsed = pm.filter((x) => x.date <= today);
  const adherence = elapsed.length ? (elapsed.filter((x) => x.medTaken).length / elapsed.length) * 100 : null;

  const pts = (k: 'weight' | 'calories' | 'protein' | 'steps' | 'symptoms' | 'bpSys' | 'bpDia' | 'hr') => m.map((x) => ({ date: x.date, value: x[k] }));

  const len = programLength(st);
  const half = Math.min(30, len);
  const p1 = periodSummary('Days 1–30', pm, st.programStart, addDays(st.programStart, half - 1), today);
  const p2 = periodSummary(`Days 31–${len}`, pm, addDays(st.programStart, half), st.programEnd, today);
  const pdToday = programDay(st, today);
  const review30 = periodSummary('Day 30 review', pm, st.programStart, addDays(st.programStart, 29), today);
  const review60 = periodSummary(`Day ${len} review`, pm, st.programStart, st.programEnd, today);

  return (
    <div className="screen results">
      <div className="stats-row">
        <Stat label="Latest weight" value={<span data-testid="latest-weight">{latest ? `${fmt(latest.weight, 1)} lb` : 'Not measured yet'}</span>} sub={latest ? `measured ${formatShort(latest.date)}` : 'Log weight under Health or Today'} />
        <Stat label="Total lost" value={<span data-testid="total-lost">{lost == null ? '—' : `${fmt(lost, 1)} lb`}</span>} sub={st.startWeight != null ? `from ${fmt(st.startWeight)} lb starting weight` : undefined} />
        <Stat label="% of starting weight" value={pctLost == null ? '—' : `${fmt(pctLost, 1)}%`} />
        <Stat label={`Toward ${fmt(st.goalWeight)} lb`} value={toGoal == null ? '—' : `${fmt(Math.max(0, toGoal))}%`} sub={toGoal != null ? <span className="mini-bar"><i style={{ width: `${Math.min(100, Math.max(0, toGoal))}%` }} /></span> : undefined} />
      </div>
      <div className="stats-row">
        <Stat label="7-day avg calories" value={avgCal7 == null ? 'Not enough data' : fmt(avgCal7)} sub={`${n7('calories')} of 7 days logged`} testId="avg7-calories" />
        <Stat label="7-day avg protein" value={avgPro7 == null ? 'Not enough data' : `${fmt(avgPro7)}g`} sub={`${n7('protein')} of 7 days logged`} testId="avg7-protein" />
        <Stat label="7-day avg steps" value={avgSteps7 == null ? 'Not enough data' : fmt(avgSteps7)} sub={`${n7('steps')} of 7 days logged`} testId="avg7-steps" />
        <Stat label="Medication logged" value={adherence == null ? 'Program not started' : `${fmt(adherence)}%`} sub={elapsed.length ? `${elapsed.filter((x) => x.medTaken).length} of ${elapsed.length} program days` : undefined} testId="adherence" />
      </div>

      <div className="filter-row">
        <span className="muted">Charts show</span>
        <RangeTabs value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: 'all', label: 'All time' }]} />
      </div>

      <div className="grid two">
        <Card title="Weight" testId="weight-card">
          <LineChart
            testId="weight-chart"
            series={[
              { name: 'Measured', points: pts('weight'), color: 'var(--series-1)', style: 'dots', unit: ' lb', digits: 1 },
              { name: '7-day average', points: rolling(pts('weight'), 7, 2), color: 'var(--series-2)', style: 'line', unit: ' lb', digits: 1 },
            ]}
            reference={st.goalWeight != null ? [{ value: st.goalWeight, label: `Goal ${st.goalWeight}` }] : undefined}
            minPoints={2}
          />
        </Card>
        <Card title="Weekly average weight">
          <LineChart testId="weight-weekly" minPoints={1} series={[{ name: 'Weekly average', points: weeks.filter((w) => w.from <= today).map((w) => ({ date: w.from, value: w.avgWeight })), color: 'var(--series-1)', style: 'line+dots', unit: ' lb', digits: 1 }]} />
          <p className="muted small">One point per program week (dated by its first day). Averages use only days you weighed in.</p>
        </Card>
        <Card title="Calories">
          <LineChart testId="calories-chart" zeroBased series={[{ name: 'Calories', points: pts('calories'), color: 'var(--series-1)', style: 'line+dots' }]}
            reference={[st.calMin, st.calMax].filter((x): x is number => x != null).map((v) => ({ value: v, label: fmt(v) }))} />
        </Card>
        <Card title="Protein">
          <LineChart testId="protein-chart" zeroBased series={[{ name: 'Protein', points: pts('protein'), color: 'var(--series-1)', style: 'line+dots', unit: 'g' }]}
            reference={st.proteinGoal != null ? [{ value: st.proteinGoal, label: `Goal ${st.proteinGoal}g` }] : undefined} />
        </Card>
        <Card title="Steps">
          <LineChart testId="results-steps-chart" zeroBased series={[{ name: 'Steps', points: pts('steps'), color: 'var(--series-1)', style: 'line+dots' }]}
            reference={st.baselineSteps ? [{ value: st.baselineSteps, label: 'Baseline' }] : undefined} />
        </Card>
        <Card title="Workouts per week">
          <BarChart testId="workouts-weekly" bars={weeks.filter((w) => w.from <= today).map((w) => ({ label: `Wk ${w.week}`, value: w.activeDays, sub: `${w.strengthDone}/${w.strengthPlanned} strength` }))} max={7} />
          <p className="muted small">Bars count days with a completed walk or workout. Below: strength sessions done / scheduled.</p>
        </Card>
        <Card title="Medication by week">
          <BarChart testId="med-weekly" bars={weeks.filter((w) => w.from <= today).map((w) => ({ label: `Wk ${w.week}`, value: w.medTaken, sub: `of ${w.elapsed}` }))} max={7} />
        </Card>
        <Card title="Side effects">
          <LineChart testId="symptoms-chart" zeroBased series={[{ name: 'Total severity', points: pts('symptoms'), color: 'var(--series-1)', style: 'line+dots' }]} />
          <p className="muted small">Sum of the 0–3 ratings on days you checked symptoms. Unchecked days are left blank.</p>
        </Card>
        <Card title="Blood pressure">
          <LineChart testId="bp-chart" series={[
            { name: 'Systolic', points: pts('bpSys'), color: 'var(--series-1)', style: 'line+dots', unit: '' },
            { name: 'Diastolic', points: pts('bpDia'), color: 'var(--series-2)', style: 'line+dots', unit: '' },
          ]} emptyText="No blood-pressure readings yet" />
        </Card>
        <Card title="Resting heart rate">
          <LineChart testId="hr-chart" series={[{ name: 'Resting HR', points: pts('hr'), color: 'var(--series-1)', style: 'line+dots', unit: ' bpm' }]} />
        </Card>
      </div>

      <Card title="First 30 days vs. second 30 days" testId="comparison">
        <CompareTable a={p1} b={p2} />
      </Card>

      <div className="grid two">
        <Review title="Day 30 review" p={review30} reached={pdToday >= 30} unlock={addDays(st.programStart, 29)} startWeight={st.startWeight} testId="review-30" />
        <Review title={`Day ${len} review`} p={review60} reached={pdToday >= len} unlock={st.programEnd} startWeight={st.startWeight} testId="review-60" />
      </div>
    </div>
  );
}

function CompareTable({ a, b }: { a: PeriodSummary; b: PeriodSummary }) {
  const rows: [string, (p: PeriodSummary) => string][] = [
    ['Days so far', (p) => String(p.daysElapsed)],
    ['Weight change', (p) => (p.weightReadings >= 2 ? `${fmt(p.lastWeight! - p.firstWeight!, 1)} lb (${p.weightReadings} readings)` : 'Not enough data')],
    ['Avg calories', (p) => (p.avgCalories == null ? 'Not enough data' : `${fmt(p.avgCalories)} (${p.calorieDays}d)`)],
    ['Avg protein', (p) => (p.avgProtein == null ? 'Not enough data' : `${fmt(p.avgProtein)}g (${p.proteinDays}d)`)],
    ['Avg steps', (p) => (p.avgSteps == null ? 'Not enough data' : `${fmt(p.avgSteps)} (${p.stepDays}d)`)],
    ['Active days', (p) => (p.daysElapsed ? String(p.workouts) : '—')],
    ['Strength sessions', (p) => (p.daysElapsed ? `${p.strengthDone} of ${p.strengthPlanned}` : '—')],
    ['Medication logged', (p) => (p.daysElapsed ? `${p.medTaken} of ${p.daysElapsed} days` : '—')],
    ['Avg symptom score', (p) => (p.avgSymptoms == null ? 'Not enough data' : `${fmt(p.avgSymptoms, 1)} (${p.symptomDays}d)`)],
    ['Avg blood pressure', (p) => (p.bpReadings ? `${fmt(p.avgSys)}/${fmt(p.avgDia)} (${p.bpReadings})` : 'No readings')],
  ];
  return (
    <div className="table-scroll">
      <table className="data-table compare">
        <thead><tr><th></th><th>{a.label}</th><th>{b.label}</th></tr></thead>
        <tbody>{rows.map(([l, f]) => <tr key={l}><td>{l}</td><td>{f(a)}</td><td>{b.daysElapsed ? f(b) : 'Not started'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Review({ title, p, reached, unlock, startWeight, testId }: { title: string; p: PeriodSummary; reached: boolean; unlock: string; startWeight: number | null; testId: string }) {
  return (
    <Card title={title} testId={testId}>
      {!reached && <p className="muted">Complete summary on {formatShort(unlock)}. Shown below: what's recorded so far.</p>}
      {p.daysElapsed === 0 ? (
        <p className="muted">Nothing to summarize yet.</p>
      ) : (
        <ul className="review-list">
          <li><span>Latest measured weight</span><b>{p.lastWeight == null ? 'Not measured' : `${fmt(p.lastWeight, 1)} lb`}</b></li>
          <li><span>Change vs. starting weight</span><b>{p.lastWeight == null || startWeight == null ? '—' : `${fmt(p.lastWeight - startWeight, 1)} lb`}</b></li>
          <li><span>Days with food logged</span><b>{p.calorieDays} of {p.daysElapsed}</b></li>
          <li><span>Average protein</span><b>{p.avgProtein == null ? 'Not enough data' : `${fmt(p.avgProtein)}g`}</b></li>
          <li><span>Average steps</span><b>{p.avgSteps == null ? 'Not enough data' : fmt(p.avgSteps)}</b></li>
          <li><span>Strength sessions</span><b>{p.strengthDone} of {p.strengthPlanned}</b></li>
          <li><span>Medication logged</span><b>{p.medTaken} of {p.daysElapsed} days</b></li>
        </ul>
      )}
      <p className="muted small">Built only from what you recorded. No projections.</p>
    </Card>
  );
}
