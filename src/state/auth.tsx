import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getServices, readEnv } from '../services/firebase/init';
import { bootstrapExists, checkIsAdmin, ensureProfile, isSignUpInFlight } from '../services/firebase/authService';
import { toUser } from '../services/firebase/converters';
import { classify } from '../services/errors';
import { principalOf, type Principal } from '../domain/permissions';
import type { UserProfile } from '../domain/types';

export type AuthStatus = 'loading' | 'config-error' | 'signed-out' | 'no-profile' | 'ready' | 'error';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  principal: Principal | null;
  /** null = chưa biết; true = đã có quản trị viên đầu tiên */
  bootstrapped: boolean | null;
  error: string | null;
  refreshBootstrap: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!readEnv()) {
      setStatus('config-error');
      return;
    }
    return onAuthStateChanged(getServices().auth, (u) => {
      // Đổi tài khoản: xoá sạch mọi trạng thái của người trước.
      setUser(u);
      setProfile(null);
      setIsAdmin(false);
      setBootstrapped(null);
      setError(null);
      setStatus(u ? 'loading' : 'signed-out');
    });
  }, []);

  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!user || !uid) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    (isSignUpInFlight() ? Promise.resolve() : ensureProfile(user))
      .then(() => {
        if (cancelled) return;
        off = onSnapshot(
          doc(getServices().db, 'users', uid),
          (s) => {
            if (!s.exists()) {
              setStatus('no-profile');
              return;
            }
            setProfile(toUser(s.id, s.data()));
            setStatus('ready');
          },
          (e) => {
            setError(classify(e).message);
            setStatus('error');
          },
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setError(classify(e).message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [user, uid]);

  const active = profile?.active === true;
  useEffect(() => {
    if (!uid || status !== 'ready') return;
    let cancelled = false;
    if (active) {
      checkIsAdmin(uid).then((v) => !cancelled && setIsAdmin(v));
    } else {
      setIsAdmin(false);
      bootstrapExists().then((v) => !cancelled && setBootstrapped(v)).catch(() => !cancelled && setBootstrapped(true));
    }
    return () => {
      cancelled = true;
    };
  }, [uid, active, status, tick]);

  const value = useMemo<AuthState>(
    () => ({ status, user, profile, isAdmin, principal: principalOf(profile, isAdmin), bootstrapped, error, refreshBootstrap: () => setTick((n) => n + 1) }),
    [status, user, profile, isAdmin, bootstrapped, error],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth ngoài AuthProvider');
  return c;
}
