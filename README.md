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
- The BPM pill next to the key opens the tempo: ±1/±5, tap tempo, and save as the member's own tempo or the shared one (password).
- Saving offers "내 버전" (only this member, this device) or "공통 차트" (everyone). Shared notes, chart, key and event info are editable by every member after entering the shared password.
- Install from Safari → Share → Add to Home Screen, or the Android browser's install option.
- Cached charts work offline after the first successful visit. Shared edits need a network connection. Clearing browser data removes private notes.

## Development

No dependencies. Node 22+: `npm test`, `npm run build`. Serve `dist` with a static web server.

## Deployment

`.github/workflows/pages.yml` tests, builds and deploys main with GitHub Actions. Repository Settings → Pages → Source must be **GitHub Actions**. No build secrets are required.

## Shared data and administration

GitHub Pages serves the frontend. Supabase Edge Functions and Postgres store shared data independently of ChatGPT, GPT, or Sites. No OpenAI runtime or API is used.

API: `https://qyckjkidscpiyrdzqxoc.supabase.co/functions/v1/jazzbook-api`

Menu → **관리자 페이지** (or `admin.html`) opens administration. The initial shared password is **0000**. Enter it to unlock, then enter the current password and the new password twice to change it. The password is bcrypt-hashed on the server; neither the hash nor a server key is returned to browsers. Changing it revokes all existing editing sessions. Sessions last at most 12 hours and are kept in sessionStorage, not passwords.

Public reads need no login. Shared writes validate an opaque session and reject conflicting record versions. Login attempts are limited to 10 per five minutes per IP bucket. Private notes, charts, selected member and tempos remain in this device's browser storage. The app refreshes on open, every 15 seconds and when it returns to the foreground, while avoiding replacement of an open edit draft.

The backend lives in a separate non-exposed `jazzbook` schema in the connected Supabase project. Browser database roles have no access; RLS intentionally has no allow policies. Existing tables in other schemas are untouched. Existing live performance IDs, data, versions and timestamps were migrated on 2026-10-29. No default-data reset happens on deployment.

### Backend maintenance

- Schema: `supabase/schema/jazzbook.sql` (initial bootstrap, run once).
- Edge Function: `supabase/functions/jazzbook-api/index.ts`; deploy as `jazzbook-api` with gateway JWT verification disabled because the handler validates its own sessions. It uses the built-in server-only `SUPABASE_DB_URL`.
- Frontend API URL: `web/api.js`. No secret belongs in this file or GitHub Pages.
- Deploying the frontend does not redeploy the function. Redeploy the Edge Function when its source changes.
- Password changes persist in the database and do not need a redeploy. To recover a forgotten password, an authorized database administrator can update `jazzbook.settings.password_hash`, increment `auth_version`, and delete `jazzbook.sessions` in one transaction.
- Legacy Setnote services are no longer called. Existing legacy services were left intact to avoid deleting data; they are not a dependency of this app.

Uploaded iReal Pro files supplied the charts. Gravity was not present and is intentionally left empty; it can be imported using the leader link. Unrecognized imported symbols are retained as import warnings; review charts before performing. iReal Pro is a reference, not an affiliation.

Chord font: Source Sans 3 (SIL Open Font License, `web/fonts/OFL.txt`), squeezed horizontally like iReal Pro and bundled so charts render identically offline.
