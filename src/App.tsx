import { useEffect, useState } from 'react';
import { Icon, Toaster } from './components/ui';
import { addDays, formatLong, isValidDate, todayIn } from './lib/dates';
import { programDay, programLength } from './lib/calc';
import { useStore } from './lib/store';
import Today from './screens/Today';
import Food from './screens/Food';
import Activity from './screens/Activity';
import Health from './screens/Health';
import Results from './screens/Results';
import SettingsScreen from './screens/Settings';

export type Tab = 'today' | 'food' | 'activity' | 'health' | 'results' | 'settings';
const TABS: { id: Tab; label: string; short: string; icon: string }[] = [
  { id: 'today', label: "Today's Check-in", short: 'Today', icon: 'today' },
  { id: 'food', label: 'Food & Protein', short: 'Food', icon: 'food' },
  { id: 'activity', label: 'Activity & Strength', short: 'Activity', icon: 'activity' },
  { id: 'health', label: 'Wegovy & Health', short: 'Health', icon: 'health' },
  { id: 'results', label: 'Results & Trends', short: 'Results', icon: 'results' },
  { id: 'settings', label: 'Settings & Backup', short: 'Settings', icon: 'settings' },
];

function tabFromHash(): Tab {
  const h = location.hash.replace(/^#\/?/, '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
}

export interface ScreenProps {
  date: string;
  today: string;
  setDate: (d: string) => void;
  go: (t: Tab) => void;
}

export default function App() {
  const s = useStore();
  const tz = s.settings.timeZone;
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [today, setToday] = useState(() => todayIn(tz));
  const [date, setDateState] = useState(() => todayIn(tz));
  const [followToday, setFollowToday] = useState(true);

  // Keep "today" correct across midnight and when the app is resumed from the background.
  useEffect(() => {
    const tick = () => {
      const t = todayIn(tz);
      setToday(t);
      if (followToday) setDateState(t);
    };
    tick();
    const iv = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [tz, followToday]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (s.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.settings.theme);
  }, [s.settings.theme]);

  const go = (t: Tab) => {
    if (location.hash !== `#/${t}`) history.pushState(null, '', `#/${t}`);
    setTab(t);
    document.querySelector('main')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };
  const setDate = (d: string) => {
    if (!isValidDate(d)) return;
    setDateState(d);
    setFollowToday(d === today);
  };

  if (!s.ready) return <div className="boot">Loading Momentum…</div>;

  const props: ScreenProps = { date, today, setDate, go };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <div className="brand"><span className="brand-mark" />Momentum</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nav-item ${tab === t.id ? 'on' : ''} ${t.id === 'settings' ? 'nav-settings' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
            data-testid={`nav-${t.id}`}
          >
            <Icon name={t.icon} />
            <span className="nav-long">{t.label}</span>
            <span className="nav-short">{t.short}</span>
          </button>
        ))}
        <p className="nav-note">Data stays on this device.</p>
      </nav>
      <main>
        {s.storageError && <div className="banner banner-warn" role="alert" data-testid="storage-error">{s.storageError}</div>}
        {tab !== 'settings' && <DateBar date={date} today={today} setDate={setDate} title={current.label} />}
        {tab === 'today' && <Today {...props} />}
        {tab === 'food' && <Food {...props} />}
        {tab === 'activity' && <Activity {...props} />}
        {tab === 'health' && <Health {...props} />}
        {tab === 'results' && <Results {...props} />}
        {tab === 'settings' && <SettingsScreen {...props} />}
      </main>
      <Toaster />
    </div>
  );
}

function DateBar({ date, today, setDate, title }: { date: string; today: string; setDate: (d: string) => void; title: string }) {
  const s = useStore().settings;
  const pd = programDay(s, date);
  const len = programLength(s);
  let program: string;
  if (pd < 1) program = pd === 0 ? 'Program starts tomorrow' : `Program starts in ${1 - pd} days`;
  else if (pd > len) program = `Program finished · day ${pd}`;
  else program = `Day ${pd} of ${len}`;
  return (
    <header className="datebar">
      <div className="datebar-title">
        <p className="eyebrow">{title}</p>
        <h1 data-testid="current-date">{formatLong(date)}</h1>
        <p className="program-day" data-testid="program-day">{program}{date !== today && <span className="pill">Viewing {date < today ? 'a past day' : 'a future day'}</span>}</p>
      </div>
      <div className="datebar-nav">
        <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} data-testid="prev-day"><Icon name="left" /></button>
        <label className="date-pick">
          <span className="sr-only">Choose date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} data-testid="date-input" />
        </label>
        <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} data-testid="next-day"><Icon name="right" /></button>
        {date !== today && <button type="button" className="btn btn-small" onClick={() => setDate(today)} data-testid="go-today">Today</button>}
      </div>
    </header>
  );
}
