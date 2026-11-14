import Papa from 'papaparse';

// Khớp RiskPolicy:LargeAmount của backend, chỉ dùng để chia kịch bản "điểm giữa" thành Thấp / Trung bình
export const LARGE_AMOUNT = 1_500_000;

export async function loadSource() {
  const res = await fetch('/simulator_source.csv');
  if (!res.ok) throw new Error('Không tìm thấy simulator_source.csv. Chạy "npm run sync-data" hoặc chép file vào thư mục public/.');
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });

  // API yêu cầu số tiền tối thiểu 0,01 nên bỏ các dòng có số tiền 0
  const rows = data.filter((r) => Number(r.amount) >= 0.01 && r.type && r.nameOrig && r.nameDest);

  const pools = { fraud_high: [], fraud_mid: [], missed_fraud: [], false_positive: [], normal: [], rule_only: [] };
  for (const r of rows) (pools[r.demo_tag] ||= []).push(r);
  pools.mid_low = pools.fraud_mid.filter((r) => Number(r.amount) < LARGE_AMOUNT);
  pools.mid_high = pools.fraud_mid.filter((r) => Number(r.amount) >= LARGE_AMOUNT);
  return { total: rows.length, pools };
}

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export { pickOne };

// Chọn dòng cho luồng tự động. Tỷ lệ gian lận do người vận hành chỉnh (mặc định cao hơn thực tế để dễ quan sát).
export function pickStreamRow(pools, fraudPct) {
  const weighted = (list) => {
    const r = Math.random() * 100;
    let acc = 0;
    for (const [tag, weight] of list) {
      acc += weight;
      if (r < acc && pools[tag]?.length) return tag;
    }
    return list.find(([tag]) => pools[tag]?.length)?.[0];
  };
  const tag = Math.random() * 100 < fraudPct
    ? weighted([['fraud_high', 90], ['fraud_mid', 8], ['missed_fraud', 2]])
    : weighted([['normal', 92], ['rule_only', 8]]);
  return { row: pickOne(pools[tag]), tag };
}

// ---- Tên chủ tài khoản: sinh cố định theo số tài khoản, để cùng một tài khoản luôn ra cùng một tên ----
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Minh', 'Thanh', 'Ngọc', 'Anh', 'Gia', 'Bảo', 'Hữu', 'Quốc'];
const TEN = ['An', 'Bình', 'Cường', 'Dũng', 'Hà', 'Hải', 'Hạnh', 'Hiếu', 'Hùng', 'Lan', 'Linh', 'Long', 'Mai', 'Nam',
  'Phúc', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến'];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function holderName(account) {
  const h = hash(String(account));
  return `${HO[h % HO.length]} ${DEM[(h >>> 5) % DEM.length]} ${TEN[(h >>> 11) % TEN.length]}`;
}

// ---- Biến một dòng PaySim thành yêu cầu gửi cho core banking ----
// Chỉ gửi thông tin mà một ngân hàng thật có: loại giao dịch, số tiền và số dư hai tài khoản trước/sau.
// Không bao giờ gửi isFraud, model_score hay demo_tag.
export function rowToPayload(row, externalRef) {
  return {
    externalRef,
    occurredAt: new Date().toISOString(),
    hour: Number(row.step) % 24,          // đồng hồ mô phỏng của PaySim, đúng với mô hình đã huấn luyện
    type: row.type,
    amount: Number(row.amount),
    source: {
      accountNumber: String(row.nameOrig),
      holderName: holderName(row.nameOrig),
      balanceBefore: Number(row.oldbalanceOrg),
      balanceAfter: Number(row.newbalanceOrig),
    },
    destination: {
      accountNumber: String(row.nameDest),
      balanceBefore: Number(row.oldbalanceDest),
      balanceAfter: Number(row.newbalanceDest),
    },
  };
}

const runId = Date.now().toString(36);
let seq = 0;
export const nextRef = (prefix) => `${prefix}-${runId}-${String(++seq).padStart(5, '0')}`;
