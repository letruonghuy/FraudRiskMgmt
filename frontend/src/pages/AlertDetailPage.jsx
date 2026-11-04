import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, Check, CircleAlert, Clock3, FilePlus2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import {
  RISK_CONFIG, STATUS_CONFIG,
  formatCurrency, formatDate, getCreatedAt, getErrorMessage, maskAccountNumber, toRiskPercent,
} from './alertShared';
import AlertAssignmentPanel from './AlertAssignmentPanel';
import MlExplanation from './MlExplanation';

// ── Tiến trình xử lý ─────────────────────────────────────
const WORKFLOW_STEPS = [
  { key: 'New', label: 'Mới' },
  { key: 'Assigned', label: 'Phân công' },
  { key: 'UnderReview', label: 'Xem xét' },
  { key: 'AwaitingApproval', label: 'Chờ duyệt' },
  { key: 'Closed', label: 'Đóng' },
];

const STEP_INDEX = {
  New: 0, Assigned: 1, UnderReview: 2, Reopened: 2, AwaitingApproval: 3, Closed: 4, FalsePositive: 4,
};

function WorkflowStepper({ status }) {
  const current = STEP_INDEX[status] ?? 0;
  const isFalsePositive = status === 'FalsePositive';
  const isReopened = status === 'Reopened';

  return (
    <ol className="workflow-stepper" aria-label="Tiến trình xử lý cảnh báo">
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index < current || (index === current && (status === 'Closed' || isFalsePositive));
        const active = index === current && !done;
        const label = index === 4 && isFalsePositive ? 'Báo động giả' : (index === 2 && isReopened ? 'Mở lại' : step.label);
        return (
          <li key={step.key} className={`workflow-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} aria-current={index === current ? 'step' : undefined}>
            <span className="workflow-dot">{done ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
            <span className="workflow-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Đối soát số dư (tính trực tiếp từ dữ liệu giao dịch) ──
const hasValue = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const nearlyEqual = (a, b) => Math.abs(a - b) < 0.01;

function buildBalanceSignals(alert) {
  const signals = [];
  const amount = Number(alert.amount) || 0;

  if (hasValue(alert.oldBalanceOrg) && hasValue(alert.newBalanceOrig)) {
    const oldO = Number(alert.oldBalanceOrg);
    const newO = Number(alert.newBalanceOrig);
    const drop = oldO - newO;

    if (amount > 0 && oldO > 0 && newO === 0 && nearlyEqual(oldO, amount)) {
      signals.push({ level: 'danger', text: 'Giao dịch rút toàn bộ số dư tài khoản nguồn.' });
    }
    if (!nearlyEqual(drop, amount)) {
      signals.push({
        level: 'warn',
        text: `Số dư nguồn giảm ${formatCurrency(drop)} nhưng số tiền giao dịch là ${formatCurrency(amount)}.`,
      });
    }
  }

  if (hasValue(alert.oldBalanceDest) && hasValue(alert.newBalanceDest)) {
    const oldD = Number(alert.oldBalanceDest);
    const newD = Number(alert.newBalanceDest);
    const rise = newD - oldD;

    if (amount > 0 && oldD === 0 && newD === 0) {
      signals.push({ level: 'danger', text: 'Tài khoản đích không ghi nhận khoản tiền vào (số dư trước và sau đều bằng 0).' });
    } else if (!nearlyEqual(rise, amount)) {
      signals.push({
        level: 'warn',
        text: `Số dư đích tăng ${formatCurrency(rise)} nhưng số tiền giao dịch là ${formatCurrency(amount)}.`,
      });
    }
  }

  return signals;
}

// Mã gửi/nhận trong giao dịch: giữ 2 ký tự đầu (loại tài khoản, ví dụ C1, M1) và 4 ký tự cuối
// để vẫn phân biệt được bên gửi với bên nhận mà không lộ cả mã.
const maskTransactionId = (value) => {
  if (!value) return '—';
  const text = String(value);
  return text.length > 6 ? `${text.slice(0, 2)}•••• ${text.slice(-4)}` : text;
};

const balanceChange = (before, after) => {
  if (!hasValue(before) || !hasValue(after)) return null;
  return Number(after) - Number(before);
};

function ChangeCell({ value }) {
  if (value === null) return <td>—</td>;
  const sign = value > 0 ? '+' : '';
  const cls = value > 0 ? 'delta-up' : value < 0 ? 'delta-down' : '';
  return <td className={cls}>{sign}{formatCurrency(value)}</td>;
}

function DetailField({ label, value, emphasized = false }) {
  return (
    <div className={`alert-detail-field ${emphasized ? 'emphasized' : ''}`}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export default function AlertDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadAlert = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axiosClient.get(`/Alert/${id}`);
        if (isActive) setAlert(response.data);
      } catch (requestError) {
        if (isActive) setError(getErrorMessage(requestError));
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadAlert();
    return () => { isActive = false; };
  }, [id, reloadKey]);

  const risk = RISK_CONFIG[alert?.riskLevel] || RISK_CONFIG.Safe;
  const riskPercent = toRiskPercent(alert?.riskScore);
  const statusCfg = STATUS_CONFIG[alert?.status];
  const isAssignedOfficer = role === 'Officer' &&
    alert?.assignedTo != null &&
    user?.userId != null &&
    String(alert.assignedTo) === String(user.userId);
  const isClosed = alert?.status === 'Closed' || alert?.status === 'FalsePositive';
  const canCreateCase = Boolean(alert && isAssignedOfficer && !alert.caseId && !isClosed);
  const signals = alert ? buildBalanceSignals(alert) : [];

  const handleCreateCase = async () => {
    if (!alert || creatingCase) return;

    setCreatingCase(true);
    setActionError('');
    try {
      const response = await axiosClient.post('/Case', { alertId: alert.alertId });
      const newCaseId = response.data?.caseId;
      navigate(newCaseId ? `/cases/${newCaseId}` : '/cases');
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setCreatingCase(false);
    }
  };

  // Tải lại âm thầm sau khi nhận / trả / phân công (không hiện màn hình loading)
  const refreshAlert = useCallback(async () => {
    const response = await axiosClient.get(`/Alert/${id}`);
    setAlert(response.data);
  }, [id]);

  const handleRetry = () => setReloadKey((current) => current + 1);

  if (loading) {
    return (
      <div className="alert-detail-state" role="status" aria-live="polite">
        <div className="spin" aria-hidden="true" />
        <p>Đang tải thông tin cảnh báo...</p>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="alert-detail-state" role="alert">
        <CircleAlert size={28} aria-hidden="true" />
        <h1>Không tải được cảnh báo</h1>
        <p>{error || 'Cảnh báo không tồn tại.'}</p>
        <div className="alert-detail-state-actions">
          <button className="sort-toggle" type="button" onClick={handleRetry}>
            <RefreshCw size={15} aria-hidden="true" /> Thử lại
          </button>
          <Link className="detail-back-link" to="/alerts">Về danh sách cảnh báo</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in alert-detail-page">
      <Link className="detail-back-link" to="/alerts">
        <ArrowLeft size={16} aria-hidden="true" /> Danh sách cảnh báo
      </Link>

      <header className="alert-detail-header">
        <div>
          <p className="detail-eyebrow">Hồ sơ cảnh báo</p>
          <h1 className="page-title">Cảnh báo #{alert.alertId}</h1>
          <p className="page-subtitle">Giao dịch #{alert.transactionId} · {alert.customerName}</p>
        </div>
        <span className="detail-status-badge" style={{ color: risk.color, backgroundColor: risk.bg, borderColor: risk.border }}>
          <AlertTriangle size={15} aria-hidden="true" />
          {RISK_CONFIG[alert.riskLevel]?.label || alert.riskLevel || 'Chưa xác định'}
        </span>
      </header>

      <div className="alert-detail-grid">
        <div className="alert-detail-main">
          <section className="detail-risk-summary" aria-labelledby="risk-summary-title" style={{ borderLeftColor: risk.color }}>
            <div className="detail-risk-score">
              <span id="risk-summary-title">Điểm rủi ro</span>
              <strong style={{ color: risk.color }}>{riskPercent}%</strong>
              <div className="detail-risk-track" role="meter" aria-label="Điểm rủi ro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={riskPercent}>
                <span style={{ width: `${riskPercent}%`, backgroundColor: risk.color }} />
              </div>
            </div>
            <div className="detail-risk-meta">
              <span>Trạng thái</span>
              <strong style={statusCfg ? { color: statusCfg.color } : undefined}>{statusCfg?.label || alert.status}</strong>
            </div>
            <div className="detail-risk-meta">
              <span>Giá trị giao dịch</span>
              <strong>{formatCurrency(alert.amount)}</strong>
            </div>
          </section>

          <section className="detail-section" aria-labelledby="signals-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Tính từ dữ liệu giao dịch</p>
                <h2 id="signals-heading">Tín hiệu đối soát số dư</h2>
              </div>
            </div>
            {signals.length === 0 ? (
              <p className="signal-item signal-ok">
                <ShieldCheck size={16} aria-hidden="true" /> Số dư trước/sau khớp với số tiền giao dịch.
              </p>
            ) : (
              <ul className="signal-list">
                {signals.map((signal) => (
                  <li key={signal.text} className={`signal-item signal-${signal.level}`}>
                    <AlertTriangle size={16} aria-hidden="true" /> {signal.text}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <MlExplanation alert={alert} />

          <section className="detail-section" aria-labelledby="transaction-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Dữ liệu nguồn</p>
                <h2 id="transaction-heading">Thông tin giao dịch</h2>
              </div>
              <span className="detail-type-tag">{alert.transactionType || 'Không xác định'}</span>
            </div>
            <dl className="alert-detail-fields">
              <DetailField label="Mã giao dịch" value={`#${alert.transactionId}`} />
              <DetailField label="Thời gian giao dịch" value={formatDate(alert.transactionTime)} />
              <DetailField label="Số tiền" value={formatCurrency(alert.amount)} emphasized />
              <DetailField label="Khách hàng" value={alert.customerName} />
              <DetailField label="Số tài khoản khách hàng" value={maskAccountNumber(alert.customerAccountNumber)} />
              <DetailField label="Mã tài khoản gửi trong giao dịch" value={maskTransactionId(alert.nameOrig)} />
              <DetailField label="Mã tài khoản nhận trong giao dịch" value={maskTransactionId(alert.nameDest)} />
            </dl>
            <p className="case-empty ml-note">
              Số tài khoản khách hàng lấy từ hồ sơ khách hàng; mã gửi và mã nhận là mã ghi trong dữ liệu giao dịch.
              Cả ba đều được che một phần.
            </p>
          </section>

          <section className="detail-section" aria-labelledby="balance-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Đối chiếu trước và sau giao dịch</p>
                <h2 id="balance-heading">Biến động số dư</h2>
              </div>
            </div>
            <div className="detail-table-scroll" role="region" aria-label="Bảng biến động số dư" tabIndex={0}>
              <table className="detail-balance-table">
                <thead>
                  <tr>
                    <th scope="col">Tài khoản</th>
                    <th scope="col">Trước giao dịch</th>
                    <th scope="col">Sau giao dịch</th>
                    <th scope="col">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Nguồn</th>
                    <td>{formatCurrency(alert.oldBalanceOrg)}</td>
                    <td>{formatCurrency(alert.newBalanceOrig)}</td>
                    <ChangeCell value={balanceChange(alert.oldBalanceOrg, alert.newBalanceOrig)} />
                  </tr>
                  <tr>
                    <th scope="row">Đích</th>
                    <td>{formatCurrency(alert.oldBalanceDest)}</td>
                    <td>{formatCurrency(alert.newBalanceDest)}</td>
                    <ChangeCell value={balanceChange(alert.oldBalanceDest, alert.newBalanceDest)} />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="alert-detail-aside" aria-label="Thông tin xử lý">
          <section className="detail-workflow-panel" aria-labelledby="workflow-heading">
            <div className="detail-section-heading compact">
              <div>
                <p className="detail-eyebrow">Theo dõi</p>
                <h2 id="workflow-heading">Xử lý cảnh báo</h2>
              </div>
            </div>

            <WorkflowStepper status={alert.status} />

            <div className="detail-workflow-item">
              <UserRound size={17} aria-hidden="true" />
              <div>
                <span>Người phụ trách</span>
                <strong>{alert.assignedToName || 'Chưa phân công'}</strong>
              </div>
            </div>
            <div className="detail-workflow-item">
              <Clock3 size={17} aria-hidden="true" />
              <div>
                <span>Ngày tạo cảnh báo</span>
                <strong>{formatDate(getCreatedAt(alert))}</strong>
              </div>
            </div>
            <div className="detail-workflow-item">
              <FilePlus2 size={17} aria-hidden="true" />
              <div>
                <span>Hồ sơ điều tra</span>
                <strong>{alert.caseId ? `Đã liên kết #${alert.caseId}` : 'Chưa tạo hồ sơ'}</strong>
              </div>
            </div>

            <AlertAssignmentPanel alert={alert} role={role} onChanged={refreshAlert} />

            {canCreateCase && (
              <div className="detail-action-area">
                {actionError && <p className="detail-action-error" role="alert">{actionError}</p>}
                <button className="detail-primary-action" type="button" onClick={handleCreateCase} disabled={creatingCase}>
                  <FilePlus2 size={17} aria-hidden="true" />
                  {creatingCase ? 'Đang tạo hồ sơ...' : 'Tạo hồ sơ điều tra'}
                </button>
                <p>Hồ sơ sẽ được mở dưới tài khoản điều tra viên đang phụ trách cảnh báo.</p>
              </div>
            )}

            {alert.caseId && (
              <Link className="detail-back-link" to={`/cases/${alert.caseId}`}>Xem hồ sơ điều tra →</Link>
            )}

            {role === 'Officer' && !isAssignedOfficer && !alert.caseId && !isClosed && (
              <p className="detail-permission-note">Chỉ điều tra viên được phân công mới có thể mở hồ sơ điều tra.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}