import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, slug } from './common';
import { templateSchema } from '../../domain/config';
import type { Priority, Recurrence, TaskTemplate } from '../../domain/types';

const BLANK = (typeId: string): TaskTemplate => ({ id: '', name: '', typeId, title: '', description: '', priority: 'normal', checklist: [], dueOffsetDays: 7, recurrence: null, archived: false });
const REC: Record<string, string> = { weekly: 'Hằng tuần', monthly: 'Hằng tháng', term: 'Mỗi học kỳ' };

export function TemplatesTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [selId, setSelId] = useState('');
  const [t, setT] = useState<TaskTemplate>(BLANK(d.taskTypes[0]?.id ?? ''));
  const [errs, setErrs] = useState<string[]>([]);
  useEffect(() => { const x = d.templates.find((y) => y.id === selId); if (x) setT(JSON.parse(JSON.stringify(x))); }, [selId, d.templates]);

  async function save() {
    const next = { ...t, id: t.id || slug(t.name), typeId: t.typeId || d.taskTypes[0]?.id || '' };
    const r = templateSchema.safeParse(next);
    const e = r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    if (next.recurrence?.kind === 'term' && d.terms.length === 0) e.push('Chưa có học kỳ nào (Cấu hình → Thiết lập chung) để lặp theo học kỳ.');
    setErrs(e);
    if (e.length > 0) return;
    if (await cfg.save('templates', next, d.templates.find((x) => x.id === next.id) ?? null)) setSelId(next.id);
  }

  return (
    <div className="g12">
      <div className="card">
        <h3>Mẫu việc <button className="linkbtn" onClick={() => { setSelId(''); setT(BLANK(d.taskTypes[0]?.id ?? '')); setErrs([]); }}>+ Thêm</button></h3>
        <div className="col">
          {d.templates.map((x) => <button key={x.id} className={`fr${x.id === selId ? ' on' : ''}`} onClick={() => setSelId(x.id)}><span>{x.name}</span>{x.recurrence?.active && <span className="tg">{REC[x.recurrence.kind]}</span>}</button>)}
          {d.templates.length === 0 && <div className="empty">Chưa có mẫu việc.</div>}
        </div>
      </div>
      <div className="card col">
        <h3>{t.id ? `Mẫu: ${t.name}` : 'Mẫu mới'}</h3>
        <div className="g2">
          <Field label="Tên mẫu" htmlFor="tp-name"><input id="tp-name" className="inp" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} maxLength={100} /></Field>
          <Field label="Loại việc" htmlFor="tp-type"><select id="tp-type" className="inp" value={t.typeId} onChange={(e) => setT({ ...t, typeId: e.target.value })}>{d.taskTypes.filter((x) => !x.archived).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        </div>
        <Field label="Tiêu đề việc" htmlFor="tp-title"><input id="tp-title" className="inp" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} maxLength={200} /></Field>
        <Field label="Mô tả" htmlFor="tp-desc"><textarea id="tp-desc" className="inp" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} maxLength={5000} /></Field>
        <div className="g2">
          <Field label="Ưu tiên" htmlFor="tp-prio"><select id="tp-prio" className="inp" value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as Priority })}><option value="normal">Bình thường</option><option value="high">Cao</option><option value="low">Thấp</option></select></Field>
          <Field label="Hạn = ngày giao + (ngày)" htmlFor="tp-off"><input id="tp-off" type="number" min={0} max={366} className="inp" value={t.dueOffsetDays} onChange={(e) => setT({ ...t, dueOffsetDays: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Checklist mẫu (mỗi dòng một mục)" htmlFor="tp-ck"><textarea id="tp-ck" className="inp" value={t.checklist.join('\n')} onChange={(e) => setT({ ...t, checklist: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 50) })} /></Field>
        <Field label="Lặp lại" htmlFor="tp-rec" hint="Khi đến kỳ, mục “Giao công việc” sẽ nhắc bạn giao việc của kỳ đó (hệ thống không tự chạy nền vì chỉ dùng gói Spark).">
          <select id="tp-rec" className="inp" value={t.recurrence?.kind ?? ''} onChange={(e) => setT({ ...t, recurrence: e.target.value ? ({ kind: e.target.value, active: true } as Recurrence) : null })}>
            <option value="">Không lặp</option>{Object.entries(REC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <label className="row"><input type="checkbox" checked={t.archived} onChange={(e) => setT({ ...t, archived: e.target.checked })} /> Lưu trữ</label>
        {errs.length > 0 && <div className="alert err" role="alert">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
        <div className="row"><button className="btn pri" onClick={() => void save()}>Lưu mẫu</button>{t.id && <Link className="btn" to={`/manage/assign?tpl=${t.id}`}>Giao theo mẫu này</Link>}</div>
      </div>
    </div>
  );
}
