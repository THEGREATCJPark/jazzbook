# jazzbook

A minimal, chart-first jazz setlist PWA. Inspired by mytempo's monochrome UI.

Live: https://thegreatcjpark.github.io/jazzbook/

- Phone-first SVG chord charts in an iReal Pro–like style: condensed chord font, large roots, superscript ♭/♯, subscript quality, section boxes, repeats, endings and slash bass.
- Transpose, stage view, width/fit/large modes, dark/light themes.
- Performance setlists follow the supplied running order; uploaded iReal HTML is chart source only.
- Shared leader notes use the existing Setnote API; private notes remain in this browser's localStorage.
- No login. The leader capability URL is supplied separately and never committed.
- Install from Safari → Share → Add to Home Screen, or the Android browser's install option.
- Cached charts work offline after the first successful visit. Shared edits need a network connection. Clearing browser data removes private notes.

## Development

No dependencies. Node 22+: `npm test`, `npm run build`. Serve `dist` with a static web server.

## Deployment

`.github/workflows/pages.yml` tests, builds and deploys main with GitHub Actions. Repository Settings → Pages → Source must be **GitHub Actions**. No build secrets are required.

## Shared data

`web/sets.json` is the bundled offline seed. The app refreshes public sets from `https://setnote-cj.cjpark.chatgpt.site/api/sets`; that existing backend is required for live common notes and leader editing. It is not hosted by GitHub Pages. `backend/sets-route.ts` documents the corresponding deployed endpoint. The API allows this Pages origin, requires a server-held editor key for writes, and rejects conflicting versions. Client-side personal notes do not reach the API.

Uploaded iReal Pro files supplied the charts. Gravity was not present and is intentionally left empty; it can be imported using the leader link. Unrecognized imported symbols are retained as import warnings; review charts before performing. iReal Pro is a reference, not an affiliation.

Chord font: Pathway Gothic One (SIL Open Font License, `web/fonts/OFL.txt`), bundled so charts render identically offline.
