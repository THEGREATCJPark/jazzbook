import {pretty,transpose,keyPC} from './music.js';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rowsFor(bars){const rows=[];let row=[];for(const [index,bar] of bars.entries()){if(bar.section&&row.length){rows.push(row);row=[];}row.push({...bar,index});if(row.length===4){rows.push(row);row=[];}}if(row.length)rows.push(row);return rows;}
const line=(x,y,x2,y2,w=1.5)=>`<path d="M${x} ${y}H${x2}V${y2}" fill="none" stroke="currentColor" stroke-width="${w}"/>`;
function chord(c,x,y,width){
 if(c==='%'||c==='%%'){return `<g transform="translate(${x+width/2},${y-17})"><path d="M-11 12L11 -12${c==='%%'?' M-3 12L19 -12':''}" stroke="currentColor" stroke-width="2.6"/><circle cx="-9" cy="-8" r="3.5" fill="currentColor"/><circle cx="9" cy="8" r="3.5" fill="currentColor"/></g>`;}
 const m=c.match(/^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
 if(!m)return `<text x="${x+width/2}" y="${y}" text-anchor="middle" font-size="25">${esc(pretty(c))}</text>`;
 const [,root,acc,suffix,bass]=m;const sf=pretty(suffix);const approx=23+(acc?12:0)+sf.length*12;const scale=Math.min(1,(width-9)/approx);
 return `<g transform="translate(${x+6},${y}) scale(${scale} 1)"><text font-size="43" font-weight="300">${root}</text>${acc?`<text x="25" y="-17" font-size="26">${esc(pretty(acc))}</text>`:''}<text x="${25+(acc?14:0)}" y="-8" font-size="24" letter-spacing="-1">${esc(sf)}</text>${bass?`<text x="14" y="24" font-size="23">/${esc(pretty(bass))}</text>`:''}</g>`;
}
export function renderChart(song,target=song.key){
 const rows=rowsFor(song.bars),width=600,h=116,delta=(keyPC(target)??0)-(keyPC(song.key)??0);
 const body=rows.map((row,ri)=>{const y=ri*h+8;return row.map((b,ci)=>{const x=(ci+(row.length<4&&row[0].ending?4-row.length:0))*145+12,top=y+32,bottom=y+102;let out='';
 if(b.section)out+=`<rect x="${x}" y="${y}" width="23" height="24" fill="currentColor"/><text x="${x+11.5}" y="${y+19}" text-anchor="middle" class="section" font-size="21" font-weight="600">${esc(b.section)}</text>`;
 if(b.ending){let n=1;while(ci+n<row.length&&!row[ci+n].ending&&!row[ci+n-1].end)n++;out+=line(x+4,y+31,x+145*n-4,y+26)+`<text x="${x+10}" y="${y+25}" font-size="17">${esc(b.ending)}</text>`;}
 out+=line(x,top,x,bottom);
 if(b.start==='['||b.start==='{')out+=line(x+4,top,x+4,bottom);
 if(b.start==='{')out+=`<circle cx="${x+10}" cy="${top+26}" r="2.5" fill="currentColor"/><circle cx="${x+10}" cy="${top+40}" r="2.5" fill="currentColor"/>`;
 const cs=b.chords;out+=cs.map((c,k)=>chord(transpose(c,delta,target),x+k*142/Math.max(cs.length,1),y+80,142/Math.max(cs.length,1))).join('');
 if(b.end){out+=line(x+141,top,x+141,bottom,b.end==='Z'?4:1.5);out+=line(x+136,top,x+136,bottom);if(b.end==='}')out+=`<circle cx="${x+129}" cy="${top+26}" r="2.5" fill="currentColor"/><circle cx="${x+129}" cy="${top+40}" r="2.5" fill="currentColor"/>`;}
 else if(ci===row.length-1)out+=line(x+141,top,x+141,bottom);
 if(b.text)out+=`<text x="${x+29}" y="${y+17}" font-size="11" class="annotation">${esc(b.text)}</text>`;
 if(b.time&&b.index===0)out+=`<text x="${x+27}" y="${y+20}" font-size="15" class="annotation">${esc(b.time)}</text>`;
 return `<g role="img" aria-label="${b.index+1}마디 ${esc(cs.map(c=>pretty(transpose(c,delta,target))).join(' '))}">${out}</g>`;}).join('');}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows.length*h+16}" role="img" aria-label="${esc(song.title)} 코드 차트" style="--ratio:${width}/${rows.length*h+16}">${body}</svg>`;
}
