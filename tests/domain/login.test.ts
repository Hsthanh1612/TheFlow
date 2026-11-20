import { describe, expect, it } from 'vitest';
import { toLoginEmail } from '../../src/domain/login';

describe('toLoginEmail', () => {
  it('giữ nguyên email, chuẩn hoá chữ thường và khoảng trắng', () => {
    expect(toLoginEmail('  An@Gmail.com ', 'khoa.test')).toEqual({ ok: true, email: 'an@gmail.com', isUsername: false });
  });
  it('quy tài khoản (không có @) về email nội bộ', () => {
    expect(toLoginEmail('test_case', 'khoa.test')).toEqual({ ok: true, email: 'test_case@khoa.test', isUsername: true });
    expect(toLoginEmail('Test_Case', 'khoa.test')).toMatchObject({ email: 'test_case@khoa.test' });
  });
  it('từ chối rỗng, email sai và tài khoản sai định dạng', () => {
    for (const bad of ['', '   ', 'a@b', '@x.com', 'ab', 'tên có dấu', 'a b c', '-abc', 'x'.repeat(31)]) expect(toLoginEmail(bad, 'khoa.test').ok, bad).toBe(false);
  });
});
