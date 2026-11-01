import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatShort } from '../lib/dates';
import { fmt, type Point } from '../lib/calc';

export interface Series {
  name: string;
  points: Point[];
  color: string; // CSS var reference, e.g. 'var(--series-1)'
  /** 'line' draws a 2px line with gaps for missing days; 'dots' draws only markers */
  style?: 'line' | 'dots' | 'line+dots';
  unit?: string;
  digits?: number;
}

const W = 640;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 26 };

function niceRange(min: number, max: number): [number, number, number[]] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / 4;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return [lo, hi, ticks];
}

/**
 * Line chart over a fixed list of dates. Missing values are gaps — never zero.
 * Shows "Not enough data" when fewer than `minPoints` values exist across all series.
 */
export function LineChart({ series, reference, minPoints = 2, height = H, zeroBased = false, testId, emptyText }: {
  series: Series[];
  reference?: { value: number; label: string }[];
  minPoints?: number;
  height?: number;
  zeroBased?: boolean;
  testId?: string;
  emptyText?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v != null);
  const count = Math.max(0, ...series.map((s) => s.points.filter((p) => p.value != null).length));

  const geo = useMemo(() => {
    const refVals = (reference ?? []).map((r) => r.value);
    const all = [...values, ...refVals];
    if (!all.length) return null;
    const [lo, hi, ticks] = niceRange(zeroBased ? 0 : Math.min(...all), Math.max(...all));
    const x = (i: number) => PAD.l + (dates.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i / (dates.length - 1)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (height - PAD.t - PAD.b);
    return { lo, hi, ticks, x, y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), dates.length, height, zeroBased, JSON.stringify(reference)]);

  if (count < minPoints || !geo) {
    return (
      <div className="chart-empty" data-testid={testId} data-state="empty">
        {emptyText ?? 'Not enough data yet'}
        <span>{count === 0 ? 'Nothing logged in this range.' : `${count} reading${count === 1 ? '' : 's'} so far — a trend needs at least ${minPoints}.`}</span>
      </div>
    );
  }
  const { ticks, x, y } = geo;
  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  const pathFor = (pts: Point[]) => {
    let d = '';
    let pen = false;
    pts.forEach((p, i) => {
      if (p.value == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = dates.length <= 1 ? 0 : Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };

  return (
    <div className="chart" data-testid={testId} data-state="chart">
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} className={s.style === 'dots' ? 'dot' : 'line'} />{s.name}</span>
          ))}
        </div>
      )}
      <div className="chart-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${height}`}
         
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <title id={`${id}-t`}>{series.map((s) => s.name).join(', ')} chart</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{fmt(t, Math.abs(t) < 10 && t % 1 ? 1 : 0)}</text>
            </g>
          ))}
          {dates.map((d, i) => (i % labelEvery === 0 || i === dates.length - 1) && (
            <text key={d} x={x(i)} y={height - 6} className="axis" textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}>{formatShort(d)}</text>
          ))}
          {reference?.map((r) => (
            <g key={r.label}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(r.value)} y2={y(r.value)} className="ref" />
              <text x={W - PAD.r} y={y(r.value) - 5} className="axis" textAnchor="end">{r.label}</text>
            </g>
          ))}
          {series.map((s) => (
            <g key={s.name}>
              {s.style !== 'dots' && <path d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="series-line" />}
              {(s.style === 'dots' || s.style === 'line+dots') && s.points.map((p, i) => p.value != null && (
                <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ))}
              {/* isolated points (no neighbours) would be invisible as a line — show them */}
              {s.style === 'line' && s.points.map((p, i) => p.value != null && s.points[i - 1]?.value == null && s.points[i + 1]?.value == null && (
                <circle key={`iso${i}`} cx={x(i)} cy={y(p.value)} r={3.5} fill={s.color} />
              ))}
            </g>
          ))}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={height - PAD.b} className="crosshair" />
              {series.map((s) => s.points[hover]?.value != null && (
                <circle key={s.name} cx={x(hover)} cy={y(s.points[hover].value!)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <div className="tt-date">{formatShort(dates[hover])}</div>
            {series.map((s) => (
              <div key={s.name} className="tt-row">
                <i style={{ background: s.color }} />
                <b>{s.points[hover]?.value == null ? 'Not logged' : `${fmt(s.points[hover].value, s.digits ?? 0)}${s.unit ?? ''}`}</b>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="link-btn" onClick={() => setTable(!table)}>{table ? 'Hide table' : 'Show as table'}</button>
      {table && <DataTable dates={dates} series={series} />}
    </div>
  );
}

/** Simple bar chart for weekly summaries. Null = no bar + "—" label. */
export function BarChart({ bars, max, unit = '', testId, target }: {
  bars: { label: string; value: number | null; sub?: string }[]; max?: number; unit?: string; testId?: string; target?: (number | null)[];
}) {
  const vals = bars.map((b) => b.value).filter((v): v is number => v != null);
  if (!vals.length) return <div className="chart-empty" data-testid={testId} data-state="empty">Not enough data yet<span>Nothing logged in this range.</span></div>;
  const top = max ?? Math.max(...vals, ...(target ?? []).filter((t): t is number => t != null)) * 1.1;
  return (
    <div className="bars" data-testid={testId} data-state="chart">
      {bars.map((b, i) => (
        <div className="bar-col" key={b.label} title={`${b.label}: ${b.value == null ? 'not logged' : fmt(b.value) + unit}`}>
          <div className="bar-val">{b.value == null ? '—' : fmt(b.value) + unit}</div>
          <div className="bar-track">
            {target?.[i] != null && <div className="bar-target" style={{ bottom: `${(target[i]! / top) * 100}%` }} />}
            {b.value != null && <div className="bar-col-fill" style={{ height: `${Math.max(2, (b.value / top) * 100)}%` }} />}
          </div>
          <div className="bar-lbl">{b.label}</div>
          {b.sub && <div className="bar-sub">{b.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function DataTable({ dates, series }: { dates: string[]; series: Series[] }) {
  const rows = dates.map((d, i) => ({ d, vals: series.map((s) => s.points[i]?.value) })).filter((r) => r.vals.some((v) => v != null));
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Date</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.d}><td>{formatShort(r.d)}</td>{r.vals.map((v, j) => <td key={j}>{v == null ? '—' : fmt(v, series[j].digits ?? 0)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RangeTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="range-tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">{o.label}</button>
      ))}
    </div>
  );
}
