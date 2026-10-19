# Poketour

송파구 실제 지도 기반 도트풍 모험 게임. 기존 웹 구현을 이어서 독립 웹 배포, PWA, 향후 Android/iOS 앱으로 확장한다.

GitHub: [vvoosol/poketour](https://github.com/vvoosol/poketour) · 비공개 저장소.

## 프로젝트

- `songpa-site/`: 게임 소스, UI 자산, 데이터, Worker API, DB 스키마 및 검사 코드.
- `POKETOUR_DEVELOPMENT_PROMPTS.md`: 공통 작업 지침과 10단계 개발 프롬프트.
- `SONGPA_CODEX_HANDOFF.md`: 이전 구현과 과거 검증 기록.
- `컨셉 이미지1.png`: UI 시각 참고.
- `AGENTS.md`: 작업 및 GitHub 동기화 규칙.
- `docs/PROGRESS.md`: 작업과 검증 기록.

## 기존 빌드와 검사

Node.js 24 계열에서 프로젝트 폴더로 이동해 실행한다.

```sh
cd songpa-site
npm ci
npm run build
npm test
```

현재 `npm run dev`는 없으며 독립 실행용 인증·로컬 서버는 후속 단계에서 구성한다. `index.html` 화면과 별도로 인증·API·DB가 필요한 구조다. 기존 운영 계정과 진행도는 소스만으로 이전되지 않는다.

`songpa-site/dist/`에는 UI 원본도 포함되어 있으므로 전체 삭제하지 않는다. `dist/server/`와 의존성 등은 생성 결과로 제외한다.

## 작업 방식

의미 있는 변경 → 관련 검증 → 커밋 → GitHub 푸시 순서로 진행한다. 후속 기능은 `codex/` 작업 브랜치에서 개발한다. 로컬 비밀값과 사용자 DB는 저장소에 포함하지 않는다.
