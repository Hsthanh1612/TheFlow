import { useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, slug } from './common';
import { unitSchema } from '../../domain/config';
import { descendantIds } from '../../domain/permissions';
import type { OrgKind, OrgUnit } from '../../domain/types';

export function UnitsTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [kind, setKind] = useState<OrgKind>('bomon');
  const [err, setErr] = useState('');

  async function add() {
    const parent = parentId || d.units.find((u) => u.parentId === null)?.id || null;
    const id = slug(name);
    const unit: OrgUnit = { id, parentId: parent, name: name.trim(), kind, color: '#2D4A87', headId: null, archived: false };
    const r = unitSchema.safeParse(unit);
    if (!r.success) return setErr(r.error.issues.map((i) => i.message).join(' '));
    if (d.units.some((u) => u.id === id)) return setErr('Đã có đơn vị trùng tên/khoá.');
    setErr('');
    if (await cfg.save('units', unit, null, 'Đã thêm đơn vị.')) { setName(''); await cfg.resync(d.roles, [...d.units, unit]); }
  }
  async function update(u: OrgUnit, patch: Partial<OrgUnit>, resync = false) {
    const next = { ...u, ...patch };
    if (patch.parentId !== undefined && descendantIds(d.units, u.id).includes(patch.parentId ?? '')) return setErr('Không thể chuyển đơn vị vào chính nhánh con của nó.');
    setErr('');
    if (await cfg.save('units', next, u)) if (resync) await cfg.resync(d.roles, d.units.map((x) => (x.id === u.id ? next : x)));
  }
  const depth = (u: OrgUnit): number => { let n = 0; let c: OrgUnit | undefined = u; const seen = new Set<string>(); while (c?.parentId && !seen.has(c.id)) { seen.add(c.id); n++; c = d.units.find((x) => x.id === c!.parentId); } return n; };
  const ordered = [...d.units].sort((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name, 'vi'));

  return (
    <div className="col">
      <div className="card">
        <h3>Cây tổ chức</h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th scope="col">Đơn vị</th><th scope="col">Loại</th><th scope="col">Thuộc</th><th scope="col">Trưởng đơn vị</th><th scope="col">Màu</th><th scope="col" /></tr></thead>
            <tbody>
              {ordered.map((u) => (
                <tr key={u.id} style={{ opacity: u.archived ? 0.55 : 1 }}>
                  <td style={{ paddingLeft: 10 + depth(u) * 18 }}><input className="inp" aria-label={`Tên ${u.name}`} defaultValue={u.name} maxLength={80} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== u.name) void update(u, { name: e.target.value.trim() }); }} /></td>
                  <td>{u.kind === 'khoa' ? 'Khoa' : u.kind === 'bomon' ? 'Bộ môn' : 'Tổ'}</td>
                  <td>{u.parentId ? <select className="sel" aria-label={`Đơn vị cha của ${u.name}`} value={u.parentId} onChange={(e) => void update(u, { parentId: e.target.value }, true)}>{d.units.filter((x) => x.id !== u.id && !x.archived).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : '—'}</td>
                  <td><select className="sel" aria-label={`Trưởng ${u.name}`} value={u.headId ?? ''} onChange={(e) => void update(u, { headId: e.target.value || null })}><option value="">— Chưa có —</option>{d.users.filter((x) => x.active).map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</select></td>
                  <td><input type="color" aria-label={`Màu ${u.name}`} value={u.color} onChange={(e) => void update(u, { color: e.target.value })} /></td>
                  <td>{u.parentId !== null && <button className="btn sm" onClick={() => void update(u, { archived: !u.archived }, true)}>{u.archived ? 'Khôi phục' : 'Lưu trữ'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <div className="alert err" role="alert" style={{ marginTop: 8 }}>{err}</div>}
        <p className="note">Đơn vị không bị xoá cứng — chỉ lưu trữ — để giữ nguyên công việc cũ. Trưởng đơn vị dùng khi “giao cho mỗi đơn vị một việc” và chọn người duyệt.</p>
      </div>
      <div className="card">
        <h3>Thêm đơn vị</h3>
        <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Field label="Tên" htmlFor="un-name"><input id="un-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <Field label="Loại" htmlFor="un-kind"><select id="un-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value as OrgKind)}><option value="bomon">Bộ môn</option><option value="to">Tổ</option></select></Field>
          <Field label="Thuộc" htmlFor="un-par"><select id="un-par" className="inp" value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Khoa (gốc)</option>{d.units.filter((u) => !u.archived).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <button className="btn pri" type="submit" disabled={!name.trim()}>Thêm</button>
        </form>
      </div>
    </div>
  );
}
