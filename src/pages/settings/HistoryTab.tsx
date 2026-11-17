import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getServices } from '../../services/firebase/init';
import { AppError, classify } from '../../services/errors';
import { applyConfig } from '../../services/firebase/configRepo';
import { saveConfigItem } from '../../services/firebase/configRepo';
import { useData } from '../../state/data';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { currentConfig } from './common';
import { vnDate } from '../../domain/dates';

interface Version { id: string; entity: string; entityId: string; before: string | null; after: string; changedBy: string; createdAt: string; note: string }
const SECTIONS = ['units', 'roles', 'workflows', 'taskTypes', 'templates', 'terms'] as const;

export function HistoryTab() {
  const d = useData();
  const { profile } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Version[]>([]);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(getServices().db, 'configVersions'), orderBy('createdAt', 'desc'), limit(50)));
      setItems(s.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<Version, 'id'>) })));
    } catch (e) {
      setErr(classify(e).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function restore(v: Version) {
    if (!profile || v.before === null) return;
    if (!window.confirm('Khôi phục về phiên bản TRƯỚC thay đổi này?')) return;
    const before = JSON.parse(v.before);
    const r = await toast.run(async () => {
      if (v.entity === 'import') await applyConfig(currentConfig(d), before, profile.uid, `Khôi phục phiên bản ${v.createdAt.slice(0, 16)}`);
      else if ((SECTIONS as readonly string[]).includes(v.entity)) await saveConfigItem(v.entity as (typeof SECTIONS)[number], before, JSON.parse(v.after), profile.uid, 'Khôi phục');
      else throw new AppError('data', 'Loại thay đổi này chưa hỗ trợ khôi phục.');
      await load();
    }, 'Đã khôi phục.');
    void r;
  }

  return (
    <div className="card">
      <h3>Lịch sử phiên bản cấu hình</h3>
      {err && <div className="alert err" role="alert">{err}</div>}
      {items.length === 0 ? <div className="empty">Chưa có thay đổi nào.</div> : (
        <div className="scroll"><table className="tbl">
          <thead><tr><th scope="col">Thời điểm</th><th scope="col">Mục</th><th scope="col">Người sửa</th><th scope="col">Ghi chú</th><th scope="col" /></tr></thead>
          <tbody>{items.map((v) => (
            <tr key={v.id}><td className="nw">{vnDate(v.createdAt.slice(0, 10))} {v.createdAt.slice(11, 16)}</td><td>{v.entity} / {v.entityId}</td><td>{d.userName(v.changedBy)}</td><td>{v.note}</td>
              <td>{v.before !== null && <button className="btn sm" onClick={() => void restore(v)}>Khôi phục bản trước</button>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
