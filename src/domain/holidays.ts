// Ngày lễ / sự kiện cố định theo DƯƠNG lịch (mockup có "Ngày Nhà giáo VN" 20/11).
// Các ngày theo ÂM lịch (Tết Nguyên đán, Giỗ Tổ Hùng Vương) chưa được hỗ trợ — xem docs/REQUIREMENTS.md (mục chưa xác định).
export const FIXED_HOLIDAYS: { md: string; name: string }[] = [
  { md: '01-01', name: 'Tết Dương lịch' },
  { md: '04-30', name: 'Ngày Giải phóng miền Nam' },
  { md: '05-01', name: 'Ngày Quốc tế Lao động' },
  { md: '09-02', name: 'Quốc khánh' },
  { md: '11-20', name: 'Ngày Nhà giáo VN' },
];

export function holidayOn(day: string): string | null {
  return FIXED_HOLIDAYS.find((h) => h.md === day.slice(5))?.name ?? null;
}
