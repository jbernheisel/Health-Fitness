import { useRef, useState } from 'react';
import type { ScreenProps } from '../App';
import { Card, ConfirmSheet, Icon, NumField, Segmented, TextField, Toggle, toast } from '../components/ui';
import { DOW, formatShort, isValidDate } from '../lib/dates';
import { programLength } from '../lib/calc';
import { buildBackup, dailyCSV, download, foodCSV, validateBackup, workoutCSV, type ValidationResult } from '../lib/backup';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../lib/defaults';
import { getState, replaceAllData, updateSettings, useStore } from '../lib/store';
import type { DayPlan } from '../lib/types';

const PLAN_OPTS: { value: DayPlan; label: string }[] = [
  { value: 'strength', label: 'Strength' }, { value: 'walk', label: 'Walk' }, { value: 'recovery', label: 'Recovery' }, { value: 'rest', label: 'Rest' },
];

export default function SettingsScreen({ today }: ScreenProps) {
  const s = useStore();
  const st = s.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ValidationResult | null>(null);
  const [importErr, setImportErr] = useState<string[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const feet = st.heightIn != null ? Math.floor(st.heightIn / 12) : null;
  const inches = st.heightIn != null ? Math.round((st.heightIn % 12) * 10) / 10 : null;

  const stamp = today;
  const markBackup = () => updateSettings({ lastBackupAt: new Date().toISOString() });

  const onFile = async (file: File) => {
    setImportErr(null);
    try {
      const text = await file.text();
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return setImportErr(['This file is not valid JSON.']); }
      const v = validateBackup(raw);
      if (!v.ok) return setImportErr(v.errors);
      setPending(v);
    } catch (e) {
      setImportErr([`Couldn't read the file: ${(e as Error).message}`]);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="screen settings">
      <header className="datebar"><div className="datebar-title"><p className="eyebrow">Settings & Backup</p><h1>Settings</h1></div></header>

      <div className="grid two">
        <Card title="Profile">
          <div className="fields">
            <NumField label="Age" value={st.age} onChange={(v) => updateSettings({ age: v })} max={120} />
            <NumField label="Height (ft)" value={feet} onChange={(v) => updateSettings({ heightIn: v == null ? null : v * 12 + (inches ?? 0) })} max={8} />
            <NumField label="Height (in)" value={inches} step={0.5} onChange={(v) => updateSettings({ heightIn: (feet ?? 0) * 12 + (v ?? 0) })} max={11.5} />
            <NumField label="Starting weight" unit="lb" step={0.1} value={st.startWeight} onChange={(v) => updateSettings({ startWeight: v })} testId="set-start-weight" max={800} />
            <NumField label="Goal weight" unit="lb" step={0.1} value={st.goalWeight} onChange={(v) => updateSettings({ goalWeight: v })} testId="set-goal-weight" max={800} />
            <TextField label="Activity level" value={st.activityLevel} onChange={(v) => updateSettings({ activityLevel: v })} />
          </div>
          <p className="muted small">Starting weight is a reference for progress math. It isn't recorded as a weigh-in unless you log it on a day.</p>
        </Card>

        <Card title="Daily targets">
          <div className="fields">
            <NumField label="Calories from" value={st.calMin} onChange={(v) => updateSettings({ calMin: v })} testId="set-cal-min" max={10000} />
            <NumField label="Calories to" value={st.calMax} onChange={(v) => updateSettings({ calMax: v })} testId="set-cal-max" max={10000} />
            <NumField label="Protein goal" unit="g" value={st.proteinGoal} onChange={(v) => updateSettings({ proteinGoal: v })} testId="set-protein" max={500} />
            <NumField label="Water goal" unit="oz" value={st.waterGoalOz} onChange={(v) => updateSettings({ waterGoalOz: v })} max={500} />
            <NumField label="Baseline steps" value={st.baselineSteps} onChange={(v) => updateSettings({ baselineSteps: v })} max={100000} />
          </div>
        </Card>

        <Card title="Program & medication">
          <div className="fields">
            <label className="field">
              <span className="field-label">Start date</span>
              <span className="field-box"><input type="date" value={st.programStart} onChange={(e) => isValidDate(e.target.value) && e.target.value <= st.programEnd && updateSettings({ programStart: e.target.value })} data-testid="set-start" /></span>
            </label>
            <label className="field">
              <span className="field-label">End date</span>
              <span className="field-box"><input type="date" value={st.programEnd} onChange={(e) => isValidDate(e.target.value) && e.target.value >= st.programStart && updateSettings({ programEnd: e.target.value })} /></span>
            </label>
            <TextField label="Time zone" value={st.timeZone} onChange={(v) => { try { new Intl.DateTimeFormat('en', { timeZone: v }); updateSettings({ timeZone: v }); } catch { /* wait for a valid zone */ } }} />
            <TextField label="Medication name" value={st.medicationName} onChange={(v) => updateSettings({ medicationName: v })} />
            <NumField label="Prescribed dose" unit="mg" step={0.1} value={st.prescribedDoseMg} onChange={(v) => updateSettings({ prescribedDoseMg: v })} testId="set-dose" max={100} placeholder="per prescriber" />
            <div className="field"><span className="field-label">Track blood pressure</span><Toggle checked={st.trackBP} onChange={(v) => updateSettings({ trackBP: v })} label="Track blood pressure" /></div>
          </div>
          <p className="muted small">{programLength(st)}-day program, {formatShort(st.programStart)} – {formatShort(st.programEnd)}. Prescribed dose pre-fills the dose field until you record one; update it yourself when your prescriber changes it.</p>
        </Card>

        <Card title="Weekly step targets">
          <table className="data-table">
            <thead><tr><th>Weeks</th><th>Daily average target</th></tr></thead>
            <tbody>
              {st.stepTargets.map((t, i) => (
                <tr key={i}>
                  <td>{t.fromWeek === t.toWeek ? `Week ${t.fromWeek}` : `Weeks ${t.fromWeek}–${t.toWeek}`}</td>
                  <td><NumField label={`Target week ${t.fromWeek}`} value={t.target} onChange={(v) => v != null && updateSettings({ stepTargets: st.stepTargets.map((x, j) => (j === i ? { ...x, target: v } : x)) })} max={100000} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Weekly schedule">
          <div className="schedule">
            {DOW.map((d, i) => (
              <div key={d} className="schedule-row">
                <span>{d}</span>
                <Segmented label={d} allowClear={false} value={st.weeklyPlan[i]} options={PLAN_OPTS} onChange={(v) => v && updateSettings({ weeklyPlan: st.weeklyPlan.map((x, j) => (j === i ? v : x)) })} testId={`schedule-${i}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Strength exercises">
          <ul className="exercise-edit">
            {st.exercises.map((ex, i) => (
              <li key={i}>
                <TextField label={`Exercise ${i + 1}`} value={ex} onChange={(v) => updateSettings({ exercises: st.exercises.map((x, j) => (j === i ? v : x)) })} />
                <button type="button" className="icon-btn" aria-label={`Remove ${ex}`} onClick={() => updateSettings({ exercises: st.exercises.filter((_, j) => j !== i) })}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
          <div className="row-actions">
            <button type="button" className="btn btn-small" onClick={() => updateSettings({ exercises: [...st.exercises, 'New exercise'] })}><Icon name="plus" size={16} /> Add exercise</button>
          </div>
          <div className="fields">
            <NumField label="Starting sets per exercise" value={st.defaultSets} onChange={(v) => v != null && v >= 1 && updateSettings({ defaultSets: v })} min={1} max={10} />
          </div>
        </Card>

        <Card title="Appearance">
          <Segmented label="Theme" allowClear={false} value={st.theme} onChange={(v) => v && updateSettings({ theme: v })} options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} testId="theme" />
        </Card>
      </div>

      <Card title="Your data" testId="data-card">
        <div className="callout">
          <strong>Stored only on this device</strong>
          <p>Everything you enter is saved in this browser's local database on this iPad. Nothing is sent to a server. It does <b>not</b> sync between devices or browsers, and clearing Safari website data deletes it. Export a backup regularly and keep it in Files or iCloud Drive.</p>
          <p className="small">Last backup: <b data-testid="last-backup">{st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleString() : 'never'}</b>{s.memoryOnly && ' · Local storage unavailable — this session will not be saved.'}</p>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn-primary" data-testid="export-json" onClick={() => { download(`momentum-backup-${stamp}.json`, JSON.stringify(buildBackup(getState()), null, 2), 'application/json'); markBackup(); toast('Backup saved'); }}>
            Save JSON backup
          </button>
          <button type="button" className="btn" data-testid="export-csv" onClick={() => { download(`momentum-daily-${stamp}.csv`, dailyCSV(getState(), today), 'text/csv'); toast('Daily CSV exported'); }}>Export daily CSV</button>
          <button type="button" className="btn" data-testid="export-food-csv" onClick={() => download(`momentum-food-${stamp}.csv`, foodCSV(getState()), 'text/csv')}>Export food CSV</button>
          <button type="button" className="btn" data-testid="export-workout-csv" onClick={() => download(`momentum-workouts-${stamp}.csv`, workoutCSV(getState()), 'text/csv')}>Export workout CSV</button>
        </div>
        <div className="button-row">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="import-file" />
          <button type="button" className="btn btn-danger-ghost" onClick={() => setResetOpen(true)} data-testid="reset-all">Erase all data…</button>
        </div>
        {importErr && (
          <div className="banner banner-warn" role="alert" data-testid="import-error">
            <strong>That backup can't be restored.</strong>
            <ul>{importErr.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
      </Card>

      <Card title="Add Momentum to your Home Screen">
        <ol className="steps-list">
          <li>Open this site in <b>Safari</b> on the iPad.</li>
          <li>Tap the <b>Share</b> button (square with an arrow), then <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. Open Momentum from its icon each morning — it works offline after the first visit.</li>
        </ol>
        <p className="muted small">Home Screen apps keep their own storage separate from Safari tabs. Pick one way of opening Momentum and stick with it, or move data with a backup.</p>
      </Card>

      <ConfirmSheet
        open={!!pending}
        title="Replace all data with this backup?"
        body={pending?.summary && (
          <p data-testid="import-summary">
            The backup has {pending.summary.days} day records, {pending.summary.foods} food entries, and {pending.summary.products} quick-add items
            {pending.summary.from ? ` (${pending.summary.from} to ${pending.summary.to})` : ''}. Everything currently in Momentum on this device will be overwritten. Save a backup first if you're not sure.
          </p>
        )}
        confirmLabel="Replace my data"
        danger
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const d = pending!.data!;
          setPending(null);
          try { await replaceAllData(d); toast('Backup restored'); } catch (e) { setImportErr([`Restore failed: ${(e as Error).message}. Your existing data was not changed.`]); }
        }}
      />
      <ConfirmSheet
        open={resetOpen}
        title="Erase everything?"
        body="All days, food entries, and custom quick-add items on this device will be deleted and settings reset to defaults. This can't be undone."
        confirmLabel="Erase all data"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => { setResetOpen(false); await replaceAllData({ settings: DEFAULT_SETTINGS, products: DEFAULT_PRODUCTS, days: [], foods: [] }); toast('All data erased'); }}
      />
    </div>
  );
}
