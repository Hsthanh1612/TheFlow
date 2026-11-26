import { createUserWithEmailAndPassword, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { getServices } from './init';
import { nowIso } from './ids';
import { classify } from '../errors';
import { defaultConfig } from '../../domain/defaultConfig';
import { computeScopes } from '../../domain/permissions';
import { seedConfigBatch } from './configRepo';
import { toLoginEmail } from '../../domain/login';
import { AppError } from '../errors';

/** Miền email nội bộ cho tài khoản dạng tên đăng nhập; đổi bằng VITE_USERNAME_DOMAIN khi build. */
const USERNAME_DOMAIN = (import.meta.env.VITE_USERNAME_DOMAIN as string | undefined) || 'khoa.test';

function loginEmail(input: string): string {
  const r = toLoginEmail(input, USERNAME_DOMAIN);
  if (!r.ok) throw new AppError('auth', r.reason);
  return r.email;
}

let signUpInFlight = false;
/** true khi đang đăng ký bằng email: AuthProvider không tự tạo hồ sơ (tránh ghi hồ sơ với tên mặc định trước khi có họ tên). */
export const isSignUpInFlight = (): boolean => signUpInFlight;

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const { auth } = getServices();
  signUpInFlight = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, loginEmail(email), password);
    await ensureProfile(cred.user, name);
  } catch (e) {
    throw classify(e);
  } finally {
    signUpInFlight = false;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(getServices().auth, loginEmail(email), password);
  } catch (e) {
    throw classify(e);
  }
}

export async function signInGoogle(): Promise<void> {
  try {
    await signInWithPopup(getServices().auth, new GoogleAuthProvider());
  } catch (e) {
    throw classify(e);
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    const r = toLoginEmail(email, USERNAME_DOMAIN);
    if (!r.ok) throw new AppError('auth', r.reason);
    if (r.isUsername) throw new AppError('auth', 'Tài khoản dạng tên đăng nhập không có hộp thư để gửi liên kết. Hãy nhập email, hoặc nhờ quản trị viên đặt lại mật khẩu.');
    await sendPasswordResetEmail(getServices().auth, r.email);
  } catch (e) {
    throw classify(e);
  }
}

/** Đổi mật khẩu: xác thực lại bằng mật khẩu hiện tại (Firebase yêu cầu đăng nhập gần đây) rồi mới đặt mật khẩu mới. */
export async function changePassword(current: string, next: string): Promise<void> {
  const user = getServices().auth.currentUser;
  if (!user || !user.email) throw new AppError('auth', 'Chưa đăng nhập.');
  if (next.length < 6) throw new AppError('data', 'Mật khẩu mới cần tối thiểu 6 ký tự.');
  if (next === current) throw new AppError('data', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') throw new AppError('auth', 'Mật khẩu hiện tại không đúng.', e);
    throw classify(e);
  }
  try {
    await updatePassword(user, next);
  } catch (e) {
    throw classify(e);
  }
}

export function hasPasswordLogin(): boolean {
  return getServices().auth.currentUser?.providerData.some((p) => p.providerId === 'password') ?? false;
}

export async function signOut(): Promise<void> {
  // Về trang chủ để người đăng nhập tiếp theo không rơi vào màn hình của người trước (có thể không đủ quyền xem).
  window.location.hash = '#/';
  await fbSignOut(getServices().auth);
}

/** Tạo hồ sơ chưa kích hoạt nếu chưa có (không ghi đè hồ sơ hiện có). */
export async function ensureProfile(user: User, name?: string): Promise<void> {
  const { db } = getServices();
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  if (!user.email) throw new Error('Tài khoản không có email.');
  await setDoc(ref, {
    name: (name ?? user.displayName ?? user.email.split('@')[0]).trim().slice(0, 100) || 'Người dùng',
    email: user.email,
    active: false,
    unitId: null,
    assignments: [],
    scopes: {},
    createdAt: nowIso(),
  });
}

export async function bootstrapExists(): Promise<boolean> {
  const snap = await getDoc(doc(getServices().db, 'meta', 'bootstrap'));
  return snap.exists();
}

/**
 * Người đầu tiên nhận quyền quản trị (một lần). Batch nguyên tử: meta/bootstrap + admins/{uid} + kích hoạt hồ sơ.
 * Sau đó nạp cấu hình mặc định và gán vai trò Quản trị ở đơn vị gốc.
 */
export async function claimFirstAdmin(uid: string): Promise<void> {
  const { db } = getServices();
  try {
    const b1 = writeBatch(db);
    const t = nowIso();
    b1.set(doc(db, 'meta', 'bootstrap'), { adminUid: uid, createdAt: t });
    b1.set(doc(db, 'admins', uid), { createdAt: t });
    b1.update(doc(db, 'users', uid), { active: true });
    await b1.commit();
    const cfg = defaultConfig();
    await seedConfigBatch(cfg, uid);
    const assignments = [{ roleKey: 'quan_tri', unitId: 'khoa' }];
    await setDoc(doc(db, 'users', uid), { unitId: 'khoa', assignments, scopes: computeScopes(assignments, cfg.roles, cfg.units) }, { merge: true });
  } catch (e) {
    throw classify(e);
  }
}

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(getServices().db, 'admins', uid))).exists();
  } catch {
    return false; // không có quyền đọc => không phải admin
  }
}
