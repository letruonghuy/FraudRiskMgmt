import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeftRight, CircleAlert, Clock3, FolderOpen, RefreshCw, ShieldAlert, ShieldCheck, UserRoundCheck } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { RISK_CONFIG, STATUS_CONFIG, getErrorMessage } from './alertShared';
import { CASE_STATUS_CONFIG } from './caseShared';
import { ML_MODEL_INFO } from './mlExplain';

const RISK_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Safe'];
const STATUS_ORDER = ['New', 'Assigned', 'UnderReview', 'AwaitingApproval', 'Reopened', 'Closed', 'FalsePositive'];
const CASE_ORDER = ['Open', 'Investigating', 'PendingApproval', 'Rework', 'Approved', 'FalsePositive', 'Closed'];
const PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
  { label: '1 năm', days: 365 },
];

// Dưới ngưỡng này tỷ lệ báo động giả chưa đủ tin cậy nên không hiển thị
const MIN_RESOLVED_FOR_RATE = 10;
const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');
// API trả tỷ lệ báo động giả đã nhân 100 (ví dụ 25.5)
// API trả số phút xử lý trung bình (null nếu chưa có hồ sơ nào đóng trong khoảng đã chọn)
const formatDuration = (minutes) => {
  if (minutes == null) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${total} phút`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  return mins ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
};
const formatPercent = (value) => (value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`);

// yyyy-MM-dd theo giờ địa phương (input type="date" dùng định dạng này)
const toInputDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const rangeForDays = (days) => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
};
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

// Điền 0 cho các ngày không có giao dịch để biểu đồ không bị đứt quãng
function fillDaily(items, from, to) {
  const perDay = new Map();
  (items || []).forEach((item) => {
    const key = String(item.date).slice(0, 10);
    perDay.set(key, (perDay.get(key) || 0) + item.count);
  });
  const result = [];
  const cursor = new Date(`${from}T00:00:00`);
  const last = new Date(`${to}T00:00:00`);
  while (cursor <= last && result.length < 400) {
    const key = toInputDate(cursor);
    result.push({ date: key, count: perDay.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function StatTile({ icon, label, value, hint, tone, compact }) {
  return (
    <div className="dash-tile">
      <span className="dash-tile-icon" style={tone ? { color: tone } : undefined} aria-hidden="true">{icon}</span>
      <div>
        <span className="dash-tile-label">{label}</span>
        <strong className={`dash-tile-value ${compact ? 'compact' : ''}`}>{value}</strong>
        {hint && <span className="dash-tile-hint">{hint}</span>}
      </div>
    </div>
  );
}

// Thanh ngang: nhãn bên trái, giá trị bên phải; một chiều dữ liệu, màu theo ngữ nghĩa có sẵn của hệ thống
function BarList({ rows, emptyText }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.every((r) => r.count === 0)) return <p className="case-empty">{emptyText}</p>;
  return (
    <ul className="bar-list">
      {rows.map((row) => (
        <li key={row.key} className="bar-row" title={`${row.label}: ${formatNumber(row.count)}`}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(row.count / max) * 100}%`, backgroundColor: row.color }} />
          </span>
          <span className="bar-value">{formatNumber(row.count)}</span>
        </li>
      ))}
    </ul>
  );
}

// Biểu đồ cột theo ngày (SVG, một màu)
function DailyChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="case-empty">Không có giao dịch trong khoảng thời gian này. Thử chọn khoảng dài hơn.</p>;

  const width = 600;
  const height = 160;
  const gap = 2;
  const barWidth = Math.max(2, width / data.length - gap);
  const step = Math.ceil(data.length / 6);

  return (
    <div className="daily-chart">
      <svg viewBox={`0 0 ${width} ${height + 22}`} role="img" aria-label={`Số giao dịch mỗi ngày, tổng ${total}`}>
        <line x1="0" y1={height} x2={width} y2={height} className="daily-axis" />
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 8);
          const x = i * (width / data.length);
          return (
            <g key={d.date}>
              <rect x={x} y={height - h} width={barWidth} height={Math.max(h, d.count ? 2 : 0)} rx="2" className="daily-bar">
                <title>{`${d.date}: ${d.count} giao dịch`}</title>
              </rect>
              {i % step === 0 && (
                <text x={x} y={height + 16} className="daily-tick">{d.date.slice(8)}/{d.date.slice(5, 7)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="daily-caption">Cao nhất {max} giao dịch/ngày · Tổng {formatNumber(total)}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState(() => rangeForDays(30));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);

  useEffect(() => {
    if (!rangeValid) return undefined;
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axiosClient.get('/Dashboard', { params: { from: range.from, to: range.to } });
        if (isActive) setData(response.data);
      } catch (requestError) {
        if (isActive) setError(getErrorMessage(requestError));
      } finally {
        if (isActive) setLoading(false);
      }
    };
    load();
    return () => { isActive = false; };
  }, [range.from, range.to, rangeValid, reloadKey]);

  if (loading && !data) {
    return (
      <div className="alert-detail-state" role="status" aria-live="polite">
        <div className="spin" aria-hidden="true" />
        <p>Đang tải số liệu...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="alert-detail-state" role="alert">
        <CircleAlert size={28} aria-hidden="true" />
        <h1>Không tải được số liệu</h1>
        <p>{error}</p>
        <div className="alert-detail-state-actions">
          <button className="sort-toggle" type="button" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw size={15} aria-hidden="true" /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  const countOf = (list, field, key) => (list || []).find((x) => x[field] === key)?.count ?? 0;
  const riskRows = RISK_ORDER.map((key) => ({
    key, label: RISK_CONFIG[key].label, color: RISK_CONFIG[key].color, count: countOf(data.alertByRiskLevel, 'riskLevel', key),
  }));
  const statusRows = STATUS_ORDER.map((key) => ({
    key, label: STATUS_CONFIG[key].label, color: STATUS_CONFIG[key].color, count: countOf(data.alertByStatus, 'status', key),
  }));
  const caseRows = CASE_ORDER.map((key) => ({
    key, label: CASE_STATUS_CONFIG[key].label, color: CASE_STATUS_CONFIG[key].color, count: countOf(data.caseByStatus, 'status', key),
  }));

  const totalAlerts = (data.alertByStatus || []).reduce((sum, x) => sum + x.count, 0);
  // API trả 0 khi chưa có cảnh báo nào xử lý xong → tự suy ra để không hiện "0%" gây hiểu nhầm
  const resolvedAlerts = countOf(data.alertByStatus, 'status', 'Closed') + countOf(data.alertByStatus, 'status', 'FalsePositive');
  const enoughData = resolvedAlerts >= MIN_RESOLVED_FOR_RATE;
  const falsePositiveRate = enoughData ? data.falsePositiveRate : null;
  const realPrecision = falsePositiveRate == null ? null : 100 - falsePositiveRate;
  const daily = fillDaily(data.transactionsByDay, range.from, range.to);
  const activePreset = PRESETS.find((p) => {
    const r = rangeForDays(p.days);
    return r.from === range.from && r.to === range.to;
  });

  return (
    <div className="fade-in dashboard-page">
      <header className="dash-header">
        <div>
          <h1 className="page-title">Tổng quan hệ thống</h1>
          <p className="page-subtitle">Tình hình giao dịch, cảnh báo gian lận và hiệu quả xử lý</p>
        </div>
        <div className="dash-controls">
          <div className="dash-range" role="group" aria-label="Khoảng thời gian nhanh">
            {PRESETS.map((preset) => (
              <button key={preset.days} type="button" className={`dash-range-btn ${activePreset?.days === preset.days ? 'active' : ''}`}
                aria-pressed={activePreset?.days === preset.days} onClick={() => setRange(rangeForDays(preset.days))}>
                {preset.label}
              </button>
            ))}
          </div>
          <label className="dash-date">Từ
            <input type="date" className="select-dark" value={range.from} max={range.to || undefined}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="dash-date">Đến
            <input type="date" className="select-dark" value={range.to} min={range.from || undefined}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </label>
          <button className="sort-toggle" type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading || !rangeValid}>
            <RefreshCw size={15} aria-hidden="true" /> Tải lại
          </button>
        </div>
      </header>

      {!rangeValid && <p className="detail-action-error" role="alert">Khoảng thời gian không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {error && <p className="detail-action-error" role="alert">{error}</p>}

      <div className="dash-tiles">
        <StatTile icon={<ArrowLeftRight size={20} />} label="Giao dịch" value={formatNumber(data.totalTransactions)} hint={`${daysBetween(range.from, range.to)} ngày đã chọn`} />
        <StatTile icon={<Activity size={20} />} label="Tổng cảnh báo" value={formatNumber(totalAlerts)} />
        <StatTile icon={<ShieldAlert size={20} />} label="Cảnh báo mới" value={formatNumber(data.totalNewAlerts)}
          hint={data.totalNewAlerts > 0 ? 'Chưa phân công' : 'Đã phân công hết'} tone={data.totalNewAlerts > 0 ? '#3b82f6' : undefined} />
        <StatTile icon={<FolderOpen size={20} />} label="Hồ sơ đang điều tra" value={formatNumber(data.totalCaseInvestigating)} />
        <StatTile icon={<ShieldCheck size={20} />} label="Hồ sơ đã duyệt" value={formatNumber(data.totalCaseApproved)} />
        <StatTile icon={<Clock3 size={20} />} label="Thời gian xử lý TB" compact value={formatDuration(data.avgHandlingMinutes)}
          hint={data.avgHandlingMinutes == null ? 'Chưa có hồ sơ nào đóng' : 'Từ lúc mở đến lúc duyệt'} />
        <StatTile icon={<UserRoundCheck size={20} />} label="Tỷ lệ báo động giả" value={formatPercent(falsePositiveRate)}
          hint={enoughData ? `Trên ${formatNumber(resolvedAlerts)} cảnh báo đã xử lý` : `Cần ≥ ${MIN_RESOLVED_FOR_RATE} cảnh báo đã xử lý (hiện ${formatNumber(resolvedAlerts)})`} />
      </div>

      <div className="dash-grid">
        <section className="detail-section" aria-labelledby="dash-risk">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Phân bố</p><h2 id="dash-risk">Cảnh báo theo mức rủi ro</h2></div></div>
          <BarList rows={riskRows} emptyText="Chưa có cảnh báo trong khoảng này." />
        </section>

        <section className="detail-section" aria-labelledby="dash-status">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Quy trình</p><h2 id="dash-status">Cảnh báo theo trạng thái</h2></div></div>
          <BarList rows={statusRows} emptyText="Chưa có cảnh báo trong khoảng này." />
        </section>

        <section className="detail-section dash-wide" aria-labelledby="dash-daily">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">{range.from} → {range.to}</p><h2 id="dash-daily">Giao dịch theo ngày</h2></div></div>
          <DailyChart data={daily} />
        </section>

        <section className="detail-section" aria-labelledby="dash-cases">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Điều tra</p><h2 id="dash-cases">Hồ sơ theo trạng thái</h2></div></div>
          <BarList rows={caseRows} emptyText="Chưa có hồ sơ trong khoảng này." />
        </section>

        <section className="detail-section" aria-labelledby="dash-officers">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Hiệu suất</p><h2 id="dash-officers">Điều tra viên</h2></div></div>
          {(data.officerProductivity || []).length === 0 ? (
            <p className="case-empty">Chưa có hồ sơ nào được mở trong khoảng này.</p>
          ) : (
            <div className="detail-table-scroll">
              <table className="detail-balance-table">
                <thead><tr><th scope="col">Điều tra viên</th><th scope="col">Hồ sơ</th><th scope="col">Đã xong</th><th scope="col">Tỷ lệ xong</th></tr></thead>
                <tbody>
                  {data.officerProductivity.map((o) => (
                    <tr key={o.officerName}>
                      <th scope="row">{o.officerName}</th>
                      <td>{o.totalCases}</td>
                      <td>{o.closedCases}</td>
                      <td>{o.totalCases ? formatPercent((o.closedCases / o.totalCases) * 100) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="detail-section dash-wide" aria-labelledby="dash-model">
          <div className="detail-section-heading">
            <div><p className="detail-eyebrow">Mô hình học máy</p><h2 id="dash-model">{ML_MODEL_INFO.name}</h2></div>
          </div>
          <dl className="alert-detail-fields">
            <div className="alert-detail-field"><dt>Ngưỡng cảnh báo</dt><dd>{ML_MODEL_INFO.threshold}</dd></div>
            <div className="alert-detail-field"><dt>Precision (kiểm thử)</dt><dd>{formatPercent(ML_MODEL_INFO.precision * 100)}</dd></div>
            <div className="alert-detail-field"><dt>Recall (kiểm thử)</dt><dd>{formatPercent(ML_MODEL_INFO.recall * 100)}</dd></div>
            <div className="alert-detail-field"><dt>Precision thực tế</dt><dd>{formatPercent(realPrecision)}</dd></div>
          </dl>
          <p className="case-empty">
            Chỉ số kiểm thử đo trên tập dữ liệu offline; “precision thực tế” = 100% − tỷ lệ báo động giả của các cảnh báo đã xử lý.
            Hai số lệch nhau nhiều là tín hiệu để xem xét huấn luyện lại mô hình.
          </p>
        </section>
      </div>

      <p className="case-empty"><Link className="detail-back-link" to="/alerts">Xem danh sách cảnh báo →</Link></p>
    </div>
  );
}