import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAutomaticReport,emptyLedger,totals} from '../src/ledger.js';
import {applyAction} from '../server/core.js';
const report='ID Transaksi;Tanggal Transaksi;Nominal;Biaya layanan;Status\nAUTO-1;2026-08-20;100000;700;Berhasil';
test('automatic import requires only file content and name, updates month and totals',()=>{
 const {ledger,importedMonth}=applyAction(emptyLedger(),'import',{text:report,filename:'report.txt'});
 assert.equal(totals(ledger,'2026-08').income,99300);assert.equal(importedMonth,'2026-08');assert.equal(ledger.imports[0].amountMode,'gross');
 assert.throws(()=>applyAction(ledger,'import',{text:report,filename:'again.txt'}),/Tidak ada transaksi baru/);
});
test('net amounts are recognized automatically without deducting fees twice',()=>{
 const text='Transaction ID\tTransaction Date\tGross Amount\tNet Amount\tTransaction Fee\tStatus\nA\t2026-09-01\t100000\t99300\t700\tsuccess';
 const result=parseAutomaticReport(text);assert.equal(result.amountMode,'net');assert.equal(result.valid[0].amount,99300);assert.equal(result.valid[0].gross,100000);
 assert.equal(parseAutomaticReport(text.replace('99300','98000')).errors.length,1);
});
test('server ignores a client mapping or amount mode override',()=>{
 const result=applyAction(emptyLedger(),'import',{filename:'report.txt',text:report,mapping:{amount:'3'},amountMode:'net'});
 assert.equal(result.ledger.transactions[0].amount,99300);
});
test('table headers are discovered after report titles and metadata',()=>{
 const result=parseAutomaticReport('Laporan transaksi GoPay\nNama usaha: Tidigo\n'+report);assert.equal(result.valid.length,1);assert.equal(result.valid[0].amount,99300);
});
test('ambiguous columns and missing required fields fail without guessing',()=>{
 assert.throws(()=>parseAutomaticReport(report.replace('Nominal;','Nominal;Total;').replace('100000;','100000;100000;')),/beberapa kolom/);
 assert.throws(()=>parseAutomaticReport(report.replace(';Status',';Keterangan')),/status/);
});
test('partial bad reports never create partial accounting entries',()=>{
 const ledger=emptyLedger(),before=structuredClone(ledger);
 assert.throws(()=>applyAction(ledger,'import',{filename:'report.txt',text:report+'\nAUTO-2;2026-09-31;50000;0;berhasil'}),/belum disimpan/);
 assert.deepEqual(ledger,before);
});
test('payout rows cannot be mistaken for sales',()=>{
 const text='ID;Tanggal;Nominal;Status;Jenis transaksi\nPAYOUT;2026-09-01;100000;success;pencairan';
 assert.equal(parseAutomaticReport(text).errors.length,1);
});
test('overlapping reports skip existing ids and failed payments while saving new sales',()=>{
 let ledger=applyAction(emptyLedger(),'import',{filename:'report.txt',text:report}).ledger;
 const result=applyAction(ledger,'import',{filename:'overlap.txt',text:report+'\nAUTO-2;2026-08-21;50000;0;berhasil\nAUTO-3;2026-08-21;30000;0;gagal'});
 assert.equal(totals(result.ledger,'2026-08').income,149300);assert.equal(result.ledger.imports[1].duplicates,1);assert.equal(result.ledger.imports[1].excluded,1);
});
