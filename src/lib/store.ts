import { useSyncExternalStore } from 'react';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, emptyDay } from './defaults';
import { memoryPersistence, openPersistence, type Persistence } from './db';
import type { BackupFile, DayLog, FoodEntry, Product, Settings } from './types';

export interface AppState {
  ready: boolean;
  settings: Settings;
  products: Product[];
  days: Record<string, DayLog>;
  foods: FoodEntry[];
  /** Storage problem the user should know about */
  storageError: string | null;
  memoryOnly: boolean;
}

let state: AppState = {
  ready: false,
  settings: DEFAULT_SETTINGS,
  products: DEFAULT_PRODUCTS,
  days: {},
  foods: [],
  storageError: null,
  memoryOnly: false,
};
let db: Persistence = memoryPersistence();
const listeners = new Set<() => void>();

function set(next: Partial<AppState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useStore(): AppState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}
export const getState = () => state;

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** Fill in any fields missing from older records so screens can rely on the shape. */
export function normalizeDay(d: Partial<DayLog> & { date: string }): DayLog {
  const base = emptyDay(d.date);
  return {
    ...base,
    ...d,
    med: { ...base.med, ...(d.med ?? {}) },
    workout: { ...base.workout, ...(d.workout ?? {}) },
    symptoms: { ...(d.symptoms ?? {}) },
    checks: { ...(d.checks ?? {}) },
  };
}

export function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  // v2: the program went from 60 to 90 days. Only move the end date if it is
  // still the original default; a date the user picked themselves is left alone.
  if ((s?.settingsVersion ?? 1) < 2) {
    if (out.programStart === '2026-11-02' && out.programEnd === '2026-12-31') out.programEnd = '2027-01-30';
    out.stepTargets = out.stepTargets.map((t) => (t.fromWeek === 7 && t.toWeek === 9 ? { ...t, toWeek: 13 } : t));
    out.settingsVersion = 2;
  }
  return out;
}

async function save(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    if (state.storageError && !state.memoryOnly) set({ storageError: null });
  } catch (e) {
    console.error(label, e);
    set({ storageError: `Couldn't save ${label}. Your latest change is shown but may not be stored. ${(e as Error)?.message ?? ''}`.trim() });
  }
}

export async function initStore() {
  try {
    db = await openPersistence();
    const data = await db.loadAll();
    let settings = normalizeSettings(data.settings);
    let products = data.products;
    if (!data.settings || data.settings.settingsVersion !== settings.settingsVersion) await db.putSettings(settings);
    if (!data.settings && products.length === 0) {
      products = DEFAULT_PRODUCTS;
      for (const p of products) await db.putProduct(p);
    }
    const days: Record<string, DayLog> = {};
    for (const d of data.days) days[d.date] = normalizeDay(d);
    set({ ready: true, settings, products, days, foods: data.foods });
    // Ask the browser not to evict our data under storage pressure (best effort).
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    console.error(e);
    db = memoryPersistence();
    set({
      ready: true,
      memoryOnly: true,
      storageError: `Local storage isn't available (${(e as Error)?.message ?? 'unknown error'}). Entries will be lost when this page closes. Private Browsing can cause this.`,
    });
  }
}

export function getDay(date: string): DayLog {
  return state.days[date] ?? emptyDay(date);
}

export function updateDay(date: string, fn: (d: DayLog) => DayLog) {
  const next = { ...fn(structuredCloneSafe(getDay(date))), date, updatedAt: new Date().toISOString() };
  set({ days: { ...state.days, [date]: next } });
  return save('this day', () => db.putDay(next));
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...state.settings, ...patch };
  set({ settings: next });
  return save('settings', () => db.putSettings(next));
}

export function addFood(entry: Omit<FoodEntry, 'id' | 'createdAt'>): FoodEntry {
  const f: FoodEntry = { ...entry, id: uid(), createdAt: new Date().toISOString() };
  set({ foods: [...state.foods, f] });
  void save('food entry', () => db.putFood(f));
  return f;
}
export function updateFood(f: FoodEntry) {
  set({ foods: state.foods.map((x) => (x.id === f.id ? f : x)) });
  return save('food entry', () => db.putFood(f));
}
export function deleteFood(id: string) {
  set({ foods: state.foods.filter((x) => x.id !== id) });
  return save('food deletion', () => db.deleteFood(id));
}
export function restoreFood(f: FoodEntry) {
  set({ foods: [...state.foods, f] });
  return save('food entry', () => db.putFood(f));
}

export function upsertProduct(p: Product) {
  const exists = state.products.some((x) => x.id === p.id);
  set({ products: exists ? state.products.map((x) => (x.id === p.id ? p : x)) : [...state.products, p] });
  return save('quick-add item', () => db.putProduct(p));
}
export function deleteProduct(id: string) {
  set({ products: state.products.filter((x) => x.id !== id) });
  return save('quick-add deletion', () => db.deleteProduct(id));
}

export async function replaceAllData(b: Pick<BackupFile, 'settings' | 'products' | 'days' | 'foods'>) {
  const settings = normalizeSettings(b.settings);
  const days = b.days.map(normalizeDay);
  await db.replaceAll({ settings, products: b.products, days, foods: b.foods });
  const map: Record<string, DayLog> = {};
  for (const d of days) map[d.date] = d;
  set({ settings, products: b.products, days: map, foods: b.foods, storageError: state.memoryOnly ? state.storageError : null });
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
