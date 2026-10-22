import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { transactionTypes } from './transaction-export.js';

const red = '#ec252d';
const dark = '#25262e';
const muted = '#727b89';
const green = '#20896a';
const rupiah = value => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value).replaceAll('\u00a0', ' ');
const dateLabel = value => new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
});
const text = value => String(value ?? '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

let assetsPromise;
export function loadReportAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      '/tidigo-logo.png', '/fonts/NotoSans-Regular.ttf', '/fonts/NotoSans-Bold.ttf',
    ].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Desain laporan belum berhasil dimuat. Silakan coba lagi.');
      return new Uint8Array(await response.arrayBuffer());
    })).then(([logo, regular, bold]) => ({ logo, regular, bold })).catch(error => {
      assetsPromise = null;
      throw error;
    });
  }
  return assetsPromise;
}

function fontBase64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}

export function createTransactionPdf(report, assets, generatedAt = new Date()) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  for (const [style, bytes] of [['normal', assets.regular], ['bold', assets.bold]]) {
    const name = `NotoSans-${style}.ttf`;
    doc.addFileToVFS(name, fontBase64(bytes));
    doc.addFont(name, 'NotoSans', style);
  }
  doc.setProperties({
    title: `${report.demo ? 'DATA CONTOH - ' : ''}Laporan transaksi Tidigo ${report.startDate} - ${report.endDate}`,
    author: 'Minishop Tidigo', subject: transactionTypes[report.type], creator: 'Minishop Tidigo',
  });
  doc.setCreationDate(generatedAt);
  const left = 16, right = 194, width = right - left;
  const period = `${dateLabel(report.startDate)} - ${dateLabel(report.endDate)}`;
  const stamp = generatedAt.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' WIB';

  function label(value, x, y, size = 9, color = dark, bold = false, options = {}) {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text(value), x, y, options);
  }
  function header(first) {
    doc.setFillColor(red);
    doc.rect(0, 0, 210, 2.5, 'F');
    // The original logo contains white padding; preserve its aspect ratio.
    doc.addImage(assets.logo, 'PNG', 14, 4, 49, 49 * 1241 / 1755, 'tidigo-logo');
    label('MINISHOP TIDIGO', right, 19, 9, dark, true, { align: 'right' });
    label(report.demo ? 'DATA CONTOH' : 'CATATAN KEUANGAN', right, 25, 7.5, report.demo ? red : muted, false, { align: 'right' });
    doc.setDrawColor('#e4e8ee');
    doc.setLineWidth(0.25);
    doc.line(left, 36, right, 36);
    if (!first) {
      label('Laporan transaksi', left, 44, 10, dark, true);
      label(period, right, 44, 8, muted, false, { align: 'right' });
      label(`Jenis: ${transactionTypes[report.type]}`, left, 50, 8, muted);
    }
  }

  header(true);
  label('Laporan transaksi', left, 49, 23, dark, true);
  label(period, left, 59, 10, muted);
  label(`Jenis: ${transactionTypes[report.type]}`, left, 67, 8.5, muted);
  if (report.demo) label('Angka pada laporan ini adalah data contoh.', right, 67, 7.5, red, false, { align: 'right' });

  const cards = [
    ['Total pemasukan', report.income, `${report.rows.filter(t => t.type === 'income').length} transaksi masuk`, green, '#f0f8f5'],
    ['Total pengeluaran', report.expense, `${report.rows.filter(t => t.type === 'expense').length} transaksi keluar`, red, '#fff3f3'],
    ['Arus kas bersih', report.net, 'Pemasukan - pengeluaran', dark, '#f4f5f8'],
  ];
  const cardWidth = (width - 10) / 3;
  cards.forEach(([title, amount, note, color, background], i) => {
    const x = left + i * (cardWidth + 5);
    doc.setFillColor(background);
    doc.roundedRect(x, 76, cardWidth, 30, 2, 2, 'F');
    label(title, x + 4, 83, 7.6, muted);
    const value = rupiah(amount);
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(13);
    const size = Math.min(13, 13 * (cardWidth - 8) / doc.getTextWidth(value));
    label(value, x + 4, 93, size, color, true);
    label(note, x + 4, 101, 6.8, muted);
  });
  label('Arus kas bersih tidak termasuk saldo awal.', left, 113, 7.5, muted);
  label('Rincian transaksi', left, 123, 11, dark, true);
  label(`${report.rows.length} transaksi`, right, 123, 8.5, muted, false, { align: 'right' });

  autoTable(doc, {
    startY: 129,
    margin: { left, right: left, top: 56, bottom: 27 },
    head: [['No', 'Tanggal', 'Keterangan', 'Kategori', 'Pemasukan', 'Pengeluaran']],
    body: report.rows.map((t, i) => [
      String(i + 1), dateLabel(t.date), text(t.description), text(t.category),
      t.type === 'income' ? rupiah(t.amount) : '-',
      t.type === 'expense' ? rupiah(t.amount) : '-',
    ]),
    foot: [[
      { content: 'TOTAL PERIODE', colSpan: 4 }, rupiah(report.income), rupiah(report.expense),
    ]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'striped',
    styles: { font: 'NotoSans', fontSize: 7.6, cellPadding: 2.6, textColor: dark, lineColor: '#edf0f4', overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: red, textColor: '#ffffff', fontStyle: 'bold', minCellHeight: 10 },
    footStyles: { fillColor: '#f0f2f6', textColor: dark, fontStyle: 'bold', minCellHeight: 11, halign: 'right' },
    alternateRowStyles: { fillColor: '#f8f9fb' },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 25 },
      2: { cellWidth: 58 }, 3: { cellWidth: 30 },
      4: { cellWidth: 28, halign: 'right', fontSize: 7.2 },
      5: { cellWidth: 28, halign: 'right', fontSize: 7.2 },
    },
    didParseCell: data => {
      if (data.section !== 'head' && data.column.index >= 4) {
        doc.setFont('NotoSans', data.cell.styles.fontStyle);
        const fontSize = data.cell.styles.fontSize;
        const textWidth = doc.getStringUnitWidth(String(data.cell.raw)) * fontSize / doc.internal.scaleFactor;
        data.cell.styles.fontSize = Math.min(fontSize, fontSize * 22.5 / textWidth);
      }
      if (data.section === 'body' && data.column.index >= 4 && data.cell.raw !== '-') {
        data.cell.styles.textColor = data.column.index === 4 ? green : red;
      }
    },
    willDrawPage: ({ pageNumber }) => { if (pageNumber > 1) header(false); },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor('#e4e8ee');
    doc.line(left, 274, right, 274);
    label(report.demo ? 'DATA CONTOH - Bukan catatan keuangan sebenarnya.' : 'Berdasarkan transaksi aktif yang tercatat di website Tidigo.', left, 280, 6.6, report.demo ? red : muted);
    label(`Diunduh ${stamp}`, left, 286, 6.6, muted);
    label(`Halaman ${page} / ${pages}`, right, 286, 7, muted, false, { align: 'right' });
  }
  return doc;
}
