# Poketour

송파구 실제 지도 기반 도트풍 모험 게임. 기존 웹 구현을 이어서 독립 웹 배포, PWA, 향후 Android/iOS 앱으로 확장한다.

GitHub: [vvoosol/poketour](https://github.com/vvoosol/poketour) · 비공개 저장소.

## 프로젝트

- `index.html`: 프로젝트 최상위의 실제 게임 HTML 진입점.
- `songpa-site/`: 게임 소스, UI 자산, 데이터, Worker API, DB 스키마 및 검사 코드.
- `POKETOUR_DEVELOPMENT_PROMPTS.md`: 공통 작업 지침과 5단계 개발 프롬프트.
- `SONGPA_CODEX_HANDOFF.md`: 이전 구현과 과거 검증 기록.
- `컨셉 이미지1.png`: UI 시각 참고.
- `AGENTS.md`: 작업 및 GitHub 동기화 규칙.
- `docs/PROGRESS.md`: 작업과 검증 기록.

## 로컬 실행과 검사

Node.js 24 계열에서 프로젝트 폴더로 이동해 실행한다.

```sh
cd songpa-site
npm ci
npm run dev
```

`http://127.0.0.1:5173/`에서 실행한다. 개발용 계정은 자동 연결되며, 메뉴 → 체험 시작 → 지도 → 스타팅 선택 순서로 시작한다. 로컬 진행도는 `songpa-site/.local/game.sqlite`에 저장되어 재시작 후에도 유지된다. 서버를 종료하려면 Ctrl+C를 누른다.

```sh
npm run build
npm test
npm run preview
```

`dev`는 빌드 후 화면·API·로컬 DB 서버를 시작한다. `preview`는 기존 빌드로 동일한 로컬 서버를 시작한다. 소스를 수정한 뒤 `dev`를 재시작하면 반영되며 자동 재빌드/HMR은 제공하지 않는다. 개발용 계정은 루프백 전용 Node 어댑터에만 존재하며 `NODE_ENV=production`에서는 시작을 거절한다. 운영 인증 교체와 실제 배포는 후속 단계다.

HTML 원본은 최상위 `index.html`이다. 나머지 화면 원본은 `songpa-site/src/client/`, `src/platform/`, `public/`에 있다. 빌드하면 `songpa-site/dist/client/index.html`과 연결 자산이 생성된다. `dist/server`는 서버 코드·전용 데이터이며 모두 재생성된다. `.local/`, `dist/`, 의존성은 Git에 포함하지 않는다. [개발 구조와 실행 방법](docs/ARCHITECTURE.md)을 참고한다.

다른 사람에게 전달하는 웹 주소에는 호스팅 배포가 필요하다. `127.0.0.1`은 실행한 PC 전용 주소이며 GitHub의 파일 링크는 게임 실행 주소가 아니다. 이 게임은 HTML·정적 자산뿐 아니라 인증·API·DB 서버도 함께 연결해야 한다.

## 작업 방식

의미 있는 변경 → 관련 검증 → 커밋 → GitHub 푸시 순서로 진행한다. 후속 기능은 `codex/` 작업 브랜치에서 개발한다. 로컬 비밀값과 사용자 DB는 저장소에 포함하지 않는다.
