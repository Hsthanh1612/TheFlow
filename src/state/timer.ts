import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useData } from './data';
import { useToast } from './toast';
import { discardTimer, startTimer, stopTimer } from '../services/firebase/featuresRepo';
import { fetchTask } from '../services/firebase/taskRepo';
import { formatMinutes } from '../domain/time';
import type { Task } from '../domain/types';

/** Giây đã trôi kể từ một mốc ISO, cập nhật mỗi giây (chỉ chạy khi có mốc). */
export function useElapsedSeconds(startIso: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startIso) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startIso]);
  return startIso ? Math.max(0, Math.floor((now - Date.parse(startIso)) / 1000)) : 0;
}

/** Bắt đầu / dừng / bỏ đồng hồ. Bắt đầu việc khác khi đang chạy sẽ tự dừng và ghi giờ cho việc cũ (không mất thời gian). */
export function useTimerActions() {
  const { profile } = useAuth();
  const { timer, tasks } = useData();
  const toast = useToast();
  return useMemo(() => {
    const uid = profile?.uid ?? '';
    const stopCurrent = async (note: string): Promise<number | null> => {
      if (!timer) return null;
      const t: Pick<Task, 'id' | 'unitId'> | null = tasks.find((x) => x.id === timer.taskId) ?? (await fetchTask(timer.taskId));
      if (!t) { await discardTimer(uid); return null; }
      return stopTimer(uid, timer, t, note);
    };
    return {
      start: async (task: Pick<Task, 'id' | 'title'>) => {
        if (!uid) return;
        await toast.run(async () => {
          if (timer && timer.taskId !== task.id) await stopCurrent('Tự dừng khi chuyển sang việc khác');
          await startTimer(uid, task);
        }, timer && timer.taskId !== task.id ? 'Đã ghi giờ việc trước và bắt đầu bấm giờ việc này.' : 'Đã bắt đầu bấm giờ.');
      },
      stop: async (note = '') => {
        const r = await toast.run(() => stopCurrent(note), 'Đã dừng và ghi giờ.');
        if (r.ok && r.value) toast.ok(`Đã ghi ${formatMinutes(r.value)}.`);
      },
      discard: async () => { await toast.run(() => discardTimer(uid), 'Đã bỏ đồng hồ, không ghi giờ.'); },
    };
  }, [profile, timer, tasks, toast]);
}
