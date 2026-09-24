import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export function equal(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());}
const key=()=>createHash('sha256').update([process.env.SESSION_SECRET,process.env.ADMIN_PASSWORD,process.env.VIEWER_PASSWORD].join('|')).digest();
export function signSession(role){const payload=Buffer.from(JSON.stringify({role,exp:Date.now()+8*3600000})).toString('base64url');return payload+'.'+createHmac('sha256',key()).update(payload).digest('base64url');}
export function verifySession(token){try{const [payload,signature,extra]=String(token||'').split('.');if(extra||!payload||!signature||!equal(signature,createHmac('sha256',key()).update(payload).digest('base64url')))return null;const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());return parsed.exp>Date.now()&&['admin','viewer'].includes(parsed.role)?parsed.role:null;}catch{return null;}}
export function getRole(req){const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));return verifySession(cookies.tidigo_session);}
export function setCookie(res,value,maxAge=28800){res.setHeader('Set-Cookie',`tidigo_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);}
