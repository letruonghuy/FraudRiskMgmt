import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flag,
  Info,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { ML_THRESHOLD, RiskBadge, money } from './ui';

function getOutcomeSummary(log) {
  const gt = log.groundTruth;
  const body = log.body;
  const alertId = body?.alertId || log.manualAlertId;
  const isDone = log.state === 'done' && (log.status === 201 || log.status === 200);

  if (!isDone) {
    return {
      tone: 'neutral',
      icon: Info,
      title: 'Giao dịch đang chờ hoặc chưa hoàn tất tiếp nhận',
      desc: 'Đợi hệ thống phản hồi kết quả chấm điểm để đối soát.',
    };
  }

  if (!gt) {
    return {
      tone: alertId ? 'warn' : 'ok',
      icon: alertId ? ShieldAlert : ShieldCheck,
      title: alertId
        ? `Giao dịch nhập tay đã kích hoạt cảnh báo #${alertId}`
        : 'Giao dịch nhập tay được đánh giá an toàn',
      desc: 'Dữ liệu khởi tạo thủ công không có nhãn lịch sử PaySim để đối chiếu.',
    };
  }

  if (gt.isFraud && !alertId) {
    return {
      tone: 'missed',
      icon: AlertTriangle,
      title: 'Gian lận thực tế bị mô hình AI bỏ lọt (False Negative)',
      desc: 'Dữ liệu lịch sử xác nhận đây là gian lận thật (isFraud = 1), nhưng điểm rủi ro AI nằm dưới ngưỡng 32% nên không tự động chặn.',
    };
  }

  if (!gt.isFraud && alertId) {
    return {
      tone: 'fp',
      icon: Info,
      title: 'Giao dịch hợp lệ bị cảnh báo nhầm (False Positive)',
      desc: 'Giao dịch thực tế hợp lệ (isFraud = 0), nhưng biến động số dư khiến mô hình đánh dấu rủi ro để nhân viên kiểm tra.',
    };
  }

  if (gt.isFraud && alertId) {
    return {
      tone: 'caught',
      icon: CheckCircle2,
      title: `Hệ thống phát hiện & tạo cảnh báo #${alertId} thành công`,
      desc: 'Kết quả đánh giá của hệ thống khớp chính xác với nhãn gian lận thực tế.',
    };
  }

  return {
    tone: 'ok',
    icon: ShieldCheck,
    title: 'Giao dịch hợp lệ — Thông qua bình thường',
    desc: 'Cả dữ liệu thực tế lẫn hệ thống đánh giá đều xác nhận giao dịch an toàn.',
  };
}

export default function TransactionDrawer({ log, onClose, onEscalate, escalating }) {
  if (!log) return null;

  const payload = log.payload || {};
  const displayTime = payload.occurredAt ? new Date(payload.occurredAt) : log.time;
  const src = payload.source || {};
  const dst = payload.destination || {};
  const gt = log.groundTruth;
  const body = log.body || {};

  const amount = Number(payload.amount ?? log.amount ?? 0);
  const srcBefore = Number(src.balanceBefore ?? 0);
  const srcAfter = Number(src.balanceAfter ?? 0);
  const dstBefore = Number(dst.balanceBefore ?? 0);
  const dstAfter = Number(dst.balanceAfter ?? 0);

  const errOrig = srcBefore - srcAfter - amount;
  const errDest = dstAfter - dstBefore - amount;

  const rawScore = body.scored
    ? Number(body.riskScore ?? 0)
    : Number(gt?.offlineScore ?? 0);
  const scorePct = Math.round(Math.max(0, Math.min(1, rawScore)) * 100);
  const thresholdPct = Math.round(ML_THRESHOLD * 100);

  const alertId = body.alertId || log.manualAlertId;
  const isMissedFraud = Boolean(gt?.isFraud && !alertId && log.state === 'done');
  const outcome = getOutcomeSummary(log);
  const OutcomeIcon = outcome.icon;

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Phiếu đối soát giao dịch"
      onClick={onClose}
    >
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">PHIẾU ĐỐI SOÁT GIAO DỊCH</span>
            <h3>{log.ref}</h3>
            <p className="drawer-sub">
              {displayTime.toLocaleTimeString('vi-VN')} · {displayTime.toLocaleDateString('vi-VN')} ·{' '}
              <strong>{log.type}</strong> · <strong>{money(amount)} VND</strong>
            </p>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Đóng phiếu đối soát"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* 1. Banner kết luận đối soát */}
          <div className={`verdict-banner verdict-${outcome.tone}`}>
            <OutcomeIcon size={20} />
            <div>
              <strong>{outcome.title}</strong>
              <p>{outcome.desc}</p>
            </div>
          </div>

          {/* 2. So sánh 2 cột: Thực tế vs Hệ thống */}
          <div className="compare-grid">
            <div className="compare-card">
              <span className="compare-label">
                <Scale size={13} /> Sự thật dữ liệu gốc
              </span>
              {gt ? (
                <>
                  <strong className={gt.isFraud ? 'text-bad' : 'text-ok'}>
                    {gt.isFraud ? 'Gian lận xác nhận (isFraud = 1)' : 'Giao dịch hợp lệ (isFraud = 0)'}
                  </strong>
                  <small>
                    Nguồn: Tập kiểm thử PaySim · Khung giờ {String(payload.hour ?? 0).padStart(2, '0')}:00
                  </small>
                </>
              ) : (
                <>
                  <strong>Khởi tạo thủ công (Nhập tay)</strong>
                  <small>Không thuộc bộ dữ liệu kiểm thử PaySim</small>
                </>
              )}
            </div>

            <div className="compare-card">
              <span className="compare-label">
                <ShieldAlert size={13} /> Kết quả hệ thống chấm
              </span>
              <div className="compare-system-row">
                <RiskBadge level={body.scored ? body.riskLevel : 'NoMl'} />
                <strong>{body.scored ? `${scorePct}%` : 'Không qua ML'}</strong>
              </div>
              <small>
                {alertId
                  ? `Đã sinh cảnh báo Alert #${alertId}`
                  : 'Không tự động sinh cảnh báo'}
              </small>
            </div>
          </div>

          {/* 3. Bằng chứng sổ cái Core Banking */}
          <section className="drawer-section">
            <h4>
              <Wallet size={15} /> Biến động số dư sổ cái (Minh chứng giao dịch)
            </h4>

            <div className="ledger-card">
              <div className="ledger-head">
                <span>Tài khoản nguồn (Chuyển / Rút)</span>
                <code>{src.accountNumber || '—'}</code>
              </div>
              {src.holderName && (
                <div className="ledger-holder">Chủ tài khoản: <strong>{src.holderName}</strong></div>
              )}
              <div className="ledger-flow">
                <div>
                  <span>Số dư trước</span>
                  <strong>{money(srcBefore)} đ</strong>
                </div>
                <ArrowRight size={16} className="muted" />
                <div>
                  <span>Số dư sau</span>
                  <strong>{money(srcAfter)} đ</strong>
                </div>
                <div>
                  <span>Lệch hạch toán</span>
                  <strong className={Math.abs(errOrig) > 0.01 ? 'text-warn' : 'text-ok'}>
                    {money(errOrig)} đ
                  </strong>
                </div>
              </div>
              {srcBefore === 0 && amount > 0 && (
                <div className="ledger-note">
                  Tài khoản nguồn có số dư ban đầu bằng <strong>0 đ</strong> nhưng vẫn phát sinh giao dịch{' '}
                  <strong>{money(amount)} đ</strong>.
                </div>
              )}
              {srcBefore > 0 && srcBefore < amount && (
                <div className="ledger-note">
                  Số dư ban đầu (<strong>{money(srcBefore)} đ</strong>) nhỏ hơn số tiền giao dịch (
                  <strong>{money(amount)} đ</strong>) và bị rút về 0 đ.
                </div>
              )}
            </div>

            <div className="ledger-card">
              <div className="ledger-head">
                <span>Tài khoản đích (Nhận tiền)</span>
                <code>{dst.accountNumber || '—'}</code>
              </div>
              <div className="ledger-flow">
                <div>
                  <span>Số dư trước</span>
                  <strong>{money(dstBefore)} đ</strong>
                </div>
                <ArrowRight size={16} className="muted" />
                <div>
                  <span>Số dư sau</span>
                  <strong>{money(dstAfter)} đ</strong>
                </div>
                <div>
                  <span>Lệch hạch toán</span>
                  <strong className={Math.abs(errDest) > 0.01 ? 'text-warn' : 'text-ok'}>
                    {money(errDest)} đ
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Giải thích trực quan ngưỡng AI */}
          {body.scored && (
            <section className="drawer-section">
              <h4>Đối chiếu điểm AI với ngưỡng chặn ({thresholdPct}%)</h4>
              <div className="threshold-box">
                <div className="threshold-labels">
                  <span>Điểm AI chấm: <strong>{scorePct}%</strong></span>
                  <span className="text-bad">Ngưỡng cảnh báo: <strong>{thresholdPct}%</strong></span>
                </div>
                <div className="threshold-track">
                  <div
                    className="threshold-fill"
                    style={{ width: `${scorePct}%` }}
                  />
                  <div
                    className="threshold-marker"
                    style={{ left: `${thresholdPct}%` }}
                    title={`Ngưỡng quyết định của mô hình: ${thresholdPct}%`}
                  />
                </div>
                {isMissedFraud && (
                  <p className="threshold-explain">
                    <strong>Vì sao AI bỏ sót ca này?</strong> Trong dữ liệu thực tế, các giao dịch có số dư nguồn bằng 0 hoặc lệch sổ cái dạng này trùng lắp đặc điểm với nhiều giao dịch bình thường. Để tránh báo nhầm hàng loạt khách hàng hợp lệ, mô hình chấm <strong>{scorePct}%</strong> (&lt; {thresholdPct}%) nên bỏ qua — minh chứng vì sao ngân hàng cần kết hợp <strong>quy trình hậu kiểm thủ công</strong>.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 5. Nút hành động hậu kiểm (Sẵn sàng nối Backend ở Phần 3) */}
          {!alertId && log.state === 'done' && (log.status === 201 || log.status === 200) && (
            <section className="drawer-section">
              <h4>Xử lý nghiệp vụ hậu kiểm</h4>
              <p className="drawer-hint">
                Khi khách hàng khiếu nại hoặc bộ phận giám sát phát hiện giao dịch lọt lưới, giao dịch viên có thể đẩy thủ công sang danh sách cảnh báo để điều tra.
              </p>
              <button
                type="button"
                className="detail-primary-action"
                disabled={escalating}
                onClick={() => onEscalate?.(log)}
              >
                <Flag size={16} />
                {escalating ? 'Đang tạo cảnh báo hậu kiểm...' : 'Đẩy sang hậu kiểm (Tạo Alert thủ công)'}
              </button>
              {log.escalateNote && (
                <p className="drawer-escalate-note">{log.escalateNote}</p>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}