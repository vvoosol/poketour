# Poketour

GitHub Pages에서 실행하는 로그인 없는 브라우저 게임입니다. HTML 원본은 저장소 최상위 `../index.html`입니다.

```sh
npm ci
npm run build
npm test
```

생성된 `dist/client`를 GitHub Pages에 배포합니다. 검증된 원본을 커밋·푸시한 뒤 `npm run deploy:pages`로 실행 파일 저장소를 갱신합니다.

저장은 IndexedDB를 사용하며 메뉴에서 파일 백업·복원이 가능합니다. `npm run dev`는 회귀 검사용 선택적 Node/SQLite 개발 서버입니다. 자세한 구조와 공유 주소는 저장소의 docs/ARCHITECTURE.md와 docs/SHARING.md를 참고합니다.
