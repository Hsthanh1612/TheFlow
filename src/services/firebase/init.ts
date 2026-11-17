import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { AppError } from '../errors';

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  projectId: string;
  emulator: boolean;
}

/** Emulator CHỈ được bật ở chế độ dev (vite dev). Bản production build luôn bỏ qua cờ này. */
export const USE_EMULATOR = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true';

export function readEnv(): FirebaseEnv | null {
  if (USE_EMULATOR) return { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-khoa', appId: 'demo-app' };
  const e = import.meta.env;
  const env = { apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN, projectId: e.VITE_FIREBASE_PROJECT_ID, appId: e.VITE_FIREBASE_APP_ID };
  if (!env.apiKey || !env.projectId || !env.appId || !env.authDomain) return null;
  // Chặn nhầm project demo (emulator) trong production.
  if (env.projectId.startsWith('demo-') && !USE_EMULATOR) return null;
  return env as FirebaseEnv;
}

let cached: Services | null = null;

export function getServices(): Services {
  if (cached) return cached;
  const env = readEnv();
  if (!env) throw new AppError('config', 'Chưa cấu hình Firebase. Hãy đặt các biến VITE_FIREBASE_* (xem README, mục Cấu hình Firebase).');
  const app = initializeApp(env);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  cached = { app, auth, db, projectId: env.projectId, emulator: USE_EMULATOR };
  return cached;
}
