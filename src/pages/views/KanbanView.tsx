import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui';
import { AssigneeAvatars, TypeTag, useTaskView } from '../../components/taskBits';
import { NoteDialog } from '../../components/dialogs';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { AppError } from '../../services/errors';
import { transitionTask } from '../../services/firebase/taskRepo';
import { checkTransition, firstReachableInCategory } from '../../domain/workflow';
import { sortByDue } from '../../domain/filters';
import { vnDayMonth } from '../../domain/dates';
import type { StateCategory, Task, WorkflowState } from '../../domain/types';
import { useTaskForm } from '../../components/TaskForm';

interface Col { key: string; label: string; cat: StateCategory }
const CATS: StateCategory[] = ['todo', 'doing', 'review', 'done'];

export function KanbanView({ tasks, typeId }: { tasks: Task[]; typeId: string }) {
  const v = useTaskView();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const form = useTaskForm();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, setPending] = useState<{ task: Task; to: WorkflowState } | null>(null);

  // Cột lấy từ quy trình của loại việc đang lọc; nếu xem nhiều loại thì gom theo nhóm trạng thái.
  const wf = typeId ? v.wfOfType(typeId) : undefined;
  const cols: Col[] = useMemo(
    () => (wf ? wf.states.map((s) => ({ key: s.key, label: s.label, cat: s.category })) : CATS.map((c) => ({ key: c, label: v.settings.categoryLabels[c], cat: c }))),
    [wf, v.settings],
  );
  const inCol = (c: Col, t: Task) => (wf ? t.stateKey === c.key : v.categoryOfTask(t) === c.cat);

  async function drop(col: Col) {
    setOver(null);
    const t = tasks.find((x) => x.id === drag);
    setDrag(null);
    if (!t || !profile) return;
    const w = v.wfOfTask(t);
    if (!w) return toast.fail(new AppError('data', 'Không tìm thấy quy trình của việc này.'));
    const target = wf ? w.states.find((s) => s.key === col.key) : firstReachableInCategory(w, t, col.cat, principal);
    if (!target || target.key === t.stateKey) {
      if (!target) toast.fail(new AppError('permission', `Bạn không thể chuyển việc này sang “${col.label}”.`));
      return;
    }
    const c = checkTransition(w, t, target.key, principal);
    if (!c.ok) return toast.fail(new AppError('permission', c.reason ?? 'Không được phép.'));
    if (c.requiresComment) return setPending({ task: t, to: target });
    await toast.run(() => transitionTask({ task: t, workflow: w, to: target.key, note: '', actor: profile, principal }), `Đã chuyển sang “${target.label}”.`);
  }

  return (
    <>
      <div className="kb" role="group" aria-label="Bảng Kanban">
        {cols.map((c) => {
          const items = sortByDue(tasks.filter((t) => inCol(c, t)));
          return (
            <section key={c.key} className={`kc${over === c.key ? ' over' : ''}`} aria-label={`${c.label}, ${items.length} việc`}
              onDragOver={(e) => { e.preventDefault(); setOver(c.key); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); void drop(c); }}>
              <div className="kh">{c.label}<span>{items.length}</span></div>
              {items.map((t) => {
                const late = v.status(t) === 'late';
                const chk = t.checklist.length ? `${t.checklist.filter((i) => i.done).length}/${t.checklist.length}` : null;
                return (
                  <Link key={t.id} to={`/task/${t.id}`} className={`tk${drag === t.id ? ' drag' : ''}`} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)}>
                    <div className="row" style={{ gap: 6 }}>
                      <TypeTag typeId={t.typeId} />
                      {t.priority === 'high' && <span className="b late">Ưu tiên cao</span>}
                      {wf === undefined && v.stateLabel(t) !== c.label && <span className="tg">{v.stateLabel(t)}</span>}
                    </div>
                    <strong>{t.title}</strong>
                    <div className="meta">
                      <span style={{ color: late ? 'var(--danger)' : undefined }}><Icon name="clock" size={14} />{vnDayMonth(t.dueAt)}</span>
                      {chk && <span><Icon name="check" size={14} />{chk}</span>}
                      <AssigneeAvatars t={t} />
                    </div>
                  </Link>
                );
              })}
              {items.length === 0 && <div className="note" style={{ textAlign: 'center', padding: 8 }}>Không có việc</div>}
              {c.cat === 'todo' && <button className="btn sm" style={{ borderStyle: 'dashed', background: 'transparent' }} onClick={() => form.open({ typeId: typeId || undefined })}><Icon name="plus" size={14} />Thêm việc</button>}
            </section>
          );
        })}
      </div>
      <p className="note">Kéo thả thẻ để đổi trạng thái (theo quy trình và quyền của bạn). Dùng bàn phím: mở thẻ rồi chọn bước chuyển ở trang chi tiết.</p>
      <NoteDialog open={pending !== null} title={pending ? `Chuyển sang “${pending.to.label}”` : ''} label="Ý kiến (bắt buộc)" required confirmText="Xác nhận" onClose={() => setPending(null)}
        onSubmit={async (note) => {
          const p = pending;
          if (!p || !profile) return;
          const w = v.wfOfTask(p.task);
          if (!w) return;
          const res = await toast.run(() => transitionTask({ task: p.task, workflow: w, to: p.to.key, note, actor: profile, principal }), 'Đã cập nhật.');
          if (res.ok) setPending(null);
        }} />
    </>
  );
}
