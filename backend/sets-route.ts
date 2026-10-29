import {env} from 'cloudflare:workers';
import {initialSets} from '../../../lib/model';
import extraCharts from '../../../lib/extra-charts.json';
export const dynamic='force-dynamic';
const PUBLIC='public-band';
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
function editor(req:Request){const key=req.headers.get('X-Setnote-Editor');return !!env.EDITOR_KEY&&key===env.EDITOR_KEY}
async function seed(){await env.DB!.batch(initialSets.map((data,i)=>env.DB!.prepare('INSERT OR IGNORE INTO sets(id,owner,share,data,version,updated) VALUES(?,?,?,?,1,?)').bind('public-event-'+i,PUBLIC,'public-event-'+i,JSON.stringify(data),new Date().toISOString())))}
async function get(req:Request){try{await seed();await fillMissing();const q=new URL(req.url).searchParams,token=q.get('share');const rows=token?await env.DB!.prepare('SELECT * FROM sets WHERE owner=? AND share=? ORDER BY id').bind(PUBLIC,token).all():await env.DB!.prepare('SELECT * FROM sets WHERE owner=? ORDER BY id').bind(PUBLIC).all();if(token&&!rows.results.length)return json({error:'공연 링크가 만료되었거나 존재하지 않습니다.'},404);return json({user:null,sets:rows.results.map((r:any)=>({id:r.id,share:r.share,data:JSON.parse(r.data),version:r.version,updated:r.updated,editable:editor(req)}))})}catch{return json({error:'공연 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.'},503)}}
async function post(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin&&req.headers.get('origin')!==PAGES)return json({error:'잘못된 요청입니다.'},403);
 if(!editor(req))return json({error:'공통 편집은 리더 관리 링크에서만 가능합니다.'},403);
 const raw=await req.text();if(raw.length>1500000)return json({error:'데이터가 너무 큽니다.'},413);const b=JSON.parse(raw),db=env.DB!;
 if(b.action==='create'){const id=crypto.randomUUID(),share=crypto.randomUUID(),data={title:String(b.title||'새 공연').slice(0,100),date:'',venue:'',memo:'',songs:[]};await db.prepare('INSERT INTO sets(id,owner,share,data,version,updated) VALUES(?,?,?,?,1,?)').bind(id,PUBLIC,share,JSON.stringify(data),new Date().toISOString()).run();return json({id});}
 const r:any=await db.prepare('SELECT * FROM sets WHERE id=? AND owner=?').bind(b.id,PUBLIC).first();if(!r)return json({error:'공연을 찾을 수 없습니다.'},404);
 if(b.action==='rotate'){await db.prepare('UPDATE sets SET share=? WHERE id=? AND owner=?').bind(crypto.randomUUID(),b.id,PUBLIC).run();return json({ok:true});}
 if(!valid(b.data))return json({error:'공연 정보 형식이 올바르지 않습니다.'},400);
 const updated=new Date().toISOString();const result=await db.prepare('UPDATE sets SET data=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(b.data),updated,b.id,PUBLIC,b.version).run();if(!result.meta.changes)return json({error:'다른 기기에서 수정되었습니다. 편집 내용을 복사한 뒤 창을 닫고 최신 정보를 확인하세요.'},409);
 return json({ok:true,version:b.version+1,updated});
 }catch{return json({error:'저장에 실패했습니다. 입력 내용은 유지됩니다.'},500)}}
function valid(d:any){return d&&typeof d.title==='string'&&d.title.length>0&&d.title.length<=200&&['date','venue','memo'].every(k=>typeof d[k]==='string')&&Array.isArray(d.songs)&&d.songs.length<=200&&new Set(d.songs.map((s:any)=>s.id)).size===d.songs.length&&d.songs.every((s:any)=>s&&['id','title','composer','key','bpm','style','memo'].every(k=>typeof s[k]==='string')&&Array.isArray(s.bars)&&s.bars.length<=1000&&s.bars.every((b:any)=>b&&Array.isArray(b.chords)&&b.chords.length<=32&&b.chords.every((c:any)=>typeof c==='string'&&c.length<100)&&['section','ending','start','end','text','time'].every(k=>b[k]===undefined||typeof b[k]==='string')))}

const PAGES='https://thegreatcjpark.github.io';
function cors(req:Request,response:Response){if(req.headers.get('origin')===PAGES){response.headers.set('Access-Control-Allow-Origin',PAGES);response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type, X-Setnote-Editor');response.headers.set('Vary','Origin');}return response;}
export async function GET(req:Request){return cors(req,await get(req));}
export async function POST(req:Request){return cors(req,await post(req));}
export async function OPTIONS(req:Request){return cors(req,new Response(null,{status:req.headers.get('origin')===PAGES?204:403}));}
// Fill only missing uploaded charts. Never replace an existing arrangement or user memo.
async function fillMissing(){
 const row:any=await env.DB!.prepare('SELECT * FROM sets WHERE id=? AND owner=?').bind('public-event-0',PUBLIC).first();if(!row)return;
 const data=JSON.parse(row.data);let changed=false;
 for(const song of data.songs){const c=extraCharts.find(c=>c.id===song.id);if(c&&!song.bars.length){song.bars=c.bars;song.key=song.key||c.key;song.style=song.style||c.style;song.composer=song.composer||c.composer;song.bpm=song.bpm||c.bpm;song.source=c.source;song.warnings=c.warnings;changed=true;}}
 if(changed)await env.DB!.prepare('UPDATE sets SET data=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(data),new Date().toISOString(),row.id,PUBLIC,row.version).run();
}
