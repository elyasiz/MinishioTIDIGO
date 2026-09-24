import { randomUUID } from 'node:crypto';
import { categories, validDate, parseReport } from '../src/ledger.js';
export class UserError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function ensure(value,message,status=400){if(!value)throw new UserError(message,status);}
const clean = (value,max=300) => typeof value==='string'&&value.trim().length>0&&value.trim().length<=max ? value.trim() : null;
export function applyAction(original, action, payload, attachments={}) {
 const ledger=structuredClone(original), now=new Date().toISOString();let message='',reason='',before=null,after=null;
 const invalidate = dates => { const months=new Set(dates.map(x=>x.slice(0,7)));ledger.completedMonths=ledger.completedMonths.filter(m=>!months.has(m)); };
 if(action==='expense') {
  ensure(validDate(payload.date),'Tanggal tidak valid.');
  ensure(!ledger.opening || payload.date>=ledger.opening.date,'Tanggal mendahului awal pencatatan.');
  ensure(Number.isSafeInteger(payload.amount)&&payload.amount>0&&payload.amount<=1e12,'Nominal harus berupa rupiah bulat dan lebih besar dari nol.');
  ensure(categories.includes(payload.category),'Kategori tidak valid.');
  const description=clean(payload.description,160);ensure(description,'Isi keterangan maksimal 160 karakter.');
  const transaction={id:randomUUID(),date:payload.date,amount:payload.amount,category:payload.category,description,type:'expense',source:'Manual',createdAt:now,receipt:attachments.receipt||null};
  ledger.transactions.push(transaction);after=transaction;invalidate([payload.date]);message='Pengeluaran dicatat: '+description;
 } else if(action==='import') {
  ensure(typeof payload.filename==='string'&&/\.(txt|csv)$/i.test(payload.filename)&&payload.filename.length<=200,'Nama file tidak valid.');
  let preview;try{preview=parseReport(payload.text,payload.mapping,ledger.transactions,payload.amountMode);}catch(e){throw new UserError(e.message);}
  ensure(preview.errors.length===0,'Masih ada baris bermasalah. Perbaiki laporan sebelum diimpor.');
  ensure(preview.valid.length>0,'Tidak ada transaksi baru. Laporan mungkin sudah diimpor.');
  ensure(!ledger.opening || preview.valid.every(t=>t.date>=ledger.opening.date),'Ada transaksi sebelum tanggal awal pencatatan.');
  const id=randomUUID();
  const batch={id,filename:payload.filename,count:preview.valid.length,total:preview.valid.reduce((s,t)=>s+t.amount,0),createdAt:now,source:attachments.source||null,amountMode:payload.amountMode};
  ledger.imports.push(batch);ledger.transactions.push(...preview.valid.map(({line,...t})=>({...t,id:randomUUID(),importId:id,createdAt:now})));
  after={id,count:batch.count,total:batch.total};invalidate(preview.valid.map(t=>t.date));message=`Mengimpor ${batch.count} transaksi GoPay.`;
 } else if(action==='opening') {
  ensure(validDate(payload.date),'Tanggal tidak valid.');ensure(Number.isSafeInteger(payload.amount)&&payload.amount>=0&&payload.amount<=1e12,'Saldo awal tidak valid.');reason=clean(payload.reason);ensure(reason,'Isi alasan atau sumber saldo.');
  ensure(ledger.transactions.filter(t=>!t.voided).every(t=>t.date>=payload.date),'Tanggal mulai harus sebelum atau sama dengan transaksi pertama.');
  before=ledger.opening;ledger.opening={date:payload.date,amount:payload.amount};after=ledger.opening;ledger.completedMonths=[];message='Memperbarui saldo awal pencatatan.';
 } else if(action==='complete') {
  ensure(typeof payload.month==='string'&&validDate(payload.month+'-01')&&typeof payload.complete==='boolean','Periode tidak valid.');
  ledger.completedMonths=ledger.completedMonths.filter(m=>m!==payload.month);if(payload.complete)ledger.completedMonths.push(payload.month);message=`Laporan ${payload.month} ${payload.complete?'dikonfirmasi lengkap':'ditandai belum lengkap'}.`;
 } else if(action==='void'||action==='voidImport') {
  reason=clean(payload.reason);ensure(reason,'Isi alasan pembatalan.');
  if(action==='void') {const t=ledger.transactions.find(t=>t.id===payload.id&&!t.voided);ensure(t,'Transaksi tidak ditemukan atau sudah dibatalkan.',404);before=structuredClone(t);t.voided=true;t.voidedAt=now;t.voidReason=reason;after=t;invalidate([t.date]);message='Membatalkan transaksi: '+t.description;}
  else {const b=ledger.imports.find(b=>b.id===payload.id&&!b.voided);ensure(b,'Impor tidak ditemukan atau sudah dibatalkan.',404);before=structuredClone(b);b.voided=true;b.voidedAt=now;b.voidReason=reason;after=b;const transactions=ledger.transactions.filter(t=>t.importId===b.id&&!t.voided);for(const t of transactions){t.voided=true;t.voidedAt=now;t.voidReason=reason;}invalidate(transactions.map(t=>t.date));message='Membatalkan impor: '+b.filename;}
 } else throw new UserError('Tindakan tidak dikenali.',404);
 ledger.audit.push({id:randomUUID(),at:now,message,reason,before:structuredClone(before),after:structuredClone(after)});ledger.updatedAt=now;
 return {ledger,message};
}
export function viewLedger(ledger,role) {
 return {...ledger,transactions:ledger.transactions.map(({receipt,...t})=>({...t,reference:role==='admin'?t.reference:undefined,receipt:!!receipt})),imports:ledger.imports.map(({source,...b})=>b),audit:ledger.audit.map(({before,after,...a})=>a)};
}
