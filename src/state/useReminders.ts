import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { useData } from './data';
import { ensureReminder } from '../services/firebase/notifyRepo';
import { daysLeft } from '../domain/taskLogic';
import { addDays, parseDay, vnDate } from '../domain/dates';

/**
 * Nhắc hạn trong ứng dụng (không có máy chủ chạy nền trên gói Spark): khi người dùng mở app, tạo thông báo cho
 * các việc của MÌNH còn đúng N ngày (theo thiết lập) hoặc đã quá hạn. ID xác định => mỗi mốc chỉ nhắc một lần.
 */
export function useReminders(): void {
  const { profile } = useAuth();
  const { ready, tasks, today, settings, categoryOfTask } = useData();
  const done = useRef(new Set<string>());
  useEffect(() => {
    if (!profile || !ready) return;
    for (const t of tasks) {
      if (!t.assigneeIds.includes(profile.uid) || categoryOfTask(t) === 'done') continue;
      const left = daysLeft(t, today);
      if (left === null) continue;
      const hit = left < 0 ? -1 : settings.reminderDays.includes(left) ? left : null;
      if (hit === null) continue;
      const key = `${t.id}-${hit}`;
      if (done.current.has(key)) continue;
      done.current.add(key);
      const text = hit < 0 ? `“${t.title}” đã quá hạn (${vnDate(t.dueAt)})` : `“${t.title}” còn ${hit} ngày đến hạn (${vnDate(t.dueAt)})`;
      ensureReminder(profile.uid, t.id, hit, text, parseDay(addDays(t.dueAt!, -hit))).catch((e) => { if (import.meta.env.DEV) console.warn('Không tạo được nhắc hạn', e); });
    }
  }, [profile, ready, tasks, today, settings.reminderDays, categoryOfTask]);
}
