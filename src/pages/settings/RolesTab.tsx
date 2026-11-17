import { useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useConfigSave, PERM_LABELS, slug } from './common';
import { ALL_PERMS, type PermKey, type Role } from '../../domain/types';

export function RolesTab() {
  const d = useData();
  const cfg = useConfigSave();
  const [newName, setNewName] = useState('');

  async function toggle(role: Role, p: PermKey, on: boolean) {
    const next: Role = { ...role, permissions: on ? [...role.permissions, p] : role.permissions.filter((x) => x !== p) };
    if (await cfg.save('roles', next, role, 'Đã lưu vai trò.')) {
      const roles = d.roles.map((r) => (r.key === role.key ? next : r));
      await cfg.resync(roles, d.units);
    }
  }
  async function add() {
    const key = slug(newName);
    if (!newName.trim() || d.roles.some((r) => r.key === key)) return;
    if (await cfg.save('roles', { key, name: newName.trim(), permissions: [], archived: false } satisfies Role, null, 'Đã thêm vai trò.')) setNewName('');
  }
  async function archive(role: Role) {
    if (await cfg.save('roles', { ...role, archived: !role.archived }, role, role.archived ? 'Đã khôi phục vai trò.' : 'Đã lưu trữ vai trò.')) await cfg.resync(d.roles.map((r) => (r.key === role.key ? { ...r, archived: !role.archived } : r)), d.units);
  }

  return (
    <div className="col">
      <div className="card">
        <h3>Vai trò và quyền</h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th scope="col">Vai trò</th>{ALL_PERMS.map((p) => <th key={p} scope="col">{PERM_LABELS[p]}</th>)}<th scope="col" /></tr></thead>
            <tbody>
              {d.roles.map((r) => (
                <tr key={r.key} style={{ opacity: r.archived ? 0.55 : 1 }}>
                  <th scope="row">{r.name}{r.archived && <span className="tg">Lưu trữ</span>}</th>
                  {ALL_PERMS.map((p) => (
                    <td key={p}><input type="checkbox" aria-label={`${r.name}: ${PERM_LABELS[p]}`} checked={r.permissions.includes(p)} disabled={r.archived} onChange={(e) => void toggle(r, p, e.target.checked)} /></td>
                  ))}
                  <td><button className="btn sm" onClick={() => void archive(r)}>{r.archived ? 'Khôi phục' : 'Lưu trữ'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Quyền áp dụng theo phạm vi đơn vị khi gán vai trò cho người dùng (tab “Người dùng”). {cfg.canSync ? 'Đổi quyền sẽ tự cập nhật cho người dùng đang giữ vai trò đó.' : 'Bạn không có quyền “Quản lý người dùng”: đổi quyền ở đây chỉ có hiệu lực với người dùng sau khi quản trị viên đồng bộ.'}</p>
      </div>
      <div className="card">
        <h3>Thêm vai trò</h3>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Field label="Tên vai trò" htmlFor="role-new"><input id="role-new" className="inp" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} /></Field>
          <button className="btn pri" type="submit" style={{ alignSelf: 'flex-end' }} disabled={!newName.trim()}>Thêm</button>
        </form>
      </div>
    </div>
  );
}
