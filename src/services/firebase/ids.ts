export function nowIso(): string {
  return new Date().toISOString();
}

function rand(n: number): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, n);
}

export function newId(): string {
  return `${Date.now().toString(36)}${rand(8)}`;
}

const MAX_MS = 9_999_999_999_999;

/** Tiền tố thời gian ĐẢO NGƯỢC (13 chữ số): sắp ID tăng dần = mới nhất trước. Firestore không quét ngược theo ID. */
export function invertedTime(ms: number): string {
  return String(MAX_MS - ms).padStart(13, '0');
}

/** ID thông báo: sắp theo ID tăng dần = mới nhất trước (không cần composite index). */
export function notificationId(): string {
  return `${invertedTime(Date.now())}-${rand(6)}`;
}

/** ID xác định cho nhắc hạn: cùng (việc, mốc) luôn cùng ID, và vẫn xếp đúng theo thời điểm nhắc. */
export function reminderId(atMs: number, taskId: string, left: number): string {
  return `${invertedTime(atMs)}-rem-${taskId}-${left}`;
}
