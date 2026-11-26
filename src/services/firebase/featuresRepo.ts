import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getServices } from './init';
import { invertedTime, newId, nowIso } from './ids';
import { classify, AppError } from '../errors';
import { elapsedMinutes, MAX_ENTRY_MINUTES } from '../../domain/time';
import { todayLocal } from '../../domain/dates';
import type { Automation, Goal, RunningTimer, Task, TimeEntry, WeekSnapshot } from '../../domain/types';
import type { AutoNotice } from '../../domain/automation';
import type { ThemeId } from '../../state/theme';

// ---------- Theo dõi thời gian ----------

/** Bắt đầu bấm giờ cho một việc. Mỗi người chỉ có một đồng hồ chạy: bắt đầu việc khác thì thay thế (người gọi nên dừng cái cũ trước). */
export async function startTimer(uid: string, task: Pick<Task, 'id' | 'title'>): Promise<void> {
  try {
    await setDoc(doc(getServices().db, 'users', uid, 'timer', 'current'), { taskId: task.id, title: task.title.slice(0, 160), startedAt: nowIso() });
  } catch (e) {
    throw classify(e);
  }
}

/** Dừng đồng hồ: ghi một bản ghi giờ công và xoá đồng hồ trong MỘT batch nguyên tử. Trả về số phút đã ghi. */
export async function stopTimer(uid: string, timer: RunningTimer, task: Pick<Task, 'id' | 'unitId'>, note: string): Promise<number> {
  const { db } = getServices();
  const end = nowIso();
  const minutes = elapsedMinutes(timer.startedAt, end);
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'timeEntries', newId()), entryOf(uid, task, localDay(timer.startedAt), minutes, note, 'timer'));
    b.delete(doc(db, 'users', uid, 'timer', 'current'));
    await b.commit();
    return minutes;
  } catch (e) {
    throw classify(e);
  }
}

/** Bỏ đồng hồ đang chạy mà không ghi giờ. */
export async function discardTimer(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(getServices().db, 'users', uid, 'timer', 'current'));
  } catch (e) {
    throw classify(e);
  }
}

export async function addManualEntry(uid: string, task: Pick<Task, 'id' | 'unitId'>, day: string, minutes: number, note: string): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_ENTRY_MINUTES) throw new AppError('data', 'Thời gian phải từ 1 phút đến 24 giờ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayLocal()) throw new AppError('data', 'Ngày không hợp lệ (không được ở tương lai).');
  try {
    await setDoc(doc(getServices().db, 'timeEntries', newId()), entryOf(uid, task, day, minutes, note, 'manual'));
  } catch (e) {
    throw classify(e);
  }
}

export async function deleteTimeEntry(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getServices().db, 'timeEntries', id));
  } catch (e) {
    throw classify(e);
  }
}

const entryOf = (userId: string, task: Pick<Task, 'id' | 'unitId'>, day: string, minutes: number, note: string, source: TimeEntry['source']) =>
  ({ taskId: task.id, userId, unitId: task.unitId, day, minutes, note: note.trim().slice(0, 200), source, createdAt: nowIso() });

/** Ngày địa phương (YYYY-MM-DD) của một thời điểm ISO — để giờ làm lúc 23h không bị tính sang ngày UTC khác. */
export function localDay(iso: string): string {
  return todayLocal(new Date(iso));
}

// ---------- Mục tiêu ----------

export async function saveGoal(goal: Goal): Promise<void> {
  try {
    await setDoc(doc(getServices().db, 'goals', goal.id), { ...goal, name: goal.name.trim(), description: goal.description.trim(), updatedAt: nowIso() });
  } catch (e) {
    throw classify(e);
  }
}

// ---------- Tự động hoá ----------

export async function saveAutomation(a: Automation): Promise<void> {
  try {
    await setDoc(doc(getServices().db, 'automations', a.id), { ...a, name: a.name.trim(), updatedAt: nowIso() });
  } catch (e) {
    throw classify(e);
  }
}

export async function deleteAutomation(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getServices().db, 'automations', id));
  } catch (e) {
    throw classify(e);
  }
}

/**
 * Thông báo theo ngày của CHÍNH MÌNH, ID cố định theo (quy tắc, việc, mốc): chạy lại bao nhiêu lần cũng chỉ tạo một thông báo.
 * Dựa vào Rules: ghi đè tài liệu đã có bị từ chối (permission-denied) — coi là "đã tạo rồi".
 */
export async function ensureAutomationNotice(uid: string, n: AutoNotice, atMs: number): Promise<boolean> {
  try {
    await setDoc(doc(getServices().db, 'users', uid, 'notifications', `${invertedTime(atMs)}-auto-${n.key.replace(/[^A-Za-z0-9_-]/g, '_')}`), { actorId: uid, taskId: n.taskId, kind: 'automation', text: n.text.slice(0, 300), createdAt: nowIso(), readAt: null });
    return true;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'permission-denied') return false;
    throw classify(e);
  }
}

// ---------- Ảnh chụp tuần ----------

/** Tạo ảnh chụp của tuần; trả về false nếu tuần này đã có người chụp (create-only). */
export async function takeSnapshot(s: WeekSnapshot): Promise<boolean> {
  try {
    await setDoc(doc(getServices().db, 'snapshots', s.id), s);
    return true;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'permission-denied') return false;
    throw classify(e);
  }
}

// ---------- Hồ sơ: chế độ sáng/tối ----------

export async function saveMode(uid: string, mode: 'light' | 'dark' | 'auto'): Promise<void> {
  try {
    await updateDoc(doc(getServices().db, 'users', uid), { mode });
  } catch (e) {
    throw classify(e);
  }
}
export type { ThemeId };
