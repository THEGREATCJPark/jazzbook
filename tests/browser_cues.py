"""Exercise three independent mobile-sized browsers over the live transport with isolated songs and a local REST fixture."""
import asyncio
import json
import pathlib
import shutil
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from playwright.async_api import async_playwright, expect
seed = json.loads(pathlib.Path('web/sets.json').read_text())
run_id = str(uuid.uuid4())
for event in seed:
    for item in event['songs']:
        item['id'] += '-' + run_id
sets = [dict(id=f'public-event-{i}', data=json.loads(json.dumps(event)), version=1, editable=False)
        for i, event in enumerate(seed)]
del sets[0]['data']['songs'][6]['cues']
errors = []

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

async def test():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory='web'))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        browsers = []

        async def open_page(member):
            browser = await p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
            browsers.append(browser)
            c = await browser.new_context(viewport={'width': 360, 'height': 740}, service_workers='block')
            await c.route('**/functions/v1/**', api)
            await c.route('**/sets.json', lambda route: route.fulfill(json=seed))
            page = await c.new_page()
            page.on('pageerror', lambda err: errors.append(str(err)))
            await page.goto(f'http://127.0.0.1:{server.server_port}')
            await page.locator('[data-member]').nth(member).click()
            return page
        a, b, c = await asyncio.gather(*(open_page(i) for i in range(3)))

        async def song(page, title):
            await page.locator('[data-act="drawer"]').first.click()
            await page.locator(f'[data-song="{title}-{run_id}"]').click()
        await asyncio.gather(song(a, 'sunny'), song(b, 'sunny'))
        async def wait_connected(page):
            await page.locator('footer [data-act="cues"]').click()
            try:
                await expect(page.locator('.cue-connection')).to_have_text('실시간 연결됨', timeout=15000)
            except AssertionError:
                print('Viewport status', await page.evaluate("({hidden:document.hidden, online:navigator.onLine})"), errors, flush=True)
                raise
            await page.locator('#sheet [data-act="close"]').click()
        await asyncio.gather(wait_connected(a), wait_connected(b), wait_connected(c))
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
        await a.evaluate("""async songId => {
          const {openCueChannel,cueTopic} = await import('./cue-channel.js');
          const topic = cueTopic('public-event-0', songId);
          const ready = Promise.withResolvers();
          const session = openCueChannel(topic, {onCue(){}, onStatus(s){if(s==='ready')ready.resolve()}});
          try {
            await ready.promise;
            if (!await session.send({id:crypto.randomUUID(),at:Date.now()-8000,text:'브레이크 → 헤드'})) throw Error('stale fixture send');
          } finally { session.close(); }
        }""", 'sunny-' + run_id)
        await expect(b.locator('#live-cue')).to_have_text('태그 1회 · 리타르 엔딩')
        await b.locator('.stage-exit').evaluate('(button) => button.click()')
        await b.context.set_offline(True)
        await expect(b.locator('#live-cue')).to_be_hidden()
        await a.locator('[data-cue="브레이크 → 헤드"]').click()
        await b.context.set_offline(False)
        await wait_connected(b)
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
        await asyncio.gather(*(browser.close() for browser in browsers))
    server.shutdown()
asyncio.run(test())
