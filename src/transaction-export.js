import { validDate } from './ledger.js';

export const transactionTypes = {
  all: 'Semua transaksi',
  income: 'Pemasukan',
  expense: 'Pengeluaran',
};

export function monthRange(month) {
  const startDate = `${month}-01`;
  if (!validDate(startDate)) throw new Error('Bulan tidak valid.');
  const end = new Date(`${startDate}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { startDate, endDate: end.toISOString().slice(0, 10) };
}

export function transactionReport(transactions, { startDate, endDate, type = 'all', demo = false }) {
  if (!validDate(startDate) || !validDate(endDate)) {
    throw new Error('Pilih tanggal awal dan tanggal akhir yang valid.');
  }
  if (startDate > endDate) throw new Error('Tanggal akhir harus sama atau setelah tanggal awal.');
  if (!Object.hasOwn(transactionTypes, type)) throw new Error('Pilih jenis transaksi yang valid.');

  const rows = transactions
    .filter(t => !t.voided && t.date >= startDate && t.date <= endDate && (type === 'all' || t.type === type))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const income = rows.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = rows.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { startDate, endDate, type, demo, rows, income, expense, net: income - expense };
}

export function reportFilename(report, extension) {
  const type = report.type === 'all' ? '' : report.type === 'income' ? '-pemasukan' : '-pengeluaran';
  return `tidigo-transaksi-${report.startDate}_sampai_${report.endDate}${type}${report.demo ? '-CONTOH' : ''}.${extension}`;
}

export function reportCsv(report) {
  const rows = [
    ['Tanggal', 'Keterangan', 'Kategori', 'Jenis', 'Nominal'],
    ...report.rows.map(t => [t.date, t.description, t.category, transactionTypes[t.type], t.amount]),
  ];
  const cell = value => {
    let text = String(value ?? '');
    // Keep spreadsheet software from treating a description as a formula.
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}

export function downloadFile(contents, filename, type) {
  const url = URL.createObjectURL(contents instanceof Blob ? contents : new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Allow the browser to start reading the download before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
