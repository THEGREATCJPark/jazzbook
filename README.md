# jazzbook

A minimal, chart-first jazz setlist PWA. Inspired by mytempo's monochrome UI.

Live: https://thegreatcjpark.github.io/jazzbook/

- Phone-first SVG chord charts modelled on iReal Pro: a squeezed humanist chord font, superscript ♭/♯, subscript quality, boxed sections, repeats, endings and slash bass.
- "한 화면에 맞춤" (default) lays the whole song out for the screen so it never scrolls; "화면 너비" keeps full size and scrolls. Minor can show as Cm7 or C−7.
- Transpose, stage view, dark/light themes.
- Performance setlists follow the supplied running order; uploaded iReal HTML is chart source only.
- No login. On first visit each person picks their name from the band list ("당신은 누구인가요?"); the choice is remembered on that device and can be changed from the menu.
- Personal notes and personal chart versions are kept per member in this browser's localStorage.
- Chord editor (✎): tap or drag across bars, type a whole run at once (`Am7 D7 | Gm7 C7`), use the chord keypad, or tap a reharmonisation idea (tritone sub, ii–V, I–VI–ii–V, iii–VI–ii–V, Tadd Dameron). Extra bars fill following empty bars; 마디 구조 edits sections, barlines, endings, time and text. Undo is kept for the session. Typing works in the key on screen.
- Saving offers "내 버전" (only this member, this device) or "공통 차트" (everyone). Shared notes, chart, key and event info are editable by every member after entering the shared password.
- Install from Safari → Share → Add to Home Screen, or the Android browser's install option.
- Cached charts work offline after the first successful visit. Shared edits need a network connection. Clearing browser data removes private notes.

## Development

No dependencies. Node 22+: `npm test`, `npm run build`. Serve `dist` with a static web server.

## Deployment

`.github/workflows/pages.yml` tests, builds and deploys main with GitHub Actions. Repository Settings → Pages → Source must be **GitHub Actions**. No build secrets are required.

## Shared data

`web/sets.json` is the bundled offline seed. The app refreshes public sets from `https://setnote-cj.cjpark.chatgpt.site/api/sets` on open, every 30 seconds and when back online; that existing backend is required for live common notes and shared editing.

The shared-edit password is checked by that server, never in this public code: the app sends it as `X-Setnote-Editor`, and the server accepts it when it equals the Worker's `EDITOR_KEY` secret. To use `0000`, set `EDITOR_KEY` to `0000` on the Setnote deployment. A `#edit=KEY` leader link still unlocks shared editing too. It is not hosted by GitHub Pages. `backend/sets-route.ts` documents the corresponding deployed endpoint. The API allows this Pages origin, requires a server-held editor key for writes, and rejects conflicting versions. Client-side personal notes do not reach the API.

Uploaded iReal Pro files supplied the charts. Gravity was not present and is intentionally left empty; it can be imported using the leader link. Unrecognized imported symbols are retained as import warnings; review charts before performing. iReal Pro is a reference, not an affiliation.

Chord font: Source Sans 3 (SIL Open Font License, `web/fonts/OFL.txt`), squeezed horizontally like iReal Pro and bundled so charts render identically offline.
