import { useState } from 'react';
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

export function ScenarioPanel({ pools, onSend }) {
  const totalSamples = Object.values(pools || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  );

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div className="panel-heading-icon">
          <Zap size={19} />
        </div>

        <div>
          <h2>Phát sinh giao dịch</h2>
          <p className="section-intro">
            Chọn một tình huống nghiệp vụ để tạo và gửi giao dịch sang hệ thống
            quản lý rủi ro.
          </p>
        </div>
      </div>

      <div className="panel-summary">
        <div className="panel-summary-item">
          <span>Tình huống</span>
          <strong>{SCENARIOS.length}</strong>
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
              disabled={!count}
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

      <div className="panel-note">
        <CircleHelp size={15} />
        <span>
          Mỗi lần thao tác sẽ chọn ngẫu nhiên một bản ghi trong tập dữ liệu
          kiểm thử. Thông tin nhãn gian lận không được gửi sang backend.
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
// MANUAL TRANSACTION ENTRY
// =========================================================

const TYPES = ['TRANSFER', 'CASH_OUT', 'PAYMENT', 'CASH_IN', 'DEBIT'];

const vnHour = () => (new Date().getUTCHours() + 7) % 24;

const randomAccount = () =>
  `C${Math.floor(100000000 + Math.random() * 900000000)}`;

const num = (value) =>
  value === '' || value === null ? 0 : Number(value);

const emptyForm = () => ({
  type: 'TRANSFER',
  amount: '500000',
  hour: vnHour(),
  consistent: true,
  srcAcc: randomAccount(),
  srcName: '',
  srcBefore: '5000000',
  srcAfter: '0',
  dstAcc: randomAccount(),
  dstBefore: '2000000',
  dstAfter: '0',
});

export function ManualPanel({ onSend }) {
  const [form, setForm] = useState(emptyForm);

  const set = (patch) =>
    setForm((current) => ({ ...current, ...patch }));

  const amount = num(form.amount);
  const srcBefore = num(form.srcBefore);
  const dstBefore = num(form.dstBefore);

  const srcAfter = form.consistent
    ? Math.max(srcBefore - amount, 0)
    : num(form.srcAfter);

  const dstAfter = form.consistent
    ? dstBefore + amount
    : num(form.dstAfter);

  const errOrig = srcBefore - srcAfter - amount;
  const errDest = dstAfter - dstBefore - amount;

  const valid =
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
    if (kind === 'normal') {
      set({
        type: 'CASH_OUT',
        amount: '500000',
        consistent: true,
        srcBefore: '5000000',
        dstBefore: '2000000',
        srcAcc: randomAccount(),
        dstAcc: randomAccount(),
      });
    } else {
      set({
        type: 'TRANSFER',
        amount: '3500000',
        consistent: false,
        srcBefore: '3500000',
        srcAfter: '0',
        dstBefore: '0',
        dstAfter: '0',
        srcAcc: randomAccount(),
        dstAcc: randomAccount(),
      });
    }
  };

  const submit = (event) => {
    event.preventDefault();

    if (!valid) return;

    onSend({
      externalRef: `MAN-${Date.now().toString(36)}`,
      occurredAt: new Date().toISOString(),
      hour: Number(form.hour),
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

    set({
      srcAcc: randomAccount(),
      dstAcc: randomAccount(),
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
            Nhập thông tin giao dịch như một thao tác nghiệp vụ tại hệ thống
            ngân hàng.
          </p>
        </div>
      </div>

      <div className="preset-row">
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
            type="number"
            min="0.01"
            step="any"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => set({ amount: event.target.value })}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>
          <Clock3 size={14} />
          Giờ giao dịch
        </span>

        <select
          className="select-dark"
          value={form.hour}
          onChange={(event) => set({ hour: event.target.value })}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>

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
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.srcBefore}
              onChange={(event) => set({ srcBefore: event.target.value })}
              required
            />
          </label>

          <label className="field">
            <span>Số dư sau giao dịch</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              disabled={form.consistent}
              value={form.consistent ? srcAfter : form.srcAfter}
              onChange={(event) => set({ srcAfter: event.target.value })}
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
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.dstBefore}
              onChange={(event) => set({ dstBefore: event.target.value })}
              required
            />
          </label>

          <label className="field">
            <span>Số dư sau giao dịch</span>
            <input
              type="number"
              min="0"
              step="any"
              disabled={form.consistent}
              value={form.consistent ? dstAfter : form.dstAfter}
              onChange={(event) => set({ dstAfter: event.target.value })}
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
          Giao dịch sẽ được tạo mã tham chiếu riêng và gửi đến API tiếp nhận
          giao dịch của FraudRiskMgmt.
        </span>
      </div>
    </form>
  );
}

function PenLineIcon() {
  return <Send size={19} />;
}