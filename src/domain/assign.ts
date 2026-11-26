import type { OrgUnit, Priority, UserProfile } from './types';
import { descendantIds } from './permissions';
import { uniq } from './taskLogic';

export type AssignMode = 'each' | 'shared' | 'unit';
export type ReviewerMode = 'unit_head' | 'dean' | 'none';

export const MAX_BULK_TASKS = 150; // mỗi việc ghi tối đa 3 tài liệu; batch Firestore tối đa 500 thao tác

export interface BulkInput {
  mode: AssignMode;
  userIds: string[];
  unitIds: string[];
  reviewerMode: ReviewerMode;
}

export interface TaskDraft {
  unitId: string;
  assigneeIds: string[];
  collaboratorIds: string[];
  reviewerIds: string[];
  label: string; // mô tả ngắn để xem trước
}

export interface BulkPlan {
  drafts: TaskDraft[];
  skipped: { label: string; reason: string }[];
  errors: string[];
}

function ancestors(units: OrgUnit[], id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cur = units.find((u) => u.id === id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur.id);
    cur = cur.parentId ? units.find((u) => u.id === cur!.parentId) : undefined;
  }
  return out;
}

/** Đơn vị tổ tiên chung thấp nhất. */
export function commonUnit(units: OrgUnit[], unitIds: string[]): string | null {
  if (unitIds.length === 0) return null;
  const chains = unitIds.map((id) => ancestors(units, id));
  return chains[0].find((id) => chains.every((c) => c.includes(id))) ?? null;
}

function reviewersFor(mode: ReviewerMode, unitId: string, assignee: string | null, units: OrgUnit[]): string[] {
  if (mode === 'none') return [];
  const root = units.find((u) => u.parentId === null);
  const pick = (u?: OrgUnit) => (u?.headId && u.headId !== assignee ? [u.headId] : []);
  if (mode === 'dean') return pick(root);
  // unit_head: Trưởng đơn vị; nếu chính người nhận là trưởng đơn vị thì lên cấp trên
  const own = pick(units.find((u) => u.id === unitId));
  if (own.length > 0) return own;
  const chain = ancestors(units, unitId).slice(1);
  for (const id of chain) {
    const r = pick(units.find((u) => u.id === id));
    if (r.length > 0) return r;
  }
  return [];
}

/** Sinh danh sách việc sẽ tạo cho giao công việc. Thuần hàm — dùng cho xem trước và khi giao thật. */
export function planBulkAssign(input: BulkInput, users: UserProfile[], units: OrgUnit[]): BulkPlan {
  const plan: BulkPlan = { drafts: [], skipped: [], errors: [] };
  const userById = new Map(users.map((u) => [u.uid, u]));

  if (input.mode === 'unit') {
    for (const id of uniq(input.unitIds)) {
      const unit = units.find((u) => u.id === id && !u.archived);
      if (!unit) {
        plan.skipped.push({ label: id, reason: 'Đơn vị không tồn tại.' });
        continue;
      }
      const head = unit.headId ? userById.get(unit.headId) : undefined;
      if (!head || !head.active) {
        plan.skipped.push({ label: unit.name, reason: 'Đơn vị chưa có Trưởng đơn vị đang hoạt động.' });
        continue;
      }
      plan.drafts.push({ unitId: unit.id, assigneeIds: [head.uid], collaboratorIds: [], reviewerIds: reviewersFor(input.reviewerMode, unit.id, head.uid, units), label: `${unit.name} → ${head.name}` });
    }
  } else {
    // Gộp người nhận: người chọn lẻ + toàn bộ thành viên của đơn vị được tick
    const picked: string[] = [...input.userIds];
    for (const uid of input.unitIds) {
      const ids = new Set(descendantIds(units, uid));
      for (const u of users) if (u.unitId && ids.has(u.unitId)) picked.push(u.uid);
    }
    const recipients: UserProfile[] = [];
    for (const uid of uniq(picked)) {
      const u = userById.get(uid);
      if (!u) plan.skipped.push({ label: uid, reason: 'Không tìm thấy người dùng.' });
      else if (!u.active) plan.skipped.push({ label: u.name, reason: 'Tài khoản chưa được kích hoạt.' });
      else if (!u.unitId) plan.skipped.push({ label: u.name, reason: 'Chưa thuộc đơn vị nào.' });
      else recipients.push(u);
    }
    if (input.mode === 'each') {
      for (const u of recipients) {
        plan.drafts.push({ unitId: u.unitId!, assigneeIds: [u.uid], collaboratorIds: [], reviewerIds: reviewersFor(input.reviewerMode, u.unitId!, u.uid, units), label: u.name });
      }
    } else if (recipients.length > 0) {
      const lead = recipients[0];
      const unitId = commonUnit(units, uniq(recipients.map((r) => r.unitId!))) ?? lead.unitId!;
      plan.drafts.push({
        unitId,
        assigneeIds: [lead.uid],
        collaboratorIds: recipients.slice(1).map((r) => r.uid),
        reviewerIds: reviewersFor(input.reviewerMode, unitId, lead.uid, units),
        label: `${lead.name} phụ trách, ${recipients.length - 1} người phối hợp`,
      });
    }
  }
  if (plan.drafts.length === 0) plan.errors.push('Chưa có người nhận hợp lệ.');
  if (plan.drafts.length > MAX_BULK_TASKS) plan.errors.push(`Tối đa ${MAX_BULK_TASKS} việc mỗi lần giao (hiện ${plan.drafts.length}).`);
  return plan;
}

export interface BaseTask {
  typeId: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: Priority;
}
