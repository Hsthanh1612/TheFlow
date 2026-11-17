# Báo cáo nghiệm thu — Việc của Khoa
Trạng thái: **Đã xác minh** (có bằng chứng) · **Chưa xác minh** · **Bị chặn** · **Không áp dụng**.

1. **Tổng quan:** SPA Vite+React+TS, Firestore + Auth, GitHub Pages. — Đã xác minh (build + E2E trên emulator).
2. **Chức năng:** 12 màn theo mockup + cấu hình động; xem `docs/REQUIREMENTS.md`. — Đã xác minh bằng E2E (luồng chính).
3. **Tài liệu nguồn đã đọc:** `Master_prompt.txt`, `BRIEF-QuanLyCongViecKhoa.md`, 2 mockup HTML (copy ở `design/`).
4. **Kiến trúc/nghiệp vụ:** `docs/ARCHITECTURE.md`, `ALGORITHM-SPEC.md`, `DATA-MODEL.md`.
5. **Skills:** `docs/SKILLS-INVENTORY.md` (đã dùng: security-audit, web-design-guidelines).
6. **Firebase Project:** `khoa-viec-261117-5550` đã tạo (Spark); **Firestore: Bị chặn** (API chưa bật, cần thao tác Console).
7. **Auth/Rules/Indexes:** Rules đã kiểm thử 70/70 trên emulator — Đã xác minh; **chưa triển khai lên project thật — Bị chặn** (chờ bước 6). Auth Email/Password: chưa bật — Bị chặn. Indexes: không cần (đơn trường) — Không áp dụng.
8. **Khởi tạo "plan" (cấu hình mặc định):** nạp bởi nút "Trở thành quản trị viên" — Đã xác minh trên emulator (E2E); trên production — Chưa thực hiện.
9. **Đồng bộ tự động:** realtime + tự lưu debounce, không ghi trùng (ID xác định) — Đã xác minh (E2E: lưu, reload, đổi tài khoản).
10. **Kiểm thử code:** 119 unit + build + lint + typecheck — Đã xác minh (`docs/TEST-REPORT.md`).
11. **Kiểm thử Firestore:** 70 test Rules — Đã xác minh (emulator).
12. **GitHub/CI:** workflows ci/deploy/dependabot đã viết, Actions pin SHA — **Chưa xác minh** (chưa có repo/`gh`).
13. **Deploy/URL:** **Chưa triển khai** — Bị chặn (cần repo + Variables). Không có URL.
14. **Billing/Spark:** không gắn Billing, không dùng Hosting/Functions/Storage; trạng thái billing project thật **chưa xác minh** (không có công cụ).
15. **Lỗi/hạn chế còn lại:** ghi ở `TEST-REPORT.md`, `SECURITY-REVIEW.md`, `REQUIREMENTS.md` (email, cron, tệp, LLM trực tiếp, lễ âm lịch, kéo đổi ngày timeline).
16. **Cần quyền người dùng:** (a) Console: tạo Firestore DB + bật Email/Password; (b) `npm run deploy:rules`; (c) tạo GitHub repo, đặt Variables, bật Pages/branch protection; (d) tự claim admin trước khi chia sẻ link; (e) nhập tên Khoa/bộ môn/loại việc thật.
17. **Lưu ý vận hành:** hạn mức Spark (50k đọc/ngày; Trưởng khoa đọc toàn bộ việc mỗi phiên); không gửi email; đính kèm là liên kết.
