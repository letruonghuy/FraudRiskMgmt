import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Send,
  Square,
  ArrowRightLeft,
  Wallet,
  UserRound,
  Clock3,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Zap,
  CircleHelp,
  Calendar,
  ChevronDown,
  GitMerge,
  Ban,
  Link2,
} from 'lucide-react';
import { money } from './ui';

// =========================================================
// TRANSACTION SCENARIOS
// =========================================================

const SCENARIOS = [
  {
    key: 'fraud_high',
    title: 'Gian lận rủi ro cao',
    hint: 'Tình huống có dấu hiệu gian lận rõ ràng.',
    icon: ShieldAlert,
    tone: 'danger',
  },
  {
    key: 'mid_high',
    title: 'Gian lận điểm giữa · Số tiền lớn',
    hint: 'Kiểm tra trường hợp cảnh báo Trung bình.',
    icon: Activity,
    tone: 'warning',
  },
  {
    key: 'mid_low',
    title: 'Gian lận điểm giữa · Số tiền nhỏ',
    hint: 'Kiểm tra trường hợp cảnh báo mức Thấp.',
    icon: Activity,
    tone: 'warning',
  },
  {
    key: 'missed_fraud',
    title: 'Gian lận bị bỏ sót',
    hint: 'Minh họa giới hạn phát hiện của mô hình ML.',
    icon: CircleHelp,
    tone: 'neutral',
  },
  {
    key: 'false_positive',
    title: 'Giao dịch bị báo nhầm',
    hint: 'Giao dịch thường nhưng mô hình đánh dấu rủi ro.',
    icon: ShieldAlert,
    tone: 'warning',
  },
  {
    key: 'normal',
    title: 'Giao dịch bình thường',
    hint: 'Giao dịch hợp lệ, không có dấu hiệu bất thường.',
    icon: ShieldCheck,
    tone: 'success',
  },
  {
    key: 'rule_only',
    title: 'Giao dịch ngoài phạm vi ML',
    hint: 'PAYMENT, CASH_IN, DEBIT và các loại khác.',
    icon: ArrowRightLeft,
    tone: 'neutral',
  },
];

const MERGE_DEMO_SCENARIOS = [
  {
    key: 'merge_same_customer',
    title: 'Gộp SameCustomer (3 GD / 10 phút)',
    hint: 'Hợp lệ · Cùng 1 khách hàng rút/chuyển liên tiếp.',
    badge: '3 GD · Pass',
    icon: GitMerge,
    tone: 'success',
  },
  {
    key: 'merge_same_dest',
    title: 'Gộp SameDestination · Money Mule',
    hint: 'Hợp lệ · 3 khách hàng chuyển chung 1 TK nhận.',
    badge: '3 GD · Pass',
    icon: GitMerge,
    tone: 'success',
  },
  {
    key: 'merge_money_trail',
    title: 'Gộp MoneyTrail (A → B → C → D)',
    hint: 'Hợp lệ · Chuỗi dòng tiền 3 mắt xích trong 30 phút.',
    badge: '3 GD · Pass',
    icon: GitMerge,
    tone: 'success',
  },
  {
    key: 'merge_fail_over_7d',
    title: 'Từ chối · Cùng KH cách nhau 8 ngày',
    hint: 'Vi phạm luật cửa sổ thời gian tối đa 7 ngày.',
    badge: '2 GD · Fail 7d',
    icon: Ban,
    tone: 'danger',
  },
  {
    key: 'merge_fail_trail_24h',
    title: 'Từ chối · Chuỗi dòng tiền quá 24h',
    hint: 'Vi phạm luật chuỗi layering tối đa 24 giờ.',
    badge: '2 GD · Fail 24h',
    icon: Ban,
    tone: 'danger',
  },
  {
    key: 'merge_fail_trail_over_5',
    title: 'Từ chối · Chuỗi 6 mắt xích (> 5 hops)',
    hint: 'Test chốt chặn Anti-DoS tối đa 5 mắt xích.',
    badge: '6 GD · Fail >5',
    icon: Ban,
    tone: 'danger',
  },
];

export function ScenarioPanel({ pools, onSend, onSendBatch, batchSending }) {
  const totalSamples = Object.values(pools || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  );
  const hasFraudPool = Boolean(pools?.fraud_high?.length || pools?.mid_high?.length);

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div className="panel-heading-icon">
          <Zap size={19} />
        </div>

        <div>
          <h2>Phát sinh giao dịch</h2>
          <p className="section-intro">
            Chọn tình huống đơn lẻ hoặc chuỗi giao dịch để kiểm thử nghiệp vụ
            cảnh báo và gộp hồ sơ điều tra.
          </p>
        </div>
      </div>

      <div className="panel-summary">
        <div className="panel-summary-item">
          <span>Tình huống</span>
          <strong>{SCENARIOS.length + MERGE_DEMO_SCENARIOS.length}</strong>
        </div>

        <div className="panel-summary-item">
          <span>Mẫu khả dụng</span>
          <strong>{totalSamples.toLocaleString('vi-VN')}</strong>
        </div>
      </div>

      <div className="scenario-grid">
        {SCENARIOS.map((scenario) => {
          const count = pools?.[scenario.key]?.length ?? 0;
          const Icon = scenario.icon;

          return (
            <button
              key={scenario.key}
              type="button"
              className={`scenario scenario-${scenario.tone}`}
              disabled={!count || batchSending}
              onClick={() => onSend(scenario.key)}
              title={`${scenario.hint} (${count.toLocaleString('vi-VN')} mẫu dữ liệu)`}
            >
              <span className={`scenario-icon scenario-icon-${scenario.tone}`}>
                <Icon size={17} />
              </span>

              <span className="scenario-copy">
                <span className="scenario-title">{scenario.title}</span>
                <span className="scenario-hint">{scenario.hint}</span>
              </span>

              <span className="scenario-meta">
                <span className="scenario-count">
                  {count ? count.toLocaleString('vi-VN') : 'Hết mẫu'}
                </span>
                <Send size={14} className="scenario-send" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="form-section-heading" style={{ marginTop: 18 }}>
        <span className="form-section-number">CASE</span>
        <div>
          <strong>Kịch bản demo gộp hồ sơ (Multi-Alert)</strong>
          <small>Sinh chuỗi giao dịch có quan hệ tài khoản & mốc thời gian chuẩn</small>
        </div>
      </div>

      <div className="scenario-grid">
        {MERGE_DEMO_SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;

          return (
            <button
              key={scenario.key}
              type="button"
              className={`scenario scenario-${scenario.tone}`}
              disabled={!hasFraudPool || batchSending}
              onClick={() => onSendBatch?.(scenario.key)}
              title={scenario.hint}
            >
              <span className={`scenario-icon scenario-icon-${scenario.tone}`}>
                <Icon size={17} />
              </span>

              <span className="scenario-copy">
                <span className="scenario-title">{scenario.title}</span>
                <span className="scenario-hint">{scenario.hint}</span>
              </span>

              <span className="scenario-meta">
                <span className="scenario-count">
                  {batchSending ? 'Đang phát...' : scenario.badge}
                </span>
                <Send size={14} className="scenario-send" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="panel-note">
        <CircleHelp size={15} />
        <span>
          Các kịch bản gộp hồ sơ tự động phát 2–6 giao dịch liên tiếp có cùng
          đặc trưng gian lận để sinh Alert thật trên hệ thống chính.
        </span>
      </div>
    </div>
  );
}

// =========================================================
// AUTOMATED TRANSACTION STREAM
// =========================================================

export function StreamPanel({
  streaming,
  rate,
  setRate,
  fraudPct,
  setFraudPct,
  total,
  ready,
  onStart,
  onStop,
}) {
  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div className="panel-heading-icon">
          <RadioIcon />
        </div>

        <div>
          <h2>Vận hành luồng giao dịch</h2>
          <p className="section-intro">
            Mô phỏng Core Banking tự động phát sinh và chuyển giao dịch liên
            tục đến hệ thống tiếp nhận.
          </p>
        </div>
      </div>

      <div className="stream-status-card">
        <div className="stream-status-icon">
          <Activity size={19} />
        </div>

        <div className="stream-status-copy">
          <strong>{streaming ? 'Đang phát giao dịch' : 'Luồng đang tạm dừng'}</strong>
          <span>
            {streaming
              ? 'Hệ thống đang gửi các giao dịch theo cấu hình hiện tại.'
              : 'Thiết lập thông số trước khi bắt đầu mô phỏng.'}
          </span>
        </div>

        <span className={`stream-status-pill ${streaming ? 'running' : ''}`}>
          <span />
          {streaming ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>

      <div className="stream-config">
        <div className="stream-config-heading">
          <span>THÔNG SỐ VẬN HÀNH</span>
          <span>{total ? `${total.toLocaleString('vi-VN')} bản ghi` : 'Chưa tải dữ liệu'}</span>
        </div>

        <label className="field">
          <span className="field-label-row">
            <span>
              <Activity size={14} />
              Tốc độ phát
            </span>
            <strong>{rate} giao dịch/giây</strong>
          </span>

          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            disabled={streaming}
          />

          <span className="range-hints">
            <span>0.5 giao dịch/s</span>
            <span>5 giao dịch/s</span>
          </span>
        </label>

        <label className="field">
          <span className="field-label-row">
            <span>
              <ShieldAlert size={14} />
              Tỷ lệ giao dịch gian lận
            </span>
            <strong>{fraudPct}%</strong>
          </span>

          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={fraudPct}
            onChange={(event) => setFraudPct(Number(event.target.value))}
            disabled={streaming}
          />

          <span className="range-hints">
            <span>1%</span>
            <span>50%</span>
          </span>

          <small>
            Tỷ lệ được tăng chủ động để tạo đủ tình huống cảnh báo trong buổi
            demo, không đại diện cho tỷ lệ gian lận thực tế.
          </small>
        </label>
      </div>

      <div className="stream-preview">
        <div>
          <span>Tốc độ hiện tại</span>
          <strong>{rate} <small>giao dịch/giây</small></strong>
        </div>

        <div>
          <span>Tỷ lệ gian lận mô phỏng</span>
          <strong>{fraudPct}%</strong>
        </div>
      </div>

      {streaming ? (
        <button
          type="button"
          className="detail-primary-action detail-danger-action"
          onClick={onStop}
        >
          <Square size={16} />
          Dừng luồng giao dịch
        </button>
      ) : (
        <button
          type="button"
          className="detail-primary-action"
          onClick={onStart}
          disabled={!ready}
        >
          <Play size={16} />
          Bắt đầu phát giao dịch
        </button>
      )}

      <div className="panel-note">
        <CircleHelp size={15} />
        <span>
          Khi dừng luồng, giao dịch đang được gửi sẽ hoàn tất trước khi hệ
          thống ngừng phát giao dịch tiếp theo.
        </span>
      </div>
    </div>
  );
}

function RadioIcon() {
  return <Activity size={19} />;
}

// =========================================================
// MANUAL TRANSACTION ENTRY (OUTLOOK DATE/TIME + DOT CURRENCY)
// =========================================================

const TYPES = ['TRANSFER', 'CASH_OUT', 'PAYMENT', 'CASH_IN', 'DEBIT'];

const TIME_SLOTS_15M = Array.from({ length: 96 }, (_, idx) => {
  const h = String(Math.floor(idx / 4)).padStart(2, '0');
  const m = String((idx % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

function getVnNowParts(offsetDays = 0) {
  const vnMs = Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000;
  const d = new Date(vnMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return { dateStr: `${yyyy}-${mm}-${dd}`, timeStr: `${hh}:${min}` };
}

function parseTimeText(text) {
  const clean = String(text || '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return {
    hour: h,
    minute: m,
    normalized: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}

function isValidDateStr(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatVndInput(raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  const str = String(raw).replace(/\./g, '');
  const [intPartRaw, ...decParts] = str.split(',');
  const digits = intPartRaw.replace(/\D/g, '');
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decParts.length > 0) {
    const decDigits = decParts.join('').replace(/\D/g, '').slice(0, 2);
    return `${formattedInt || '0'},${decDigits}`;
  }
  return formattedInt;
}

function parseVndInput(formatted) {
  if (!formatted) return 0;
  const normalized = String(formatted).replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function numberToVndInput(val) {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 100) / 100;
  return formatVndInput(String(rounded).replace('.', ','));
}

const randomAccount = () =>
  `C${Math.floor(100000000 + Math.random() * 900000000)}`;

const emptyForm = () => {
  const { dateStr, timeStr } = getVnNowParts(0);
  return {
    type: 'TRANSFER',
    amountText: formatVndInput('500000'),
    txDate: dateStr,
    txTime: timeStr,
    consistent: true,
    srcAcc: randomAccount(),
    srcName: '',
    srcBeforeText: formatVndInput('5000000'),
    srcAfterText: '0',
    dstAcc: randomAccount(),
    dstBeforeText: formatVndInput('2000000'),
    dstAfterText: '0',
  };
};

export function ManualPanel({ onSend }) {
  const [form, setForm] = useState(emptyForm);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const nativeDateRef = useRef(null);
  const timeComboRef = useRef(null);
  const timeListRef = useRef(null);

  const set = (patch) =>
    setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const onOutsideClick = (event) => {
      if (timeComboRef.current && !timeComboRef.current.contains(event.target)) {
        setTimeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  useEffect(() => {
    if (!timeDropdownOpen || !timeListRef.current) return;
    const parsed = parseTimeText(form.txTime);
    const targetHour = parsed ? parsed.hour : 9;
    const approxIndex = Math.max(0, targetHour * 4 - 2);
    const btn = timeListRef.current.children[approxIndex];
    if (btn) btn.scrollIntoView({ block: 'nearest' });
  }, [timeDropdownOpen, form.txTime]);

  const amount = parseVndInput(form.amountText);
  const srcBefore = parseVndInput(form.srcBeforeText);
  const dstBefore = parseVndInput(form.dstBeforeText);

  const srcAfter = form.consistent
    ? Math.max(srcBefore - amount, 0)
    : parseVndInput(form.srcAfterText);

  const dstAfter = form.consistent
    ? dstBefore + amount
    : parseVndInput(form.dstAfterText);

  const errOrig = srcBefore - srcAfter - amount;
  const errDest = dstAfter - dstBefore - amount;

  const parsedTime = parseTimeText(form.txTime);
  const dateOk = isValidDateStr(form.txDate);

  const valid =
    dateOk &&
    Boolean(parsedTime) &&
    Number.isFinite(amount) &&
    Number.isFinite(srcBefore) &&
    Number.isFinite(dstBefore) &&
    Number.isFinite(srcAfter) &&
    Number.isFinite(dstAfter) &&
    amount >= 0.01 &&
    form.srcAcc.trim() &&
    form.dstAcc.trim() &&
    srcBefore >= 0 &&
    dstBefore >= 0 &&
    srcAfter >= 0 &&
    dstAfter >= 0;

  const preset = (kind) => {
    const { dateStr, timeStr } = getVnNowParts(0);
    if (kind === 'normal') {
      set({
        type: 'CASH_OUT',
        amountText: formatVndInput('500000'),
        txDate: dateStr,
        txTime: timeStr,
        consistent: true,
        srcBeforeText: formatVndInput('5000000'),
        dstBeforeText: formatVndInput('2000000'),
        srcAcc: randomAccount(),
        dstAcc: randomAccount(),
      });
    } else {
      set({
        type: 'TRANSFER',
        amountText: formatVndInput('3500000'),
        txDate: dateStr,
        txTime: timeStr,
        consistent: false,
        srcBeforeText: formatVndInput('3500000'),
        srcAfterText: '0',
        dstBeforeText: '0',
        dstAfterText: '0',
        srcAcc: randomAccount(),
        dstAcc: randomAccount(),
      });
    }
  };

  // Nối chuỗi dòng tiền nhanh: lấy TK đích của lệnh vừa gửi làm TK nguồn cho lệnh tiếp theo
  const chainNextHop = () => {
    set({
      srcAcc: form.dstAcc.trim() || randomAccount(),
      srcName: '',
      srcBeforeText: numberToVndInput(dstAfter > 0 ? dstAfter : amount),
      dstAcc: randomAccount(),
      dstBeforeText: '0',
      dstAfterText: '0',
    });
  };

  const handleOpenCalendar = () => {
    const el = nativeDateRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  const handleTimeBlur = () => {
    const clean = form.txTime.trim();
    // Hỗ trợ gõ nhanh 4 chữ số liền nhau như "0910" -> "09:10"
    if (/^\d{4}$/.test(clean)) {
      const candidate = `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
      const parsed = parseTimeText(candidate);
      if (parsed) {
        set({ txTime: parsed.normalized });
        return;
      }
    }
    const parsed = parseTimeText(clean);
    if (parsed) {
      set({ txTime: parsed.normalized });
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!valid || !parsedTime) return;

    const occurredAtIso = new Date(`${form.txDate}T${parsedTime.normalized}:00+07:00`).toISOString();

    onSend({
      externalRef: `MAN-${Date.now().toString(36)}`,
      occurredAt: occurredAtIso,
      hour: parsedTime.hour,
      type: form.type,
      amount,
      source: {
        accountNumber: form.srcAcc.trim(),
        holderName: form.srcName.trim() || undefined,
        balanceBefore: srcBefore,
        balanceAfter: srcAfter,
      },
      destination: {
        accountNumber: form.dstAcc.trim(),
        balanceBefore: dstBefore,
        balanceAfter: dstAfter,
      },
    });
  };

  return (
    <form className="panel-content manual-form" onSubmit={submit}>
      <div className="panel-heading">
        <div className="panel-heading-icon">
          <PenLineIcon />
        </div>

        <div>
          <h2>Khởi tạo giao dịch</h2>
          <p className="section-intro">
            Nhập thông tin giao dịch tùy chỉnh ngày, giờ lẻ và số tiền để mô
            phỏng nghiệp vụ Core Banking.
          </p>
        </div>
      </div>

      <div className="preset-row" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => preset('normal')}
        >
          <ShieldCheck size={14} />
          Mẫu bình thường
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={() => preset('fraud')}
        >
          <ShieldAlert size={14} />
          Mẫu số dư bất thường
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={chainNextHop}
          title="Chuyển tài khoản đích hiện tại thành tài khoản nguồn để tạo mắt xích MoneyTrail kế tiếp"
        >
          <Link2 size={14} />
          Nối chuỗi (Đích → Nguồn)
        </button>
      </div>

      <div className="form-section-heading">
        <span className="form-section-number">01</span>
        <div>
          <strong>Thông tin giao dịch</strong>
          <small>Transaction details</small>
        </div>
      </div>

      <div className="row-2">
        <label className="field">
          <span>Loại giao dịch</span>
          <select
            className="select-dark"
            value={form.type}
            onChange={(event) => set({ type: event.target.value })}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Số tiền giao dịch (VND)</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ví dụ: 100.000.000"
            value={form.amountText}
            onChange={(event) => set({ amountText: formatVndInput(event.target.value) })}
            required
          />
        </label>
      </div>

      {/* Bộ chọn Ngày & Giờ kiểu Outlook */}
      <div className="row-2">
        <div className="field">
          <span>
            <Calendar size={14} />
            Ngày giao dịch
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="YYYY-MM-DD"
              aria-label="Ngày giao dịch"
              value={form.txDate}
              onChange={(event) => set({ txDate: event.target.value })}
              style={{
                width: '100%',
                paddingRight: 36,
                borderColor: dateOk ? undefined : '#ef4444',
              }}
              required
            />
            <input
              ref={nativeDateRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              value={dateOk ? form.txDate : ''}
              onChange={(event) => {
                if (event.target.value) set({ txDate: event.target.value });
              }}
              style={{
                position: 'absolute',
                right: 8,
                width: 24,
                height: 24,
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleOpenCalendar}
              title="Mở lịch chọn ngày"
              aria-label="Mở lịch chọn ngày"
              style={{
                position: 'absolute',
                right: 6,
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Calendar size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '2px 7px', fontSize: 11 }}
              onClick={() => set({ txDate: getVnNowParts(0).dateStr })}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '2px 7px', fontSize: 11 }}
              onClick={() => set({ txDate: getVnNowParts(-1).dateStr })}
            >
              -1 ngày
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '2px 7px', fontSize: 11 }}
              onClick={() => set({ txDate: getVnNowParts(-8).dateStr })}
              title="Đặt lùi 8 ngày để kiểm thử luật quá cửa sổ 7 ngày"
            >
              -8 ngày
            </button>
          </div>
        </div>

        <div className="field" ref={timeComboRef} style={{ position: 'relative' }}>
          <span>
            <Clock3 size={14} />
            Giờ giao dịch (HH:mm)
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="10:01"
              aria-label="Giờ giao dịch"
              value={form.txTime}
              onChange={(event) => set({ txTime: event.target.value })}
              onBlur={handleTimeBlur}
              style={{
                width: '100%',
                paddingRight: 34,
                fontVariantNumeric: 'tabular-nums',
                borderColor: parsedTime ? undefined : '#ef4444',
              }}
              required
            />
            <button
              type="button"
              onClick={() => setTimeDropdownOpen((open) => !open)}
              title="Chọn mốc giờ cách nhau 15 phút"
              aria-label="Mở danh sách mốc giờ 15 phút"
              aria-expanded={timeDropdownOpen}
              style={{
                position: 'absolute',
                right: 4,
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 5,
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '4px 5px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {timeDropdownOpen && (
            <div
              ref={timeListRef}
              role="listbox"
              aria-label="Danh sách mốc giờ 15 phút"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: 220,
                overflowY: 'auto',
                zIndex: 50,
                backgroundColor: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                borderRadius: 8,
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                padding: 4,
              }}
            >
              {TIME_SLOTS_15M.map((slot) => {
                const isSelected = parsedTime?.normalized === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      set({ txTime: slot });
                      setTimeDropdownOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      border: 'none',
                      borderRadius: 5,
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#2563eb' : 'transparent',
                      color: isSelected ? '#ffffff' : '#e2e8f0',
                    }}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          )}

          <small style={{ color: '#94a3b8' }}>
            {parsedTime
              ? `Gõ phút lẻ (vd: 09:10) hoặc chọn mốc 15p · Khung ML: ${String(parsedTime.hour).padStart(2, '0')}h`
              : 'Định dạng hợp lệ: HH:mm (00:00 – 23:59)'}
          </small>
        </div>
      </div>

      <div className="form-section-heading">
        <span className="form-section-number">02</span>
        <div>
          <strong>Tài khoản nguồn</strong>
          <small>Source account</small>
        </div>
      </div>

      <fieldset>
        <legend>
          <Wallet size={13} /> Thông tin chủ tài khoản
        </legend>

        <label className="field">
          <span>Số tài khoản</span>
          <input
            value={form.srcAcc}
            onChange={(event) => set({ srcAcc: event.target.value })}
            required
          />
        </label>

        <label className="field">
          <span>
            <UserRound size={13} />
            Tên chủ tài khoản
            <small>(Không bắt buộc)</small>
          </span>
          <input
            value={form.srcName}
            onChange={(event) => set({ srcName: event.target.value })}
            placeholder="Nhập tên chủ tài khoản"
          />
        </label>

        <div className="row-2">
          <label className="field">
            <span>Số dư trước giao dịch</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.srcBeforeText}
              onChange={(event) => set({ srcBeforeText: formatVndInput(event.target.value) })}
              required
            />
          </label>

          <label className="field">
            <span>Số dư sau giao dịch</span>
            <input
              type="text"
              inputMode="numeric"
              disabled={form.consistent}
              value={form.consistent ? numberToVndInput(srcAfter) : form.srcAfterText}
              onChange={(event) => set({ srcAfterText: formatVndInput(event.target.value) })}
              required
            />
          </label>
        </div>
      </fieldset>

      <div className="form-section-heading">
        <span className="form-section-number">03</span>
        <div>
          <strong>Tài khoản đích</strong>
          <small>Destination account</small>
        </div>
      </div>

      <fieldset>
        <legend>
          <Wallet size={13} /> Thông tin tài khoản nhận
        </legend>

        <label className="field">
          <span>Số tài khoản</span>
          <input
            value={form.dstAcc}
            onChange={(event) => set({ dstAcc: event.target.value })}
            required
          />
        </label>

        <div className="row-2">
          <label className="field">
            <span>Số dư trước giao dịch</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.dstBeforeText}
              onChange={(event) => set({ dstBeforeText: formatVndInput(event.target.value) })}
              required
            />
          </label>

          <label className="field">
            <span>Số dư sau giao dịch</span>
            <input
              type="text"
              inputMode="numeric"
              disabled={form.consistent}
              value={form.consistent ? numberToVndInput(dstAfter) : form.dstAfterText}
              onChange={(event) => set({ dstAfterText: formatVndInput(event.target.value) })}
              required
            />
          </label>
        </div>
      </fieldset>

      <label className="check">
        <input
          type="checkbox"
          checked={form.consistent}
          onChange={(event) => set({ consistent: event.target.checked })}
        />
        <span>
          <strong>Tự động tính số dư sau giao dịch</strong>
          <small>
            Bỏ chọn nếu muốn nhập số dư bất thường để kiểm thử khả năng phát
            hiện rủi ro.
          </small>
        </span>
      </label>

      <div className="form-section-heading">
        <span className="form-section-number">04</span>
        <div>
          <strong>Kiểm tra tính nhất quán</strong>
          <small>Balance validation</small>
        </div>
      </div>

      <div className="balance-validation">
        <div className={`signal-item ${Math.abs(errOrig) > 0.001 ? 'danger' : ''}`}>
          <span>Sai lệch số dư nguồn</span>
          <strong>{money(errOrig)} VND</strong>
        </div>

        <div className={`signal-item ${Math.abs(errDest) > 0.001 ? 'danger' : ''}`}>
          <span>Sai lệch số dư đích</span>
          <strong>{money(errDest)} VND</strong>
        </div>
      </div>

      <button
        className="detail-primary-action"
        type="submit"
        disabled={!valid}
      >
        <Send size={16} />
        Gửi giao dịch đến hệ thống
      </button>

      <div className="panel-note">
        <CircleHelp size={15} />
        <span>
          Giao dịch sẽ giữ nguyên tài khoản đang nhập để bạn có thể gửi tiếp
          giao dịch liên quan hoặc bấm “Nối chuỗi”.
        </span>
      </div>
    </form>
  );
}

function PenLineIcon() {
  return <Send size={19} />;
}