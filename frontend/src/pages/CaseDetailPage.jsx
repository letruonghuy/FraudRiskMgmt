import { useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, Clock3, GitMerge, Play, RefreshCw, Send, Unlink, UserRound, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import { RiskBadge, RiskGauge, formatCurrency, formatDate, getErrorMessage } from './alertShared';
import { CASE_STATUS_CONFIG, CASE_STATUS_HINT, PROPOSAL_ACTIONS, getActionLabel } from './caseUtils';
import { CaseStepper, ProposalStatusBadge } from './caseShared';

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

const MERGE_PATTERN_CONFIG = {
  SameCustomer: {
    label: 'Gộp theo cùng khách hàng',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  SameDestination: {
    label: 'Gộp theo tài khoản nhận chung (Money Mule)',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  MoneyTrail: {
    label: 'Gộp theo chuỗi dòng tiền (Layering)',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
};

const extractMessage = (response, fallback) => {
  if (typeof response?.data === 'string' && response.data) return response.data;
  return response?.data?.message || fallback;
};

// Form quyết định của Manager cho một đề xuất đang chờ
function ProposalDecision({ proposal, busy, onDecide }) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const inputId = `decision-${proposal.caseActionProposalId}`;
  const disabled = Boolean(busy) || trimmed.length === 0;

  return (
    <div className="case-form">
      <label htmlFor={inputId}>Ghi chú quyết định (bắt buộc)</label>
      <textarea id={inputId} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
      <div className="case-form-actions">
        <button type="button" className="detail-primary-action" disabled={disabled} onClick={() => onDecide(proposal, 'approve', trimmed)}>
          Phê duyệt
        </button>
        <button type="button" className="detail-danger-action" disabled={disabled} onClick={() => onDecide(proposal, 'reject', trimmed)}>
          Từ chối
        </button>
      </div>
    </div>
  );
}

function CaseDetailContent({ id }) {
  const { role, user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [noteText, setNoteText] = useState('');
  const [proposalAction, setProposalAction] = useState('');
  const [proposalReason, setProposalReason] = useState('');

  // State gộp thêm alert vào Case
  const [candidateAlerts, setCandidateAlerts] = useState([]);
  const [selectedAlertToAdd, setSelectedAlertToAdd] = useState('');
  const [addAlertReason, setAddAlertReason] = useState('');

  // State tách (unmerge) alert khỏi Case
  const [unmergeTarget, setUnmergeTarget] = useState(null);
  const [unmergeReason, setUnmergeReason] = useState('');

  useEffect(() => {
    let isActive = true;

    axiosClient.get(`/Case/${id}`)
      .then((res) => {
        if (isActive) {
          setCaseData(res.data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (isActive) setLoadError({ message: getErrorMessage(err), notFound: err.response?.status === 404 });
      })
      .finally(() => { if (isActive) setLoading(false); });

    return () => { isActive = false; };
  }, [id, reloadKey]);

  useEffect(() => {
    const canAttach = role === 'Officer' &&
      caseData &&
      user?.userId != null &&
      String(caseData.openedBy) === String(user.userId) &&
      ['Open', 'Investigating', 'Rework'].includes(caseData.status);

    if (!canAttach) {
      setCandidateAlerts([]);
      return undefined;
    }

    let isActive = true;
    axiosClient.get(`/Case/${id}/candidate-alerts`)
      .then((res) => {
        if (isActive && Array.isArray(res.data)) setCandidateAlerts(res.data);
      })
      .catch(() => { /* danh sách phụ, bỏ qua nếu lỗi */ });

    return () => { isActive = false; };
  }, [id, role, user?.userId, caseData]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((current) => current + 1);
  };

  const runAction = async (key, request, fallbackMessage) => {
    if (busy) return false;
    setBusy(key);
    setMessage(null);
    try {
      const response = await request();
      setMessage({ type: 'success', text: extractMessage(response, fallbackMessage) });
      setReloadKey((current) => current + 1);
      return true;
    } catch (requestError) {
      setMessage({ type: 'error', text: getErrorMessage(requestError) });
      return false;
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="alert-detail-state" role="status" aria-live="polite">
        <div className="spin" aria-hidden="true" />
        <p>Đang tải hồ sơ điều tra...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="alert-detail-state" role="alert">
        <CircleAlert size={28} aria-hidden="true" />
        <h1>{loadError?.notFound ? 'Không tìm thấy hồ sơ' : 'Không tải được hồ sơ'}</h1>
        <p>{loadError?.notFound ? 'Hồ sơ không tồn tại hoặc bạn không có quyền xem hồ sơ này.' : loadError?.message}</p>
        <div className="alert-detail-state-actions">
          {!loadError?.notFound && (
            <button className="sort-toggle" type="button" onClick={handleRetry}>
              <RefreshCw size={15} aria-hidden="true" /> Thử lại
            </button>
          )}
          <Link className="detail-back-link" to="/cases">Về danh sách hồ sơ</Link>
        </div>
      </div>
    );
  }

  const status = caseData.status;
  const statusCfg = CASE_STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };
  const alerts = caseData.alerts ?? [];
  const notes = caseData.notes ?? [];
  const proposals = caseData.proposals ?? [];
  const patternCfg = MERGE_PATTERN_CONFIG[caseData.mergePattern] || MERGE_PATTERN_CONFIG.SameCustomer;
  const totalAlertAmount = alerts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const pendingCount = proposals.filter((p) => p.status === 'Pending').length;
  const approvedCount = proposals.filter((p) => p.status === 'Approved').length;
  const rejectedCount = proposals.filter((p) => p.status === 'Rejected').length;
  const isFinished = status === 'Approved' || status === 'Closed' || status === 'FalsePositive';

  let proposalsEyebrow = 'Đề xuất của điều tra viên';
  if (proposals.length > 0) {
    if (pendingCount > 0) {
      proposalsEyebrow = status === 'PendingApproval'
        ? `Chờ Manager quyết định (${pendingCount})`
        : 'Chưa gửi Manager quyết định';
    } else if (isFinished) {
      proposalsEyebrow = `Đã quyết định xong · ${approvedCount} duyệt, ${rejectedCount} từ chối`;
    } else if (rejectedCount > 0) {
      proposalsEyebrow = `Cần đề xuất mới · ${rejectedCount} đề xuất bị từ chối`;
    }
  }

  const isOwner = role === 'Officer' && user?.userId != null && String(caseData.openedBy) === String(user.userId);
  const isManager = role === 'Manager';
  const canStart = isOwner && (status === 'Open' || status === 'Rework');
  const canEditInvestigation = isOwner && status === 'Investigating';
  const canManageAlerts = isOwner && ['Open', 'Investigating', 'Rework'].includes(status);
  const canDecide = isManager && status === 'PendingApproval';

  const lastRejection = status === 'Rework'
    ? [...proposals].filter((p) => p.status === 'Rejected').sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt))[0]
    : null;

  const handleStart = () =>
    runAction('start', () => axiosClient.put(`/Case/${id}/investigate`), 'Hồ sơ đang được điều tra.');

  const handleSubmitForApproval = () => {
    if (!window.confirm('Gửi hồ sơ cho Manager phê duyệt? Sau khi gửi bạn không thể thêm ghi chú hay đề xuất nữa.')) return;
    runAction('submit', () => axiosClient.put(`/Case/${id}/submit-for-approval`), 'Đã gửi hồ sơ cho Manager phê duyệt.');
  };

  const handleAddNote = async (event) => {
    event.preventDefault();
    const content = noteText.trim();
    if (!content) return;
    const ok = await runAction('note', () => axiosClient.post(`/Case/${id}/notes`, { content }), 'Đã thêm ghi chú.');
    if (ok) setNoteText('');
  };

  const handleAddProposal = async (event) => {
    event.preventDefault();
    const reason = proposalReason.trim();
    if (!proposalAction || !reason) return;
    const ok = await runAction(
      'proposal',
      () => axiosClient.post(`/Case/${id}/proposals`, { action: proposalAction, reason }),
      'Đã thêm đề xuất hành động.'
    );
    if (ok) {
      setProposalAction('');
      setProposalReason('');
    }
  };

  const handleDecision = (proposal, decision, decisionNote) => {
    if (decision === 'reject' &&
        !window.confirm('Từ chối đề xuất này sẽ chuyển cả hồ sơ về trạng thái "Cần làm lại". Tiếp tục?')) {
      return;
    }
    runAction(
      `decide-${proposal.caseActionProposalId}`,
      () => axiosClient.put(`/Case/${id}/proposals/${proposal.caseActionProposalId}/${decision}`, { decisionNote }),
      decision === 'approve' ? 'Đã phê duyệt đề xuất.' : 'Đã từ chối đề xuất.'
    );
  };

  const handleAddAlertToCase = async (event) => {
    event.preventDefault();
    const trimmedReason = addAlertReason.trim();
    if (!selectedAlertToAdd || trimmedReason.length < MIN_REASON_LENGTH || busy) return;
    const ok = await runAction(
      'add-alert',
      () => axiosClient.post(`/Case/${id}/alerts`, {
        alertId: Number(selectedAlertToAdd),
        reason: trimmedReason,
      }),
      'Đã gộp thêm cảnh báo vào hồ sơ.'
    );
    if (ok) {
      setSelectedAlertToAdd('');
      setAddAlertReason('');
    }
  };

  const handleConfirmUnmerge = async (event) => {
    event.preventDefault();
    const trimmedReason = unmergeReason.trim();
    if (!unmergeTarget || trimmedReason.length < MIN_REASON_LENGTH || busy) return;

    await runAction(
      'unmerge-alert',
      () => axiosClient.post(`/Case/${id}/alerts/${unmergeTarget.alertId}/unmerge`, {
        reason: trimmedReason,
      }),
      `Đã tách cảnh báo #${unmergeTarget.alertId} khỏi hồ sơ.`
    );

    setUnmergeTarget(null);
    setUnmergeReason('');
  };

  return (
    <div className="fade-in alert-detail-page">
      <Link className="detail-back-link" to="/cases">
        <ArrowLeft size={16} aria-hidden="true" /> Danh sách hồ sơ
      </Link>

      <header className="alert-detail-header">
        <div>
          <p className="detail-eyebrow">Hồ sơ điều tra</p>
          <h1 className="page-title">Hồ sơ #{caseData.caseId}</h1>
          <p className="page-subtitle">
            Chủ thể chính: {caseData.customerName}
            {caseData.distinctCustomerCount > 1 && ` · Mạng lưới liên quan: ${caseData.distinctCustomerCount} khách hàng`}
            {' '}· mở bởi {caseData.openByName}
          </p>
          {alerts.length > 1 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: patternCfg.color,
                  backgroundColor: patternCfg.bg,
                  border: `1px solid ${patternCfg.border}`,
                }}
              >
                <GitMerge size={13} aria-hidden="true" />
                {patternCfg.label}
              </span>
              {caseData.correlationKey && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Khóa liên kết: <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{caseData.correlationKey}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <span className="detail-status-badge" style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, borderColor: statusCfg.border }}>
          {statusCfg.label}
        </span>
      </header>

      <div className="alert-detail-grid">
        <div className="alert-detail-main">
          <section className="detail-section" aria-labelledby="case-progress-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Quy trình</p>
                <h2 id="case-progress-heading">Tiến trình hồ sơ</h2>
              </div>
            </div>
            <CaseStepper status={status} />
            {lastRejection && (
              <p className="case-message warn" role="status">
                <strong>Lý do bị từ chối:</strong> {lastRejection.decisionNote || 'Không có ghi chú.'}
                {lastRejection.decidedByName ? ` — ${lastRejection.decidedByName}` : ''}
              </p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="case-alerts-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Nguồn của hồ sơ</p>
                <h2 id="case-alerts-heading">Cảnh báo liên quan</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {alerts.length > 1 && totalAlertAmount > 0 && (
                  <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
                    Tổng: {formatCurrency(totalAlertAmount)}
                  </span>
                )}
                <span className="detail-type-tag">{alerts.length}</span>
              </div>
            </div>

            {alerts.length === 0 ? (
              <p className="case-empty">Hồ sơ chưa gắn cảnh báo nào.</p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: alerts.length > 4 ? 430 : 'none',
                  overflowY: alerts.length > 4 ? 'auto' : 'visible',
                  paddingRight: alerts.length > 4 ? 4 : 0,
                }}
              >
                {alerts.map((alert) => (
                  <div
                    key={alert.alertId}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(15, 23, 42, 0.45)',
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                    }}
                  >
                    {/* Hàng 1: Định danh bên trái — Số tiền & Nút tách bên phải */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Link
                          className="cell-id alert-detail-link"
                          to={`/alerts/${alert.alertId}`}
                          style={{ fontWeight: 700 }}
                        >
                          Cảnh báo #{alert.alertId}
                        </Link>
                        {alert.customerName && (
                          <>
                            <span style={{ color: '#475569' }}>•</span>
                            <span style={{ fontSize: 13.5, fontWeight: 500, color: '#e2e8f0' }}>
                              {alert.customerName}
                            </span>
                          </>
                        )}
                        {alert.transactionTime && (
                          <span style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            ({formatDate(alert.transactionTime)})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {alert.amount > 0 && (
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#f8fafc',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatCurrency(alert.amount)}
                          </span>
                        )}

                        {canManageAlerts && alerts.length > 1 && (
                          <button
                            type="button"
                            className="sort-toggle"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setUnmergeTarget(alert);
                              setUnmergeReason('');
                            }}
                            title="Tách cảnh báo này khỏi hồ sơ"
                            style={{ padding: '4px 8px', fontSize: 12, color: '#fca5a5' }}
                          >
                            <Unlink size={13} aria-hidden="true" /> Tách
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Đường phân cách nhẹ */}
                    <div style={{ height: 1, backgroundColor: 'rgba(148, 163, 184, 0.08)' }} />

                    {/* Hàng 2: Luồng tài khoản cỡ lớn hơn — Mức độ & Điểm rủi ro bên phải */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px 12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {(alert.nameOrig || alert.nameDest) ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            fontSize: 13.5,
                          }}
                        >
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              backgroundColor: 'rgba(30, 41, 59, 0.9)',
                              border: '1px solid rgba(148, 163, 184, 0.18)',
                              color: '#e2e8f0',
                              fontFamily: 'monospace',
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ color: '#94a3b8', fontFamily: 'inherit', fontWeight: 400 }}>Nguồn: </span>
                            {alert.nameOrig || '?'}
                          </span>
                          <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 14 }}>→</span>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              backgroundColor: 'rgba(30, 41, 59, 0.9)',
                              border: '1px solid rgba(148, 163, 184, 0.18)',
                              color: '#e2e8f0',
                              fontFamily: 'monospace',
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ color: '#94a3b8', fontFamily: 'inherit', fontWeight: 400 }}>Đích: </span>
                            {alert.nameDest || '?'}
                          </span>
                        </div>
                      ) : (
                        <span />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
                        {alert.riskLevel && <RiskBadge level={alert.riskLevel} />}
                        {alert.riskScore != null && <RiskGauge score={alert.riskScore} level={alert.riskLevel} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManageAlerts && candidateAlerts.length > 0 && (
              <form className="case-form" onSubmit={handleAddAlertToCase} style={{ marginTop: 14 }}>
                <label htmlFor="merge-candidate-alert">
                  Gộp thêm cảnh báo liên quan ({candidateAlerts.length} khả dụng)
                </label>
                <select
                  id="merge-candidate-alert"
                  className="select-dark"
                  style={{ width: '100%' }}
                  value={selectedAlertToAdd}
                  onChange={(e) => setSelectedAlertToAdd(e.target.value)}
                  disabled={Boolean(busy)}
                >
                  <option value="">— Chọn cảnh báo để gộp —</option>
                  {candidateAlerts.map((item) => (
                    <option key={item.alertId} value={item.alertId}>
                      #{item.alertId} · {item.customerName} · {Number(item.amount || 0).toLocaleString('vi-VN')} ₫ · {item.matchReason}
                    </option>
                  ))}
                </select>

                {selectedAlertToAdd && (
                  <>
                    <label htmlFor="add-alert-reason">
                      Lý do gộp thêm vào hồ sơ (bắt buộc, {MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} ký tự)
                    </label>
                    <textarea
                      id="add-alert-reason"
                      rows={2}
                      maxLength={MAX_REASON_LENGTH}
                      placeholder="Ví dụ: Giao dịch cùng tài khoản nhận trong chuỗi tẩu tán đang điều tra..."
                      value={addAlertReason}
                      onChange={(e) => setAddAlertReason(e.target.value)}
                      disabled={Boolean(busy)}
                    />
                  </>
                )}

                <div className="case-form-actions">
                  <button
                    type="submit"
                    className="detail-primary-action"
                    disabled={Boolean(busy) || !selectedAlertToAdd || addAlertReason.trim().length < MIN_REASON_LENGTH}
                  >
                    {busy === 'add-alert' ? 'Đang gộp...' : 'Gộp vào hồ sơ'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="detail-section" aria-labelledby="case-proposals-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">{proposalsEyebrow}</p>
                <h2 id="case-proposals-heading">Đề xuất hành động</h2>
              </div>
              <span className="detail-type-tag">{proposals.length}</span>
            </div>

            {proposals.length === 0 ? (
              <p className="case-empty">Chưa có đề xuất nào.</p>
            ) : (
              <ul className="case-item-list">
                {proposals.map((proposal) => (
                  <li className="case-item" key={proposal.caseActionProposalId}>
                    <div className="case-item-head">
                      <span className="case-item-title">{getActionLabel(proposal.action)}</span>
                      <ProposalStatusBadge status={proposal.status} />
                    </div>
                    <p className="case-item-body">{proposal.reason}</p>
                    <p className="case-item-meta">
                      {proposal.proposedByName} · {formatDate(proposal.createdAt)}
                    </p>
                    {proposal.decidedAt && (
                      <div className={`case-decision ${proposal.status === 'Approved' ? 'approved' : 'rejected'}`}>
                        <strong>{proposal.decidedByName || 'Manager'}</strong> · {formatDate(proposal.decidedAt)}
                        <p className="case-item-body">{proposal.decisionNote}</p>
                      </div>
                    )}
                    {canDecide && proposal.status === 'Pending' && (
                      <ProposalDecision proposal={proposal} busy={busy} onDecide={handleDecision} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isFinished && rejectedCount > 0 && (
              <p className="case-message info" role="status">
                Hồ sơ hoàn tất với {approvedCount} đề xuất được duyệt có hiệu lực. Không được thực hiện:{' '}
                {proposals.filter((p) => p.status === 'Rejected').map((p) => getActionLabel(p.action)).join(', ')} (bị từ chối).
              </p>
            )}
            {canEditInvestigation && (
              <form className="case-form" onSubmit={handleAddProposal}>
                <label htmlFor="proposal-action">Hành động đề xuất</label>
                <select id="proposal-action" value={proposalAction} onChange={(event) => setProposalAction(event.target.value)}>
                  <option value="">Chọn hành động…</option>
                  {PROPOSAL_ACTIONS.map((action) => (
                    <option key={action.value} value={action.value}>{action.label}</option>
                  ))}
                </select>
                <label htmlFor="proposal-reason">Lý do</label>
                <textarea id="proposal-reason" value={proposalReason} maxLength={2000} onChange={(event) => setProposalReason(event.target.value)} />
                <div className="case-form-actions">
                  <button
                    type="submit"
                    className="detail-primary-action"
                    disabled={Boolean(busy) || !proposalAction || proposalReason.trim().length === 0}
                  >
                    {busy === 'proposal' ? 'Đang thêm...' : 'Thêm đề xuất'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="detail-section" aria-labelledby="case-notes-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Nhật ký điều tra</p>
                <h2 id="case-notes-heading">Ghi chú điều tra</h2>
              </div>
              <span className="detail-type-tag">{notes.length}</span>
            </div>

            {notes.length === 0 ? (
              <p className="case-empty">Chưa có ghi chú nào.</p>
            ) : (
              <ul className="case-item-list">
                {notes.map((note) => (
                  <li className="case-item" key={note.investigationNoteId}>
                    <p className="case-item-body">{note.content}</p>
                    <p className="case-item-meta">{note.authorName} · {formatDate(note.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}

            {canEditInvestigation && (
              <form className="case-form" onSubmit={handleAddNote}>
                <label htmlFor="note-content">Thêm ghi chú</label>
                <textarea id="note-content" value={noteText} maxLength={2000} onChange={(event) => setNoteText(event.target.value)} />
                <div className="case-form-actions">
                  <button type="submit" className="detail-primary-action" disabled={Boolean(busy) || noteText.trim().length === 0}>
                    {busy === 'note' ? 'Đang thêm...' : 'Thêm ghi chú'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="alert-detail-aside" aria-label="Thông tin xử lý hồ sơ">
          <section className="detail-workflow-panel" aria-labelledby="case-workflow-heading">
            <div className="detail-section-heading compact">
              <div>
                <p className="detail-eyebrow">Theo dõi</p>
                <h2 id="case-workflow-heading">Xử lý hồ sơ</h2>
              </div>
            </div>

            <div className="detail-workflow-item">
              <UserRound size={17} aria-hidden="true" />
              <div>
                <span>Người mở hồ sơ</span>
                <strong>{caseData.openByName || '—'}</strong>
              </div>
            </div>
            <div className="detail-workflow-item">
              <Clock3 size={17} aria-hidden="true" />
              <div>
                <span>Ngày mở</span>
                <strong>{formatDate(caseData.createdAt)}</strong>
              </div>
            </div>
            <div className="detail-workflow-item">
              <Clock3 size={17} aria-hidden="true" />
              <div>
                <span>Ngày đóng</span>
                <strong>{caseData.closedAt ? formatDate(caseData.closedAt) : 'Chưa đóng'}</strong>
              </div>
            </div>

            <div className="detail-action-area">
              {message && (
                <p className={`case-message ${message.type === 'error' ? 'error' : 'success'}`} role={message.type === 'error' ? 'alert' : 'status'}>
                  {message.text}
                </p>
              )}

              {CASE_STATUS_HINT[status] && <p>{CASE_STATUS_HINT[status]}</p>}
              {canDecide && <p>Quyết định từng đề xuất ở mục “Đề xuất hành động”.</p>}

              {canStart && (
                <button className="detail-primary-action" type="button" disabled={Boolean(busy)} onClick={handleStart}>
                  <Play size={17} aria-hidden="true" />
                  {busy === 'start' ? 'Đang xử lý...' : status === 'Rework' ? 'Điều tra lại' : 'Bắt đầu điều tra'}
                </button>
              )}

              {canEditInvestigation && (
                <>
                  <button
                    className="detail-primary-action"
                    type="button"
                    disabled={Boolean(busy) || pendingCount === 0}
                    onClick={handleSubmitForApproval}
                  >
                    <Send size={17} aria-hidden="true" />
                    {busy === 'submit' ? 'Đang gửi...' : 'Gửi phê duyệt'}
                  </button>
                  {pendingCount === 0 && (
                    <p>
                      Cần ít nhất một đề xuất đang chờ quyết định trước khi gửi phê duyệt
                      {proposals.length > 0 ? ' (đề xuất đã bị từ chối cần được thay bằng đề xuất mới).' : '.'}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Modal xác nhận tách cảnh báo khỏi hồ sơ */}
      {unmergeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unmerge-modal-title"
          onClick={() => { if (!busy) setUnmergeTarget(null); }}
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
              maxWidth: 480,
              backgroundColor: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="detail-eyebrow">Điều chỉnh phạm vi hồ sơ</p>
                <h2 id="unmerge-modal-title" style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc' }}>
                  Tách Cảnh báo #{unmergeTarget.alertId} khỏi hồ sơ
                </h2>
              </div>
              <button
                type="button"
                className="sort-toggle"
                onClick={() => setUnmergeTarget(null)}
                disabled={Boolean(busy)}
                aria-label="Đóng"
                style={{ padding: '6px 8px' }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <p style={{ marginTop: 10, fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              Cảnh báo <strong>#{unmergeTarget.alertId}</strong> ({unmergeTarget.customerName} · {formatCurrency(unmergeTarget.amount)}) sẽ được gỡ khỏi Hồ sơ #{caseData.caseId} và trả về trạng thái <strong>Đã phân công (Assigned)</strong>.
            </p>

            <form className="case-form" onSubmit={handleConfirmUnmerge} style={{ marginTop: 12 }}>
              <label htmlFor="unmerge-reason">
                Lý do tách cảnh báo (bắt buộc, {MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} ký tự)
              </label>
              <textarea
                id="unmerge-reason"
                rows={3}
                maxLength={MAX_REASON_LENGTH}
                placeholder="Ví dụ: Giao dịch này đã xác minh là thanh toán định kỳ hợp lệ, không thuộc chuỗi gian lận đang điều tra..."
                value={unmergeReason}
                onChange={(e) => setUnmergeReason(e.target.value)}
                disabled={Boolean(busy)}
                required
              />
              <div className="case-form-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={() => setUnmergeTarget(null)}
                  disabled={Boolean(busy)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="detail-danger-action"
                  disabled={Boolean(busy) || unmergeReason.trim().length < MIN_REASON_LENGTH}
                >
                  <Unlink size={14} aria-hidden="true" />
                  {busy === 'unmerge-alert' ? 'Đang tách...' : 'Xác nhận tách cảnh báo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  return <CaseDetailContent key={id} id={id} />;
}