import {esc} from './chart.js';
import {CUE_DURATION, openCueChannel} from './cue-channel.js';

export function readCueLines(value) {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 12) throw Error('한 곡에 큐를 12개까지 저장할 수 있습니다.');
  if (lines.some(line => [...line].length > 30 || /[\x00-\x1f\x7f]/.test(line))) {
    throw Error('큐 문구를 한 줄에 30자 이내로 입력해주세요.');
  }
  if (new Set(lines).size !== lines.length) throw Error('같은 문구는 한 번만 입력해주세요.');
  return lines;
}

export function createLiveCues({getTopic, getPresets, refreshPresets, now, modal}) {
  let topic = '', channel, status = 'offline', active = null, lastTime = 0;
  let displayTimer, feedbackTimer, refreshAt = 0;
  const seen = new Set();
  const panel = () => document.querySelector('#sheet[open] .cue-panel');

  function paint() {
    const banner = document.querySelector('#live-cue');
    if (!banner) return;
    const text = active && active.until > now() ? active.text : '';
    if (banner.textContent !== text) banner.textContent = text;
    banner.hidden = !text;
  }
  function updatePanel() {
    const el = panel();
    if (!el) return;
    const labels = {ready:'실시간 연결됨', connecting:'연결 중…', retrying:'다시 연결 중…', offline:'오프라인'};
    el.querySelector('.cue-connection').textContent = labels[status];
    for (const button of el.querySelectorAll('[data-cue]')) button.disabled = status !== 'ready';
  }
  async function receive(event) {
    const room = topic;
    if (!event || !Number.isFinite(event.at) || typeof event.id !== 'string' || event.id.length > 64 ||
        typeof event.text !== 'string' || [...event.text].length > 30) return;
    const fresh = () => room && topic === room && getTopic() === room && !document.hidden &&
      !seen.has(event.id) && event.at >= lastTime && event.at <= now() + 1500 && event.at + CUE_DURATION > now();
    if (!fresh()) return;
    // A just-saved cue can arrive before the next shared-set refresh.
    if (!getPresets().includes(event.text) && Date.now() - refreshAt > 2000) {
      refreshAt = Date.now();
      await refreshPresets();
    }
    if (!fresh() || !getPresets().includes(event.text)) return;
    seen.add(event.id);
    if (seen.size > 64) seen.delete(seen.values().next().value);
    lastTime = event.at;
    active = {text:event.text, until:Math.min(now(), event.at) + CUE_DURATION};
    clearTimeout(displayTimer);
    displayTimer = setTimeout(() => { active = null; paint(); }, Math.max(0, active.until - now()));
    paint();
  }
  function sync() {
    const next = document.hidden || navigator.onLine === false ? '' : getTopic();
    if (topic !== next) {
      channel?.close();
      clearTimeout(displayTimer);
      clearTimeout(feedbackTimer);
      active = null;
      topic = next;
      channel = null;
      lastTime = refreshAt = 0;
      seen.clear();
      status = 'offline';
      if (topic) channel = openCueChannel(topic, {
        onStatus(value) { status = value; updatePanel(); },
        onCue:receive
      });
      updatePanel();
    }
    paint();
  }
  function open(title) {
    const presets = getPresets();
    modal('합주 큐', `<section class="cue-panel"><div class="cue-heading"><strong>${esc(title)}</strong><small class="cue-connection"></small></div>
      ${presets.map(text => `<button class="cue-send" data-cue="${esc(text)}" disabled><span>${esc(text)}</span><small></small></button>`).join('') ||
        '<p class="hint">이 곡에서 보낼 큐 문구를 먼저 추가하세요.</p>'}
      <p class="cue-feedback" role="status"></p><button class="menu-item" data-act="edit-cues">큐 문구 편집</button></section>`);
    updatePanel();
    const el = panel(), room = getTopic();
    for (const button of el.querySelectorAll('[data-cue]')) button.onclick = async () => {
      const text = button.dataset.cue;
      if (getTopic() !== room || !channel || status !== 'ready' || !getPresets().includes(text)) return;
      const cue = {id:crypto.randomUUID(), at:now(), text};
      el.dataset.latest = cue.id;
      clearTimeout(feedbackTimer);
      for (const info of el.querySelectorAll('.cue-send small')) info.textContent = '';
      button.querySelector('small').textContent = '보내는 중';
      const ok = await channel.send(cue);
      if (!el.isConnected || el.dataset.latest !== cue.id) return;
      button.querySelector('small').textContent = ok ? '방금 보냄' : '';
      el.querySelector('.cue-feedback').textContent = ok ? '' : '전송을 확인하지 못했습니다. 연결을 확인해주세요.';
      feedbackTimer = setTimeout(() => { button.querySelector('small').textContent = ''; }, CUE_DURATION);
    };
  }
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('offline', sync);
  window.addEventListener('online', sync);
  window.addEventListener('pageshow', sync);
  return {sync, open};
}
