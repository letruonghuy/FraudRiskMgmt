import { useEffect, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const CASE_STATUS_CONFIG = {
  Open: { label: 'Mở', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  Investigating: { label: 'Đang điều tra', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  PendingApproval: { label: 'Chờ duyệt', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Approved: { label: 'Đã phê duyệt', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  Rework: { label: 'Cần làm lại', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  FalsePositive: { label: 'Báo động giả', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  Closed: { label: 'Đã đóng', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
};

const StatusBadge = ({ status }) => {
  const cfg = CASE_STATUS_CONFIG[status] || {
    label: status || 'Không xác định',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.3)',
  };

  return (
    <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
};

export default function CaseListPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 10, totalCount: 0 });

  useEffect(() => {
    let isActive = true;

    const fetchCases = async () => {
      try {
        setLoading(true);

        const response = await axiosClient.get('/Case', {
          params: {
            page,
            pageSize: 10,
            status: statusFilter || undefined,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        });

        if (!isActive) return;

        const payload = response.data || {};
        const items = Array.isArray(payload.items) ? payload.items : [];

        setCases(items);
        setPageMeta({
          page: payload.page || 1,
          pageSize: payload.pageSize || 10,
          totalCount: payload.totalCount || 0,
        });
        setError('');
      } catch (err) {
        if (!isActive) return;
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách Case.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchCases();

    return () => {
      isActive = false;
    };
  }, [page, statusFilter]);

  const totalPages = Math.max(1, Math.ceil((pageMeta.totalCount || 0) / (pageMeta.pageSize || 10)));

  const handleRetry = () => {
    setPage(1);
    setError('');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Case Workflow</h2>
          <p className="page-subtitle">Danh sách case đang được điều tra và chờ phê duyệt</p>
        </div>
        <div className="header-badge">
          <BriefcaseBusiness size={15} />
          {pageMeta.totalCount} case
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <Filter size={16} className="toolbar-icon" />
          <select
            className="select-dark"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(CASE_STATUS_CONFIG).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-right">
          <button className="sort-toggle" type="button" onClick={handleRetry} disabled={loading}>
            <RefreshCw size={15} /> Tải lại
          </button>
        </div>
      </div>

      <div className="page-card">
        {error ? (
          <div className="empty-state">
            <AlertTriangle size={42} />
            <h3>Không tải được danh sách Case</h3>
            <p>{error}</p>
            <button className="sort-toggle" type="button" onClick={() => setPage(1)}>
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="table-loading">
            <div className="spin" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải dữ liệu...
          </div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <BriefcaseBusiness size={48} />
            <h3>{pageMeta.totalCount === 0 ? 'Chưa có Case nào' : 'Không có Case phù hợp'}</h3>
            <p>
              {pageMeta.totalCount === 0
                ? 'Case sẽ xuất hiện ở đây khi alert đã được tạo và chuyển sang quy trình điều tra.'
                : 'Thử thay đổi bộ lọc trạng thái để xem thêm dữ liệu.'}
            </p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Khách hàng</th>
                  <th>Alert liên quan</th>
                  <th>Người mở</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Ngày đóng</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.caseId}>
                    <td>
                      <span className="cell-id">#{item.caseId}</span>
                    </td>
                    <td>
                      <span className="cell-name">{item.customerName || '—'}</span>
                    </td>
                    <td>
                      {item.alertIds && item.alertIds.length > 0 ? (
                        <span className="cell-name">#{item.alertIds.join(', #')}</span>
                      ) : (
                        <span className="cell-time">Không có</span>
                      )}
                    </td>
                    <td>
                      <span className="cell-name">{item.openByName || '—'}</span>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <span className="cell-time">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                    </td>
                    <td>
                      <span className="cell-time">{item.closedAt ? new Date(item.closedAt).toLocaleString('vi-VN') : '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span className="page-info">
                Trang {page} / {totalPages} · Tổng {pageMeta.totalCount} case
              </span>

              <div className="page-controls">
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="page-current">{page}</span>

                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
