import { describe, expect, it } from 'vitest';
import { REMINDER_MAX, reminderText } from '../../src/services/firebase/taskRepo';

describe('reminderText', () => {
  it('gồm tên người nhắc, tên việc và lời nhắn', () => {
    expect(reminderText('Hoàng Dũng', 'Báo cáo học kỳ 1', ' Nộp bản nháp trước thứ Sáu ')).toBe('Hoàng Dũng nhắc bạn “Báo cáo học kỳ 1”: Nộp bản nháp trước thứ Sáu');
  });
  it('cắt tiêu đề dài và không bao giờ vượt 300 ký tự (giới hạn của Firestore Rules)', () => {
    const t = reminderText('A'.repeat(100), 'T'.repeat(200), 'x'.repeat(500));
    expect(t.length).toBeLessThanOrEqual(300);
    expect(t).toContain('…');
    expect(REMINDER_MAX).toBe(200);
  });
});
