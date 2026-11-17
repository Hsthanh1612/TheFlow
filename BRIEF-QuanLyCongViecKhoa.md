# BRIEF – App "Quản Lý công việc của Khoa"

> Tài liệu này mô tả app cho Claude Code (VSCode). Đọc hết trước khi code. Khi bắt đầu, hãy **lập kế hoạch (plan) trước**, xin xác nhận, rồi build theo từng giai đoạn ở mục 10.
> Mockup giao diện: https://claude.ai/artifact/9jxtKPnqGxRr6KLft2sVdE (6 màn hình: Dashboard, Kanban, Lịch, Timeline, Chi tiết việc, Cấu hình).

---

## 1. Mục tiêu

Một web app nội bộ để **Khoa phân chia công việc, theo dõi tiến độ và deadline**. Mọi người trong Khoa đều dùng.

**Nguyên tắc quan trọng nhất: cấu hình động.** Chủ app chưa biết hết các loại công việc cụ thể của Khoa. Vì vậy **loại việc, trường dữ liệu, quy trình duyệt, vai trò/quyền, mẫu việc và cây tổ chức đều là DỮ LIỆU CẤU HÌNH**, không được viết cứng trong code. Thêm loại việc mới phải làm được bằng cách sửa cấu hình (qua giao diện, qua file seed hoặc nhờ AI) mà **không cần sửa code**.

## 2. Người dùng & quy mô

- Toàn bộ thành viên Khoa: Trưởng/Phó Khoa, Trưởng bộ môn, Giảng viên, Giáo vụ/Thư ký… (vai trò là cấu hình, xem mục 6)
- Quy mô: **30–150 người**, Khoa có **bộ môn/tổ rõ ràng** (cây tổ chức nhiều cấp)
- Giao diện **tiếng Việt**, phong cách **hiện đại, tối giản** (kiểu Notion/Linear). Viết chuỗi giao diện qua lớp i18n để sau này có thể thêm tiếng Anh.

## 3. Nền tảng & công nghệ

| Hạng mục | Lựa chọn |
|---|---|
| Nền tảng | Web app (responsive, dùng được trên điện thoại) |
| Framework | **Next.js (App Router) + TypeScript** |
| Database | **PostgreSQL**, ORM: Prisma hoặc Drizzle (chọn một, giải thích lý do) |
| UI | Tailwind CSS + shadcn/ui, font Inter |
| Validate | Zod (dùng để validate cả cấu hình động) |
| Auth | Auth.js (NextAuth): **Google/Microsoft SSO + email/mật khẩu dự phòng** |
| Thông báo | **Trong app** + **Email** (ví dụ Resend/SMTP), có hàng đợi/cron để gửi nhắc hạn |
| Kéo thả | dnd-kit (Kanban) |
| Lịch / Timeline | FullCalendar hoặc tự dựng; Gantt dùng thư viện nhẹ hoặc tự dựng |

## 4. Màn hình (theo mockup)

1. **Việc của tôi (Dashboard cá nhân)**: trang chủ sau khi đăng nhập. Thẻ thống kê (đang làm, sắp đến hạn, quá hạn, chờ tôi duyệt), bảng việc của tôi, danh sách sắp đến hạn, thông báo.
2. **Bảng Kanban**: cột = trạng thái lấy từ quy trình; kéo thả để đổi trạng thái (kiểm tra quyền chuyển trạng thái); thanh lọc (bộ môn, người phụ trách, loại việc, nhãn, hạn); lưu bộ lọc.
3. **Danh sách/Bảng**: giống bảng tính, lọc và sắp xếp, chọn cột hiển thị (bao gồm cả trường động).
4. **Lịch Khoa**: theo tháng/tuần, hiện deadline và sự kiện (họp, ngày lễ), màu theo trạng thái.
5. **Timeline (Gantt)**: thanh theo ngày bắt đầu–hạn chót, tô tuần hiện tại; giai đoạn sau: kéo đổi ngày, phụ thuộc giữa các việc.
6. **Chi tiết công việc**: mô tả, checklist con, file đính kèm, bình luận (@nhắc người), thuộc tính, **khu trường động theo loại việc**, thanh quy trình duyệt, lịch sử hoạt động.
7. **Cấu hình** (cho người có quyền): tab Loại việc · Trường dữ liệu · Quy trình duyệt · Vai trò & quyền · Mẫu việc & lặp · Cây tổ chức · **Nhờ AI chỉnh cấu hình**.
8. Sau này: Báo cáo & thống kê, Tài liệu (kho văn bản/biểu mẫu), Hồ sơ cá nhân & cài đặt thông báo.

Bốn kiểu xem Danh sách / Kanban / Lịch / Timeline dùng **chung một bộ lọc và một API truy vấn task**.

## 5. Thông tin của một công việc

- Cố định: tiêu đề, mô tả, loại việc, trạng thái, độ ưu tiên, nhãn, ngày bắt đầu, hạn chót, đơn vị (bộ môn/tổ), người tạo
- Người tham gia: **người phụ trách, người phối hợp, người duyệt**
- Checklist con, bình luận, file đính kèm, lịch sử hoạt động
- **Trường động** do loại việc quy định (lưu ở cột `custom_fields` JSONB, validate theo schema của loại việc)
- Có thể tạo từ **mẫu việc** và **lặp lại** theo lịch (hàng tuần, hàng tháng, mỗi học kỳ…)

## 6. Mô hình dữ liệu (gợi ý)

```
org_units(id, parent_id, name, kind)              -- Khoa / Bộ môn / Tổ, dạng cây
users(id, email, name, avatar, org_unit_id, active)
roles(id, key, name, permissions jsonb)           -- quyền là danh sách key, cấu hình được
user_roles(user_id, role_id, scope_org_unit_id)   -- vai trò áp dụng trong phạm vi đơn vị

task_types(id, key, name, color, icon, workflow_id, archived)
field_definitions(id, task_type_id, key, label, type, required, options jsonb, order)
   -- type: text | longtext | number | date | select | multiselect | user | file | url | checkbox
workflows(id, key, name, states jsonb, transitions jsonb)
   -- states: [{key, label, category: todo|doing|review|done}]
   -- transitions: [{from, to, allowed_roles, requires_comment}]

tasks(id, type_id, title, description, state_key, priority, start_at, due_at,
      org_unit_id, parent_task_id, custom_fields jsonb, template_id, recurrence_id,
      created_by, created_at, updated_at, completed_at)
task_people(task_id, user_id, role)               -- assignee | collaborator | reviewer
task_labels / labels
checklist_items(id, task_id, text, done, order, assignee_id)
comments(id, task_id, author_id, body, created_at)
attachments(id, task_id, name, size, storage_key, uploaded_by)
activity_log(id, task_id, actor_id, action, diff jsonb, created_at)

task_templates(id, type_id, name, defaults jsonb, checklist jsonb, due_offset_days)
recurrences(id, template_id, rule, next_run_at, active)   -- rule dạng RRULE hoặc "mỗi học kỳ"
academic_terms(id, name, start_date, end_date)            -- để lặp theo học kỳ

notifications(id, user_id, task_id, kind, payload jsonb, read_at, created_at)
notification_prefs(user_id, channel, kind, enabled)
saved_views(id, owner_id, scope, view_kind, filters jsonb)
config_versions(id, entity, entity_id, snapshot jsonb, changed_by, created_at)  -- lịch sử cấu hình
```

## 7. Cấu hình động & AI chỉnh cấu hình

- Mọi cấu hình (loại việc, trường, quy trình, vai trò, mẫu, cây tổ chức) có **Zod schema** và chung một định dạng JSON để **xuất/nhập** được (ví dụ `config/khoa.config.json` làm seed).
- Form tạo/sửa công việc **tự sinh** từ `field_definitions`. Cột Kanban **tự sinh** từ `workflows.states`.
- Cấu hình có **phiên bản** (`config_versions`), xem lịch sử và khôi phục được.
- Màn **"Nhờ AI chỉnh cấu hình"**: người dùng mô tả bằng lời → gọi API LLM (Claude) với schema + cấu hình hiện tại → AI trả về **bản đề xuất thay đổi (diff)** → hiện xem trước → người dùng bấm áp dụng. **AI không bao giờ tự lưu thẳng**. Đặt giai đoạn sau, nhưng kiến trúc cần sẵn từ đầu (định dạng config rõ ràng, validate chặt).
- Khi loại việc bị sửa hoặc xoá trường: không làm mất dữ liệu cũ (lưu trữ, không xoá cứng).

## 8. Phân quyền

- **Tuỳ chỉnh động**: quyền là các key (`task.view_all`, `task.assign`, `task.approve`, `config.edit`, `report.view`…), vai trò là tập quyền, gán theo **phạm vi đơn vị** (ví dụ Trưởng bộ môn chỉ giao/duyệt việc trong bộ môn mình).
- Kiểm tra quyền ở **server** (API/Server Actions), không chỉ ẩn nút ở giao diện.
- Seed sẵn vai trò mẫu: Quản trị, Trưởng khoa, Trưởng bộ môn, Giảng viên, Giáo vụ.

## 9. Thông báo

- Kênh: **trong app** (chuông thông báo) và **email**.
- Sự kiện: được giao việc, được nhắc trong bình luận, việc chuyển sang chờ mình duyệt, việc được duyệt/trả lại, **nhắc trước hạn** (ví dụ 3 ngày và 1 ngày, cấu hình được), quá hạn.
- Người dùng tự bật/tắt từng loại thông báo. Email có thể gộp thành bản tóm tắt hằng ngày.

## 10. Lộ trình build (từng bước, mỗi bước chạy được)

1. **Khung dự án**: Next.js + TS + Tailwind + shadcn, Postgres (Docker Compose), ORM, ESLint/Prettier, layout sidebar + topbar như mockup.
2. **Auth & tổ chức**: đăng nhập SSO + email/mật khẩu, người dùng, cây bộ môn/tổ, vai trò & quyền động, seed dữ liệu mẫu.
3. **Cấu hình động lõi**: loại việc, trường động, quy trình; form tự sinh; file config JSON để nhập/xuất.
4. **Công việc**: CRUD, người tham gia, checklist, bình luận, đính kèm, lịch sử; màn Chi tiết việc.
5. **Các kiểu xem**: Danh sách, Kanban (kéo thả + kiểm tra chuyển trạng thái), Lịch, Timeline; bộ lọc chung + lưu bộ lọc.
6. **Dashboard cá nhân** + **thông báo** trong app & email + nhắc hạn (cron).
7. **Mẫu việc & việc lặp** (kể cả lặp theo học kỳ).
8. **Báo cáo & thống kê** (theo bộ môn, người, loại việc, kỳ; xuất Excel/PDF), **kho tài liệu**.
9. **AI chỉnh cấu hình** (đề xuất diff, xem trước, áp dụng, phiên bản).

## 11. Quy ước cho Claude Code

- Plan trước khi code mỗi giai đoạn; mỗi giai đoạn kết thúc bằng app chạy được và có seed data.
- Không viết cứng tên loại việc, trạng thái hay vai trò trong code giao diện hoặc logic; luôn đọc từ cấu hình.
- Giao diện bám theo mockup: nền #F7F8FA, thẻ trắng viền #E5E7EB bo 12px, màu nhấn #2563EB, trạng thái: Chờ làm (xám), Đang làm (xanh dương), Chờ duyệt (vàng hổ phách), Hoàn thành (xanh lá), Quá hạn (đỏ).
- Đảm bảo tiếp cận (accessibility): nút thật, label cho input, tương phản chữ đủ đọc.
- Viết test cho phân quyền và chuyển trạng thái quy trình.
- Ghi lại các quyết định kỹ thuật vào `docs/decisions.md`.

## 12. Còn để ngỏ (chủ app sẽ bổ sung sau)

- Tên Khoa, danh sách bộ môn/tổ thực tế
- Danh sách loại việc thực tế của Khoa (hiện mockup dùng ví dụ: Báo cáo, Đề thi, Họp, Coi thi, NCKH, Tuyển sinh, Giáo vụ, Chương trình đào tạo)
- Domain email cho SSO (Google hay Microsoft)
- Nơi triển khai (hosting) và dịch vụ gửi email
- Các chức năng mở rộng khác sẽ thêm sau

---

## 13. Giao diện quản lý

> Mockup: `QuanLyCongViecKhoa-quanly.html` (giao diện cá nhân: `QuanLyCongViecKhoa-mockup.html`). Hai file liên kết qua sidebar.

**Ai dùng:** Trưởng/Phó Khoa (toàn Khoa) và Trưởng bộ môn/tổ (chỉ đơn vị mình). Quản trị hệ thống sẽ có giao diện riêng, làm sau.

**Cách vào:** cùng một app, sidebar có thêm **nhóm menu "Quản lý"**, chỉ hiện với người có quyền (ví dụ `manage.view` trong phạm vi đơn vị). Không tách thành app riêng.

**Bộ chọn phạm vi trên thanh trên cùng (dùng chung cho mọi màn quản lý):**
- **Đơn vị:** Toàn Khoa hoặc từng bộ môn/tổ. Trưởng bộ môn bị khoá ở đơn vị mình, kiểm tra ở server.
- **Kỳ:** học kỳ, N tuần gần nhất, tháng, năm học. Lấy từ `academic_terms`.

**Các màn hình:**
1. **Tổng quan** (trang đầu của quản lý):
   - 4 chỉ số: % hoàn thành so với kế hoạch, số việc đang làm, số việc quá hạn, số việc chờ duyệt.
   - Biểu đồ đường **% hoàn thành cộng dồn theo tuần**, mỗi đơn vị một đường, kèm đường kế hoạch nét đứt. Có tooltip khi rê chuột và nút xem dạng bảng.
   - **Thanh tiến độ từng đơn vị:** xong, đang làm, chờ duyệt, quá hạn.
   - Biểu đồ **cột số việc hoàn thành và tạo mới theo tuần**.
   - Danh sách việc "Cần chú ý".
2. **Hàng đợi duyệt:**
   - Bảng việc đang chờ mình duyệt, có checkbox chọn nhiều để **duyệt hàng loạt** hoặc **trả lại kèm ý kiến** (bắt buộc ghi ý kiến, có hạn nộp lại).
   - Bên phải là khung xem nhanh nội dung, file đính kèm và bước duyệt.
3. **Giao việc hàng loạt:**
   - Nội dung việc, có thể tạo từ mẫu việc.
   - Chọn người nhận theo cây đơn vị (tick cả đơn vị hoặc từng người).
   - **3 cách giao:**
     - mỗi người một việc riêng;
     - một việc chung (một người phụ trách, những người còn lại phối hợp);
     - mỗi đơn vị một việc (giao cho Trưởng đơn vị).
   - Có khung xem trước số việc sẽ được tạo. Thao tác tạo chạy trong một transaction.
4. **Rủi ro & quá hạn:**
   - Gồm việc đã quá hạn và việc có nguy cơ (mặc định: còn ≤3 ngày mà tiến độ <50%; ngưỡng này để trong cấu hình).
   - Thao tác: **Nhắc** (thông báo trong app và email), **Đổi người phụ trách** (tuỳ chọn giữ người cũ làm phối hợp), **Gia hạn** (ghi lý do vào lịch sử), **Nhắc tất cả**.
5. **Tiến độ đơn vị:** thẻ từng đơn vị. Bấm vào thẻ để xem bảng thành viên: đang làm, chờ duyệt, hoàn thành, quá hạn, tỉ lệ đúng hạn.
6. **Báo cáo & xuất file:**
   - Mẫu báo cáo: tiến độ theo đơn vị, danh sách quá hạn, tổng kết theo loại việc, theo thành viên.
   - Xem trước theo phạm vi đang chọn, **xuất Excel/PDF**.
   - Tuỳ chọn **gửi email báo cáo tự động hằng tháng**.
   - Mẫu báo cáo nên là cấu hình (định nghĩa cột và truy vấn), không viết cứng.

**Kỹ thuật cần thêm:**
- Bảng `task_snapshots_daily` (hoặc materialized view) lưu số liệu theo ngày để vẽ biểu đồ theo thời gian nhanh.
- Bảng `report_definitions` và `report_schedules`.
- Quyền mới: `manage.view`, `task.bulk_assign`, `task.approve`, `task.reassign`, `task.extend`, `report.export`.
- Mọi thao tác hàng loạt (duyệt, giao, nhắc) đều ghi `activity_log`.

**Thứ tự build:** đưa giao diện quản lý vào sau Giai đoạn 6 (đã có thông báo). Làm Tổng quan và Hàng đợi duyệt trước, rồi đến Giao việc hàng loạt và Rủi ro, cuối cùng là Báo cáo.
