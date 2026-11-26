// Tìm kiếm toàn cục (Cmd/Ctrl+K): khớp không dấu, không phân biệt hoa thường, mọi từ khoá phải xuất hiện. Hàm thuần.

/** Bỏ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Searchable {
  id: string;
  title: string;
  /** Các trường phụ cũng được tìm (nhãn, loại việc, người phụ trách, đơn vị…). */
  extra: string[];
}

/** 0 = không khớp. Điểm cao hơn = liên quan hơn (tiêu đề bắt đầu bằng từ khoá > đầu từ > chứa > trường phụ). */
export function scoreMatch(query: string, item: Searchable): number {
  const tokens = fold(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return 0;
  const title = fold(item.title);
  const extra = item.extra.map(fold);
  let score = 0;
  for (const tk of tokens) {
    if (title.startsWith(tk)) score += 6;
    else if (title.split(' ').some((w) => w.startsWith(tk))) score += 4;
    else if (title.includes(tk)) score += 2;
    else if (extra.some((e) => e.split(' ').some((w) => w.startsWith(tk)))) score += 1.5;
    else if (extra.some((e) => e.includes(tk))) score += 1;
    else return 0;
  }
  return score;
}

export function rank<T extends Searchable>(query: string, items: T[], limit: number): T[] {
  return items
    .map((it, i) => ({ it, s: scoreMatch(query, it), i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.it);
}
