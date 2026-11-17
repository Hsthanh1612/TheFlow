import { useState } from 'react';
import { useData } from '../../state/data';
import { useToast } from '../../state/toast';
import { saveUserAccess, syncScopes } from '../../services/firebase/configRepo';
import type { Assignment, UserProfile } from '../../domain/types';

export function UsersTab() {
  const d = useData();
  const toast = useToast();
  const [open, setOpen] = useState<string>('');
  const pending = d.users.filter((u) => !u.active);
  const active = d.users.filter((u) => u.active);

  return (
    <div className="col">
      {pending.length > 0 && <div className="alert warn" role="status">{pending.length} tài khoản đang chờ kích hoạt.</div>}
      <div className="card">
        <h3>Người dùng <button className="linkbtn" onClick={() => void toast.run(() => syncScopes(d.users, d.roles, d.units), 'Đã đồng bộ quyền của mọi người dùng.')}>Đồng bộ lại quyền</button></h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th scope="col">Họ tên</th><th scope="col">Email</th><th scope="col">Đơn vị</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col" /></tr></thead>
            <tbody>
              {[...pending, ...active].map((u) => (
                <UserRow key={u.uid} u={u} open={open === u.uid} onToggle={() => setOpen(open === u.uid ? '' : u.uid)} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Mọi quyền được kiểm tra ở máy chủ. Không ai tự gán được quyền cho mình — chỉ người có quyền “Quản lý người dùng” mới sửa được bảng này.</p>
      </div>
    </div>
  );
}

function UserRow({ u, open, onToggle }: { u: UserProfile; open: boolean; onToggle: () => void }) {
  const d = useData();
  const toast = useToast();
  const [act, setAct] = useState(u.active);
  const [unitId, setUnitId] = useState(u.unitId ?? '');
  const [asg, setAsg] = useState<Assignment[]>(u.assignments);
  const roleName = (k: string) => d.roles.find((r) => r.key === k)?.name ?? k;
  const live = d.units.filter((x) => !x.archived);
  return (
    <>
      <tr>
        <td>{u.name}</td><td>{u.email}</td><td>{d.unitById(u.unitId)?.name ?? '—'}</td>
        <td>{u.assignments.map((a) => `${roleName(a.roleKey)} (${d.unitById(a.unitId)?.name ?? '?'})`).join('; ') || '—'}</td>
        <td><span className={`b ${u.active ? 'done' : 'rev'}`}>{u.active ? 'Hoạt động' : 'Chờ kích hoạt'}</span></td>
        <td><button className="btn sm" aria-expanded={open} onClick={onToggle}>{open ? 'Đóng' : 'Sửa'}</button></td>
      </tr>
      {open && (
        <tr><td colSpan={6}>
          <div className="col" style={{ padding: 8 }}>
            <label className="row"><input type="checkbox" checked={act} onChange={(e) => setAct(e.target.checked)} /> Kích hoạt tài khoản</label>
            <label className="row">Đơn vị: <select className="sel" value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">— Chưa có —</option>{live.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <div className="col" style={{ gap: 6 }}>
              <strong>Vai trò (kèm phạm vi đơn vị)</strong>
              {asg.map((a, i) => (
                <div className="row" key={i}>
                  <select className="sel" aria-label="Vai trò" value={a.roleKey} onChange={(e) => setAsg(asg.map((x, j) => (j === i ? { ...x, roleKey: e.target.value } : x)))}>{d.roles.filter((r) => !r.archived).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
                  <select className="sel" aria-label="Phạm vi" value={a.unitId} onChange={(e) => setAsg(asg.map((x, j) => (j === i ? { ...x, unitId: e.target.value } : x)))}>{live.map((x) => <option key={x.id} value={x.id}>{x.parentId === null ? 'Toàn Khoa' : x.name}</option>)}</select>
                  <button className="btn sm danger" onClick={() => setAsg(asg.filter((_, j) => j !== i))}>Bỏ</button>
                </div>
              ))}
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAsg([...asg, { roleKey: d.roles.find((r) => !r.archived)?.key ?? '', unitId: unitId || live[0]?.id || '' }])}>+ Thêm vai trò</button>
            </div>
            <div className="row"><button className="btn pri" onClick={() => void toast.run(() => saveUserAccess(u.uid, { active: act, unitId: unitId || null, assignments: asg.filter((a) => a.roleKey && a.unitId) }, d.roles, d.units), 'Đã lưu quyền người dùng.')}>Lưu</button></div>
          </div>
        </td></tr>
      )}
    </>
  );
}
