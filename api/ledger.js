import { randomUUID } from 'node:crypto';
import { applyAction, ensure, UserError, viewLedger } from '../server/core.js';
import { equal, getRole, setCookie, signSession } from '../server/auth.js';
import { checkLoginRate, storageReady, readLedger, updateLedger, privateFile, readFile } from '../server/storage.js';
export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try {
  const configured=!!(storageReady()&&process.env.SESSION_SECRET?.length>=32&&process.env.ADMIN_PASSWORD?.length>=16);
  const action=req.query?.action||new URL(req.url,'https://local').searchParams.get('action')||'session';const role=getRole(req);
  if(req.method==='GET'&&action==='session') return res.status(200).json({configured,role:configured?role:null,ledger:configured&&role?viewLedger(await readLedger(),role):null});
  ensure(configured,'Penyimpanan dan akses akun belum diaktifkan.',503);
  if(req.method==='GET'&&['source','receipt'].includes(action)){
   ensure(role==='admin','Hanya pengelola yang dapat membuka file sumber.',403);const ledger=await readLedger();const id=req.query?.id||new URL(req.url,'https://local').searchParams.get('id');const record=action==='source'?ledger.imports.find(b=>b.id===id):ledger.transactions.find(t=>t.id===id);const path=action==='source'?record?.source:record?.receipt;ensure(path,'File tidak ditemukan.',404);const file=await readFile(path);ensure(file?.stream,'File tidak ditemukan.',404);const bytes=Buffer.from(await new Response(file.stream).arrayBuffer());res.setHeader('Content-Type',file.blob.contentType||'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="${action==='source'?'laporan-gopay.txt':'bukti-transaksi'+(file.blob.contentType==='application/pdf'?'.pdf':file.blob.contentType==='image/png'?'.png':'.jpg')}"`);return res.status(200).send(bytes);
  }
  ensure(req.method==='POST','Metode tidak diizinkan.',405);
  const origin=req.headers.origin;ensure(origin&&new URL(origin).host===req.headers.host,'Permintaan dari situs lain ditolak.',403);
  ensure((req.headers['content-type']||'').startsWith('application/json'),'Format permintaan tidak valid.',415);
  const payload=typeof req.body==='string'?JSON.parse(req.body):req.body;ensure(payload&&typeof payload==='object'&&!Array.isArray(payload),'Data tidak valid.');ensure(JSON.stringify(payload).length<=3_000_000,'Ukuran data terlalu besar.',413);
  if(action==='login'){
   ensure(typeof payload.password==='string'&&payload.password.length<=200,'Kata sandi tidak valid.');await checkLoginRate(req);
   const matched=equal(payload.password,process.env.ADMIN_PASSWORD)?'admin':process.env.VIEWER_PASSWORD?.length>=16&&equal(payload.password,process.env.VIEWER_PASSWORD)?'viewer':null;ensure(matched,'Kata sandi salah.',401);const ledger=await readLedger();setCookie(res,signSession(matched));return res.status(200).json({role:matched,ledger:viewLedger(ledger,matched)});
  }
  if(action==='logout'){setCookie(res,'',0);return res.status(200).json({ok:true});}
  ensure(role==='admin','Masuk sebagai pengelola untuk mengubah catatan.',403);
  // Validate the full mutation before storing any attachments.
  const previous=await readLedger();applyAction(previous,action,payload);
  const attachments={};
  if(action==='import') attachments.source=await privateFile('reports/'+randomUUID()+'.txt',payload.text,'text/plain; charset=utf-8');
  if(action==='expense'&&payload.receipt){const r=payload.receipt;ensure(typeof r.data==='string'&&r.data.length<=2_700_000&&/^[A-Za-z0-9+/]*={0,2}$/.test(r.data),'Bukti tidak valid atau terlalu besar.');const bytes=Buffer.from(r.data,'base64');ensure(bytes.length>0&&bytes.length<=2_000_000,'Bukti maksimal 2 MB.');const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;ensure(type&&type===r.type,'Bukti harus berupa JPG, PNG, atau PDF yang valid.');attachments.receipt=await privateFile('receipts/'+randomUUID(),bytes,type);}
  const result=await updateLedger(ledger=>applyAction(ledger,action,payload,attachments));return res.status(200).json({message:result.message,ledger:viewLedger(result.ledger,role),...(result.importedMonth?{importedMonth:result.importedMonth}:{})});
 } catch(e){if(e instanceof UserError)return res.status(e.status).json({error:e.message});if(e instanceof SyntaxError)return res.status(400).json({error:'Format data tidak valid.'});console.error('Ledger operation failed:',e.name,e.message);return res.status(500).json({error:'Catatan belum dapat disimpan atau dibaca. Silakan coba kembali.'});}
}
