import postgres from 'npm:postgres@3.4.5';
import {validData,validPassword} from './validation.js';
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:10,connect_timeout:10});
const ORIGIN='https://thegreatcjpark.github.io';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const newToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
async function authorized(db:any,hash:string){const [s]=await db`select s.token_hash from jazzbook.sessions s join jazzbook.settings c on c.id=true and s.auth_version=c.auth_version where s.token_hash=${hash} and s.expires>now()`;return !!s;}
async function throttle(bucket:string){const [r]=await sql`insert into jazzbook.login_attempts(bucket,attempts,started) values(${bucket},1,now()) on conflict(bucket) do update set attempts=case when jazzbook.login_attempts.started<now()-interval '5 minutes' then 1 else jazzbook.login_attempts.attempts+1 end, started=case when jazzbook.login_attempts.started<now()-interval '5 minutes' then now() else jazzbook.login_attempts.started end returning attempts`;if(r.attempts>10)throw new HttpError(429,'시도가 많습니다. 5분 뒤 다시 시도해주세요.');}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Jazzbook-Session'};
 if(origin===ORIGIN)headers['Access-Control-Allow-Origin']=ORIGIN;
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&origin!==ORIGIN)return reply({error:'허용되지 않은 요청입니다.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
 const session=req.headers.get('X-Jazzbook-Session')||'';const hash=await digest(session);
 if(req.method==='GET'){const editable=session?await authorized(sql,hash):false;const rows=await sql`select id,share,data,version,updated from jazzbook.sets where archived=false order by id`;return reply({sets:rows.map(r=>({...r,editable})),serverTime:new Date().toISOString()});}
 if(req.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 if(Number(req.headers.get('content-length'))>1500000)throw new HttpError(413,'데이터가 너무 큽니다.');
 const raw=await req.text();if(raw.length>1500000)throw new HttpError(413,'데이터가 너무 큽니다.');let b;try{b=JSON.parse(raw)}catch{throw new HttpError(400,'요청 형식이 올바르지 않습니다.')}
 if(!b||typeof b!=='object')throw new HttpError(400,'요청 형식이 올바르지 않습니다.');
 if(b.action==='login'){
 if(!validPassword(b.password))throw new HttpError(401,'비밀번호가 맞지 않습니다.');
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';
 await throttle('login:'+await digest(ip));
 const token=newToken(),tokenHash=await digest(token);
 await sql.begin(async(db:any)=>{const [c]=await db`select auth_version,password_hash=extensions.crypt(${b.password},password_hash) as ok from jazzbook.settings where id=true for update`;if(!c?.ok)throw new HttpError(401,'비밀번호가 맞지 않습니다.');await db`delete from jazzbook.sessions where expires<now()`;await db`delete from jazzbook.login_attempts where started<now()-interval '1 day'`;await db`insert into jazzbook.sessions values(${tokenHash},${c.auth_version},now()+interval '12 hours')`;});
 return reply({ok:true,token});
 }
 if(b.action==='logout'){await sql`delete from jazzbook.sessions where token_hash=${hash}`;return reply({ok:true});}
 if(b.action==='password')await throttle('password:'+hash);
 const result=await sql.begin(async(db:any)=>{
 // Lock the settings row so password rotation and all shared writes are ordered.
 await db`select id from jazzbook.settings where id=true for update`;
 if(!session||!await authorized(db,hash))throw new HttpError(401,'편집 권한이 만료되었습니다. 비밀번호로 다시 열어주세요.');
 if(b.action==='password'){
 if(!validPassword(b.newPassword))throw new HttpError(400,'새 비밀번호는 4자 이상, UTF-8 기준 72바이트 이하로 입력해주세요.');
 if(!validPassword(b.currentPassword))throw new HttpError(401,'현재 비밀번호가 맞지 않습니다.');
 const [c]=await db`select password_hash=extensions.crypt(${b.currentPassword},password_hash) as ok from jazzbook.settings where id=true`;
 if(!c?.ok)throw new HttpError(401,'현재 비밀번호가 맞지 않습니다.');
 await db`update jazzbook.settings set password_hash=extensions.crypt(${b.newPassword},extensions.gen_salt('bf',10)),auth_version=auth_version+1,updated=now() where id=true`;
 await db`delete from jazzbook.sessions`;return {ok:true,reauthenticate:true};
 }
 if(b.action==='create'){const title=typeof b.title==='string'?b.title.trim():'';if(!title||title.length>200)throw new HttpError(400,'공연 제목을 입력해주세요.');const id=crypto.randomUUID(),share=crypto.randomUUID(),data={title,date:'',venue:'',memo:'',songs:[]};await db`insert into jazzbook.sets(id,share,data) values(${id},${share},${db.json(data)})`;return {id};}
 if(b.action==='rotate'){const rows=await db`update jazzbook.sets set share=${crypto.randomUUID()} where id=${String(b.id)} and archived=false returning id`;if(!rows.length)throw new HttpError(404,'공연을 찾을 수 없습니다.');return {ok:true};}
 if(b.action||!validData(b.data)||!Number.isInteger(b.version)||typeof b.id!=='string')throw new HttpError(400,'공연 정보 형식이 올바르지 않습니다.');
 const rows=await db`update jazzbook.sets set data=${db.json(b.data)},version=version+1,updated=now() where id=${b.id} and version=${b.version} and archived=false returning version,updated`;
 if(!rows.length)throw new HttpError(409,'다른 기기에서 수정되었습니다. 입력 내용을 복사하고 최신 정보로 다시 시도해주세요.');return {ok:true,...rows[0]};
 });return reply(result);
 }catch(e){return reply({error:e instanceof HttpError?e.message:'서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'},e instanceof HttpError?e.status:503);}
});
