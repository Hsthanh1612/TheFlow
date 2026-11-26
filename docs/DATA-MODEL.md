# Mô hình dữ liệu Firestore
| Đường dẫn | Nội dung | Ghi bởi |
|---|---|---|
| `users/{uid}` | name, email, active, unitId, assignments[{roleKey,unitId}], scopes{perm:[unitId\|'*']}, createdAt, theme (tuỳ chọn: ngoc\|tim\|troi\|sen), mode (tuỳ chọn: light\|dark\|auto) | tự tạo (inactive); `user.manage`/admin sửa quyền; tự sửa `name`, `theme`, `mode` (Rules chỉ nhận giá trị hợp lệ, không kèm trường khác) |
| `users/{uid}/notifications/{id}` | actorId, taskId, kind, text, createdAt, readAt | người dùng active tạo (actorId=mình); chủ đọc/đánh dấu/xoá |
| `admins/{uid}`, `meta/bootstrap` | quản trị viên đầu tiên (một lần) | batch bootstrap |
| `units`, `roles`, `taskTypes`, `workflows`, `templates`, `terms`, `settings/app` | cấu hình động | `config.edit` (không xoá, chỉ `archived`) |
| `configVersions/{id}` | entity, entityId, before, after (JSON), changedBy, createdAt, note | `config.edit`, chỉ thêm |
| `tasks/{id}` | typeId, workflowId, title, description, stateKey, priority, labels, startAt, dueAt, unitId, assigneeIds, collaboratorIds, reviewerIds, participantIds, checklist[], links[], customFields{}, activity{id→{actorId,action,detail,createdAt}}, lastActivityId, statusNote, statusNoteAt, templateId, bulkId, createdBy, createdAt, updatedAt, completedAt | theo Rules |
| `tasks/{id}/comments/{cid}` | authorId, body, mentions, createdAt | người xem được việc; chỉ thêm |
| `savedViews/{id}` | ownerId, name, view, filters | chủ |
| `timeEntries/{id}` | taskId, userId, unitId (sao chép từ việc), day, minutes (1–1440), note, source (timer\|manual), createdAt | chủ ghi cho việc mình xem được; bất biến, chủ xoá được; đọc: chủ hoặc người có `task.view_all` ở đơn vị |
| `users/{uid}/timer/current` | taskId, title, startedAt | chủ (đồng hồ đang chạy, tối đa một) |
| `goals/{id}` | name, description, unitId, ownerId, termId, dueDate, status, keyResults[≤10], taskIds[≤200], createdBy, createdAt, updatedAt | `task.assign` ở đơn vị; không xoá (status=archived); mọi người dùng active đọc |
| `automations/{id}` | name, enabled, trigger{kind,typeId,toCategory,days}, action{kind:'notify',to[],text}, createdBy, createdAt, updatedAt | `config.edit` toàn Khoa; có thể xoá |
| `snapshots/{yyyy-mm-dd}` | week, total{todo,doing,review,done,late}, byUnit{unitId→…}, takenBy, createdAt | người xem được toàn Khoa, tạo một lần/tuần (create-only); đọc: người có quyền quản lý |

`workflows` có trường dẫn xuất `allowed`, `needsComment`, `doneStates` (sinh bởi `withDerived`, Rules phụ thuộc). Giới hạn: ≤50 checklist, ≤20 liên kết, ≤1000 mục nhật ký, 150 việc/lần giao. **Truy vấn** (đều đơn trường, không composite index): `participantIds array-contains`, `createdBy ==`, `unitId in [≤30]`, toàn collection (chỉ khi có `task.view_all` toàn Khoa), `orderBy createdAt` (comments, configVersions), `orderBy __name__` (notifications). **Quota:** mỗi phiên đọc cấu hình + người dùng + việc trong phạm vi; Trưởng khoa đọc toàn bộ việc (giới hạn 3000). Rules `get()` cũng tính lượt đọc.
