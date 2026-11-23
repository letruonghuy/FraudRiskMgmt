import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowLeftRight, CircleAlert, Clock3,
  FolderOpen, ShieldAlert, ShieldCheck, UserRoundCheck,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { RISK_CONFIG, STATUS_CONFIG, getErrorMessage } from './alertShared';
import { ML_MODEL_INFO } from './mlExplain';
import { CASE_STATUS_CONFIG } from './caseUtils';

const RISK_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Safe'];
const STATUS_ORDER = ['New', 'Assigned', 'UnderReview', 'AwaitingApproval', 'Reopened', 'Closed', 'FalsePositive'];
const CASE_ORDER = ['Open', 'Investigating', 'PendingApproval', 'Rework', 'Approved', 'FalsePositive', 'Closed'];
const PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
  { label: '1 năm', days: 365 },
];

const POLL_INTERVAL_MS = 5000;
const MIN_RESOLVED_FOR_RATE = 10;
const MIN_CASES_FOR_RATE = 5;

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');
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

function BarList({ rows, emptyText }) {
  const max = Math.max(5, ...rows.map((r) => r.count));
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

const CHART_HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 44 };

const formatDay = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const formatFullDay = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

function niceStep(max) {
  const raw = Math.max(1, max / 5);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / pow;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * pow;
}

function toBuckets(data, weekly) {
  if (!weekly) return data.map((d) => ({ start: d.date, end: d.date, count: d.count }));
  const result = [];
  for (let i = 0; i < data.length; i += 7) {
    const slice = data.slice(i, i + 7);
    result.push({
      start: slice[0].date,
      end: slice[slice.length - 1].date,
      count: slice.reduce((sum, d) => sum + d.count, 0),
    });
  }
  return result;
}

function DailyChart({ data }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return (
      <div className="daily-chart" ref={wrapRef}>
        <p className="case-empty">Không có giao dịch trong khoảng thời gian này. Thử chọn khoảng dài hơn.</p>
      </div>
    );
  }

  const weekly = data.length > 90;
  const buckets = toBuckets(data, weekly);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const step = niceStep(max);
  const top = step * 5;
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const slot = innerW / buckets.length;
  const barW = Math.min(Math.max(slot * 0.68, 1), 36);
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(innerW / 64))));
  const unit = weekly ? 'tuần' : 'ngày';

  return (
    <div className="daily-chart" ref={wrapRef}>
      {width > 0 && (
        <svg width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img"
          aria-label={`Số giao dịch mỗi ${unit}, tổng ${total}`}>
          {Array.from({ length: 6 }, (_, i) => {
            const value = step * i;
            const y = MARGIN.top + innerH - (value / top) * innerH;
            return (
              <g key={value}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} className={i === 0 ? 'daily-axis' : 'daily-grid'} />
                <text x={MARGIN.left - 8} y={y + 4} textAnchor="end" className="daily-tick">{formatNumber(value)}</text>
              </g>
            );
          })}
          {buckets.map((b, i) => {
            const h = (b.count / top) * innerH;
            const x = MARGIN.left + i * slot + (slot - barW) / 2;
            const label = b.start === b.end ? formatFullDay(b.start) : `${formatFullDay(b.start)} – ${formatFullDay(b.end)}`;
            return (
              <g key={b.start}>
                <rect x={x} y={MARGIN.top + innerH - h} width={barW} height={b.count ? Math.max(h, 2) : 0} rx="2" className="daily-bar">
                  <title>{`${label}: ${formatNumber(b.count)} giao dịch`}</title>
                </rect>
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={CHART_HEIGHT - 8} textAnchor="middle" className="daily-tick">{formatDay(b.start)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <p className="daily-caption">
        Cao nhất {formatNumber(max)} giao dịch/{unit} · Tổng {formatNumber(total)}{weekly ? ' · Gộp theo tuần vì khoảng thời gian dài' : ''}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState(() => rangeForDays(30));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!rangeValid) return;
    if (silent && inFlightRef.current) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const response = await axiosClient.get('/Dashboard', {
        params: { from: range.from, to: range.to },
      });
      if (seq === requestSeqRef.current) {
        setData(response.data);
        setError('');
      }
    } catch (requestError) {
      if (seq === requestSeqRef.current && !silent) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      inFlightRef.current = false;
      if (seq === requestSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [range.from, range.to, rangeValid]);

  useEffect(() => {
    fetchDashboard({ silent: false });
  }, [fetchDashboard]);

  // Tự động cập nhật ngầm mỗi 5 giây khi tab đang mở
  useEffect(() => {
    if (!rangeValid) return undefined;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [rangeValid, fetchDashboard]);

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
  const resolvedAlerts = countOf(data.alertByStatus, 'status', 'Closed') + countOf(data.alertByStatus, 'status', 'FalsePositive');
  const enoughData = resolvedAlerts >= MIN_RESOLVED_FOR_RATE;
  const falsePositiveRate = enoughData ? data.falsePositiveRate : null;
  const realPrecision = falsePositiveRate == null ? null : 100 - falsePositiveRate;
  const daily = fillDaily(data.transactionsByDay, range.from, range.to);
  const officers = data.officerProductivity || [];
  const showRate = officers.some((o) => o.totalCases >= MIN_CASES_FOR_RATE);
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
          <div className="detail-section-heading"><div><p className="detail-eyebrow">{formatFullDay(range.from)} → {formatFullDay(range.to)}</p><h2 id="dash-daily">Giao dịch theo ngày</h2></div></div>
          <DailyChart data={daily} />
        </section>

        <section className="detail-section" aria-labelledby="dash-cases">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Điều tra</p><h2 id="dash-cases">Hồ sơ theo trạng thái</h2></div></div>
          <BarList rows={caseRows} emptyText="Chưa có hồ sơ trong khoảng này." />
        </section>

        <section className="detail-section" aria-labelledby="dash-officers">
          <div className="detail-section-heading"><div><p className="detail-eyebrow">Hiệu suất</p><h2 id="dash-officers">Điều tra viên</h2></div></div>
          {officers.length === 0 ? (
            <p className="case-empty">Chưa có hồ sơ nào được mở trong khoảng này.</p>
          ) : (
            <div className="detail-table-scroll">
              <table className="detail-balance-table">
                <thead>
                  <tr>
                    <th scope="col">Điều tra viên</th>
                    <th scope="col">Hồ sơ</th>
                    <th scope="col">Chưa xong</th>
                    <th scope="col">Đã xong</th>
                    {showRate && <th scope="col">Tỷ lệ xong</th>}
                  </tr>
                </thead>
                <tbody>
                  {officers.map((o) => (
                    <tr key={o.officerName}>
                      <th scope="row">{o.officerName}</th>
                      <td>{o.totalCases}</td>
                      <td>{o.totalCases - o.closedCases}</td>
                      <td>{o.closedCases}</td>
                      {showRate && (
                        <td>
                          {o.totalCases >= MIN_CASES_FOR_RATE
                            ? formatPercent((o.closedCases / o.totalCases) * 100)
                            : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showRate && (
            <p className="case-empty ml-note">
              Tỷ lệ xong chỉ hiển thị khi có từ {MIN_CASES_FOR_RATE} hồ sơ, vì mẫu quá nhỏ dễ gây hiểu nhầm. “Chưa xong” là hồ sơ chưa được duyệt.
            </p>
          )}
        </section>

        <section className="detail-section dash-wide" aria-labelledby="dash-model">
          <div className="detail-section-heading">
            <div>
              <p className="detail-eyebrow">Mô hình học máy</p>
              <h2 id="dash-model">{ML_MODEL_INFO.name}</h2>
            </div>
            <span className="detail-type-tag" style={{ color: '#86efac', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
              Đang hoạt động
            </span>
          </div>
          <dl className="alert-detail-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="alert-detail-field">
              <dt>Precision thực tế</dt>
              <dd>{formatPercent(realPrecision)}</dd>
            </div>
            <div className="alert-detail-field">
              <dt>Tỷ lệ báo động giả</dt>
              <dd>{formatPercent(falsePositiveRate)}</dd>
            </div>
            <div className="alert-detail-field">
              <dt>Cảnh báo đã xử lý</dt>
              <dd>{formatNumber(resolvedAlerts)} (cần ≥ {MIN_RESOLVED_FOR_RATE} để tính)</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="case-empty">
        <Link className="detail-back-link" to="/dashboard/tasks">Chuyển sang xử lý công việc tồn đọng →</Link>
      </p>
    </div>
  );
}