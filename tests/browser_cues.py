"""Exercise three independent mobile-sized browsers using isolated REST and WebSocket fixtures."""
import asyncio
import json
import pathlib
import shutil
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from playwright.async_api import async_playwright, expect
sets = [dict(id='public-event-' + str(i), data=x, version=1, editable=False) for i, x in enumerate(json.loads(pathlib.Path('web/sets.json').read_text()))]
del sets[0]['data']['songs'][6]['cues']
errors = []
rooms = {}
last = []

def millis():
    return time.time_ns() // 1000000

async def api(route):
    req = route.request
    if req.method == 'OPTIONS':
        return await route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'})
    data = req.post_data_json if req.method == 'POST' else {}
    status = 200
    if data.get('action') == 'login':
        result = {'token': 'fixture'}
    elif 'data' in data:
        assert req.headers.get('x-jazzbook-session') == 'fixture'
        row = next((r for r in sets if r['id'] == data['id']))
        if row['version'] != data['version']:
            status = 409
            result = {'error': '다시 시도'}
        else:
            row['data'] = data['data']
            row['version'] += 1
            result = {'version': row['version'], 'updated': '2026-11-20T00:00:00Z'}
    else:
        result = {'sets': [{**r, 'editable': req.headers.get('x-jazzbook-session') == 'fixture'} for r in sets]}
    await route.fulfill(status=status, json=result, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'})

def ws(s):

    def message(raw):
        d = json.loads(raw)

        def reply():
            s.send(json.dumps({**d, 'event': 'phx_reply', 'payload': {'status': 'ok', 'response': {}}}))
        if d['event'] == 'phx_join':
            rooms[s] = d['topic']
            reply()
        elif d['event'] == 'heartbeat':
            reply()
        elif d['event'] == 'broadcast':
            for target, room in rooms.copy().items():
                if target != s and room == d['topic']:
                    target.send(raw)
            last.append(d)
            reply()
    s.on_message(message)
    s.on_close(lambda *_: rooms.pop(s, None))

async def test():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory='web'))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])

        async def open_page(member):
            c = await browser.new_context(viewport={'width': 360, 'height': 740}, service_workers='block')
            await c.route('**/functions/v1/**', api)
            await c.route_web_socket('**/realtime/v1/websocket*', ws)
            page = await c.new_page()
            page.on('pageerror', lambda err: errors.append(str(err)))
            await page.goto(f'http://127.0.0.1:{server.server_port}')
            await page.locator('[data-member]').nth(member).click()
            return page
        a, b, c = await asyncio.gather(*(open_page(i) for i in range(3)))

        async def song(page, title):
            await page.locator('[data-act="drawer"]').first.click()
            await page.locator('[data-song="' + title + '"]').click()
        await asyncio.gather(song(a, 'sunny'), song(b, 'sunny'))
        await b.locator('footer [data-act="stage"]').click()
        box = await b.locator('[data-bar="0"]').bounding_box()
        await a.locator('footer [data-act="cues"]').click()
        send = a.get_by_role('button', name='태그 1회 · 리타르 엔딩')
        await expect(send).to_be_enabled()
        await send.click()
        await expect(b.locator('#live-cue')).to_have_text('태그 1회 · 리타르 엔딩', timeout=3000)
        assert box == await b.locator('[data-bar="0"]').bounding_box()
        await expect(c.locator('#live-cue')).to_be_hidden()
        await expect(send).to_contain_text('방금 보냄')
        await expect(b.locator('#live-cue')).to_be_hidden(timeout=8000)
        print('PASS same-song delivery, stage geometry, 6s expiry, sender acknowledgement, other-song isolation', flush=True)
        await a.get_by_role('button', name='큐 문구 편집').click()
        await a.locator('#pw').fill('fixture')
        await a.locator('[data-act="pw-ok"]').click()
        await a.locator('#cue-lines').fill('태그 1회 · 리타르 엔딩\n브레이크 → 헤드')
        await a.locator('[data-act="save-cues"]').click()
        await a.locator('[data-cue="브레이크 → 헤드"]').click()
        await expect(b.locator('#live-cue')).to_have_text('브레이크 → 헤드')
        await send.click()
        await expect(b.locator('#live-cue')).to_have_text('태그 1회 · 리타르 엔딩')
        stale = json.loads(json.dumps(last[-2]))
        stale['payload']['payload'].update(at=millis() - 8000, id=str(uuid.uuid4()))
        for socket, room in rooms.copy().items():
            if room == stale['topic']:
                socket.send(json.dumps(stale))
        await expect(b.locator('#live-cue')).to_have_text('태그 1회 · 리타르 엔딩')
        await b.context.set_offline(True)
        await expect(b.locator('#live-cue')).to_be_hidden()
        await a.locator('[data-cue="브레이크 → 헤드"]').click()
        await b.context.set_offline(False)
        await asyncio.sleep(0.4)
        await expect(b.locator('#live-cue')).to_be_hidden()
        await send.click()
        await expect(b.locator('#live-cue')).to_have_text('태그 1회 · 리타르 엔딩')
        await a.get_by_role('button', name='큐 문구 편집').click()
        await a.locator('#cue-lines').fill('')
        await a.locator('[data-act="save-cues"]').click()
        await expect(a.locator('.cue-send')).to_have_count(0)
        await a.reload()
        await song(a, 'sunny')
        await a.locator('footer [data-act="cues"]').click()
        await expect(a.locator('.cue-send')).to_have_count(0)
        assert not errors, errors
        print('PASS shared preset edit and persistence, replacement, offline/rejoin, stale-event rejection, explicit removal', flush=True)
        await browser.close()
    server.shutdown()
asyncio.run(test())
