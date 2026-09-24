import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,viewLedger} from '../server/core.js';
import {validateReceipt} from '../server/receipt.js';
import {emptyLedger,totals} from '../src/ledger.js';

const receipt={type:'text/plain',data:Buffer.from('Bukti penjualan uji').toString('base64')};
const payload={date:'2026-09-24',amount:125000,description:'Penjualan minishop',receipt};
test('manual income with evidence updates balance, period and audit',()=>{
 let ledger=applyAction(emptyLedger(),'opening',{date:'2026-09-01',amount:500000,reason:'Kas awal'}).ledger;
 ledger=applyAction(ledger,'complete',{month:'2026-09',complete:true}).ledger;
 const result=applyAction(ledger,'income',payload,{receipt:'receipts/private-proof'});
 assert.equal(totals(result.ledger,'2026-09').balance,625000);
 assert.equal(result.selectedMonth,'2026-09');
 assert.equal(result.ledger.transactions[0].source,'Manual');
 assert.equal(result.ledger.transactions[0].receipt,'receipts/private-proof');
 assert.equal(result.ledger.audit.at(-1).after.type,'income');
 assert.deepEqual(result.ledger.completedMonths,[]);
 assert.equal(viewLedger(result.ledger,'viewer').transactions[0].receipt,true);
});
test('manual income rejects missing evidence, invalid date and negative amounts',()=>{
 for(const invalid of [{receipt:null},{amount:-1},{date:'2026-02-31'}])assert.throws(()=>applyAction(emptyLedger(),'income',{...payload,...invalid}));
});
test('manual income cancellation removes amount but preserves evidence and audit',()=>{
 let ledger=applyAction(emptyLedger(),'income',payload,{receipt:'receipts/proof'}).ledger;
 ledger=applyAction(ledger,'void',{id:ledger.transactions[0].id,reason:'Koreksi nominal'}).ledger;
 assert.equal(totals(ledger,'2026-09').income,0);
 assert.equal(ledger.transactions[0].receipt,'receipts/proof');
 assert.equal(ledger.audit[0].after.voided,undefined);
});
test('receipt validation accepts photo, PDF and text formats and rejects disguised binaries',()=>{
 for(const [type,bytes] of [['image/png',Buffer.from([137,80,78,71,13,10,26,10])],['image/jpeg',Buffer.from([255,216,255,224])],['application/pdf',Buffer.from('%PDF-1.4\n')],['text/plain',Buffer.from('Laporan penjualan')],['text/csv',Buffer.from('tanggal;jumlah\n2026-09-24;125000')]]){
  const result=validateReceipt({type,data:bytes.toString('base64')});assert.equal(result.type,type);assert.deepEqual(result.bytes,bytes);
 }
 assert.throws(()=>validateReceipt({type:'image/png',data:Buffer.from('not a PNG').toString('base64')}));
 assert.throws(()=>validateReceipt({type:'text/plain',data:Buffer.from([0,255,1]).toString('base64')}));
 assert.throws(()=>validateReceipt({type:'text/plain',data:Buffer.alloc(2_000_001,65).toString('base64')}));
});
