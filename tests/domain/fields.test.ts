import { describe, expect, it } from 'vitest';
import { normalizeCustomFields, preserveArchived, validateCustomFields } from '../../src/domain/fields';
import type { FieldDef } from '../../src/domain/types';

const f = (key: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label: key, type, required: false, options: [], order: 0, archived: false, ...extra });

describe('validateCustomFields', () => {
  it('trường bắt buộc thiếu giá trị', () => {
    expect(Object.keys(validateCustomFields([f('a', 'text', { required: true })], {}))).toEqual(['a']);
    expect(Object.keys(validateCustomFields([f('a', 'text', { required: true })], { a: '' }))).toEqual(['a']);
  });
  it('trường tùy chọn để trống là hợp lệ', () => {
    expect(validateCustomFields([f('a', 'number')], {})).toEqual({});
  });
  it('kiểu sai bị từ chối', () => {
    expect(validateCustomFields([f('a', 'number')], { a: 'x' }).a).toBeDefined();
    expect(validateCustomFields([f('a', 'number')], { a: NaN }).a).toBeDefined();
    expect(validateCustomFields([f('a', 'checkbox')], { a: 'true' }).a).toBeDefined();
    expect(validateCustomFields([f('a', 'date')], { a: '2026-02-30' }).a).toBeDefined();
    expect(validateCustomFields([f('a', 'date')], { a: '2026-02-28' })).toEqual({});
  });
  it('select/multiselect phải nằm trong danh sách', () => {
    const d = [f('s', 'select', { options: ['x', 'y'] }), f('m', 'multiselect', { options: ['x', 'y'] })];
    expect(validateCustomFields(d, { s: 'x', m: ['x', 'y'] })).toEqual({});
    expect(Object.keys(validateCustomFields(d, { s: 'z', m: ['x', 'q'] })).sort()).toEqual(['m', 's']);
  });
  it('url/file chỉ nhận http(s)', () => {
    expect(validateCustomFields([f('u', 'url')], { u: 'https://a.vn/x' })).toEqual({});
    expect(validateCustomFields([f('u', 'file')], { u: 'javascript:alert(1)' }).u).toBeDefined();
    expect(validateCustomFields([f('u', 'url')], { u: 'abc' }).u).toBeDefined();
  });
  it('giới hạn độ dài', () => {
    expect(validateCustomFields([f('t', 'text')], { t: 'a'.repeat(201) }).t).toBeDefined();
  });
  it('checkbox bắt buộc không coi false là thiếu', () => {
    expect(validateCustomFields([f('c', 'checkbox', { required: true })], { c: false })).toEqual({});
  });
  it('bỏ qua trường đã lưu trữ', () => {
    expect(validateCustomFields([f('a', 'text', { required: true, archived: true })], {})).toEqual({});
  });
});

describe('normalize / preserveArchived', () => {
  it('loại giá trị của trường lưu trữ và undefined', () => {
    const defs = [f('a', 'text'), f('b', 'text', { archived: true })];
    expect(normalizeCustomFields(defs, { a: 'x', b: 'y', zzz: 'q' })).toEqual({ a: 'x' });
  });
  it('không mất dữ liệu cũ của trường đã lưu trữ', () => {
    const defs = [f('a', 'text'), f('b', 'text', { archived: true })];
    expect(preserveArchived(defs, { a: '1', b: 'cũ' }, { a: '2' })).toEqual({ a: '2', b: 'cũ' });
  });
});
