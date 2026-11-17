// Phân loại lỗi (Master prompt 7.2). Thông báo cho người dùng dễ hiểu, không lộ stack trace; chi tiết kỹ thuật chỉ ghi console ở chế độ dev.

export type ErrorKind = 'config' | 'data' | 'auth' | 'permission' | 'network' | 'query' | 'sync' | 'quota' | 'unknown';

export class AppError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
  'auth/email-already-in-use': 'Email này đã được đăng ký.',
  'auth/weak-password': 'Mật khẩu quá yếu (cần tối thiểu 6 ký tự).',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng đợi rồi thử lại.',
  'auth/network-request-failed': 'Không kết nối được mạng.',
  'auth/popup-closed-by-user': 'Đã đóng cửa sổ đăng nhập.',
  'auth/operation-not-allowed': 'Phương thức đăng nhập này chưa được bật trong Firebase Authentication.',
};

export function classify(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (import.meta.env.DEV) console.error('[lỗi kỹ thuật]', err);
  if (code.startsWith('auth/')) return new AppError('auth', AUTH_MESSAGES[code] ?? 'Đăng nhập không thành công.', err);
  switch (code) {
    case 'permission-denied':
      return new AppError('permission', 'Bạn không có quyền thực hiện thao tác này (hoặc tài khoản chưa được kích hoạt).', err);
    case 'unauthenticated':
      return new AppError('auth', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', err);
    case 'unavailable':
    case 'deadline-exceeded':
      return new AppError('network', 'Không kết nối được máy chủ. Dữ liệu chưa được lưu — kiểm tra mạng rồi thử lại.', err);
    case 'failed-precondition':
      return new AppError('query', 'Truy vấn cần một chỉ mục (index) chưa được triển khai. Hãy báo quản trị viên.', err);
    case 'resource-exhausted':
      return new AppError('quota', 'Đã chạm hạn mức miễn phí của Firebase (Spark). Thử lại sau; quản trị viên không nâng gói.', err);
    case 'already-exists':
    case 'aborted':
      return new AppError('sync', 'Dữ liệu vừa bị thay đổi bởi người khác. Hãy tải lại rồi thử lại.', err);
    case 'invalid-argument':
      return new AppError('data', 'Dữ liệu không hợp lệ.', err);
    default:
      return new AppError('unknown', err instanceof Error && err.name === 'AppError' ? err.message : 'Đã xảy ra lỗi không xác định.', err);
  }
}

export function messageOf(err: unknown): string {
  return classify(err).message;
}
