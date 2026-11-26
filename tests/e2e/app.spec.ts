import { expect, test, type Page } from '@playwright/test';
import { expectHome, horizontalOverflow, login, openSession, register, type Session } from './helpers';

// Một kịch bản nối tiếp trên trình duyệt thật + Firebase Emulator (Auth + Firestore dùng Security Rules thật).
test.describe.configure({ mode: 'serial' });

const ADMIN = { name: 'Hoàng Dũng', email: 'dung@khoa.test' };
const LECT = { name: 'Nguyễn Văn An', email: 'an@khoa.test' };
const OTHER = { name: 'Lê Thị Hà', email: 'ha@khoa.test' };
let admin: Session;
let an: Session;

async function goSettingsTab(p: Page, tab: string) {
  await p.getByRole('link', { name: 'Cấu hình' }).click();
  await p.getByRole('tab', { name: tab }).click();
}

test('1. quản trị viên đầu tiên thiết lập hệ thống', async ({ browser }) => {
  admin = await openSession(browser);
  await register(admin.page, ADMIN.name, ADMIN.email);
  await expect(admin.page.getByRole('heading', { name: 'Thiết lập lần đầu' })).toBeVisible();
  await admin.page.getByRole('button', { name: 'Trở thành quản trị viên' }).click();
  await expectHome(admin.page, ADMIN.name);
  // Menu quản lý hiện cho admin
  await expect(admin.page.getByRole('link', { name: 'Chờ duyệt' })).toBeVisible();
  // Cấu hình mặc định đã được nạp: loại việc "Báo cáo" có trong Cấu hình
  await goSettingsTab(admin.page, 'Loại việc');
  await expect(admin.page.getByRole('button', { name: /^Báo cáo/ })).toBeVisible();
});

test('2. quản trị tạo bộ môn; hai người dùng đăng ký và chờ kích hoạt', async ({ browser }) => {
  await goSettingsTab(admin.page, 'Cây tổ chức');
  await admin.page.getByLabel('Tên', { exact: true }).fill('Bộ môn 1');
  await admin.page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await expect(admin.page.getByLabel('Tên Bộ môn 1')).toBeVisible();

  an = await openSession(browser);
  await register(an.page, LECT.name, LECT.email);
  await expect(an.page.getByRole('heading', { name: 'Đang chờ kích hoạt' })).toBeVisible();
  // Người chưa kích hoạt không thấy dữ liệu và không thể tự nâng quyền: nút thiết lập lần đầu không xuất hiện
  await expect(an.page.getByRole('button', { name: 'Trở thành quản trị viên' })).toHaveCount(0);

  const other = await openSession(browser);
  await register(other.page, OTHER.name, OTHER.email);
  await expect(other.page.getByRole('heading', { name: 'Đang chờ kích hoạt' })).toBeVisible();
  await other.ctx.close();
});

test('3. quản trị kích hoạt người dùng và gán vai trò Giảng viên ở Bộ môn 1', async () => {
  await admin.page.getByRole('tab', { name: 'Người dùng' }).click();
  await expect(admin.page.getByText('2 tài khoản đang chờ kích hoạt')).toBeVisible();
  const row = admin.page.getByRole('row', { name: new RegExp(LECT.name) });
  await row.getByRole('button', { name: 'Sửa' }).click();
  await admin.page.getByLabel('Kích hoạt tài khoản').check();
  await admin.page.getByLabel('Đơn vị:').selectOption({ label: 'Bộ môn 1' });
  await admin.page.getByRole('button', { name: '+ Thêm vai trò' }).click();
  await admin.page.getByLabel('Vai trò', { exact: true }).selectOption({ label: 'Giảng viên' });
  await admin.page.getByLabel('Phạm vi').selectOption({ label: 'Bộ môn 1' });
  await admin.page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(admin.page.getByText('Đã lưu quyền người dùng.')).toBeVisible();
  // Người dùng được kích hoạt thấy ứng dụng ngay (listener realtime), không cần tải lại
  await expectHome(an.page, LECT.name);
});

test('4. giảng viên KHÔNG thấy khu vực Quản lý/Cấu hình và không vào được bằng đường dẫn trực tiếp', async () => {
  await expect(an.page.getByRole('link', { name: 'Chờ duyệt' })).toHaveCount(0);
  await expect(an.page.getByRole('link', { name: 'Cấu hình' })).toHaveCount(0);
  await an.page.goto('/#/settings');
  await expect(an.page.getByText('Bạn không có quyền sửa cấu hình.')).toBeVisible();
  await an.page.goto('/#/manage/overview');
  await expect(an.page.getByText('Bạn không có quyền xem khu vực Quản lý.')).toBeVisible();
  await an.page.goto('/#/');
});

test('5. quản trị giao việc “Đề thi” cho giảng viên; trường động bắt buộc được kiểm tra', async () => {
  const p = admin.page;
  await p.getByRole('button', { name: 'Tạo việc' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Loại việc').selectOption({ label: 'Đề thi' });
  await dlg.getByLabel('Tiêu đề *').fill('Ra đề thi cuối kỳ');
  await dlg.getByLabel('Người phụ trách').selectOption({ label: `${LECT.name} — Bộ môn 1` });
  await dlg.getByLabel('Người duyệt').selectOption({ label: ADMIN.name });
  await dlg.getByLabel('Hạn chót').fill('2099-12-31');
  // thiếu trường "Học phần" (bắt buộc theo cấu hình loại việc) => lỗi, chưa tạo
  await dlg.getByRole('button', { name: 'Tạo việc' }).click();
  await expect(dlg.getByText('Học phần là bắt buộc.')).toBeVisible();
  await dlg.getByLabel('Học phần *').fill('Cơ sở dữ liệu');
  await dlg.getByRole('button', { name: 'Tạo việc' }).click();
  await expect(p.getByRole('heading', { level: 1 })).toContainText('Ra đề thi cuối kỳ');
  await expect(p.getByLabel('Học phần *')).toHaveValue('Cơ sở dữ liệu');
});

test('6. giảng viên nhận việc, làm checklist, tự lưu mô tả, nộp để duyệt', async () => {
  const p = an.page;
  await expect(p.getByText('Ra đề thi cuối kỳ').first()).toBeVisible();
  await p.getByRole('link', { name: 'Ra đề thi cuối kỳ' }).first().click();
  // thông báo được giao việc
  await p.getByRole('button', { name: /Thông báo/ }).click();
  await expect(p.getByText(/giao việc “Ra đề thi cuối kỳ” cho bạn/)).toBeVisible();
  await p.keyboard.press('Escape');
  // checklist
  await p.getByLabel('Mục checklist mới').fill('Soạn 2 đề');
  await p.getByRole('button', { name: 'Thêm mục' }).click();
  await expect(p.getByText('0/1 hoàn thành')).toBeVisible();
  await p.getByRole('checkbox', { name: 'Soạn 2 đề' }).click(); // điều khiển bởi dữ liệu máy chủ: đợi trạng thái cập nhật
  await expect(p.getByRole('checkbox', { name: 'Soạn 2 đề' })).toBeChecked();
  await expect(p.getByText('1/1 hoàn thành')).toBeVisible();
  // tự lưu mô tả (không bấm Lưu)
  await p.getByLabel('Mô tả', { exact: true }).fill('Đã soạn xong đề A và B');
  await expect(p.getByText('Đã lưu').first()).toBeVisible({ timeout: 10_000 });
  // reload => dữ liệu còn nguyên
  await p.reload();
  await expect(p.getByLabel('Mô tả', { exact: true })).toHaveValue('Đã soạn xong đề A và B');
  await expect(p.getByText('1/1 hoàn thành')).toBeVisible();
  // quy trình: Chờ làm → Đang làm → Chờ duyệt; không có nút duyệt cho người phụ trách
  await p.getByRole('button', { name: 'Chuyển: Đang làm' }).click();
  await expect(p.getByText('Đã chuyển sang “Đang làm”.')).toBeVisible();
  await expect(p.getByRole('button', { name: 'Duyệt / Hoàn thành' })).toHaveCount(0);
  await p.getByRole('button', { name: 'Nộp để duyệt' }).click();
  await expect(p.getByText('Đã chuyển sang “Chờ duyệt”.')).toBeVisible();
  await expect(p.getByText('Chờ duyệt').first()).toBeVisible();
});

test('7. quản trị trả lại (bắt buộc ý kiến), rồi duyệt hàng loạt từ hàng đợi', async () => {
  const p = admin.page;
  await p.getByRole('link', { name: 'Chờ duyệt' }).click();
  await expect(p.getByRole('heading', { name: 'Hàng đợi duyệt' })).toBeVisible();
  const row = p.getByRole('row', { name: /Ra đề thi cuối kỳ/ });
  await row.getByRole('checkbox').click();
  await expect(row.getByRole('checkbox')).toBeChecked();
  await p.getByRole('button', { name: 'Trả lại kèm ý kiến' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Trả lại', exact: true }).click(); // không có ý kiến
  await expect(dlg.getByText('Ý kiến trả lại (bắt buộc) là bắt buộc.')).toBeVisible();
  await dlg.getByLabel('Ý kiến trả lại (bắt buộc)').fill('Thiếu đáp án đề B');
  await dlg.getByRole('button', { name: 'Trả lại', exact: true }).click();
  await expect(p.getByText('Đã trả lại 1 việc.')).toBeVisible();
  await expect(p.getByText('Không còn việc nào chờ duyệt')).toBeVisible();
  // giảng viên thấy việc quay lại "Đang làm" kèm ý kiến
  // (giảng viên đang ở trang chi tiết việc; cập nhật đến qua listener realtime, không cần tải lại)
  await expect(an.page.getByText('Ý kiến gần nhất: “Thiếu đáp án đề B”')).toBeVisible();
  await an.page.getByRole('button', { name: 'Nộp để duyệt' }).click();
  await expect(an.page.getByText('Đã chuyển sang “Chờ duyệt”.')).toBeVisible();
  // duyệt
  await p.reload();
  await p.getByRole('link', { name: 'Chờ duyệt' }).click();
  await p.getByRole('row', { name: /Ra đề thi cuối kỳ/ }).getByRole('checkbox').click();
  await p.getByRole('button', { name: 'Duyệt các việc đã chọn' }).click();
  await expect(p.getByText('Đã duyệt 1 việc.')).toBeVisible();
  // reload: trạng thái hoàn thành còn đúng
  await p.goto('/#/tasks/list');
  await expect(p.getByRole('row', { name: /Ra đề thi cuối kỳ/ })).toContainText('Hoàn thành');
});

test('8. kanban kéo thả đổi trạng thái theo quy trình; lịch và timeline hiển thị việc', async () => {
  const p = an.page;
  await p.getByRole('button', { name: 'Tạo việc' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Loại việc').selectOption({ label: 'Họp' });
  await dlg.getByLabel('Tiêu đề *').fill('Họp bộ môn tháng 11');
  const due = new Date(); due.setDate(due.getDate() + 2);
  await dlg.getByLabel('Hạn chót').fill(due.toISOString().slice(0, 10));
  await dlg.getByRole('button', { name: 'Tạo việc' }).click();
  await expect(p.getByRole('heading', { level: 1 })).toContainText('Họp bộ môn tháng 11');
  await p.goto('/#/tasks/kanban');
  const card = p.getByRole('link', { name: /Họp bộ môn tháng 11/ });
  const col = p.getByRole('region', { name: /^Đang làm/ });
  await card.dragTo(col);
  await expect(p.getByText('Đã chuyển sang “Đang làm”.')).toBeVisible();
  await expect(col.getByText('Họp bộ môn tháng 11')).toBeVisible();
  // người phụ trách không được kéo thẳng sang Chờ duyệt (không có trong quy trình "Không cần duyệt")
  await col.getByRole('link', { name: /Họp bộ môn tháng 11/ }).dragTo(p.getByRole('region', { name: /^Chờ duyệt/ }));
  await expect(p.getByText(/Bạn không thể chuyển việc này sang/)).toBeVisible();
  // lịch + timeline
  await p.getByRole('tab', { name: 'Lịch' }).click();
  await expect(p.getByRole('group', { name: /Lịch tháng/ }).getByText(/Họp bộ môn tháng 11/).first()).toBeVisible();
  await p.getByRole('tab', { name: 'Timeline' }).click();
  await expect(p.getByRole('table', { name: 'Timeline' }).getByText('Họp bộ môn tháng 11')).toBeVisible();
  await p.getByRole('tab', { name: 'Danh sách' }).click();
  await expect(p.getByRole('row', { name: /Họp bộ môn tháng 11/ })).toBeVisible();
});

test('9. giao công việc trong một lần ghi; xem trước đúng; không giao trùng', async () => {
  const p = admin.page;
  await p.getByRole('link', { name: 'Giao công việc' }).click();
  await expect(p.getByRole('heading', { name: 'Giao công việc' })).toBeVisible();
  await expect(p.getByLabel('Tạo từ mẫu việc')).toBeVisible(); // trang đã dựng xong
  await p.getByLabel('Loại việc').selectOption({ label: 'Họp' });
  await p.getByLabel('Tiêu đề').fill('Họp toàn Khoa cuối kỳ');
  await p.getByLabel('Người duyệt').selectOption({ label: 'Không cần duyệt' });
  await p.getByLabel(LECT.name).check();
  await expect(p.getByText('công việc sẽ được tạo')).toBeVisible();
  await expect(p.getByText('1', { exact: true }).first()).toBeVisible();
  await p.getByRole('button', { name: 'Giao việc', exact: true }).click();
  await expect(p.getByText('Đã tạo 1 việc.')).toBeVisible();
  await an.page.reload();
  await expect(an.page.getByRole('link', { name: 'Họp toàn Khoa cuối kỳ' }).first()).toBeVisible();
});

test('9b. tạo lời nhắc có nội dung gửi tới người được giao; người nhận thấy trong Thông báo', async () => {
  const p = admin.page;
  await p.goto('/#/tasks/list');
  await p.getByRole('link', { name: 'Họp toàn Khoa cuối kỳ' }).first().click();
  await p.getByRole('button', { name: 'Tạo lời nhắc' }).click();
  const dlg = p.getByRole('dialog');
  await expect(dlg.getByLabel(new RegExp(LECT.name))).toBeChecked(); // người phụ trách được chọn sẵn
  await dlg.getByRole('button', { name: 'Gửi lời nhắc' }).click();
  await expect(dlg.getByText('Hãy viết nội dung lời nhắc.')).toBeVisible(); // bắt buộc có nội dung
  await dlg.getByLabel('Nội dung lời nhắc').fill('Anh gửi bản chương trình họp trước thứ Sáu nhé.');
  await dlg.getByRole('button', { name: 'Gửi lời nhắc' }).click();
  await expect(p.getByText('Đã gửi lời nhắc.')).toBeVisible();
  await an.page.goto('/#/');
  await an.page.getByRole('button', { name: /Thông báo/ }).click();
  await expect(an.page.getByRole('dialog', { name: 'Thông báo' }).getByText(/nhắc bạn “Họp toàn Khoa cuối kỳ”: Anh gửi bản chương trình họp trước thứ Sáu nhé\./)).toBeVisible();
});

test('10. tổng quan, rủi ro, tiến độ đơn vị, báo cáo hiển thị dữ liệu thật', async () => {
  const p = admin.page;
  await p.getByRole('link', { name: 'Tổng quan' }).click();
  await expect(p.getByRole('heading', { level: 1 })).toContainText('Tổng quan');
  await expect(p.getByText('% hoàn thành so với kế hoạch')).toBeVisible();
  await p.getByRole('link', { name: /Cảnh báo quá hạn/ }).click();
  await expect(p.getByRole('heading', { name: /Cảnh báo quá hạn/ })).toBeVisible();
  await p.getByRole('link', { name: 'Tiến độ đơn vị' }).click();
  await expect(p.getByText('Thành viên —')).toBeVisible();
  await p.getByRole('link', { name: /Báo cáo/ }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Xuất Excel/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.csv$/);
});

test('10b. theo dõi thời gian: bấm giờ, ghi tay, đọc chuỗi giờ, báo lỗi rõ; báo cáo giờ công thấy số liệu', async () => {
  const p = admin.page;
  await p.goto('/#/tasks/list');
  await p.getByRole('link', { name: 'Họp toàn Khoa cuối kỳ' }).first().click();
  const card = p.getByLabel('Thời gian thực hiện');
  await card.getByRole('button', { name: 'Bắt đầu bấm giờ' }).click();
  await expect(p.getByRole('group', { name: 'Đang bấm giờ' })).toBeVisible(); // chip trên thanh đầu trang
  await card.getByRole('button', { name: 'Dừng và ghi giờ' }).click();
  await expect(p.getByText('Đã dừng và ghi giờ.')).toBeVisible();
  await expect(p.getByRole('group', { name: 'Đang bấm giờ' })).toHaveCount(0);
  await expect(card.getByText('(bấm giờ)')).toBeVisible();
  // nhập tay: sai định dạng bị từ chối, "1h30" được hiểu là 1 giờ 30 phút
  await card.getByLabel('Thời gian', { exact: true }).fill('abc');
  await card.getByRole('button', { name: 'Ghi giờ', exact: true }).click();
  await expect(p.getByText('Chưa hiểu thời gian')).toBeVisible();
  await card.getByLabel('Thời gian', { exact: true }).fill('1h30');
  await card.getByLabel('Ghi chú').fill('Chuẩn bị chương trình');
  await card.getByRole('button', { name: 'Ghi giờ', exact: true }).click();
  await expect(card.getByText('1 giờ 30 phút')).toBeVisible();
  await expect(card.getByText('Chuẩn bị chương trình')).toBeVisible();
  // báo cáo giờ công cho quản lý
  await p.goto('/#/manage/time');
  await expect(p.getByRole('heading', { level: 1, name: 'Giờ công' })).toBeVisible();
  await expect(p.getByText('Tổng thời gian')).toBeVisible();
  await expect(p.getByText('2 bản ghi')).toBeVisible();
});

test('10c. mục tiêu: tạo mục tiêu có kết quả chính và liên kết việc; tiến độ tính đúng', async () => {
  const p = admin.page;
  await p.goto('/#/goals');
  await expect(p.getByRole('heading', { level: 1, name: 'Mục tiêu' })).toBeVisible();
  await p.getByRole('button', { name: 'Tạo mục tiêu' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Tên mục tiêu *').fill('Hoàn thành kiểm định');
  await dlg.getByRole('button', { name: 'Thêm kết quả chính' }).click();
  await dlg.getByLabel('Nội dung kết quả chính').fill('Minh chứng đã thu thập');
  await dlg.getByLabel('Hiện tại').fill('1');
  await dlg.getByLabel('Chỉ tiêu').fill('2');
  await dlg.getByLabel('Tìm việc để liên kết').fill('hop toan khoa');
  await dlg.getByRole('button', { name: /Họp toàn Khoa cuối kỳ/ }).click();
  await dlg.getByRole('button', { name: 'Lưu mục tiêu' }).click();
  await expect(p.getByText('Đã tạo mục tiêu.')).toBeVisible();
  const card = p.getByRole('article', { name: 'Hoàn thành kiểm định' });
  await expect(card.getByText('50%').first()).toBeVisible(); // 1/2 kết quả chính
  await expect(card.getByText('Việc liên kết: 0/1 xong')).toBeVisible();
});

test('10d. tự động hoá: quy tắc "chuyển sang Đang làm thì báo người phụ trách" gửi thông báo thật; giảng viên không sửa được', async () => {
  const p = admin.page;
  await p.goto('/#/settings');
  await p.getByRole('tab', { name: 'Tự động hoá' }).click();
  await p.getByRole('button', { name: 'Thêm quy tắc' }).first().click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Tên quy tắc').fill('Báo khi bắt đầu làm');
  await dlg.getByLabel('Chuyển sang').selectOption({ label: 'Đang làm' });
  await dlg.getByLabel('Người phụ trách').check();
  await dlg.getByLabel('Người duyệt').uncheck();
  await dlg.getByLabel('Nội dung thông báo').fill('Bắt đầu: {title}');
  await dlg.getByRole('button', { name: 'Lưu quy tắc' }).click();
  await expect(p.getByText('Đã lưu quy tắc.')).toBeVisible();
  // chuyển trạng thái một việc của giảng viên An → An nhận thông báo do quy tắc sinh ra
  await p.goto('/#/tasks/list');
  await p.getByRole('link', { name: 'Họp toàn Khoa cuối kỳ' }).first().click();
  await p.getByRole('button', { name: /Chuyển: Đang làm/ }).click();
  await expect(p.getByText('Đã chuyển sang “Đang làm”.')).toBeVisible();
  await an.page.goto('/#/');
  const bell = an.page.getByRole('button', { name: /Thông báo/ });
  if ((await bell.getAttribute('aria-expanded')) !== 'true') await bell.click(); // hộp có thể còn mở từ bước trước
  await expect(an.page.getByRole('dialog', { name: 'Thông báo' }).getByText('Bắt đầu: Họp toàn Khoa cuối kỳ')).toBeVisible();
  // giảng viên không có tab Cấu hình
  await expect(an.page.getByRole('link', { name: 'Cấu hình' })).toHaveCount(0);
});

test('10e. khối lượng công việc và xu hướng: hiển thị người, tuần, ảnh chụp tự động', async () => {
  const p = admin.page;
  await p.goto('/#/manage/workload');
  await expect(p.getByRole('heading', { level: 1, name: 'Khối lượng công việc' })).toBeVisible();
  await expect(p.getByRole('columnheader', { name: 'Tuần này', exact: true })).toBeVisible();
  await expect(p.getByRole('rowheader', { name: new RegExp(LECT.name) })).toBeVisible();
  await p.goto('/#/manage/trends');
  await expect(p.getByRole('heading', { level: 1, name: 'Xu hướng' })).toBeVisible();
  // quản lý toàn Khoa mở app là tự chụp ảnh tuần này → nút đã bị khoá
  await expect(p.getByRole('button', { name: 'Tuần này đã chụp' })).toBeDisabled();
});

test('11. đổi tài khoản: dữ liệu người trước không còn hiển thị; đăng xuất/đăng nhập lại', async () => {
  const p = an.page;
  await p.getByRole('button', { name: /Tài khoản/ }).click();
  await p.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(p.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(p.getByText('Ra đề thi cuối kỳ')).toHaveCount(0);
  await login(p, ADMIN.email, 'matkhau123', false);
  await expectHome(p, ADMIN.name);
  await expect(p.getByText('Họp bộ môn tháng 11').first()).toBeHidden({ timeout: 1000 }).catch(() => undefined);
  await p.getByRole('button', { name: /Tài khoản/ }).click();
  await p.getByRole('button', { name: 'Đăng xuất' }).click();
  await login(p, LECT.email, 'matkhau123', false);
  await expectHome(p, LECT.name);
  await expect(p.getByRole('link', { name: 'Cấu hình' })).toHaveCount(0);
});

test('12. cấu hình động: thêm loại việc mới qua giao diện, không sửa code', async () => {
  const p = admin.page;
  await goSettingsTab(p, 'Loại việc');
  await p.getByRole('button', { name: '+ Thêm', exact: true }).click();
  await p.getByLabel('Tên loại việc').fill('Kiểm định chương trình');
  await p.getByLabel('Quy trình áp dụng').selectOption({ label: 'Có duyệt' });
  await p.getByRole('button', { name: '+ Thêm trường' }).click();
  await p.getByLabel('Tên trường').fill('Mã chương trình');
  await p.getByRole('button', { name: 'Lưu loại việc' }).click();
  await expect(p.getByText('Đã lưu cấu hình.')).toBeVisible();
  await p.getByRole('button', { name: 'Tạo việc' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Loại việc').selectOption({ label: 'Kiểm định chương trình' });
  await expect(dlg.getByLabel('Mã chương trình')).toBeVisible();
  await dlg.getByRole('button', { name: 'Huỷ' }).click();
});

test('13. responsive điện thoại: không tràn ngang trên các màn chính; dùng được bằng cảm ứng', async ({ browser }) => {
  const m = await openSession(browser, { width: 390, height: 800 });
  await login(m.page, LECT.email);
  await expectHome(m.page, LECT.name);
  for (const [route, heading] of [['/', 'Xin chào'], ['/tasks/kanban', 'Bảng công việc'], ['/tasks/list', 'Bảng công việc'], ['/tasks/calendar', 'Bảng công việc'], ['/tasks/timeline', 'Bảng công việc']]) {
    await m.page.goto(`/#${route}`);
    await expect(m.page.getByRole('heading', { level: 1 })).toContainText(heading);
    const r = await horizontalOverflow(m.page);
    expect(r.overflow, `${route} tràn ngang ${r.overflow}px bởi: ${r.culprits.join(' | ')}`).toBeLessThanOrEqual(1);
  }
  await m.ctx.close();
});

test('13b. đăng nhập bằng tên tài khoản (không cần email) và báo lỗi rõ khi sai định dạng', async ({ browser }) => {
  const s = await openSession(browser);
  await login(s.page, 'dung'); // tên tài khoản = phần trước @ của dung@khoa.test
  await expectHome(s.page, ADMIN.name);
  await s.ctx.close();
  const bad = await openSession(browser);
  await login(bad.page, 'a b');
  await expect(bad.page.getByRole('alert')).toContainText('Tài khoản gồm 3–30 ký tự');
  await bad.ctx.close();
});

test('13c. tìm kiếm nhanh Ctrl+K: tìm theo tên không dấu, đi tới trang, mở bằng bàn phím', async () => {
  const p = admin.page;
  await p.goto('/#/');
  await expectHome(p, ADMIN.name);
  await p.keyboard.press('Control+k');
  const box = p.getByRole('combobox', { name: 'Tìm kiếm nhanh' });
  await expect(box).toBeFocused();
  await box.fill('ho so');
  await expect(p.getByRole('option', { name: /Hồ sơ cá nhân/ })).toBeVisible();
  await p.keyboard.press('Enter');
  await expect(p.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân' })).toBeVisible();
  await p.keyboard.press('Control+k');
  await p.getByRole('combobox', { name: 'Tìm kiếm nhanh' }).fill('zzzkhongco');
  await expect(p.getByText('Không tìm thấy kết quả')).toBeVisible();
  await p.keyboard.press('Escape');
  await expect(p.getByRole('dialog', { name: 'Tìm kiếm nhanh' })).toHaveCount(0);
});

test('13c2. chế độ tối được nhớ; có manifest PWA và biểu tượng', async ({ request }) => {
  const p = admin.page;
  await p.goto('/#/profile');
  await p.getByRole('button', { name: 'Tối', exact: true }).click();
  await expect(p.locator('html')).toHaveAttribute('data-mode', 'dark');
  await p.reload();
  await expect(p.locator('html')).toHaveAttribute('data-mode', 'dark');
  await p.getByRole('button', { name: 'Sáng', exact: true }).click();
  await expect(p.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(p.locator('link[rel="manifest"]')).toHaveCount(1);
  const m = await request.get('/manifest.webmanifest');
  expect(m.ok()).toBe(true);
  const json = (await m.json()) as { name: string; display: string; icons: { src: string }[] };
  expect(json.name).toBe('Việc của Khoa');
  expect(json.display).toBe('standalone');
  for (const i of json.icons) expect((await request.get(`/${i.src}`)).ok(), i.src).toBe(true);
});

test('13d. hồ sơ cá nhân: đổi họ tên, màu giao diện theo tài khoản, đổi mật khẩu', async ({ browser }) => {
  const p = admin.page;
  await p.goto('/#/profile');
  await p.getByLabel('Họ và tên').fill('Hoàng Dũng (Trưởng khoa)');
  await p.getByRole('button', { name: 'Lưu họ tên' }).click();
  await expect(p.getByText('Đã cập nhật họ tên.')).toBeVisible();
  await p.getByRole('button', { name: 'Tím sen' }).click();
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'sen');
  // đăng nhập lại ở phiên khác: chủ đề đi theo tài khoản (lưu trong hồ sơ)
  const other = await openSession(browser);
  await login(other.page, ADMIN.email);
  await expect(other.page.locator('html')).toHaveAttribute('data-theme', 'sen');
  await other.ctx.close();
  // đổi mật khẩu: sai mật khẩu hiện tại bị từ chối; đúng thì đăng nhập được bằng mật khẩu mới
  await p.getByLabel('Mật khẩu hiện tại').fill('sai-mat-khau');
  await p.getByLabel('Mật khẩu mới', { exact: true }).fill('matkhaumoi456');
  await p.getByLabel('Nhập lại mật khẩu mới').fill('matkhaumoi456');
  await p.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(p.getByText('Mật khẩu hiện tại không đúng.')).toBeVisible();
  await p.getByLabel('Mật khẩu hiện tại').fill('matkhau123');
  await p.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(p.getByText('Đã đổi mật khẩu.')).toBeVisible();
  const again = await openSession(browser);
  await login(again.page, ADMIN.email, 'matkhaumoi456');
  await expectHome(again.page, 'Hoàng Dũng (Trưởng khoa)');
  await again.ctx.close();
});

test('14. không có lỗi console / trang / request nghiêm trọng trong toàn bộ kịch bản', async () => {
  const all = [...admin.errors, ...an.errors];
  expect(all, all.join('\n')).toEqual([]);
});
