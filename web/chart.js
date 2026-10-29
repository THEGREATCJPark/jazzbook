import {pretty,transpose,keyPC} from './music.js';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rowsFor(bars){const rows=[];let row=[];for(const [index,bar] of bars.entries()){if(bar.section&&row.length){rows.push(row);row=[];}row.push({...bar,index});if(row.length===4){rows.push(row);row=[];}}if(row.length)rows.push(row);return rows;}

// Pathway Gothic One advance widths (per 1000 em) for ASCII 33–126, so bars lay out without measuring the DOM.
const ADV='200,301,489,384,693,421,177,260,260,391,377,163,252,163,290,411,235,400,408,379,378,404,333,417,404,163,163,377,377,377,358,616,394,382,374,406,359,323,408,436,206,295,381,313,541,450,411,363,411,386,398,299,422,392,578,381,374,351,266,290,266,265,329,245,368,390,346,392,379,216,373,398,203,205,359,203,587,398,379,390,390,258,356,239,391,342,544,348,349,320,282,234,282,377'.split(',').map(Number);
const adv=ch=>(ADV[ch.charCodeAt(0)-33]??400)/1000;
// Chart geometry (SVG units): 4 bars per row like iReal Pro.
const CELL=150,LEFT=20,TOP=26,BAR=110,PITCH=148,ROOT=112,CAP=.7;
const f=n=>+n.toFixed(1);

// Drawn music symbols so ♭ ♯ △ ø ° look the same on every device. Each returns [svg, width]; (x,y) is the baseline origin, s the symbol height.
const SYM={
 b:(x,y,s)=>[`<path d="M${f(x+s*.06)} ${f(y-s)}V${f(y)}C${f(x+s*.5)} ${f(y-s*.18)} ${f(x+s*.52)} ${f(y-s*.56)} ${f(x+s*.06)} ${f(y-s*.4)}" fill="none" stroke="currentColor" stroke-width="${f(s*.11)}"/>`,s*.5],
 '#':(x,y,s)=>[`<path d="M${f(x+s*.16)} ${f(y-s*.92)}V${f(y+s*.04)}M${f(x+s*.36)} ${f(y-s)}V${f(y-s*.04)}" stroke="currentColor" stroke-width="${f(s*.07)}"/><path d="M${f(x)} ${f(y-s*.56)}L${f(x+s*.52)} ${f(y-s*.7)}M${f(x)} ${f(y-s*.22)}L${f(x+s*.52)} ${f(y-s*.36)}" stroke="currentColor" stroke-width="${f(s*.13)}"/>`,s*.58],
 '^':(x,y,s)=>[`<path d="M${f(x+s*.06)} ${f(y-s*.05)}H${f(x+s*.7)}L${f(x+s*.38)} ${f(y-s*.68)}Z" fill="none" stroke="currentColor" stroke-width="${f(s*.075)}" stroke-linejoin="round"/>`,s*.78],
 h:(x,y,s)=>[`<circle cx="${f(x+s*.3)}" cy="${f(y-s*.33)}" r="${f(s*.22)}" fill="none" stroke="currentColor" stroke-width="${f(s*.07)}"/><path d="M${f(x+s*.02)} ${f(y-s*.02)}L${f(x+s*.58)} ${f(y-s*.66)}" stroke="currentColor" stroke-width="${f(s*.07)}"/>`,s*.62],
 o:(x,y,s)=>[`<circle cx="${f(x+s*.24)}" cy="${f(y-s*.5)}" r="${f(s*.18)}" fill="none" stroke="currentColor" stroke-width="${f(s*.07)}"/>`,s*.5],
};
// Lays out a run of chord text at size `size`; accidentals and quality marks become drawn symbols.
function run(str,x,y,size){let svg='',w=0,txt='';const flush=()=>{if(txt){svg+=`<text x="${f(x+w)}" y="${f(y)}" font-size="${f(size)}">${esc(txt.replace(/-/g,'−'))}</text>`;w+=[...txt].reduce((a,c)=>a+adv(c),0)*size;txt='';}};
 for(const c of str){if(SYM[c]){flush();const [s,sw]=SYM[c](x+w,y,size*(c==='b'||c==='#'?.62:.72));svg+=s;w+=sw;}else txt+=c;}flush();return [svg,w];}

function chord(c,x,y,width){
 if(c==='%'||c==='%%'){const cx=x+width/2,cy=y-ROOT*CAP/2;return `<g transform="translate(${f(cx)},${f(cy)})"><path d="M-15 17L15 -17${c==='%%'?' M-3 17L27 -17':''}" stroke="currentColor" stroke-width="5"/><circle cx="-11" cy="-10" r="4.5"/><circle cx="${c==='%%'?23:11}" cy="10" r="4.5"/></g>`;}
 if(c==='/')return `<path d="M${f(x+width/2-9)} ${f(y-8)}L${f(x+width/2+9)} ${f(y-ROOT*CAP+8)}" stroke="currentColor" stroke-width="5"/>`;
 const alt=/^\(.*\)$/.test(c);if(alt)c=c.slice(1,-1);
 const m=c.match(/^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
 if(!m){const [s,w]=run(c,0,0,ROOT*.5);const k=Math.min(1,width/w);return `<g transform="translate(${f(x+Math.max(0,(width-w*k)/2))},${f(y)}) scale(${f(k)})">${s}</g>`;}
 const [,root,acc,suffix,bass]=m,R=ROOT,S=R*.5,rootW=adv(root)*R;
 let out=`<text font-size="${R}">${root}</text>`,w=rootW;
 // Root accidental is a small superscript at cap height.
 if(acc){const [as,aw]=SYM[acc](rootW+3,-R*CAP+R*.3,R*.3);out+=as;w=rootW+3+aw;}
 // Quality sits low, beside the root; with an accidental it tucks under it like iReal Pro.
 const [qs,qw]=run(suffix,rootW+1,R*.02,S);out+=qs;w=Math.max(w,rootW+1+qw);
 if(bass){const [bs,bw]=run('/'+bass,w+1,R*.06,S*.92);out+=bs;w+=1+bw;}
 // Squeeze horizontally first (iReal condenses busy bars), then shrink if it still does not fit.
 const k=Math.min(1,width/w),sy=alt?.6:Math.min(1,k/.62);
 return `<g transform="translate(${f(x)},${f(alt?y-R*.62:y)}) scale(${f(alt?.6*k:k)} ${f(sy)})">${out}</g>`;
}
const vline=(x,y1,y2,w=1.6)=>`<path d="M${f(x)} ${y1}V${y2}" stroke="currentColor" stroke-width="${w}"/>`;
const dots=(x,top)=>`<circle cx="${x}" cy="${top+BAR*.38}" r="3.6"/><circle cx="${x}" cy="${top+BAR*.62}" r="3.6"/>`;
export function renderChart(song,target=song.key){
 const rows=rowsFor(song.bars),width=LEFT+CELL*4+6,delta=(keyPC(target)??0)-(keyPC(song.key)??0);
 const body=rows.map((row,ri)=>{const y=ri*PITCH+4,top=y+TOP,bottom=top+BAR,base=top+BAR*.84;return row.map((b,ci)=>{const x=LEFT+(ci+(row.length<4&&row[0].ending?4-row.length:0))*CELL;let out='',from=x+9,to=x+CELL-5;
 if(b.start==='{'){out+=vline(x,top,bottom,5)+vline(x+7,top,bottom)+dots(x+14,top);from=x+22;}
 else if(b.start==='['){out+=vline(x,top,bottom)+vline(x+5,top,bottom);from=x+13;}
 else out+=vline(x,top,bottom);
 if(b.end==='}'){out+=dots(x+CELL-14,top)+vline(x+CELL-7,top,bottom)+vline(x+CELL-2.5,top,bottom,5);to=x+CELL-21;}
 else if(b.end==='Z'){out+=vline(x+CELL-8,top,bottom)+vline(x+CELL-2.5,top,bottom,5);to=x+CELL-12;}
 else if(b.end===']'){out+=vline(x+CELL-5,top,bottom)+vline(x+CELL,top,bottom);to=x+CELL-10;}
 else if(ci===row.length-1)out+=vline(x+CELL,top,bottom);
 if(b.section)out+=`<rect x="${x-1}" y="${y}" width="22" height="24" fill="none" stroke="currentColor" stroke-width="2"/><text x="${x+10}" y="${y+20.5}" text-anchor="middle" font-size="24">${esc(b.section)}</text>`;
 if(b.ending){let n=1;while(ci+n<row.length&&!row[ci+n].ending&&!row[ci+n-1].end)n++;out+=`<path d="M${x+3} ${top-2}V${y+2}H${x+CELL*n-6}" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="${x+9}" y="${y+21}" font-size="20">${esc(b.ending)}</text>`;}
 if(b.time){const [n,d]=b.time.split('/');out+=`<g font-size="40" text-anchor="middle"><text x="${x-10}" y="${top+BAR*.47}">${esc(n)}</text><text x="${x-10}" y="${top+BAR*.84}">${esc(d)}</text></g>`;}
 if(b.text)out+=`<text x="${x+(b.section||b.ending?30:4)}" y="${y+20}" font-size="20" class="annotation">${esc(b.text)}</text>`;
 const cs=b.chords,slot=(to-from)/Math.max(cs.length,1);
 out+=cs.map((c,k)=>chord(transpose(c,delta,target),from+k*slot,base,slot-(k<cs.length-1?9:0))).join('');
 return `<g role="img" aria-label="${b.index+1}마디 ${esc(cs.map(c=>pretty(transpose(c,delta,target))).join(' '))}">${out}</g>`;}).join('');}).join('');
 const h=rows.length*PITCH+8;
 return `<svg xmlns="http://www.w3.org/2000/svg" class="chart" viewBox="0 0 ${width} ${h}" role="img" aria-label="${esc(song.title)} 코드 차트" style="--ratio:${width}/${h}">${body}</svg>`;
}
