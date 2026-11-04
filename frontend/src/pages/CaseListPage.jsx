
import { useEffect, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { formatDate } from './alertShared';
import { CASE_STATUS_CONFIG } from './caseUtils';
import { CaseStatusBadge as StatusBadge } from './caseShared';

export default function CaseListPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 10, totalCount: 0 });
  // Tăng giá trị này để buộc useEffect gọi lại API (kể cả khi page/filter không đổi)
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [page, statusFilter, reloadKey]);

  const totalPages = Math.max(1, Math.ceil((pageMeta.totalCount || 0) / (pageMeta.pageSize || 10)));

  // Tải lại đúng trang hiện tại (không nhảy về trang 1)
  const handleRetry = () => {
    setError('');
    setReloadKey((current) => current + 1);
  };

  // Bấm vào bất kỳ chỗ nào trên dòng đều mở hồ sơ; riêng link bên trong (mã hồ sơ, mã cảnh báo) tự điều hướng.
  // Người dùng bàn phím vẫn dùng link mã hồ sơ (đã focus được), nên dòng không cần thêm tabIndex.
  const handleRowClick = (event, caseId) => {
    if (event.target.closest('a, button')) return;
    navigate(`/cases/${caseId}`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ điều tra</h1>
          <p className="page-subtitle">Danh sách case đang được điều tra và chờ phê duyệt</p>
        </div>
        <div className="header-badge">
          <BriefcaseBusiness size={15} />
          {pageMeta.totalCount} hồ sơ
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <Filter size={16} className="toolbar-icon" />
          <select
            className="select-dark"
            aria-label="Lọc theo trạng thái hồ sơ"
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
            <h3>Không tải được danh sách hồ sơ</h3>
            <p>{error}</p>
            <button className="sort-toggle" type="button" onClick={handleRetry}>
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
            <h2>{pageMeta.totalCount === 0 ? 'Chưa có hồ sơ nào' : 'Không có hồ sơ phù hợp'}</h2>
            <p>
              {pageMeta.totalCount === 0
                ? 'Hồ sơ sẽ xuất hiện ở đây khi cảnh báo được chuyển sang quy trình điều tra.'
                : 'Thử thay đổi bộ lọc trạng thái để xem thêm dữ liệu.'}
            </p>
          </div>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng danh sách hồ sơ điều tra" tabIndex={0}>
            <table className="data-table" aria-label="Danh sách hồ sơ điều tra">
              <thead>
                <tr>
                  <th>Mã hồ sơ</th>
                  <th>Khách hàng</th>
                  <th>Cảnh báo liên quan</th>
                  <th>Người mở</th>
                  <th>Trạng thái</th>
                  <th>Ngày mở</th>
                  <th>Ngày đóng</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.caseId} className="clickable-row" onClick={(event) => handleRowClick(event, item.caseId)}>
                    <td>
                      <Link className="cell-id alert-detail-link" to={`/cases/${item.caseId}`} aria-label={`Xem hồ sơ điều tra ${item.caseId}`}>#{item.caseId}</Link>
                    </td>
                    <td>
                      <span className="cell-name">{item.customerName || '—'}</span>
                    </td>
                    <td>
                      {item.alertIds && item.alertIds.length > 0 ? (
                        <span className="cell-name">
                          {item.alertIds.map((alertId, index) => (
                            <span key={alertId}>
                              {index > 0 && ', '}
                              <Link className="cell-id alert-detail-link" to={`/alerts/${alertId}`}>#{alertId}</Link>
                            </span>
                          ))}
                        </span>
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
                      <span className="cell-time">{formatDate(item.createdAt)}</span>
                    </td>
                    <td>
                      <span className="cell-time">{item.closedAt ? formatDate(item.closedAt) : '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="pagination">
              <span className="page-info">
                Trang {page} / {totalPages} · Tổng {pageMeta.totalCount} hồ sơ
              </span>

              <div className="page-controls">
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="page-current">{page}</span>

                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  aria-label="Trang sau"
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