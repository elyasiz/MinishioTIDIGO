import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { AlertCircle, Download, ExternalLink, FileText, Image as ImageIcon, RotateCw } from 'lucide-react';
import { requiresManagerLogin } from './api.js';
import { loadReceipt, receiptUrl } from './receipt-preview.js';
const PdfReceipt = lazy(() => import('./PdfReceipt.jsx'));

class PdfPreviewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="receipt-error" role="alert"><p>Penampil PDF belum berhasil dimuat. Anda tetap dapat membuka atau mengunduh file aslinya.</p></div>
      : this.props.children;
  }
}

export default function ReceiptPreview({ transaction, onAccessError }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const accessError = useRef(onAccessError);
  accessError.current = onAccessError;

  useEffect(() => {
    const controller = new AbortController();
    let active = true, objectUrl;
    setState({ loading: true });
    loadReceipt(transaction.id, { signal: controller.signal }).then(receipt => {
      if (!active) return;
      objectUrl = URL.createObjectURL(receipt.blob);
      setState({ ...receipt, url: objectUrl, loading: false });
    }).catch(error => {
      if (!active || controller.signal.aborted) return;
      setState({ loading: false, error: error.message });
      if (requiresManagerLogin(error)) accessError.current?.(error);
    });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [transaction.id, attempt]);

  const Icon = state.kind === 'image' ? ImageIcon : FileText;
  return <section className="receipt-preview" aria-label="Bukti yang diunggah" aria-busy={state.loading}>
    <div className="receipt-heading"><span className="receipt-heading-icon"><Icon size={21}/></span><div><h3>Bukti transaksi</h3><p>{state.loading ? 'Mengambil file yang diunggah' : state.label || 'Lampiran transaksi'}</p></div></div>
    {state.loading && <div className="receipt-loading" role="status"><RotateCw size={20} className="receipt-spinner"/>Memuat bukti transaksi…</div>}
    {state.error && <div className="receipt-error" role="alert"><AlertCircle size={22}/><p>{state.error}</p><button className="button secondary" onClick={() => setAttempt(value => value + 1)}><RotateCw size={15}/>Coba lagi</button><a className="link-button" href={receiptUrl(transaction.id)}>Unduh bukti</a></div>}
    {state.url && <>
      {state.kind === 'image' && <a className="receipt-image" href={state.url} target="_blank" rel="noreferrer" aria-label="Buka foto bukti ukuran penuh"><img src={state.url} alt={'Bukti transaksi: ' + transaction.description} onError={() => setState({ loading: false, error: 'Foto belum dapat ditampilkan. Coba muat ulang atau unduh buktinya.' })}/></a>}
      {state.kind === 'pdf' && <PdfPreviewBoundary><Suspense fallback={<div className="receipt-loading" role="status">Menyiapkan penampil PDF…</div>}><PdfReceipt blob={state.blob} description={transaction.description}/></Suspense></PdfPreviewBoundary>}
      {state.kind === 'text' && <pre className="receipt-text" tabIndex={0} aria-label="Isi file bukti">{state.text}</pre>}
      <div className="receipt-actions"><span className="receipt-filename"><FileText size={14}/>{state.filename}</span><div><a className="button secondary" href={state.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{state.kind === 'image' ? 'Ukuran penuh' : 'Buka dokumen'}</a><a className="button secondary" href={state.url} download={state.filename}><Download size={15}/>Unduh file</a></div></div>
    </>}
  </section>;
}
