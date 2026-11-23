import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BriefcaseBusiness, CheckCircle2,
  GitMerge, ShieldAlert, UserPlus,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import AlertDrawer from './AlertDrawer';
import {
  BacklogCell, RiskBadge, RiskGauge, formatDate,
  formatDateShort, getCreatedAt, getErrorMessage,
} from './alertShared';
import { CaseStatusBadge } from './caseShared';

const PAGE_SIZE = 8;
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

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function ManagerTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('selected');

  const [alerts, setAlerts] = useState([]);
  const [alertMeta, setAlertMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalCount: 0 });
  const [alertPage, setAlertPage] = useState(1);

  const [cases, setCases] = useState([]);
  const [caseMeta, setCaseMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalCount: 0 });
  const [casePage, setCasePage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchTasks = useCallback(async ({ silent = false } = {}) => {
    if (silent && inFlightRef.current) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;
    if (!silent) setLoading(true);

    try {
      const [alertRes, caseRes] = await Promise.all([
        axiosClient.get('/Alert', {
          params: {
            page: alertPage,
            pageSize: PAGE_SIZE,
            scope: 'queue',
            sortBy: 'riskScore',
            sortOrder: 'desc',
          },
        }),
        axiosClient.get('/Case', {
          params: {
            page: casePage,
            pageSize: PAGE_SIZE,
            status: 'PendingApproval',
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        }),
      ]);

      if (seq !== requestSeqRef.current) return;

      const alertPayload = alertRes.data || {};
      const alertItems = Array.isArray(alertPayload.items) ? alertPayload.items : [];
      const totalAlerts = alertPayload.totalCount || 0;
      const lastAlertPage = Math.max(1, Math.ceil(totalAlerts / (alertPayload.pageSize || PAGE_SIZE)));
      if (alertItems.length === 0 && alertPage > lastAlertPage) {
        setAlertPage(lastAlertPage);
        return;
      }

      const casePayload = caseRes.data || {};
      const caseItems = Array.isArray(casePayload.items) ? casePayload.items : [];
      const totalCases = casePayload.totalCount || 0;
      const lastCasePage = Math.max(1, Math.ceil(totalCases / (casePayload.pageSize || PAGE_SIZE)));
      if (caseItems.length === 0 && casePage > lastCasePage) {
        setCasePage(lastCasePage);
        return;
      }

      setAlerts(alertItems);
      setAlertMeta({
        page: alertPayload.page || alertPage,
        pageSize: alertPayload.pageSize || PAGE_SIZE,
        totalCount: totalAlerts,
      });

      setCases(caseItems);
      setCaseMeta({
        page: casePayload.page || casePage,
        pageSize: casePayload.pageSize || PAGE_SIZE,
        totalCount: totalCases,
      });

      setNow(Date.now());
      setError('');
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
  }, [alertPage, casePage]);

  useEffect(() => {
    fetchTasks({ silent: false });
  }, [fetchTasks, reloadKey]);

  // Tự động tải ngầm mỗi 3 giây khi tab đang mở và không mở Drawer phân công
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (selectedId) return;
      fetchTasks({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !selectedId) {
        fetchTasks({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedId, fetchTasks]);

  const selectedAlert = (() => {
    if (!selectedId) return null;
    const row = alerts.find((a) => String(a.alertId) === selectedId);
    if (row) return row;
    const numericId = Number(selectedId);
    return Number.isInteger(numericId) ? { alertId: numericId } : null;
  })();

  const openDrawer = (alertId) => setSearchParams({ selected: String(alertId) });
  const closeDrawer = useCallback(() => setSearchParams({}), [setSearchParams]);
  const refreshAll = useCallback(() => setReloadKey((k) => k + 1), []);

  const totalPending = alertMeta.totalCount + caseMeta.totalCount;
  const alertTotalPages = Math.max(1, Math.ceil(alertMeta.totalCount / (alertMeta.pageSize || PAGE_SIZE)));
  const caseTotalPages = Math.max(1, Math.ceil(caseMeta.totalCount / (caseMeta.pageSize || PAGE_SIZE)));

  const handleAlertRowKeyDown = (event, alertId) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(alertId);
    }
  };

  const handleCaseRowClick = (event, caseId) => {
    if (event.target.closest('a, button')) return;
    navigate(`/cases/${caseId}`);
  };

  return (
    <div className="fade-in dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Cần bạn xử lý</h1>
          <p className="page-subtitle">Phân công cảnh báo mới cho điều tra viên và phê duyệt hồ sơ hoàn tất điều tra</p>
        </div>
        <div className="header-badge" aria-live="polite">
          {totalPending > 0 ? (
            <>
              <AlertTriangle size={15} aria-hidden="true" />
              {formatNumber(totalPending)} đầu việc tồn đọng
            </>
          ) : (
            <>
              <CheckCircle2 size={15} aria-hidden="true" />
              Đã xử lý hết tồn đọng
            </>
          )}
        </div>
      </header>

      {error && (
        <p className="case-message error" role="alert">{error}</p>
      )}

      {/* 2 thẻ tóm tắt đầu việc cần Manager xử lý */}
      <div className="tasks-summary-grid">
        <a href="#unassigned-alerts" className="tasks-summary-card">
          <span className="dash-tile-icon" style={{ color: alertMeta.totalCount > 0 ? '#60a5fa' : undefined }} aria-hidden="true">
            <ShieldAlert size={20} />
          </span>
          <div className="tasks-summary-body">
            <span className="dash-tile-label">Cảnh báo chưa phân công</span>
            <strong className="dash-tile-value">{formatNumber(alertMeta.totalCount)}</strong>
            <span className="dash-tile-hint">
              {alertMeta.totalCount > 0 ? 'Ưu tiên theo điểm rủi ro từ cao xuống thấp' : 'Không có cảnh báo chờ phân công'}
            </span>
          </div>
          <ArrowRight size={16} className="tasks-summary-arrow" aria-hidden="true" />
        </a>

        <a href="#pending-cases" className="tasks-summary-card">
          <span className="dash-tile-icon" style={{ color: caseMeta.totalCount > 0 ? '#fbbf24' : undefined }} aria-hidden="true">
            <BriefcaseBusiness size={20} />
          </span>
          <div className="tasks-summary-body">
            <span className="dash-tile-label">Hồ sơ chờ phê duyệt</span>
            <strong className="dash-tile-value">{formatNumber(caseMeta.totalCount)}</strong>
            <span className="dash-tile-hint">
              {caseMeta.totalCount > 0 ? 'Điều tra viên đã hoàn tất, chờ quyết định' : 'Không có hồ sơ chờ duyệt'}
            </span>
          </div>
          <ArrowRight size={16} className="tasks-summary-arrow" aria-hidden="true" />
        </a>
      </div>

      {/* Khối 1: Cảnh báo chưa phân công */}
      <section id="unassigned-alerts" className="detail-section" aria-labelledby="heading-unassigned">
        <div className="detail-section-heading">
          <div>
            <p className="detail-eyebrow">Hàng đợi điều phối · {formatNumber(alertMeta.totalCount)} cảnh báo</p>
            <h2 id="heading-unassigned">Cảnh báo chưa phân công</h2>
          </div>
          <Link className="detail-back-link" style={{ marginBottom: 0 }} to="/alerts">
            Mở trang cảnh báo →
          </Link>
        </div>

        {loading && alerts.length === 0 ? (
          <div className="table-loading" style={{ padding: '40px 16px' }} role="status">
            <div className="spin" aria-hidden="true" style={{ width: 24, height: 24, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải cảnh báo chưa phân công...
          </div>
        ) : alerts.length === 0 ? (
          <p className="case-empty">Hiện không có cảnh báo nào chưa phân công.</p>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng cảnh báo chưa phân công" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Mã</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Số tiền</th>
                    <th scope="col">Điểm rủi ro</th>
                    <th scope="col">Mức độ</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Tồn đọng</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr
                      key={alert.alertId}
                      className={`clickable-row ${String(alert.alertId) === selectedId ? 'selected' : ''}`}
                      tabIndex={0}
                      onClick={() => openDrawer(alert.alertId)}
                      onKeyDown={(event) => handleAlertRowKeyDown(event, alert.alertId)}
                    >
                      <td>
                        <Link
                          className="cell-id alert-detail-link"
                          to={`/alerts/${alert.alertId}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          #{alert.alertId}
                        </Link>
                      </td>
                      <td><span className="cell-name">{alert.customerName}</span></td>
                      <td><span className="cell-amount">{alert.amount?.toLocaleString('vi-VN')} ₫</span></td>
                      <td><RiskGauge score={alert.riskScore} level={alert.riskLevel} /></td>
                      <td><RiskBadge level={alert.riskLevel} /></td>
                      <td><span className="cell-time">{formatDateShort(getCreatedAt(alert))}</span></td>
                      <td><BacklogCell alert={alert} now={now} /></td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="sort-toggle"
                          style={{ minHeight: 34, padding: '6px 12px', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.35)' }}
                          onClick={() => openDrawer(alert.alertId)}
                        >
                          <UserPlus size={14} aria-hidden="true" />
                          Phân công
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
            page={alertPage}
            totalPages={alertTotalPages}
            totalCount={alertMeta.totalCount}
            itemLabel="cảnh báo"
            onPageChange={setAlertPage}
            disabled={loading}
            style={{ marginTop: 12 }}
            ariaLabel="Phân trang cảnh báo chưa phân công"
            />
          </>
        )}
      </section>

      {/* Khối 2: Hồ sơ chờ duyệt */}
      <section id="pending-cases" className="detail-section" aria-labelledby="heading-pending-cases">
        <div className="detail-section-heading">
          <div>
            <p className="detail-eyebrow">Phê duyệt độc lập · {formatNumber(caseMeta.totalCount)} hồ sơ</p>
            <h2 id="heading-pending-cases">Hồ sơ chờ phê duyệt</h2>
          </div>
          <Link className="detail-back-link" style={{ marginBottom: 0 }} to="/cases">
            Mở danh sách hồ sơ →
          </Link>
        </div>

        {loading && cases.length === 0 ? (
          <div className="table-loading" style={{ padding: '40px 16px' }} role="status">
            <div className="spin" aria-hidden="true" style={{ width: 24, height: 24, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải hồ sơ chờ duyệt...
          </div>
        ) : cases.length === 0 ? (
          <p className="case-empty">Hiện không có hồ sơ nào đang chờ phê duyệt.</p>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng hồ sơ chờ phê duyệt" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Mã hồ sơ</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Cảnh báo liên quan</th>
                    <th scope="col">Loại hồ sơ</th>
                    <th scope="col">Điều tra viên</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Ngày mở</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => {
                    const isMerged = (item.alertIds?.length ?? 0) > 1;
                    const patternCfg = MERGE_PATTERN_BADGES[item.mergePattern] || MERGE_PATTERN_BADGES.SameCustomer;
                    return (
                      <tr
                        key={item.caseId}
                        className="clickable-row"
                        onClick={(event) => handleCaseRowClick(event, item.caseId)}
                      >
                        <td>
                          <Link className="cell-id alert-detail-link" to={`/cases/${item.caseId}`}>
                            #{item.caseId}
                          </Link>
                        </td>
                        <td><span className="cell-name">{item.customerName || '—'}</span></td>
                        <td>
                          {item.alertIds && item.alertIds.length > 0 ? (
                            <span className="cell-name">
                              {item.alertIds.map((id, idx) => (
                                <span key={id}>
                                  {idx > 0 && ', '}
                                  <Link className="cell-id alert-detail-link" to={`/alerts/${id}`}>#{id}</Link>
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="cell-time">Không có</span>
                          )}
                        </td>
                        <td>
                          {isMerged ? (
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
                          ) : (
                            <span className="cell-time">Đơn lẻ</span>
                          )}
                        </td>
                        <td><span className="cell-name">{item.openByName || '—'}</span></td>
                        <td><CaseStatusBadge status={item.status} /></td>
                        <td><span className="cell-time">{formatDate(item.createdAt)}</span></td>
                        <td>
                          <Link
                            to={`/cases/${item.caseId}`}
                            className="sort-toggle"
                            style={{ minHeight: 34, padding: '6px 12px', color: '#fcd34d', borderColor: 'rgba(245, 158, 11, 0.35)' }}
                          >
                            Xem & Duyệt
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
            page={casePage}
            totalPages={caseTotalPages}
            totalCount={caseMeta.totalCount}
            itemLabel="hồ sơ"
            onPageChange={setCasePage}
            disabled={loading}
            style={{ marginTop: 12 }}
            ariaLabel="Phân trang hồ sơ chờ duyệt"
            />
          </>
        )}
      </section>

      {selectedAlert && (
        <AlertDrawer
          key={selectedAlert.alertId}
          alert={selectedAlert}
          onClose={closeDrawer}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}