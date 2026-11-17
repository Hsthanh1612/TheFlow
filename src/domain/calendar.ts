import { addDays, formatDay, parseDay, weekStart } from './dates';

export interface MonthCell {
  day: string;
  inMonth: boolean;
}

/** Lưới tháng bắt đầu từ thứ Hai, đủ các tuần chứa tháng đó. month: 1-12. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = formatDay(Date.UTC(year, month - 1, 1));
  const last = formatDay(Date.UTC(year, month, 0));
  const start = weekStart(first);
  const cells: MonthCell[] = [];
  for (let d = start; parseDay(d) <= parseDay(last) || cells.length % 7 !== 0; d = addDays(d, 1)) {
    cells.push({ day: d, inMonth: d.slice(0, 7) === first.slice(0, 7) });
  }
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const t = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
}
