// Kiểu dữ liệu nghiệp vụ. Mọi loại việc/trường/quy trình/vai trò đều là DỮ LIỆU CẤU HÌNH (xem BRIEF mục 1, 7).

export type FieldType = 'text' | 'longtext' | 'number' | 'date' | 'select' | 'multiselect' | 'user' | 'file' | 'url' | 'checkbox';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  order: number;
  archived: boolean;
}

export type StateCategory = 'todo' | 'doing' | 'review' | 'done';

export interface WorkflowState {
  key: string;
  label: string;
  category: StateCategory;
}

/** Ai được phép thực hiện một bước chuyển. Cùng ngữ nghĩa với Firestore Rules. */
export type ActorKind = 'assignee' | 'collaborator' | 'reviewer' | 'creator' | 'approver' | 'approver_all' | 'assigner';

export interface Transition {
  from: string;
  to: string;
  allowed: ActorKind[];
  requiresComment: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  initialState: string;
  states: WorkflowState[];
  transitions: Transition[];
  /** Các bản "phẳng" để Firestore Rules tra cứu (suy ra từ states/transitions, không sửa tay). */
  allowed: Record<string, ActorKind[]>; // "from>to" -> ai được chuyển
  needsComment: Record<string, boolean>; // "from>to" -> bắt buộc ý kiến
  doneStates: string[]; // khoá các trạng thái thuộc nhóm Hoàn thành
  archived: boolean;
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
  workflowId: string;
  fields: FieldDef[];
  archived: boolean;
}

export type OrgKind = 'khoa' | 'bomon' | 'to';

export interface OrgUnit {
  id: string;
  parentId: string | null;
  name: string;
  kind: OrgKind;
  color: string;
  headId: string | null;
  archived: boolean;
}

export type PermKey =
  | 'task.view_all'
  | 'task.assign'
  | 'task.bulk_assign'
  | 'task.approve'
  | 'task.reassign'
  | 'task.extend'
  | 'manage.view'
  | 'report.export'
  | 'config.edit'
  | 'user.manage';

export const ALL_PERMS: readonly PermKey[] = [
  'task.view_all',
  'task.assign',
  'task.bulk_assign',
  'task.approve',
  'task.reassign',
  'task.extend',
  'manage.view',
  'report.export',
  'config.edit',
  'user.manage',
];

export interface Role {
  key: string;
  name: string;
  permissions: PermKey[];
  archived: boolean;
}

export interface Assignment {
  roleKey: string;
  unitId: string;
}

/** perm -> danh sách unitId được áp dụng (đã bung cả đơn vị con). '*' = toàn Khoa. */
export type Scopes = Partial<Record<PermKey, string[]>>;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  active: boolean;
  unitId: string | null;
  assignments: Assignment[];
  scopes: Scopes;
  createdAt: string;
  /** Chủ đề màu giao diện người dùng tự chọn (id trong state/theme). */
  theme?: string;
  /** Chế độ sáng/tối người dùng tự chọn: 'light' | 'dark' | 'auto' (theo hệ điều hành). */
  mode?: string;
}

export type Priority = 'low' | 'normal' | 'high';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskLink {
  name: string;
  url: string;
}

export type CustomValue = string | number | boolean | string[] | null;

export interface Task {
  id: string;
  typeId: string;
  workflowId: string; // bản sao bất biến của quy trình lúc tạo, để Rules tra cứu
  title: string;
  description: string;
  stateKey: string;
  priority: Priority;
  labels: string[];
  startAt: string | null; // YYYY-MM-DD
  dueAt: string | null; // YYYY-MM-DD
  unitId: string;
  assigneeIds: string[];
  collaboratorIds: string[];
  reviewerIds: string[];
  participantIds: string[];
  checklist: ChecklistItem[];
  links: TaskLink[];
  customFields: Record<string, CustomValue>;
  activity: Record<string, ActivityEntry>; // map idMục -> mục; chỉ thêm, không sửa (Rules kiểm tra)
  lastActivityId: string | null; // mục vừa thêm ở lần ghi gần nhất (để Rules xác minh người ghi)
  statusNote: string; // ý kiến kèm bước chuyển gần nhất (bắt buộc khi trả lại)
  statusNoteAt: string | null;
  templateId: string | null;
  bulkId: string | null;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  completedAt: string | null; // ISO
}

export interface TaskTemplate {
  id: string;
  name: string;
  typeId: string;
  title: string;
  description: string;
  priority: Priority;
  checklist: string[];
  dueOffsetDays: number;
  recurrence: Recurrence | null;
  archived: boolean;
}

export type Recurrence = { kind: 'weekly' | 'monthly' | 'term'; active: boolean };

export interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AppSettings {
  riskDays: number; // còn <= N ngày
  riskProgress: number; // mà tiến độ < N %
  reminderDays: number[];
  categoryLabels: Record<StateCategory, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  riskDays: 3,
  riskProgress: 50,
  reminderDays: [3, 1],
  categoryLabels: { todo: 'Chờ làm', doing: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành' },
};

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  taskId: string | null;
  kind: 'assigned' | 'mention' | 'review_requested' | 'approved' | 'returned' | 'reminder' | 'overdue' | 'extended' | 'reassigned' | 'automation';
  text: string;
  createdAt: string;
  readAt: string | null;
}

export interface TaskComment {
  id: string;
  authorId: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface ActivityEntry {
  actorId: string;
  action: string;
  detail: string;
  createdAt: string;
}

// ---------- Theo dõi thời gian ----------
export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  unitId: string; // sao chép từ việc để Rules/báo cáo lọc theo đơn vị
  day: string; // YYYY-MM-DD (ngày bắt đầu, giờ địa phương)
  minutes: number;
  note: string;
  source: 'timer' | 'manual';
  createdAt: string;
}

/** Đồng hồ đang chạy của một người (tối đa một cái), lưu ở users/{uid}/timer/current để theo người dùng sang thiết bị khác. */
export interface RunningTimer {
  taskId: string;
  title: string;
  startedAt: string; // ISO
}

// ---------- Mục tiêu (OKR) ----------
export interface KeyResult {
  id: string;
  text: string;
  target: number;
  current: number;
  unit: string;
}

export type GoalStatus = 'active' | 'done' | 'archived';

export interface Goal {
  id: string;
  name: string;
  description: string;
  unitId: string;
  ownerId: string;
  termId: string | null;
  dueDate: string | null;
  status: GoalStatus;
  keyResults: KeyResult[];
  taskIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Tự động hoá ----------
export type AutoTriggerKind = 'state_changed' | 'task_created' | 'due_soon' | 'overdue';
export type AutoRecipient = 'assignees' | 'collaborators' | 'reviewers' | 'creator' | 'unit_head';

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { kind: AutoTriggerKind; typeId: string | null; toCategory: StateCategory | null; days: number };
  action: { kind: 'notify'; to: AutoRecipient[]; text: string };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Ảnh chụp tình trạng theo tuần ----------
export interface SnapshotCounts {
  todo: number;
  doing: number;
  review: number;
  done: number;
  late: number;
}

export interface WeekSnapshot {
  id: string; // = week
  week: string; // thứ Hai đầu tuần, YYYY-MM-DD
  total: SnapshotCounts;
  byUnit: Record<string, SnapshotCounts>;
  takenBy: string;
  createdAt: string;
}
