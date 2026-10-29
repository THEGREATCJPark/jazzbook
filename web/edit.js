import {transpose,keyPC} from './music.js';

// Turns what people type (Cmaj7, Bbm7b5, F#dim7, C7(b9), N.C., %) into the chart's chord token, or null if unreadable.
export function normChord(raw){
 let s=String(raw).trim().replace(/♭/g,'b').replace(/♯/g,'#').replace(/[Δ△]/g,'^').replace(/ø/g,'h').replace(/°/g,'o').replace(/−/g,'-');
 if(!s)return null;
 if(s==='%'||/^x$/i.test(s))return '%';
 if(s==='/')return '/';
 if(/^n\.?c\.?$/i.test(s))return 'N.C.';
 const m=s.match(/^([a-gA-G])([#b]?)(.*?)(?:\/([a-gA-G])([#b]?))?$/);if(!m)return null;
 let [,root,acc,q,bass,bacc]=m;
 q=q.replace(/[()\s,]/g,'').replace('6/9','69')
  .replace(/^(?:m|mi|min|-)7?b5/,'h7')
  .replace(/^(?:m|mi|min|-)(?:maj|Maj|MAJ|ma|M|\^)/,'-^')
  .replace(/^(?:maj|Maj|MAJ|ma|M)/,'^')
  .replace(/^(?:min|mi|m)/,'-')
  .replace(/^dim/,'o').replace(/^aug/,'+');
 if(!/^(?:[-^ho+]|sus|add|alt|\d|b|#)*$/.test(q))return null;
 return root.toUpperCase()+acc+q+(bass?'/'+bass.toUpperCase()+(bacc||''):'');
}
// Chord token as people read and type it: Bb-7 → Bbm7, Eb^7 → EbΔ7, Dh7 → Dø7. Accidentals stay b/# so they are easy to type.
export function friendly(c,minor='m'){
 if(c==='N.C.'||c==='%'||c==='/')return c;
 return c.replace(/^([A-G][#b]?)-/,(_,r)=>r+(minor==='-'?'-':'m')).replace(/\^/g,'Δ').replace(/h/g,'ø').replace(/o/g,'°');
}
// Bars ⇄ the one-line text in the editor ("Am7 D7 | Gm7 C7"). `delta` is display key minus stored key.
export function barsToText(bars,delta,target,minor){return bars.map(b=>b.chords.map(c=>friendly(transpose(c,delta,target),minor)).join(' ')).join(' | ');}
export function textToBars(text,delta,storedKey){
 const parts=String(text).split('|');if(parts.length>1&&!parts[parts.length-1].trim())parts.pop();
 return parts.map(p=>p.split(/[\s,]+/).filter(Boolean).map(t=>{const c=normChord(t);if(!c)throw Error(`'${t}' 코드를 읽지 못했습니다.`);return transpose(c,-delta,storedKey);}));
}
const copy=bars=>bars.map(b=>({...b,chords:[...b.chords]}));
// Replaces bars i..j with new chord lists. Same count keeps each bar's barlines; otherwise the new run inherits the
// first bar's section/start and the last bar's end, so typing more or fewer bars inserts or removes them.
export function replaceRange(bars,i,j,lists){
 // Extra bars first fill the empty bars that follow, so a blank chart fills left to right instead of growing.
 while(lists.length>j-i+1&&bars[j+1]&&!bars[j+1].chords.length)j++;
 const out=copy(bars),sel=out.slice(i,j+1);
 if(lists.length===sel.length){lists.forEach((l,k)=>{out[i+k].chords=l;});return out;}
 const first=sel[0]||{},last=sel[sel.length-1]||{};
 const made=lists.map((chords,k)=>{const b={chords};if(k===0)for(const p of ['section','start','time','ending','text'])if(first[p]!==undefined)b[p]=first[p];if(k===lists.length-1&&last.end!==undefined)b.end=last.end;return b;});
 out.splice(i,sel.length,...made);return out;
}
// Bar structure edits; a value of '' removes the mark (never stored as null, which the server rejects).
export function setMark(bars,i,prop,value){const out=copy(bars);if(value)out[i][prop]=value;else delete out[i][prop];return out;}
export function insertBar(bars,after){const out=copy(bars);out.splice(after+1,0,{chords:[]});return out;}
export function deleteBars(bars,i,j){const out=copy(bars);const gone=out.splice(i,j-i+1);if(!out.length)return [{chords:[],section:'A',start:'[',time:'4/4',end:'Z'}];
 if(gone[0].section&&out[i]&&!out[i].section)out[i].section=gone[0].section;const end=gone[gone.length-1].end;if(end&&out[i-1]&&!out[i-1].end&&!out[i])out[i-1].end=end;return out;}
export const blankChart=()=>Array.from({length:16},(_,k)=>({chords:[],...(k===0?{section:'A',start:'[',time:'4/4'}:{}),...(k===15?{end:'Z'}:{})}));

// Reharmonisation ideas for the selection, already in the display key. Each is the text to put in the editor.
export function suggest(bars,i,j,target,minor){
 const out=[],n=j-i+1,minorKey=/-$/.test(target),home=target.replace(/-$/,''),at=(c,k)=>transpose(c,(keyPC(home)??0)+k,target);
 const say=(label,chords)=>out.push({label,text:chords.map(bar=>bar.map(c=>friendly(c,minor)).join(' ')).join(' | ')});
 const one=n===1&&bars[i]?.chords.length===1?bars[i].chords[0]:'';const m=one.match(/^([A-G][#b]?)(.*?)(?:\/.*)?$/);
 if(m){const [,r,q]=m,up=k=>transpose(r,k,target);
  if(/^(7|9|13|alt)/.test(q)){say('♭II7 대리',[[up(6)+'7']]);say('ii–V로',[[up(7)+'-7',r+'7']]);}
  else if(/^(\^|6|$)/.test(q)){say('I–VI7',[[one,up(9)+'7']]);}
  else if(/^-7/.test(q)){say('ii–V로',[[one,up(5)+'7']]);}
 }
 if(n===2){if(minorKey){say('i–♭VI–iiø–V',[[at('C-6',0),at('Ab7',0)],[at('Dh7',0),at('G7b9',0)]]);}
  else{say('I–VI–ii–V',[[at('C^7',0),at('A7',0)],[at('D-7',0),at('G7',0)]]);say('iii–VI–ii–V',[[at('E-7',0),at('A7',0)],[at('D-7',0),at('G7',0)]]);say('태드 대머론',[[at('C^7',0),at('Eb^7',0)],[at('Ab^7',0),at('Db^7',0)]]);}}
 if(n===1&&!minorKey&&!m)say('ii–V',[[at('D-7',0),at('G7',0)]]);
 return out;
}
