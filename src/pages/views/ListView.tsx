import { useMemo, useState } from 'react';
import { AssigneeAvatars, DueText, ProgressCell, TaskLinkTitle, TaskStatus, TypeTag, useTaskView } from '../../components/taskBits';
import type { Task } from '../../domain/types';
import { sortByDue } from '../../domain/filters';

type ColKey = 'type' | 'unit' | 'assignee' | 'due' | 'status' | 'progress' | `f:${string}`;
const BASE: { key: ColKey; label: string }[] = [
  { key: 'type', label: 'Loại' }, { key: 'unit', label: 'Đơn vị' }, { key: 'assignee', label: 'Phụ trách' },
  { key: 'due', label: 'Hạn' }, { key: 'status', label: 'Trạng thái' }, { key: 'progress', label: 'Tiến độ' },
];
const STORE = 'khoa.list.columns';

function loadCols(): ColKey[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    if (Array.isArray(v)) return v as ColKey[];
  } catch {
    // localStorage không khả dụng (chế độ riêng tư...) => dùng mặc định
  }
  return ['type', 'assignee', 'due', 'status', 'progress'];
}

export function ListView({ tasks, typeId }: { tasks: Task[]; typeId: string }) {
  const v = useTaskView();
  const [cols, setCols] = useState<ColKey[]>(loadCols);
  const [sort, setSort] = useState<{ key: 'title' | 'due'; dir: 1 | -1 }>({ key: 'due', dir: 1 });
  const dyn = useMemo(() => (typeId ? (v.typeById(typeId)?.fields ?? []).filter((f) => !f.archived) : []), [typeId, v]);
  const all = [...BASE, ...dyn.map((f) => ({ key: `f:${f.key}` as ColKey, label: f.label }))];
  const shown = all.filter((c) => cols.includes(c.key));
  const rows = useMemo(() => {
    const r = sort.key === 'due' ? sortByDue(tasks) : [...tasks].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    return sort.dir === 1 ? r : r.reverse();
  }, [tasks, sort]);

  function toggle(k: ColKey) {
    const next = cols.includes(k) ? cols.filter((c) => c !== k) : [...cols, k];
    setCols(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // không lưu được tuỳ chọn cột: bỏ qua, giao diện vẫn đúng
    }
  }

  const cell = (t: Task, k: ColKey) => {
    switch (k) {
      case 'type': return <TypeTag typeId={t.typeId} />;
      case 'unit': return v.unitById(t.unitId)?.name ?? '—';
      case 'assignee': return <AssigneeAvatars t={t} />;
      case 'due': return <span className="nw"><DueText t={t} /></span>;
      case 'status': return <TaskStatus t={t} />;
      case 'progress': return <ProgressCell t={t} />;
      default: {
        const val = t.customFields[k.slice(2)];
        return Array.isArray(val) ? val.join(', ') : val === null || val === undefined ? '—' : typeof val === 'boolean' ? (val ? 'Có' : 'Không') : String(val);
      }
    }
  };

  return (
    <div className="card">
      <details style={{ marginBottom: 12 }}>
        <summary className="note" style={{ cursor: 'pointer' }}>Chọn cột hiển thị{dyn.length > 0 ? ' (gồm trường theo loại việc)' : ''}</summary>
        <div className="row" style={{ marginTop: 8 }}>
          {all.map((c) => (
            <label key={c.key} className="row" style={{ gap: 4 }}><input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggle(c.key)} />{c.label}</label>
          ))}
        </div>
      </details>
      {rows.length === 0 ? <div className="empty">Không có việc nào khớp bộ lọc.</div> : (
        <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" aria-sort={sort.key === 'title' ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button className="linkbtn" style={{ color: 'inherit', fontWeight: 600 }} onClick={() => setSort({ key: 'title', dir: sort.key === 'title' && sort.dir === 1 ? -1 : 1 })}>Công việc</button>
                </th>
                {shown.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.key === 'due' && sort.key === 'due' ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    {c.key === 'due' ? <button className="linkbtn" style={{ color: 'inherit', fontWeight: 600 }} onClick={() => setSort({ key: 'due', dir: sort.key === 'due' && sort.dir === 1 ? -1 : 1 })}>{c.label}</button> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><TaskLinkTitle t={t} /></td>
                  {shown.map((c) => <td key={c.key}>{cell(t, c.key)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
