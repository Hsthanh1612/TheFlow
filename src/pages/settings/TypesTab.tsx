import { useEffect, useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, slug } from './common';
import { typeSchema } from '../../domain/config';
import { FIELD_TYPE_LABELS } from '../../domain/fields';
import type { FieldDef, FieldType, TaskType } from '../../domain/types';

const BLANK = (): TaskType => ({ id: '', name: '', color: '#2D4A87', workflowId: '', fields: [], archived: false });

export function TypesTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [selId, setSelId] = useState<string>('');
  const [draft, setDraft] = useState<TaskType>(BLANK());
  const [errs, setErrs] = useState<string[]>([]);
  const isNew = !d.taskTypes.some((t) => t.id === draft.id);
  useEffect(() => { const t = d.taskTypes.find((x) => x.id === selId); if (t) setDraft(JSON.parse(JSON.stringify(t))); }, [selId, d.taskTypes]);

  const upField = (i: number, p: Partial<FieldDef>) => setDraft((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  const move = (i: number, dir: -1 | 1) => setDraft((x) => { const f = [...x.fields]; const j = i + dir; if (j < 0 || j >= f.length) return x; [f[i], f[j]] = [f[j], f[i]]; return { ...x, fields: f.map((y, k) => ({ ...y, order: k + 1 })) }; });

  async function save() {
    const t = { ...draft, id: draft.id || slug(draft.name), workflowId: draft.workflowId || d.workflows[0]?.id || '', fields: draft.fields.map((f, i) => ({ ...f, key: f.key || slug(f.label), order: i + 1 })) };
    const r = typeSchema.safeParse(t);
    const extra: string[] = [];
    if (!d.workflows.some((w) => w.id === t.workflowId)) extra.push('Chọn quy trình áp dụng.');
    if (new Set(t.fields.map((f) => f.key)).size !== t.fields.length) extra.push('Có hai trường trùng khoá.');
    for (const f of t.fields) if ((f.type === 'select' || f.type === 'multiselect') && f.options.length === 0 && !f.archived) extra.push(`Trường “${f.label}” cần danh sách lựa chọn.`);
    const all = [...(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)), ...extra];
    setErrs(all);
    if (all.length > 0) return;
    if (await cfg.save('taskTypes', t, d.taskTypes.find((x) => x.id === t.id) ?? null)) setSelId(t.id);
  }

  return (
    <div className="g12">
      <div className="card">
        <h3>Loại việc <button className="linkbtn" onClick={() => { setSelId(''); setDraft(BLANK()); setErrs([]); }}>+ Thêm</button></h3>
        <div className="col">
          {d.taskTypes.map((t) => <button key={t.id} className={`fr${t.id === selId ? ' on' : ''}`} onClick={() => setSelId(t.id)}><i className="dot" style={{ background: t.color }} /><span>{t.name}</span>{t.archived && <span className="tg">Đã lưu trữ</span>}</button>)}
          {d.taskTypes.length === 0 && <div className="empty">Chưa có loại việc.</div>}
        </div>
      </div>
      <div className="col">
        <div className="card">
          <h3>{isNew ? 'Loại việc mới' : `Loại việc: ${draft.name}`}</h3>
          <div className="col">
            <div className="g2">
              <Field label="Tên loại việc" htmlFor="ty-name"><input id="ty-name" className="inp" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} /></Field>
              <Field label="Màu" htmlFor="ty-color"><input id="ty-color" type="color" className="inp" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field>
            </div>
            <Field label="Quy trình áp dụng" htmlFor="ty-wf" hint="Đổi quy trình chỉ áp dụng cho việc tạo mới; việc cũ giữ quy trình lúc tạo.">
              <select id="ty-wf" className="inp" value={draft.workflowId} onChange={(e) => setDraft({ ...draft, workflowId: e.target.value })}>
                <option value="">— Chọn —</option>{d.workflows.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <label className="row"><input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} /> Lưu trữ (ẩn khỏi danh sách tạo mới, giữ nguyên dữ liệu cũ)</label>
          </div>
        </div>
        <div className="card">
          <h3>Trường dữ liệu <button className="linkbtn" onClick={() => setDraft((x) => ({ ...x, fields: [...x.fields, { key: '', label: '', type: 'text', required: false, options: [], order: x.fields.length + 1, archived: false }] }))}>+ Thêm trường</button></h3>
          <div className="col">
            {draft.fields.map((f, i) => (
              <div className="fr" key={i} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <span className="gp" aria-hidden="true">::</span>
                <Field label="Tên trường" htmlFor={`f-l-${i}`}><input id={`f-l-${i}`} className="inp" value={f.label} onChange={(e) => upField(i, { label: e.target.value, key: f.key && draft.fields[i].key !== slug(f.label) ? f.key : slug(e.target.value) })} maxLength={80} /></Field>
                <Field label="Kiểu" htmlFor={`f-t-${i}`}><select id={`f-t-${i}`} className="inp" value={f.type} onChange={(e) => upField(i, { type: e.target.value as FieldType })}>{(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((k) => <option key={k} value={k}>{FIELD_TYPE_LABELS[k]}</option>)}</select></Field>
                {(f.type === 'select' || f.type === 'multiselect') && <Field label="Lựa chọn (cách nhau bằng dấu phẩy)" htmlFor={`f-o-${i}`}><input id={`f-o-${i}`} className="inp" value={f.options.join(', ')} onChange={(e) => upField(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>}
                <label className="row"><input type="checkbox" checked={f.required} onChange={(e) => upField(i, { required: e.target.checked })} /> Bắt buộc</label>
                <label className="row"><input type="checkbox" checked={f.archived} onChange={(e) => upField(i, { archived: e.target.checked })} /> Lưu trữ</label>
                <button className="btn sm" aria-label="Lên" onClick={() => move(i, -1)}>↑</button><button className="btn sm" aria-label="Xuống" onClick={() => move(i, 1)}>↓</button>
                {!draft.id || !d.taskTypes.find((t) => t.id === draft.id)?.fields.some((x) => x.key === f.key && f.key) ? <button className="btn sm danger" onClick={() => setDraft((x) => ({ ...x, fields: x.fields.filter((_, j) => j !== i) }))}>Bỏ</button> : <span className="note">Trường đã lưu: dùng “Lưu trữ” để giữ dữ liệu cũ</span>}
              </div>
            ))}
            {draft.fields.length === 0 && <div className="note">Loại việc này chưa có trường riêng.</div>}
          </div>
          {errs.length > 0 && <div className="alert err" role="alert" style={{ marginTop: 10 }}>{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
          <div className="row" style={{ marginTop: 12 }}><button className="btn pri" onClick={() => void save()}>Lưu loại việc</button></div>
        </div>
      </div>
    </div>
  );
}
