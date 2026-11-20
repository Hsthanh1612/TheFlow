import { useState, type FormEvent } from 'react';
import { claimFirstAdmin, resetPassword, signIn, signInGoogle, signOut, signUp } from '../services/firebase/authService';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { AppError, messageOf } from '../services/errors';
import { Field, Loading } from '../components/ui';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="auth" id="main">
      <div className="card">
        <div className="brand" style={{ padding: 0 }}><span className="logo" aria-hidden="true">K</span>Việc của Khoa</div>
        <h1 className="h1" style={{ fontSize: 18 }}>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function LoginPage() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // chống bấm đúp
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'in') await signIn(email, password);
      else if (mode === 'up') {
        if (name.trim().length === 0) throw new AppError('data', 'Vui lòng nhập họ tên.');
        await signUp(email, password, name);
      } else {
        await resetPassword(email);
        setInfo('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.');
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={mode === 'in' ? 'Đăng nhập' : mode === 'up' ? 'Tạo tài khoản' : 'Quên mật khẩu'}>
      <form onSubmit={submit} className="col" noValidate>
        {mode === 'up' && (
          <Field label="Họ và tên" htmlFor="name">
            <input id="name" className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
        )}
        <Field label={mode === 'reset' ? 'Email' : 'Tài khoản hoặc email'} htmlFor="email" hint={mode === 'in' ? 'Nhập tên tài khoản (ví dụ test_case) hoặc địa chỉ Gmail.' : undefined}>
          <input id="email" type={mode === 'reset' ? 'email' : 'text'} inputMode={mode === 'reset' ? 'email' : undefined} className="inp" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={mode === 'in' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} required />
        </Field>
        {mode !== 'reset' && (
          <Field label="Mật khẩu" htmlFor="pw" hint={mode === 'up' ? 'Tối thiểu 6 ký tự.' : undefined}>
            <input id="pw" type="password" className="inp" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />
          </Field>
        )}
        {error && <div className="alert err" role="alert">{error}</div>}
        {info && <div className="alert info" role="status">{info}</div>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'in' ? 'Đăng nhập' : mode === 'up' ? 'Tạo tài khoản' : 'Gửi liên kết'}</button>
      </form>
      {mode === 'in' && (
        <button className="btn" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await signInGoogle(); } catch (err) { setError(messageOf(err)); } finally { setBusy(false); } }}>
          Đăng nhập bằng Google
        </button>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {mode !== 'in' ? <button className="linkbtn" onClick={() => setMode('in')}>Đã có tài khoản? Đăng nhập</button> : <button className="linkbtn" onClick={() => setMode('up')}>Tạo tài khoản mới</button>}
        {mode === 'in' && <button className="linkbtn" onClick={() => setMode('reset')}>Quên mật khẩu</button>}
      </div>
    </Shell>
  );
}

export function ConfigErrorPage() {
  return (
    <Shell title="Chưa cấu hình Firebase">
      <p>Ứng dụng chưa có thông tin kết nối Firebase. Quản trị viên cần đặt các biến <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>, <code>VITE_FIREBASE_PROJECT_ID</code>, <code>VITE_FIREBASE_APP_ID</code> khi build (xem README, mục “Cấu hình Firebase”).</p>
    </Shell>
  );
}

export function FatalPage({ message }: { message: string }) {
  return (
    <Shell title="Không tải được dữ liệu tài khoản">
      <div className="alert err" role="alert">{message}</div>
      <button className="btn" onClick={() => void signOut()}>Đăng xuất</button>
    </Shell>
  );
}

/** Tài khoản đã đăng ký nhưng chưa được quản trị kích hoạt; hoặc hệ thống chưa có quản trị đầu tiên. */
export function PendingPage() {
  const { profile, bootstrapped, refreshBootstrap } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!profile) return <Loading />;
  async function claim() {
    setBusy(true);
    await toast.run(() => claimFirstAdmin(profile!.uid), 'Đã thiết lập quản trị viên và cấu hình mặc định.');
    refreshBootstrap();
    setBusy(false);
  }
  return (
    <Shell title={bootstrapped === false ? 'Thiết lập lần đầu' : 'Đang chờ kích hoạt'}>
      {bootstrapped === false ? (
        <>
          <p>Hệ thống chưa có quản trị viên. Người đầu tiên bấm nút dưới đây sẽ trở thành <strong>quản trị viên</strong> và nạp cấu hình mặc định. Hãy làm bước này trước khi chia sẻ đường dẫn cho các thành viên.</p>
          <button className="btn pri" disabled={busy} onClick={claim}>{busy ? 'Đang thiết lập…' : 'Trở thành quản trị viên'}</button>
        </>
      ) : (
        <p>Xin chào <strong>{profile.name}</strong> ({profile.email}). Tài khoản của bạn đã được tạo và đang chờ quản trị viên kích hoạt và gán vai trò. Sau khi được kích hoạt, tải lại trang.</p>
      )}
      <button className="btn" onClick={() => void signOut()}>Đăng xuất</button>
    </Shell>
  );
}
