import test from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, transactionReport, reportCsv, reportFilename } from '../src/transaction-export.js';

const transactions = [
  { id: 'after', date: '2026-10-02', type: 'income', amount: 900000, description: 'Sesudah rentang', category: 'Penjualan' },
  { id: 'end', date: '2026-10-01', type: 'expense', amount: 35000, description: 'Kemasan', category: 'Kemasan' },
  { id: 'voided', date: '2026-09-30', type: 'income', amount: 999000, description: 'Dibatalkan', category: 'Penjualan', voided: true },
  { id: 'middle', date: '2026-09-30', type: 'income', amount: 125000, description: 'Pesanan minishop', category: 'Penjualan' },
  { id: 'start', date: '2026-09-29', type: 'income', amount: 75000, description: 'Penjualan', category: 'Penjualan' },
  { id: 'before', date: '2026-09-28', type: 'expense', amount: 100000, description: 'Sebelum rentang', category: 'Operasional' },
];
const range = { startDate: '2026-09-29', endDate: '2026-10-01' };

test('export includes both boundary dates across months, excludes voided entries and totals only selected rows', () => {
  const report = transactionReport(transactions, range);
  assert.deepEqual(report.rows.map(t => t.id), ['start', 'middle', 'end']);
  assert.deepEqual([report.income, report.expense, report.net], [200000, 35000, 165000]);
  assert.equal(transactions[0].id, 'after');
});

test('export can select one day, one type, and dates outside the month shown in the table', () => {
  const oneDay = transactionReport(transactions, { startDate: '2026-10-01', endDate: '2026-10-01' });
  assert.deepEqual(oneDay.rows.map(t => t.id), ['end']);
  const expenses = transactionReport(transactions, { ...range, type: 'expense' });
  assert.deepEqual([expenses.income, expenses.expense, expenses.net], [0, 35000, -35000]);
  const empty = transactionReport(transactions, { startDate: '2026-01-01', endDate: '2026-02-01' });
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.net, 0);
});

test('invalid or reversed export dates and unknown types are rejected', () => {
  for (const invalid of [
    { startDate: '', endDate: '2026-10-01' },
    { startDate: '2026-02-30', endDate: '2026-10-01' },
    { startDate: '2026-10-02', endDate: '2026-10-01' },
    { ...range, type: 'other' },
  ]) assert.throws(() => transactionReport(transactions, invalid));
});

test('default month ranges cover leap days and year boundaries without timezone offsets', () => {
  assert.deepEqual(monthRange('2024-02'), { startDate: '2024-02-01', endDate: '2024-02-29' });
  assert.deepEqual(monthRange('2026-02'), { startDate: '2026-02-01', endDate: '2026-02-28' });
  assert.deepEqual(monthRange('2026-12'), { startDate: '2026-12-01', endDate: '2026-12-31' });
  assert.throws(() => monthRange('2026-13'));
});

test('CSV retains rupiah numbers and Unicode, escapes quotes, separators and multiline descriptions', () => {
  const report = transactionReport([{ ...transactions[3], description: 'Pesanan "édisi"; merah\nbaris kedua' }], range);
  const csv = reportCsv(report);
  assert.ok(csv.startsWith('\uFEFF"Tanggal";'));
  assert.ok(csv.includes('"Pesanan ""édisi""; merah\nbaris kedua"'));
  assert.ok(csv.endsWith(';"125000"'));
  assert.ok(!csv.includes('Dibatalkan'));
});

test('CSV neutralizes formulas including leading whitespace and control characters', () => {
  for (const description of ['=1+1', ' +SUM(1)', '@CMD', '-1+2', '\t=1+1', '\n@CMD']) {
    const csv = reportCsv(transactionReport([{ ...transactions[3], description }], range));
    assert.ok(csv.includes('"\'' + description + '"'));
  }
});

test('download names identify range, selected type and demo data', () => {
  const report = transactionReport(transactions, { ...range, type: 'expense', demo: true });
  assert.equal(reportFilename(report, 'pdf'), 'tidigo-transaksi-2026-09-29_sampai_2026-10-01-pengeluaran-CONTOH.pdf');
  assert.equal(reportFilename(transactionReport(transactions, range), 'csv'), 'tidigo-transaksi-2026-09-29_sampai_2026-10-01.csv');
});
