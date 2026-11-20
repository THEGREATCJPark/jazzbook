import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCueLines} from '../web/cues.js';
import {cueTopic} from '../web/cue-channel.js';
import {validData} from '../supabase/functions/jazzbook-api/validation.js';

test('cue presets accept older songs and enforce the same public and editor limits', () => {
  const set = JSON.parse(readFileSync('web/sets.json'))[0];
  assert(validData(set));
  assert.deepEqual(readCueLines('  태그 1회 · 리타르 엔딩  \n\n헤드'), ['태그 1회 · 리타르 엔딩','헤드']);
  for (const lines of [[], ['🎼'.repeat(30)]]) {
    set.songs[0].cues = lines;
    assert.deepEqual(readCueLines(lines.join('\n')), lines);
    assert(validData(set));
  }
  for (const lines of [['가'.repeat(31)], ['반복','반복'], Array.from({length:13},(_,i)=>String(i)), ['A\tB']]) {
    set.songs[0].cues = lines;
    assert.throws(() => readCueLines(lines.join('\n')));
    assert(!validData(set));
  }
  assert.notEqual(cueTopic('a:b','c'),cueTopic('a','b:c'));
});
