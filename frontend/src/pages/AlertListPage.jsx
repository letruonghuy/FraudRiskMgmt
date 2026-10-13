import { useEffect, useState } from 'react';
import { AlertTriangle, ListFilter, RefreshCw } from 'lucide-react';
import axiosClient from '../api/axiosClient';

// ── Helpers ──────────────────────────────────────────────
const RISK_CONFIG = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  Safe:     { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
};

const STATUS_CONFIG = {
  New:              { label: 'Mới',          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.3)' },
  Assigned:         { label: 'Đã phân công', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
  Processing:       { label: 'Đang xử lý',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
  UnderReview:      { label: 'Đang xem xét', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  AwaitingApproval: { label: 'Chờ duyệt',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  'Waiting Approval': { label: 'Chờ duyệt',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  Closed:           { label: 'Đã đóng',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  FalsePositive:    { label: 'Báo động giả', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  Reopened:         { label: 'Mở lại',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
};

const RiskBadge = ({ level }) => {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Safe;
  return <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>{level}</span>;
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };
  return <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>{cfg.label}</span>;
};

const RiskGauge = ({ score, level }) => {
  const numericScore = Number(score) || 0;
  const pct = Math.max(0, Math.min(100, Math.round(numericScore * 100)));
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Safe;
  return (
    <div className="risk-gauge">
      <div className="risk-gauge-bar">
        <div className="risk-gauge-fill" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>
      <span className="risk-gauge-label" style={{ color: cfg.color }}>{pct}%</span>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────
export default function AlertListPage() {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [riskFilter, setRisk]       = useState('');
  const [reloadKey, setReloadKey]   = useState(0);

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
      .catch((err) => {
        if (isActive) {
          setError(err.response?.data?.message || err.message || 'Không thể tải danh sách Alert.');
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => { isActive = false; };
  }, [reloadKey]);

  const filteredAlerts = alerts.filter((alert) =>
    (!statusFilter || alert.status === statusFilter) &&
    (!riskFilter || alert.riskLevel === riskFilter)
  );

  const handleRetry = () => {
    setLoading(true);
    setError('');
    setReloadKey((current) => current + 1);
  };

  return (
    <div className="fade-in">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Alert Monitor</h2>
          <p className="page-subtitle">Danh sách cảnh báo giao dịch nghi ngờ gian lận</p>
        </div>
        <div className="header-badge">
          <AlertTriangle size={15} />
          {filteredAlerts.length} / {alerts.length} alerts
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <ListFilter size={16} className="toolbar-icon" />
          <select className="select-dark" value={statusFilter} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select className="select-dark" value={riskFilter} onChange={(event) => setRisk(event.target.value)}>
            <option value="">Tất cả mức độ</option>
            {Object.keys(RISK_CONFIG).map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <button className="sort-toggle" onClick={handleRetry} disabled={loading}>
            <RefreshCw size={15} /> Tải lại
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="page-card">
        {error ? (
          <div className="empty-state">
            <AlertTriangle size={42} />
            <h3>Không tải được danh sách Alert</h3>
            <p>{error}</p>
            <button className="sort-toggle" onClick={handleRetry} type="button">Thử lại</button>
          </div>
        ) : loading ? (
          <div className="table-loading">
            <div className="spin" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải dữ liệu...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={48} />
            <h3>{alerts.length === 0 ? 'Chưa có Alert' : 'Không có Alert phù hợp'}</h3>
            <p>{alerts.length === 0 ? 'Alert sẽ xuất hiện tại đây khi hệ thống ghi nhận giao dịch rủi ro.' : 'Thử thay đổi bộ lọc trạng thái hoặc mức rủi ro.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Số tiền</th>
                <th>Risk Score</th>
                <th>Mức độ</th>
                <th>Trạng thái</th>
                <th>Officer phụ trách</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr key={alert.alertId}>
                  <td><span className="cell-id">#{alert.alertId}</span></td>
                  <td><span className="cell-name">{alert.customerName}</span></td>
                  <td><span className="cell-amount">{alert.amount?.toLocaleString('vi-VN')} ₫</span></td>
                  <td><RiskGauge score={alert.riskScore} level={alert.riskLevel} /></td>
                  <td><RiskBadge level={alert.riskLevel} /></td>
                  <td><StatusBadge status={alert.status} /></td>
                  <td>{alert.assignedToName || <span className="cell-time">Chưa phân công</span>}</td>
                  <td><span className="cell-time">{new Date(alert.createAt).toLocaleString('vi-VN')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}