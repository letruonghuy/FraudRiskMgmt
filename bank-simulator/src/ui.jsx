// =========================================================
// RISK CONFIGURATION
// =========================================================

export const ML_THRESHOLD = 0.32;

export const LEVELS = {
  Critical: {
    label: 'Nghiêm trọng',
    color: '#dc4545',
  },
  High: {
    label: 'Cao',
    color: '#e87532',
  },
  Medium: {
    label: 'Trung bình',
    color: '#d99a24',
  },
  Low: {
    label: 'Thấp',
    color: '#239b70',
  },
  Safe: {
    label: 'An toàn',
    color: '#64748b',
  },
  NoMl: {
    label: 'Không qua ML',
    color: '#94a3b8',
  },
};

export const LEVEL_ORDER = [
  'Critical',
  'High',
  'Medium',
  'Low',
  'Safe',
  'NoMl',
];

export const TAGS = {
  fraud_high: 'Gian lận rõ',
  fraud_mid: 'Gian lận điểm giữa',
  missed_fraud: 'Gian lận bị sót',
  false_positive: 'Báo nhầm',
  normal: 'Bình thường',
  rule_only: 'Loại khác',
};

// =========================================================
// FORMATTERS
// =========================================================

export const money = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return '—';

  return number.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  });
};

// =========================================================
// GROUND TRUTH & RECONCILIATION BADGES
// =========================================================

export function GroundTruthBadge({ groundTruth, mode }) {
  if (!groundTruth) {
    return <span className="gt-badge gt-manual">{mode || 'Nhập tay'}</span>;
  }

  return groundTruth.isFraud ? (
    <span
      className="gt-badge gt-fraud"
      title="Nhãn gốc từ tập dữ liệu kiểm thử PaySim (isFraud = 1)"
    >
      Thực tế: Gian lận
    </span>
  ) : (
    <span
      className="gt-badge gt-clean"
      title="Nhãn gốc từ tập dữ liệu kiểm thử PaySim (isFraud = 0)"
    >
      Thực tế: Hợp lệ
    </span>
  );
}

export function ReconcileBadge({ log }) {
  if (log.state !== 'done' || (log.status !== 201 && log.status !== 200)) {
    return null;
  }
  if (!log.groundTruth) return null;

  const isFraud = Boolean(log.groundTruth.isFraud);
  const hasAlert = Boolean(log.body?.alertId || log.manualAlertId);

  if (isFraud && !hasAlert) {
    return (
      <span
        className="reconcile-badge reconcile-missed"
        title="Giao dịch gian lận thật nhưng AI chấm dưới ngưỡng nên không tự động cảnh báo. Bấm vào dòng để xem đối soát."
      >
        ⚠️ AI bỏ lọt
      </span>
    );
  }

  if (!isFraud && hasAlert) {
    return (
      <span
        className="reconcile-badge reconcile-fp"
        title="Giao dịch hợp lệ nhưng bị hệ thống gắn cảnh báo nhầm (False Positive)"
      >
        ℹ️ Báo nhầm
      </span>
    );
  }

  return null;
}

// =========================================================
// RISK BADGE
// =========================================================

export function RiskBadge({ level }) {
  const config = LEVELS[level] || {
    label: level || 'Chưa xác định',
    color: '#94a3b8',
  };

  return (
    <span
      className="badge risk-badge"
      style={{
        color: config.color,
        background: `${config.color}15`,
        borderColor: `${config.color}45`,
      }}
      title={`Mức rủi ro: ${config.label}`}
    >
      <span
        className="risk-badge-dot"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}

// =========================================================
// RISK SCORE GAUGE
// =========================================================

export function RiskGauge({ score, level }) {
  const numericScore = Number(score);
  const safeScore = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(1, numericScore))
    : 0;

  const percentage = Math.round(safeScore * 100);
  const color = (LEVELS[level] || LEVELS.Safe).color;

  return (
    <div
      className="risk-gauge"
      title={`Điểm rủi ro: ${percentage}%`}
    >
      <div className="risk-gauge-track">
        <div
          className="risk-gauge-fill"
          style={{
            width: `${percentage}%`,
            background: color,
          }}
        />
      </div>

      <b>{percentage}%</b>
    </div>
  );
}

// =========================================================
// API RESPONSE STATUS
// =========================================================

export function StatusBadge({ log }) {
  if (log.state === 'pending') {
    return (
      <span className="badge badge-muted">
        <span className="status-pulse" />
        {log.note ? 'Đang thử lại' : 'Đang gửi'}
      </span>
    );
  }

  const { status } = log;

  if (status === 201) {
    return (
      <span
        className="badge badge-ok"
        title="Giao dịch đã được tiếp nhận và xử lý"
      >
        201 · Mới
      </span>
    );
  }

  if (status === 200) {
    return (
      <span
        className="badge badge-info"
        title="Mã tham chiếu đã tồn tại, không ghi lại giao dịch"
      >
        200 · Trùng
      </span>
    );
  }

  if (status === 0) {
    return (
      <span className="badge badge-bad">
        Mất kết nối
      </span>
    );
  }

  return (
    <span className="badge badge-bad">
      HTTP {status}
    </span>
  );
}