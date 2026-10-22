import React, { useState } from 'react';
import { AlertCircle, Download, FileText, Table2 } from 'lucide-react';
import { money } from './ledger.js';
import { monthRange, transactionReport, transactionTypes, reportCsv, reportFilename, downloadFile } from './transaction-export.js';

export default function TransactionExport({ transactions, month, demo, busy, setBusy, onDownloaded }) {
  const [range, setRange] = useState(() => monthRange(month));
  const [type, setType] = useState('all');
  const [format, setFormat] = useState('pdf');
  const [downloadError, setDownloadError] = useState('');
  let report, rangeError = '';
  try { report = transactionReport(transactions, { ...range, type, demo }); }
  catch (error) { rangeError = error.message; }

  async function submit(event) {
    event.preventDefault();
    if (!report?.rows.length || busy) return;
    setDownloadError('');
    setBusy(true);
    try {
      if (format === 'pdf') {
        const { createTransactionPdf, loadReportAssets } = await import('./transaction-pdf.js');
        const assets = await loadReportAssets();
        const doc = createTransactionPdf(report, assets);
        downloadFile(doc.output('blob'), reportFilename(report, 'pdf'), 'application/pdf');
      } else {
        downloadFile(reportCsv(report), reportFilename(report, 'csv'), 'text/csv;charset=utf-8');
      }
      onDownloaded();
    } catch {
      setDownloadError('Laporan belum berhasil diunduh. Periksa koneksi Anda, lalu coba lagi.');
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="export-form">
    <p className="modal-intro">Pilih tanggal awal dan akhir. Laporan mencakup transaksi pada kedua tanggal tersebut dan dapat melintasi bulan.</p>
    <fieldset disabled={busy} className="export-fields">
      <div className="form-grid export-dates">
        <label className="field">Dari tanggal<input name="startDate" type="date" required value={range.startDate} onChange={e => { setRange({ ...range, startDate: e.target.value }); setDownloadError(''); }}/></label>
        <label className="field">Sampai tanggal<input name="endDate" type="date" required value={range.endDate} onChange={e => { setRange({ ...range, endDate: e.target.value }); setDownloadError(''); }}/></label>
      </div>
      <label className="field">Jenis transaksi<select value={type} onChange={e => setType(e.target.value)}>{Object.entries(transactionTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <fieldset className="export-formats">
        <legend>Format unduhan</legend>
        {[
          ['pdf', 'PDF', 'Laporan rapi, siap dibagikan', FileText],
          ['csv', 'CSV', 'Untuk diolah di Excel / Sheets', Table2],
        ].map(([value, title, description, Icon]) => <label key={value} className={'export-format ' + (format === value ? 'selected' : '')}>
          <input type="radio" name="format" value={value} checked={format === value} onChange={() => setFormat(value)}/>
          <Icon size={21}/><span><strong>{title}</strong><small>{description}</small></span>
        </label>)}
      </fieldset>
    </fieldset>
    {rangeError ? <div className="form-error" role="alert"><AlertCircle size={17}/>{rangeError}</div> : <div className="export-summary" aria-live="polite">
      <strong>{report.rows.length} transaksi dipilih{demo ? ' · Data contoh' : ''}</strong>
      {report.rows.length ? <dl>
        <div><dt>Pemasukan</dt><dd className="income">{money(report.income)}</dd></div>
        <div><dt>Pengeluaran</dt><dd className="expense">{money(report.expense)}</dd></div>
        <div><dt>Arus kas bersih</dt><dd>{money(report.net)}</dd></div>
      </dl> : <p>Belum ada transaksi pada tanggal dan jenis yang dipilih. Coba ubah pilihan Anda.</p>}
    </div>}
    <p className="export-note">Mengikuti tanggal dan jenis di atas. Pencarian di tabel tidak membatasi unduhan. Transaksi yang dibatalkan tidak disertakan.</p>
    {downloadError && <div className="form-error" role="alert"><AlertCircle size={17}/>{downloadError}</div>}
    <button className="button primary full" disabled={busy || !report?.rows.length}><Download size={17}/>{busy ? 'Menyiapkan laporan…' : `Unduh ${format.toUpperCase()}`}</button>
  </form>;
}
