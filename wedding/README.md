# 모바일 청첩장 (에스타시온 · 2027.04.24)

정적 파일 3개로 동작합니다. `index.html`, `SUIT-Variable.woff2`(SUIT, OFL), `SUIT-OFL.txt`.
`jazzbook` 앱 빌드(`web/`)와는 분리되어 있어 배포 대상에 포함되지 않습니다.

## 바꿀 곳
`index.html` 하단 `CONFIG`
- `photos` — 대표 사진(hero)과 사진 1–4의 URL 또는 파일명
- `venue.lat / lng` — 네이버 지도에서 확인한 실제 좌표로 교체 후 `verified: true`
  (교체 전에는 네이버 Geocoder로 주소를 좌표로 바꿔 씁니다. 지금 들어 있는 값은 임시 좌표입니다)
- `accounts` — 혼주·신랑·신부 계좌(현재 임의 샘플)
- `showPhotoTool` — 배포 전 `false`

## 네이버 지도
- Client ID만 사용: `maps.js?ncpKeyId=…&submodules=geocoder`
- NCP 콘솔 → Application → Web 서비스 URL에 배포 도메인을 등록해야 지도가 뜹니다.
  등록이 안 되어 있거나 스크립트가 막히면 지도 자리에 대체 화면이 나오고 길찾기는 그대로 동작합니다.
- 길찾기: Android `intent://route/public…;package=com.nhn.android.nmap;S.browser_fallback_url=<웹>`,
  iOS `nmap://route/public?dlat&dlng&dname&appname` → 1.6초 뒤 앱 전환이 없으면 웹,
  PC `https://map.naver.com/p/directions/-/<x>,<y>,에스타시온,,ADDRESS_POI/-/transit` (x,y는 EPSG:3857).

## 로컬 확인
`cd wedding && python3 -m http.server 8080` → http://localhost:8080
