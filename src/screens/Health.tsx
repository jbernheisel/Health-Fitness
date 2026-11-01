import type { ScreenProps } from '../App';
import { WaitTimer, lastRecordedDose, toggleCheck, useDay } from '../components/shared';
import { Card, Icon, NumField, Segmented, TextField, Toggle } from '../components/ui';
import { addDays, formatDow, rangeDates, timeIn } from '../lib/dates';
import { programDay } from '../lib/calc';
import { TITRATION_REFERENCE } from '../lib/defaults';
import { updateDay } from '../lib/store';
import { SYMPTOMS, type SymptomKey } from '../lib/types';

const SEV = [0, 1, 2, 3].map((v) => ({ value: v, label: ['None', 'Mild', 'Mod', 'Severe'][v] }));
const LABEL: Record<SymptomKey, string> = {
  nausea: 'Nausea', constipation: 'Constipation', diarrhea: 'Diarrhea', bloating: 'Bloating', reflux: 'Reflux / heartburn', dizziness: 'Dizziness', fatigue: 'Fatigue',
};

export default function Health({ date, today }: ScreenProps) {
  const { s, settings, day } = useDay(date);
  const fallbackDose = lastRecordedDose(s.days, date) ?? settings.prescribedDoseMg;
  const pd = programDay(settings, date);
  const strip = rangeDates(addDays(date, -13), date);

  const setSym = (k: SymptomKey, v: number | null) =>
    updateDay(date, (d) => ({ ...d, symptoms: { ...d.symptoms, [k]: v }, symptomsChecked: true }));

  return (
    <div className="screen health">
      <div className="grid two">
        <Card title="Medication" testId="med-card">
          <div className="med-row">
            <div>
              <strong>{settings.medicationName}</strong>
              <p className="muted small">Once daily, as prescribed</p>
            </div>
            <Toggle checked={day.med.taken} onChange={(v) => toggleCheck(date, 'med', v, settings.timeZone, fallbackDose)} label="Medication taken" testId="med-taken" />
          </div>
          <div className="fields">
            <NumField label="Dose taken" unit="mg" step={0.1} value={day.med.doseMg} onChange={(v) => updateDay(date, (d) => ({ ...d, med: { ...d.med, doseMg: v } }))} testId="med-dose" max={100} placeholder={fallbackDose != null ? String(fallbackDose) : 'mg'} />
            <label className="field">
              <span className="field-label">Time taken</span>
              <span className="field-box">
                <input type="time" value={day.med.time ?? ''} onChange={(e) => updateDay(date, (d) => ({ ...d, med: { ...d.med, time: e.target.value || null } }))} data-testid="med-time" />
              </span>
            </label>
          </div>
          <div className="row-actions">
            {date === today && (
              <button type="button" className="btn btn-small" onClick={() => updateDay(date, (d) => ({ ...d, med: { ...d.med, takenAt: new Date().toISOString(), timerDismissed: false, time: d.med.time ?? timeIn(settings.timeZone) } }))} data-testid="start-timer">
                Start 30-min timer
              </button>
            )}
          </div>
          {day.med.takenAt && !day.med.timerDismissed && date === today && (
            <WaitTimer takenAt={day.med.takenAt} onDismiss={() => updateDay(date, (d) => ({ ...d, med: { ...d.med, timerDismissed: true } }))} />
          )}
          <TextField label="Medication notes" value={day.med.notes} onChange={(v) => updateDay(date, (d) => ({ ...d, med: { ...d.med, notes: v } }))} multiline />
          <div className="callout">
            <strong>How to take it</strong>
            <p>Take on waking with no more than 4 ounces of plain water. Swallow whole. Wait at least 30 minutes before food, beverages, or other oral medications.</p>
          </div>

          <h3 className="sub-head">Last 14 days</h3>
          <div className="dose-strip" data-testid="dose-strip">
            {strip.map((d) => {
              const rec = s.days[d];
              const inProgram = programDay(settings, d) >= 1;
              const state = rec?.med.taken ? 'taken' : d > today || !inProgram ? 'na' : 'missed';
              return (
                <div key={d} className={`dose-dot ${state}`} title={`${d}: ${state === 'taken' ? 'taken' : state === 'missed' ? 'not logged' : '—'}`}>
                  <span>{formatDow(d).slice(0, 1)}</span>
                  <i>{state === 'taken' ? <Icon name="check" size={14} /> : null}</i>
                </div>
              );
            })}
          </div>
          <p className="muted small">Open circles mean "not logged" — maybe missed, maybe just not recorded. For a missed dose, follow the instructions from your prescriber or pharmacist.</p>
        </Card>

        <Card title="Titration reference" className="ref-card">
          <p className="muted small"><b>Reference only.</b> These are the standard label doses for oral Wegovy. Your actual dose follows your prescriber's directions. Momentum never changes your dose.</p>
          <table className="ref-table">
            <tbody>
              {TITRATION_REFERENCE.map((r, i) => {
                const ranges = [[1, 30], [31, 60], [61, 90], [91, Infinity]];
                const here = pd >= ranges[i][0] && pd <= ranges[i][1];
                return (
                  <tr key={r.label} className={here ? 'here' : ''}>
                    <td>{r.label}</td>
                    <td>{r.dose}</td>
                    <td>{here ? <span className="pill">Program day {pd}</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="callout callout-safety" data-testid="safety-info">
            <strong>When to contact a clinician</strong>
            <p>Mild nausea, fullness, or constipation are common early on and often ease. Get medical attention for severe or persistent abdominal pain (with or without vomiting), repeated vomiting, signs of dehydration such as very little urine or feeling faint, or fainting. Call 911 for an emergency.</p>
            <p className="small">Momentum is a personal log. It doesn't diagnose symptoms or recommend medication changes.</p>
          </div>
        </Card>
      </div>

      <Card
        title="Symptoms"
        testId="symptoms-card"
        action={
          <button
            type="button"
            className="btn btn-small"
            data-testid="no-symptoms"
            onClick={() => updateDay(date, (d) => ({ ...d, symptoms: Object.fromEntries(SYMPTOMS.map((k) => [k, 0])), otherSeverity: d.otherSymptom ? d.otherSeverity : null, symptomsChecked: true }))}
          >
            No symptoms today
          </button>
        }
      >
        <p className="muted small">Optional severity: 0 none · 1 mild · 2 moderate · 3 severe. Tap again to clear.</p>
        <div className="symptom-grid">
          {SYMPTOMS.map((k) => (
            <div className="symptom" key={k}>
              <span>{LABEL[k]}</span>
              <Segmented label={LABEL[k]} options={SEV} value={day.symptoms[k] ?? null} onChange={(v) => setSym(k, v)} testId={`sym-${k}`} />
            </div>
          ))}
          <div className="symptom">
            <TextField label="Other symptom" value={day.otherSymptom} onChange={(v) => updateDay(date, (d) => ({ ...d, otherSymptom: v, symptomsChecked: true }))} placeholder="Describe" />
            <Segmented label="Other severity" options={SEV} value={day.otherSeverity} onChange={(v) => updateDay(date, (d) => ({ ...d, otherSeverity: v, symptomsChecked: true }))} />
          </div>
        </div>
        <label className="check-line">
          <input type="checkbox" checked={day.symptomsChecked} onChange={(e) => updateDay(date, (d) => ({ ...d, symptomsChecked: e.target.checked }))} data-testid="symptoms-checked" /> Symptoms checked for this day
        </label>
      </Card>

      <Card title="Vitals & daily measures" testId="vitals-card">
        <div className="fields">
          <NumField label="Systolic" unit="mmHg" value={day.bpSys} onChange={(v) => updateDay(date, (d) => ({ ...d, bpSys: v }))} testId="bp-sys" max={300} />
          <NumField label="Diastolic" unit="mmHg" value={day.bpDia} onChange={(v) => updateDay(date, (d) => ({ ...d, bpDia: v }))} testId="bp-dia" max={200} />
          <NumField label="Resting heart rate" unit="bpm" value={day.restingHR} onChange={(v) => updateDay(date, (d) => ({ ...d, restingHR: v }))} testId="hr" max={250} />
          <NumField label="Water" unit="oz" value={day.waterOz} onChange={(v) => updateDay(date, (d) => ({ ...d, waterOz: v }))} testId="water-input" max={500} />
          <NumField label="Hours fasted" unit="h" step={0.5} value={day.hoursFasted} onChange={(v) => updateDay(date, (d) => ({ ...d, hoursFasted: v }))} max={72} />
          <NumField label="Weight (if measured)" unit="lb" step={0.1} value={day.weight} onChange={(v) => updateDay(date, (d) => ({ ...d, weight: v }))} testId="weight-input" max={800} />
          <div className="field field-wide">
            <span className="field-label">Appetite (1 = none, 10 = very hungry)</span>
            <Segmented label="Appetite" options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} value={day.appetite} onChange={(v) => updateDay(date, (d) => ({ ...d, appetite: v }))} testId="appetite" />
          </div>
          <TextField label="Notes for the day" value={day.notes} onChange={(v) => updateDay(date, (d) => ({ ...d, notes: v }))} multiline testId="day-notes" />
        </div>
      </Card>
    </div>
  );
}
