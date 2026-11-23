import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, BriefcaseBusiness,
  GitMerge, ListFilter, Search, X,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import AlertDrawer from './AlertDrawer';
import {
  RISK_CONFIG, STATUS_CONFIG, RiskBadge, RiskGauge, StatusBadge,
  getCreatedAt, getErrorMessage, BacklogCell, formatDateShort, formatDate, formatCurrency,
} from './alertShared';

const PAGE_SIZE = 10;
const MAX_MERGE_ALERTS = 20;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;
const POLL_INTERVAL_MS = 3000;

const MERGE_PATTERN_META = {
  SameCustomer: {
    label: 'Cùng khách hàng (cửa sổ 7 ngày)',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  SameDestination: {
    label: 'Money Mule — Chung tài khoản nhận (cửa sổ 7 ngày)',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  MoneyTrail: {
    label: 'Layering — Chuỗi dòng tiền (cửa sổ 24 giờ)',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
};

const SORT_OPTIONS = {
  newest:     { label: 'Mới nhất',          sortBy: 'createdAt', sortOrder: 'desc' },
  oldest:     { label: 'Cũ nhất',           sortBy: 'createdAt', sortOrder: 'asc' },
  riskDesc:   { label: 'Rủi ro cao → thấp', sortBy: 'riskScore', sortOrder: 'desc' },
  amountDesc: { label: 'Số tiền lớn → nhỏ', sortBy: 'amount',    sortOrder: 'desc' },
};

export default function AlertListPage() {
  const { role, user } = useAuth();
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
  const [scope, setScope]         = useState('all');
  const [page, setPage]           = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [mergeReason, setMergeReason] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [modalError, setModalError] = useState('');

  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('selected');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isMergeable = useCallback((alert) => (
    role === 'Officer' &&
    !alert.caseId &&
    user?.userId != null &&
    String(alert.assignedTo) === String(user.userId) &&
    ['Assigned', 'UnderReview', 'Reopened'].includes(alert.status)
  ), [role, user?.userId]);

  const fetchAlertsData = useCallback(async ({ silent = false } = {}) => {
    if (silent && inFlightRef.current) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;
    const { sortBy, sortOrder } = SORT_OPTIONS[sortKey];
    const effectiveStatus = scope === 'queue' ? undefined : (statusFilter || undefined);

    if (!silent) {
      setLoading(true);
    }

    try {
      const [listRes, queueRes] = await Promise.all([
        axiosClient.get('/Alert', {
          params: {
            page,
            pageSize: PAGE_SIZE,
            status: effectiveStatus,
            riskLevel: riskFilter || undefined,
            search: search || undefined,
            scope: scope === 'all' ? undefined : scope,
            sortBy,
            sortOrder,
          },
        }),
        axiosClient.get('/Alert', {
          params: { scope: 'queue', page: 1, pageSize: 1 },
        }).catch(() => null),
      ]);

      if (seq !== requestSeqRef.current) return;

      const payload = listRes.data;
      if (!payload || !Array.isArray(payload.items)) {
        throw new Error('API Alert trả về dữ liệu không đúng định dạng phân trang.');
      }

      const totalCount = payload.totalCount || 0;
      const lastPage = Math.max(1, Math.ceil(totalCount / (payload.pageSize || PAGE_SIZE)));
      if (payload.items.length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }

      setAlerts(payload.items);
      setNow(Date.now());
      setPageMeta({ page: payload.page || page, pageSize: payload.pageSize || PAGE_SIZE, totalCount });
      if (queueRes?.data) {
        setQueueCount(queueRes.data.totalCount || 0);
      }
      setError('');

      if (role === 'Officer') {
        const currentPageMap = new Map(payload.items.map((item) => [item.alertId, item]));
        setSelectedIds((prev) =>
          prev.filter((id) => !currentPageMap.has(id) || isMergeable(currentPageMap.get(id)))
        );
      }
    } catch (err) {
      if (seq === requestSeqRef.current && !silent) {
        setError(getErrorMessage(err));
      }
    } finally {
      inFlightRef.current = false;
      if (seq === requestSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [page, statusFilter, riskFilter, search, sortKey, scope, role, isMergeable]);

  useEffect(() => {
    fetchAlertsData({ silent: false });
  }, [fetchAlertsData, reloadKey]);

  // Tự động tải ngầm định kỳ mỗi 3 giây
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (previewData || previewLoading || merging) return;
      fetchAlertsData({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !previewData && !merging) {
        fetchAlertsData({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [previewData, previewLoading, merging, fetchAlertsData]);

  const totalPages = Math.max(1, Math.ceil(pageMeta.totalCount / (pageMeta.pageSize || PAGE_SIZE)));
  const currentPage = Math.min(page, totalPages);

  const selectedAlert = (() => {
    if (!selectedId) return null;
    const row = alerts.find((a) => String(a.alertId) === selectedId);
    if (row) return row;
    const numericId = Number(selectedId);
    return Number.isInteger(numericId) ? { alertId: numericId } : null;
  })();

  const openDrawer = (alertId) => setSearchParams({ selected: String(alertId) });
  const closeDrawer = useCallback(() => setSearchParams({}), [setSearchParams]);
  const refreshList = useCallback(() => setReloadKey((current) => current + 1), []);

  const resetPage = (setter) => (event) => { setter(event.target.value); setPage(1); };

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    if (nextScope === 'queue') {
      setStatus('');
      setSortKey('riskDesc');
    } else if ((nextScope === 'mine' || nextScope === 'assigned') && statusFilter === 'New') {
      setStatus('');
    }
    setPage(1);
  };

  const scopeTabs = role === 'Manager'
    ? [{ key: 'all', label: 'Tất cả' }, { key: 'queue', label: 'Hàng đợi', count: queueCount }, { key: 'assigned', label: 'Đã phân công' }]
    : [{ key: 'all', label: 'Tất cả' }, { key: 'queue', label: 'Hàng đợi', count: queueCount }, { key: 'mine', label: 'Của tôi' }];

  const availableStatuses = scope === 'queue'
    ? []
    : (scope === 'mine' || scope === 'assigned')
      ? Object.entries(STATUS_CONFIG).filter(([val]) => val !== 'New')
      : Object.entries(STATUS_CONFIG);

  const handleRowKeyDown = (event, alertId) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(alertId);
    }
  };

  const toggleSelect = (alertId) => {
    setMergeError('');
    setSelectedIds((prev) => {
      if (prev.includes(alertId)) {
        return prev.filter((id) => id !== alertId);
      }
      if (prev.length >= MAX_MERGE_ALERTS) {
        setMergeError(`Chỉ được chọn tối đa ${MAX_MERGE_ALERTS} cảnh báo trong một lần gộp.`);
        return prev;
      }
      return [...prev, alertId];
    });
  };

  const handleOpenMergePreview = async () => {
    if (selectedIds.length < 2 || previewLoading || merging) return;
    setPreviewLoading(true);
    setMergeError('');
    setModalError('');
    try {
      const response = await axiosClient.post('/Case/merge-preview', { alertIds: selectedIds });
      setPreviewData(response.data);
      setMergeReason('');
    } catch (err) {
      setMergeError(getErrorMessage(err));
      if (err.response?.status === 409) {
        refreshList();
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (merging) return;
    setPreviewData(null);
    setMergeReason('');
    setModalError('');
  };

  const handleConfirmMerge = async (event) => {
    event.preventDefault();
    const trimmedReason = mergeReason.trim();
    if (!previewData || merging || trimmedReason.length < MIN_REASON_LENGTH) return;

    setMerging(true);
    setModalError('');
    try {
      const response = await axiosClient.post('/Case/merge', {
        alertIds: selectedIds,
        reason: trimmedReason,
      });
      const newCaseId = response.data?.caseId;
      setSelectedIds([]);
      setPreviewData(null);
      setMergeReason('');
      navigate(newCaseId ? `/cases/${newCaseId}` : '/cases');
    } catch (err) {
      setModalError(getErrorMessage(err));
      if (err.response?.status === 409) {
        refreshList();
      }
    } finally {
      setMerging(false);
    }
  };

  const hasFilter = Boolean((scope !== 'queue' && statusFilter) || riskFilter || search || scope !== 'all');
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatus(''); setRisk(''); setScope('all'); setPage(1);
  };

  const previewPatternCfg = previewData
    ? (MERGE_PATTERN_META[previewData.mergePattern] || MERGE_PATTERN_META.SameCustomer)
    : null;
  const trimmedReasonLen = mergeReason.trim().length;

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
            onClick={() => handleScopeChange(tab.key)}
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
          {scope !== 'queue' && (
            <select aria-label="Lọc theo trạng thái" className="select-dark" value={statusFilter} onChange={resetPage(setStatus)}>
              <option value="">Tất cả trạng thái</option>
              {availableStatuses.map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
            </select>
          )}
          <select aria-label="Lọc theo mức độ rủi ro" className="select-dark" value={riskFilter} onChange={resetPage(setRisk)}>
            <option value="">Tất cả mức độ</option>
            {Object.entries(RISK_CONFIG).map(([level, { label }]) => <option key={level} value={level}>{label}</option>)}
          </select>
          <select aria-label="Sắp xếp" className="select-dark" value={sortKey} onChange={resetPage(setSortKey)}>
            {Object.entries(SORT_OPTIONS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>

      {role === 'Officer' && selectedIds.length > 0 && (
        <div className="toolbar" role="region" aria-label="Thao tác gộp cảnh báo">
          <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span>
              Đã chọn <strong>{selectedIds.length}</strong> / {MAX_MERGE_ALERTS} cảnh báo
            </span>
            {mergeError && <span className="detail-action-error" role="alert">{mergeError}</span>}
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="sort-toggle"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => { setSelectedIds([]); setMergeError(''); }}
              disabled={previewLoading || merging}
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              className="detail-primary-action"
              style={{ whiteSpace: 'nowrap' }}
              onClick={handleOpenMergePreview}
              disabled={previewLoading || merging || selectedIds.length < 2}
            >
              <BriefcaseBusiness size={15} aria-hidden="true" />
              {previewLoading ? 'Đang kiểm tra liên kết...' : `Xem trước & Gộp ${selectedIds.length} cảnh báo`}
            </button>
          </div>
        </div>
      )}

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
                    {role === 'Officer' && <th scope="col" style={{ width: 36 }} aria-label="Chọn gộp" />}
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
                  {alerts.map((alert) => {
                    const checked = selectedIds.includes(alert.alertId);
                    const disabledCheckbox = !isMergeable(alert) || (!checked && selectedIds.length >= MAX_MERGE_ALERTS);
                    return (
                      <tr
                        key={alert.alertId}
                        className={`clickable-row ${String(alert.alertId) === selectedId ? 'selected' : ''}`}
                        tabIndex={0}
                        onClick={() => openDrawer(alert.alertId)}
                        onKeyDown={(event) => handleRowKeyDown(event, alert.alertId)}
                        aria-label={`Xem nhanh cảnh báo ${alert.alertId}`}
                      >
                        {role === 'Officer' && (
                          <td onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Chọn cảnh báo ${alert.alertId} để gộp`}
                              checked={checked}
                              disabled={disabledCheckbox}
                              onChange={() => toggleSelect(alert.alertId)}
                            />
                          </td>
                        )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalCount={pageMeta.totalCount}
              itemLabel="cảnh báo"
              onPageChange={setPage}
              disabled={loading}
              ariaLabel="Phân trang danh sách cảnh báo"
            />
          </>
        )}
      </div>

      {/* Modal Xem trước & Xác nhận gộp hồ sơ */}
      {previewData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-preview-title"
          onClick={handleClosePreview}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 740,
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="detail-eyebrow">Thẩm định trước khi khởi tạo hồ sơ</p>
                <h2 id="merge-preview-title" style={{ margin: '4px 0 0', fontSize: 19, color: '#f8fafc' }}>
                  Xác nhận gộp {previewData.alertCount} cảnh báo thành 1 Case
                </h2>
              </div>
              <button
                type="button"
                className="sort-toggle"
                onClick={handleClosePreview}
                disabled={merging}
                aria-label="Đóng cửa sổ xem trước"
                style={{ padding: '6px 8px' }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: previewPatternCfg.color,
                    backgroundColor: previewPatternCfg.bg,
                    border: `1px solid ${previewPatternCfg.border}`,
                  }}
                >
                  <GitMerge size={13} aria-hidden="true" />
                  {previewPatternCfg.label}
                </span>
                {previewData.correlationKey && (
                  <span style={{ fontSize: 12.5, color: '#cbd5e1', fontFamily: 'monospace' }}>
                    Khóa: <strong>{previewData.correlationKey}</strong>
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
                  gap: 10,
                  marginTop: 4,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: 12 }}>Chủ thể mở hồ sơ</span>
                  <strong style={{ color: '#f8fafc' }}>
                    {previewData.primaryCustomerName}
                    {previewData.distinctCustomerCount > 1 && ` (+${previewData.distinctCustomerCount - 1} KH)`}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: 12 }}>Tổng giá trị giao dịch</span>
                  <strong style={{ color: '#f8fafc' }}>{formatCurrency(previewData.totalAmount)}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: 12 }}>Rủi ro cao nhất</span>
                  <strong style={{ color: '#f87171' }}>
                    {RISK_CONFIG[previewData.highestRiskLevel]?.label || previewData.highestRiskLevel} ({Math.round((previewData.highestRiskScore || 0) * 100)}%)
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: 12 }}>Khung thời gian</span>
                  <strong style={{ color: '#e2e8f0', fontSize: 12 }}>
                    {formatDate(previewData.earliestTransactionTime)} → {formatDate(previewData.latestTransactionTime)}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Các cảnh báo được gộp ({previewData.alerts?.length || 0}):
              </p>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                  borderRadius: 8,
                }}
              >
                <table className="data-table" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Khách hàng</th>
                      <th>Luồng tài khoản</th>
                      <th>Số tiền</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewData.alerts || []).map((item) => (
                      <tr key={item.alertId}>
                        <td><span className="cell-id">#{item.alertId}</span></td>
                        <td>{item.customerName}</td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {item.nameOrig || '?'} → {item.nameDest || '?'}
                        </td>
                        <td><strong>{formatCurrency(item.amount)}</strong></td>
                        <td>{formatDate(item.transactionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <form className="case-form" onSubmit={handleConfirmMerge} style={{ marginTop: 14 }}>
              <label htmlFor="merge-rationale">
                Lý do gộp hồ sơ (bắt buộc, {MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} ký tự)
              </label>
              <textarea
                id="merge-rationale"
                rows={3}
                maxLength={MAX_REASON_LENGTH}
                placeholder="Ví dụ: Phát hiện chuỗi tẩu tán tiền liên tiếp qua 3 tài khoản trong vòng 15 phút, cần điều tra tập trung trên một hồ sơ..."
                value={mergeReason}
                onChange={(event) => setMergeReason(event.target.value)}
                disabled={merging}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                <span>Nội dung này sẽ được lưu bất biến vào nhật ký kiểm toán (Audit Log).</span>
                <span>{trimmedReasonLen}/{MAX_REASON_LENGTH}</span>
              </div>

              {modalError && (
                <p className="detail-action-error" role="alert" style={{ marginTop: 6 }}>
                  {modalError}
                </p>
              )}

              <div className="case-form-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={handleClosePreview}
                  disabled={merging}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="detail-primary-action"
                  disabled={merging || trimmedReasonLen < MIN_REASON_LENGTH}
                >
                  <BriefcaseBusiness size={15} aria-hidden="true" />
                  {merging ? 'Đang khởi tạo hồ sơ...' : 'Xác nhận gộp hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAlert && <AlertDrawer key={selectedAlert.alertId} alert={selectedAlert} onClose={closeDrawer} onChanged={refreshList} />}
    </div>
  );
}