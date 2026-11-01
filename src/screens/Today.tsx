import type { ScreenProps } from '../App';
import { CHECK_ITEMS, QuickAddGrid, WaitTimer, lastRecordedDose, toggleCheck, useDay } from '../components/shared';
import { Card, Icon, NumField, Progress } from '../components/ui';
import { diffDays } from '../lib/dates';
import { fmt, planFor, programDay, stepTargetFor } from '../lib/calc';
import { updateDay } from '../lib/store';

const PLAN_LABEL = { strength: 'Strength day', walk: 'Walking day', recovery: 'Recovery day', rest: 'Rest day' } as const;

export default function Today({ date, today, go }: ScreenProps) {
  const { s, settings, day, totals, checks } = useDay(date);
  const plan = planFor(settings, day);
  const target = stepTargetFor(settings, date);
  const dose = day.med.doseMg ?? lastRecordedDose(s.days, date) ?? settings.prescribedDoseMg;
  const items = CHECK_ITEMS.filter((c) => c.key !== 'bp' || settings.trackBP);
  const done = items.filter((c) => checks[c.key]).length;
  const hasData = Object.keys(s.days).length > 0 || s.foods.length > 0;
  const backupAge = settings.lastBackupAt ? diffDays(settings.lastBackupAt.slice(0, 10), today) : null;
  const needsBackup = hasData && (backupAge == null || backupAge >= 7);
  const proteinLeft = settings.proteinGoal != null ? Math.max(0, settings.proteinGoal - totals.protein) : null;
  const pd = programDay(settings, date);

  return (
    <div className="screen today">
      {needsBackup && (
        <button type="button" className="banner banner-info" onClick={() => go('settings')} data-testid="backup-reminder">
          <strong>Back up your data.</strong> {backupAge == null ? "You haven't saved a backup yet." : `Last backup was ${backupAge} days ago.`} Data lives only in this browser. Tap to export.
        </button>
      )}

      <div className="grid today-grid">
        <Card className="med-card" testId="today-med">
          <div className="med-hero">
            <button
              type="button"
              className={`med-button ${day.med.taken ? 'on' : ''}`}
              onClick={() => toggleCheck(date, 'med', !day.med.taken, settings.timeZone, dose)}
              data-testid="med-quick"
              aria-pressed={day.med.taken}
            >
              <span className="med-check"><Icon name="check" size={28} /></span>
              <span>
                <strong>{day.med.taken ? `${settings.medicationName} taken` : `Take ${settings.medicationName}`}</strong>
                <small>
                  {day.med.taken
                    ? `${day.med.time ?? ''}${day.med.doseMg != null ? ` · ${day.med.doseMg} mg` : ' · dose not entered'}`
                    : dose != null ? `Tap when taken · ${dose} mg (your recorded dose)` : 'Tap when taken · enter dose under Health'}
                </small>
              </span>
            </button>
          </div>
          {day.med.taken && day.med.takenAt && !day.med.timerDismissed && date === today && (
            <WaitTimer takenAt={day.med.takenAt} onDismiss={() => updateDay(date, (d) => ({ ...d, med: { ...d.med, timerDismissed: true } }))} />
          )}
          <div className="fields">
            <NumField label="Dose taken" unit="mg" step={0.1} value={day.med.doseMg} onChange={(v) => updateDay(date, (d) => ({ ...d, med: { ...d.med, doseMg: v } }))} testId="today-dose" max={100} placeholder={dose != null ? String(dose) : 'per prescriber'} />
          </div>
          <p className="muted small">On waking: up to 4 oz plain water, swallow whole, then wait at least 30 minutes before food, drinks, or other oral medicines. Dose follows your prescriber — Momentum never changes it.</p>
        </Card>

        <Card title="Today's checklist" action={<span className="muted" data-testid="checklist-count">{done} of {items.length}</span>} className="checklist-card">
          <div className="checklist">
            {items.map((c) => {
              const on = checks[c.key];
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`check-tile ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleCheck(date, c.key, !on, settings.timeZone, dose)}
                  data-testid={`check-${c.key}`}
                >
                  <span className="check-box"><Icon name="check" size={18} /></span>
                  <span className="check-text">
                    <span className="check-label">{c.label}</span>
                    <span className="check-state">{on ? 'Done' : date < today ? 'Not logged' : 'Not logged yet'}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="muted small">Items fill in automatically as you log. Tap any tile to change it. A blank day is just a blank day.</p>
        </Card>

        <Card title="Progress today" className="progress-card">
          <Progress
            label="Protein"
            value={totals.protein}
            max={settings.proteinGoal}
            testId="today-protein"
            detail={<><b data-testid="today-protein-value">{fmt(totals.protein)}g</b> of {fmt(settings.proteinGoal)}g{proteinLeft ? ` · ${fmt(proteinLeft)}g to go` : ''}</>}
          />
          <Progress
            label="Calories"
            value={totals.calories}
            max={settings.calMax}
            band={settings.calMin != null && settings.calMax != null ? [settings.calMin, settings.calMax] : undefined}
            testId="today-calories"
            detail={<><b data-testid="today-calories-value">{fmt(totals.calories)}</b> logged · range {fmt(settings.calMin)}–{fmt(settings.calMax)}</>}
          />
          <Progress
            label="Steps"
            value={day.steps}
            max={target ?? settings.baselineSteps}
            testId="today-steps"
            detail={day.steps == null ? 'Not logged' : <><b>{fmt(day.steps)}</b>{target ? ` of ${fmt(target)} target` : ''}</>}
          />
          <Progress
            label="Water"
            value={day.waterOz}
            max={settings.waterGoalOz}
            testId="today-water"
            detail={day.waterOz == null ? 'Not logged' : <><b>{fmt(day.waterOz)} oz</b> of {fmt(settings.waterGoalOz)} oz</>}
          />
          {totals.missingCalories > 0 && <p className="muted small">{totals.missingCalories} item{totals.missingCalories > 1 ? 's' : ''} without calories entered.</p>}
        </Card>

        <Card title="Quick add" action={<button type="button" className="link-btn" onClick={() => go('food')}>Food log →</button>} className="quick-card">
          <QuickAddGrid date={date} limit={4} compact />
        </Card>

        <Card title="Log it" className="log-card">
          <div className="fields">
            <NumField label="Steps" value={day.steps} onChange={(v) => updateDay(date, (d) => ({ ...d, steps: v }))} testId="today-steps-input" max={200000} placeholder={target ? `Target ${fmt(target)}` : '—'} />
            <div className="field">
              <span className="field-label">Water</span>
              <div className="chip-row">
                {[8, 16].map((oz) => (
                  <button key={oz} type="button" className="chip" data-testid={`water-plus-${oz}`} onClick={() => updateDay(date, (d) => ({ ...d, waterOz: (d.waterOz ?? 0) + oz }))}>+{oz} oz</button>
                ))}
                <span className="chip-value" data-testid="water-value">{day.waterOz == null ? '—' : `${day.waterOz} oz`}</span>
              </div>
            </div>
            <NumField label="Weight (if measured)" value={day.weight} unit="lb" step={0.1} onChange={(v) => updateDay(date, (d) => ({ ...d, weight: v }))} testId="today-weight-input" max={800} />
          </div>
          <div className="plan-line">
            <span className={`pill plan-${plan}`}>{PLAN_LABEL[plan]}</span>
            <button type="button" className="link-btn" onClick={() => go('activity')}>
              {plan === 'strength' ? 'Open workout →' : 'Log walk →'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('health')}>Symptoms & vitals →</button>
          </div>
        </Card>
      </div>
      {pd >= 1 && <p className="footnote">Adequate overall nutrition matters as much as the numbers. Aim for enough protein, fiber, and fluids — eating as little as possible isn't the goal.</p>}
    </div>
  );
}
