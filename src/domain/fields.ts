import type { CustomValue, FieldDef } from './types';
import { isValidDay } from './dates';

export type FieldErrors = Record<string, string>;

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Kiểm tra giá trị trường động theo định nghĩa của loại việc. Trả về lỗi theo khoá trường. */
export function validateCustomFields(defs: FieldDef[], values: Record<string, CustomValue>): FieldErrors {
  const errs: FieldErrors = {};
  for (const f of defs) {
    if (f.archived) continue;
    const v = values[f.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required && f.type !== 'checkbox') errs[f.key] = `${f.label} là bắt buộc.`;
      continue;
    }
    switch (f.type) {
      case 'text':
        if (typeof v !== 'string' || v.length > 200) errs[f.key] = `${f.label} phải là văn bản tối đa 200 ký tự.`;
        break;
      case 'longtext':
        if (typeof v !== 'string' || v.length > 5000) errs[f.key] = `${f.label} phải là văn bản tối đa 5000 ký tự.`;
        break;
      case 'number':
        if (typeof v !== 'number' || !Number.isFinite(v)) errs[f.key] = `${f.label} phải là số.`;
        break;
      case 'date':
        if (typeof v !== 'string' || !isValidDay(v)) errs[f.key] = `${f.label} phải là ngày hợp lệ.`;
        break;
      case 'select':
        if (typeof v !== 'string' || !f.options.includes(v)) errs[f.key] = `${f.label} phải chọn một giá trị trong danh sách.`;
        break;
      case 'multiselect':
        if (!Array.isArray(v) || v.some((x) => !f.options.includes(x))) errs[f.key] = `${f.label} có giá trị ngoài danh sách.`;
        break;
      case 'user':
        if (typeof v !== 'string') errs[f.key] = `${f.label} phải là một người dùng.`;
        break;
      case 'file':
      case 'url':
        if (typeof v !== 'string' || !isHttpUrl(v)) errs[f.key] = `${f.label} phải là đường dẫn http(s) hợp lệ.`;
        break;
      case 'checkbox':
        if (typeof v !== 'boolean') errs[f.key] = `${f.label} phải là có/không.`;
        break;
    }
  }
  return errs;
}

/** Chỉ giữ giá trị của trường đang hoạt động; bỏ undefined (Firestore không nhận undefined). */
export function normalizeCustomFields(defs: FieldDef[], values: Record<string, CustomValue>): Record<string, CustomValue> {
  const out: Record<string, CustomValue> = {};
  for (const f of defs) {
    if (f.archived) continue;
    const v = values[f.key];
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

/** Trường bị lưu trữ vẫn giữ dữ liệu cũ (không xoá cứng). */
export function preserveArchived(defs: FieldDef[], old: Record<string, CustomValue>, next: Record<string, CustomValue>): Record<string, CustomValue> {
  const out = { ...next };
  for (const f of defs) if (f.archived && old[f.key] !== undefined) out[f.key] = old[f.key];
  return out;
}

export const FIELD_TYPE_LABELS: Record<FieldDef['type'], string> = {
  text: 'Văn bản',
  longtext: 'Văn bản dài',
  number: 'Số',
  date: 'Ngày',
  select: 'Danh sách chọn',
  multiselect: 'Chọn nhiều',
  user: 'Người dùng',
  file: 'Tệp (liên kết)',
  url: 'Đường dẫn',
  checkbox: 'Có/Không',
};
