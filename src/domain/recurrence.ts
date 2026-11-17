import type { AcademicTerm, Recurrence, TaskTemplate } from './types';
import { addDays, diffDays, weekStart } from './dates';

export interface Occurrence {
  key: string; // khoá kỳ, dùng làm phần của ID tài liệu => chạy lại không tạo trùng
  startDay: string;
}

/** Các kỳ lặp đã "đến lượt" tính đến hôm nay, trong cửa sổ `lookbackDays` ngày gần nhất. */
export function dueOccurrences(rec: Recurrence, today: string, terms: AcademicTerm[], lookbackDays = 14): Occurrence[] {
  if (!rec.active) return [];
  const since = addDays(today, -lookbackDays);
  const out: Occurrence[] = [];
  if (rec.kind === 'weekly') {
    for (let d = weekStart(since); diffDays(d, today) <= 0; d = addDays(d, 7)) {
      if (diffDays(d, since) >= 0) out.push({ key: `w${d}`, startDay: d });
    }
  } else if (rec.kind === 'monthly') {
    const [ty, tm] = today.split('-').map(Number);
    for (let i = 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(ty, tm - 1 - i, 1));
      const d = dt.toISOString().slice(0, 10);
      if (diffDays(d, since) >= 0 && diffDays(d, today) <= 0) out.push({ key: `m${d.slice(0, 7)}`, startDay: d });
    }
  } else {
    for (const t of terms) {
      if (diffDays(t.startDate, since) >= 0 && diffDays(t.startDate, today) <= 0) out.push({ key: `t${t.id}`, startDay: t.startDate });
    }
  }
  return out;
}

export function recurringDocId(tpl: TaskTemplate, occ: Occurrence): string {
  return `rec_${tpl.id}_${occ.key}`;
}
