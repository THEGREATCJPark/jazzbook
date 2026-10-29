export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const pc = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0 };
export function keyPC(key) { return pc[key.replace(/[-m]$/, '')]; }
export function transpose(chord, delta, target = 'C') {
    if (delta % 12 === 0)
        return chord;
    const names = /^(G|D|A|E|B|F#|C#)(-|m)?$/.test(target) ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] : KEYS;
    return chord.replace(/(^|\/|\()([A-G][#b]?)/g, (_, p, n) => p + (n.includes('#') ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] : n.includes('b') ? KEYS : names)[(pc[n] + delta % 12 + 12) % 12]);
}
export function pretty(c) { return c.replace(/\^/g, '△').replace(/-/g, '−').replace(/h/g, 'ø').replace(/o/g, '°').replace(/b/g, '♭').replace(/#/g, '♯'); }
export function decodeMusic(raw) {
    let s = raw.startsWith('1r34LbKcu7') ? raw.slice(10) : raw, r = '';
    if (!raw.startsWith('1r34LbKcu7'))
        return s;
    while (s.length > 50) {
        let block = s.slice(0, 50);
        s = s.slice(50);
        if (s.length >= 2) {
            const a = block.split('');
            for (let i = 0; i < 50; i++)
                if (i < 5 || (i >= 10 && i < 24)) {
                    a[i] = block[49 - i];
                    a[49 - i] = block[i];
                }
            block = a.join('');
        }
        r += block;
    }
    return r + s;
}
export function parseChart(raw) {
    let s = raw.replace(/XyQ/g, '   ').replace(/Kcl/g, '| x ').replace(/LZ/g, '|');
    const bars = [], warnings = new Set();
    let b = { chords: [] }, active = false, cells = 0;
    const has = () => b.chords.length || b.text || (active && cells > 0);
    const finish = () => { if (has()) {
        bars.push(b);
        b = { chords: [] };
    } cells = 0; };
    while (s.length) {
        let m;
        if ((m = s.match(/^<([^>]*)>/))) {
            b.text = [b.text, m[1].replace(/^\*\d{2}/, '')].filter(Boolean).join(' · ');
            s = s.slice(m[0].length);
            continue;
        }
        if ((m = s.match(/^\*([A-Za-z])/))) {
            if (b.chords.length)
                finish();
            b.section = m[1];
            s = s.slice(2);
            continue;
        }
        if ((m = s.match(/^T(\d{2})/))) {
            b.time = m[1] === '12' ? '12/8' : m[1].split('').join('/');
            s = s.slice(3);
            continue;
        }
        if ((m = s.match(/^N([0-9])/))) {
            b.ending = m[1] + '.';
            s = s.slice(2);
            continue;
        }
        if (' |[]{}Z'.includes(s[0]) && s[0] !== ' ') {
            const t = s[0];
            if (t === ']' || t === '}' || t === 'Z') {
                if (has()) {
                    b.end = t;
                    finish();
                }
                else if (bars.length)
                    bars[bars.length - 1].end = t;
                active = false;
            }
            else {
                finish();
                active = true;
                if (t !== '|')
                    b.start = t;
            }
            s = s.slice(1);
            continue;
        }
        if ((m = s.match(/^\(?[A-G][#b]?(?:(?:maj|min|add|sus|alt)|[0-9+\-^hob#])*(?:\([a-z0-9+#-]+\))?(?:\/[A-G][#b]?)?\)?/))) {
            b.chords.push(m[0]);
            s = s.slice(m[0].length);
            continue;
        }
        if ('xrn'.includes(s[0])) {
            b.chords.push({ x: '%', r: '%%', n: 'N.C.' }[s[0]]);
            s = s.slice(1);
            continue;
        }
        if ('SQf'.includes(s[0])) {
            b.text = [b.text, { S: '𝄋', Q: '𝄌', f: '𝄐' }[s[0]]].filter(Boolean).join(' ');
            s = s.slice(1);
            continue;
        }
        if (s[0] === 'p') {
            b.chords.push('/');
            s = s.slice(1);
            continue;
        }
        if (/[\s,Ysl]/.test(s[0])) {
            if (s[0] === ' ' && active)
                cells++;
            s = s.slice(1);
            continue;
        }
        warnings.add(s[0]);
        s = s.slice(1);
    }
    finish();
    return { bars, warnings: warnings.size ? ['일부 기호를 해석하지 못했습니다: ' + [...warnings].join(' ')] : [] };
}
export function importIreal(input) {
    if (input.length > 4000000)
        throw Error('파일은 1MB 이하로 선택해주세요.');
    const links = [...input.matchAll(/ireal(?:book|b):\/\/[^"<>\r\n]+/g)].map(m => m[0].replace(/&amp;/g, '&'));
    if (!links.length)
        throw Error('iReal Pro 공유 링크 또는 HTML 파일을 넣어주세요.');
    const songs = [];
    for (const link of links) {
        const old = link.startsWith('irealbook:'), data = decodeURIComponent(link.slice(link.indexOf('://') + 3)).trim();
        if (old) {
            const f = data.split('=');
            for (let i = 0; i + 5 < f.length; i += 6)
                songs.push(make(f[i], f[i + 1], f[i + 2], f[i + 3], f[i + 5], ''));
        }
        else
            for (const entry of data.split('===')) {
                const f = entry.split('=');
                const ix = f.findIndex(x => x.startsWith('1r34LbKcu7'));
                if (ix < 0)
                    continue;
                let ki = ix - 1;
                while (ki > 1 && !/^[A-G][b#]?-?$/.test(f[ki]))
                    ki--;
                if (ki <= 1)
                    throw Error('곡의 원키를 읽지 못했습니다.');
                const key = f[ki], style = f[ki - 1], tail = f.slice(ix + 1);
                const song = make(f[0], f[1], style, key, decodeMusic(f[ix]), tail.length >= 2 ? tail[tail.length - 2] : '');
                const stored = f[ki + 1];
                if (stored !== '' && /^\d+$/.test(stored) && Number(stored) <= 11) {
                    const minor = key.endsWith('-'), target = KEYS[(Number(stored) + (minor ? 9 : 0)) % 12] + (minor ? '-' : '');
                    const delta = keyPC(target) - keyPC(key);
                    song.bars = song.bars.map(b => ({ ...b, chords: b.chords.map(c => transpose(c, delta, target)) }));
                    song.key = target;
                }
                songs.push(song);
            }
    }
    if (!songs.length)
        throw Error('읽을 수 있는 곡이 없습니다. iReal Pro 기본 공유 형식으로 다시 내보내주세요.');
    if (songs.length > 2000)
        throw Error('한 번에 최대 2000곡까지 가져올 수 있습니다.');
    return songs;
}
function make(title, composer, style, key, raw, bpm) { const p = parseChart(raw); if (!p.bars.length)
    throw Error(title + ': 코드 데이터를 읽지 못했습니다.'); return { id: crypto.randomUUID(), title, composer, style, key, bpm: Number(bpm) > 0 ? bpm : '', memo: '', bars: p.bars, source: raw, warnings: p.warnings }; }
