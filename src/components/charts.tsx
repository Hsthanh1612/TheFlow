import { useState } from 'react';

// Biểu đồ SVG thuần (không thêm thư viện): đường, cột nhóm. Có tooltip khi rê chuột/focus và có thể xem dạng bảng.

const W = 640;
const H = 240;
const PAD = { l: 36, r: 12, t: 12, b: 28 };

export interface Series {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

function scaleX(i: number, n: number): number {
  return n <= 1 ? PAD.l : PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1);
}

export function LineChart({ labels, series, max = 100, unit = '%' }: { labels: string[]; series: Series[]; max?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const y = (v: number) => PAD.t + (1 - Math.min(v, max) / max) * (H - PAD.t - PAD.b);
  const ticks = [0, max / 2, max];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E5E7EB" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{t}{unit}</text>
          </g>
        ))}
        {labels.map((l, i) => (labels.length <= 12 || i % 2 === 0 ? <text key={l} x={scaleX(i, labels.length)} y={H - 8} textAnchor="middle">{l}</text> : null))}
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" points={s.values.map((v, i) => `${scaleX(i, labels.length)},${y(v)}`).join(' ')} />
        ))}
        {hover !== null && <line x1={scaleX(hover, labels.length)} x2={scaleX(hover, labels.length)} y1={PAD.t} y2={H - PAD.b} stroke="#9CA3AF" strokeDasharray="3 3" />}
        {labels.map((l, i) => (
          <rect key={l} x={scaleX(i, labels.length) - (W - PAD.l - PAD.r) / Math.max(labels.length - 1, 1) / 2} y={PAD.t} width={(W - PAD.l - PAD.r) / Math.max(labels.length - 1, 1)} height={H - PAD.t - PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="sr-only"><DataTable labels={labels} series={series} unit={unit} /></div>
      {hover !== null && (
        <div className="tip" style={{ left: `${(scaleX(hover, labels.length) / W) * 100}%`, top: 24 }}>
          <strong>Tuần {labels[hover]}</strong>
          {series.map((s) => (
            <div key={s.name}>{s.name}: {s.values[hover]}{unit}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ColumnChart({ labels, series }: { labels: string[]; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const slot = (W - PAD.l - PAD.r) / Math.max(labels.length, 1);
  const bw = Math.min(18, (slot - 6) / series.length);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E5E7EB" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={l} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill={hover === i ? 'rgba(37,99,235,.06)' : 'transparent'} />
              {series.map((s, k) => (
                <rect key={s.name} x={cx - (series.length * bw) / 2 + k * bw} y={y(s.values[i])} width={bw - 2} height={H - PAD.b - y(s.values[i])} rx="3" fill={s.color} />
              ))}
              {(labels.length <= 12 || i % 2 === 0) && <text x={cx} y={H - 8} textAnchor="middle">{l}</text>}
            </g>
          );
        })}
      </svg>
      <div className="sr-only"><DataTable labels={labels} series={series} /></div>
      {hover !== null && (
        <div className="tip" style={{ left: `${((PAD.l + slot * hover + slot / 2) / W) * 100}%`, top: 24 }}>
          <strong>Tuần {labels[hover]}</strong>
          {series.map((s) => (
            <div key={s.name}>{s.name}: {s.values[hover]}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.name}>
          <i className="sw" style={{ background: i.dashed ? 'transparent' : i.color, border: i.dashed ? `2px dashed ${i.color}` : undefined }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

export function DataTable({ labels, series, unit = '' }: { labels: string[]; series: Series[]; unit?: string }) {
  return (
    <div className="scroll">
      <table className="tbl">
        <caption className="sr-only">Số liệu biểu đồ</caption>
        <thead>
          <tr>
            <th scope="col">Tuần</th>
            {series.map((s) => (
              <th key={s.name} scope="col">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l}>
              <th scope="row">{l}</th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i]}{unit}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
