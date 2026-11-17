import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { makeEnv, NOW, seed } from './helpers';
import { task } from '../domain/fixtures';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await seed(env);
});

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.vn` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
let seq = 0;
/** Patch ghi một mục nhật ký (dotted path) + lastActivityId, đúng như service của app. */
const act = (uid: string, detail = '', extra: object = {}) => {
  const id = `a${++seq}`;
  return { [`activity.${id}`]: { actorId: uid, action: 'transition', detail, createdAt: NOW }, lastActivityId: id, ...extra };
};
const withNote = (uid: string, note: string, extra: object = {}) => act(uid, note, { statusNote: note, statusNoteAt: NOW, updatedAt: NOW, ...extra });

describe('người chưa đăng nhập', () => {
  it('không đọc được bất kỳ dữ liệu riêng tư nào', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'tasks/t1')));
    await assertFails(getDocs(collection(db, 'tasks')));
    await assertFails(getDoc(doc(db, 'users/an')));
    await assertFails(getDoc(doc(db, 'units/khoa')));
    await assertFails(getDoc(doc(db, 'settings/app')));
    await assertFails(getDocs(collection(db, 'notifications')));
  });
  it('không ghi được gì', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'tasks/x'), task({ id: 'x' })));
    await assertFails(setDoc(doc(db, 'units/x'), { id: 'x', name: 'X' }));
    await assertFails(setDoc(doc(db, 'meta/bootstrap'), { adminUid: 'a', createdAt: NOW }));
  });
});

describe('tài khoản chưa được kích hoạt', () => {
  it('đã đăng nhập nhưng chưa active: không đọc cấu hình, việc, người dùng khác', async () => {
    const db = as('off');
    await assertFails(getDoc(doc(db, 'units/khoa')));
    await assertFails(getDoc(doc(db, 'tasks/t2')));
    await assertFails(getDoc(doc(db, 'users/an')));
    await assertFails(getDocs(collection(db, 'users')));
  });
  it('vẫn đọc được hồ sơ của chính mình để biết trạng thái', async () => {
    await assertSucceeds(getDoc(doc(as('off'), 'users/off')));
  });
  it('không tự kích hoạt hay tự cấp quyền cho mình', async () => {
    const db = as('off');
    await assertFails(updateDoc(doc(db, 'users/off'), { active: true }));
    await assertFails(updateDoc(doc(db, 'users/off'), { scopes: { 'config.edit': ['*'] } }));
  });
});

describe('đăng ký tài khoản mới', () => {
  const profile = (uid: string, over: object = {}) => ({ name: 'Mới', email: `${uid}@x.vn`, active: false, unitId: null, assignments: [], scopes: {}, createdAt: NOW, ...over });
  it('tạo hồ sơ của chính mình ở trạng thái chưa kích hoạt', async () => {
    await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), profile('newbie')));
  });
  it('không tạo hồ sơ cho người khác', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/other'), profile('other')));
  });
  it('không tự tạo hồ sơ đã active hoặc có quyền / đơn vị / email giả', async () => {
    const db = as('newbie');
    await assertFails(setDoc(doc(db, 'users/newbie'), profile('newbie', { active: true })));
    await assertFails(setDoc(doc(db, 'users/newbie'), profile('newbie', { scopes: { 'config.edit': ['*'] } })));
    await assertFails(setDoc(doc(db, 'users/newbie'), profile('newbie', { assignments: [{ roleKey: 'quan_tri', unitId: 'khoa' }] })));
    await assertFails(setDoc(doc(db, 'users/newbie'), profile('newbie', { unitId: 'khoa' })));
    await assertFails(setDoc(doc(db, 'users/newbie'), profile('newbie', { email: 'ceo@x.vn' })));
  });
  it('không thêm trường lạ', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), profile('newbie', { isAdmin: true })));
  });
});

describe('khởi tạo quản trị viên đầu tiên', () => {
  async function freshWithoutBootstrap() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await deleteDoc(doc(db, 'meta/bootstrap'));
      await deleteDoc(doc(db, 'admins/admin'));
      await setDoc(doc(db, 'users/first'), { name: 'Người đầu', email: 'first@x.vn', active: false, unitId: null, assignments: [], scopes: {}, createdAt: NOW });
      await setDoc(doc(db, 'users/second'), { name: 'Người hai', email: 'second@x.vn', active: false, unitId: null, assignments: [], scopes: {}, createdAt: NOW });
    });
  }
  it('người đầu tiên nhận quyền quản trị trong một batch nguyên tử', async () => {
    await freshWithoutBootstrap();
    const db = as('first');
    const b = writeBatch(db);
    b.set(doc(db, 'meta/bootstrap'), { adminUid: 'first', createdAt: NOW });
    b.set(doc(db, 'admins/first'), { createdAt: NOW });
    b.update(doc(db, 'users/first'), { active: true });
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(doc(db, 'units/test'), { id: 'test', name: 'T', parentId: 'khoa', kind: 'to', color: '#112233', headId: null, archived: false }));
  });
  it('sau khi đã có bootstrap thì không ai nhận thêm quyền quản trị', async () => {
    await freshWithoutBootstrap();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'meta/bootstrap'), { adminUid: 'first', createdAt: NOW }));
    const db = as('second');
    const b = writeBatch(db);
    b.set(doc(db, 'admins/second'), { createdAt: NOW });
    await assertFails(b.commit());
    await assertFails(setDoc(doc(db, 'admins/second'), { createdAt: NOW }));
  });
  it('không thể ghi bootstrap cho người khác', async () => {
    await freshWithoutBootstrap();
    const db = as('second');
    const b = writeBatch(db);
    b.set(doc(db, 'meta/bootstrap'), { adminUid: 'first', createdAt: NOW });
    b.set(doc(db, 'admins/second'), { createdAt: NOW });
    await assertFails(b.commit());
  });
  it('không thể tự kích hoạt nếu không đi kèm admins/{uid} hợp lệ', async () => {
    await freshWithoutBootstrap();
    await assertFails(updateDoc(doc(as('second'), 'users/second'), { active: true }));
  });
});

describe('quản lý người dùng', () => {
  it('quản trị kích hoạt người dùng và gán quyền', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'users/off'), { active: true, unitId: 'bm2', assignments: [{ roleKey: 'giang_vien', unitId: 'bm2' }], scopes: {} }));
  });
  it('Trưởng khoa (không có user.manage) không sửa được quyền của người khác', async () => {
    await assertFails(updateDoc(doc(as('dean'), 'users/an'), { scopes: { 'config.edit': ['*'] } }));
  });
  it('giảng viên không tự nâng quyền; chỉ tự sửa được tên', async () => {
    const db = as('an');
    await assertFails(updateDoc(doc(db, 'users/an'), { scopes: { 'task.approve': ['*'] } }));
    await assertFails(updateDoc(doc(db, 'users/an'), { assignments: [{ roleKey: 'truong_khoa', unitId: 'khoa' }] }));
    await assertFails(updateDoc(doc(db, 'users/an'), { active: false, unitId: 'bm2' }));
    await assertSucceeds(updateDoc(doc(db, 'users/an'), { name: 'Nguyễn An (mới)' }));
  });
  it('không sửa được hồ sơ người khác; không xoá hồ sơ', async () => {
    await assertFails(updateDoc(doc(as('an'), 'users/lan'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as('admin'), 'users/an')));
  });
});

describe('cấu hình động', () => {
  const unit = { id: 'bm9', name: 'Bộ môn 9', parentId: 'khoa', kind: 'bomon', color: '#112233', headId: null, archived: false };
  it('mọi người dùng active đọc được cấu hình', async () => {
    await assertSucceeds(getDoc(doc(as('an'), 'units/bm1')));
    await assertSucceeds(getDocs(collection(as('an'), 'taskTypes')));
  });
  it('chỉ người có config.edit toàn Khoa mới ghi được; Trưởng bộ môn và giảng viên thì không', async () => {
    await assertSucceeds(setDoc(doc(as('dean'), 'units/bm9'), unit));
    await assertFails(setDoc(doc(as('head1'), 'units/bm9'), unit));
    await assertFails(setDoc(doc(as('an'), 'units/bm9'), unit));
  });
  it('không xoá cứng cấu hình (chỉ lưu trữ)', async () => {
    await assertFails(deleteDoc(doc(as('admin'), 'taskTypes/hop')));
    await assertFails(deleteDoc(doc(as('admin'), 'units/bm1')));
  });
  it('quy trình thiếu trường dẫn xuất bị từ chối (Rules phụ thuộc vào chúng)', async () => {
    await assertFails(setDoc(doc(as('admin'), 'workflows/hong'), { id: 'hong', name: 'Hỏng', initialState: 'a', states: [{ key: 'a' }, { key: 'b' }], archived: false }));
  });
  it('loại việc phải trỏ tới quy trình tồn tại', async () => {
    const t = { id: 'moi', name: 'Mới', color: '#112233', workflowId: 'khong_co', fields: [], archived: false };
    await assertFails(setDoc(doc(as('admin'), 'taskTypes/moi'), t));
    await assertSucceeds(setDoc(doc(as('admin'), 'taskTypes/moi'), { ...t, workflowId: 'khong_duyet' }));
  });
  it('lịch sử phiên bản chỉ thêm; không sửa/xoá', async () => {
    const v = { entity: 'taskTypes', snapshot: '{}', changedBy: 'admin', createdAt: NOW };
    await assertSucceeds(setDoc(doc(as('admin'), 'configVersions/v1'), v));
    await assertFails(updateDoc(doc(as('admin'), 'configVersions/v1'), { snapshot: 'x' }));
    await assertFails(deleteDoc(doc(as('admin'), 'configVersions/v1')));
    await assertFails(setDoc(doc(as('admin'), 'configVersions/v2'), { ...v, changedBy: 'an' }));
    await assertFails(getDoc(doc(as('an'), 'configVersions/v1')));
  });
});

describe('đọc công việc', () => {
  it('người liên quan đọc được việc của mình', async () => {
    await assertSucceeds(getDoc(doc(as('an'), 'tasks/t1')));
    await assertSucceeds(getDoc(doc(as('head1'), 'tasks/t1'))); // người duyệt
  });
  it('người không liên quan không đọc được việc của người khác', async () => {
    await assertFails(getDoc(doc(as('lan'), 'tasks/t1')));
    await assertFails(getDoc(doc(as('ha'), 'tasks/t1')));
  });
  it('Trưởng bộ môn xem được việc của bộ môn mình, không xem được bộ môn khác', async () => {
    await assertSucceeds(getDoc(doc(as('head1'), 'tasks/t3')));
    await assertFails(getDoc(doc(as('head1'), 'tasks/t2')));
  });
  it('Trưởng khoa và quản trị xem được mọi việc', async () => {
    await assertSucceeds(getDoc(doc(as('dean'), 'tasks/t2')));
    await assertSucceeds(getDoc(doc(as('admin'), 'tasks/t2')));
  });
  it('truy vấn: việc của tôi (array-contains) được phép', async () => {
    await assertSucceeds(getDocs(query(collection(as('an'), 'tasks'), where('participantIds', 'array-contains', 'an'))));
  });
  it('truy vấn: tải toàn bộ collection bị từ chối với giảng viên', async () => {
    await assertFails(getDocs(collection(as('an'), 'tasks')));
    await assertFails(getDocs(query(collection(as('an'), 'tasks'), where('participantIds', 'array-contains', 'lan'))));
  });
  it('truy vấn: Trưởng khoa tải toàn bộ; Trưởng bộ môn lọc theo đơn vị của mình', async () => {
    await assertSucceeds(getDocs(collection(as('dean'), 'tasks')));
    await assertSucceeds(getDocs(query(collection(as('head1'), 'tasks'), where('unitId', 'in', ['bm1', 'bm1a']))));
    await assertFails(getDocs(query(collection(as('head1'), 'tasks'), where('unitId', 'in', ['bm2']))));
    await assertFails(getDocs(collection(as('head1'), 'tasks')));
  });
});

describe('tạo công việc', () => {
  const mine = (over = {}) => task({ id: 'n1', stateKey: 'todo', assigneeIds: ['an'], reviewerIds: [], participantIds: ['an'], createdBy: 'an', unitId: 'bm1', createdAt: NOW, updatedAt: NOW, ...over });
  it('giảng viên tự tạo việc cho chính mình trong đơn vị của mình', async () => {
    await assertSucceeds(setDoc(doc(as('an'), 'tasks/n1'), mine()));
  });
  it('giảng viên không giao việc cho người khác', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ assigneeIds: ['lan'], participantIds: ['lan'] })));
  });
  it('giảng viên không tạo việc ở đơn vị khác', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ unitId: 'bm2' })));
  });
  it('không giả mạo người tạo', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ createdBy: 'head1' })));
  });
  it('Trưởng bộ môn giao việc trong bộ môn mình, không giao sang bộ môn khác', async () => {
    const t = mine({ createdBy: 'head1', assigneeIds: ['an', 'ha'], participantIds: ['an', 'ha'] });
    await assertSucceeds(setDoc(doc(as('head1'), 'tasks/n1'), t));
    await assertFails(setDoc(doc(as('head1'), 'tasks/n2'), { ...t, id: 'n2', unitId: 'bm2' }));
  });
  it('trạng thái ban đầu phải đúng quy trình; không tạo sẵn ở trạng thái hoàn thành', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ stateKey: 'done', completedAt: NOW })));
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ stateKey: 'review' })));
  });
  it('workflowId phải khớp loại việc', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n1'), mine({ workflowId: 'khong_duyet' })));
  });
  it('dữ liệu sai cấu trúc bị từ chối', async () => {
    const db = as('an');
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ title: '' })));
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ title: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ priority: 'khan' })));
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ checklist: 'không phải mảng' as never })));
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ participantIds: [] })));
    await assertFails(setDoc(doc(db, 'tasks/n1'), mine({ assigneeIds: [], participantIds: [] })));
  });
  it('id trong dữ liệu phải khớp id tài liệu', async () => {
    await assertFails(setDoc(doc(as('an'), 'tasks/n9'), mine({ id: 'n1' })));
  });
  it('giao hàng loạt: cần quyền task.bulk_assign; ghi nguyên tử nhiều việc', async () => {
    const db = as('head1');
    const b = writeBatch(db);
    for (let i = 0; i < 20; i++) b.set(doc(db, `tasks/b${i}`), mine({ id: `b${i}`, createdBy: 'head1', bulkId: 'bulk1', assigneeIds: ['an'], participantIds: ['an'] }));
    await assertSucceeds(b.commit());
    const db2 = as('an');
    const b2 = writeBatch(db2);
    b2.set(doc(db2, 'tasks/bx'), mine({ id: 'bx', bulkId: 'bulk2' }));
    await assertFails(b2.commit());
  });
});

describe('chuyển trạng thái theo quy trình', () => {
  it('người phụ trách bắt đầu làm: todo → doing; nộp duyệt: doing → review', async () => {
    const db = as('an');
    await assertSucceeds(updateDoc(doc(db, 'tasks/t1'), { stateKey: 'review', updatedAt: NOW, ...act('an', 'Nộp để duyệt') }));
  });
  it('người phụ trách KHÔNG tự duyệt xong việc của mình', async () => {
    await assertFails(updateDoc(doc(as('an'), 'tasks/t3'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('an') }));
  });
  it('người duyệt duyệt xong: bắt buộc đặt completedAt', async () => {
    const db = as('head1');
    await assertFails(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'done', updatedAt: NOW, ...act('head1') }));
    await assertSucceeds(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('head1') }));
  });
  it('trả lại bắt buộc có ý kiến (nhật ký + statusNote cùng thời điểm)', async () => {
    const db = as('head1');
    await assertFails(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'doing', updatedAt: NOW, ...act('head1', '') }));
    await assertFails(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'doing', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'doing', ...act('head1', 'Thiếu phần đề xuất', { updatedAt: NOW }) })); // thiếu statusNote
    await assertSucceeds(updateDoc(doc(db, 'tasks/t3'), { stateKey: 'doing', ...withNote('head1', 'Thiếu phần đề xuất') }));
  });
  it('bước không có trong quy trình bị từ chối (todo → done)', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'tasks/t4'), task({ id: 't4', stateKey: 'todo' })));
    await assertFails(updateDoc(doc(as('dean'), 'tasks/t4'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('dean') }));
  });
  it('Trưởng bộ môn khác đơn vị không duyệt được việc bộ môn 1', async () => {
    await assertFails(updateDoc(doc(as('head2'), 'tasks/t3'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('head2') }));
  });
  it('người ngoài không liên quan không đổi được trạng thái', async () => {
    await assertFails(updateDoc(doc(as('lan'), 'tasks/t1'), { stateKey: 'review', updatedAt: NOW, ...act('lan') }));
  });
  it('rời trạng thái hoàn thành thì completedAt phải về null', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'tasks/t5'), task({ id: 't5', stateKey: 'done', completedAt: NOW })));
    await assertFails(updateDoc(doc(as('head1'), 'tasks/t5'), { stateKey: 'doing', updatedAt: NOW, ...act('head1') }));
    await assertSucceeds(updateDoc(doc(as('head1'), 'tasks/t5'), { stateKey: 'doing', completedAt: null, updatedAt: NOW, ...act('head1') }));
  });
  it('duyệt 2 cấp: bước cuối chỉ Trưởng khoa', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'tasks/t6'), task({ id: 't6', typeId: 'bao_cao', workflowId: 'duyet_2_cap', stateKey: 'dean_review' })));
    await assertFails(updateDoc(doc(as('head1'), 'tasks/t6'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('head1') }));
    await assertSucceeds(updateDoc(doc(as('dean'), 'tasks/t6'), { stateKey: 'done', completedAt: NOW, updatedAt: NOW, ...act('dean') }));
  });
});

describe('sửa công việc & trường được bảo vệ', () => {
  it('người phụ trách cập nhật checklist, liên kết, trường động', async () => {
    await assertSucceeds(updateDoc(doc(as('an'), 'tasks/t1'), { checklist: [{ id: 'c1', text: 'Việc nhỏ', done: true }], updatedAt: NOW }));
  });
  it('người phụ trách KHÔNG đổi được hạn, người phụ trách, đơn vị, người tạo, loại việc', async () => {
    const db = as('an');
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { dueAt: '2027-01-01', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { assigneeIds: ['an', 'lan'], participantIds: ['an', 'lan', 'head1'], updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { unitId: 'bm2', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { createdBy: 'an', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { typeId: 'hop', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { workflowId: 'khong_duyet', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { title: 'Đổi tiêu đề', updatedAt: NOW }));
  });
  it('trưởng bộ môn gia hạn và đổi người phụ trách trong đơn vị mình', async () => {
    const db = as('head1');
    await assertSucceeds(updateDoc(doc(db, 'tasks/t1'), { dueAt: '2026-12-01', updatedAt: NOW, ...act('head1', 'Gia hạn: lý do') }));
    await assertSucceeds(updateDoc(doc(db, 'tasks/t1'), { assigneeIds: ['ha'], participantIds: ['ha', 'head1'], updatedAt: NOW, ...act('head1', 'Đổi người') }));
  });
  it('trưởng bộ môn không gia hạn / đổi người việc của bộ môn khác', async () => {
    const db = as('head1');
    await assertFails(updateDoc(doc(db, 'tasks/t2'), { dueAt: '2026-12-01', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'tasks/t2'), { assigneeIds: ['an'], participantIds: ['an', 'head2'], updatedAt: NOW }));
  });
  it('nhật ký chỉ thêm: không sửa/xoá mục cũ, không thêm 2 mục, không mạo danh', async () => {
    const e1 = { actorId: 'head1', action: 'transition', detail: 'cũ', createdAt: NOW };
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'tasks/t7'), task({ id: 't7', activity: { old: e1 }, lastActivityId: 'old' })));
    const db = as('an');
    const ref = doc(db, 'tasks/t7');
    await assertFails(updateDoc(ref, { activity: {}, updatedAt: NOW })); // xoá hết
    await assertFails(updateDoc(ref, { 'activity.old.detail': 'sửa', updatedAt: NOW })); // sửa mục cũ
    await assertFails(updateDoc(ref, { 'activity.x1': { ...e1, actorId: 'head1' }, lastActivityId: 'x1', updatedAt: NOW })); // mạo danh
    await assertFails(updateDoc(ref, { 'activity.x1': { ...e1, actorId: 'an' }, 'activity.x2': { ...e1, actorId: 'an' }, lastActivityId: 'x1', updatedAt: NOW })); // 2 mục
    await assertFails(updateDoc(ref, { 'activity.x1': { ...e1, actorId: 'an' }, lastActivityId: 'khac', updatedAt: NOW })); // lastActivityId lệch
    await assertSucceeds(updateDoc(ref, { 'activity.x1': { ...e1, actorId: 'an', detail: 'ok' }, lastActivityId: 'x1', updatedAt: NOW }));
  });
  it('không xoá cứng công việc, kể cả quản trị', async () => {
    await assertFails(deleteDoc(doc(as('admin'), 'tasks/t1')));
    await assertFails(deleteDoc(doc(as('an'), 'tasks/t1')));
  });
  it('trường lạ / sai kiểu bị từ chối', async () => {
    await assertFails(updateDoc(doc(as('an'), 'tasks/t1'), { checklist: 'x', updatedAt: NOW }));
    await assertFails(updateDoc(doc(as('an'), 'tasks/t1'), { description: 'x'.repeat(5001), updatedAt: NOW }));
  });
});

describe('bình luận', () => {
  const c = (uid: string, over = {}) => ({ authorId: uid, body: 'Đã nhận', mentions: [], createdAt: NOW, ...over });
  it('người liên quan bình luận và đọc được; người ngoài không', async () => {
    await assertSucceeds(addDoc(collection(as('an'), 'tasks/t1/comments'), c('an')));
    await assertSucceeds(getDocs(collection(as('head1'), 'tasks/t1/comments')));
    await assertFails(getDocs(collection(as('lan'), 'tasks/t1/comments')));
    await assertFails(addDoc(collection(as('lan'), 'tasks/t1/comments'), c('lan')));
  });
  it('không mạo danh tác giả; nội dung rỗng/quá dài bị từ chối; không sửa/xoá', async () => {
    const db = as('an');
    await assertFails(addDoc(collection(db, 'tasks/t1/comments'), c('head1')));
    await assertFails(addDoc(collection(db, 'tasks/t1/comments'), c('an', { body: '' })));
    await assertFails(addDoc(collection(db, 'tasks/t1/comments'), c('an', { body: 'x'.repeat(2001) })));
    const ref = await addDoc(collection(db, 'tasks/t1/comments'), c('an'));
    await assertFails(updateDoc(ref, { body: 'sửa' }));
    await assertFails(deleteDoc(ref));
  });
});

describe('thông báo', () => {
  const n = (from: string, over = {}) => ({ actorId: from, taskId: 't1', kind: 'assigned', text: 'Bạn được giao việc', createdAt: NOW, readAt: null, ...over });
  it('gửi thông báo cho người khác với actorId là chính mình', async () => {
    await assertSucceeds(addDoc(collection(as('head1'), 'users/an/notifications'), n('head1')));
    await assertFails(addDoc(collection(as('head1'), 'users/an/notifications'), n('dean')));
  });
  it('chỉ chủ thông báo đọc, đánh dấu đã đọc, xoá', async () => {
    const ref = await addDoc(collection(as('head1'), 'users/an/notifications'), n('head1'));
    await assertFails(getDoc(doc(as('lan'), `users/an/notifications/${ref.id}`)));
    await assertFails(getDocs(collection(as('lan'), 'users/an/notifications')));
    await assertSucceeds(getDocs(collection(as('an'), 'users/an/notifications')));
    await assertFails(updateDoc(doc(as('lan'), `users/an/notifications/${ref.id}`), { readAt: NOW }));
    await assertFails(updateDoc(doc(as('an'), `users/an/notifications/${ref.id}`), { text: 'sửa' }));
    await assertSucceeds(updateDoc(doc(as('an'), `users/an/notifications/${ref.id}`), { readAt: NOW }));
    await assertFails(deleteDoc(doc(as('lan'), `users/an/notifications/${ref.id}`)));
    await assertSucceeds(deleteDoc(doc(as('an'), `users/an/notifications/${ref.id}`)));
  });
  it('kind/độ dài không hợp lệ, chưa kích hoạt, chưa đăng nhập bị từ chối', async () => {
    await assertFails(addDoc(collection(as('head1'), 'users/an/notifications'), n('head1', { kind: 'spam' })));
    await assertFails(addDoc(collection(as('head1'), 'users/an/notifications'), n('head1', { text: 'x'.repeat(301) })));
    await assertFails(addDoc(collection(as('off'), 'users/an/notifications'), n('off')));
    await assertFails(addDoc(collection(anon(), 'users/an/notifications'), n('head1')));
  });
});

describe('giao hàng loạt quy mô lớn', () => {
  it('150 việc + 150 thông báo trong một batch nguyên tử (không vượt giới hạn truy cập Rules)', async () => {
    const db = as('dean');
    const b = writeBatch(db);
    for (let i = 0; i < 150; i++) {
      b.set(doc(db, `tasks/big${i}`), task({ id: `big${i}`, stateKey: 'todo', createdBy: 'dean', bulkId: 'bulkBig', createdAt: NOW, updatedAt: NOW, assigneeIds: ['an'], reviewerIds: [], participantIds: ['an'] }));
      b.set(doc(db, `users/an/notifications/${NOW}-${i}`), { actorId: 'dean', taskId: `big${i}`, kind: 'assigned', text: 'Bạn được giao việc', createdAt: NOW, readAt: null });
    }
    await assertSucceeds(b.commit());
  });
});

describe('bộ lọc đã lưu & đường dẫn chưa thiết kế quyền', () => {
  it('bộ lọc là của riêng từng người', async () => {
    await assertSucceeds(setDoc(doc(as('an'), 'savedViews/v1'), { ownerId: 'an', name: 'Của tôi', filters: {} }));
    await assertFails(getDoc(doc(as('lan'), 'savedViews/v1')));
    await assertFails(setDoc(doc(as('lan'), 'savedViews/v2'), { ownerId: 'an', name: 'x', filters: {} }));
  });
  it('đường dẫn không được thiết kế => từ chối, kể cả quản trị', async () => {
    await assertFails(getDoc(doc(as('admin'), 'bi_mat/x')));
    await assertFails(setDoc(doc(as('admin'), 'bi_mat/x'), { a: 1 }));
    await assertFails(getDoc(doc(as('admin'), 'admins/an')));
    await assertFails(getDocs(collection(as('admin'), 'admins')));
  });
  it('quản trị không tự thêm admin mới sau bootstrap', async () => {
    await assertFails(setDoc(doc(as('admin'), 'admins/an'), { createdAt: NOW }));
    await assertFails(setDoc(doc(as('an'), 'admins/an'), { createdAt: NOW }));
  });
});

describe('hardening sau kiểm toán bảo mật', () => {
  it('người có user.manage (không phải admin) không khoá được admin và không tự nâng quyền mình', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/um'), { name: 'UM', email: 'um@x.vn', active: true, unitId: 'khoa', assignments: [], scopes: { 'user.manage': ['*'] }, createdAt: NOW }));
    const db = as('um');
    await assertFails(updateDoc(doc(db, 'users/admin'), { active: false }));
    await assertFails(updateDoc(doc(db, 'users/um'), { scopes: { 'user.manage': ['*'], 'config.edit': ['*'] } }));
    await assertSucceeds(updateDoc(doc(db, 'users/an'), { unitId: 'bm2' }));
  });
  it('mọi lần đổi trạng thái phải để lại nhật ký', async () => {
    await assertFails(updateDoc(doc(as('an'), 'tasks/t1'), { stateKey: 'review', updatedAt: NOW }));
  });
  it('dấu thời gian sai định dạng bị từ chối', async () => {
    await assertFails(updateDoc(doc(as('an'), 'tasks/t1'), { checklist: [], updatedAt: 'aaaaaaaaaaaaaaaaaaaaaaa' }));
  });
  it('không tự đặt mình làm người duyệt việc tự tạo', async () => {
    const t = task({ id: 'self', stateKey: 'todo', assigneeIds: ['an'], reviewerIds: ['an'], participantIds: ['an'], createdBy: 'an', unitId: 'bm1', createdAt: NOW, updatedAt: NOW });
    await assertFails(setDoc(doc(as('an'), 'tasks/self'), t));
  });
});
