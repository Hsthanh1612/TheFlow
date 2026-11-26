# Yêu cầu
Nguồn: `design/QuanLyCongViecKhoa-mockup.html`, `design/QuanLyCongViecKhoa-quanly.html`, `BRIEF-QuanLyCongViecKhoa.md`, `Master_prompt.txt` (hạ tầng).

## Chức năng (trạng thái so với mockup)
| Thành phần mockup | Trạng thái |
|---|---|
| Việc của tôi (4 thẻ, bảng, sắp đến hạn, thông báo) | Đã đáp ứng |
| Kanban (cột theo quy trình, kéo thả có kiểm quyền, thanh lọc, lưu bộ lọc) | Đã đáp ứng |
| Danh sách (lọc/sắp xếp/chọn cột gồm trường động) | Đã đáp ứng |
| Lịch (tháng, màu theo trạng thái, ngày lễ dương lịch) | Đã đáp ứng; **ngày lễ âm lịch chưa có** (cần bảng lịch âm) |
| Theo dõi thời gian (bấm giờ, ghi tay "1h30", báo cáo giờ công, CSV) | Đã đáp ứng |
| Khối lượng công việc theo người (điểm theo ưu tiên, 4 tuần tới) | Đã đáp ứng |
| Mục tiêu OKR (kết quả chính + việc liên kết, sức khoẻ so với kế hoạch) | Đã đáp ứng |
| Tự động hoá "khi … thì …" (thông báo) | Đã đáp ứng trong giới hạn Spark: sự kiện chạy lúc có người thao tác, quy tắc theo ngày chạy khi người nhận mở app; **không có máy chủ nền, không email/Zalo** |
| Ảnh chụp tuần + burndown | Đã đáp ứng; ảnh chụp tự tạo khi người xem được toàn Khoa mở app lần đầu mỗi tuần (không chạy nền) |
| Chế độ tối, cài như app (PWA) | Đã đáp ứng; **chưa có dữ liệu ngoại tuyến** (chỉ lưu "vỏ" app; dữ liệu luôn lấy từ máy chủ) |
| Timeline (8 tuần, tuần hiện tại, nhóm theo) | Đã đáp ứng; kéo đổi ngày & phụ thuộc: *giai đoạn sau theo BRIEF* |
| Chi tiết việc (checklist, bình luận @, thuộc tính, trường động, quy trình, nhật ký) | Đã đáp ứng; **đính kèm = liên kết** |
| Cấu hình (6 tab + AI) | Đã đáp ứng (thêm Người dùng, Thiết lập chung, Lịch sử) |
| Quản lý: Tổng quan, Chờ duyệt, Giao công việc, Cảnh báo quá hạn, Tiến độ đơn vị, Báo cáo | Đã đáp ứng |
| Mockup có "Nhắc trước hạn" theo từng lần giao | Chưa làm: dùng thiết lập chung (`reminderDays`) |
| Mockup "Tài liệu" / "Báo cáo" cá nhân | "Tài liệu": trang giải thích giới hạn; Báo cáo thuộc khu Quản lý |

## Giới hạn do gói Spark (BỊ CHẶN, không làm giả)
- **Email** (thông báo, nhắc hạn, báo cáo hằng tháng): cần máy chủ/Functions. Thay thế: thông báo trong app + nhắc khi người dùng mở app.
- **Việc lặp tự chạy (cron):** thay bằng cảnh báo "kỳ tới hạn chưa giao" ở màn Giao hàng loạt, giao bằng ID xác định (idempotent).
- **Lưu tệp:** Firebase Storage cần Blaze → đính kèm là liên kết http(s).
- **AI chỉnh cấu hình gọi LLM trực tiếp:** cần khoá API trả phí + nơi giữ khoá → thay bằng quy trình lời nhắc → dán JSON → kiểm tra Zod → xem diff → áp dụng.
- **Google/Microsoft SSO:** Google có nút (cần bật trong Console); Microsoft chưa cấu hình.
- **Snapshot số liệu theo ngày:** không cron → tính trực tiếp từ `createdAt/completedAt/dueAt`.

## Chưa xác định (BRIEF mục 12)
Tên Khoa, danh sách bộ môn/tổ thật, loại việc thật (đang dùng ví dụ của mockup), domain SSO, dịch vụ email. Không bịa; cấu hình được trong app.

## Phi chức năng
Responsive (kiểm tra 390px), bàn phím/ARIA, `prefers-reduced-motion`, tiếng Việt, không có lỗi console trong E2E, chi phí = 0.
