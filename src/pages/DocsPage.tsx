import { PageHead } from '../components/ui';

export function DocsPage() {
  return (
    <div className="screen">
      <PageHead title="Tài liệu" sub="Kho văn bản và biểu mẫu của Khoa." />
      <div className="card col">
        <div className="alert info">Kho tài liệu chưa có trong phiên bản này.</div>
        <p>Lưu tệp trực tiếp trên hệ thống cần Firebase Storage, hiện chỉ dùng được khi nâng cấp gói Blaze có tính phí — ràng buộc của dự án là chỉ dùng gói Spark miễn phí. Vì vậy:</p>
        <ul>
          <li>Trong từng công việc, phần <strong>Tệp đính kèm</strong> lưu <strong>liên kết</strong> (Google Drive, OneDrive, SharePoint…) thay vì tệp.</li>
          <li>Trường dữ liệu kiểu “Tệp” cũng nhận liên kết http(s).</li>
        </ul>
        <p className="note">Xem docs/REQUIREMENTS.md, mục “Giới hạn do gói Spark”.</p>
      </div>
    </div>
  );
}
