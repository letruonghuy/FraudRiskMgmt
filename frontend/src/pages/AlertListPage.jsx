import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ListFilter, RefreshCw, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import AlertDrawer from './AlertDrawer';
import {
  RISK_CONFIG, STATUS_CONFIG, RiskBadge, RiskGauge, StatusBadge,
  formatDate, getCreatedAt, getErrorMessage,
} from './alertShared';

const PAGE_SIZE = 10;

const SORT_OPTIONS = {
  newest:    { label: 'Mới nhất',        compare: (a, b) => new Date(getCreatedAt(b)) - new Date(getCreatedAt(a)) },
  oldest:    { label: 'Cũ nhất',         compare: (a, b) => new Date(getCreatedAt(a)) - new Date(getCreatedAt(b)) },
  riskDesc:  { label: 'Rủi ro cao → thấp', compare: (a, b) => (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0) },
  amountDesc:{ label: 'Số tiền lớn → nhỏ', compare: (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) },
};

export default function AlertListPage() {
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setStatus] = useState('');
  const [riskFilter, setRisk]     = useState('');
  const [search, setSearch]       = useState('');
  const [sortKey, setSortKey]     = useState('newest');
  const [page, setPage]           = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Alert đang mở trong drawer được lưu trên URL (?selected=3) → F5 hoặc gửi link vẫn mở đúng alert
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('selected');

  useEffect(() => {
    let isActive = true;

    axiosClient.get('/Alert')
      .then((res) => {
        if (!Array.isArray(res.data)) {
          throw new Error('API Alert trả về dữ liệu không đúng định dạng danh sách.');
        }
        if (isActive) {
          setAlerts(res.data);
          setError('');
        }
      })
      .catch((err) => { if (isActive) setError(getErrorMessage(err)); })
      .finally(() => { if (isActive) setLoading(false); });

    return () => { isActive = false; };
  }, [reloadKey]);

  const visibleAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return alerts
      .filter((alert) =>
        (!statusFilter || alert.status === statusFilter) &&
        (!riskFilter || alert.riskLevel === riskFilter) &&
        (!keyword ||
          String(alert.alertId).includes(keyword.replace('#', '')) ||
          (alert.customerName || '').toLowerCase().includes(keyword))
      )
      .sort(SORT_OPTIONS[sortKey].compare);
  }, [alerts, statusFilter, riskFilter, search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(visibleAlerts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageAlerts = visibleAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedAlert = selectedId ? alerts.find((a) => String(a.alertId) === selectedId) : null;

  const openDrawer = (alertId) => setSearchParams({ selected: String(alertId) });
  const closeDrawer = useCallback(() => setSearchParams({}), [setSearchParams]);

  const resetPage = (setter) => (event) => { setter(event.target.value); setPage(1); };

  const handleRetry = () => {
    setLoading(true);
    setError('');
    setReloadKey((current) => current + 1);
  };

  const handleRowKeyDown = (event, alertId) => {
    if (event.target !== event.currentTarget) return; // bỏ qua phím bấm trên link bên trong dòng
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(alertId);
    }
  };

  const hasFilter = Boolean(statusFilter || riskFilter || search);

  return (
    <div className="fade-in alert-list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Giám sát cảnh báo</h1>
          <p className="page-subtitle">Danh sách cảnh báo giao dịch nghi ngờ gian lận</p>
        </div>
        <div className="header-badge" aria-live="polite">
          <AlertTriangle size={15} aria-hidden="true" />
          {visibleAlerts.length} / {alerts.length} cảnh báo
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-box">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm theo mã hoặc tên khách hàng"
              aria-label="Tìm kiếm cảnh báo"
              value={search}
              onChange={resetPage(setSearch)}
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
          <button className="sort-toggle" onClick={handleRetry} disabled={loading} type="button">
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
            <button className="sort-toggle" onClick={handleRetry} type="button">Thử tải lại</button>
          </div>
        ) : loading ? (
          <div className="table-loading" role="status" aria-live="polite">
            <div className="spin" aria-hidden="true" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải dữ liệu...
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={48} aria-hidden="true" />
            <h3>{alerts.length === 0 ? 'Chưa có cảnh báo' : 'Không có cảnh báo phù hợp'}</h3>
            <p>{alerts.length === 0 ? 'Cảnh báo sẽ xuất hiện khi hệ thống ghi nhận giao dịch rủi ro.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'}</p>
            {hasFilter && (
              <button className="sort-toggle" type="button" onClick={() => { setSearch(''); setStatus(''); setRisk(''); setPage(1); }}>
                Xóa bộ lọc
              </button>
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
                  </tr>
                </thead>
                <tbody>
                  {pageAlerts.map((alert) => (
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
                      <td><span className="cell-time">{formatDate(getCreatedAt(alert))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Phân trang">
                <span className="page-info">
                  Trang {currentPage} / {totalPages} · {visibleAlerts.length} cảnh báo
                </span>
                <div className="page-controls">
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    aria-label="Trang trước"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span className="page-current" aria-current="page">{currentPage}</span>
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
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

      {selectedAlert && <AlertDrawer alert={selectedAlert} onClose={closeDrawer} />}
    </div>
  );
}