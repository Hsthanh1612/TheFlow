import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from './auth';
import { useData } from './data';
import { eventNotices, scheduledNotices, type AutoContext } from '../domain/automation';
import { ensureAutomationNotice, takeSnapshot } from '../services/firebase/featuresRepo';
import { hasGlobalPerm } from '../domain/permissions';
import { makeSnapshot, weekKey } from '../domain/snapshot';
import { nowIso } from '../services/firebase/ids';
import { categoryOf } from '../domain/workflow';
import type { Notice } from '../services/firebase/taskRepo';
import type { Task, Workflow } from '../domain/types';

/** Tính các thông báo tự động hoá cho sự kiện vừa xảy ra, để gộp vào cùng batch ghi với thao tác của người dùng. */
export function useAutomation() {
  const { profile } = useAuth();
  const { automations, unitById, userName } = useData();
  return useMemo(() => {
    const actorId = profile?.uid ?? '';
    const ctx: AutoContext = { unitHeadOf: (u) => unitById(u)?.headId ?? null, userName };
    const toNotices = (list: ReturnType<typeof eventNotices>): Notice[] => list.map((n) => ({ userId: n.userId, taskId: n.taskId, kind: 'automation', text: n.text }));
    return {
      forTransition: (task: Task, workflow: Workflow, toKey: string): Notice[] => {
        const s = workflow.states.find((x) => x.key === toKey);
        return s ? toNotices(eventNotices(automations, { type: 'state_changed', task: { ...task, stateKey: toKey }, toCategory: categoryOf(workflow, toKey), toLabel: s.label, actorId }, ctx)) : [];
      },
      forCreate: (task: Task): Notice[] => toNotices(eventNotices(automations, { type: 'task_created', task, actorId }, ctx)),
    };
  }, [automations, profile, unitById, userName]);
}

/**
 * Chạy khi mở app: (1) quy tắc theo ngày cho CHÍNH MÌNH (ID thông báo cố định nên không trùng);
 * (2) người xem được toàn Khoa chụp ảnh tình trạng tuần nếu tuần này chưa có (create-only, người đầu tiên thắng).
 */
export function useBackgroundJobs(): void {
  const { profile, principal } = useAuth();
  const d = useData();
  const doneKeys = useRef(new Set<string>());
  const snapWeek = useRef('');
  const { ready, automations, tasks, today, unitById, userName, categoryOfTask, wfOfTask } = d;

  useEffect(() => {
    if (!profile || !ready || automations.length === 0) return;
    const ctx: AutoContext = { unitHeadOf: (u) => unitById(u)?.headId ?? null, userName };
    for (const n of scheduledNotices(automations, tasks, today, profile.uid, ctx, (t) => categoryOfTask(t) !== 'done')) {
      if (doneKeys.current.has(n.key)) continue;
      doneKeys.current.add(n.key);
      ensureAutomationNotice(profile.uid, n, Date.now()).catch((e) => { if (import.meta.env.DEV) console.warn('Không tạo được thông báo tự động', e); });
    }
  }, [profile, ready, automations, tasks, today, unitById, userName, categoryOfTask]);

  const canSnap = hasGlobalPerm(principal, 'task.view_all');
  useEffect(() => {
    if (!profile || !ready || !canSnap) return;
    const wk = weekKey(today);
    if (snapWeek.current === wk) return;
    snapWeek.current = wk;
    takeSnapshot(makeSnapshot(tasks, wfOfTask, today, profile.uid, nowIso())).catch((e) => { if (import.meta.env.DEV) console.warn('Không chụp được ảnh tuần', e); });
  }, [profile, ready, canSnap, today, tasks, wfOfTask]);
}
