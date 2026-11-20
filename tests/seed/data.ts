// Dữ liệu tài khoản mẫu (không import mã của app để chạy được trong Node).
export const PASSWORD = '123123';
export const ADMIN = { name: 'Test Case', email: 'test_case@khoa.test' };
export interface Member { name: string; email: string; role: string; unit: string }
export const MEMBERS: Member[] = [
  { name: 'Nguyễn Văn An', email: 'an@khoa.test', role: 'truong_bo_mon', unit: 'cnpm' },
  { name: 'Trần Thị Bích', email: 'bich@khoa.test', role: 'truong_bo_mon', unit: 'httt' },
  { name: 'Đặng Quốc Huy', email: 'huy@khoa.test', role: 'truong_bo_mon', unit: 'khdl' },
  { name: 'Phan Văn Nam', email: 'nam@khoa.test', role: 'truong_bo_mon', unit: 'mmt' },
  { name: 'Lê Quang Cường', email: 'cuong@khoa.test', role: 'giang_vien', unit: 'cnpm' },
  { name: 'Phạm Thu Dung', email: 'dung@khoa.test', role: 'giang_vien', unit: 'cnpm' },
  { name: 'Hoàng Minh Đức', email: 'duc@khoa.test', role: 'giang_vien', unit: 'httt' },
  { name: 'Vũ Ngọc Hà', email: 'ha@khoa.test', role: 'giang_vien', unit: 'khdl' },
  { name: 'Ngô Thị Lan', email: 'lan@khoa.test', role: 'giang_vien', unit: 'mmt' },
  { name: 'Bùi Thanh Mai', email: 'mai@khoa.test', role: 'giao_vu', unit: 'khoa' },
];
