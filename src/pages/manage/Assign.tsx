import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Field, PageHead, ErrorBox } from '../../components/ui';
import { FieldInput } from '../../components/TaskForm';
import { useTaskView } from '../../components/taskBits';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { AppError } from '../../services/errors';
import { bulkAssign } from '../../services/firebase/taskRepo';
import { newId } from '../../services/firebase/ids';
import { planBulkAssign, type AssignMode, type ReviewerMode } from '../../domain/assign';
import { descendantIds, hasPerm } from '../../domain/permissions';
import { addDays } from '../../domain/dates';
import { dueOccurrences } from '../../domain/recurrence';
import type { CustomValue, Priority } from '../../domain/types';

export function AssignPage() {
  const v = useTaskView();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const types = v.taskTypes.filter((t) => !t.archived);
  const [typeId, setTypeId] = useState('');
  const [tplId, setTplId] = useState(sp.get('tpl') ?? '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [prio, setPrio] = useState<Priority>('normal');
  const [rev, setRev] = useState<ReviewerMode>('unit_head');
  const [mode, setMode] = useState<AssignMode>('each');
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [unitIds, setUnitIds] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [busy, setBusy] = useState(false);
  const [bulkId, setBulkId] = useState(() => sp.get('occ') ? `rec_${sp.get('tpl')}_${sp.get('occ')}` : newId());
  const [done, setDone] = useState<string>('');

  const effType = typeId || types[0]?.id || '';
  const type = v.typeById(effType);
  const tpl = v.templates.find((t) => t.id === tplId && !t.archived);
  useEffect(() => {
    if (!tpl) return;
    setTypeId(tpl.typeId); setTitle(tpl.title); setDesc(tpl.description); setPrio(tpl.priority); setDue(addDays(v.today, tpl.dueOffsetDays));
    // chỉ nạp mẫu khi đổi mẫu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId]);

  // Người nhận chỉ trong phạm vi quyền giao việc hàng loạt (Rules chặn ở máy chủ nếu vượt).
  const allowedUnits = useMemo(() => v.units.filter((u) => !u.archived && hasPerm(principal, 'task.bulk_assign', u.id)), [v.units, principal]);
  const allowedIds = new Set(allowedUnits.map((u) => u.id));
  const people = v.users.filter((u) => u.active && u.unitId && allowedIds.has(u.unitId));
  const roots = allowedUnits.filter((u) => !u.parentId || !allowedIds.has(u.parentId));

  const plan = useMemo(() => planBulkAssign({ mode, userIds: [...userIds], unitIds: [...unitIds], reviewerMode: rev }, v.users, v.units), [mode, userIds, unitIds, rev, v.users, v.units]);
  const outOfScope = plan.drafts.filter((d) => !allowedIds.has(d.unitId));
  const already = v.tasks.some((t) => t.bulkId === bulkId);
  const pendingOcc = useMemo(() => v.templates.filter((t) => !t.archived && t.recurrence?.active).flatMap((t) => dueOccurrences(t.recurrence!, v.today, v.terms).map((o) => ({ t, o, id: `rec_${t.id}_${o.key}` }))).filter((x) => !v.tasks.some((k) => k.bulkId === x.id)), [v.templates, v.today, v.terms, v.tasks]);

  const toggleUnit = (id: string) => {
    const ids = descendantIds(v.units, id);
    const on = !unitIds.has(id);
    setUnitIds((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    setUserIds((s) => { const n = new Set(s); for (const u of v.users) if (u.unitId && ids.includes(u.unitId)) { if (on) n.delete(u.uid); } return n; });
  };

  async function go() {
    if (!profile || !type) return;
    const wf = v.wfById(type.workflowId);
    if (!wf) return toast.fail(new AppError('data', 'Không tìm thấy quy trình của loại việc.'));
    if (already) return toast.fail(new AppError('data', 'Đợt giao này đã được thực hiện. Tải lại trang để giao đợt mới.'));
    if (outOfScope.length > 0) return toast.fail(new AppError('permission', 'Có người nhận ngoài phạm vi quyền giao việc của bạn.'));
    setBusy(true);
    const r = await toast.run(() => bulkAssign({ mode, userIds: [...userIds], unitIds: [...unitIds], reviewerMode: rev }, { type, workflow: wf, title, description: desc, dueAt: due || null, priority: prio, template: tpl ?? null, customFields: custom }, v.users, v.units, profile, bulkId), 'Đã giao việc.');
    setBusy(false);
    if (r.ok) {
      setDone(`Đã tạo ${r.value.created} việc.${r.value.skipped.length ? ` Bỏ qua ${r.value.skipped.length} người/đơn vị không hợp lệ.` : ''}`);
      setUserIds(new Set()); setUnitIds(new Set()); setBulkId(newId());
    }
  }

  const MODES: { v: AssignMode; t: string; d: string }[] = [
    { v: 'each', t: 'Mỗi người một việc riêng', d: 'Mỗi người nhận một bản, tiến độ theo dõi riêng từng người.' },
    { v: 'shared', t: 'Một việc chung', d: 'Một việc, người đầu tiên phụ trách, những người còn lại phối hợp.' },
    { v: 'unit', t: 'Mỗi đơn vị một việc', d: 'Giao cho Trưởng bộ môn/tổ, họ tự phân công tiếp trong đơn vị.' },
  ];

  return (
    <div className="screen">
      <PageHead title="Giao việc hàng loạt" sub="Giao một việc cho nhiều người hoặc nhiều bộ môn cùng lúc." />
      <ErrorBox errors={v.errors} />
      {done && <div className="alert info" role="status">{done}</div>}
      {pendingOcc.length > 0 && (
        <div className="alert warn" role="status">Có việc lặp đến kỳ chưa giao: {pendingOcc.map((x) => <a key={x.id} href={`#/manage/assign?tpl=${x.t.id}&occ=${x.o.key}`} style={{ marginRight: 10 }}>{x.t.name} ({x.o.startDay})</a>)}</div>
      )}
      <div className="g12">
        <div className="col">
          <div className="card">
            <h3>1. Nội dung công việc</h3>
            <div className="col">
              <div className="g2">
                <Field label="Loại việc" htmlFor="as-type"><select id="as-type" className="inp" value={effType} onChange={(e) => { setTypeId(e.target.value); setCustom({}); }}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Tạo từ mẫu việc" htmlFor="as-tpl"><select id="as-tpl" className="inp" value={tplId} onChange={(e) => setTplId(e.target.value)}><option value="">Không dùng mẫu</option>{v.templates.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              </div>
              <Field label="Tiêu đề" htmlFor="as-title"><input id="as-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
              <Field label="Mô tả" htmlFor="as-desc"><textarea id="as-desc" className="inp" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={5000} /></Field>
              <div className="g2">
                <Field label="Hạn chót" htmlFor="as-due"><input id="as-due" type="date" className="inp" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                <Field label="Ưu tiên" htmlFor="as-prio"><select id="as-prio" className="inp" value={prio} onChange={(e) => setPrio(e.target.value as Priority)}><option value="normal">Bình thường</option><option value="high">Cao</option><option value="low">Thấp</option></select></Field>
                <Field label="Người duyệt" htmlFor="as-rev"><select id="as-rev" className="inp" value={rev} onChange={(e) => setRev(e.target.value as ReviewerMode)}><option value="unit_head">Trưởng bộ môn của người nhận</option><option value="dean">Trưởng khoa</option><option value="none">Không cần duyệt</option></select></Field>
              </div>
              {type && type.fields.filter((f) => !f.archived).map((f) => <FieldInput key={f.key} def={f} value={custom[f.key]} onChange={(val) => setCustom((c) => ({ ...c, [f.key]: val }))} idPrefix="as" />)}
              <p className="note">Nhắc trước hạn theo thiết lập chung (Cấu hình → Thiết lập chung).</p>
            </div>
          </div>
          <div className="card">
            <h3>2. Cách giao</h3>
            <div className="radio" role="radiogroup" aria-label="Cách giao">
              {MODES.map((m) => <label key={m.v}><input type="radio" name="mode" checked={mode === m.v} onChange={() => setMode(m.v)} /><span><strong>{m.t}</strong><small>{m.d}</small></span></label>)}
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <h3>3. Người nhận <button className="linkbtn" onClick={() => { setUserIds(new Set()); setUnitIds(new Set()); }}>Bỏ chọn</button></h3>
            <div className="tree">
              {roots.length === 0 && <div className="empty">Bạn chưa có quyền giao việc hàng loạt cho đơn vị nào.</div>}
              {allowedUnits.map((u) => {
                const members = people.filter((p) => p.unitId === u.id);
                return (
                  <div key={u.id}>
                    <label className="t-unit"><input type="checkbox" checked={unitIds.has(u.id)} onChange={() => toggleUnit(u.id)} />{u.parentId === null ? 'Toàn Khoa' : u.name} <span className="note">({members.length})</span></label>
                    {mode !== 'unit' && members.map((m) => (
                      <label className="t-mem" key={m.uid}><input type="checkbox" checked={userIds.has(m.uid) || unitIds.has(u.id)} disabled={unitIds.has(u.id)} onChange={() => setUserIds((s) => { const n = new Set(s); if (n.has(m.uid)) n.delete(m.uid); else n.add(m.uid); return n; })} />{m.name}{u.headId === m.uid ? ' (Trưởng)' : ''}</label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <h3>Xem trước</h3>
            <p><strong>{plan.drafts.length}</strong> công việc sẽ được tạo</p>
            <div className="list">{plan.drafts.slice(0, 8).map((d, i) => <div className="li" key={i}><div>{d.label}<small>{v.unitById(d.unitId)?.name}{d.reviewerIds.length ? ` · duyệt: ${d.reviewerIds.map(v.userName).join(', ')}` : ''}</small></div></div>)}
              {plan.drafts.length > 8 && <div className="note">… và {plan.drafts.length - 8} việc nữa</div>}</div>
            {plan.skipped.length > 0 && <div className="alert warn" style={{ marginTop: 8 }}>{plan.skipped.length} bị bỏ qua: {plan.skipped.slice(0, 3).map((s) => `${s.label} (${s.reason})`).join('; ')}</div>}
            {plan.errors.length > 0 && userIds.size + unitIds.size > 0 && <div className="alert err" style={{ marginTop: 8 }} role="alert">{plan.errors[0]}</div>}
            {outOfScope.length > 0 && <div className="alert err" style={{ marginTop: 8 }} role="alert">{outOfScope.length} việc nằm ngoài phạm vi quyền của bạn.</div>}
            <button className="btn pri" style={{ marginTop: 10 }} disabled={busy || plan.errors.length > 0 || !title.trim() || outOfScope.length > 0 || already} onClick={() => void go()}>{busy ? 'Đang giao…' : 'Giao việc'}</button>
            <p className="note">Tất cả việc được tạo trong một lần ghi duy nhất: thành công cả loạt hoặc không việc nào được tạo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
