# 1단계: 개발 구조와 로컬 실행

## 실행

Node.js 24 계열을 사용한다. 현재 검증 환경은 v24.16.0 / npm 11.13.0이다.

```powershell
cd C:/Users/User/Documents/ChatGPT/poketour/songpa-site
npm ci
npm run dev
```

주소는 `http://127.0.0.1:5173/`이다. 메뉴 → 체험 시작 → 지도 → 스타팅 선택 순서로 시작한다. GPS가 없어도 체험 위치에서 시작할 수 있다. 진행도는 `.local/game.sqlite`에 저장된다. 개발용 사용자 ID는 기본 `local-developer`다.

```powershell
$env:POKETOUR_PORT='5174'
$env:POKETOUR_DEV_USER='another-local-user'
npm run dev
```

환경 변수는 실행 셸에서 설정한다. `.env.example`은 설명용이며 `.env` 파일 자동 로딩은 제공하지 않는다. 다른 개발 사용자는 같은 DB 안에서도 별도 저장을 사용한다. 실제 운영 계정이나 기존 Sites의 운영 D1 저장은 자동 이전되지 않는다.

```powershell
npm run build
npm test
npm run preview
```

`build`는 dist만 지우고 원본에서 재생성한다. `test`는 먼저 빌드된 산출물을 필요로 한다. `preview`는 기존 산출물로 화면/API/SQLite 서버를 실행한다. 두 서버 명령 모두 로컬 개발 계정을 쓰며 운영 서버가 아니다. Ctrl+C로 종료한다. 소스 수정 후 서버를 재시작해 반영한다. 자동 파일 감시나 HMR은 구현하지 않았다.

## 파일 지도

| 경로 (`songpa-site/` 기준) | 역할 | 수정/생성 |
| --- | --- | --- |
| `../index.html` (저장소 최상위) | 웹 진입점, 기존 script 순서 유지 | 원본 |
| `src/client/*.js`, `*.css` | 화면, 지도, 설정, 기존 UI | 원본 |
| `src/shared/engine.mjs` | 상태 migration, RNG, 전투, 포획, 성장, 정산 | 원본 |
| `src/shared/world.mjs`, `routing.mjs` | 실제 경계와 도보 경로 | 원본 |
| `src/platform/browser.js` | API 주소, 로그인 링크, 위치, 복귀 인터페이스 | 원본 |
| `public/` | 캐시 데이터, 스프라이트, 폰트, 라이선스, MapLibre | 원본/보존 자산 |
| `worker/index.js` | 게임 API, D1 저장, 정적 ASSETS 바인딩 | 원본 |
| `scripts/build.mjs` | 깨끗한 빌드와 크기·SHA-256 보고서 | 원본 |
| `scripts/prepare-world.mjs`, `prepare-routing.mjs` | 시설 seed, 보행 그래프 생성 | 원본 |
| `scripts/compile-pokemon.py`, `prepare-map-data.py` | 선택적 데이터 갱신 도구, public로 출력 | 원본 |
| `scripts/local-server.mjs`, `local-db.mjs`, `static-assets.mjs` | 루프백 HTTP, SQLite/D1 어댑터, 정적 파일 | 로컬 개발 전용 |
| `tests/check-*.mjs` | 기존 게임/경로/Worker/UI + 로컬 통합 검사 | 원본 |
| `tests/legacy/` | 과거 v2 검사 기록, 현재 npm test 범위 밖 | 기록 |
| `db/`, `drizzle/` | 기존 DB 스키마와 migration | 원본 |
| `game-settings.json` | 게임 수치 편집 원본 | 원본 |
| `dist/client/` | 브라우저에 제공하는 파일 | 생성, Git 제외 |
| `dist/server/` | ESM Worker와 JSON 의존성 | 생성, Git 제외 |
| `dist/build-report.json` | 파일 크기, 개별 gzip, SHA-256 | 생성, Git 제외 |
| `.local/game.sqlite` | 로컬 계정 저장·사건·경계 캐시 | 런타임, Git 제외 |

이전 `dist/`의 UI와 정적 자산은 각각 원본 경로로 옮겼다. 기존 인수인계 문서의 dist 직접 수정 지침은 당시 구조를 설명한 과거 기록이다.

## 빌드와 서버 연결

1. `public`, `src/client`, `src/platform`과 저장소 최상위 `../index.html`을 `dist/client`로 복사한다. 기존 classic script 순서는 유지한다.
2. 공유 엔진에서 브라우저용 `engine.js`를 만들고, 시설 seed와 설정을 생성한다.
3. OSM 원본에서 보행 그래프를 `dist/server/data/foot-graph.json`으로 생성한다. 브라우저에는 제공하지 않는다.
4. Worker와 공유 엔진을 ESM 모듈로 복사하고 서버 데이터 JSON을 분리한다. 정적 자산 전체의 base64 삽입은 제거했다.
5. 로컬 HTTP 서버는 동일한 Worker의 `fetch`를 호출한다. `DB`는 SQLite 어댑터, `ASSETS`는 `dist/client` 전용 파일 어댑터다.

SQLite 어댑터는 기존 SQL migration을 순서대로 적용하고 별도 ledger에 파일 해시를 기록한다. 적용한 migration을 수정하면 시작을 거절한다. 배치 작업은 트랜잭션으로 묶으며 일부 SQL 실패 시 이전 변경도 롤백한다. 개발 서버 실행은 실제 운영 D1과 연결하지 않는다.

## 개발 인증과 플랫폼 인터페이스

개발 사용자 ID는 Node 로컬 서버가 고정 주입한다. 브라우저가 보낸 인증 사용자 헤더는 버리며, 서버는 `127.0.0.1`에만 바인딩한다. Host와 변경 요청 Origin을 확인한다. 개발/preview 실행은 `NODE_ENV=production`에서 실패한다. 이 개발 인증 코드는 빌드된 Worker에 포함되지 않는다.

Worker 자체는 기존 신뢰 게이트웨이의 `oai-authenticated-user-id`를 계속 사용하는 상태다. 독립 공개 서버에 바로 배포하기 전 2단계에서 검증된 세션/토큰 인증으로 교체해야 한다. 로컬 서버 구성 완료를 운영 인증 완료로 해석하지 않는다.

`window.PoketourPlatform`은 `apiFetch`, `assets.fetch`, `auth`, `location`, `lifecycle`을 제공한다. 지도와 UI는 이 인터페이스로 위치·API·복귀를 처리한다. 향후 앱에서는 공급자를 교체할 수 있다. API 주소는 `runtime-config.js`에서 설정하며 외부 주소는 HTTPS를 요구한다. 실제 네이티브 로그인·CORS·토큰 저장은 2/5단계에서 구현한다.

## 검증 범위와 남은 항목

기존 게임/기하 32개 + 도보 응답 2개, 106개 시설 경로, SQLite Worker, 모의 DOM의 세 스타팅 검사를 유지한다. 새 로컬 HTTP 검사는 스타팅·저장·재전송·서버 재시작 복구·계정 분리·롤백·Host/Origin/크기 제한·비공개 파일 차단·운영 개발 인증 거절을 확인한다.

실제 휴대폰 GPS·터치 검증은 미수행이다. 브라우저 탭에서는 지도와 체험 시작 저장까지 확인했으나, 후속 브라우저 접근은 보안 정책에 의해 차단되어 스타팅 선택/새로고침의 추가 UI 검증은 수행하지 못했다. 해당 흐름의 저장과 재시작 복구는 로컬 HTTP 통합 검사로 검증한다.

지도 타일은 OpenFreeMap, 공원·수면 경계 초기 조회는 Overpass를 사용하므로 외부 네트워크의 영향을 받는다. 로컬 도보 경로 계산은 포함된 그래프를 사용한다.

Python 데이터 갱신 도구는 경로를 새 구조로 조정했으며 이번 단계에서 외부 데이터를 다시 수집하지 않았다. `prepare-map-data.py`의 선택적 개발 의존성은 파일 머리말을 따른다.

## 공식 인터페이스 참고

측정 보고서는 빌드마다 `dist/build-report.json`에 생성된다. 이번 검증에서 브라우저 파일은 4,073,015 bytes, 서버 JS는 58,229 bytes, 서버 JSON은 8,025,777 bytes였다. JS와 JSON의 개별 gzip 합계는 2,358,553 bytes다. 보행 그래프를 포함한 서버 데이터 크기를 제외하고 서버 전체가 작아졌다고 해석하지 않는다. 실제 배포 도구의 번들 크기는 4단계에서 별도로 측정한다.

SQLite 구현은 Node 내장 `node:sqlite`를 사용한다. [Node 24 SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)

정적 파일을 Worker 코드와 분리한 구조는 향후 ASSETS 바인딩 연결을 위한 준비다. 실제 호스팅 설정과 검증은 4단계에서 수행한다. [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/binding/), [D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
