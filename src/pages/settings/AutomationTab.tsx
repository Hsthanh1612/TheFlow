import { useState, type FormEvent } from 'react';
import { Field, Modal } from '../../components/ui';
import { useAuth } from '../../state/auth';
import { useData } from '../../state/data';
import { useToast } from '../../state/toast';
import { deleteAutomation, saveAutomation } from '../../services/firebase/featuresRepo';
import { newId, nowIso } from '../../services/firebase/ids';
import { AppError } from '../../services/errors';
import { RECIPIENT_LABEL } from '../../domain/automation';
import type { Automation, AutoRecipient, AutoTriggerKind, StateCategory } from '../../domain/types';

const TRIGGER_LABEL: Record<AutoTriggerKind, string> = { state_changed: 'Khi việc chuyển trạng thái', task_created: 'Khi một việc được tạo', due_soon: 'Khi việc sắp đến hạn', overdue: 'Khi việc quá hạn' };
const CAT_LABEL: Record<StateCategory, string> = { todo: 'Chờ làm', doing: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành' };
const RECIPIENTS = Object.keys(RECIPIENT_LABEL) as AutoRecipient[];

const PRESETS: { name: string; trigger: Automation['trigger']; to: AutoRecipient[]; text: string }[] = [
  { name: 'Báo người duyệt khi có việc nộp', trigger: { kind: 'state_changed', typeId: null, toCategory: 'review', days: 1 }, to: ['reviewers'], text: '{actor} vừa nộp “{title}” chờ bạn duyệt.' },
  { name: 'Báo người phụ trách khi việc hoàn thành', trigger: { kind: 'state_changed', typeId: null, toCategory: 'done', days: 1 }, to: ['assignees', 'creator'], text: '“{title}” đã hoàn thành.' },
  { name: 'Nhắc trước hạn 2 ngày', trigger: { kind: 'due_soon', typeId: null, toCategory: null, days: 2 }, to: ['assignees'], text: '“{title}” còn 2 ngày nữa đến hạn ({due}).' },
  { name: 'Báo Trưởng đơn vị khi việc quá hạn', trigger: { kind: 'overdue', typeId: null, toCategory: null, days: 1 }, to: ['unit_head'], text: '“{title}” đã quá hạn (hạn {due}).' },
];

function describe(a: Automation, typeName: (id: string | null) => string): string {
  const t = a.trigger;
  const when = t.kind === 'state_changed' ? `việc ${t.typeId ? `loại “${typeName(t.typeId)}” ` : ''}chuyển sang ${t.toCategory ? `“${CAT_LABEL[t.toCategory]}”` : 'bất kỳ trạng thái nào'}`
    : t.kind === 'task_created' ? `tạo việc ${t.typeId ? `loại “${typeName(t.typeId)}”` : 'mới'}`
    : t.kind === 'due_soon' ? `việc ${t.typeId ? `loại “${typeName(t.typeId)}” ` : ''}còn đúng ${t.days} ngày đến hạn` : `việc ${t.typeId ? `loại “${typeName(t.typeId)}” ` : ''}đã quá hạn`;
  return `Khi ${when} → báo ${a.action.to.map((r) => RECIPIENT_LABEL[r].toLowerCase()).join(', ')}`;
}

export function AutomationTab() {
  const { profile } = useAuth();
  const d = useData();
  const toast = useToast();
  const [edit, setEdit] = useState<Automation | null>(null);
  const typeName = (id: string | null) => d.typeById(id ?? '')?.name ?? '—';
  if (!profile) return null;
  const blank = (p?: (typeof PRESETS)[number]): Automation => ({ id: newId(), name: p?.name ?? '', enabled: true, trigger: p?.trigger ?? { kind: 'state_changed', typeId: null, toCategory: 'review', days: 1 }, action: { kind: 'notify', to: p?.to ?? ['reviewers'], text: p?.text ?? '' }, createdBy: profile!.uid, createdAt: nowIso(), updatedAt: nowIso() });

  return (
    <div className="col">
      <div className="alert info" role="note">
        Quy tắc “khi … thì …” tự gửi thông báo trong app. Không có máy chủ chạy nền (gói miễn phí), nên: <strong>quy tắc theo sự kiện</strong> (tạo việc, chuyển trạng thái) chạy ngay lúc có người thao tác;
        <strong> quy tắc theo ngày</strong> (sắp đến hạn, quá hạn) chạy khi chính người nhận mở app. Chưa gửi được email hay Zalo.
      </div>
      <div className="card">
        <h3>Quy tắc tự động hoá <button className="btn sm pri" onClick={() => setEdit(blank())}>Thêm quy tắc</button></h3>
        {d.automations.length === 0 && (
          <div className="empty">Chưa có quy tắc nào. Thêm nhanh từ mẫu:
            <div className="chips" style={{ justifyContent: 'center', marginTop: 10 }}>{PRESETS.map((p) => <button key={p.name} className="btn sm" onClick={() => setEdit(blank(p))}>{p.name}</button>)}</div>
          </div>
        )}
        <div className="list">
          {[...d.automations].sort((a, b) => a.name.localeCompare(b.name, 'vi')).map((a) => (
            <div className="li auto-row" key={a.id}>
              <label className="ck-line" style={{ flex: 'none' }}>
                <input type="checkbox" checked={a.enabled} aria-label={`Bật quy tắc ${a.name}`} onChange={(e) => void toast.run(() => saveAutomation({ ...a, enabled: e.target.checked }), e.target.checked ? 'Đã bật quy tắc.' : 'Đã tắt quy tắc.')} />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{a.name}</strong>{!a.enabled && <span className="b todo" style={{ marginLeft: 8 }}>Đang tắt</span>}
                <small>{describe(a, typeName)}</small>
                <small>Nội dung: {a.action.text}</small>
              </div>
              <button className="btn sm" onClick={() => setEdit(a)}>Sửa</button>
              <button className="btn sm danger" onClick={() => { if (window.confirm(`Xoá quy tắc “${a.name}”?`)) void toast.run(() => deleteAutomation(a.id), 'Đã xoá quy tắc.'); }}>Xoá</button>
            </div>
          ))}
        </div>
      </div>
      {edit && <AutomationDialog rule={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AutomationDialog({ rule, onClose }: { rule: Automation; onClose: () => void }) {
  const d = useData();
  const toast = useToast();
  const [a, setA] = useState<Automation>(rule);
  const [busy, setBusy] = useState(false);
  const setT = (p: Partial<Automation['trigger']>) => setA((x) => ({ ...x, trigger: { ...x.trigger, ...p } }));
  const k = a.trigger.kind;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (a.name.trim() === '') return toast.fail(new AppError('data', 'Hãy đặt tên cho quy tắc.'));
    if (a.action.to.length === 0) return toast.fail(new AppError('data', 'Chọn ít nhất một người nhận.'));
    if (a.action.text.trim() === '') return toast.fail(new AppError('data', 'Hãy viết nội dung thông báo.'));
    setBusy(true);
    const r = await toast.run(() => saveAutomation(a), 'Đã lưu quy tắc.');
    setBusy(false);
    if (r.ok) onClose();
  }
  return (
    <Modal open title={rule.name ? `Sửa quy tắc: ${rule.name}` : 'Thêm quy tắc'} onClose={onClose} wide>
      <form className="col" onSubmit={submit} noValidate>
        <Field label="Tên quy tắc" htmlFor="au-name"><input id="au-name" className="inp" value={a.name} maxLength={80} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus /></Field>
        <div className="g2">
          <Field label="Khi nào" htmlFor="au-kind"><select id="au-kind" className="inp" value={k} onChange={(e) => setT({ kind: e.target.value as AutoTriggerKind })}>{(Object.keys(TRIGGER_LABEL) as AutoTriggerKind[]).map((x) => <option key={x} value={x}>{TRIGGER_LABEL[x]}</option>)}</select></Field>
          <Field label="Loại việc" htmlFor="au-type"><select id="au-type" className="inp" value={a.trigger.typeId ?? ''} onChange={(e) => setT({ typeId: e.target.value || null })}><option value="">Tất cả loại việc</option>{d.taskTypes.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          {k === 'state_changed' && <Field label="Chuyển sang" htmlFor="au-cat"><select id="au-cat" className="inp" value={a.trigger.toCategory ?? ''} onChange={(e) => setT({ toCategory: (e.target.value || null) as StateCategory | null })}><option value="">Bất kỳ trạng thái nào</option>{(Object.keys(CAT_LABEL) as StateCategory[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></Field>}
          {k === 'due_soon' && <Field label="Còn bao nhiêu ngày" htmlFor="au-days" hint="Đúng N ngày trước hạn, mỗi việc nhắc một lần."><input id="au-days" type="number" min={1} max={30} className="inp" value={a.trigger.days} onChange={(e) => setT({ days: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} /></Field>}
        </div>
        <fieldset className="remind-who">
          <legend className="lbl">Báo cho</legend>
          {RECIPIENTS.map((r) => (
            <label key={r} className="ck-line"><input type="checkbox" checked={a.action.to.includes(r)} onChange={(e) => setA({ ...a, action: { ...a.action, to: e.target.checked ? [...a.action.to, r] : a.action.to.filter((x) => x !== r) } })} />{RECIPIENT_LABEL[r]}</label>
          ))}
        </fieldset>
        <Field label="Nội dung thông báo" htmlFor="au-text" hint="Có thể dùng {title} tên việc, {actor} người thao tác, {state} trạng thái, {due} hạn chót.">
          <textarea id="au-text" className="inp" value={a.action.text} maxLength={200} onChange={(e) => setA({ ...a, action: { ...a.action, text: e.target.value } })} />
        </Field>
        <label className="ck-line"><input type="checkbox" checked={a.enabled} onChange={(e) => setA({ ...a, enabled: e.target.checked })} />Đang bật</label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu quy tắc'}</button>
        </div>
      </form>
    </Modal>
  );
}
