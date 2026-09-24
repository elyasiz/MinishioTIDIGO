import { ensure } from './core.js';

export function validateReceipt(receipt) {
  ensure(receipt && typeof receipt.data === 'string' && receipt.data.length <= 2_700_000 && /^[A-Za-z0-9+/]*={0,2}$/.test(receipt.data), 'Bukti tidak valid atau terlalu besar.');
  const bytes = Buffer.from(receipt.data, 'base64');
  ensure(bytes.length > 0 && bytes.length <= 2_000_000, 'Bukti maksimal 2 MB.');
  let type = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'image/jpeg'
    : bytes.subarray(0,5).toString()==='%PDF-' ? 'application/pdf' : null;
  if (!type && ['text/plain','text/csv'].includes(receipt.type)) {
    let text;
    try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { ensure(false, 'Bukti teks harus berformat UTF-8.'); }
    ensure(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text), 'Isi file bukan dokumen teks yang valid.');
    type = receipt.type;
  }
  ensure(type && type===receipt.type, 'Bukti harus berupa JPG, PNG, PDF, TXT, atau CSV yang valid.');
  return {bytes, type};
}
