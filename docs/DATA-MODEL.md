# Mô hình dữ liệu Firestore
| Đường dẫn | Nội dung | Ghi bởi |
|---|---|---|
| `users/{uid}` | name, email, active, unitId, assignments[{roleKey,unitId}], scopes{perm:[unitId\|'*']}, createdAt | tự tạo (inactive); `user.manage`/admin sửa quyền; tự sửa `name` |
| `users/{uid}/notifications/{id}` | actorId, taskId, kind, text, createdAt, readAt | người dùng active tạo (actorId=mình); chủ đọc/đánh dấu/xoá |
| `admins/{uid}`, `meta/bootstrap` | quản trị viên đầu tiên (một lần) | batch bootstrap |
| `units`, `roles`, `taskTypes`, `workflows`, `templates`, `terms`, `settings/app` | cấu hình động | `config.edit` (không xoá, chỉ `archived`) |
| `configVersions/{id}` | entity, entityId, before, after (JSON), changedBy, createdAt, note | `config.edit`, chỉ thêm |
| `tasks/{id}` | typeId, workflowId, title, description, stateKey, priority, labels, startAt, dueAt, unitId, assigneeIds, collaboratorIds, reviewerIds, participantIds, checklist[], links[], customFields{}, activity{id→{actorId,action,detail,createdAt}}, lastActivityId, statusNote, statusNoteAt, templateId, bulkId, createdBy, createdAt, updatedAt, completedAt | theo Rules |
| `tasks/{id}/comments/{cid}` | authorId, body, mentions, createdAt | người xem được việc; chỉ thêm |
| `savedViews/{id}` | ownerId, name, view, filters | chủ |

`workflows` có trường dẫn xuất `allowed`, `needsComment`, `doneStates` (sinh bởi `withDerived`, Rules phụ thuộc). Giới hạn: ≤50 checklist, ≤20 liên kết, ≤1000 mục nhật ký, 150 việc/lần giao. **Truy vấn** (đều đơn trường, không composite index): `participantIds array-contains`, `createdBy ==`, `unitId in [≤30]`, toàn collection (chỉ khi có `task.view_all` toàn Khoa), `orderBy createdAt` (comments, configVersions), `orderBy __name__` (notifications). **Quota:** mỗi phiên đọc cấu hình + người dùng + việc trong phạm vi; Trưởng khoa đọc toàn bộ việc (giới hạn 3000). Rules `get()` cũng tính lượt đọc.
