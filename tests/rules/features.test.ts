import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { makeEnv, NOW, seed } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await makeEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await seed(env); });
const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.vn` }).firestore();

// Dữ liệu cơ sở: t1 (bm1, an phụ trách, head1 duyệt), t2 (bm2, lan phụ trách)
const entry = (over: object = {}) => ({ taskId: 't1', userId: 'an', unitId: 'bm1', day: '2026-11-16', minutes: 45, note: 'Soạn đề', source: 'manual', createdAt: NOW, ...over });

describe('theo dõi thời gian', () => {
  it('người tham gia ghi giờ cho việc của mình', async () => {
    await assertSucceeds(setDoc(doc(as('an'), 'timeEntries/e1'), entry()));
  });
  it('không ghi giờ thay người khác, cho việc không thấy được, hoặc sai đơn vị', async () => {
    await assertFails(setDoc(doc(as('an'), 'timeEntries/e1'), entry({ userId: 'head1' })));
    await assertFails(setDoc(doc(as('an'), 'timeEntries/e2'), entry({ taskId: 't2', unitId: 'bm2' })));
    await assertFails(setDoc(doc(as('an'), 'timeEntries/e3'), entry({ unitId: 'bm2' })));
  });
  it('số phút phải là số nguyên 1–1440, trường lạ bị từ chối', async () => {
    const db = as('an');
    for (const bad of [0, -5, 1441, 12.5, '30']) await assertFails(setDoc(doc(db, 'timeEntries/x'), entry({ minutes: bad })));
    await assertFails(setDoc(doc(db, 'timeEntries/x'), entry({ extra: 1 })));
    await assertFails(setDoc(doc(db, 'timeEntries/x'), entry({ day: '16/11/2026' })));
  });
  it('bản ghi bất biến; chỉ chủ sở hữu xoá được', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'timeEntries/e1'), entry()); });
    await assertFails(updateDoc(doc(as('an'), 'timeEntries/e1'), { minutes: 999 }));
    await assertFails(deleteDoc(doc(as('head1'), 'timeEntries/e1')));
    await assertSucceeds(deleteDoc(doc(as('an'), 'timeEntries/e1')));
  });
  it('đọc: chủ sở hữu và người xem được đơn vị; người ngoài thì không', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'timeEntries/e1'), entry()); });
    await assertSucceeds(getDocs(query(collection(as('an'), 'timeEntries'), where('userId', '==', 'an'))));
    await assertSucceeds(getDocs(query(collection(as('head1'), 'timeEntries'), where('unitId', 'in', ['bm1', 'bm1a']))));
    await assertFails(getDocs(query(collection(as('lan'), 'timeEntries'), where('unitId', 'in', ['bm1']))));
    await assertFails(getDocs(query(collection(as('lan'), 'timeEntries'), where('userId', '==', 'an'))));
  });
  it('đồng hồ đang chạy: chỉ chủ sở hữu, đúng hình dạng', async () => {
    const t = { taskId: 't1', title: 'Ra đề thi', startedAt: NOW };
    await assertSucceeds(setDoc(doc(as('an'), 'users/an/timer/current'), t));
    await assertFails(setDoc(doc(as('head1'), 'users/an/timer/current'), t));
    await assertFails(setDoc(doc(as('an'), 'users/an/timer/other'), t));
    await assertFails(setDoc(doc(as('an'), 'users/an/timer/current'), { ...t, extra: 1 }));
    await assertSucceeds(deleteDoc(doc(as('an'), 'users/an/timer/current')));
  });
});

const goal = (over: object = {}) => ({ id: 'g1', name: 'Hoàn thành kiểm định', description: '', unitId: 'bm1', ownerId: 'head1', termId: null, dueDate: '2026-12-31', status: 'active', keyResults: [{ id: 'k1', text: 'Nộp báo cáo', target: 3, current: 1, unit: 'bản' }], taskIds: ['t1'], createdBy: 'head1', createdAt: NOW, updatedAt: NOW, ...over });

describe('mục tiêu (OKR)', () => {
  it('người có quyền giao việc trong đơn vị tạo và sửa được; mọi người dùng active đọc được', async () => {
    await assertSucceeds(setDoc(doc(as('head1'), 'goals/g1'), goal()));
    await assertSucceeds(updateDoc(doc(as('head1'), 'goals/g1'), { status: 'done', updatedAt: NOW }));
    await assertSucceeds(getDocs(collection(as('an'), 'goals')));
  });
  it('giảng viên không tạo/sửa; Trưởng bộ môn không tạo mục tiêu cho đơn vị khác', async () => {
    await assertFails(setDoc(doc(as('an'), 'goals/g1'), goal({ createdBy: 'an' })));
    await assertFails(setDoc(doc(as('head1'), 'goals/g2'), goal({ id: 'g2', unitId: 'bm2' })));
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'goals/g1'), goal()); });
    await assertFails(updateDoc(doc(as('an'), 'goals/g1'), { current: 1, updatedAt: NOW }));
    await assertFails(updateDoc(doc(as('head2'), 'goals/g1'), { name: 'Chiếm quyền', updatedAt: NOW }));
  });
  it('kiểm tra hình dạng: tên rỗng, trạng thái lạ, quá nhiều KR/việc, người tạo giả, không xoá cứng', async () => {
    const db = as('head1');
    await assertFails(setDoc(doc(db, 'goals/x'), goal({ id: 'x', name: '' })));
    await assertFails(setDoc(doc(db, 'goals/x'), goal({ id: 'x', status: 'hack' })));
    await assertFails(setDoc(doc(db, 'goals/x'), goal({ id: 'x', keyResults: Array.from({ length: 11 }, (_, i) => ({ id: `k${i}`, text: 'a', target: 1, current: 0, unit: '' })) })));
    await assertFails(setDoc(doc(db, 'goals/x'), goal({ id: 'x', taskIds: Array.from({ length: 201 }, (_, i) => `t${i}`) })));
    await assertFails(setDoc(doc(db, 'goals/x'), goal({ id: 'x', createdBy: 'an' })));
    await assertSucceeds(setDoc(doc(db, 'goals/g1'), goal()));
    await assertFails(deleteDoc(doc(db, 'goals/g1')));
  });
});

const auto = (over: object = {}) => ({ id: 'a1', name: 'Báo người duyệt khi nộp', enabled: true, trigger: { kind: 'state_changed', typeId: null, toCategory: 'review', days: 0 }, action: { kind: 'notify', to: ['reviewers'], text: '{actor} vừa nộp “{title}”' }, createdBy: 'dean', createdAt: NOW, updatedAt: NOW, ...over });

describe('tự động hoá', () => {
  it('chỉ người có config.edit toàn Khoa tạo/sửa/xoá; mọi người dùng active đọc', async () => {
    await assertSucceeds(setDoc(doc(as('dean'), 'automations/a1'), auto()));
    await assertSucceeds(getDocs(collection(as('an'), 'automations')));
    await assertFails(setDoc(doc(as('head1'), 'automations/a2'), auto({ id: 'a2' })));
    await assertFails(setDoc(doc(as('an'), 'automations/a2'), auto({ id: 'a2' })));
    await assertSucceeds(deleteDoc(doc(as('dean'), 'automations/a1')));
  });
  it('kiểm tra hình dạng: loại kích hoạt/hành động lạ, danh sách người nhận rỗng, nội dung quá dài', async () => {
    const db = as('dean');
    await assertFails(setDoc(doc(db, 'automations/x'), auto({ id: 'x', trigger: { kind: 'cron', typeId: null, toCategory: null, days: 0 } })));
    await assertFails(setDoc(doc(db, 'automations/x'), auto({ id: 'x', action: { kind: 'delete_all', to: ['reviewers'], text: 'x' } })));
    await assertFails(setDoc(doc(db, 'automations/x'), auto({ id: 'x', action: { kind: 'notify', to: [], text: 'x' } })));
    await assertFails(setDoc(doc(db, 'automations/x'), auto({ id: 'x', action: { kind: 'notify', to: ['reviewers'], text: 'x'.repeat(201) } })));
    await assertFails(setDoc(doc(db, 'automations/x'), auto({ id: 'x', enabled: 'yes' })));
  });
  it('thông báo kiểu automation được tạo cho người khác nhưng người nhận mới đánh dấu đã đọc', async () => {
    const n = { actorId: 'head1', taskId: 't1', kind: 'automation', text: 'x', createdAt: NOW, readAt: null };
    await assertSucceeds(setDoc(doc(as('head1'), 'users/an/notifications/n1'), n));
    await assertFails(setDoc(doc(as('head1'), 'users/an/notifications/n2'), { ...n, actorId: 'an' }));
  });
});

const snap = (over: object = {}) => ({ id: '2026-11-16', week: '2026-11-16', total: { todo: 1, doing: 2, review: 0, done: 3, late: 1 }, byUnit: { bm1: { todo: 1, doing: 2, review: 0, done: 3, late: 1 } }, takenBy: 'dean', createdAt: NOW, ...over });

describe('ảnh chụp tình trạng tuần', () => {
  it('người xem được toàn Khoa chụp một lần cho mỗi tuần; không sửa/xoá', async () => {
    await assertSucceeds(setDoc(doc(as('dean'), 'snapshots/2026-11-16'), snap()));
    await assertFails(setDoc(doc(as('dean'), 'snapshots/2026-11-16'), snap({ total: { todo: 99, doing: 0, review: 0, done: 0, late: 0 } })));
    await assertFails(deleteDoc(doc(as('dean'), 'snapshots/2026-11-16')));
  });
  it('Trưởng bộ môn (chỉ thấy một đơn vị) không được chụp vì số liệu sẽ thiếu', async () => {
    await assertFails(setDoc(doc(as('head1'), 'snapshots/2026-11-16'), snap({ takenBy: 'head1' })));
  });
  it('ID phải khớp tuần; không giả người chụp; đọc chỉ dành cho người có quyền quản lý', async () => {
    await assertFails(setDoc(doc(as('dean'), 'snapshots/2026-11-23'), snap()));
    await assertFails(setDoc(doc(as('dean'), 'snapshots/2026-11-16'), snap({ takenBy: 'head1' })));
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'snapshots/2026-11-16'), snap()); });
    await assertSucceeds(getDocs(collection(as('head1'), 'snapshots')));
    await assertFails(getDocs(collection(as('an'), 'snapshots')));
  });
});

describe('chế độ sáng/tối của hồ sơ', () => {
  it('tự đặt chế độ hợp lệ; giá trị lạ hoặc kèm trường khác bị từ chối', async () => {
    const db = as('an');
    await assertSucceeds(updateDoc(doc(db, 'users/an'), { mode: 'dark' }));
    await assertSucceeds(updateDoc(doc(db, 'users/an'), { mode: 'auto', theme: 'tim' }));
    await assertFails(updateDoc(doc(db, 'users/an'), { mode: 'neon' }));
    await assertFails(updateDoc(doc(db, 'users/an'), { mode: 'dark', active: false }));
  });
});
