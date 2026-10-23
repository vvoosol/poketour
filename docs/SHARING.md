# 현재 공유 주소

https://vvoosol.github.io/poketour/

2026-10-23 사용자가 저장소 전체 공개를 선택하여 vvoosol/poketour를 Public으로 전환하고 GitHub Pages(workflow)를 활성화했다. .github/workflows/pages.yml이 main의 최상위 index.html과 assets/만 사이트로 게시한다. 원본/문서는 공개 저장소에서 관리하지만 Pages 아티팩트에는 서버 번들·DB·의존성을 포함하지 않는다. 아래의 비공개 제한 및 poketour-play 기록은 전환 이전 기록이다.

# 최신 로컬 개발 방식

2026-10-23 최신 사용자 요청으로 vvoosol/poketour main에 소스와 index.html/assets 전체를 업로드했다. 이전 원격 업로드 이력도 병합해 보존했다. 빌드·전체 테스트 통과 및 GitHub 파일 존재 확인을 완료했다. 비공개 저장소 Pages 활성화는 현재 요금제 미지원(HTTP 422)으로 거절되었다. 저장소 비공개는 유지했으며 기존 공개 poketour-play에 최신 실행 파일을 배포할지 사용자 선택을 기다린다. 아래 공개 링크 검증 기록은 과거 배포에 대한 기록이다.

최상위 `index.html`과 `assets/` 전체를 같은 위치에 업로드한다. `songpa-site/`에서 `npm run build`를 실행하면 최신 실행 자산이 준비된다. 로컬에서는 index.html을 브라우저로 직접 연다. 파일 전용 번들이 JSON·모듈의 파일 접근 제한을 피하며 기존 게임 엔진과 IndexedDB 저장을 사용한다. HTTP 정적 실행 확인은 `로컬실행.cmd`로도 할 수 있다. 지도 타일에는 인터넷 연결이 필요하다.

# 공유 방식: GitHub Pages

공유 주소: **https://vvoosol.github.io/poketour-play/**

실행 파일 저장소는 `vvoosol/poketour-play`입니다. 저장소 루트의 `index.html`과 연결 자산을 GitHub Pages로 제공합니다. Pages 게시 원본은 main 브랜치의 `/`이며 HTTPS를 사용합니다.

로그인 없이 플레이하며 진행도는 각 브라우저의 IndexedDB에 저장됩니다. 브라우저나 기기를 바꿀 때는 메뉴에서 저장 파일을 내려받아 복원합니다. GitHub 소스 보기 URL이나 Raw 파일 URL은 게임 공유 주소가 아닙니다.

개발 원본 저장소 `vvoosol/poketour`는 계속 비공개입니다. 현재 요금제에서 비공개 저장소 Pages 활성화는 HTTP 422로 거절되어 실행 파일만 별도 공개 저장소에 배포합니다.

기존 GPT 호스팅은 사용을 중단했고 새 Pages 주소에서 실행을 확인한 후 기존 사이트의 공개 접근을 종료했습니다. 기존 서버 저장은 삭제하지 않고 소유자 전용으로 보존합니다. 과거 공유 기록은 Git 이력과 docs/archive에 보존하고 앞으로 공유 안내에 사용하지 않습니다.

## 확인 결과

- GitHub Pages가 반환한 실제 URL: `https://vvoosol.github.io/poketour-play/`.
- 외부 HTTPS에서 index.html HTTP 200, 실행 모듈·공유 엔진·데이터·라이선스 11개 HTTP 200 확인.
- 실제 브라우저에서 로그인 없이 첫 화면 → 머드나기 선택 → 재화 2,500원·가방 40개·동행 표시 확인.
- 새로고침 후 같은 재화·가방과 스타팅 선택 완료 상태가 유지되는 것을 확인.
- 전체 자동 검사와 IndexedDB 저장/백업/복원 검사를 통과했다. 실제 휴대폰 GPS·터치 검증은 별도다.
- 최종 실행 코드 원본 커밋: `daaf8bde9edf938b91259f1c32841db690688521`.
- 실행 파일 저장소 커밋: `6df5e41aabe93e8659a99350093d85ba2643f2b3`.
