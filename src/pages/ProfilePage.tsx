import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/auth';
import { useData } from '../state/data';
import { useToast } from '../state/toast';
import { Avatar, Field, PageHead } from '../components/ui';
import { ThemePicker } from '../components/ThemePicker';
import { changePassword, hasPasswordLogin } from '../services/firebase/authService';
import { renameSelf } from '../services/firebase/notifyRepo';
import { AppError } from '../services/errors';

export function ProfilePage() {
  const { profile, isAdmin } = useAuth();
  const { roles, unitById } = useData();
  const toast = useToast();
  const [name, setName] = useState(profile?.name ?? '');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const canPassword = hasPasswordLogin();

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) { toast.fail(new AppError('data', 'Họ tên không được để trống.')); return; }
    setBusy(true);
    await toast.run(() => renameSelf(profile!.uid, name), 'Đã cập nhật họ tên.');
    setBusy(false);
  }
  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (next !== again) { toast.fail(new AppError('data', 'Mật khẩu nhập lại không khớp.')); return; }
    setBusy(true);
    const r = await toast.run(() => changePassword(cur, next), 'Đã đổi mật khẩu.');
    if (r.ok) { setCur(''); setNext(''); setAgain(''); }
    setBusy(false);
  }

  const roleText = profile.assignments.map((a) => `${roles.find((r) => r.key === a.roleKey)?.name ?? a.roleKey} · ${unitById(a.unitId)?.name ?? a.unitId}`);
  return (
    <div className="screen">
      <PageHead title="Hồ sơ cá nhân" sub="Thông tin tài khoản, mật khẩu và màu giao diện của bạn." />
      <div className="g2" style={{ alignItems: 'start' }}>
        <div className="card col">
          <div className="row" style={{ gap: 14 }}>
            <span className="prof-av"><Avatar name={profile.name} label={false} /></span>
            <div>
              <strong style={{ fontSize: 16 }}>{profile.name}</strong>
              <div className="note">{profile.email}</div>
            </div>
          </div>
          <dl className="pp">
            <div className="pr"><dt>Đơn vị</dt><dd>{unitById(profile.unitId)?.name ?? '—'}</dd></div>
            <div className="pr"><dt>Vai trò</dt><dd>{isAdmin && <span className="mgr">Quản trị viên</span>}{roleText.length === 0 && !isAdmin ? '—' : roleText.map((t) => <span className="tg" key={t}>{t}</span>)}</dd></div>
          </dl>
          <form className="col" onSubmit={saveName} noValidate>
            <Field label="Họ và tên" htmlFor="pf-name"><input id="pf-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></Field>
            <div><button className="btn pri" type="submit" disabled={busy || name.trim() === profile.name}>Lưu họ tên</button></div>
          </form>
        </div>
        <div className="col">
          <div className="card col">
            <h3>Màu giao diện</h3>
            <ThemePicker withNames />
            <span className="note">Lưu theo tài khoản, đi theo bạn sang thiết bị khác.</span>
          </div>
          <div className="card">
            <h3>Đổi mật khẩu</h3>
            {canPassword ? (
              <form className="col" onSubmit={savePassword} noValidate>
                <Field label="Mật khẩu hiện tại" htmlFor="pf-cur"><input id="pf-cur" type="password" className="inp" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
                <Field label="Mật khẩu mới" htmlFor="pf-new" hint="Tối thiểu 6 ký tự."><input id="pf-new" type="password" className="inp" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
                <Field label="Nhập lại mật khẩu mới" htmlFor="pf-again"><input id="pf-again" type="password" className="inp" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
                <div><button className="btn pri" type="submit" disabled={busy || cur === '' || next === ''}>Đổi mật khẩu</button></div>
              </form>
            ) : (
              <p className="note">Tài khoản này đăng nhập bằng Google nên không có mật khẩu riêng để đổi. Hãy đổi mật khẩu trong tài khoản Google của bạn.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
