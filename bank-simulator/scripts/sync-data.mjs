// Chép simulator_source.csv từ fraud-detection-ml/data vào public/ trước khi chạy.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../fraud-detection-ml/data/simulator_source.csv');
const target = resolve(here, '../public/simulator_source.csv');

mkdirSync(dirname(target), { recursive: true });
if (existsSync(source)) {
  copyFileSync(source, target);
  console.log('Đã chép simulator_source.csv từ fraud-detection-ml/data');
} else if (existsSync(target)) {
  console.log('Không thấy file nguồn, dùng bản có sẵn trong public/');
} else {
  console.warn('CHƯA CÓ simulator_source.csv. Chạy notebook để tạo file, hoặc chép tay vào public/.');
}
