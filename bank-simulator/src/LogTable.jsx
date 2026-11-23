import { Trash2, ReceiptText, Clock3, CircleHelp, ChevronRight } from 'lucide-react';

import {
  GroundTruthBadge,
  ReconcileBadge,
  RiskBadge,
  RiskGauge,
  StatusBadge,
  money,
} from './ui';

function ResultCell({ log }) {
  if (log.state === 'pending') {
    return (
      <td className="result-cell muted">
        <span className="table-processing">
          <span className="processing-dot" />
          {log.note || 'Đang chờ phản hồi...'}
        </span>
      </td>
    );
  }

  const body = log.body;

  if (log.status === 201 || log.status === 200) {
    const alertId = body?.alertId || log.manualAlertId;

    if (!body?.scored) {
      return (
        <td className="result-cell">
          <div className="result-top">
            <div className="result-badges">
              <RiskBadge level="NoMl" />
              <span className="result-note">Không áp dụng</span>
              <ReconcileBadge log={log} />
            </div>
            <ChevronRight size={15} className="row-chevron" />
          </div>
        </td>
      );
    }

    return (
      <td className="result-cell">
        <div className="result-top">
          <div className="result-badges">
            <RiskBadge level={body.riskLevel} />
            {alertId ? (
              <span className="result-alert">Alert #{alertId}</span>
            ) : (
              <span className="result-note">Không cảnh báo</span>
            )}
            <ReconcileBadge log={log} />
          </div>
          <ChevronRight size={15} className="row-chevron" />
        </div>
        <RiskGauge score={body.riskScore} level={body.riskLevel} />
      </td>
    );
  }

  const detail =
    body?.errors?.[0] ||
    body?.message ||
    (log.status === 0 ? 'Không kết nối được máy chủ' : 'Lỗi không xác định');

  return (
    <td className="result-cell cell-err">
      {detail}
      {log.attempts > 1 ? ` (đã thử ${log.attempts} lần)` : ''}
    </td>
  );
}

export default function LogTable({ logs, hideTags, setHideTags, onClear, onSelectLog }) {
  return (
    <section className="detail-section log-section" aria-label="Nhật ký giao dịch">
      <div className="log-header">
        <div className="log-title-copy">
          <div className="log-title-icon">
            <ReceiptText size={18} />
          </div>
          <div>
            <h2>Nhật ký giao dịch</h2>
            <p>Bấm vào từng dòng để mở phiếu đối soát số dư và điểm AI chi tiết.</p>
          </div>
        </div>

        <div className="log-header-actions">
          <label className={`sort-toggle ${hideTags ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={hideTags}
              onChange={(event) => setHideTags(event.target.checked)}
            />
            Ẩn nhãn thực tế
          </label>

          <button
            type="button"
            className="btn-ghost"
            onClick={onClear}
            disabled={!logs.length}
          >
            <Trash2 size={14} />
            Xóa nhật ký
          </button>
        </div>
      </div>

      {!logs.length ? (
        <div className="empty-state log-empty">
          <div className="empty-state-icon">
            <ReceiptText size={25} />
          </div>
          <strong>Chưa có giao dịch nào</strong>
          <span>
            Chọn một kịch bản, tạo giao dịch thủ công hoặc khởi chạy luồng tự động để
            bắt đầu.
          </span>
        </div>
      ) : (
        <div
          className="table-scroll log-table-scroll"
          role="region"
          aria-label="Bảng nhật ký giao dịch"
          tabIndex={0}
        >
          <table className="data-table">
            <colgroup>
              <col className="col-time" />
              <col className="col-ref" />
              <col className="col-type" />
              <col className="col-amount" />
              <col className="col-status" />
              <col className="col-result" />
            </colgroup>

            <thead>
              <tr>
                <th className="c-time">Thời gian</th>
                <th>Mã tham chiếu / Chủ TK</th>
                <th>Loại / Thực tế</th>
                <th className="num">Số tiền (VND)</th>
                <th className="c-status">Tiếp nhận</th>
                <th>Hệ thống đánh giá</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => {
                const isMissed =
                  log.state === 'done' &&
                  log.groundTruth?.isFraud &&
                  !(log.body?.alertId || log.manualAlertId);

                const hasAlert = Boolean(log.body?.alertId || log.manualAlertId);

                const displayTime = log.payload?.occurredAt
                  ? new Date(log.payload.occurredAt)
                  : log.time;

                return (
                  <tr
                    key={log.id}
                    className={`log-row-clickable ${
                      isMissed ? 'row-missed' : hasAlert ? 'row-alert' : ''
                    }`}
                    onClick={() => onSelectLog?.(log)}
                    title="Bấm để mở phiếu đối soát chi tiết"
                  >
                    <td className="c-time">
                      <div className="cell-time">
                        <Clock3 size={12} />
                        {displayTime.toLocaleTimeString('vi-VN')}
                      </div>
                      <div className="cell-sub">{displayTime.toLocaleDateString('vi-VN')}</div>
                    </td>

                    <td>
                      <div className="cell-id" title={log.ref}>
                        {log.ref}
                      </div>
                      <div className="cell-sub" title={log.customer}>
                        {log.customer || 'Chưa có chủ tài khoản'}
                      </div>
                    </td>

                    <td>
                      <span className="transaction-type">{log.type}</span>
                      {!hideTags && (
                        <div className="cell-gt-wrap">
                          <GroundTruthBadge groundTruth={log.groundTruth} mode={log.mode} />
                        </div>
                      )}
                    </td>

                    <td className="num amount-cell">{money(log.amount)}</td>

                    <td className="c-status">
                      <StatusBadge log={log} />
                      {log.ms != null && (
                        <div className="cell-sub">{log.ms.toLocaleString('vi-VN')} ms</div>
                      )}
                    </td>

                    <ResultCell log={log} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="log-footer">
        <span>
          <CircleHelp size={13} />
          Nhãn thực tế chỉ hiển thị trên Simulator để đối chiếu · Backend chỉ nhận dữ liệu giao dịch thô
        </span>
      </div>
    </section>
  );
}