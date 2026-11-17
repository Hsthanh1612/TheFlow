# Chính sách bảo mật

## Báo cáo lỗ hổng
Vui lòng **không** mở issue công khai cho lỗ hổng bảo mật. Hãy dùng *Security → Report a vulnerability* (GitHub Private Vulnerability Reporting) của repository này, hoặc liên hệ trực tiếp quản trị viên của Khoa. Nêu rõ: bước tái hiện, tác động, phiên bản/commit.

## Phạm vi và mô hình tin cậy
- Ứng dụng là SPA tĩnh; **không có máy chủ riêng**. Ranh giới bảo mật duy nhất là **Firebase Authentication + Firestore Security Rules** (`firestore.rules`). Cấu hình Firebase Web trong frontend không phải bí mật.
- Không bao giờ commit: tệp `.env*` (trừ `.env.example`), khoá riêng, service-account, token. CI chạy `scripts/check-secrets.mjs`.
- Chỉ dùng gói Firebase Spark; không liên kết Billing Account.

Chi tiết: `docs/SECURITY-REVIEW.md`.
