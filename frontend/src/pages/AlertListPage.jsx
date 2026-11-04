import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ListFilter, RefreshCw, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import AlertDrawer from './AlertDrawer';
import {
  RISK_CONFIG, STATUS_CONFIG, RiskBadge, RiskGauge, StatusBadge,
  getCreatedAt, getErrorMessage, BacklogCell, formatDateShort
} from './alertShared';

const PAGE_SIZE = 10;

// Khớp tham số sortBy / sortOrder của GET /api/Alert (createdAt | riskScore | amount)
const SORT_OPTIONS = {
  newest:     { label: 'Mới nhất',          sortBy: 'createdAt', sortOrder: 'desc' },
  oldest:     { label: 'Cũ nhất',           sortBy: 'createdAt', sortOrder: 'asc' },
  riskDesc:   { label: 'Rủi ro cao → thấp', sortBy: 'riskScore', sortOrder: 'desc' },
  amountDesc: { label: 'Số tiền lớn → nhỏ', sortBy: 'amount',    sortOrder: 'desc' },
};

export default function AlertListPage() {
  const { role } = useAuth();
  const [alerts, setAlerts]       = useState([]);
  const [pageMeta, setPageMeta]   = useState({ page: 1, pageSize: PAGE_SIZE, totalCount: 0 });
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setStatus] = useState('');
  const [riskFilter, setRisk]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]       = useState('');
  const [sortKey, setSortKey]     = useState('newest');
  const [scope, setScope]         = useState('all'); // all | queue | mine (Officer) | assigned (Manager)
  const [page, setPage]           = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Alert đang mở trong drawer được lưu trên URL (?selected=3) → F5 hoặc gửi link vẫn mở đúng alert
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('selected');

  // Chờ người dùng ngừng gõ rồi mới gọi API
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let isActive = true;
    const { sortBy, sortOrder } = SORT_OPTIONS[sortKey];

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get('/Alert', {
          params: {
            page,
            pageSize: PAGE_SIZE,
            status: statusFilter || undefined,
            riskLevel: riskFilter || undefined,
            search: search || undefined,
            scope: scope === 'all' ? undefined : scope,
            sortBy,
            sortOrder,
          },
        });
        if (!isActive) return;

        const payload = response.data;
        if (!payload || !Array.isArray(payload.items)) {
          throw new Error('API Alert trả về dữ liệu không đúng định dạng phân trang.');
        }

        const totalCount = payload.totalCount || 0;
        const lastPage = Math.max(1, Math.ceil(totalCount / (payload.pageSize || PAGE_SIZE)));
        // Trang hiện tại không còn dữ liệu (ví dụ vừa nhận hết cảnh báo ở trang cuối) → lùi về trang cuối
        if (payload.items.length === 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }

        setAlerts(payload.items);
        setNow(Date.now());
        setPageMeta({ page: payload.page || page, pageSize: payload.pageSize || PAGE_SIZE, totalCount });
        setError('');
      } catch (err) {
        if (isActive) setError(getErrorMessage(err));
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchAlerts();
    return () => { isActive = false; };
  }, [page, statusFilter, riskFilter, search, sortKey, scope, reloadKey]);

  // Số cảnh báo trong hàng đợi (hiện trên tab) — chỉ cần tổng số nên lấy 1 dòng
  useEffect(() => {
    let isActive = true;
    axiosClient.get('/Alert', { params: { scope: 'queue', page: 1, pageSize: 1 } })
      .then((res) => { if (isActive) setQueueCount(res.data?.totalCount || 0); })
      .catch(() => { /* chỉ là số phụ, lỗi đã hiển thị ở danh sách chính */ });
    return () => { isActive = false; };
  }, [reloadKey]);

  const totalPages = Math.max(1, Math.ceil(pageMeta.totalCount / (pageMeta.pageSize || PAGE_SIZE)));
  const currentPage = Math.min(page, totalPages);

  const selectedAlert = (() => {
    if (!selectedId) return null;
    const row = alerts.find((a) => String(a.alertId) === selectedId);
    if (row) return row;
    // Mở bằng link trực tiếp khi alert không nằm ở trang đang xem: drawer tự tải chi tiết theo mã
    const numericId = Number(selectedId);
    return Number.isInteger(numericId) ? { alertId: numericId } : null;
  })();

  const openDrawer = (alertId) => setSearchParams({ selected: String(alertId) });
  const closeDrawer = useCallback(() => setSearchParams({}), [setSearchParams]);
  const refreshList = useCallback(() => setReloadKey((current) => current + 1), []);

  const resetPage = (setter) => (event) => { setter(event.target.value); setPage(1); };

  const scopeTabs = role === 'Manager'
    ? [{ key: 'all', label: 'Tất cả' }, { key: 'queue', label: 'Hàng đợi', count: queueCount }, { key: 'assigned', label: 'Đã phân công' }]
    : [{ key: 'all', label: 'Tất cả' }, { key: 'queue', label: 'Hàng đợi', count: queueCount }, { key: 'mine', label: 'Của tôi' }];

  const handleRowKeyDown = (event, alertId) => {
    if (event.target !== event.currentTarget) return; // bỏ qua phím bấm trên link bên trong dòng
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(alertId);
    }
  };

  const hasFilter = Boolean(statusFilter || riskFilter || search || scope !== 'all');
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatus(''); setRisk(''); setScope('all'); setPage(1);
  };

  return (
    <div className="fade-in alert-list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Giám sát cảnh báo</h1>
          <p className="page-subtitle">Danh sách cảnh báo giao dịch nghi ngờ gian lận</p>
        </div>
        <div className="header-badge" aria-live="polite">
          <AlertTriangle size={15} aria-hidden="true" />
          {pageMeta.totalCount} cảnh báo
        </div>
      </div>

      <div className="scope-tabs" role="group" aria-label="Phạm vi cảnh báo">
        {scopeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`scope-tab ${scope === tab.key ? 'active' : ''}`}
            aria-pressed={scope === tab.key}
            onClick={() => { setScope(tab.key); if (tab.key === 'queue') setSortKey('riskDesc'); setPage(1); }}
          >
            {tab.label}
            {tab.count > 0 && <span className="scope-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-box">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm mã hoặc tên khách hàng"
              aria-label="Tìm kiếm cảnh báo"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <ListFilter size={16} className="toolbar-icon" aria-hidden="true" />
          <select aria-label="Lọc theo trạng thái" className="select-dark" value={statusFilter} onChange={resetPage(setStatus)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_CONFIG).map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <select aria-label="Lọc theo mức độ rủi ro" className="select-dark" value={riskFilter} onChange={resetPage(setRisk)}>
            <option value="">Tất cả mức độ</option>
            {Object.entries(RISK_CONFIG).map(([level, { label }]) => <option key={level} value={level}>{label}</option>)}
          </select>
          <select aria-label="Sắp xếp" className="select-dark" value={sortKey} onChange={resetPage(setSortKey)}>
            {Object.entries(SORT_OPTIONS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <button className="sort-toggle" onClick={refreshList} disabled={loading} type="button">
            <RefreshCw size={15} aria-hidden="true" /> Tải lại
          </button>
        </div>
      </div>

      <div className="page-card" aria-busy={loading}>
        {error ? (
          <div className="empty-state" role="alert">
            <AlertTriangle size={42} aria-hidden="true" />
            <h3>Không tải được danh sách cảnh báo</h3>
            <p>{error}</p>
            <button className="sort-toggle" onClick={refreshList} type="button">Thử tải lại</button>
          </div>
        ) : loading && alerts.length === 0 ? (
          <div className="table-loading" role="status" aria-live="polite">
            <div className="spin" aria-hidden="true" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải dữ liệu...
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={48} aria-hidden="true" />
            <h3>{hasFilter ? 'Không có cảnh báo phù hợp' : 'Chưa có cảnh báo'}</h3>
            <p>{hasFilter ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Cảnh báo sẽ xuất hiện khi hệ thống ghi nhận giao dịch rủi ro.'}</p>
            {hasFilter && (
              <button className="sort-toggle" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
            )}
          </div>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng danh sách cảnh báo" tabIndex={0}>
              <table className="data-table" aria-label="Danh sách cảnh báo giao dịch">
                <thead>
                  <tr>
                    <th scope="col">Mã</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Số tiền</th>
                    <th scope="col">Điểm rủi ro</th>
                    <th scope="col">Mức độ</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Người phụ trách</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Tồn đọng</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr
                      key={alert.alertId}
                      className={`clickable-row ${String(alert.alertId) === selectedId ? 'selected' : ''}`}
                      tabIndex={0}
                      onClick={() => openDrawer(alert.alertId)}
                      onKeyDown={(event) => handleRowKeyDown(event, alert.alertId)}
                      aria-label={`Xem nhanh cảnh báo ${alert.alertId}`}
                    >
                      <td>
                        <Link
                          className="cell-id alert-detail-link"
                          to={`/alerts/${alert.alertId}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Mở trang chi tiết cảnh báo ${alert.alertId}`}
                        >
                          #{alert.alertId}
                        </Link>
                      </td>
                      <td><span className="cell-name">{alert.customerName}</span></td>
                      <td><span className="cell-amount">{alert.amount?.toLocaleString('vi-VN')} ₫</span></td>
                      <td><RiskGauge score={alert.riskScore} level={alert.riskLevel} /></td>
                      <td><RiskBadge level={alert.riskLevel} /></td>
                      <td><StatusBadge status={alert.status} /></td>
                      <td>{alert.assignedToName || <span className="cell-time">Chưa phân công</span>}</td>
                      <td><span className="cell-time">{formatDateShort(getCreatedAt(alert))}</span></td>
                      <td><BacklogCell alert={alert} now={now} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Phân trang">
                <span className="page-info">
                  Trang {currentPage} / {totalPages} · {pageMeta.totalCount} cảnh báo
                </span>
                <div className="page-controls">
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    aria-label="Trang trước"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span className="page-current" aria-current="page">{currentPage}</span>
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    aria-label="Trang sau"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      {selectedAlert && <AlertDrawer key={selectedAlert.alertId} alert={selectedAlert} onClose={closeDrawer} onChanged={refreshList} />}
    </div>
  );
}