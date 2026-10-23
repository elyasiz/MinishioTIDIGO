import React, { useState } from 'react';
import { AlertCircle, LockKeyhole } from 'lucide-react';

export default function ManagerLogin({ message, resumeHint, busy, onLogin }) {
  const [error, setError] = useState('');
  return <section className="manager-login" aria-label="Masuk ulang sebagai pengelola">
    <div className="manager-login-heading"><LockKeyhole size={19}/><h3>Masuk sebagai pengelola</h3></div>
    <p>{message}</p>
    <p>{resumeHint || 'Isian dan berkas bukti tetap ada. Setelah masuk, tekan tombol Simpan di bawah.'}</p>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setError('');
      const password = new FormData(event.currentTarget).get('managerPassword');
      try { await onLogin(password); }
      catch (error) { setError(error.message); }
    }}>
      <label className="field">Kata sandi pengelola<input name="managerPassword" type="password" autoComplete="current-password" required disabled={busy} autoFocus/></label>
      {error && <div className="form-error" role="alert"><AlertCircle size={17}/>{error}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk dan lanjutkan'}</button>
    </form>
  </section>;
}
