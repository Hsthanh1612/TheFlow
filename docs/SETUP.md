# Thiết lập
## Môi trường (đã xác minh trên máy phát triển)
Node 26, npm 11, git; `firebase-tools` là devDependency (`npx firebase`); **không có `gh`**; Java: dùng JRE Temurin 21 giải nén ở `.tools/jre` (gitignored) — Emulator cần Java. Cài lại: tải JRE 21 từ Adoptium vào `.tools/jre`.
## Firebase (trạng thái thực tế)
- Đã tạo project Spark **khoa-viec-261117-5550** ("Viec cua Khoa") và Web App `1:985787777815:web:92faef5d6ee3a254fced52` bằng CLI (tài khoản Google đang đăng nhập CLI). **Chưa kiểm tra billing** (CLI không cung cấp; project mới tạo mặc định không gắn Billing) và **không liên kết Billing**.
- **BỊ CHẶN:** bật Firestore API/tạo database bằng CLI trả 403 (API chưa bật; không có quyền serviceusage qua CLI). Việc cần làm trong Console: Build → Firestore Database → Create database (chế độ production, vị trí `asia-southeast1`); Build → Authentication → Sign-in method → Email/Password. Sau đó: `FIREBASE_PROJECT=khoa-viec-261117-5550 npm run deploy:rules`.
- Cấu hình Web (công khai): projectId `khoa-viec-261117-5550`, appId ở trên, authDomain `khoa-viec-261117-5550.firebaseapp.com`, apiKey lấy bằng `npx firebase apps:sdkconfig WEB <appId> --project khoa-viec-261117-5550`.
## GitHub
Chưa có repository remote và chưa có `gh`. Tạo repository (private), đặt remote, thêm Variables `VITE_FIREBASE_*`, bật Pages (GitHub Actions), bật branch protection yêu cầu CI.
