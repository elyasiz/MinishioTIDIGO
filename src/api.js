export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(action, payload, fetcher = fetch) {
  const response = await fetcher('/api/ledger' + (action ? '?action=' + action : ''), {
    credentials: 'same-origin', cache: 'no-store',
    ...(payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('Layanan pencatatan belum terhubung. Anda bisa menjelajahi tampilan contoh.');
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'Permintaan gagal. Coba lagi.', response.status, data.code);
  return data;
}

export const requiresManagerLogin = error => ['SESSION_EXPIRED', 'ADMIN_REQUIRED'].includes(error?.code);
