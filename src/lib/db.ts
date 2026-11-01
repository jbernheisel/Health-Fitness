import { openDB, type IDBPDatabase } from 'idb';
import type { DayLog, FoodEntry, Product, Settings } from './types';

const DB_NAME = 'momentum';
const DB_VERSION = 1;

export interface DBShape {
  settings: Settings | undefined;
  products: Product[];
  days: DayLog[];
  foods: FoodEntry[];
}

export interface Persistence {
  loadAll(): Promise<DBShape>;
  putSettings(s: Settings): Promise<void>;
  putProduct(p: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  putDay(d: DayLog): Promise<void>;
  putFood(f: FoodEntry): Promise<void>;
  deleteFood(id: string): Promise<void>;
  replaceAll(data: Required<DBShape>): Promise<void>;
}

export async function openPersistence(): Promise<Persistence> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available in this browser.');
  const db: IDBPDatabase = await withTimeout(
    openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('products', { keyPath: 'id' });
        db.createObjectStore('days', { keyPath: 'date' });
        const foods = db.createObjectStore('foods', { keyPath: 'id' });
        foods.createIndex('date', 'date');
      },
    }),
    8000,
  );
  return {
    async loadAll() {
      const [settings, products, days, foods] = await Promise.all([
        db.get('kv', 'settings'),
        db.getAll('products'),
        db.getAll('days'),
        db.getAll('foods'),
      ]);
      return { settings, products, days, foods };
    },
    putSettings: async (s) => void (await db.put('kv', s, 'settings')),
    putProduct: async (p) => void (await db.put('products', p)),
    deleteProduct: async (id) => db.delete('products', id),
    putDay: async (d) => void (await db.put('days', d)),
    putFood: async (f) => void (await db.put('foods', f)),
    deleteFood: async (id) => db.delete('foods', id),
    async replaceAll(data) {
      const tx = db.transaction(['kv', 'products', 'days', 'foods'], 'readwrite');
      await Promise.all([
        tx.objectStore('kv').clear(),
        tx.objectStore('products').clear(),
        tx.objectStore('days').clear(),
        tx.objectStore('foods').clear(),
      ]);
      await tx.objectStore('kv').put(data.settings, 'settings');
      for (const p of data.products) await tx.objectStore('products').put(p);
      for (const d of data.days) await tx.objectStore('days').put(d);
      for (const f of data.foods) await tx.objectStore('foods').put(f);
      await tx.done;
    },
  };
}

/** Used when IndexedDB is unavailable (e.g. some private-browsing modes). Nothing persists. */
export function memoryPersistence(): Persistence {
  const noop = async () => {};
  return {
    loadAll: async () => ({ settings: undefined, products: [], days: [], foods: [] }),
    putSettings: noop, putProduct: noop, deleteProduct: noop, putDay: noop, putFood: noop, deleteFood: noop, replaceAll: noop,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Opening local storage timed out.')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
