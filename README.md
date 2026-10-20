# Poketour

송파구 실제 지도에서 이동·전투·포획·성장을 즐기는 웹 게임입니다. 최상위 `index.html`을 진입점으로 빌드하고 GitHub Pages로 공유합니다.

## 저장소와 실행

- 개발 원본: `vvoosol/poketour` — 비공개.
- 배포 실행 파일: `vvoosol/poketour-play` — 공개. 루트 `index.html`과 연결 자산만 배포합니다.
- 공유 주소는 [GitHub Pages 설정과 확인 결과](docs/SHARING.md)를 참고합니다.

**[Poketour 실행하기](https://vvoosol.github.io/poketour-play/)**

로그인이 필요하지 않습니다. 진행도는 사용 중인 브라우저의 IndexedDB에 저장됩니다. 다른 브라우저나 기기로 자동 동기화되지 않으므로 메뉴의 ‘저장 파일 내려받기’와 복원 기능을 사용하세요. 브라우저 데이터를 지우면 저장도 사라질 수 있습니다. 기존 호스팅의 계정 저장은 자동 이전되지 않습니다.

## 개발

Node.js 24 환경에서 실행합니다.

```sh
cd songpa-site
npm ci
npm run build
npm test
```

`dist/client/`는 서버 없이 실행 가능한 GitHub Pages 산출물입니다. 파일을 더블클릭하는 대신 HTTP/HTTPS 정적 호스팅으로 엽니다. `npm run dev`와 `npm run preview`는 회귀 검사용 선택적 로컬 SQLite 서버이며 Pages 실행에 필요하지 않습니다.

원본은 저장소 루트 `index.html`, `songpa-site/src/client`, `src/shared`, `src/platform`, `public`에 있습니다. 빌드된 파일을 직접 수정하지 않습니다.

## 배포

변경을 검증하고 개발 원본을 커밋·푸시한 다음 실행합니다.

```sh
cd songpa-site
npm run deploy:pages
```

이 명령은 GitHub CLI의 기존 로그인을 이용해 검증된 실행 파일만 공개 배포 저장소에 올립니다. GitHub Pages는 배포 저장소의 main 브랜치 루트에서 자동 갱신됩니다. 토큰을 코드에 넣지 않습니다. [실행 구조](docs/ARCHITECTURE.md)를 참고하세요.

기존 호스팅과 로그인 방식은 사용을 중단했습니다. 이전 문서와 설정은 `docs/archive/`에 역사 기록으로 보존했습니다.
