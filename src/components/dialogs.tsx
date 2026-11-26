import { useEffect, useState, type FormEvent } from 'react';
import { Field, Modal } from './ui';
import { useData } from '../state/data';
import { addDays } from '../domain/dates';
import { useAuth } from '../state/auth';
import { REMINDER_MAX } from '../services/firebase/taskRepo';
import type { Task } from '../domain/types';

/** Hộp nhập ý kiến/lý do (trả lại, gia hạn…). Chỉ đóng khi `onSubmit` hoàn tất (do bên gọi quyết định). */
export function NoteDialog({ open, title, label, required, confirmText, onClose, onSubmit, children }: { open: boolean; title: string; label: string; required?: boolean; confirmText: string; onClose: () => void; onSubmit: (note: string) => Promise<void>; children?: React.ReactNode }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setNote(''); setErr(''); } }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (required && note.trim().length === 0) return setErr(`${label} là bắt buộc.`);
    setBusy(true);
    await onSubmit(note.trim());
    setBusy(false);
  }
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="col" onSubmit={submit} noValidate>
        {children}
        <Field label={label} htmlFor="note-text" error={err}>
          <textarea id="note-text" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-invalid={!!err} autoFocus />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Đang gửi…' : confirmText}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ExtendDialog({ task, onClose, onSubmit }: { task: Task | null; onClose: () => void; onSubmit: (due: string, reason: string) => Promise<void> }) {
  const { today } = useData();
  const [due, setDue] = useState('');
  useEffect(() => { if (task) setDue(addDays(task.dueAt && task.dueAt > today ? task.dueAt : today, 7)); }, [task, today]);
  return (
    <NoteDialog open={task !== null} title={task ? `Gia hạn: ${task.title}` : ''} label="Lý do gia hạn" required confirmText="Gia hạn" onClose={onClose} onSubmit={(reason) => onSubmit(due, reason)}>
      <Field label="Hạn mới" htmlFor="ext-due"><input id="ext-due" type="date" className="inp" value={due} onChange={(e) => setDue(e.target.value)} required /></Field>
    </NoteDialog>
  );
}

export function ReassignDialog({ task, onClose, onSubmit }: { task: Task | null; onClose: () => void; onSubmit: (newAssignee: string, keepOld: boolean) => Promise<void> }) {
  const { users, units } = useData();
  const [who, setWho] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (task) { setWho(''); setKeep(true); } }, [task]);
  const cands = users.filter((u) => u.active && u.unitId && (!task || !task.assigneeIds.includes(u.uid)));
  return (
    <Modal open={task !== null} title={task ? `Đổi người phụ trách: ${task.title}` : ''} onClose={onClose}>
      <form className="col" onSubmit={async (e) => { e.preventDefault(); if (!who || busy) return; setBusy(true); await onSubmit(who, keep); setBusy(false); }}>
        <Field label="Người phụ trách mới" htmlFor="re-who">
          <select id="re-who" className="inp" value={who} onChange={(e) => setWho(e.target.value)} required>
            <option value="">— Chọn —</option>
            {cands.map((u) => <option key={u.uid} value={u.uid}>{u.name} — {units.find((x) => x.id === u.unitId)?.name}</option>)}
          </select>
        </Field>
        <label className="row"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Giữ người cũ làm người phối hợp</label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn pri" disabled={!who || busy}>{busy ? 'Đang lưu…' : 'Đổi người'}</button>
        </div>
      </form>
    </Modal>
  );
}

const QUICK_MESSAGES = [{ label: 'Cập nhật tiến độ', text: 'Nhờ bạn cập nhật tiến độ việc này.' }, { label: 'Sắp đến hạn', text: 'Việc sắp đến hạn, bạn vui lòng hoàn thành sớm.' }, { label: 'Đã quá hạn', text: 'Việc đã quá hạn, bạn báo giúp mình lý do và dự kiến hoàn thành.' }];

/** Tạo lời nhắc: viết nội dung và chọn người nhận (người phụ trách / phối hợp của các việc được chọn). */
export function ReminderDialog({ tasks, onClose, onSubmit }: { tasks: Task[] | null; onClose: () => void; onSubmit: (message: string, recipientIds: string[]) => Promise<void> }) {
  const { userName } = useData();
  const { profile } = useAuth();
  const [msg, setMsg] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const people = tasks ? [...new Set(tasks.flatMap((t) => [...t.assigneeIds, ...t.collaboratorIds]))].filter((u) => u !== profile?.uid) : [];
  const assignees = tasks ? new Set(tasks.flatMap((t) => t.assigneeIds)) : new Set<string>();
  useEffect(() => {
    if (!tasks) return;
    setMsg(''); setErr('');
    setPicked(new Set(tasks.flatMap((t) => t.assigneeIds).filter((u) => u !== profile?.uid)));
  }, [tasks, profile?.uid]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (msg.trim().length === 0) return setErr('Hãy viết nội dung lời nhắc.');
    if (picked.size === 0) return setErr('Hãy chọn ít nhất một người nhận.');
    setErr(''); setBusy(true);
    await onSubmit(msg.trim(), [...picked]);
    setBusy(false);
  }
  const title = !tasks ? '' : tasks.length === 1 ? `Tạo lời nhắc: ${tasks[0].title}` : `Tạo lời nhắc cho ${tasks.length} việc`;
  return (
    <Modal open={tasks !== null} title={title} onClose={onClose}>
      <form className="col" onSubmit={submit} noValidate>
        <fieldset className="remind-who">
          <legend className="lbl">Gửi tới</legend>
          {people.length === 0 && <span className="note">Các việc này chưa có người nhận nào khác ngoài bạn.</span>}
          {people.map((u) => (
            <label key={u} className="ck-line">
              <input type="checkbox" checked={picked.has(u)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(u); else n.delete(u); return n; })} />
              {userName(u)} <span className="note">{assignees.has(u) ? 'Phụ trách' : 'Phối hợp'}</span>
            </label>
          ))}
        </fieldset>
        <div className="chips" aria-label="Gợi ý lời nhắc">
          {QUICK_MESSAGES.map((m) => <button key={m.label} type="button" className="btn sm" title={m.text} onClick={() => { setMsg(m.text); setErr(''); }}>{m.label}</button>)}
        </div>
        <Field label="Nội dung lời nhắc" htmlFor="rm-msg" error={err} hint={`${msg.length}/${REMINDER_MAX} ký tự. Người nhận thấy lời nhắc này trong mục Thông báo.`}>
          <textarea id="rm-msg" className="inp" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={REMINDER_MAX} aria-invalid={!!err} placeholder="Ví dụ: Em gửi anh bản nháp trước thứ Sáu nhé." autoFocus />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi lời nhắc'}</button>
        </div>
      </form>
    </Modal>
  );
}
