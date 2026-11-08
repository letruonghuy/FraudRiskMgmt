import { Cpu } from 'lucide-react';
import { FEATURE_META, ML_MODEL_INFO, computeFeatures } from './mlExplain';
import { RISK_CONFIG, formatCurrency, toRiskPercent } from './alertShared';

const MONEY_KEYS = new Set(['errorBalanceOrig', 'errorBalanceDest', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest', 'amount']);

function formatFeature(key, value) {
  if (value === null || value === undefined) return '—';
  if (key === 'hour') return `${String(value).padStart(2, '0')}:00`;
  if (MONEY_KEYS.has(key)) return formatCurrency(value);
  return String(value);
}

export default function MlExplanation({ alert }) {
  const features = computeFeatures(alert);
  const score = Number(alert.riskScore) || 0;
  const scorePct = toRiskPercent(score);
  const scoreLabel = (score * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const thresholdPct = Math.round(ML_MODEL_INFO.threshold * 100);
  const levelLabel = RISK_CONFIG[alert.riskLevel]?.label;
  const maxImportance = Math.max(...FEATURE_META.map((f) => f.importance));
  const rows = [...FEATURE_META].sort((a, b) => b.importance - a.importance);

  return (
    <section className="detail-section" aria-labelledby="ml-heading">
      <div className="detail-section-heading">
        <div>
          <p className="detail-eyebrow">Mô hình học máy</p>
          <h2 id="ml-heading">Vì sao hệ thống cảnh báo?</h2>
        </div>
        <span className="detail-type-tag"><Cpu size={13} aria-hidden="true" /> {ML_MODEL_INFO.name}</span>
      </div>

      <p className="ml-verdict">
        Điểm rủi ro <strong>{scoreLabel}%</strong> đạt ngưỡng <strong>{thresholdPct}%</strong> mà mô hình dùng để đánh dấu
        giao dịch đáng ngờ{levelLabel ? ` (mức ${levelLabel})` : ''}. Hệ thống tạo cảnh báo để điều tra viên xem xét, không tự kết luận.
      </p>
      <div className="ml-threshold" aria-hidden="true">
        <span className="ml-threshold-fill" style={{ width: `${scorePct}%` }} />
        <span className="ml-threshold-mark" style={{ left: `${thresholdPct}%` }} />
      </div>
      <p className="case-empty ml-note">
        Vạch đứng {thresholdPct}%: ngưỡng tạo cảnh báo, chọn bằng F1 lớn nhất trên tập validation.
      </p>

      <div className="detail-table-scroll" role="region" aria-label="Đặc trưng đầu vào của mô hình" tabIndex={0}>
        <table className="detail-balance-table ml-table">
          <thead>
            <tr>
              <th scope="col">Đặc trưng</th>
              <th scope="col">Giá trị của giao dịch này</th>
              <th scope="col">Mức ảnh hưởng chung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((feature) => (
              <tr key={feature.key} title={feature.hint}>
                <th scope="row">{feature.label}</th>
                <td>{formatFeature(feature.key, features[feature.key])}</td>
                <td>
                  <span className="ml-importance">
                    <span className="ml-importance-track" aria-hidden="true">
                      <span style={{ width: `${(feature.importance / maxImportance) * 100}%` }} />
                    </span>
                    {(feature.importance * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="case-empty ml-note">
        “Mức ảnh hưởng chung” là độ quan trọng của đặc trưng đối với toàn bộ mô hình, không phải phần đóng góp riêng cho cảnh báo này.
        Mô hình được huấn luyện trên {ML_MODEL_INFO.trainedOn}.
      </p>
    </section>
  );
}