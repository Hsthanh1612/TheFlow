// Mục tiêu (OKR): tiến độ theo kết quả chính (KR) và theo các việc liên kết; sức khoẻ so với thời gian đã trôi. Hàm thuần.
import type { Goal, KeyResult, Task } from './types';
import { diffDays, dayOfIso } from './dates';

export const krPercent = (kr: Pick<KeyResult, 'current' | 'target'>): number =>
  kr.target <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((kr.current / kr.target) * 100)));

export interface GoalProgress {
  pct: number; // tiến độ tổng: trung bình KR nếu có KR, nếu không thì theo việc
  krPct: number | null;
  taskPct: number | null;
  tasksDone: number;
  tasksTotal: number;
  missingTasks: number; // việc liên kết mà người xem không thấy (ngoài phạm vi quyền) nên không tính
}

export function goalProgress(goal: Pick<Goal, 'keyResults' | 'taskIds'>, tasksById: Map<string, Task>, isDone: (t: Task) => boolean): GoalProgress {
  const linked = goal.taskIds.map((id) => tasksById.get(id)).filter((t): t is Task => t !== undefined);
  const tasksDone = linked.filter(isDone).length;
  const taskPct = linked.length === 0 ? null : Math.round((tasksDone / linked.length) * 100);
  const krPct = goal.keyResults.length === 0 ? null : Math.round(goal.keyResults.reduce((a, k) => a + krPercent(k), 0) / goal.keyResults.length);
  return { pct: krPct ?? taskPct ?? 0, krPct, taskPct, tasksDone, tasksTotal: linked.length, missingTasks: goal.taskIds.length - linked.length };
}

export type GoalHealth = 'done' | 'on_track' | 'at_risk' | 'late' | 'no_deadline';

/** So tiến độ thực với tiến độ "đúng kế hoạch" (tuyến tính từ ngày tạo đến hạn). Chậm hơn kế hoạch >20 điểm là "có nguy cơ". */
export function goalHealth(goal: Pick<Goal, 'status' | 'dueDate' | 'createdAt'>, pct: number, today: string): GoalHealth {
  if (goal.status === 'done' || pct >= 100) return 'done';
  if (!goal.dueDate) return 'no_deadline';
  if (diffDays(goal.dueDate, today) < 0) return 'late';
  const start = dayOfIso(goal.createdAt);
  const span = Math.max(1, diffDays(goal.dueDate, start));
  const planned = Math.max(0, Math.min(100, Math.round((diffDays(today, start) / span) * 100)));
  return pct + 20 < planned ? 'at_risk' : 'on_track';
}

export const HEALTH_LABEL: Record<GoalHealth, string> = { done: 'Hoàn thành', on_track: 'Đúng tiến độ', at_risk: 'Có nguy cơ chậm', late: 'Quá hạn', no_deadline: 'Chưa đặt hạn' };
