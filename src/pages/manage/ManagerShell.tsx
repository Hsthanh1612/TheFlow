import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Loading } from '../../components/ui';
import { useAuth } from '../../state/auth';
import { useData } from '../../state/data';
import { descendantIds, hasAnyScope, scopeUnits } from '../../domain/permissions';
import { lastWeeksPeriod, type Period } from '../../domain/stats';
import type { OrgUnit, Task } from '../../domain/types';

interface Scope {
  unitId: string;
  unitIds: Set<string>;
  unit: OrgUnit | undefined;
  period: Period;
  periodLabel: string;
  tasks: Task[]; // việc thuộc đơn vị đang chọn (và đơn vị con)
  childUnits: OrgUnit[]; // các đơn vị con trực tiếp (hoặc chính đơn vị nếu không có con)
}

const Ctx = createContext<Scope | null>(null);
export const useScope = (): Scope => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useScope ngoài ManagerShell');
  return c;
};

/** Khung chung cho màn Quản lý: bộ chọn Đơn vị + Kỳ. Phạm vi đơn vị bị giới hạn theo quyền (Rules cũng chặn ở máy chủ). */
export function ManagerShell({ children }: { children: ReactNode }) {
  const { principal } = useAuth();
  const d = useData();
  const allowed = scopeUnits(principal, 'manage.view');
  const options = useMemo(() => {
    const live = d.units.filter((u) => !u.archived);
    const list = allowed === '*' ? live : live.filter((u) => allowed.includes(u.id));
    // đơn vị gốc (Toàn Khoa) đứng đầu, sau đó theo tên
    return [...list].sort((a, b) => Number(b.parentId === null) - Number(a.parentId === null) || a.name.localeCompare(b.name, 'vi'));
  }, [d.units, allowed]);
  const [unitId, setUnitId] = useState('');
  const [periodKey, setPeriodKey] = useState('w8');

  const periods = useMemo(() => [
    ...d.terms.map((t) => ({ key: `t:${t.id}`, label: t.name, period: { start: t.startDate, end: t.endDate } })),
    { key: 'w4', label: '4 tuần gần nhất', period: lastWeeksPeriod(d.today, 4) },
    { key: 'w8', label: '8 tuần gần nhất', period: lastWeeksPeriod(d.today, 8) },
    { key: 'w12', label: '12 tuần gần nhất', period: lastWeeksPeriod(d.today, 12) },
  ], [d.terms, d.today]);

  const effUnit = options.find((u) => u.id === unitId)?.id ?? options[0]?.id ?? '';
  const per = periods.find((p) => p.key === periodKey) ?? periods[periods.length - 2];
  const scope = useMemo<Scope | null>(() => {
    if (!effUnit) return null;
    const ids = new Set(descendantIds(d.units, effUnit));
    const kids = d.units.filter((u) => u.parentId === effUnit && !u.archived);
    return {
      unitId: effUnit, unitIds: ids, unit: d.units.find((u) => u.id === effUnit), period: per.period, periodLabel: per.label,
      tasks: d.tasks.filter((t) => ids.has(t.unitId)), childUnits: kids.length > 0 ? kids : d.units.filter((u) => u.id === effUnit),
    };
  }, [effUnit, d.units, d.tasks, per]);

  if (!d.ready) return <Loading />;
  if (!hasAnyScope(principal, 'manage.view') || !scope) return <div className="card"><div className="empty">Bạn không có quyền xem khu vực Quản lý.</div></div>;

  return (
    <Ctx.Provider value={scope}>
      <div className="scope" role="group" aria-label="Phạm vi xem">
        <span className="mgr">Chế độ quản lý</span>
        <label>Đơn vị
          <select className="sel" value={effUnit} onChange={(e) => setUnitId(e.target.value)} disabled={options.length <= 1}>
            {options.map((u) => <option key={u.id} value={u.id}>{u.parentId === null ? 'Toàn Khoa' : u.name}</option>)}
          </select>
        </label>
        <label>Kỳ
          <select className="sel" value={per.key} onChange={(e) => setPeriodKey(e.target.value)}>{periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
        </label>
      </div>
      {children}
    </Ctx.Provider>
  );
}
