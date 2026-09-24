// Run with: node --env-file=.env.local scripts/verify-storage.mjs
// Only touches a unique temporary QA file, never the production ledger.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { del, BlobPreconditionFailedError } from '@vercel/blob';
import { readJson, writeJson } from '../server/storage.js';

const path=`qa/storage-regression-${randomUUID()}.json`;
const initial={version:1,records:Array.from({length:100},(_,i)=>({id:i,note:'Synthetic storage regression fixture'}))};
let created=false;
try {
 await writeJson(path,initial,null);created=true;
 const first=await readJson(path);
 assert.deepEqual(first.value,initial);
 assert.ok(first.etag&&!first.etag.startsWith('W/'));
 const updated={...initial,version:2};
 await writeJson(path,updated,first.etag);
 assert.deepEqual((await readJson(path)).value,updated);
 console.log('Large JSON read/modify/write: PASS');
 await assert.rejects(writeJson(path,{version:'stale'},first.etag),error=>error instanceof BlobPreconditionFailedError);
 assert.deepEqual((await readJson(path)).value,updated);
 console.log('Stale updates rejected without data loss: PASS');
 const second=await readJson(path);
 const concurrent=await Promise.allSettled([
  writeJson(path,{...updated,version:3},second.etag),
  writeJson(path,{...updated,version:4},second.etag)
 ]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
 console.log('Concurrent changes cannot overwrite each other: PASS');
} finally {
 if(created)await del(path);
 console.log('Temporary QA file removed.');
}
