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
export function rowToPayload(row, externalRef, customOccurredAt = null) {
  const dateObj = customOccurredAt ? new Date(customOccurredAt) : new Date();
  const hour = customOccurredAt
    ? (dateObj.getUTCHours() + 7) % 24
    : Number(row.step) % 24;

  return {
    externalRef,
    occurredAt: dateObj.toISOString(),
    hour,
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

const randAcc = () => `C${Math.floor(100000000 + Math.random() * 900000000)}`;

// ---- Sinh chuỗi giao dịch mẫu để demo tính năng Gộp Case (Hợp lệ & Bị từ chối) ----
export function buildMergeDemoBatch(scenarioKey, pools) {
  const sourcePool = pools?.fraud_high?.length ? pools.fraud_high : pools?.mid_high || [];
  if (!sourcePool.length) return [];

  const baseRow = pickOne(sourcePool);
  const nowMs = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  const makeItem = (nameOrig, nameDest, offsetMs, prefix) => {
    const customRow = {
      ...baseRow,
      nameOrig,
      nameDest,
    };
    const occurredAt = new Date(nowMs + offsetMs).toISOString();
    return {
      payload: rowToPayload(customRow, nextRef(prefix), occurredAt),
      tag: baseRow.demo_tag || 'fraud_high',
      groundTruth: {
        isFraud: true,
        demoTag: baseRow.demo_tag || 'fraud_high',
        offlineScore: Number(baseRow.model_score || 0.99),
        step: baseRow.step,
      },
    };
  };

  switch (scenarioKey) {
    case 'merge_same_customer': {
      // 3 giao dịch cùng 1 khách hàng trong vòng 10 phút -> Hợp lệ (SameCustomer)
      const victim = randAcc();
      return [
        makeItem(victim, randAcc(), -10 * min, 'MCUST'),
        makeItem(victim, randAcc(), -5 * min, 'MCUST'),
        makeItem(victim, randAcc(), 0, 'MCUST'),
      ];
    }

    case 'merge_same_dest': {
      // 3 khách hàng khác nhau chuyển về cùng 1 tài khoản đích trong 2 giờ -> Hợp lệ (SameDestination)
      const mule = randAcc();
      return [
        makeItem(randAcc(), mule, -2 * hour, 'MMULE'),
        makeItem(randAcc(), mule, -1 * hour, 'MMULE'),
        makeItem(randAcc(), mule, 0, 'MMULE'),
      ];
    }

    case 'merge_money_trail': {
      // Chuỗi dòng tiền A -> B -> C -> D trong 30 phút -> Hợp lệ (MoneyTrail)
      const a = randAcc();
      const b = randAcc();
      const c = randAcc();
      const d = randAcc();
      return [
        makeItem(a, b, -30 * min, 'MTRAIL'),
        makeItem(b, c, -15 * min, 'MTRAIL'),
        makeItem(c, d, 0, 'MTRAIL'),
      ];
    }

    case 'merge_fail_over_7d': {
      // Cùng khách hàng nhưng cách nhau 8 ngày -> Bị từ chối (Quá 7 ngày)
      const victim = randAcc();
      return [
        makeItem(victim, randAcc(), -8 * day, 'FAIL7D'),
        makeItem(victim, randAcc(), 0, 'FAIL7D'),
      ];
    }

    case 'merge_fail_trail_24h': {
      // Chuỗi A -> B -> C nhưng cách nhau 26 giờ -> Bị từ chối (Quá 24h)
      const a = randAcc();
      const b = randAcc();
      const c = randAcc();
      return [
        makeItem(a, b, -26 * hour, 'FAIL24H'),
        makeItem(b, c, 0, 'FAIL24H'),
      ];
    }

    case 'merge_fail_trail_over_5': {
      // Chuỗi 6 giao dịch liên tiếp (6 hops) -> Bị từ chối ngay (Tối đa 5 mắt xích)
      const accs = Array.from({ length: 7 }, () => randAcc());
      return Array.from({ length: 6 }, (_, idx) =>
        makeItem(accs[idx], accs[idx + 1], -(5 - idx) * 10 * min, 'FAIL6H'),
      );
    }

    default:
      return [];
  }
}