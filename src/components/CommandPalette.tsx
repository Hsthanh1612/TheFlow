import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ui';
import { useData } from '../state/data';
import { useAuth } from '../state/auth';
import { useTaskForm } from './TaskForm';
import { hasAnyScope, hasPerm } from '../domain/permissions';
import { fold, rank, scoreMatch } from '../domain/search';

interface Item { key: string; group: 'Việc' | 'Đi tới' | 'Thao tác'; label: string; hint?: string; icon: string; run: () => void }

/** Bảng tìm kiếm nhanh (Cmd/Ctrl+K): tìm việc theo tiêu đề, nhãn, loại, người phụ trách, đơn vị; đi tới trang; tạo việc. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const form = useTaskForm();
  const { principal } = useAuth();
  const { tasks, userName, typeById, unitById, stateLabel } = useData();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pages = useMemo(() => {
    const go = (to: string) => () => { nav(to); onClose(); };
    const list: { label: string; to: string; icon: string }[] = [
      { label: 'Việc của tôi', to: '/', icon: 'home' },
      { label: 'Bảng Kanban', to: '/tasks/kanban', icon: 'kanban' },
      { label: 'Danh sách việc', to: '/tasks/list', icon: 'list' },
      { label: 'Lịch Khoa', to: '/tasks/calendar', icon: 'calendar' },
      { label: 'Timeline', to: '/tasks/timeline', icon: 'timeline' },
      { label: 'Tài liệu', to: '/docs', icon: 'doc' },
      { label: 'Hồ sơ cá nhân', to: '/profile', icon: 'users' },
    ];
    if (hasPerm(principal, 'config.edit', null) || hasPerm(principal, 'user.manage', null)) list.push({ label: 'Cấu hình', to: '/settings', icon: 'settings' });
    if (hasAnyScope(principal, 'manage.view')) list.push({ label: 'Tổng quan quản lý', to: '/manage/overview', icon: 'chart' }, { label: 'Chờ duyệt', to: '/manage/approvals', icon: 'inbox' }, { label: 'Cảnh báo quá hạn', to: '/manage/risks', icon: 'warn' }, { label: 'Tiến độ đơn vị', to: '/manage/units', icon: 'users' });
    if (hasAnyScope(principal, 'task.bulk_assign')) list.push({ label: 'Giao công việc', to: '/manage/assign', icon: 'users' });
    if (hasAnyScope(principal, 'report.export')) list.push({ label: 'Báo cáo & xuất file', to: '/manage/reports', icon: 'doc' });
    return list.map((p): Item => ({ key: `p:${p.to}`, group: 'Đi tới', label: p.label, icon: p.icon, run: go(p.to) }));
  }, [nav, onClose, principal]);

  const items = useMemo<Item[]>(() => {
    const create: Item = { key: 'a:create', group: 'Thao tác', label: 'Tạo việc mới', icon: 'plus', run: () => { onClose(); form.open(); } };
    const toItem = (t: (typeof tasks)[number]): Item => ({
      key: `t:${t.id}`, group: 'Việc', label: t.title, icon: 'check',
      hint: [typeById(t.typeId)?.name, stateLabel(t), t.assigneeIds.map(userName).slice(0, 2).join(', ')].filter(Boolean).join(' · '),
      run: () => { nav(`/task/${t.id}`); onClose(); },
    });
    if (fold(q) === '') {
      const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map(toItem);
      return [create, ...recent, ...pages.slice(0, 6)];
    }
    const docs = tasks.map((t) => ({ id: t.id, title: t.title, extra: [typeById(t.typeId)?.name ?? '', unitById(t.unitId)?.name ?? '', ...t.labels, ...t.assigneeIds.map(userName)], t }));
    const found = rank(q, docs, 8).map((d) => toItem(d.t));
    const matchedPages = pages.filter((p) => scoreMatch(q, { id: p.key, title: p.label, extra: [] }) > 0);
    const matchedCreate = scoreMatch(q, { id: 'c', title: 'Tạo việc mới', extra: ['thêm giao việc'] }) > 0 ? [create] : [];
    return [...found, ...matchedPages, ...matchedCreate];
  }, [q, tasks, pages, typeById, unitById, userName, stateLabel, nav, onClose, form]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (items.length ? (i + 1) % items.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') e.preventDefault(); // giữ tiêu điểm trong ô tìm kiếm; dùng mũi tên để chọn
  }

  let lastGroup = '';
  return (
    <div className="cmdk-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Tìm kiếm nhanh">
        <div className="cmdk-in">
          <Icon name="search" size={18} />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Tìm việc, người phụ trách, nhãn… hoặc gõ tên trang" aria-label="Tìm kiếm nhanh"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[active] ? `cmdk-${active}` : undefined} autoComplete="off" spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" aria-label="Kết quả" ref={listRef}>
          {items.length === 0 && <div className="empty">Không tìm thấy kết quả cho “{q.trim()}”.</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {head && <div className="cmdk-grp" role="presentation">{it.group === 'Việc' && fold(q) === '' ? 'Việc gần đây' : it.group}</div>}
                <div id={`cmdk-${i}`} role="option" aria-selected={i === active} className={`cmdk-it${i === active ? ' on' : ''}`} onMouseMove={() => setActive(i)} onClick={() => it.run()}>
                  <Icon name={it.icon} size={16} />
                  <span className="cmdk-t">{it.label}</span>
                  {it.hint && <span className="cmdk-h">{it.hint}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmdk-ft"><span><kbd>↑</kbd><kbd>↓</kbd> chọn</span><span><kbd>Enter</kbd> mở</span><span><kbd>Esc</kbd> đóng</span></div>
      </div>
    </div>
  );
}
