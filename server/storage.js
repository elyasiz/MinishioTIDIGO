import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { createHmac } from 'node:crypto';
import { emptyLedger } from '../src/ledger.js';
import { UserError } from './core.js';
export const storageReady=()=>!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID);
export async function readJson(path){const blob=await get(path,{access:'private',useCache:false});if(!blob)return {value:null,etag:null};return {value:JSON.parse(await new Response(blob.stream).text()),etag:blob.blob.etag};}
async function writeJson(path,value,etag){return put(path,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json'});}
export async function readLedger(){const {value}=await readJson('ledger/main.json');return value||emptyLedger();}
export async function updateLedger(change){for(let attempt=0;attempt<4;attempt++){const {value,etag}=await readJson('ledger/main.json');const result=change(value||emptyLedger());try{await writeJson('ledger/main.json',result.ledger,etag);return result;}catch(e){if(e instanceof BlobPreconditionFailedError || /already exists/i.test(e.message)){continue;}throw e;}}throw new UserError('Data sedang diperbarui pengelola lain. Silakan coba kembali.',409);}
export async function checkLoginRate(req){const ip=(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown').split(',')[0].trim();const bucket=Math.floor(Date.now()/900000);const digest=createHmac('sha256',process.env.SESSION_SECRET).update(ip+'|'+bucket).digest('hex');const path='security/login-'+digest+'.json';for(let attempt=0;attempt<4;attempt++){const {value,etag}=await readJson(path);const count=value?.count||0;if(count>=12)throw new UserError('Terlalu banyak percobaan masuk. Tunggu 15 menit.',429);try{await writeJson(path,{count:count+1},etag);return;}catch(e){if(e instanceof BlobPreconditionFailedError||/already exists/i.test(e.message))continue;throw e;}}throw new UserError('Silakan coba masuk kembali beberapa saat lagi.',429);}
export async function privateFile(path,bytes,contentType){const blob=await put(path,bytes,{access:'private',addRandomSuffix:true,contentType});return blob.pathname;}
export async function readFile(path){return get(path,{access:'private',useCache:false});}
