import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { getServices } from './init';
import { nowIso } from './ids';
import { classify } from '../errors';
import { defaultConfig } from '../../domain/defaultConfig';
import { computeScopes } from '../../domain/permissions';
import { seedConfigBatch } from './configRepo';

let signUpInFlight = false;
/** true khi đang đăng ký bằng email: AuthProvider không tự tạo hồ sơ (tránh ghi hồ sơ với tên mặc định trước khi có họ tên). */
export const isSignUpInFlight = (): boolean => signUpInFlight;

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const { auth } = getServices();
  signUpInFlight = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await ensureProfile(cred.user, name);
  } catch (e) {
    throw classify(e);
  } finally {
    signUpInFlight = false;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(getServices().auth, email.trim(), password);
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
    await sendPasswordResetEmail(getServices().auth, email.trim());
  } catch (e) {
    throw classify(e);
  }
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
