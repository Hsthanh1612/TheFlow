# Đánh giá bảo mật
**Mô hình tin cậy:** SPA tĩnh, không backend. Ranh giới duy nhất = Firebase Auth + `firestore.rules`. Cấu hình Firebase Web (apiKey…) công khai, không phải cơ chế phân quyền. Không có Admin SDK/service-account ở bất kỳ đâu.

## Kiểm thử Rules (emulator, Rules thật) — 70/70 đạt (`tests/rules`)
Chưa đăng nhập; tài khoản chưa kích hoạt (không đọc/ghi gì, không tự kích hoạt/tự cấp quyền); đăng ký (chỉ hồ sơ của mình, inactive, email khớp token); bootstrap admin (một lần, nguyên tử, không chiếm lại); quản lý người dùng; cấu hình (chỉ `config.edit` toàn Khoa, không xoá, kiểm tra workflow dẫn xuất); đọc việc (người liên quan / trưởng đơn vị / toàn Khoa; truy vấn hợp lệ và không hợp lệ); tạo việc (tự giao cho mình, trong đơn vị mình, không mạo danh, workflow khớp loại việc, trạng thái khởi đầu, sai cấu trúc); chuyển trạng thái theo quy trình (không tự duyệt, ý kiến bắt buộc, completedAt nhất quán, duyệt 2 cấp); trường được bảo vệ (hạn, nhân sự, đơn vị, người tạo, loại việc); nhật ký chỉ-thêm; bình luận; thông báo; bộ lọc riêng; đường dẫn chưa thiết kế bị từ chối; batch 150 việc + 150 thông báo.

## Kiểm toán (skill `security-audit`, chạy bởi subagent, phạm vi giới hạn)
Không có Critical/High. Phát hiện đã chứng minh và **đã sửa kèm test hồi quy**: (1) `user.manage` khoá được admin/tự nâng quyền → nay cấm sửa admin và sửa quyền chính mình trừ admin; (4) đổi trạng thái không bắt buộc nhật ký, `isIso` lỏng → nay bắt buộc đúng 1 mục nhật ký và kiểm định dạng ISO; (5) tự duyệt việc tự tạo → cấm đặt mình làm người duyệt ở nhánh tự tạo; (2) DoS nhật ký 200 mục → nâng 1000 (rủi ro còn lại: người phụ trách có thể làm đầy nhật ký việc của chính mình); (6) `links[].url` `javascript:` → client chỉ render http(s) (Rules không kiểm từng phần tử mảng). Phụ thuộc: `@grpc/grpc-js` được `overrides` lên ^1.14.4 → `npm audit --omit=dev` = 0.

## Rủi ro còn lại (chấp nhận/ghi nhận)
- **Spam thông báo:** người dùng active có thể gửi thông báo (≤300 ký tự) cho người khác; `actorId` đúng người gửi nên không giả danh. Cần backend để chặt hơn.
- **Ai vào trước thành admin** nếu chưa claim: phải tự claim trước khi chia sẻ link (README).
- Rules không kiểm `email_verified`; quản trị nên kích hoạt theo người quen biết. Bật xác minh email/giới hạn đăng ký ở Console.
- Không có giới hạn tần suất ghi (Spark không có App Check miễn phí đầy đủ ở mọi trường hợp).
- `config.edit` có thể đổi quy trình duyệt — chỉ giao cho người tin cậy.
- Giới hạn kích thước `customFields` chỉ ở mức "là map".

## GitHub
Workflows quyền mặc định `contents: read`; `pages: write`/`id-token: write` chỉ ở job deploy; Actions pin full SHA (đã tra từ GitHub API); không `pull_request_target`; `persist-credentials: false`; deploy chỉ từ `main`; kiểm tra bản build không chứa emulator/khoá; Dependabot; `scripts/check-secrets.mjs`; `SECURITY.md`. **Chưa kiểm chứng trên GitHub thật** (chưa có repository/`gh`). Branch protection/rulesets, secret scanning, Private Vulnerability Reporting: cần bật thủ công trong Settings.
