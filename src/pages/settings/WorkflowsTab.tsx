import { useEffect, useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, slug } from './common';
import { workflowSchema } from '../../domain/config';
import { validateWorkflow, withDerived } from '../../domain/workflow';
import type { ActorKind, StateCategory, Workflow } from '../../domain/types';

const KINDS: { k: ActorKind; l: string }[] = [
  { k: 'assignee', l: 'Người phụ trách' }, { k: 'collaborator', l: 'Người phối hợp' }, { k: 'reviewer', l: 'Người duyệt của việc' }, { k: 'creator', l: 'Người tạo' },
  { k: 'approver', l: 'Có quyền “Duyệt” trong đơn vị' }, { k: 'approver_all', l: 'Có quyền “Duyệt” toàn Khoa' }, { k: 'assigner', l: 'Có quyền “Giao việc” trong đơn vị' },
];
const CATS: { k: StateCategory; l: string }[] = [{ k: 'todo', l: 'Chờ làm' }, { k: 'doing', l: 'Đang làm' }, { k: 'review', l: 'Chờ duyệt' }, { k: 'done', l: 'Hoàn thành' }];
type Draft = Omit<Workflow, 'allowed' | 'needsComment' | 'doneStates'>;
const BLANK = (): Draft => ({ id: '', name: '', initialState: 'todo', states: [{ key: 'todo', label: 'Chờ làm', category: 'todo' }, { key: 'doing', label: 'Đang làm', category: 'doing' }, { key: 'done', label: 'Hoàn thành', category: 'done' }], transitions: [], archived: false });

export function WorkflowsTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [selId, setSelId] = useState('');
  const [w, setW] = useState<Draft>(BLANK());
  const [errs, setErrs] = useState<string[]>([]);
  useEffect(() => { const x = d.workflows.find((y) => y.id === selId); if (x) setW(JSON.parse(JSON.stringify(x))); }, [selId, d.workflows]);
  const keys = w.states.map((s) => s.key);

  async function save() {
    const draft: Draft = { ...w, id: w.id || slug(w.name) };
    const r = workflowSchema.safeParse(draft);
    const all = [...(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)), ...validateWorkflow(draft)];
    setErrs(all);
    if (all.length > 0) return;
    const before = d.workflows.find((x) => x.id === draft.id) ?? null;
    if (await cfg.save('workflows', withDerived(draft), before)) setSelId(draft.id);
  }

  return (
    <div className="g12">
      <div className="card">
        <h3>Quy trình <button className="linkbtn" onClick={() => { setSelId(''); setW(BLANK()); setErrs([]); }}>+ Thêm</button></h3>
        <div className="col">{d.workflows.map((x) => <button key={x.id} className={`fr${x.id === selId ? ' on' : ''}`} onClick={() => setSelId(x.id)}><span>{x.name}</span>{x.archived && <span className="tg">Đã lưu trữ</span>}</button>)}</div>
      </div>
      <div className="col">
        <div className="card">
          <h3>{w.id ? `Quy trình: ${w.name}` : 'Quy trình mới'}</h3>
          <Field label="Tên quy trình" htmlFor="wf-name"><input id="wf-name" className="inp" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} maxLength={80} /></Field>
          <div className="steps" style={{ margin: '12px 0' }}>{w.states.map((s) => <span key={s.key} className="stp">{s.label || s.key}</span>)}</div>
          <label className="row"><input type="checkbox" checked={w.archived} onChange={(e) => setW({ ...w, archived: e.target.checked })} /> Lưu trữ</label>
        </div>
        <div className="card">
          <h3>Trạng thái <button className="linkbtn" onClick={() => setW({ ...w, states: [...w.states, { key: `buoc_${w.states.length + 1}`, label: '', category: 'doing' }] })}>+ Thêm trạng thái</button></h3>
          <div className="col">
            {w.states.map((s, i) => (
              <div key={i} className="fr" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Tên hiển thị" htmlFor={`st-l-${i}`}><input id={`st-l-${i}`} className="inp" value={s.label} onChange={(e) => setW({ ...w, states: w.states.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></Field>
                <Field label="Khoá" htmlFor={`st-k-${i}`}><input id={`st-k-${i}`} className="inp" value={s.key} disabled={d.workflows.some((x) => x.id === w.id && x.states.some((y) => y.key === s.key))} onChange={(e) => setW({ ...w, states: w.states.map((x, j) => (j === i ? { ...x, key: slug(e.target.value) } : x)) })} /></Field>
                <Field label="Nhóm" htmlFor={`st-c-${i}`}><select id={`st-c-${i}`} className="inp" value={s.category} onChange={(e) => setW({ ...w, states: w.states.map((x, j) => (j === i ? { ...x, category: e.target.value as StateCategory } : x)) })}>{CATS.map((c) => <option key={c.k} value={c.k}>{c.l}</option>)}</select></Field>
                <label className="row"><input type="radio" name="init" checked={w.initialState === s.key} onChange={() => setW({ ...w, initialState: s.key })} /> Khởi đầu</label>
                {!d.workflows.some((x) => x.id === w.id && x.states.some((y) => y.key === s.key)) && <button className="btn sm danger" onClick={() => setW({ ...w, states: w.states.filter((_, j) => j !== i), transitions: w.transitions.filter((t) => t.from !== s.key && t.to !== s.key) })}>Bỏ</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Bước chuyển &amp; người được phép <button className="linkbtn" onClick={() => setW({ ...w, transitions: [...w.transitions, { from: keys[0], to: keys[1], allowed: ['assignee'], requiresComment: false }] })}>+ Thêm bước chuyển</button></h3>
          <div className="col">
            {w.transitions.map((t, i) => (
              <div key={i} className="fr" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Từ" htmlFor={`tr-f-${i}`}><select id={`tr-f-${i}`} className="inp" value={t.from} onChange={(e) => setW({ ...w, transitions: w.transitions.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })}>{keys.map((k) => <option key={k} value={k}>{w.states.find((s) => s.key === k)?.label || k}</option>)}</select></Field>
                <Field label="Sang" htmlFor={`tr-t-${i}`}><select id={`tr-t-${i}`} className="inp" value={t.to} onChange={(e) => setW({ ...w, transitions: w.transitions.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })}>{keys.map((k) => <option key={k} value={k}>{w.states.find((s) => s.key === k)?.label || k}</option>)}</select></Field>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="note">Ai được chuyển</legend>
                  <div className="row">{KINDS.map((k) => <label key={k.k} className="row" style={{ gap: 4 }}><input type="checkbox" checked={t.allowed.includes(k.k)} onChange={(e) => setW({ ...w, transitions: w.transitions.map((x, j) => (j === i ? { ...x, allowed: e.target.checked ? [...x.allowed, k.k] : x.allowed.filter((a) => a !== k.k) } : x)) })} />{k.l}</label>)}</div></fieldset>
                <label className="row"><input type="checkbox" checked={t.requiresComment} onChange={(e) => setW({ ...w, transitions: w.transitions.map((x, j) => (j === i ? { ...x, requiresComment: e.target.checked } : x)) })} /> Bắt buộc ý kiến</label>
                <button className="btn sm danger" onClick={() => setW({ ...w, transitions: w.transitions.filter((_, j) => j !== i) })}>Bỏ</button>
              </div>
            ))}
          </div>
          {errs.length > 0 && <div className="alert err" role="alert" style={{ marginTop: 10 }}>{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
          <div className="row" style={{ marginTop: 12 }}><button className="btn pri" onClick={() => void save()}>Lưu quy trình</button></div>
          <p className="note">Quyền chuyển trạng thái được kiểm tra ở máy chủ (Firestore Rules) theo đúng bảng này.</p>
        </div>
      </div>
    </div>
  );
}
