// Run against the deployed transport on an isolated, random song. No concert data is written.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cueTopic,openCueChannel} from '../web/cue-channel.js';

test('two independent sockets exchange a cue on Supabase Realtime', {timeout:20000}, async t => {
  const topic = cueTopic('smoke',crypto.randomUUID());
  const received = Promise.withResolvers();
  async function join(onCue) {
    const ready = Promise.withResolvers();
    const channel = openCueChannel(topic, {
      onStatus(status) { if (status === 'ready') ready.resolve(); },
      onCue
    });
    t.after(()=>channel.close());
    await ready.promise;
    return channel;
  }
  const [,sender] = await Promise.all([join(received.resolve),join(()=>{})]);
  const cue = {id:crypto.randomUUID(),at:Date.now(),text:'엔딩'};
  const [ack, message] = await Promise.all([sender.send(cue),received.promise]);
  assert(ack);
  assert.deepEqual(message,cue);
  t.diagnostic('Broadcast round trip ' + (Date.now()-cue.at) + ' ms');
});
