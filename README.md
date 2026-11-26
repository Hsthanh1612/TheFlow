# Việc của Khoa

Web app nội bộ để **Khoa phân chia công việc, theo dõi tiến độ và hạn chót**. Xây từ mockup (`design/`) và `BRIEF-QuanLyCongViecKhoa.md`, theo ràng buộc hạ tầng của `Master_prompt.txt`.

**Nguyên tắc: cấu hình động.** Loại việc, trường dữ liệu, quy trình duyệt, vai trò/quyền, mẫu việc, cây tổ chức đều là dữ liệu cấu hình (sửa trong màn *Cấu hình*, hoặc nhập JSON `config/khoa.config.json`) — không viết cứng trong code.

## Chức năng
- **Cá nhân:** Việc của tôi, Kanban (kéo thả theo quy trình & quyền), Danh sách (chọn cột, gồm trường động), Lịch, Timeline, Chi tiết việc (checklist, liên kết đính kèm, bình luận @, nhật ký, tự lưu), lưu bộ lọc.
- **Quản lý:** Tổng quan (KPI, biểu đồ tiến độ/kế hoạch, cột theo tuần), Chờ duyệt (duyệt/trả lại hàng loạt), Giao công việc (3 cách, một batch nguyên tử), Cảnh báo quá hạn (nhắc, đổi người, gia hạn), Tiến độ đơn vị, Báo cáo (CSV/in PDF).
- **Cấu hình:** Loại việc & trường, Quy trình, Vai trò & quyền, Mẫu việc & lặp, Cây tổ chức, Người dùng, Thiết lập chung, Nhờ AI chỉnh cấu hình (đề xuất → xem diff → áp dụng), Lịch sử phiên bản.

## Stack
Vite + React 19 + TypeScript (SPA, HashRouter) · Firebase Auth (email/mật khẩu, Google) · Cloud Firestore · Zod · Vitest · `@firebase/rules-unit-testing` · Playwright. Triển khai: **GitHub Pages**. **Không** dùng Firebase Hosting/Functions/Storage; **chỉ gói Spark**.

Kiến trúc: `src/domain` (nghiệp vụ thuần, có test) → `src/services/firebase` (mọi truy cập Firestore) → `src/state` (Auth/Data/Toast) → `src/pages`, `src/components`. Chi tiết: `docs/ARCHITECTURE.md`.

## Chạy cục bộ (Emulator — không chạm production)
```bash
npm ci
npm run emulators          # Auth + Firestore emulator (cần Java; scripts/run-emulator.mjs tự dùng .tools/jre nếu có)
npm run dev:emu            # terminal khác: app nối emulator (cờ này bị bỏ qua ở bản build production)
```
Người đăng ký đầu tiên bấm **“Trở thành quản trị viên”** (nạp cấu hình mặc định), sau đó kích hoạt người dùng ở *Cấu hình → Người dùng*.

## Kiểm thử
```bash
npm run check        # secrets + lint + typecheck + unit + rules(emulator) + build
npm run test:e2e     # trình duyệt thật + emulator
```

## Cấu hình Firebase (production)
1. Firebase Console → tạo project **gói Spark** (không liên kết Billing), thêm Web App, bật Firestore (Native) và Authentication (Email/Password; tắt Anonymous).
2. Triển khai Rules: `FIREBASE_PROJECT=<id> npm run deploy:rules` (chỉ firestore rules + indexes; từ chối nếu `firebase.json` có hosting/functions).
3. GitHub → Settings → Variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (không phải bí mật; bảo mật nằm ở Rules). Bật Pages (Source: GitHub Actions).
4. **Trước khi chia sẻ link**, tự mình mở app và bấm “Trở thành quản trị viên” (ai vào trước sẽ là admin). Trong Authentication → Settings, tắt đăng ký ngoài nhu cầu.

## Những điều CẤM (Spark)
Không nâng Blaze, không gắn Billing, không Firebase Hosting/App Hosting/Functions/Storage/Extensions, không SMS. Hệ quả: không gửi email tự động, không cron, không lưu tệp (đính kèm = liên kết). Xem `docs/REQUIREMENTS.md`.

## Lỗi thường gặp
- *Chưa cấu hình Firebase*: thiếu biến `VITE_FIREBASE_*` khi build.
- *permission-denied*: tài khoản chưa kích hoạt / thiếu vai trò, hoặc Rules chưa triển khai.
- *Emulator*: cần Java 21+.
