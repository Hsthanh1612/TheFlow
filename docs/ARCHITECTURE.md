# Kiến trúc
```
UI (pages/components) → state (Auth/Data/Toast) → domain (thuần, test) ; → services/firebase (duy nhất nơi gọi Firestore/Auth) → Firestore Rules
```
- `domain/`: types, permissions, workflow, taskLogic, fields, stats, assign, config (Zod), reports, recurrence, filters, calendar, timeline, taskBuilder. Không import Firebase/React.
- `services/firebase/`: init (emulator chỉ khi `DEV`), authService, configRepo, taskRepo (batch nguyên tử; chỉ báo thành công sau khi server xác nhận), subscriptions (listener đúng phạm vi quyền), notifyRepo.
- `state/`: AuthProvider (đổi tài khoản → xoá state), DataProvider (key=uid; huỷ listener khi đổi), `useAutosave` (debounce, không vòng lặp listener↔state), ToastProvider (`run` → báo thành công/lỗi thật, đếm đang gửi).
- **Đồng bộ:** `onSnapshot` realtime; ghi theo hành động (checklist/trạng thái/bình luận) và tự lưu debounce 0,8–1 s cho mô tả/trường động, chỉ ghi trường đổi. Offline: không bật persistence (tránh dữ liệu cũ trên máy dùng chung); mất mạng hiển thị "Mất kết nối — chưa đồng bộ". Xung đột: ghi theo trường (dotted path) nên hai người sửa trường khác nhau không đè nhau; cùng trường → người ghi sau thắng.
- **Kiểm thử:** unit (domain) → Rules (emulator) → E2E (Playwright + emulator). CI: `.github/workflows/ci.yml`; deploy: `deploy.yml` (Pages).
