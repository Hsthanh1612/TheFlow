// Chạy TRONG trình duyệt (nạp qua dev server) bằng tài khoản quản trị đang đăng nhập, dùng đúng các hàm repo của app,
// nên dữ liệu mẫu đi qua cùng Firestore Rules và cùng logic với dùng thật. Chỉ dành cho Emulator.
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { getServices } from '../../src/services/firebase/init';
import { toUser } from '../../src/services/firebase/converters';
import { applyConfig, saveUserAccess } from '../../src/services/firebase/configRepo';
import { addComment, createTask, extendTask, fetchTask, transitionTask } from '../../src/services/firebase/taskRepo';
import { defaultConfig } from '../../src/domain/defaultConfig';
import { principalOf } from '../../src/domain/permissions';
import { addDays } from '../../src/domain/dates';
import type { KhoaConfig } from '../../src/domain/config';
import type { Priority, UserProfile } from '../../src/domain/types';
import { ADMIN, MEMBERS, PASSWORD, type Member } from './data';

export { ADMIN, MEMBERS, PASSWORD, type Member };

const PATH: Record<string, string[]> = {
  duyet_1_cap: ['todo', 'doing', 'review', 'done'],
  duyet_2_cap: ['todo', 'doing', 'bm_review', 'dean_review', 'done'],
  khong_duyet: ['todo', 'doing', 'done'],
};
type Final = 'todo' | 'doing' | 'review' | 'done';

interface T {
  title: string; type: string; unit: string; who: string[]; collab?: string[]; reviewer?: string;
  start: number; due: number; pri?: Priority; labels?: string[]; check?: string[]; fields?: Record<string, string | number>;
  final: Final; desc?: string; note?: string;
}

export async function seed(): Promise<string> {
  const { auth, db } = getServices();
  const adminUid = auth.currentUser!.uid;
  const users = (await getDocs(collection(db, 'users'))).docs.map((d) => toUser(d.id, d.data()));
  const uid = (email: string): string => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error('Chưa có tài khoản ' + email);
    return u.uid;
  };
  const adminProfile = users.find((u) => u.uid === adminUid) as UserProfile;
  const today = new Date().toISOString().slice(0, 10);
  const day = (n: number) => addDays(today, n);

  // 1) Cấu hình: cây tổ chức, mẫu việc, học kỳ
  const cfg: KhoaConfig = defaultConfig();
  const unitDefs = [
    { id: 'cnpm', name: 'Bộ môn Công nghệ phần mềm', color: '#5B4BF5', head: 'an@khoa.test' },
    { id: 'httt', name: 'Bộ môn Hệ thống thông tin', color: '#0FB5AE', head: 'bich@khoa.test' },
    { id: 'khdl', name: 'Bộ môn Khoa học dữ liệu', color: '#FF6B5E', head: 'huy@khoa.test' },
    { id: 'mmt', name: 'Bộ môn Mạng máy tính', color: '#F5A524', head: 'nam@khoa.test' },
  ];
  cfg.units = [{ ...cfg.units[0], name: 'Khoa Công nghệ thông tin', headId: adminUid }, ...unitDefs.map((u) => ({ id: u.id, parentId: 'khoa', name: u.name, kind: 'bomon' as const, color: u.color, headId: uid(u.head), archived: false }))];
  cfg.templates = [
    { id: 'tpl_kh_giang_day', name: 'Nộp kế hoạch giảng dạy', typeId: 'giao_vu', title: 'Nộp kế hoạch giảng dạy học kỳ', description: 'Nộp kế hoạch giảng dạy theo mẫu của Khoa.', priority: 'normal', checklist: ['Điền biểu mẫu', 'Trưởng bộ môn ký', 'Nộp cho giáo vụ'], dueOffsetDays: 7, recurrence: { kind: 'term', active: true }, archived: false },
    { id: 'tpl_hop_bm', name: 'Họp bộ môn định kỳ', typeId: 'hop', title: 'Họp bộ môn tháng', description: 'Họp giao ban bộ môn.', priority: 'normal', checklist: ['Chuẩn bị nội dung', 'Ghi biên bản'], dueOffsetDays: 3, recurrence: { kind: 'monthly', active: true }, archived: false },
    { id: 'tpl_bao_cao_tuan', name: 'Báo cáo tuần', typeId: 'bao_cao', title: 'Báo cáo công việc tuần', description: '', priority: 'low', checklist: [], dueOffsetDays: 5, recurrence: { kind: 'weekly', active: true }, archived: false },
    { id: 'tpl_de_thi', name: 'Ra đề thi cuối kỳ', typeId: 'de_thi', title: 'Ra đề thi cuối kỳ', description: 'Ra đề và đáp án.', priority: 'high', checklist: ['Soạn đề', 'Soạn đáp án', 'Trưởng bộ môn duyệt'], dueOffsetDays: 21, recurrence: null, archived: false },
  ];
  cfg.terms = [
    { id: 'hk1_2627', name: 'HK1 2026–2027', startDate: '2026-09-07', endDate: '2027-01-16' },
    { id: 'hk2_2627', name: 'HK2 2026–2027', startDate: '2027-02-15', endDate: '2027-06-12' },
  ];
  await applyConfig(defaultConfig(), cfg, adminUid, 'Dữ liệu mẫu');

  // 2) Kích hoạt và gán vai trò cho thành viên
  for (const m of MEMBERS) await saveUserAccess(uid(m.email), { active: true, unitId: m.unit, assignments: [{ roleKey: m.role, unitId: m.unit }] }, cfg.roles, cfg.units);

  // 3) Việc mẫu
  const typeOf = (id: string) => cfg.taskTypes.find((t) => t.id === id)!;
  const wfOf = (id: string) => cfg.workflows.find((w) => w.id === id)!;
  const principal = principalOf(adminProfile, true);
  const rev = (email?: string) => (email ? [uid(email)] : []);
  const tasks: T[] = [
    // Báo cáo (duyệt 2 cấp)
    { title: 'Báo cáo tổng kết học kỳ 1', type: 'bao_cao', unit: 'cnpm', who: ['cuong@khoa.test'], reviewer: 'an@khoa.test', start: -20, due: 6, pri: 'high', labels: ['học kỳ', 'quan trọng'], check: ['Thu thập số liệu', 'Viết báo cáo', 'Trưởng bộ môn xem', 'Nộp Khoa'], fields: { hoc_ky: 'HK1', don_vi_nop: 'Bộ môn CNPM' }, final: 'doing', desc: 'Tổng kết kết quả giảng dạy và nghiên cứu học kỳ 1.' },
    { title: 'Báo cáo tình hình sinh viên cảnh báo học vụ', type: 'bao_cao', unit: 'httt', who: ['duc@khoa.test'], reviewer: 'bich@khoa.test', start: -12, due: 2, pri: 'high', fields: { hoc_ky: 'HK1' }, final: 'review' },
    { title: 'Báo cáo kết quả khảo sát sinh viên', type: 'bao_cao', unit: 'khdl', who: ['ha@khoa.test'], reviewer: 'huy@khoa.test', start: -40, due: -25, fields: { hoc_ky: 'HK hè' }, final: 'done' },
    { title: 'Báo cáo hoạt động phòng lab mạng', type: 'bao_cao', unit: 'mmt', who: ['lan@khoa.test'], reviewer: 'nam@khoa.test', start: -9, due: -3, pri: 'high', fields: { hoc_ky: 'HK1' }, final: 'doing', note: 'Đang chờ số liệu từ phòng thiết bị.' },
    { title: 'Báo cáo công tác coi thi giữa kỳ', type: 'bao_cao', unit: 'cnpm', who: ['dung@khoa.test'], reviewer: 'an@khoa.test', start: 1, due: 14, fields: { hoc_ky: 'HK1' }, final: 'todo' },
    // Đề thi (duyệt 1 cấp)
    { title: 'Ra đề thi Cơ sở dữ liệu', type: 'de_thi', unit: 'httt', who: ['duc@khoa.test'], reviewer: 'bich@khoa.test', start: -7, due: 4, pri: 'high', fields: { hoc_phan: 'Cơ sở dữ liệu' }, check: ['Soạn đề A', 'Soạn đề B', 'Soạn đáp án'], final: 'review' },
    { title: 'Ra đề thi Lập trình hướng đối tượng', type: 'de_thi', unit: 'cnpm', who: ['cuong@khoa.test', 'dung@khoa.test'], reviewer: 'an@khoa.test', start: -5, due: 9, fields: { hoc_phan: 'Lập trình hướng đối tượng' }, check: ['Soạn đề', 'Soạn đáp án'], final: 'doing' },
    { title: 'Ra đề thi Học máy', type: 'de_thi', unit: 'khdl', who: ['ha@khoa.test'], reviewer: 'huy@khoa.test', start: 0, due: 18, fields: { hoc_phan: 'Học máy' }, final: 'todo' },
    { title: 'Ra đề thi Mạng máy tính', type: 'de_thi', unit: 'mmt', who: ['lan@khoa.test'], reviewer: 'nam@khoa.test', start: -30, due: -12, fields: { hoc_phan: 'Mạng máy tính' }, final: 'done' },
    { title: 'Ra đề thi Phân tích thiết kế hệ thống', type: 'de_thi', unit: 'httt', who: ['duc@khoa.test'], reviewer: 'bich@khoa.test', start: -14, due: -4, pri: 'high', fields: { hoc_phan: 'Phân tích thiết kế hệ thống' }, final: 'doing' },
    // Họp / Coi thi (không duyệt)
    { title: 'Họp giao ban Khoa tháng này', type: 'hop', unit: 'khoa', who: ['an@khoa.test', 'bich@khoa.test', 'huy@khoa.test', 'nam@khoa.test'], start: 0, due: 3, fields: { dia_diem: 'Phòng họp A2.01' }, final: 'todo' },
    { title: 'Họp bộ môn CNPM', type: 'hop', unit: 'cnpm', who: ['an@khoa.test'], collab: ['cuong@khoa.test', 'dung@khoa.test'], start: -2, due: 1, fields: { dia_diem: 'Phòng B3.05' }, final: 'doing' },
    { title: 'Họp hội đồng đánh giá đồ án', type: 'hop', unit: 'khoa', who: ['huy@khoa.test'], start: -15, due: -10, fields: { dia_diem: 'Hội trường' }, final: 'done' },
    { title: 'Coi thi môn Cấu trúc dữ liệu (ca 1)', type: 'coi_thi', unit: 'cnpm', who: ['cuong@khoa.test'], start: 3, due: 8, pri: 'normal', final: 'todo' },
    { title: 'Coi thi môn Mạng căn bản (ca 2)', type: 'coi_thi', unit: 'mmt', who: ['lan@khoa.test'], start: 4, due: 9, final: 'todo' },
    { title: 'Coi thi môn Toán rời rạc', type: 'coi_thi', unit: 'khdl', who: ['ha@khoa.test'], start: -8, due: -6, final: 'done' },
    // NCKH
    { title: 'Nộp đề cương đề tài NCKH sinh viên', type: 'nckh', unit: 'khdl', who: ['ha@khoa.test'], reviewer: 'huy@khoa.test', start: -10, due: 11, labels: ['NCKH'], check: ['Hoàn thiện đề cương', 'Xin ý kiến GVHD', 'Nộp'], final: 'doing' },
    { title: 'Viết bài báo hội thảo quốc gia', type: 'nckh', unit: 'cnpm', who: ['dung@khoa.test'], collab: ['cuong@khoa.test'], reviewer: 'an@khoa.test', start: -25, due: 20, pri: 'high', labels: ['NCKH', 'bài báo'], final: 'doing' },
    { title: 'Nghiệm thu đề tài cấp trường', type: 'nckh', unit: 'httt', who: ['bich@khoa.test'], reviewer: 'bich@khoa.test', start: -60, due: -30, labels: ['NCKH'], final: 'done' },
    // Tuyển sinh
    { title: 'Chuẩn bị tờ rơi tuyển sinh 2027', type: 'tuyen_sinh', unit: 'khoa', who: ['mai@khoa.test'], reviewer: 'an@khoa.test', start: -4, due: 12, labels: ['tuyển sinh'], check: ['Nội dung', 'Thiết kế', 'In ấn'], final: 'doing' },
    { title: 'Tư vấn tuyển sinh tại trường THPT', type: 'tuyen_sinh', unit: 'mmt', who: ['nam@khoa.test', 'lan@khoa.test'], reviewer: 'nam@khoa.test', start: 6, due: 7, final: 'todo' },
    { title: 'Tổng hợp danh sách thí sinh đăng ký', type: 'tuyen_sinh', unit: 'khoa', who: ['mai@khoa.test'], reviewer: 'an@khoa.test', start: -18, due: -1, pri: 'high', final: 'review' },
    // Giáo vụ
    { title: 'Nộp kế hoạch giảng dạy HK2', type: 'giao_vu', unit: 'cnpm', who: ['cuong@khoa.test'], reviewer: 'an@khoa.test', start: -3, due: 7, check: ['Điền biểu mẫu', 'Trưởng bộ môn ký', 'Nộp cho giáo vụ'], final: 'doing' },
    { title: 'Nộp kế hoạch giảng dạy HK2', type: 'giao_vu', unit: 'httt', who: ['duc@khoa.test'], reviewer: 'bich@khoa.test', start: -3, due: 7, final: 'todo' },
    { title: 'Nộp kế hoạch giảng dạy HK2', type: 'giao_vu', unit: 'khdl', who: ['ha@khoa.test'], reviewer: 'huy@khoa.test', start: -3, due: 7, final: 'review' },
    { title: 'Xếp thời khoá biểu HK2', type: 'giao_vu', unit: 'khoa', who: ['mai@khoa.test'], reviewer: 'an@khoa.test', start: -10, due: 5, pri: 'high', final: 'doing' },
    { title: 'Cập nhật điểm rèn luyện sinh viên', type: 'giao_vu', unit: 'khoa', who: ['mai@khoa.test'], start: -35, due: -20, final: 'done' },
    // Chương trình đào tạo
    { title: 'Rà soát chuẩn đầu ra chương trình CNTT', type: 'chuong_trinh', unit: 'cnpm', who: ['an@khoa.test'], collab: ['cuong@khoa.test', 'dung@khoa.test'], reviewer: 'an@khoa.test', start: -30, due: 25, pri: 'high', labels: ['kiểm định'], check: ['Thu thập phản hồi doanh nghiệp', 'Đối chiếu CĐR', 'Soạn báo cáo'], final: 'doing' },
    { title: 'Cập nhật đề cương học phần Khoa học dữ liệu', type: 'chuong_trinh', unit: 'khdl', who: ['huy@khoa.test', 'ha@khoa.test'], reviewer: 'huy@khoa.test', start: -6, due: 15, final: 'doing' },
    { title: 'Đề xuất học phần tự chọn mới', type: 'chuong_trinh', unit: 'mmt', who: ['nam@khoa.test'], reviewer: 'nam@khoa.test', start: 2, due: 30, pri: 'low', final: 'todo' },
  ];

  let created = 0;
  const made: { id: string; t: T }[] = [];
  for (const t of tasks) {
    const type = typeOf(t.type);
    const workflow = wfOf(type.workflowId);
    const id = await createTask({
      type, workflow, title: t.title, description: t.desc ?? '', priority: t.pri ?? 'normal', labels: t.labels ?? [], startAt: day(t.start), dueAt: day(t.due), unitId: t.unit,
      assigneeIds: t.who.map(uid), collaboratorIds: (t.collab ?? []).map(uid), reviewerIds: rev(t.reviewer), checklist: t.check ?? [], customFields: t.fields ?? {},
    }, adminProfile);
    created++;
    const path = PATH[workflow.id];
    const target = t.final === 'todo' ? 0 : t.final === 'doing' ? 1 : t.final === 'review' ? 2 : path.length - 1;
    for (let i = 1; i <= target; i++) {
      const task = (await fetchTask(id))!;
      await transitionTask({ task, workflow, to: path[i], note: i === target && t.note ? t.note : '', actor: adminProfile, principal });
    }
    made.push({ id, t });
  }

  // 4) Bình luận và gia hạn
  const byTitle = (s: string) => made.find((m) => m.t.title === s)!;
  const c1 = byTitle('Báo cáo tổng kết học kỳ 1');
  await addComment((await fetchTask(c1.id))!, 'Em nhớ đính kèm bảng số liệu điểm trung bình nhé.', [uid('cuong@khoa.test')], adminProfile);
  await addComment((await fetchTask(c1.id))!, 'Đã xong phần thu thập số liệu, đang viết báo cáo.', [], adminProfile);
  const c2 = byTitle('Ra đề thi Cơ sở dữ liệu');
  await addComment((await fetchTask(c2.id))!, 'Đề A cần thêm câu về chuẩn hoá. Nhờ thầy xem lại.', [uid('duc@khoa.test')], adminProfile);
  const late = byTitle('Báo cáo hoạt động phòng lab mạng');
  await extendTask((await fetchTask(late.id))!, day(5), 'Chờ số liệu từ phòng thiết bị.', adminProfile);

  // Xác nhận quyền admin đọc được dữ liệu vừa ghi
  const check = await getDoc(doc(db, 'tasks', made[0].id));
  return `Đã tạo ${created} việc, ${MEMBERS.length} thành viên, ${cfg.units.length - 1} bộ môn, ${cfg.templates.length} mẫu việc; task đầu tồn tại: ${check.exists()}`;
}
