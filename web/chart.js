import {pretty,transpose,keyPC} from './music.js';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rowsFor(bars){const rows=[];let row=[];for(const [index,bar] of bars.entries()){if(bar.section&&row.length){rows.push(row);row=[];}row.push({...bar,index});if(row.length===4){rows.push(row);row=[];}}if(row.length)rows.push(row);return rows;}

// Source Sans 3 advance widths (per 1000 em) for ASCII 33–126, so bars lay out without measuring the DOM.
const table=s=>s.split(',').map(Number);
const ADV={600:table('315,482,513,513,841,639,275,324,324,438,513,275,322,275,344,513,513,513,513,513,513,513,513,513,513,275,275,513,513,513,444,875,558,597,576,625,538,510,628,663,282,494,597,502,745,657,674,582,674,592,545,546,655,536,800,541,501,540,324,344,324,513,500,549,516,563,462,564,507,317,520,558,262,263,522,271,843,560,549,564,564,373,431,361,556,495,748,481,495,443,324,255,324,513'),
 400:table('289,426,497,497,824,609,249,303,303,418,497,249,311,249,350,497,497,497,497,497,497,497,497,497,497,249,249,497,497,497,425,847,543,588,571,615,527,494,617,652,263,479,579,486,727,647,664,566,664,569,534,536,645,515,786,513,476,539,303,350,303,497,500,542,504,553,456,555,496,292,504,544,246,247,495,255,829,547,542,555,555,347,419,338,544,467,719,446,467,425,303,241,303,497')};
const textW=(s,size,w=600)=>[...String(s)].reduce((a,c)=>a+(ADV[w][c.charCodeAt(0)-33]??(c===' '?200:520)),0)/1000*size;

// Geometry measured from iReal Pro on a phone, in SVG units where one bar is 150 wide.
const CELL=150,LEFT=18,RIGHT=4,WIDTH=LEFT+CELL*4+RIGHT;
const LABEL=24,BAR=96.5,PITCH=143,HEAD=66;
const CAP=58.7,R=CAP/.66,S=R*.55,SCAP=S*.66,SQ=.54; // root cap height, root/suffix font sizes, horizontal squeeze
const f=n=>+n.toFixed(2);

// Symbols are drawn (not typed) in unsqueezed space so ♭ ♯ △ ø ° match on every device; (x,y) is the baseline origin.
// Each returns [svg, width].
const SYM={
 b:(x,y,h)=>{const t=y-h,l=h*.13;return [`<path d="M${f(x+l)} ${f(t)}L${f(x+l+h*.15)} ${f(t)}L${f(x+h*.15)} ${f(y)}L${f(x)} ${f(y)}Z" stroke="none"/><path d="M${f(x+h*.1)} ${f(y-h*.48)}C${f(x+h*.32)} ${f(y-h*.62)} ${f(x+h*.66)} ${f(y-h*.62)} ${f(x+h*.56)} ${f(y-h*.4)}C${f(x+h*.48)} ${f(y-h*.22)} ${f(x+h*.26)} ${f(y-h*.08)} ${f(x+h*.07)} ${f(y-h*.03)}" fill="none" stroke="currentColor" stroke-width="${f(h*.14)}"/>`,h*.66];},
 '#':(x,y,h)=>[`<path d="M${f(x+h*.18)} ${f(y-h*.94)}V${f(y+h*.04)}M${f(x+h*.42)} ${f(y-h)}V${f(y-h*.02)}" stroke="currentColor" stroke-width="${f(h*.12)}"/><path d="M${f(x)} ${f(y-h*.56)}L${f(x+h*.6)} ${f(y-h*.7)}M${f(x)} ${f(y-h*.24)}L${f(x+h*.6)} ${f(y-h*.38)}" stroke="currentColor" stroke-width="${f(h*.15)}"/>`,h*.64],
 '^':(x,y)=>[`<path d="M${f(x+3)} ${f(y-2.4)}H${f(x+29)}L${f(x+16)} ${f(y-SCAP*.86)}Z" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linejoin="miter"/>`,33],
 h:(x,y)=>[`<ellipse cx="${f(x+15)}" cy="${f(y-SCAP*.44)}" rx="11" ry="${f(SCAP*.4)}" fill="none" stroke="currentColor" stroke-width="5.4"/><path d="M${f(x+1)} ${f(y+2)}L${f(x+29)} ${f(y-SCAP*.9)}" stroke="currentColor" stroke-width="4"/>`,32],
 o:(x,y)=>[`<ellipse cx="${f(x+12)}" cy="${f(y-SCAP*.68)}" rx="9" ry="${f(SCAP*.28)}" fill="none" stroke="currentColor" stroke-width="5"/>`,25],
};
// Lays out quality/extension text; accidentals inside it sit a little lower like iReal Pro's 7♭9.
function run(str,x,y,size,minor){let svg='',w=0,txt='';const flush=()=>{if(txt){svg+=`<text x="${f(x+w)}" y="${f(y)}" font-size="${f(size)}">${esc(txt)}</text>`;w+=textW(txt,size)+1;txt='';}};
 str=str.replace(/^-/,minor==='-'?'−':'m');
 for(const c of str){if(c==='b'||c==='#'){flush();const [s,sw]=SYM[c](x+w+1,y+size*.1,size*.78);svg+=s;w+=sw+3;}else if(SYM[c]){flush();const k=size/S,[s,sw]=SYM[c](0,0);svg+=`<g transform="translate(${f(x+w)},${f(y)}) scale(${f(k)})">${s}</g>`;w+=sw*k;}else txt+=c;}flush();return [svg,w];}

// One chord symbol, left-aligned at x on baseline y, squeezed to fit `width`. `s` scales it down when rows are tight.
function chord(c,x,y,width,s,minor){
 if(c==='%'||c==='%%'){const cx=x+width/2,cy=y-CAP*.5*s;return `<g transform="translate(${f(cx)},${f(cy)}) scale(${f(s)})"><path d="M-17 23L5 -23H15L-7 23Z${c==='%%'?'M-3 23L19 -23H29L7 23Z':''}"/><circle cx="-10" cy="-13" r="5.2"/><circle cx="${c==='%%'?22:10}" cy="13" r="5.2"/></g>`;}
 if(c==='/')return `<path d="M${f(x+width/2-7)} ${f(y-6*s)}L${f(x+width/2+7)} ${f(y-CAP*s+6)}" stroke="currentColor" stroke-width="5"/>`;
 const alt=/^\(.*\)$/.test(c);if(alt)c=c.slice(1,-1);
 const m=c.match(/^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
 if(!m){const [t,w]=run(c,0,0,S,minor),k=Math.min(SQ,width/w);return `<g transform="translate(${f(x)},${f(y)}) scale(${f(k)} 1)">${t}</g>`;}
 const [,root,acc,suffix,bass]=m,rootW=textW(root,R)-R*.03;
 let out=`<text font-size="${f(R)}">${root}</text>`,w=rootW;
 if(acc){const [a,aw]=SYM[acc](rootW+4,-CAP*(acc==='b'?.55:.5),CAP*(acc==='b'?.74:.62));out+=a;w=rootW+4+aw;}
 const [q,qw]=run(suffix,rootW+(acc?7:6),CAP*.08,S,minor);out+=q;w=Math.max(w,rootW+6+qw);
 if(bass){const [b,bw]=run('/'+bass,w+2,CAP*.08,S,minor);out+=b;w+=2+bw;}
 // iReal squeezes busy bars horizontally first, then shrinks them if they still do not fit.
 const k=Math.min(1,width/(w*SQ*s)),sy=s*(alt?.6:Math.min(1,k/.7));
 return `<g transform="translate(${f(x)},${f(alt?y-CAP*s*.95:y)}) scale(${f(SQ*s*k*(alt?.6:1))} ${f(sy)})">${out}</g>`;
}
const vline=(x,y1,y2,w=2.3)=>`<path d="M${f(x)} ${f(y1)}V${f(y2)}" stroke="currentColor" stroke-width="${w}"/>`;
const dots=(x,top,h)=>`<circle cx="${f(x)}" cy="${f(top+h*.36)}" r="3.3"/><circle cx="${f(x)}" cy="${f(top+h*.64)}" r="3.3"/>`;
// Library composers are stored "Last First"; show them "First Last" like iReal Pro.
const composer=c=>{const p=String(c||'').trim().split(/\s+/);return p.length===2?p[1]+' '+p[0]:p.join(' ');};
function heading(song,bpm){const t=song.title||'',tw=textW(t,34,400)*.78,ts=Math.min(.78,(WIDTH-12)/Math.max(tw/.78,1));
 const left=[song.style?`(${song.style})`:'',bpm?bpm+' bpm':''].filter(Boolean).join('  ');
 return `<g font-weight="400"><text transform="translate(${WIDTH/2},28) scale(${f(ts)} 1)" text-anchor="middle" font-size="34">${esc(t)}</text><text transform="translate(3,56) scale(.78 1)" font-size="30">${esc(left)}</text><text transform="translate(${WIDTH-3},56) scale(.78 1)" text-anchor="end" font-size="30">${esc(composer(song.composer))}</text></g>`;}

// Renders the chart as SVG. With `aspect` (height/width of the screen area) rows are spaced, and if needed shrunk,
// so the whole song fits without scrolling, like iReal Pro.
export function renderChart(song,target=song.key,{aspect=0,head=true,minor='m'}={}){
 const rows=rowsFor(song.bars),delta=(keyPC(target)??0)-(keyPC(song.key)??0),top0=head?HEAD:4;
 let pitch=PITCH;if(aspect>0)pitch=Math.min(PITCH*1.25,Math.max(PITCH*.5,(WIDTH*aspect-top0-6)/rows.length));
 const s=Math.min(1,pitch/PITCH),bar=BAR*s,label=LABEL*s;
 const body=rows.map((row,ri)=>{const y=top0+ri*pitch,top=y+label,bottom=top+bar,base=top+bar*.826;return row.map((b,ci)=>{const x=LEFT+(ci+(row.length<4&&row[0].ending?4-row.length:0))*CELL;let out='',from=x+5,to=x+CELL-4;
 if(b.start==='{'){out+=vline(x+1,top,bottom,5)+vline(x+7,top,bottom)+dots(x+12.5,top,bar);from=x+18;}
 else if(b.start==='['){out+=vline(x,top,bottom)+vline(x+4.6,top,bottom);from=x+10;}
 else out+=vline(x,top,bottom);
 if(b.end==='}'){out+=dots(x+CELL-12.5,top,bar)+vline(x+CELL-7,top,bottom)+vline(x+CELL-1,top,bottom,5);to=x+CELL-17;}
 else if(b.end==='Z'){out+=vline(x+CELL-6.5,top,bottom)+vline(x+CELL-1,top,bottom,5);to=x+CELL-10;}
 else if(b.end===']'){out+=vline(x+CELL-4.6,top,bottom)+vline(x+CELL,top,bottom);to=x+CELL-8;}
 else if(ci===row.length-1)out+=vline(x+CELL,top,bottom);
 if(b.section)out+=`<rect x="${f(x-4-11*s)}" y="${f(top-label+.5)}" width="${f(22*s)}" height="${f(label-2)}" rx="1"/><text transform="translate(${f(x-4)},${f(top-label+.5+(label-2)*.86)}) scale(.8 1)" text-anchor="middle" font-size="${f((label-2)*1.08)}" class="section">${esc(b.section)}</text>`;
 if(b.ending){let n=1;while(ci+n<row.length&&!row[ci+n].ending&&!row[ci+n-1].end)n++;out+=`<path d="M${x+3} ${f(top-2)}V${f(y+2)}H${x+CELL*n-6}" fill="none" stroke="currentColor" stroke-width="2"/><text transform="translate(${x+9},${f(y+label*.82)}) scale(.8 1)" font-size="${f(label*.9)}">${esc(b.ending)}</text>`;}
 if(b.time){const [n,d]=b.time.split('/'),ds=bar*.5;out+=`<g font-size="${f(ds)}" text-anchor="middle"><text transform="translate(${f(x-9)},${f(top+bar*.43)}) scale(.62 1)">${esc(n)}</text><text transform="translate(${f(x-9)},${f(bottom-1)}) scale(.62 1)">${esc(d)}</text></g><path d="M${f(x-14.5)} ${f(top+bar*.52)}H${f(x-3.5)}" stroke="currentColor" stroke-width="2.4"/>`;}
 if(b.text)out+=`<text transform="translate(${f(x+(b.section?10:b.ending?28:6))},${f(top-label*.22)}) scale(.85 1)" font-size="${f(label*.78)}" font-weight="400" class="annotation">${esc(b.text)}</text>`;
 const cs=b.chords,slot=(to-from)/Math.max(cs.length,1);
 out+=cs.map((c,k)=>chord(transpose(c,delta,target),from+k*slot,base,slot-(k<cs.length-1?5:0),s,minor)).join('');
 return `<g role="img" aria-label="${b.index+1}마디 ${esc(cs.map(c=>pretty(transpose(c,delta,target))).join(' '))}">${out}</g>`;}).join('');}).join('');
 const h=f(top0+(rows.length-1)*pitch+label+bar+8);
 return `<svg xmlns="http://www.w3.org/2000/svg" class="chart" viewBox="0 0 ${WIDTH} ${h}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(song.title)} 코드 차트" fill="currentColor" font-weight="600">${head?heading(song,song.bpm):''}${body}</svg>`;
}
