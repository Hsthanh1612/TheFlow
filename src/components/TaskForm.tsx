import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, Modal } from './ui';
import { useData } from '../state/data';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { createTask } from '../services/firebase/taskRepo';
import { validateCustomFields } from '../domain/fields';
import { hasPerm } from '../domain/permissions';
import { addDays } from '../domain/dates';
import type { CustomValue, FieldDef, Priority, TaskTemplate } from '../domain/types';

interface Api { open: (o?: { templateId?: string; typeId?: string }) => void }
const Ctx = createContext<Api | null>(null);
export const useTaskForm = (): Api => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTaskForm ngoài TaskFormProvider');
  return c;
};

export function TaskFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ templateId?: string; typeId?: string } | null>(null);
  const api = useMemo<Api>(() => ({ open: (o) => setState(o ?? {}) }), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      <TaskFormModal state={state} onClose={() => setState(null)} />
    </Ctx.Provider>
  );
}

/** Ô nhập một trường động, sinh từ định nghĩa trường (không viết cứng loại việc nào). */
export function FieldInput({ def, value, onChange, error, idPrefix }: { def: FieldDef; value: CustomValue | undefined; onChange: (v: CustomValue) => void; error?: string; idPrefix: string }) {
  const { users } = useData();
  const id = `${idPrefix}-${def.key}`;
  let input: ReactNode;
  switch (def.type) {
    case 'longtext':
      input = <textarea id={id} className="inp" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />;
      break;
    case 'number':
      input = <input id={id} type="number" className="inp" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} aria-invalid={!!error} />;
      break;
    case 'date':
      input = <input id={id} type="date" className="inp" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-invalid={!!error} />;
      break;
    case 'select':
      input = (
        <select id={id} className="inp" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-invalid={!!error}>
          <option value="">— Chọn —</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'multiselect':
      input = (
        <div className="row" id={id} role="group" aria-label={def.label}>
          {def.options.map((o) => {
            const cur = Array.isArray(value) ? value : [];
            return (
              <label key={o} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} /> {o}
              </label>
            );
          })}
        </div>
      );
      break;
    case 'user':
      input = (
        <select id={id} className="inp" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— Chọn —</option>
          {users.filter((u) => u.active).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
        </select>
      );
      break;
    case 'checkbox':
      input = <label className="row"><input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Có</label>;
      break;
    case 'url':
    case 'file':
      input = <input id={id} type="url" className="inp" placeholder="https://…" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-invalid={!!error} />;
      break;
    default:
      input = <input id={id} className="inp" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-invalid={!!error} maxLength={200} />;
  }
  return <Field label={`${def.label}${def.required ? ' *' : ''}`} htmlFor={id} error={error}>{input}</Field>;
}

function TaskFormModal({ state, onClose }: { state: { templateId?: string; typeId?: string } | null; onClose: () => void }) {
  return <Modal open={state !== null} title="Tạo việc" onClose={onClose}>{state && <TaskFormBody init={state} onClose={onClose} />}</Modal>;
}

const PRIORITIES: { v: Priority; l: string }[] = [{ v: 'low', l: 'Thấp' }, { v: 'normal', l: 'Bình thường' }, { v: 'high', l: 'Cao' }];

function TaskFormBody({ init, onClose }: { init: { templateId?: string; typeId?: string }; onClose: () => void }) {
  const { taskTypes, workflows, users, units, templates, today, userById } = useData();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const tpl: TaskTemplate | undefined = templates.find((t) => t.id === init.templateId);
  const types = taskTypes.filter((t) => !t.archived);
  const [typeId, setTypeId] = useState(tpl?.typeId ?? init.typeId ?? types[0]?.id ?? '');
  const [title, setTitle] = useState(tpl?.title ?? '');
  const [description, setDescription] = useState(tpl?.description ?? '');
  const [priority, setPriority] = useState<Priority>(tpl?.priority ?? 'normal');
  const [dueAt, setDueAt] = useState(tpl ? addDays(today, tpl.dueOffsetDays) : '');
  const [labels, setLabels] = useState('');
  const [checklist] = useState<string[]>(tpl?.checklist ?? []);
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [assignee, setAssignee] = useState(profile?.uid ?? '');
  const [reviewer, setReviewer] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const type = taskTypes.find((t) => t.id === typeId);
  const workflow = workflows.find((w) => w.id === type?.workflowId);
  const myUnit = profile?.unitId ?? '';
  // Chỉ người có quyền giao việc mới chọn được người khác; còn lại tự giao cho mình (Rules cũng chặn).
  const canAssignOthers = hasPerm(principal, 'task.assign', null) || (principal?.scopes['task.assign']?.length ?? 0) > 0 || principal?.isAdmin === true;
  const candidates = users.filter((u) => u.active && u.unitId);
  const unitId = canAssignOthers ? (userById(assignee)?.unitId ?? myUnit) : myUnit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !type || !workflow || !profile) return;
    const errs: Record<string, string> = validateCustomFields(type.fields, custom);
    if (title.trim().length === 0) errs.title = 'Tiêu đề là bắt buộc.';
    if (!unitId) errs.assignee = 'Tài khoản của bạn chưa thuộc đơn vị nào — hãy nhờ quản trị viên gán đơn vị.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    const res = await toast.run(
      () => createTask({ type, workflow, title, description, priority, labels: labels.split(',').map((x) => x.trim()).filter(Boolean), startAt: null, dueAt: dueAt || null, unitId, assigneeIds: [assignee || profile.uid], collaboratorIds: [], reviewerIds: reviewer ? [reviewer] : [], checklist, customFields: custom, templateId: tpl?.id ?? null }, profile),
      'Đã tạo việc.',
    );
    setBusy(false);
    if (res.ok) {
      onClose();
      nav(`/task/${res.value}`);
    }
  }

  return (
    <form className="col" onSubmit={submit} noValidate>
      <div className="g2">
        <Field label="Loại việc" htmlFor="tf-type">
          <select id="tf-type" className="inp" value={typeId} onChange={(e) => { setTypeId(e.target.value); setCustom({}); }}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Hạn chót" htmlFor="tf-due"><input id="tf-due" type="date" className="inp" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
      </div>
      <Field label="Tiêu đề *" htmlFor="tf-title" error={errors.title}><input id="tf-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={!!errors.title} autoFocus /></Field>
      <Field label="Mô tả" htmlFor="tf-desc"><textarea id="tf-desc" className="inp" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} /></Field>
      <div className="g2">
        <Field label="Ưu tiên" htmlFor="tf-prio"><select id="tf-prio" className="inp" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></Field>
        <Field label="Nhãn (cách nhau bằng dấu phẩy)" htmlFor="tf-labels"><input id="tf-labels" className="inp" value={labels} onChange={(e) => setLabels(e.target.value)} /></Field>
        <Field label="Người phụ trách" htmlFor="tf-asg" error={errors.assignee} hint={canAssignOthers ? undefined : 'Bạn chỉ tạo được việc cho chính mình.'}>
          <select id="tf-asg" className="inp" value={assignee} disabled={!canAssignOthers} onChange={(e) => setAssignee(e.target.value)}>
            {(canAssignOthers ? candidates : candidates.filter((u) => u.uid === profile?.uid)).map((u) => <option key={u.uid} value={u.uid}>{u.name} — {units.find((x) => x.id === u.unitId)?.name ?? ''}</option>)}
          </select>
        </Field>
        {workflow && workflow.states.some((s) => s.category === 'review') && (
          <Field label="Người duyệt" htmlFor="tf-rev">
            <select id="tf-rev" className="inp" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option value="">— Chưa chọn —</option>
              {candidates.filter((u) => u.uid !== assignee).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      {type && type.fields.filter((f) => !f.archived).sort((a, b) => a.order - b.order).length > 0 && (
        <fieldset className="col" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
          <legend className="note">Thông tin theo loại việc “{type.name}”</legend>
          {type.fields.filter((f) => !f.archived).sort((a, b) => a.order - b.order).map((f) => (
            <FieldInput key={f.key} def={f} value={custom[f.key]} onChange={(v) => setCustom((c) => ({ ...c, [f.key]: v }))} error={errors[f.key]} idPrefix="tf" />
          ))}
        </fieldset>
      )}
      {checklist.length > 0 && <p className="note">Checklist từ mẫu: {checklist.length} mục sẽ được thêm.</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>Huỷ</button>
        <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo việc'}</button>
      </div>
    </form>
  );
}
