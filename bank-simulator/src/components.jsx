// import { useState } from 'react';

// export const LEVELS = {
//   Critical: { label: 'Nghiêm trọng', color: '#ef4444' },
//   High: { label: 'Cao', color: '#f97316' },
//   Medium: { label: 'Trung bình', color: '#f59e0b' },
//   Low: { label: 'Thấp', color: '#22c55e' },
//   Safe: { label: 'An toàn', color: '#64748b' },
//   NoMl: { label: 'Không qua ML', color: '#94a3b8' },
// };

// export const TAGS = {
//   fraud_high: 'Gian lận rõ', fraud_mid: 'Gian lận điểm giữa', missed_fraud: 'Gian lận bị sót',
//   false_positive: 'Báo nhầm', normal: 'Bình thường', rule_only: 'Loại khác',
// };

// const money = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// function LevelChip({ level }) {
//   const cfg = LEVELS[level] || { label: level, color: '#94a3b8' };
//   return <span className="chip" style={{ color: cfg.color, borderColor: `${cfg.color}55`, background: `${cfg.color}1f` }}>{cfg.label}</span>;
// }

// // ───────── Kịch bản ─────────
// const SCENARIOS = [
//   { key: 'fraud_high', title: 'Gian lận rõ ràng', hint: 'Điểm cao: cảnh báo Cao hoặc Nghiêm trọng' },
//   { key: 'mid_low', title: 'Gian lận điểm giữa, số tiền nhỏ', hint: 'Cảnh báo mức Thấp' },
//   { key: 'mid_high', title: 'Gian lận điểm giữa, số tiền lớn', hint: 'Cảnh báo mức Trung bình' },
//   { key: 'missed_fraud', title: 'Gian lận bị mô hình bỏ sót', hint: 'Không có cảnh báo, minh hoạ giới hạn của ML' },
//   { key: 'false_positive', title: 'Giao dịch thường bị báo nhầm', hint: 'Cảnh báo giả, để thử đóng alert' },
//   { key: 'normal', title: 'Giao dịch bình thường', hint: 'Không tạo cảnh báo' },
//   { key: 'rule_only', title: 'Loại giao dịch khác', hint: 'PAYMENT, CASH_IN, DEBIT: không qua mô hình' },
// ];

// export function ScenarioTab({ pools, onSend }) {
//   return (
//     <div>
//       <p className="tab-intro">Mỗi lần bấm sẽ gửi một giao dịch thật, lấy ngẫu nhiên từ tập kiểm thử của mô hình (mô hình chưa từng thấy các dòng này).</p>
//       <div className="scenario-grid">
//         {SCENARIOS.map((s) => {
//           const count = pools?.[s.key]?.length ?? 0;
//           return (
//             <button key={s.key} className="scenario" disabled={!count} onClick={() => onSend(s.key)}>
//               <span className="scenario-title">{s.title}</span>
//               <span className="scenario-hint">{s.hint}</span>
//               <span className="scenario-count">{count.toLocaleString('vi-VN')} mẫu</span>
//             </button>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// // ───────── Luồng tự động ─────────
// export function StreamTab({ streaming, rate, setRate, fraudPct, setFraudPct, total, ready, onStart, onStop }) {
//   return (
//     <div className="stream">
//       <p className="tab-intro">Phát liên tục các giao dịch từ tập kiểm thử, lần lượt từng giao dịch. {total ? `Có ${total.toLocaleString('vi-VN')} dòng khả dụng.` : ''}</p>

//       <label className="field">
//         <span>Tốc độ: <strong>{rate} giao dịch/giây</strong></span>
//         <input type="range" min="0.5" max="5" step="0.5" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
//       </label>

//       <label className="field">
//         <span>Tỷ lệ gian lận trong luồng: <strong>{fraudPct}%</strong></span>
//         <input type="range" min="1" max="50" step="1" value={fraudPct} onChange={(e) => setFraudPct(Number(e.target.value))} />
//         <small>Ngoài đời chỉ khoảng 0,13%. Để cao hơn thì mới có nhiều cảnh báo để quan sát trong buổi demo.</small>
//       </label>

//       {streaming
//         ? <button className="btn btn-stop" onClick={onStop}>Dừng luồng</button>
//         : <button className="btn btn-primary" onClick={onStart} disabled={!ready}>Bắt đầu phát</button>}
//     </div>
//   );
// }

// // ───────── Nhập tay ─────────
// const TYPES = ['TRANSFER', 'CASH_OUT', 'PAYMENT', 'CASH_IN', 'DEBIT'];
// const vnHour = () => (new Date().getUTCHours() + 7) % 24;
// const randomAccount = () => `C${Math.floor(100000000 + Math.random() * 900000000)}`;
// const num = (v) => (v === '' || v === null ? 0 : Number(v));

// const emptyForm = () => ({
//   type: 'TRANSFER', amount: '500000', hour: vnHour(), consistent: true,
//   srcAcc: randomAccount(), srcName: '', srcBefore: '5000000', srcAfter: '0',
//   dstAcc: randomAccount(), dstBefore: '2000000', dstAfter: '0',
// });

// export function ManualTab({ onSend }) {
//   const [f, setF] = useState(emptyForm);
//   const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

//   const amount = num(f.amount);
//   const srcBefore = num(f.srcBefore);
//   const dstBefore = num(f.dstBefore);
//   const srcAfter = f.consistent ? Math.max(srcBefore - amount, 0) : num(f.srcAfter);
//   const dstAfter = f.consistent ? dstBefore + amount : num(f.dstAfter);
//   const errOrig = srcBefore - srcAfter - amount;
//   const errDest = dstAfter - dstBefore - amount;
//   const valid = amount >= 0.01 && f.srcAcc.trim() && f.dstAcc.trim() && srcBefore >= 0 && dstBefore >= 0 && srcAfter >= 0 && dstAfter >= 0;

//   const preset = (kind) => {
//     if (kind === 'normal') {
//       set({ type: 'CASH_OUT', amount: '500000', consistent: true, srcBefore: '5000000', dstBefore: '2000000', srcAcc: randomAccount(), dstAcc: randomAccount() });
//     } else {
//       set({ type: 'TRANSFER', amount: '3500000', consistent: false, srcBefore: '3500000', srcAfter: '0',
//         dstBefore: '0', dstAfter: '0', srcAcc: randomAccount(), dstAcc: randomAccount() });
//     }
//   };

//   const submit = (e) => {
//     e.preventDefault();
//     if (!valid) return;
//     onSend({
//       externalRef: `MAN-${Date.now().toString(36)}`,
//       occurredAt: new Date().toISOString(),
//       hour: Number(f.hour),
//       type: f.type,
//       amount,
//       source: { accountNumber: f.srcAcc.trim(), holderName: f.srcName.trim() || undefined, balanceBefore: srcBefore, balanceAfter: srcAfter },
//       destination: { accountNumber: f.dstAcc.trim(), balanceBefore: dstBefore, balanceAfter: dstAfter },
//     });
//     set({ srcAcc: randomAccount(), dstAcc: randomAccount() });
//   };

//   return (
//     <form className="manual" onSubmit={submit}>
//       <div className="preset-row">
//         <button type="button" className="btn btn-ghost" onClick={() => preset('normal')}>Mẫu bình thường</button>
//         <button type="button" className="btn btn-ghost" onClick={() => preset('fraud')}>Mẫu rút sạch tài khoản</button>
//       </div>

//       <div className="row-3">
//         <label className="field"><span>Loại giao dịch</span>
//           <select value={f.type} onChange={(e) => set({ type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
//         </label>
//         <label className="field"><span>Số tiền (đ)</span>
//           <input inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
//         </label>
//         <label className="field"><span>Giờ (0–23)</span>
//           <select value={f.hour} onChange={(e) => set({ hour: e.target.value })}>
//             {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
//           </select>
//         </label>
//       </div>

//       <fieldset>
//         <legend>Tài khoản nguồn</legend>
//         <div className="row-2">
//           <label className="field"><span>Số tài khoản</span><input value={f.srcAcc} onChange={(e) => set({ srcAcc: e.target.value })} /></label>
//           <label className="field"><span>Tên chủ tài khoản (tuỳ chọn)</span><input value={f.srcName} onChange={(e) => set({ srcName: e.target.value })} /></label>
//         </div>
//         <div className="row-2">
//           <label className="field"><span>Số dư trước</span><input inputMode="decimal" value={f.srcBefore} onChange={(e) => set({ srcBefore: e.target.value })} /></label>
//           <label className="field"><span>Số dư sau</span>
//             <input inputMode="decimal" disabled={f.consistent} value={f.consistent ? srcAfter : f.srcAfter} onChange={(e) => set({ srcAfter: e.target.value })} />
//           </label>
//         </div>
//       </fieldset>

//       <fieldset>
//         <legend>Tài khoản đích</legend>
//         <label className="field"><span>Số tài khoản</span><input value={f.dstAcc} onChange={(e) => set({ dstAcc: e.target.value })} /></label>
//         <div className="row-2">
//           <label className="field"><span>Số dư trước</span><input inputMode="decimal" value={f.dstBefore} onChange={(e) => set({ dstBefore: e.target.value })} /></label>
//           <label className="field"><span>Số dư sau</span>
//             <input inputMode="decimal" disabled={f.consistent} value={f.consistent ? dstAfter : f.dstAfter} onChange={(e) => set({ dstAfter: e.target.value })} />
//           </label>
//         </div>
//       </fieldset>

//       <label className="check">
//         <input type="checkbox" checked={f.consistent} onChange={(e) => set({ consistent: e.target.checked })} />
//         <span>Tự tính số dư sau cho khớp số tiền (giao dịch hợp lệ). Bỏ chọn để nhập số dư lệch và tạo bất thường.</span>
//       </label>

//       <div className="preview">
//         <div className={errOrig !== 0 ? 'bad' : ''}>Sai lệch số dư nguồn: <strong>{money(errOrig)}</strong></div>
//         <div className={errDest !== 0 ? 'bad' : ''}>Sai lệch số dư đích: <strong>{money(errDest)}</strong></div>
//       </div>

//       <button className="btn btn-primary" type="submit" disabled={!valid}>Gửi giao dịch</button>
//     </form>
//   );
// }

// // ───────── Thống kê và nhật ký ─────────
// export function StatsBar({ stats }) {
//   const order = ['Critical', 'High', 'Medium', 'Low', 'Safe', 'NoMl'];
//   return (
//     <div className="stats">
//       <div className="stat"><span>Đã gửi</span><strong>{stats.sent}</strong></div>
//       <div className="stat"><span>Thành công</span><strong>{stats.ok}</strong></div>
//       <div className="stat"><span>Cảnh báo mới</span><strong>{stats.alerts}</strong></div>
//       <div className={`stat ${stats.errors ? 'stat-bad' : ''}`}><span>Lỗi</span><strong>{stats.errors}</strong></div>
//       <div className="stat-levels">
//         {order.filter((k) => stats.levels[k]).map((k) => (
//           <span key={k} className="lvl"><LevelChip level={k} /> {stats.levels[k]}</span>
//         ))}
//       </div>
//     </div>
//   );
// }

// function StatusCell({ log }) {
//   if (log.state === 'pending') return <span className="chip chip-muted">{log.note ? 'Đang thử lại' : 'Đang gửi'}</span>;
//   const { status } = log;
//   if (status === 201) return <span className="chip chip-ok" title="Đã nhận và chấm điểm">201 Mới</span>;
//   if (status === 200) return <span className="chip chip-info" title="Mã tham chiếu đã tồn tại, không ghi lại">200 Trùng</span>;
//   if (status === 0) return <span className="chip chip-bad">Mất kết nối</span>;
//   return <span className="chip chip-bad">{status}</span>;
// }

// function ResultCell({ log }) {
//   if (log.state === 'pending') return <span className="muted">{log.note || '…'}</span>;
//   const b = log.body;
//   if (log.status === 201 || log.status === 200) {
//     if (!b?.scored) return <LevelChip level="NoMl" />;
//     return (
//       <>
//         <LevelChip level={b.riskLevel} />
//         <span className="score">{Math.round(b.riskScore * 100)}%</span>
//         {b.alertId ? <span className="alert-id">Alert #{b.alertId}</span> : <span className="muted">không cảnh báo</span>}
//       </>
//     );
//   }
//   const detail = b?.errors?.[0] || b?.message || (log.status === 0 ? 'Không kết nối được máy chủ' : 'Lỗi không xác định');
//   return <span className="err">{detail}{log.attempts > 1 ? ` (đã thử ${log.attempts} lần)` : ''}</span>;
// }

// export function LogPanel({ logs, hideTags, setHideTags, onClear }) {
//   return (
//     <div className="logwrap">
//       <div className="log-head">
//         <h2>Nhật ký giao dịch</h2>
//         <div className="log-actions">
//           <label className="check check-inline">
//             <input type="checkbox" checked={hideTags} onChange={(e) => setHideTags(e.target.checked)} />
//             <span>Ẩn nhãn kịch bản</span>
//           </label>
//           <button className="btn btn-ghost" onClick={onClear} disabled={!logs.length}>Xoá nhật ký</button>
//         </div>
//       </div>

//       {!logs.length ? (
//         <p className="empty">Chưa có giao dịch nào. Chọn một kịch bản hoặc bắt đầu phát luồng tự động.</p>
//       ) : (
//         <div className="table-scroll" role="region" aria-label="Nhật ký" tabIndex={0}>
//           <table>
//             <thead>
//               <tr>
//                 <th>Giờ</th><th>Mã tham chiếu</th><th>Loại</th><th className="num">Số tiền</th>
//                 {!hideTags && <th>Nhãn</th>}
//                 <th>Trạng thái</th><th>Kết quả</th>
//               </tr>
//             </thead>
//             <tbody>
//               {logs.map((l) => (
//                 <tr key={l.id}>
//                   <td className="mono">{l.time.toLocaleTimeString('vi-VN')}</td>
//                   <td className="mono ref" title={l.ref}>{l.ref}</td>
//                   <td>{l.type}</td>
//                   <td className="num">{money(l.amount)}</td>
//                   {!hideTags && <td className="muted">{l.tag ? TAGS[l.tag] || l.tag : l.mode}</td>}
//                   <td><StatusCell log={l} /></td>
//                   <td><ResultCell log={l} /></td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// }
