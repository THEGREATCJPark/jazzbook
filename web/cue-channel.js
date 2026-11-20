// Supabase Realtime v1 JSON protocol. Broadcast only, with no history or resend queue.
import {API} from './api.js';
const endpoint = new URL('/realtime/v1/websocket', API);
endpoint.protocol = 'wss:';
endpoint.searchParams.set('apikey', 'sb_publishable_jsvplQtOczZtXUbrUZCc0Q_kxtQW5yX');
endpoint.searchParams.set('vsn', '1.0.0');

export const CUE_DURATION = 6000;
export function cueTopic(setId, songId) {
  return 'realtime:jazzbook-cue:' + [setId, songId].map(encodeURIComponent).join(':');
}

// Each instance owns exactly one socket for one song. Its owner handles foreground/room changes.
export function openCueChannel(topic, {onStatus, onCue}) {
  let socket, retryTimer, heartbeat, deadline, ping, joinRef, serial = 0, retries = 0;
  let stopped = false, ready = false;
  const pending = new Map();
  function write(room, event, payload) {
    const ref = String(++serial);
    socket.send(JSON.stringify({topic:room, event, payload, ref, join_ref:room === topic ? joinRef : null}));
    return ref;
  }
  function clean() {
    ready = false;
    clearTimeout(deadline);
    clearInterval(heartbeat);
    clearTimeout(retryTimer);
    ping = null;
    for (const reply of pending.values()) reply(false);
    pending.clear();
    if (socket) {
      socket.onclose = socket.onopen = socket.onmessage = socket.onerror = null;
      socket.close();
      socket = null;
    }
  }
  function reconnect() {
    if (stopped) return;
    clean();
    onStatus('retrying');
    retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 8000));
  }
  function connect() {
    if (stopped) return;
    onStatus('connecting');
    try { socket = new WebSocket(endpoint.href); } catch { reconnect(); return; }
    deadline = setTimeout(reconnect, 10000);
    socket.onopen = () => {
      joinRef = String(serial + 1);
      write(topic, 'phx_join', {config:{broadcast:{ack:true, self:false}, presence:{enabled:false}, postgres_changes:[], private:false}});
    };
    socket.onerror = socket.onclose = reconnect;
    socket.onmessage = ({data}) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (!msg) return;
      if (msg.topic === 'phoenix' && msg.event === 'phx_reply' && msg.ref === ping) {
        ping = null;
        return;
      }
      if (msg.topic !== topic) return;
      if (msg.event === 'phx_error' || msg.event === 'phx_close') return reconnect();
      if (msg.event === 'phx_reply') {
        const ok = msg.payload?.status === 'ok';
        if (msg.ref !== joinRef) return pending.get(msg.ref)?.(ok);
        if (!ok) return reconnect();
        if (ready) return;
        clearTimeout(deadline);
        ready = true;
        retries = 0;
        onStatus('ready');
        heartbeat = setInterval(() => {
          if (ping) return reconnect();
          ping = write('phoenix', 'heartbeat', {});
        }, 20000);
      } else if (ready && msg.event === 'broadcast' && msg.payload?.event === 'cue') {
        onCue(msg.payload.payload);
      }
    };
  }
  connect();
  return {
    send(cue) {
      if (!ready || socket?.readyState !== WebSocket.OPEN) return Promise.resolve(false);
      return new Promise(resolve => {
        let ref;
        try { ref = write(topic, 'broadcast', {type:'broadcast', event:'cue', payload:cue}); }
        catch { resolve(false); reconnect(); return; }
        const timeout = setTimeout(() => finish(false), 3000);
        function finish(ok) {
          clearTimeout(timeout);
          pending.delete(ref);
          resolve(ok);
        }
        pending.set(ref, finish);
      });
    },
    close() { stopped = true; clean(); }
  };
}
