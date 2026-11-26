import { useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, slug } from './common';
import { settingsSchema, termSchema } from '../../domain/config';
import { isValidDay } from '../../domain/dates';
import type { AppSettings, StateCategory } from '../../domain/types';

export function GeneralTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [s, setS] = useState<AppSettings>(d.settings);
  const [rem, setRem] = useState(d.settings.reminderDays.join(', '));
  const [errs, setErrs] = useState<string[]>([]);
  const [tn, setTn] = useState('');
  const [ts, setTs] = useState('');
  const [te, setTe] = useState('');

  async function save() {
    const next = { ...s, reminderDays: rem.split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0) };
    const r = settingsSchema.safeParse(next);
    setErrs(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    if (r.success) await cfg.saveSettings(next);
  }
  async function addTerm() {
    const t = { id: slug(tn), name: tn.trim(), startDate: ts, endDate: te };
    const r = termSchema.safeParse(t);
    if (!r.success || !isValidDay(ts) || !isValidDay(te) || ts > te) return setErrs(['Học kỳ cần tên, ngày bắt đầu ≤ ngày kết thúc hợp lệ.']);
    setErrs([]);
    if (await cfg.save('terms', t, d.terms.find((x) => x.id === t.id) ?? null, 'Đã lưu học kỳ.')) { setTn(''); setTs(''); setTe(''); }
  }

  return (
    <div className="col">
      <div className="card col">
        <h3>Thiết lập chung</h3>
        <div className="g2">
          <Field label="Cảnh báo: còn ≤ (ngày)" htmlFor="gs-days"><input id="gs-days" type="number" min={0} max={60} className="inp" value={s.riskDays} onChange={(e) => setS({ ...s, riskDays: Number(e.target.value) })} /></Field>
          <Field label="… mà tiến độ dưới (%)" htmlFor="gs-prog"><input id="gs-prog" type="number" min={0} max={100} className="inp" value={s.riskProgress} onChange={(e) => setS({ ...s, riskProgress: Number(e.target.value) })} /></Field>
          <Field label="Nhắc trước hạn (ngày, cách nhau bằng dấu phẩy)" htmlFor="gs-rem" hint="Thông báo nhắc hạn xuất hiện trong ứng dụng khi người dùng mở app.">
            <input id="gs-rem" className="inp" value={rem} onChange={(e) => setRem(e.target.value)} />
          </Field>
        </div>
        <fieldset style={{ border: 0, padding: 0 }}><legend className="note">Tên cột Kanban theo nhóm trạng thái (khi xem nhiều loại việc)</legend>
          <div className="g2">{(['todo', 'doing', 'review', 'done'] as StateCategory[]).map((c) => <input key={c} className="inp" aria-label={`Nhóm ${c}`} value={s.categoryLabels[c]} onChange={(e) => setS({ ...s, categoryLabels: { ...s.categoryLabels, [c]: e.target.value } })} />)}</div></fieldset>
        {errs.length > 0 && <div className="alert err" role="alert">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
        <div className="row"><button className="btn pri" onClick={() => void save()}>Lưu thiết lập</button></div>
      </div>
      <div className="card col">
        <h3>Học kỳ / năm học</h3>
        {d.terms.length === 0 ? <div className="note">Chưa có học kỳ. Thêm để dùng ở bộ chọn “Kỳ” và việc lặp theo học kỳ.</div> : <ul style={{ margin: 0 }}>{d.terms.map((t) => <li key={t.id}>{t.name}: {t.startDate} → {t.endDate}</li>)}</ul>}
        <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); void addTerm(); }}>
          <Field label="Tên" htmlFor="tm-n"><input id="tm-n" className="inp" value={tn} onChange={(e) => setTn(e.target.value)} placeholder="HK1 2026-2027" /></Field>
          <Field label="Bắt đầu" htmlFor="tm-s"><input id="tm-s" type="date" className="inp" value={ts} onChange={(e) => setTs(e.target.value)} /></Field>
          <Field label="Kết thúc" htmlFor="tm-e"><input id="tm-e" type="date" className="inp" value={te} onChange={(e) => setTe(e.target.value)} /></Field>
          <button className="btn pri" type="submit">Thêm học kỳ</button>
        </form>
      </div>
    </div>
  );
}
