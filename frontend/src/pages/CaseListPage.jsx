import { useCallback, useEffect, useRef, useState } from 'react';
import Pagination from '../components/Pagination';
import { AlertTriangle, BriefcaseBusiness, Filter, GitMerge } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { formatDate } from './alertShared';
import { CASE_STATUS_CONFIG } from './caseUtils';
import { CaseStatusBadge as StatusBadge } from './caseShared';

const POLL_INTERVAL_MS = 3000;

const MERGE_PATTERN_BADGES = {
  SameCustomer: {
    label: 'Cùng khách hàng',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  SameDestination: {
    label: 'Money Mule (Chung TK nhận)',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  MoneyTrail: {
    label: 'Layering (Chuỗi dòng tiền)',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
};

export default function CaseListPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [patternFilter, setPatternFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 10, totalCount: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchCases = useCallback(async ({ silent = false } = {}) => {
    if (silent && inFlightRef.current) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await axiosClient.get('/Case', {
        params: {
          page,
          pageSize: 10,
          status: statusFilter || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      });

      if (seq !== requestSeqRef.current) return;

      const payload = response.data || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      const totalCount = payload.totalCount || 0;
      const lastPage = Math.max(1, Math.ceil(totalCount / (payload.pageSize || 10)));

      if (items.length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }

      setCases(items);
      setPageMeta({
        page: payload.page || 1,
        pageSize: payload.pageSize || 10,
        totalCount,
      });
      setError('');
    } catch (err) {
      if (seq === requestSeqRef.current && !silent) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách Case.');
      }
    } finally {
      inFlightRef.current = false;
      if (seq === requestSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchCases({ silent: false });
  }, [fetchCases, reloadKey]);

  // Tự động tải ngầm định kỳ mỗi 3 giây
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCases({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCases({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCases]);

  const filteredCases = cases.filter((item) => {
    if (!patternFilter) return true;
    const isMerged = (item.alertIds?.length ?? 0) > 1;
    if (patternFilter === 'Single') return !isMerged;
    return isMerged && (item.mergePattern || 'SameCustomer') === patternFilter;
  });

  const totalPages = Math.max(1, Math.ceil((pageMeta.totalCount || 0) / (pageMeta.pageSize || 10)));

  const handleRetry = () => {
    setError('');
    setReloadKey((current) => current + 1);
  };

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

          <select
            className="select-dark"
            aria-label="Lọc theo loại hồ sơ"
            value={patternFilter}
            onChange={(event) => setPatternFilter(event.target.value)}
          >
            <option value="">Tất cả loại hồ sơ</option>
            <option value="Single">Hồ sơ đơn lẻ</option>
            <option value="SameCustomer">Gộp: Cùng khách hàng</option>
            <option value="SameDestination">Gộp: Money Mule (Chung TK nhận)</option>
            <option value="MoneyTrail">Gộp: Layering (Chuỗi dòng tiền)</option>
          </select>
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
        ) : loading && cases.length === 0 ? (
          <div className="table-loading">
            <div className="spin" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải dữ liệu...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="empty-state">
            <BriefcaseBusiness size={48} />
            <h2>{pageMeta.totalCount === 0 ? 'Chưa có hồ sơ nào' : 'Không có hồ sơ phù hợp'}</h2>
            <p>
              {pageMeta.totalCount === 0
                ? 'Hồ sơ sẽ xuất hiện ở đây khi cảnh báo được chuyển sang quy trình điều tra.'
                : 'Thử thay đổi bộ lọc trạng thái hoặc loại hồ sơ để xem thêm dữ liệu.'}
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
                  <th>Loại hồ sơ</th>
                  <th>Người mở</th>
                  <th>Trạng thái</th>
                  <th>Ngày mở</th>
                  <th>Ngày đóng</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((item) => {
                  const isMerged = (item.alertIds?.length ?? 0) > 1;
                  const patternCfg = MERGE_PATTERN_BADGES[item.mergePattern] || MERGE_PATTERN_BADGES.SameCustomer;

                  return (
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
                        {isMerged ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: patternCfg.color,
                                backgroundColor: patternCfg.bg,
                                border: `1px solid ${patternCfg.border}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <GitMerge size={12} aria-hidden="true" />
                              {patternCfg.label}
                            </span>
                            {item.correlationKey && (
                              <span style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'monospace' }}>
                                {item.correlationKey}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-time">Đơn lẻ</span>
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
                  );
                })}
              </tbody>
            </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={pageMeta.totalCount}
              itemLabel="hồ sơ"
              onPageChange={setPage}
              disabled={loading}
              ariaLabel="Phân trang danh sách hồ sơ"
            />
          </>
        )}
      </div>
    </div>
  );
}