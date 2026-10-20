# Poketour 작업 규칙

## GitHub 동기화

사용자의 최신 지시: 공유·실행은 GitHub Pages와 최상위 index.html 방식만 사용한다. 기존 GPT/Sites 호스팅·로그인·배포 도구를 이후 개발에 사용하지 않는다. 과거 호스팅 설정과 인수인계는 docs/archive에 보관된 기록이다.

사용자는 이 프로젝트를 GitHub에 연결하고 작업 결과를 계속 업로드하도록 요청했다.

- 의미 있는 작업 단위마다 관련 검증을 수행한 다음 커밋하고 연결된 GitHub 원격 브랜치로 푸시한다. 매번 푸시 허가를 다시 묻지 않는다.
- 작업을 마칠 때 커밋과 푸시 성공 여부를 확인한다. 실패하면 원인을 보고하고 로컬 작업을 보존한다.
- 강제 푸시, 원격 이력 삭제, 저장소 공개 전환은 수행하지 않는다.
- 후속 기능 작업 브랜치는 `codex/` 접두사를 사용한다. 사용자가 명시적으로 다른 브랜치를 요청하면 그 지시를 따른다.
- 비밀값, 로컬 DB, 의존성 폴더, 생성 서버 번들은 커밋하지 않는다.
- 개발 원본 저장소 `vvoosol/poketour`는 비공개로 유지한다. 공개 배포 전용 저장소 `vvoosol/poketour-play`에는 검증된 `dist/client` 실행 파일만 올린다.
- 웹 변경은 원본 커밋·푸시 후 `songpa-site/`에서 `npm run deploy:pages`로 배포 파일을 갱신하고 GitHub Pages 빌드와 실제 주소를 확인한다.

## 기존 구현 보존

- 실제 게임 프로젝트는 `songpa-site/`이다. `POKETOUR_DEVELOPMENT_PROMPTS.md`와 인수인계 문서를 읽고 해당 단계 범위에 맞게 진행한다.
- 1단계에서 원본 분리를 완료했다. HTML 진입점은 저장소 최상위 `index.html`이며, 나머지 화면 원본은 `songpa-site/src/client/`, `songpa-site/src/platform/`, `songpa-site/public/`에 있고 게임 엔진은 `songpa-site/src/shared/`에 있다. 원본을 수정하고 `songpa-site/`에서 `npm run build`로 `dist/`를 재생성한다.
- 기본 실행은 로그인 없는 브라우저 전용 모드다. IndexedDB에 기기별 저장하며 파일 백업·복원을 제공한다. 저장 호환성·개체 UID·중복 요청 방지·다중 탭 revision 충돌 처리를 유지한다. 정적 실행의 시간 정산은 기기 시각 기준이며 서버 권한·계정 동기화가 있다고 설명하지 않는다.
- 기존 게임 검증은 `songpa-site/`에서 `npm run build` 다음 `npm test`를 수행한다. Node의 `node:sqlite`를 지원하는 환경이 필요하다.
- 실제 브라우저·휴대폰에서 수행하지 않은 검증을 완료했다고 보고하지 않는다.
