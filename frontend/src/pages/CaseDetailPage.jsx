import { useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, Clock3, Play, RefreshCw, Send, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import { RiskBadge, RiskGauge, StatusBadge, formatDate, getErrorMessage } from './alertShared';
import {
  CASE_STATUS_CONFIG, CASE_STATUS_HINT, CaseStepper,
  PROPOSAL_ACTIONS, ProposalStatusBadge, getActionLabel,
} from './caseShared';

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

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((current) => current + 1);
  };

  // Chạy một thao tác ghi dữ liệu, rồi tải lại hồ sơ (không nháy màn hình loading)
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
  // Gửi duyệt cần ít nhất một đề xuất ĐANG CHỜ (đề xuất đã bị từ chối không còn tính),
  // nếu không hồ sơ sẽ kẹt ở "Chờ duyệt" vì Manager không còn gì để quyết định.
  const pendingCount = proposals.filter((p) => p.status === 'Pending').length;

  const isOwner = role === 'Officer' && user?.userId != null && String(caseData.openedBy) === String(user.userId);
  const isManager = role === 'Manager';
  const canStart = isOwner && (status === 'Open' || status === 'Rework');
  const canEditInvestigation = isOwner && status === 'Investigating';
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

  return (
    <div className="fade-in alert-detail-page">
      <Link className="detail-back-link" to="/cases">
        <ArrowLeft size={16} aria-hidden="true" /> Danh sách hồ sơ
      </Link>

      <header className="alert-detail-header">
        <div>
          <p className="detail-eyebrow">Hồ sơ điều tra</p>
          <h1 className="page-title">Hồ sơ #{caseData.caseId}</h1>
          <p className="page-subtitle">{caseData.customerName} · mở bởi {caseData.openByName}</p>
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
              <span className="detail-type-tag">{alerts.length}</span>
            </div>
            {alerts.length === 0 ? (
              <p className="case-empty">Hồ sơ chưa gắn cảnh báo nào.</p>
            ) : (
              alerts.map((alert) => (
                <div className="case-alert-row" key={alert.alertId}>
                  <Link className="cell-id alert-detail-link" to={`/alerts/${alert.alertId}`}>Cảnh báo #{alert.alertId}</Link>
                  <StatusBadge status={alert.status} />
                  {alert.riskLevel && <RiskBadge level={alert.riskLevel} />}
                  {alert.riskScore != null && <RiskGauge score={alert.riskScore} level={alert.riskLevel} />}
                </div>
              ))
            )}
          </section>

          <section className="detail-section" aria-labelledby="case-proposals-heading">
            <div className="detail-section-heading">
              <div>
                <p className="detail-eyebrow">Chờ Manager quyết định</p>
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
    </div>
  );
}

// key={id}: đổi sang hồ sơ khác thì toàn bộ state (form, thông báo...) được tạo mới
export default function CaseDetailPage() {
  const { id } = useParams();
  return <CaseDetailContent key={id} id={id} />;
}