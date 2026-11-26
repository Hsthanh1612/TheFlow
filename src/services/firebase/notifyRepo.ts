import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { getServices } from './init';
import { nowIso, reminderId } from './ids';
import { classify } from '../errors';
import type { ThemeId } from '../../state/theme';

export async function markRead(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    for (const id of ids) b.update(doc(db, 'users', uid, 'notifications', id), { readAt: nowIso() });
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

/** Lưu chủ đề màu vào hồ sơ (chạy ngầm; lỗi chỉ ghi nhận, vì chủ đề đã áp dụng cục bộ). */
export async function saveTheme(uid: string, theme: ThemeId): Promise<void> {
  try {
    await updateDoc(doc(getServices().db, 'users', uid), { theme });
  } catch (e) {
    throw classify(e);
  }
}

export async function renameSelf(uid: string, name: string): Promise<void> {
  try {
    await updateDoc(doc(getServices().db, 'users', uid), { name: name.trim().slice(0, 100) });
  } catch (e) {
    throw classify(e);
  }
}

import { getDoc, setDoc } from 'firebase/firestore';

/** Tạo thông báo nhắc hạn cho CHÍNH MÌNH, ID xác định theo (việc, số ngày còn lại) => không bao giờ tạo trùng. */
export async function ensureReminder(uid: string, taskId: string, left: number, text: string, atMs: number): Promise<boolean> {
  const ref = doc(getServices().db, 'users', uid, 'notifications', reminderId(atMs, taskId, left));
  try {
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, { actorId: uid, taskId, kind: left < 0 ? 'overdue' : 'reminder', text: text.slice(0, 300), createdAt: nowIso(), readAt: null });
    return true;
  } catch (e) {
    throw classify(e);
  }
}
