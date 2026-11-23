import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Cpu,
  Database, History, RefreshCw, Save, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { formatDate, getErrorMessage } from './alertShared';

const MIN_REASON_LEN = 5;
const MAX_REASON_LEN = 500;

const REASON_PRESETS = [
  'Điều chỉnh độ nhạy cảnh báo theo lưu lượng giao dịch thực tế',
  'Giảm cảnh báo nhiễu cho nhóm giao dịch giá trị nhỏ',
  'Siết chặt ngưỡng giám sát cao điểm cuối tháng',
];

const RISK_LEVEL_META = [
  { key: 'critical', label: 'Nghiêm trọng (Critical)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.14)' },
  { key: 'high', label: 'Cao (High)', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.14)' },
  { key: 'medium', label: 'Trung bình (Medium)', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)' },
  { key: 'low', label: 'Thấp (Low)', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.14)' },
];

const MODAL_STYLE = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92vh',
    overflowY: 'auto',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 14,
    padding: 22,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
  },
};

function formatNumberDots(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return Math.round(num).toLocaleString('vi-VN');
}

function parseDigitsAmount(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits);
}

function formatPct(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${(num * 100).toFixed(digits).replace('.', ',')}%`;
}

export default function AdminRiskConfigPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [savedPolicy, setSavedPolicy] = useState(null);
  const [mlHealth, setMlHealth] = useState(null);
  const [pingingMl, setPingingMl] = useState(false);
  const [modelMetadata, setModelMetadata] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [showAllBenchmarks, setShowAllBenchmarks] = useState(false);

  // Draft values
  const [alertThreshold, setAlertThreshold] = useState(0.32);
  const [highConfidenceScore, setHighConfidenceScore] = useState(0.85);
  const [largeAmountText, setLargeAmountText] = useState('1.500.000');

  // What-if simulation
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState('');
  const simSeqRef = useRef(0);

  // Confirm save modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const largeAmount = useMemo(() => parseDigitsAmount(largeAmountText), [largeAmountText]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/risk-config');
      const data = res.data || {};
      const p = data.policy;

      setSavedPolicy(p);
      setMlHealth(data.mlHealth || null);
      setModelMetadata(data.modelMetadata || null);
      setRecentHistory(Array.isArray(data.recentHistory) ? data.recentHistory : []);

      if (p) {
        setAlertThreshold(Number(p.alertThreshold));
        setHighConfidenceScore(Number(p.highConfidenceScore));
        setLargeAmountText(formatNumberDots(p.largeAmount));
      }
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Kiểm tra hợp lệ tham số đang nhập
  const validationError = useMemo(() => {
    if (!Number.isFinite(alertThreshold) || alertThreshold < 0.01 || alertThreshold > 0.98) {
      return 'Ngưỡng kích hoạt cảnh báo (AlertThreshold) phải từ 0,01 đến 0,98.';
    }
    if (!Number.isFinite(highConfidenceScore) || highConfidenceScore <= alertThreshold || highConfidenceScore > 0.99) {
      return 'Ngưỡng tin cậy cao (HighConfidenceScore) phải lớn hơn AlertThreshold và ≤ 0,99.';
    }
    if (!Number.isFinite(largeAmount) || largeAmount <= 0) {
      return 'Ngưỡng giao dịch giá trị lớn (LargeAmount) phải lớn hơn 0.';
    }
    return '';
  }, [alertThreshold, highConfidenceScore, largeAmount]);

  // Danh sách thay đổi so với cấu hình đang chạy
  const changes = useMemo(() => {
    if (!savedPolicy) return [];
    const list = [];
    if (Math.abs(Number(savedPolicy.alertThreshold) - alertThreshold) >= 0.0001) {
      list.push({
        label: 'Ngưỡng kích hoạt cảnh báo (AlertThreshold)',
        oldVal: Number(savedPolicy.alertThreshold).toFixed(2),
        newVal: Number(alertThreshold).toFixed(2),
      });
    }
    if (Math.abs(Number(savedPolicy.highConfidenceScore) - highConfidenceScore) >= 0.0001) {
      list.push({
        label: 'Ngưỡng tin cậy cao (HighConfidenceScore)',
        oldVal: Number(savedPolicy.highConfidenceScore).toFixed(2),
        newVal: Number(highConfidenceScore).toFixed(2),
      });
    }
    if (Math.abs(Number(savedPolicy.largeAmount) - largeAmount) >= 1) {
      list.push({
        label: 'Ngưỡng giao dịch giá trị lớn (LargeAmount)',
        oldVal: formatNumberDots(savedPolicy.largeAmount),
        newVal: formatNumberDots(largeAmount),
      });
    }
    return list;
  }, [savedPolicy, alertThreshold, highConfidenceScore, largeAmount]);

  // Tự động chạy mô phỏng tác động 30 ngày (debounce 350ms)
  useEffect(() => {
    if (!savedPolicy || validationError) return undefined;

    const timer = setTimeout(async () => {
      const seq = ++simSeqRef.current;
      setSimulating(true);
      setSimError('');
      try {
        const res = await axiosClient.post('/admin/risk-config/simulate', {
          alertThreshold,
          highConfidenceScore,
          largeAmount,
        });
        if (seq === simSeqRef.current) {
          setSimulation(res.data || null);
        }
      } catch (err) {
        if (seq === simSeqRef.current) {
          setSimError(getErrorMessage(err));
        }
      } finally {
        if (seq === simSeqRef.current) {
          setSimulating(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [savedPolicy, alertThreshold, highConfidenceScore, largeAmount, validationError]);

  const handlePingMl = async () => {
    if (pingingMl) return;
    setPingingMl(true);
    try {
      const res = await axiosClient.get('/admin/risk-config/ml-health');
      setMlHealth(res.data || null);
    } catch (err) {
      setMlHealth({
        online: false,
        latencyMs: null,
        endpoint: mlHealth?.endpoint || 'http://localhost:8000/predict',
        detail: getErrorMessage(err),
      });
    } finally {
      setPingingMl(false);
    }
  };

  const handleResetDraft = () => {
    if (!savedPolicy) return;
    setAlertThreshold(Number(savedPolicy.alertThreshold));
    setHighConfidenceScore(Number(savedPolicy.highConfidenceScore));
    setLargeAmountText(formatNumberDots(savedPolicy.largeAmount));
  };

  const handleConfirmSave = async (event) => {
    event.preventDefault();
    if (saving || validationError || changes.length === 0 || reason.trim().length < MIN_REASON_LEN) return;

    setSaving(true);
    setSaveError('');
    try {
      await axiosClient.put('/admin/risk-config', {
        alertThreshold,
        highConfidenceScore,
        largeAmount,
        reason: reason.trim(),
      });
      setConfirmOpen(false);
      setReason('');
      setFeedback('Đã lưu cấu hình chính sách rủi ro mới và ghi nhận vào Nhật ký kiểm toán.');
      await loadConfig();
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !savedPolicy) {
    return (
      <div className="page-card">
        <div className="table-loading" role="status">
          <div className="spin" aria-hidden="true" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
          Đang tải cấu hình mô hình và chính sách rủi ro...
        </div>
      </div>
    );
  }

  if (error && !savedPolicy) {
    return (
      <div className="page-card">
        <div className="empty-state" role="alert">
          <AlertTriangle size={42} aria-hidden="true" />
          <h3>Không tải được cấu hình mô hình</h3>
          <p>{error}</p>
          <button type="button" className="sort-toggle" onClick={loadConfig}>Thử lại</button>
        </div>
      </div>
    );
  }

  const activeModel = modelMetadata?.activeModel || {};
  const benchmarks = Array.isArray(modelMetadata?.benchmarks) ? modelMetadata.benchmarks : [];
  const topFeatures = Array.isArray(modelMetadata?.topFeatures) ? modelMetadata.topFeatures : [];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cấu hình mô hình & Ngưỡng rủi ro</h1>
          <p className="page-subtitle">
            Kiểm soát tham số phân tầng cảnh báo trên miền giao dịch PaySim (TRANSFER & CASH_OUT) và mô phỏng tác động trước khi áp dụng
          </p>
        </div>

        {/* Trạng thái dịch vụ ML */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="badge"
            title={mlHealth?.detail || ''}
            style={{
              padding: '6px 12px',
              color: mlHealth?.online ? '#86efac' : '#fca5a5',
              backgroundColor: mlHealth?.online ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.14)',
              borderColor: mlHealth?.online ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.4)',
            }}
          >
            <Activity size={14} aria-hidden="true" />
            {mlHealth?.online
              ? `ML Service: Online${mlHealth.latencyMs != null ? ` (${mlHealth.latencyMs} ms)` : ''}`
              : 'ML Service: Offline'}
          </span>

          <button type="button" className="sort-toggle" onClick={handlePingMl} disabled={pingingMl} title="Kiểm tra lại kết nối tới dịch vụ Python ML">
            <RefreshCw size={14} className={pingingMl ? 'spin' : ''} aria-hidden="true" />
            Kiểm tra ML
          </button>
        </div>
      </div>

      {feedback && (
        <p className="case-message success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <span style={{ flex: 1 }}>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback('')}
            aria-label="Đóng thông báo"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 2 }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      )}

      <div className="dash-grid">
        {/* CỘT TRÁI: 3 THAM SỐ CHÍNH SÁCH + MÔ PHỎNG WHAT-IF */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="page-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div>
                <p className="detail-eyebrow">Chính sách phân loại rủi ro · RiskPolicy</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SlidersHorizontal size={18} color="#60a5fa" aria-hidden="true" />
                  Tham số ngưỡng vận hành
                </h2>
              </div>
              {savedPolicy?.updatedAt && (
                <span className="cell-time" style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                  Cập nhật: {formatDate(savedPolicy.updatedAt)}<br />
                  bởi <strong>{savedPolicy.updatedByName}</strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tham số 1: AlertThreshold */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label htmlFor="cfg-alert-threshold" style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                    1. Ngưỡng kích hoạt cảnh báo (AlertThreshold)
                  </label>
                  <input
                    id="cfg-alert-threshold"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.98"
                    className="page-input"
                    style={{ width: 78 }}
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.90"
                  step="0.01"
                  aria-label="Thanh trượt AlertThreshold"
                  style={{ width: '100%', marginTop: 10, accentColor: '#3b82f6' }}
                  value={Number.isFinite(alertThreshold) ? alertThreshold : 0.32}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                />
                <p style={{ color: 'var(--text-soft)', fontSize: '0.78rem', lineHeight: 1.45, margin: '6px 0 0' }}>
                    Giao dịch có điểm xác suất ML ≥ <strong>{Number(alertThreshold || 0).toFixed(2)}</strong> ({formatPct(alertThreshold, 0)}) sẽ tự động sinh Alert cho Điều tra viên.
                    Ngưỡng tối ưu trên tập validation là <strong>{Number(activeModel.optimalThreshold || 0.3794).toFixed(4)}</strong>.
                </p>
              </div>

              {/* Tham số 2: HighConfidenceScore */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label htmlFor="cfg-high-confidence" style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                    2. Ngưỡng tin cậy cao (HighConfidenceScore)
                  </label>
                  <input
                    id="cfg-high-confidence"
                    type="number"
                    step="0.01"
                    min="0.02"
                    max="0.99"
                    className="page-input"
                    style={{ width: 78 }}
                    value={highConfidenceScore}
                    onChange={(e) => setHighConfidenceScore(Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.99"
                  step="0.01"
                  aria-label="Thanh trượt HighConfidenceScore"
                  style={{ width: '100%', marginTop: 10, accentColor: '#f59e0b' }}
                  value={Number.isFinite(highConfidenceScore) ? highConfidenceScore : 0.85}
                  onChange={(e) => setHighConfidenceScore(Number(e.target.value))}
                />
                <p style={{ color: 'var(--text-soft)', fontSize: '0.78rem', lineHeight: 1.45, margin: '6px 0 0' }}>
                  Ranh giới phân tách cảnh báo mức <strong>Thấp / Trung bình</strong> với nhóm <strong>Cao / Nghiêm trọng</strong> (bắt buộc lớn hơn AlertThreshold).
                </p>
              </div>

              {/* Tham số 3: LargeAmount */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label htmlFor="cfg-large-amount" style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                    3. Ngưỡng giao dịch giá trị lớn (LargeAmount)
                  </label>
                  <input
                    id="cfg-large-amount"
                    type="text"
                    inputMode="numeric"
                    className="page-input"
                    style={{ width: 145, textAlign: 'right', paddingRight: 10 }}
                    value={largeAmountText}
                    onChange={(e) => setLargeAmountText(formatNumberDots(parseDigitsAmount(e.target.value)))}
                  />
                </div>
                <p style={{ color: 'var(--text-soft)', fontSize: '0.78rem', lineHeight: 1.45, margin: '8px 0 0' }}>
                  Kết hợp với điểm xác suất để nâng mức độ nghiêm trọng (cũng áp dụng khi Officer tạo cảnh báo hậu kiểm thủ công).
                </p>
              </div>
            </div>

            {/* Ma trận phân tầng thực tế của RiskPolicy.Classify */}
            <div style={{ marginTop: 16 }}>
              <p className="detail-eyebrow" style={{ marginBottom: 8 }}>Quy tắc phân tầng hiện hành · RiskPolicy.Classify</p>
              <table className="data-table" style={{ width: '100%', minWidth: 0, fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ padding: '8px 10px' }}>Khoảng điểm ML</th>
                    <th scope="col" style={{ padding: '8px 10px' }}>Số tiền &lt; {formatNumberDots(largeAmount)}</th>
                    <th scope="col" style={{ padding: '8px 10px' }}>Số tiền ≥ {formatNumberDots(largeAmount)}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 10px' }}>Điểm &lt; {Number(alertThreshold || 0).toFixed(2)}</td>
                    <td colSpan={2} style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>An toàn (Safe) — Không sinh cảnh báo</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px' }}>{Number(alertThreshold || 0).toFixed(2)} – &lt; {Number(highConfidenceScore || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', color: '#60a5fa', fontWeight: 600 }}>Thấp (Low)</td>
                    <td style={{ padding: '8px 10px', color: '#fbbf24', fontWeight: 600 }}>Trung bình (Medium)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px' }}>Điểm ≥ {Number(highConfidenceScore || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', color: '#fb923c', fontWeight: 600 }}>Cao (High)</td>
                    <td style={{ padding: '8px 10px', color: '#f87171', fontWeight: 600 }}>Nghiêm trọng (Critical)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {validationError && (
              <p className="detail-action-error" role="alert" style={{ marginTop: 12 }}>{validationError}</p>
            )}

            <div className="case-form-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="sort-toggle"
                onClick={handleResetDraft}
                disabled={changes.length === 0}
              >
                Hoàn tác thay đổi
              </button>
              <button
                type="button"
                className="detail-primary-action"
                style={{ width: 'auto', minHeight: 40, padding: '8px 18px' }}
                disabled={Boolean(validationError) || changes.length === 0}
                onClick={() => { setSaveError(''); setReason(''); setConfirmOpen(true); }}
              >
                <Save size={15} aria-hidden="true" />
                Lưu cấu hình ({changes.length})
              </button>
            </div>
          </section>

          {/* MÔ PHỎNG TÁC ĐỘNG 30 NGÀY (WHAT-IF) */}
          <section className="page-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <p className="detail-eyebrow">Mô phỏng tác động trước khi lưu · What-if</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 17, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={17} color="#fbbf24" aria-hidden="true" />
                  Dự báo khối lượng cảnh báo
                </h2>
              </div>
              {simulating && <span className="cell-time" style={{ fontSize: '0.78rem' }}>Đang tính toán...</span>}
            </div>

            {simError ? (
              <p className="detail-action-error" style={{ marginTop: 12 }}>{simError}</p>
            ) : simulation ? (
              <div style={{ marginTop: 12 }}>
                <p className="cell-time" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                  Phạm vi dữ liệu: <strong>{simulation.windowLabel}</strong> ({simulation.totalScoredTransactions.toLocaleString('vi-VN')} giao dịch TRANSFER / CASH_OUT).
                </p>

                <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.96rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    Với bộ ngưỡng đang chọn, hệ thống sẽ sinh{' '}
                    <strong style={{ color: '#60a5fa', fontSize: '1.1rem' }}>
                      {simulation.proposedAlerts.toLocaleString('vi-VN')}
                    </strong>{' '}
                    cảnh báo thay vì{' '}
                    <strong>{simulation.currentAlerts.toLocaleString('vi-VN')}</strong> cảnh báo hiện tại
                    {simulation.deltaAlerts !== 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: simulation.deltaAlerts > 0 ? '#fca5a5' : '#86efac',
                          background: simulation.deltaAlerts > 0 ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 197, 94, 0.14)',
                        }}
                      >
                        {simulation.deltaAlerts > 0 ? `+${simulation.deltaAlerts}` : simulation.deltaAlerts}
                        {simulation.deltaPercent != null ? ` (${simulation.deltaPercent > 0 ? '+' : ''}${simulation.deltaPercent}%)` : ''}
                      </span>
                    )}
                    .
                  </div>

                  {(simulation.newlyTriggeredCount > 0 || simulation.suppressedCount > 0) && (
                    <div className="cell-time" style={{ fontSize: '0.78rem', marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>• Cảnh báo mới phát sinh thêm: <strong style={{ color: '#fca5a5' }}>+{simulation.newlyTriggeredCount}</strong></span>
                      <span>• Cảnh báo được giảm bớt: <strong style={{ color: '#86efac' }}>-{simulation.suppressedCount}</strong></span>
                    </div>
                  )}
                </div>

                {/* So sánh phân bổ mức độ rủi ro */}
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {RISK_LEVEL_META.map(({ key, label, color, bg }) => {
                    const curVal = simulation.currentBreakdown?.[key] ?? 0;
                    const propVal = simulation.proposedBreakdown?.[key] ?? 0;
                    return (
                      <div key={key} style={{ padding: '10px 12px', borderRadius: 10, background: bg, border: '1px solid rgba(148,163,184,0.16)' }}>
                        <div style={{ fontSize: '0.76rem', color, fontWeight: 600 }}>{label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.9rem', color: 'var(--text)', fontWeight: 700 }}>
                          <span>{curVal}</span>
                          <ArrowRight size={13} color="var(--text-soft)" aria-hidden="true" />
                          <span style={{ color }}>{propVal}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* CỘT PHẢI: HỒ SƠ MÔ HÌNH ML (READ-ONLY) & LỊCH SỬ CẤU HÌNH */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="page-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <p className="detail-eyebrow">Quản trị mô hình · Chỉ đọc từ báo cáo huấn luyện</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={18} color="#c084fc" aria-hidden="true" />
                  {activeModel.model || 'Random Forest'} ({activeModel.imbalanceMethod || 'Trọng số lớp'})
                </h2>
              </div>
              <span className="badge" style={{ color: '#c084fc', background: 'rgba(168,85,247,0.14)', borderColor: 'rgba(168,85,247,0.35)' }}>
                <Database size={12} aria-hidden="true" />
                {modelMetadata?.sourceAvailable ? modelMetadata.sourceFile : 'Metadata'}
              </span>
            </div>

            <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-soft)', lineHeight: 1.55 }}>
              <div><strong style={{ color: 'var(--text)' }}>Phạm vi dữ liệu:</strong> {modelMetadata?.datasetScope}</div>
              <div><strong style={{ color: 'var(--text)' }}>Tập kiểm thử:</strong> {modelMetadata?.evaluationSplit}</div>
            </div>

            {/* 5 chỉ số đánh giá từ model_comparison.csv */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
              {[
                { label: 'Precision', val: formatPct(activeModel.precision) },
                { label: 'Recall', val: formatPct(activeModel.recall) },
                { label: 'F1-Score', val: formatPct(activeModel.f1) },
                { label: 'ROC-AUC', val: formatPct(activeModel.rocAuc) },
                { label: 'PR-AUC', val: formatPct(activeModel.prAuc) },
                { label: 'Ngưỡng Val tối ưu', val: Number(activeModel.optimalThreshold || 0.3794).toFixed(4) },
              ].map((m) => (
                <div key={m.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                  <div className="cell-time" style={{ fontSize: '0.74rem' }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Top đặc trưng quan trọng */}
            {topFeatures.length > 0 && (
            <div style={{ marginTop: 16 }}>
                <p className="detail-eyebrow" style={{ marginBottom: 8 }}>Đặc trưng đóng góp chính (Feature Importance)</p>
                <div className="bar-list">
                {topFeatures.map((f) => (
                    <div key={f.key} className="bar-row" style={{ gridTemplateColumns: '155px 1fr 56px' }}>
                    <span className="bar-label" style={{ fontSize: '0.8rem' }}>{f.label}</span>
                    <div className="bar-track">
                        <div
                        className="bar-fill"
                        style={{
                            width: `${Math.min(100, Math.round(f.importance * 100 * 2))}%`,
                            background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                        }}
                        />
                    </div>
                    <span className="bar-value" style={{ fontSize: '0.78rem' }}>{formatPct(f.importance)}</span>
                    </div>
                ))}
                </div>
            </div>
            )}

            {/* Bảng đối chiếu các mô hình từ model_comparison.csv */}
            {benchmarks.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="sort-toggle"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowAllBenchmarks((prev) => !prev)}
                >
                  {showAllBenchmarks ? 'Thu gọn bảng đối chiếu thực nghiệm' : `Xem bảng đối chiếu ${benchmarks.length} cấu hình huấn luyện`}
                </button>

                {showAllBenchmarks && (
                  <div className="alert-table-scroll" style={{ marginTop: 10 }}>
                    <table className="data-table" style={{ width: '100%', minWidth: 0, fontSize: '0.76rem' }}>
                      <thead>
                        <tr>
                          <th scope="col" style={{ padding: '6px 8px' }}>Mô hình</th>
                          <th scope="col" style={{ padding: '6px 8px' }}>Cân bằng</th>
                          <th scope="col" style={{ padding: '6px 8px' }}>F1</th>
                          <th scope="col" style={{ padding: '6px 8px' }}>PR-AUC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks.map((b, idx) => (
                          <tr key={`${b.model}-${b.imbalanceMethod}-${idx}`}>
                            <td style={{ padding: '6px 8px', fontWeight: idx === 0 ? 700 : 400 }}>{b.model}</td>
                            <td style={{ padding: '6px 8px' }}>{b.imbalanceMethod}</td>
                            <td style={{ padding: '6px 8px' }}>{formatPct(b.f1)}</td>
                            <td style={{ padding: '6px 8px' }}>{formatPct(b.prAuc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* LỊCH SỬ ĐIỀU CHỈNH CẤU HÌNH GẦN ĐÂY */}
          <section className="page-card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <p className="detail-eyebrow">Kiểm soát thay đổi · Audit Trail</p>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={17} color="#60a5fa" aria-hidden="true" />
                Lịch sử điều chỉnh tham số
              </h2>
            </div>

            {recentHistory.length === 0 ? (
              <p className="case-empty">Chưa có lần điều chỉnh cấu hình nào được ghi nhận.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentHistory.map((item) => (
                  <div
                    key={item.AuditLogId}
                    style={{ padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text)' }}>{item.actorName}</strong>
                      <span className="cell-time" style={{ fontSize: '0.75rem' }}>{formatDate(item.createdAt)}</span>
                    </div>
                    {item.details && (
                      <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
                        {item.details}
                      </div>
                    )}
                    {item.reason && (
                      <div className="cell-time" style={{ marginTop: 4, fontSize: '0.78rem' }}>
                        Lý do: {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* HỘP THOẠI XÁC NHẬN LƯU & ĐỐI CHIẾU CŨ → MỚI */}
      {confirmOpen && (
        <div role="dialog" aria-modal="true" style={MODAL_STYLE.overlay} onClick={() => !saving && setConfirmOpen(false)}>
          <div style={MODAL_STYLE.card} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="detail-eyebrow">Kiểm soát thay đổi · Ghi nhật ký kiểm toán</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc' }}>
                  Xác nhận cập nhật chính sách rủi ro
                </h2>
              </div>
              <button
                type="button"
                className="sort-toggle"
                style={{ padding: '6px 8px' }}
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                aria-label="Đóng"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Bảng đối chiếu Giá trị cũ → Giá trị mới */}
            <div style={{ marginTop: 14 }}>
              <table className="data-table" style={{ width: '100%', minWidth: 0, fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ padding: '8px 10px' }}>Tham số</th>
                    <th scope="col" style={{ padding: '8px 10px' }}>Giá trị cũ</th>
                    <th scope="col" style={{ padding: '8px 10px' }}>Giá trị mới</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.label}>
                      <td style={{ padding: '8px 10px' }}>{c.label}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{c.oldVal}</td>
                      <td style={{ padding: '8px 10px', color: '#60a5fa', fontWeight: 700 }}>{c.newVal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form className="case-form" onSubmit={handleConfirmSave} style={{ marginTop: 14 }}>
              <label htmlFor="policy-change-reason">
                Lý do điều chỉnh tham số (bắt buộc, {MIN_REASON_LEN}–{MAX_REASON_LEN} ký tự)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    style={{
                      padding: '3px 9px',
                      fontSize: '0.74rem',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: '#cbd5e1',
                      background: 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                    onClick={() => setReason(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                id="policy-change-reason"
                rows={3}
                maxLength={MAX_REASON_LEN}
                placeholder="Ghi rõ căn cứ điều chỉnh ngưỡng cảnh báo để lưu vết kiểm toán..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />

              {saveError && <p className="detail-action-error" role="alert">{saveError}</p>}

              <div className="case-form-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="sort-toggle" onClick={() => setConfirmOpen(false)} disabled={saving}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="detail-primary-action"
                  style={{ minHeight: 40, padding: '8px 18px' }}
                  disabled={saving || reason.trim().length < MIN_REASON_LEN}
                >
                  {saving ? 'Đang lưu...' : 'Áp dụng & Ghi Audit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}