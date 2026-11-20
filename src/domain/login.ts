// Firebase Auth chỉ định danh bằng email. "Tài khoản" dạng tên đăng nhập (không có @) được quy về email nội bộ
// `<tên>@<miền nội bộ>`. Hàm thuần, không phụ thuộc Firebase/React.

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginId = { ok: true; email: string; isUsername: boolean } | { ok: false; reason: string };

export function toLoginEmail(input: string, domain: string): LoginId {
  const v = input.trim().toLowerCase();
  if (v.length === 0) return { ok: false, reason: 'Vui lòng nhập tài khoản hoặc email.' };
  if (v.includes('@')) return EMAIL_RE.test(v) ? { ok: true, email: v, isUsername: false } : { ok: false, reason: 'Email không hợp lệ.' };
  if (!USERNAME_RE.test(v)) return { ok: false, reason: 'Tài khoản gồm 3–30 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.' };
  return { ok: true, email: `${v}@${domain}`, isUsername: true };
}
