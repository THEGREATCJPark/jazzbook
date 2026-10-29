export function validData(d){
 if(!d||typeof d.title!=='string'||!d.title.trim()||d.title.length>200)return false;
 if(!['date','venue','memo'].every(k=>typeof d[k]==='string'))return false;
 if(!Array.isArray(d.songs)||d.songs.length>200||new Set(d.songs.map(s=>s?.id)).size!==d.songs.length)return false;
 return d.songs.every(s=>s&&['id','title','composer','key','bpm','style','memo'].every(k=>typeof s[k]==='string')&&s.id.length>0&&Array.isArray(s.bars)&&s.bars.length<=1000&&s.bars.every(b=>b&&Array.isArray(b.chords)&&b.chords.length<=32&&b.chords.every(c=>typeof c==='string'&&c.length<100)&&['section','ending','start','end','text','time'].every(k=>b[k]===undefined||typeof b[k]==='string')));
}
export function validPassword(p){return typeof p==='string'&&p.length>=4&&new TextEncoder().encode(p).length<=72;}
