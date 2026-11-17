import { useMemo, useState } from 'react';
import { Field } from '../../components/ui';
import { useData } from '../../state/data';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { AppError } from '../../services/errors';
import { currentConfig } from './common';
import { applyConfig } from '../../services/firebase/configRepo';
import { diffConfig, validateConfig, type KhoaConfig } from '../../domain/config';

const SECTION_LABEL: Record<string, string> = { units: 'Đơn vị', roles: 'Vai trò', workflows: 'Quy trình', taskTypes: 'Loại việc', templates: 'Mẫu việc', terms: 'Học kỳ', settings: 'Thiết lập' };
const KIND_LABEL = { add: 'Thêm', update: 'Sửa', remove: 'Lưu trữ' } as const;

export function buildPrompt(request: string, cfg: KhoaConfig): string {
  return `Bạn là trợ lý cấu hình cho ứng dụng quản lý công việc của một Khoa đại học.
Nhiệm vụ: sửa CẤU HÌNH JSON hiện tại theo yêu cầu của người dùng, rồi trả về TOÀN BỘ cấu hình mới.
Quy tắc: chỉ trả về một khối JSON hợp lệ (không giải thích); giữ nguyên mọi mục không liên quan; khoá (id/key) chỉ gồm a-z, 0-9, _;
không xoá mục — muốn bỏ thì đặt "archived": true; mỗi loại việc phải trỏ tới workflowId có thật; mỗi workflow cần ít nhất 1 trạng thái category "done";
transitions[].allowed chỉ nhận: assignee, collaborator, reviewer, creator, approver, approver_all, assigner; field.type nhận: text, longtext, number, date, select, multiselect, user, file, url, checkbox;
permissions nhận: task.view_all, task.assign, task.bulk_assign, task.approve, task.reassign, task.extend, manage.view, report.export, config.edit, user.manage.
Không thêm trường "allowed"/"needsComment"/"doneStates" cho workflow (hệ thống tự tính).

YÊU CẦU CỦA NGƯỜI DÙNG:
${request.trim() || '(chưa nhập)'}

CẤU HÌNH HIỆN TẠI:
${JSON.stringify(stripDerived(cfg), null, 2)}`;
}

function stripDerived(cfg: KhoaConfig) {
  return { ...cfg, workflows: cfg.workflows.map(({ allowed: _a, needsComment: _n, doneStates: _d, ...w }) => w) };
}

/**
 * "Nhờ AI chỉnh cấu hình" — AI chỉ ĐỀ XUẤT; người dùng xem diff rồi mới áp dụng; AI không bao giờ tự lưu (BRIEF mục 7).
 * Tích hợp gọi API LLM trực tiếp bị chặn: cần khoá API trả phí và nơi giữ khoá an toàn (backend) — vi phạm ràng buộc Spark.
 * Thay vào đó: tạo lời nhắc → dán vào trợ lý AI bất kỳ → dán JSON trả về vào đây để kiểm tra chặt + xem trước + áp dụng.
 */
export function AiTab() {
  const d = useData();
  const { profile } = useAuth();
  const toast = useToast();
  const cur = useMemo(() => currentConfig(d), [d]);
  const [req, setReq] = useState('');
  const [json, setJson] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    if (!json.trim()) return null;
    try {
      return validateConfig(JSON.parse(json));
    } catch {
      return { ok: false as const, errors: ['Không đọc được JSON. Hãy dán đúng khối JSON AI trả về.'] };
    }
  }, [json]);
  const changes = parsed?.ok ? diffConfig(cur, parsed.config) : [];

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildPrompt(req, cur));
      toast.ok('Đã sao chép lời nhắc. Hãy dán vào trợ lý AI.');
    } catch {
      toast.fail(new AppError('data', 'Không sao chép được. Hãy chọn và sao chép nội dung ở khung bên dưới.'));
    }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(stripDerived(cur), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'khoa.config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 1_000_000) return toast.fail(new AppError('data', 'Tệp quá lớn (tối đa 1 MB).'));
    setJson(await f.text());
  }
  async function apply() {
    if (!parsed?.ok || !profile) return;
    setBusy(true);
    const r = await toast.run(() => applyConfig(cur, parsed.config, profile.uid, note || 'Áp dụng cấu hình'), 'Đã áp dụng cấu hình. Lịch sử phiên bản đã được ghi.');
    setBusy(false);
    if (r.ok) setJson('');
  }

  return (
    <div className="col">
      <div className="ai">
        <strong>Nhờ AI chỉnh cấu hình</strong>
        <div className="alert warn">Ứng dụng không gọi AI trực tiếp (cần khoá API trả phí và máy chủ giữ khoá — ngoài phạm vi gói Spark). Cách dùng: ① tạo lời nhắc ② dán vào trợ lý AI ③ dán JSON nhận lại ở bước 3. AI chỉ đề xuất; bạn xem thay đổi rồi mới áp dụng.</div>
        <Field label="① Mô tả bằng lời điều bạn muốn thay đổi" htmlFor="ai-req"><textarea id="ai-req" className="inp" value={req} onChange={(e) => setReq(e.target.value)} placeholder="Ví dụ: Thêm loại việc “Kiểm định chương trình” có trường Mã chương trình, hạn nộp, và cần Trưởng khoa duyệt." /></Field>
        <div className="row"><button className="btn pri" onClick={() => void copyPrompt()}>② Sao chép lời nhắc cho AI</button><button className="btn" onClick={exportJson}>Xuất cấu hình hiện tại (JSON)</button></div>
        <details><summary className="note">Xem lời nhắc</summary><div className="pre">{buildPrompt(req, cur)}</div></details>
      </div>
      <div className="card col">
        <h3>③ Dán JSON cấu hình đề xuất (hoặc nhập từ tệp)</h3>
        <input type="file" accept="application/json,.json" aria-label="Nhập cấu hình từ tệp" onChange={(e) => void importFile(e.target.files?.[0])} />
        <textarea className="inp" aria-label="JSON cấu hình đề xuất" style={{ height: 160, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 }} value={json} onChange={(e) => setJson(e.target.value)} />
        {parsed && !parsed.ok && <div className="alert err" role="alert">{parsed.errors.slice(0, 8).map((e, i) => <div key={i}>{e}</div>)}</div>}
        {parsed?.ok && (
          <>
            <h3 style={{ margin: 0 }}>Xem trước thay đổi ({changes.length})</h3>
            {changes.length === 0 ? <div className="note">Cấu hình đề xuất giống hệt cấu hình hiện tại.</div> : (
              <table className="tbl" style={{ minWidth: 0 }}><thead><tr><th scope="col">Mục</th><th scope="col">Thay đổi</th><th scope="col">Chi tiết</th></tr></thead>
                <tbody>{changes.map((c, i) => <tr key={i}><td>{SECTION_LABEL[c.section]}</td><td><span className={`b ${c.kind === 'add' ? 'done' : c.kind === 'remove' ? 'late' : 'doing'}`}>{KIND_LABEL[c.kind]}</span></td><td>{c.label}</td></tr>)}</tbody></table>
            )}
            <Field label="Ghi chú cho lịch sử (tuỳ chọn)" htmlFor="ai-note"><input id="ai-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></Field>
            <div className="row"><button className="btn pri" disabled={busy || changes.length === 0} onClick={() => void apply()}>{busy ? 'Đang áp dụng…' : 'Áp dụng thay đổi'}</button><span className="note">Mục bị bỏ khỏi cấu hình sẽ được lưu trữ, không xoá dữ liệu cũ.</span></div>
          </>
        )}
      </div>
    </div>
  );
}
