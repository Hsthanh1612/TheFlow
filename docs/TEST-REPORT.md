# Báo cáo kiểm thử (chạy cục bộ, macOS, Node 26, Java 21, Chromium headless)
| Lớp | Lệnh | Kết quả |
|---|---|---|
| Lint | `npm run lint` | Đạt (0 lỗi, 0 cảnh báo) |
| Typecheck | `npm run typecheck` | Đạt |
| Unit nghiệp vụ | `npm test` | **159/159** (19 file: quyền, quy trình, tiến độ/cảnh báo, trường động, thống kê, giao công việc, cấu hình/diff, lặp, lọc, lịch/timeline, báo cáo/CSV, taskBuilder, ngày, đăng nhập, tìm kiếm, lời nhắc, giờ công, khối lượng, mục tiêu, tự động hoá, ảnh chụp/burndown) |
| Security Rules | `npm run test:rules` | **87/87** trên Firestore Emulator (gồm giờ công, mục tiêu, tự động hoá, ảnh chụp tuần, chế độ sáng/tối) với `firestore.rules` thật |
| E2E trình duyệt | `npm run test:e2e` | **23/23**: claim admin, kích hoạt & phân quyền, chặn truy cập trái quyền, tạo việc + trường bắt buộc, checklist/tự lưu/reload, nộp-trả lại-duyệt hàng loạt, Kanban kéo thả (cả bị từ chối), lịch/timeline/danh sách, giao hàng loạt, tổng quan/rủi ro/đơn vị/xuất CSV, đổi tài khoản không lộ dữ liệu, thêm loại việc không sửa code, tìm kiếm Ctrl+K, hồ sơ cá nhân và đổi mật khẩu, lời nhắc có nội dung, bấm giờ/ghi giờ, mục tiêu, tự động hoá sinh thông báo, khối lượng/xu hướng, chế độ tối + manifest PWA, responsive 390px không tràn ngang, **không lỗi console/request** |
| Build | `npm run build` | Đạt (bundle ~1,1 MB / 331 KB gzip) |
| Bí mật | `npm run check:secrets` | Không phát hiện |
| Phụ thuộc | `npm audit --omit=dev` | 0 lỗ hổng |
| Rà UI | skill `web-design-guidelines` (subagent) | Đã sửa: menu đóng khi bấm ngoài, điều hướng phím cho tab, ARIA lịch/biểu đồ (bảng dữ liệu sr-only), focus visible, cỡ chữ. Chưa sửa: bộ lọc chưa lên URL, `window.confirm` ở Lịch sử, `key={i}` ở vài form, roving focus menu |

**Lỗi tìm thấy qua kiểm thử và đã sửa:** race tạo hồ sơ khi đăng ký (tên thành tiền tố email); Rules `taskTypes` dùng `exists` thay `existsAfter` (nạp cấu hình lần đầu thất bại); `orderBy(documentId,'desc')` không được hỗ trợ → ID thời gian đảo ngược; thông báo lỗi nghiệp vụ bị che thành "không xác định"; `sr-only` tuyệt đối gây tràn ngang trang trên Kanban; sau đăng xuất rơi vào màn của người trước.
**Chưa chạy / không thể:** kiểm tra trên Firebase production và GitHub Actions thật; Safari/Firefox/thiết bị thật; kiểm thử tải; kiểm tra index production (không có composite index).
