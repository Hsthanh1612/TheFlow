# Kiểm kê Agent Skills
Thư mục: `~/.claude/skills` (Claude Code). Cài bằng `npx skills@latest add … -g -a claude-code`.
| Nguồn | Trạng thái | Ghi chú |
|---|---|---|
| mattpocock/skills | Đã cài đủ nhóm engineering/misc/productivity (31 skill) | 8 skill nhóm `in-progress` không cài (chưa ổn định) |
| cloudflare/security-audit-skill | Đã cài (`security-audit`) | |
| obra/superpowers | Đã cài đủ 15 skill | Không cài trùng plugin |
| vercel-labs/agent-skills | Đã cài đủ 9 (thêm `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize` trong phiên này) | 3 skill Vercel + skill React/Next riêng **không áp dụng** (app dùng Vite, không chuyển sang Vercel) |
| firebase/agent-skills (`firebase/skills` đã chuyển) | Đã cài đủ 14 (thêm `firebase-hosting-basics`, `firebase-app-hosting-basics`, `xcode-project-setup` trong phiên này) | Hosting/App Hosting/Xcode **không dùng** (cấm / không áp dụng) |
| Seokwoooo/lucian-uxui | Đã cài | **Chưa dùng**: giao diện bám sát mockup có sẵn |

**Đã thực sự sử dụng:** `security-audit` (qua subagent, phạm vi giới hạn, phát hiện được sửa) và `web-design-guidelines` (qua subagent; chỉ lấy được bản tóm tắt quy tắc, chưa chạy trình duyệt). **Đã cài nhưng chưa dùng:** các skill còn lại (kể cả `firebase-*`, `tdd`, `brainstorming`…) — quy trình thực tế là tự viết test-trước/sau theo Master prompt, không gọi các skill đó. Quy ước `setup-matt-pocock-skills` chưa chạy (không có issue tracker).
