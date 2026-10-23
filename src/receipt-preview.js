import { ApiError } from './api.js';

const formats = {
  'image/jpeg': { kind: 'image', extension: '.jpg', label: 'Foto JPG' },
  'image/png': { kind: 'image', extension: '.png', label: 'Foto PNG' },
  'application/pdf': { kind: 'pdf', extension: '.pdf', label: 'Dokumen PDF' },
  'text/plain': { kind: 'text', extension: '.txt', label: 'Dokumen TXT' },
  'text/csv': { kind: 'text', extension: '.csv', label: 'Dokumen CSV' },
};

export const receiptUrl = id => '/api/ledger?action=receipt&id=' + encodeURIComponent(id);

export async function loadReceipt(id, { signal, fetcher = fetch } = {}) {
  const response = await fetcher(receiptUrl(id), { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) {
    let data;
    try { data = await response.json(); } catch { /* The service may return an HTML error. */ }
    throw new ApiError(data?.error || 'Bukti belum dapat dimuat. Silakan coba lagi.', response.status, data?.code);
  }
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const format = formats[type];
  if (!format) throw new Error('Format bukti ini belum dapat ditampilkan. Anda tetap dapat mengunduh filenya.');
  const blob = await response.blob();
  if (!blob.size || blob.size > 2_000_000) throw new Error('Berkas bukti kosong atau melebihi ukuran yang didukung.');
  const filename = response.headers.get('content-disposition')?.match(/filename="([^"\r\n]+)"/i)?.[1]
    || 'bukti-transaksi' + format.extension;
  return { ...format, type, filename, blob: new Blob([blob], { type }), text: format.kind === 'text' ? await blob.text() : null };
}
