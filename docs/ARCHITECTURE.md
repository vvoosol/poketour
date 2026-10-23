# GitHub Pages 실행 구조

## 기본 실행

브라우저가 게임 엔진·출현·전투·포획·성장·경로 계산을 실행합니다. 네트워크 `/api` 서버 대신 `src/platform/browser-store.mjs`가 동일한 행동 계약을 IndexedDB에 연결합니다. ChatGPT나 별도 계정 로그인은 사용하지 않습니다.

- `saves`: 상태 JSON과 revision.
- `events`: 사건 ID별 보관 기록.
- `cache`: 실제 공원·수면 경계 캐시.
- 상태와 사건은 하나의 IndexedDB readwrite 트랜잭션으로 저장합니다.
- 저장 직전 revision을 비교해 다중 탭 충돌을 거절합니다.
- requestId로 최근 요청 재전송을 중복 적용하지 않습니다.
- 기존 공유 엔진의 version migration, 개체 UID, 동행, HP 배율과 보상 규칙을 유지합니다.

계정별 서버 저장에서 기기별 저장으로 전환한 것입니다. 다른 사람의 브라우저와 저장소를 공유하지 않으며 계정 간 자동 동기화는 없습니다. 기기 시각에 따른 정산이므로 서버 기반 부정행위 방지를 보장하지 않습니다.

## 파일과 빌드

| 경로 | 역할 |
| --- | --- |
| 저장소 루트 `index.html` | 실제 게임 HTML 원본 |
| `songpa-site/src/client` | 화면·지도·저장 파일 UI |
| `songpa-site/src/shared` | 순수 게임 엔진·지리·라우터 |
| `songpa-site/src/platform/browser.js` | 화면과 실행 환경 연결 |
| `songpa-site/src/platform/browser-store.mjs` | IndexedDB·행동·기록·백업·복원 |
| `songpa-site/public` | 정적 이미지·폰트·데이터 |
| `songpa-site/dist/client` | GitHub Pages 배포 산출물 |
| `songpa-site/scripts/publish-pages.mjs` | 검증된 산출물만 배포 저장소에 푸시 |
| `songpa-site/worker`, `scripts/local-*`, `dist/server` | 선택적 로컬 서버와 기존 엔진 회귀 검사 |
| `docs/archive` | 사용을 중단한 호스팅·게임 규칙 기록 |

빌드는 UI·공유 모듈·설정·캐시 데이터·라이선스를 배치하고 시설 seed와 보행 그래프를 생성합니다. 보행 그래프는 처음 경로를 계산할 때만 내려받아 캐시합니다. 모든 배포 경로는 상대 주소이므로 GitHub Pages의 `/poketour-play/` 하위에서도 동작합니다. `.nojekyll`은 정적 파일을 그대로 제공하도록 설정합니다.

## 백업과 복원

메뉴 → ‘이 브라우저의 저장’에서 JSON 파일을 내려받습니다. 다른 기기에서 같은 메뉴로 파일을 선택하고 ‘선택한 저장으로 복원’을 누릅니다. 복원은 현재 진행도를 바꾸므로 먼저 현재 저장을 내려받으세요. 잘못된 파일은 현재 저장을 지우지 않고 거절합니다. 기존 호스팅의 운영 DB는 브라우저에서 자동 읽거나 이전하지 않습니다.

## 배포 운영

개발 원본은 비공개 `vvoosol/poketour`, 공개 실행 파일은 `vvoosol/poketour-play`로 나눕니다. 공개 저장소에는 API 서버·로컬 DB·비밀값·개발 CSV·내부 문서·원본 Git 이력을 올리지 않습니다. 공개 웹 실행에 필요한 엔진·이미지·게임 데이터는 공개 파일에 포함됩니다.

최신 사용자 지시에 따라 에이전트는 로컬 개발·검증과 최상위 index.html 및 assets 갱신만 수행합니다. GitHub 업로드는 사용자가 직접 하며 자동 커밋·푸시·배포는 하지 않습니다. `publish-pages.mjs`는 이전 배포 경로의 도구로 보존하며 현재 작업에서는 실행하지 않습니다.

GitHub Pages는 정적 호스팅이므로 별도 API 런타임이나 D1 바인딩을 사용하지 않습니다. [GitHub Pages 공식 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 검사

`npm run build` → `npm test`를 실행합니다. 기존 게임·지리·경로·SQLite 서버·모의 DOM 검사를 유지하고 IndexedDB 재열기, 중복 스타팅/요청, 다중 탭 충돌, 도보 이동, 사건 기록, 백업·복원과 잘못된 파일 거절을 추가 검사합니다. IndexedDB 자동 검사는 fake-indexeddb이며 실제 브라우저 검증과 구분합니다.

## 남은 제약

지도 타일과 상세 공원·수면 경계 조회는 외부 네트워크가 필요합니다. 브라우저 저장을 사용할 수 없으면 오류를 안내하며 저장되었다고 표시하지 않습니다. 실제 휴대폰 GPS·터치와 네이티브 앱은 별도 검증 범위입니다.
