import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Landmark,
  PenLine,
  Send,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import { API_BASE, HAS_KEY, escalateTransaction, sendTransaction, sleep } from './api';
import { buildMergeDemoBatch, loadSource, nextRef, pickOne, pickStreamRow, rowToPayload } from './data';
import { ManualPanel, ScenarioPanel, StreamPanel } from './panels';
import LogTable from './LogTable';
import TransactionDrawer from './TransactionDrawer';
import { LEVEL_ORDER, RiskBadge } from './ui';

const TABS = [
  { key: 'scenario', label: 'Kịch bản', icon: Zap },
  { key: 'stream', label: 'Luồng tự động', icon: Activity },
  { key: 'manual', label: 'Nhập tay', icon: PenLine },
];
const MAX_LOG = 300;

function StatsBar({ stats }) {
  const levels = LEVEL_ORDER.filter((k) => stats.levels[k]);

  return (
    <section className="telemetry-bar" aria-label="Tổng quan phiên giả lập">
      <div className="telemetry-top">
        <div className="telemetry-group">
          <div className="telemetry-metric">
            <span>Đã phát</span>
            <strong>{stats.sent.toLocaleString('vi-VN')}</strong>
          </div>
          <div className="telemetry-metric">
            <span>Thành công</span>
            <strong className="text-ok">{stats.ok.toLocaleString('vi-VN')}</strong>
          </div>
          {stats.pending > 0 && (
            <div className="telemetry-metric">
              <span>Đang gửi</span>
              <strong className="text-warn">{stats.pending}</strong>
            </div>
          )}
          <div className="telemetry-metric">
            <span>Lỗi</span>
            <strong className={stats.errors ? 'text-bad' : 'muted'}>
              {stats.errors.toLocaleString('vi-VN')}
            </strong>
          </div>
        </div>

        <div className="telemetry-group telemetry-right">
          <div className="telemetry-metric">
            <span>Cảnh báo sinh ra</span>
            <strong className="text-warn">{stats.alerts.toLocaleString('vi-VN')}</strong>
          </div>

          <span className="telemetry-divider" aria-hidden="true" />

          <div className="reconcile-strip" title="Đối chiếu nhãn thực tế trên Simulator với cảnh báo của hệ thống">
            <span className="reconcile-chip chip-caught">
              Bắt trúng: <strong>{stats.caught}</strong>
            </span>
            <span className={`reconcile-chip ${stats.missed ? 'chip-missed' : ''}`}>
              Bỏ lọt: <strong>{stats.missed}</strong>
            </span>
            <span className={`reconcile-chip ${stats.falsePos ? 'chip-fp' : ''}`}>
              Báo nhầm: <strong>{stats.falsePos}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="telemetry-bottom">
        <span className="level-strip-title">Phân bố mức rủi ro</span>
        {levels.length ? (
          <div className="level-strip-items">
            {levels.map((k) => (
              <span key={k} className="level-item">
                <RiskBadge level={k} />
                <strong>{stats.levels[k]}</strong>
              </span>
            ))}
          </div>
        ) : (
          <span className="muted">Chưa có giao dịch nào được chấm điểm</span>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [source, setSource] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('scenario');
  const [logs, setLogs] = useState([]);
  const [hideTags, setHideTags] = useState(false);
  const [banner, setBanner] = useState('');
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [escalating, setEscalating] = useState(false);

  const [streaming, setStreaming] = useState(false);
  const [rate, setRate] = useState(1);
  const [fraudPct, setFraudPct] = useState(10);
  const settings = useRef({ rate, fraudPct });
  settings.current = { rate, fraudPct };
  const running = useRef(false);
  const logId = useRef(0);

  useEffect(() => {
    loadSource().then(setSource).catch((e) => setLoadError(e.message));
    return () => { running.current = false; };
  }, []);

  const patchLog = useCallback((id, patch) => {
    setLogs((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const sendOne = useCallback(async (payload, meta) => {
    const id = ++logId.current;
    const startedAt = Date.now();
    setLogs((list) => [{
      id,
      time: new Date(),
      ref: payload.externalRef,
      type: payload.type,
      amount: payload.amount,
      customer: payload.source?.holderName || '',
      mode: meta.mode,
      tag: meta.tag,
      payload,
      groundTruth: meta.groundTruth || null,
      state: 'pending',
    }, ...list].slice(0, MAX_LOG));

    const res = await sendTransaction(payload, {
      onRetry: (n, wait) => patchLog(id, { note: `Hệ thống chấm điểm bận (503), gửi lại lần ${n} sau ${wait / 1000}s` }),
    });
    patchLog(id, { state: 'done', status: res.status, body: res.body, attempts: res.attempts, ms: Date.now() - startedAt });
    return res;
  }, [patchLog]);

  const sendScenario = (key) => {
    if (!source?.pools[key]?.length) return;
    const row = pickOne(source.pools[key]);
    const payload = rowToPayload(row, nextRef('SIM'));
    return sendOne(payload, {
      mode: 'Kịch bản',
      tag: row.demo_tag,
      groundTruth: {
        isFraud: Number(row.isFraud) === 1,
        demoTag: row.demo_tag,
        offlineScore: Number(row.model_score),
        step: row.step,
      },
    });
  };

  const [batchSending, setBatchSending] = useState(false);

  const sendMergeBatch = async (scenarioKey) => {
    if (!source || batchSending) return;
    const items = buildMergeDemoBatch(scenarioKey, source.pools);
    if (!items.length) return;

    setBatchSending(true);
    setBanner('');
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const res = await sendOne(item.payload, {
          mode: 'Kịch bản gộp',
          tag: item.tag,
          groundTruth: item.groundTruth,
        });
        if (res.status === 0 || res.status === 401) {
          setBanner(res.status === 401
            ? 'API key bị từ chối (401). Kiểm tra VITE_API_KEY trong file .env.'
            : `Không kết nối được ${API_BASE}. Kiểm tra backend đã chạy chưa.`);
          break;
        }
        if (i < items.length - 1) {
          await sleep(120);
        }
      }
    } finally {
      setBatchSending(false);
    }
  };

  const startStream = async () => {
    if (running.current || !source) return;
    running.current = true;
    setStreaming(true);
    setBanner('');
    while (running.current) {
      const { row, tag } = pickStreamRow(source.pools, settings.current.fraudPct);
      const payload = rowToPayload(row, nextRef('SIM'));
      const res = await sendOne(payload, {
        mode: 'Luồng',
        tag,
        groundTruth: {
          isFraud: Number(row.isFraud) === 1,
          demoTag: row.demo_tag,
          offlineScore: Number(row.model_score),
          step: row.step,
        },
      });
      if (res.status === 0 || res.status === 401) {
        running.current = false;
        setBanner(res.status === 401
          ? 'API key bị từ chối (401). Kiểm tra VITE_API_KEY trong file .env.'
          : `Không kết nối được ${API_BASE}. Kiểm tra backend đã chạy chưa.`);
      } else {
        await sleep(1000 / settings.current.rate);
      }
    }
    setStreaming(false);
  };
  const stopStream = () => { running.current = false; };

  // Chờ nối API Backend ở Phần 3 để tạo Alert hậu kiểm thật trên hệ thống chính
  const handleEscalate = async (log) => {
    const txId = log.body?.transactionId;
    if (!txId) {
      patchLog(log.id, { escalateNote: 'Không tìm thấy mã TransactionId từ phản hồi API.' });
      return;
    }

    setEscalating(true);
    try {
      const res = await escalateTransaction(
        txId,
        log.groundTruth?.isFraud
          ? 'Giao dịch gian lận bị ML bỏ sót — chuyển hậu kiểm'
          : 'Yêu cầu kiểm tra hậu kiểm thủ công từ Simulator',
      );

      if ((res.status === 201 || res.status === 200) && res.body?.alertId) {
        patchLog(log.id, {
          manualAlertId: res.body.alertId,
          manualAlertLevel: res.body.riskLevel,
          escalateNote: `Đã tạo thành công Alert #${res.body.alertId} (${res.body.riskLevel}) trên hệ thống quản lý rủi ro.`,
        });
      } else {
        patchLog(log.id, {
          escalateNote: res.body?.message || 'Không thể tạo Alert hậu kiểm. Kiểm tra lại kết nối Backend.',
        });
      }
    } finally {
      setEscalating(false);
    }
  };

const stats = useMemo(() => {
    const s = { sent: 0, ok: 0, pending: 0, alerts: 0, errors: 0, levels: {}, caught: 0, missed: 0, falsePos: 0 };
    for (const l of logs) {
      if (l.state === 'pending') {
        s.pending += 1;
        continue;
      }
      if (l.state !== 'done') continue;
      s.sent += 1;
      if (l.status === 201 || l.status === 200) s.ok += 1; else s.errors += 1;
      if (l.status === 201 || l.status === 200) {
        const hasAlert = Boolean(l.body?.alertId || l.manualAlertId);
        if (l.status === 201) {
          if (hasAlert) s.alerts += 1;
          const level = l.body?.scored ? l.body.riskLevel : 'NoMl';
          s.levels[level] = (s.levels[level] || 0) + 1;
        }
        if (l.groundTruth) {
          if (l.groundTruth.isFraud && hasAlert) s.caught += 1;
          else if (l.groundTruth.isFraud && !hasAlert) s.missed += 1;
          else if (!l.groundTruth.isFraud && hasAlert) s.falsePos += 1;
        }
      }
    }
    return s;
  }, [logs]);

  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedLogId) || null,
    [logs, selectedLogId],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Landmark size={22} /></div>
          <div>
            <h1>Core Banking Simulator</h1>
          </div>
        </div>

        <div className="conn">
          <span className={`pill ${HAS_KEY ? 'pill-ok' : 'pill-bad'}`}>
            <span className="pill-dot" />
            {HAS_KEY ? 'Đã có API key' : 'Thiếu API key'}
          </span>
          <span className={`pill ${streaming ? 'pill-live' : 'pill-idle'}`}>
            <span className="pill-dot" />
            {streaming ? 'Đang phát' : 'Nhàn rỗi'}
          </span>
        </div>
      </header>

      {!HAS_KEY && (
        <div className="notice" role="alert">
          <AlertTriangle size={16} />
          <span>Chưa có <code>VITE_API_KEY</code>. Sao chép <code>.env.example</code> thành <code>.env</code>, điền khoá rồi khởi động lại <code>npm run dev</code>.</span>
        </div>
      )}
      {loadError && <div className="notice" role="alert"><AlertTriangle size={16} /><span>{loadError}</span></div>}
      {banner && <div className="notice" role="alert"><AlertTriangle size={16} /><span>{banner}</span></div>}

      <main className="layout">
        <aside className="panel controls" aria-label="Điều khiển">
          <div className="tabs" role="tablist">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`tab ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {tab === 'scenario' && (
            <ScenarioPanel
              pools={source?.pools}
              onSend={sendScenario}
              onSendBatch={sendMergeBatch}
              batchSending={batchSending}
            />
          )}
          {tab === 'stream' && (
            <StreamPanel
              streaming={streaming}
              rate={rate}
              setRate={setRate}
              fraudPct={fraudPct}
              setFraudPct={setFraudPct}
              total={source?.total}
              ready={!!source}
              onStart={startStream}
              onStop={stopStream}
            />
          )}
          {tab === 'manual' && <ManualPanel onSend={(p) => sendOne(p, { mode: 'Nhập tay', tag: null })} />}
        </aside>

        <div className="results">
          <StatsBar stats={stats} />
          <LogTable
            logs={logs}
            hideTags={hideTags}
            setHideTags={setHideTags}
            onClear={() => {
              setLogs([]);
              setSelectedLogId(null);
            }}
            onSelectLog={(log) => setSelectedLogId(log.id)}
          />
        </div>
      </main>

      <TransactionDrawer
        log={selectedLog}
        onClose={() => setSelectedLogId(null)}
        onEscalate={handleEscalate}
        escalating={escalating}
      />
    </div>
  );
}