# Quyết định kỹ thuật
1. **Master prompt thắng BRIEF về hạ tầng.** BRIEF nêu Next.js + PostgreSQL + Auth.js + email; Master prompt bắt buộc Firebase Firestore (Spark), GitHub Pages, không backend. Nghiệp vụ/giao diện lấy từ mockup + BRIEF; hạ tầng theo Master prompt → Vite SPA tĩnh + Firestore. Tính năng cần backend (email, cron, lưu tệp, gọi LLM) được ghi là *bị chặn* thay vì làm giả.
2. **Vite + React + HashRouter** (GitHub Pages không có rewrite). Không thư viện UI/biểu đồ/kéo thả: CSS từ mockup, SVG tự vẽ, HTML5 DnD.
3. **Phân quyền = `users/{uid}.scopes`** (perm → danh sách unitId, `*` = toàn Khoa), tính từ vai trò × phạm vi đơn vị bởi `domain/permissions.computeScopes`, vì Rules không có lambda. Chỉ `user.manage`/admin ghi được; đổi vai trò/cây tổ chức phải đồng bộ lại (UI tự làm).
4. **Quản trị đầu tiên** qua batch `meta/bootstrap + admins/{uid} + kích hoạt`, khoá vĩnh viễn sau lần đầu (Rules + test).
5. **Quy trình kiểm tra cả ở client (UX) và Rules (bảo mật)** dùng cùng bảng `allowed` ("from>to" → ActorKind[]) sinh từ `transitions`; `needsComment`, `doneStates` cũng dẫn xuất.
6. **Nhật ký = map `activity`** chỉ-thêm + `lastActivityId` (so sánh danh sách trong Rules vượt 1000 biểu thức).
7. **Thông báo** ở `users/{uid}/notifications`, ID = thời gian đảo ngược (sắp tăng dần = mới nhất; không cần composite index). Nhắc hạn tạo phía client khi mở app, ID xác định → không trùng.
8. **Không xoá cứng cấu hình/việc**: lưu trữ (`archived`) để giữ dữ liệu cũ.
9. **Không composite index**: mọi truy vấn là đơn trường (`firestore.indexes.json` rỗng có chủ đích).
10. **Ngày** lưu chuỗi `YYYY-MM-DD` (hạn/ngày bắt đầu) và ISO UTC (mốc thời gian); thống kê tuần bắt đầu thứ Hai.
11. **Xuất Excel = CSV (UTF-8 BOM, chống formula injection)**; PDF = in trình duyệt. Không thêm thư viện xlsx/pdf.
