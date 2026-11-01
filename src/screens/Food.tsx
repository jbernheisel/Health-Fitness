import { useMemo, useState } from 'react';
import type { ScreenProps } from '../App';
import { FoodRow, QuickAddGrid, useDay } from '../components/shared';
import { Card, ConfirmSheet, Icon, NumField, Progress, Segmented, Stat, TextField, toast } from '../components/ui';
import { fmt } from '../lib/calc';
import { addFood, deleteProduct, deleteFood, updateFood, upsertProduct, uid, useStore } from '../lib/store';
import type { FoodEntry, Product } from '../lib/types';

interface Draft { name: string; calories: number | null; protein: number | null; fiber: number | null; kind: 'food' | 'drink' }
const blank: Draft = { name: '', calories: null, protein: null, fiber: null, kind: 'food' };

export default function Food({ date }: ScreenProps) {
  const { settings, totals, foods } = useDay(date);
  const all = useStore();
  const [draft, setDraft] = useState<Draft>(blank);
  const [saveFav, setSaveFav] = useState(false);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [manage, setManage] = useState(false);

  // Repeat meals: custom items logged before, most recent first, de-duplicated by name.
  const repeats = useMemo(() => {
    const seen = new Map<string, FoodEntry>();
    [...all.foods].filter((f) => !f.productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach((f) => {
      const k = f.name.trim().toLowerCase();
      if (!seen.has(k)) seen.set(k, f);
    });
    return [...seen.values()].slice(0, 8);
  }, [all.foods]);

  const proteinLeft = settings.proteinGoal != null ? settings.proteinGoal - totals.protein : null;
  const inRange = settings.calMin != null && settings.calMax != null && totals.calories >= settings.calMin && totals.calories <= settings.calMax;

  const submit = () => {
    if (!draft.name.trim()) return toast('Give the item a name first.');
    addFood({ date, ...draft, name: draft.name.trim() });
    if (saveFav) {
      upsertProduct({ id: uid(), ...draft, name: draft.name.trim(), order: all.products.length + 1 });
    }
    toast(`Added ${draft.name.trim()}`);
    setDraft(blank);
    setSaveFav(false);
  };

  const drinks = foods.filter((f) => f.kind === 'drink');
  const meals = foods.filter((f) => f.kind === 'food');

  return (
    <div className="screen food">
      <div className="stats-row">
        <Stat label="Protein" value={<span data-testid="food-protein-total">{fmt(totals.protein)}g</span>} sub={`of ${fmt(settings.proteinGoal)}g goal`} />
        <Stat label="Protein remaining" value={<span data-testid="food-protein-left">{proteinLeft == null ? '—' : proteinLeft <= 0 ? 'Goal met' : `${fmt(proteinLeft)}g`}</span>} />
        <Stat label="Calories logged" value={<span data-testid="food-calories-total">{fmt(totals.calories)}</span>} sub={`starting range ${fmt(settings.calMin)}–${fmt(settings.calMax)}`} />
        <Stat label="Items" value={totals.count} sub={totals.missingCalories ? `${totals.missingCalories} without calories` : 'all with calories'} />
      </div>

      <div className="grid two">
        <Card title="Quick add" action={<button type="button" className="link-btn" onClick={() => setManage(true)} data-testid="manage-quick">Edit items</button>}>
          <QuickAddGrid date={date} />
          {repeats.length > 0 && (
            <>
              <h3 className="sub-head">Repeat a meal</h3>
              <div className="chip-row wrap">
                {repeats.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="chip"
                    onClick={() => { addFood({ date, name: r.name, calories: r.calories, protein: r.protein, fiber: r.fiber, kind: r.kind }); toast(`Added ${r.name}`); }}
                  >
                    + {r.name} <span className="muted">{r.protein != null ? `${r.protein}g` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Add a meal or drink">
          <form className="fields" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <TextField label="What did you have?" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Chicken wrap, gyro, steak nachos…" testId="custom-name" />
            <NumField label="Calories" value={draft.calories} onChange={(v) => setDraft({ ...draft, calories: v })} testId="custom-calories" max={10000} />
            <NumField label="Protein" unit="g" value={draft.protein} onChange={(v) => setDraft({ ...draft, protein: v })} testId="custom-protein" step={0.1} max={500} />
            <NumField label="Fiber (optional)" unit="g" value={draft.fiber} onChange={(v) => setDraft({ ...draft, fiber: v })} step={0.1} max={200} />
            <div className="field">
              <span className="field-label">Type</span>
              <Segmented label="Type" allowClear={false} value={draft.kind} onChange={(v) => v && setDraft({ ...draft, kind: v })} options={[{ value: 'food', label: 'Food' }, { value: 'drink', label: 'Drink' }]} />
            </div>
            <label className="check-line field-wide">
              <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} /> Save as a quick-add button
            </label>
            <button type="submit" className="btn btn-primary field-wide" data-testid="custom-add"><Icon name="plus" size={18} /> Add to log</button>
          </form>
          <p className="muted small">Use the numbers from the package, app, or restaurant you trust. Leave a field blank if you don't know it — it won't be counted as zero.</p>
        </Card>
      </div>

      <Card title="Today's progress">
        <Progress label="Protein" value={totals.protein} max={settings.proteinGoal} detail={`${fmt(totals.protein)}g of ${fmt(settings.proteinGoal)}g`} />
        <Progress
          label="Calories"
          value={totals.calories}
          max={settings.calMax}
          band={settings.calMin != null && settings.calMax != null ? [settings.calMin, settings.calMax] : undefined}
          detail={`${fmt(totals.calories)} logged${inRange ? ' · in your starting range' : ''}`}
        />
        <p className="muted small">The calorie range is a starting point, not a ceiling to beat. With a reduced appetite, it helps to prioritize protein, fiber, fruit and vegetables, and fluids so the food you do eat covers your needs.</p>
      </Card>

      <Card title="Food log" testId="food-log">
        {foods.length === 0 ? (
          <p className="muted">Nothing logged for this day yet.</p>
        ) : (
          <>
            {meals.length > 0 && <><h3 className="sub-head">Food</h3><ul className="food-list">{meals.map((f) => <FoodRow key={f.id} f={f} onEdit={() => setEditing(f)} />)}</ul></>}
            {drinks.length > 0 && <><h3 className="sub-head">Drinks</h3><ul className="food-list">{drinks.map((f) => <FoodRow key={f.id} f={f} onEdit={() => setEditing(f)} />)}</ul></>}
          </>
        )}
      </Card>

      {editing && <EditFood entry={editing} onClose={() => setEditing(null)} />}
      {manage && <ManageProducts onClose={() => setManage(false)} />}
    </div>
  );
}

function EditFood({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const [e, setE] = useState(entry);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit entry" onClick={(ev) => ev.stopPropagation()}>
        <h3>Edit entry</h3>
        <div className="fields">
          <TextField label="Name" value={e.name} onChange={(v) => setE({ ...e, name: v })} testId="edit-name" />
          <NumField label="Calories" value={e.calories} onChange={(v) => setE({ ...e, calories: v })} testId="edit-calories" max={10000} />
          <NumField label="Protein" unit="g" value={e.protein} onChange={(v) => setE({ ...e, protein: v })} step={0.1} testId="edit-protein" max={500} />
          <NumField label="Fiber" unit="g" value={e.fiber} onChange={(v) => setE({ ...e, fiber: v })} step={0.1} max={200} />
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-danger-ghost" onClick={() => { void deleteFood(e.id); onClose(); }}>Delete</button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" data-testid="edit-save" onClick={() => { void updateFood({ ...e, name: e.name.trim() || entry.name }); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ManageProducts({ onClose }: { onClose: () => void }) {
  const { products } = useStore();
  const [confirm, setConfirm] = useState<Product | null>(null);
  const sorted = [...products].sort((a, b) => a.order - b.order);
  const move = (p: Product, dir: -1 | 1) => {
    const i = sorted.indexOf(p);
    const q = sorted[i + dir];
    if (!q) return;
    void upsertProduct({ ...p, order: q.order });
    void upsertProduct({ ...q, order: p.order === q.order ? p.order + dir : p.order });
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-wide" role="dialog" aria-modal="true" aria-label="Quick-add items" onClick={(e) => e.stopPropagation()}>
        <h3>Quick-add items</h3>
        <p className="muted small">Edit nutrition to match your package. Blank values aren't counted. Changes apply to future taps, not past entries.</p>
        <ul className="product-list">
          {sorted.map((p, i) => (
            <li key={p.id} className={p.hidden ? 'is-hidden' : ''} data-testid={`product-${p.id}`}>
              <div className="fields compact">
                <TextField label="Name" value={p.name} onChange={(v) => upsertProduct({ ...p, name: v })} />
                <NumField label="Calories" value={p.calories} onChange={(v) => upsertProduct({ ...p, calories: v })} testId={`product-cal-${p.id}`} max={5000} />
                <NumField label="Protein" unit="g" step={0.1} value={p.protein} onChange={(v) => upsertProduct({ ...p, protein: v })} max={300} />
                <NumField label="Fiber" unit="g" step={0.1} value={p.fiber} onChange={(v) => upsertProduct({ ...p, fiber: v })} max={100} />
              </div>
              {p.note && <p className="muted small">{p.note}</p>}
              <div className="row-actions">
                <button type="button" className="btn btn-small" disabled={i === 0} onClick={() => move(p, -1)}>Move up</button>
                <button type="button" className="btn btn-small" onClick={() => upsertProduct({ ...p, hidden: !p.hidden })}>{p.hidden ? 'Show' : 'Hide'}</button>
                {!p.builtIn && <button type="button" className="btn btn-small btn-danger-ghost" onClick={() => setConfirm(p)}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={() => upsertProduct({ id: uid(), name: 'New item', calories: null, protein: null, fiber: null, kind: 'food', order: sorted.length + 1 })}>
            <Icon name="plus" size={18} /> New item
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={onClose} data-testid="manage-done">Done</button>
        </div>
        <ConfirmSheet
          open={!!confirm}
          title="Delete quick-add item?"
          body={`"${confirm?.name}" will be removed from quick-add. Past log entries stay.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { if (confirm) void deleteProduct(confirm.id); setConfirm(null); }}
        />
      </div>
    </div>
  );
}
