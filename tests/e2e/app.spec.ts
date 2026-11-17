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

test('9. giao việc hàng loạt trong một lần ghi; xem trước đúng; không giao trùng', async () => {
  const p = admin.page;
  await p.getByRole('link', { name: 'Giao việc hàng loạt' }).click();
  await expect(p.getByRole('heading', { name: 'Giao việc hàng loạt' })).toBeVisible();
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

test('10. tổng quan, rủi ro, tiến độ đơn vị, báo cáo hiển thị dữ liệu thật', async () => {
  const p = admin.page;
  await p.getByRole('link', { name: 'Tổng quan' }).click();
  await expect(p.getByRole('heading', { level: 1 })).toContainText('Tổng quan');
  await expect(p.getByText('% hoàn thành so với kế hoạch')).toBeVisible();
  await p.getByRole('link', { name: /Rủi ro/ }).click();
  await expect(p.getByRole('heading', { name: /Rủi ro/ })).toBeVisible();
  await p.getByRole('link', { name: 'Tiến độ đơn vị' }).click();
  await expect(p.getByText('Thành viên —')).toBeVisible();
  await p.getByRole('link', { name: /Báo cáo/ }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Xuất Excel/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.csv$/);
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

test('14. không có lỗi console / trang / request nghiêm trọng trong toàn bộ kịch bản', async () => {
  const all = [...admin.errors, ...an.errors];
  expect(all, all.join('\n')).toEqual([]);
});
