# 지도 자동전투·수동 턴제 연출: GitHub 조사와 Sol 구현 지시서

작성: 2026-10-21. 실행 갱신: 2026-10-22.

현재 상태: **1단계 공통 결과 재생기, 2단계 기본 자료(3종), 3단계 지도 실제 동작 연결까지 구현**. 2026-10-23 4단계 수동전투 무대·네 명령/하위 메뉴를 연결했다. 본가 전투 전용 뒷모습의 전체 종 확보는 아직 남아 있다. 최신 사용자 요청에 따라 자동 체력은 10배이며, 아래 조사 당시의 100배 유지 지시보다 우선한다. 전체 종의 전용 동작과 본가 전투용 뒷모습을 확보한 상태는 아니다. 자세한 결과는 `COMBAT_IMPLEMENTATION.md`를 따른다.

최초 요청에서 GitHub 조사와 적용 방향을 정리했다. 이후 사용자의 다음 단계 구현 요청에 따라 원본과 배포 파일을 갱신했다. 후속 구현에서 이 문서와 AGENTS.md, UI_LAYOUT.md, FIELD_COMBAT.md를 함께 읽는다. 이 작업을 기존 개발 로드맵의 PWA/앱화 완료로 간주하지 않는다.

## 1. 권장 방향

지도 자동전투는 Pokémon Auto Chess의 방향별 캐릭터 동작 구조, 수동전투는 PokéRogue의 명령창·기술창·체력창 구성을 참고한다. 기술별 이펙트는 Pokémon Showdown의 파일별 라이선스를 확인한 연출 코드를 선별적으로 적용할 후보로 삼는다.

Poketour의 지도·이동·출현·저장·전투 계산 엔진을 유지하고 **전투 결과를 순서대로 보여 주는 공통 재생기**를 추가한다. 같은 사건을 지도 장면과 수동전투 장면에서 서로 다르게 표현한다. 공격 애니메이션 완료 콜백이 HP나 보상을 다시 계산하지 않도록 한다.

권장 화면 기술은 기존 MapLibre HTML 마커 안의 스프라이트 시트 재생 + 투사체/타격용 투명 Canvas2D이다. 현재 야생 상한 12마리와 1대1 전투 범위에서는 Phaser 전체 도입보다 변경 범위가 작다는 설계 판단이다. 실제 기기 성능은 별도 측정해야 한다. 수동전투도 같은 재생기와 HTML 명령창을 재사용한다.

## 2. 조사한 GitHub 소스와 적용 판단

### Pokémon Auto Chess — 지도 자동전투의 동작 구조

- 저장소: https://github.com/keldaanCommunity/pokemonAutoChess
- 조사 기준 커밋: `73034b2fbc357f74469a7065af8f56d3a1f7790d`.
- [animation-manager.ts](https://github.com/keldaanCommunity/pokemonAutoChess/blob/73034b2fbc357f74469a7065af8f56d3a1f7790d/app/public/src/game/animation-manager.ts): 종별 동작 설정, 방향별 프레임, 프레임 지속 시간, Idle/Hurt/Walk/Attack 등의 등록과 반복 여부.
- [pokemon-sprite.ts](https://github.com/keldaanCommunity/pokemonAutoChess/blob/73034b2fbc357f74469a7065af8f56d3a1f7790d/app/public/src/game/components/pokemon-sprite.ts): 지연 로딩, 애니메이션 잠금·완료 후 대기 동작, 공격 표현.
- [README](https://github.com/keldaanCommunity/pokemonAutoChess/blob/master/README.md)는 MongoDB/Firebase 구성을 요구한다. 실제 소스는 Phaser와 Colyseus 등 게임 전체 구조에 결합되어 있다. GitHub Pages에 저장소 전체를 복사하는 방식은 현재 실행 조건과 맞지 않는다.
- [루트 LICENSE](https://github.com/keldaanCommunity/pokemonAutoChess/blob/master/LICENSE)와 README는 GPLv3인데 [package.json](https://github.com/keldaanCommunity/pokemonAutoChess/blob/master/package.json)은 BSD-3-Clause로 표시되어 있다. 이 불일치를 무시하고 BSD 코드로 간주하지 않는다. 우선 동작 구조를 참고하고 Poketour 어댑터를 작성한다.

### PokéRogue — 수동전투 UI와 순차 진행

- 저장소: https://github.com/pagefaultgames/pokerogue
- 조사 기준 커밋: `13f1139f0aef39fa75b8b57268832d6c1d9aa742`.
- [command-ui-handler.ts](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/src/ui/handlers/command-ui-handler.ts): 전투/볼/포켓몬/도주 명령과 기술 선택 화면 전환.
- [fight-ui-handler.ts](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/src/ui/handlers/fight-ui-handler.ts): 기술 목록, PP, 타입, 위력, 명중률 표시.
- [battle-info.ts](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/src/ui/battle-info/battle-info.ts): 이름·레벨·상태·체력 및 HP 감소 보간.
- [move-effect-phase.ts](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/src/phases/move-effect-phase.ts), [battle-anims.ts](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/src/data/battle-anims.ts): 기술 효과와 애니메이션 진행의 구분을 참고한다.
- Phaser 장면·전역 상태·단계 관리자에 결합되어 있으므로 UI 파일 하나만 복사해서 동작하는 구성은 아니다. 화면 구성과 입력 흐름을 참고해 기존 엔진에 맞게 구현한다.
- [README의 Licensing](https://github.com/pagefaultgames/pokerogue/blob/13f1139f0aef39fa75b8b57268832d6c1d9aa742/README.md#licensing)에 따라 소스는 기본 AGPL-3.0-only, 문서·에셋은 별도 조건/파일별 예외가 있다. 참고 구현과 원본 코드 복사를 구분하고, 직접 가져오는 파일은 조건과 출처를 기록한다.

### Pokémon Showdown — 기술 연출의 선별 재사용 후보

- 저장소: https://github.com/smogon/pokemon-showdown-client
- 조사 기준 커밋: `0de26d2ef7258e5619057f63b3774240b45cecbd`.
- [battle-animations.ts](https://github.com/smogon/pokemon-showdown-client/blob/0de26d2ef7258e5619057f63b3774240b45cecbd/play.pokemonshowdown.com/src/battle-animations.ts)는 전체 클라이언트 AGPLv3와 전투 리플레이/애니메이션 엔진 MIT를 구분한다.
- [battle-animations-moves.ts](https://github.com/smogon/pokemon-showdown-client/blob/0de26d2ef7258e5619057f63b3774240b45cecbd/play.pokemonshowdown.com/src/battle-animations-moves.ts)의 파일 표기는 CC0-1.0이다. 공격자 이동, 투사체, 피격 효과, 시간 지정이 들어 있다. 몸통박치기·불꽃세례·물대포·덩굴채찍·전기쇼크는 다른 연출을 참조하는 별칭도 있으므로 해당 이름 하나만 추출해서는 부족하다.
- 권장: 필요한 기술의 동작 정의와 의존 연출만 추출·변환하여 Poketour의 `moveId → animationId`에 연결한다. 수백 KB 파일 전체와 클라이언트 UI를 함께 들여오지 않는다.
- 원본의 jQuery/BattleScene/Dex/Config 등의 의존성을 제거하거나 작은 어댑터로 대체해야 한다. 특정 파일의 CC0/MIT 표기는 모든 이미지까지 일괄 허용한다는 뜻이 아니다. 같은 파일에 fx 이미지 예외가 명시되어 있고 Pokémon sprites는 그 허용 범위에서 제외되어 있다.
- [README](https://github.com/smogon/pokemon-showdown-client/blob/master/README.md)는 sprites/audio의 일부가 저장소에 포함되지 않는다고 설명한다. 저장소 복제만으로 모든 시각·음향 재료가 확보된다고 가정하지 않는다.

### PMDCollab / SpriteCollab — 지도용 동작 스프라이트 후보

- 저장소: https://github.com/PMDCollab/SpriteCollab
- 조사 기준 커밋: `0250bd6e62029bb896276a7f6bcb2385ed1a02f0`.
- [이상해씨 AnimData.xml](https://github.com/PMDCollab/SpriteCollab/blob/0250bd6e62029bb896276a7f6bcb2385ed1a02f0/sprite/0001/AnimData.xml): Walk/Attack/Hurt/Idle 등의 프레임 크기·시간과 RushFrame/HitFrame/ReturnFrame, CopyOf가 있다. 정지 PNG를 흔드는 것보다 사용자가 원하는 실제 동작을 구현하기에 적합한 자료 형식이다.
- [해당 디렉터리](https://github.com/PMDCollab/SpriteCollab/tree/master/sprite/0001)에는 동작·오프셋·그림자 시트가 따로 있다. XML과 함께 변환해야 발 위치/타격 위치가 어긋나지 않는다. 방향 행 순서와 시간 단위도 샘플로 확인한다.
- [README](https://github.com/PMDCollab/SpriteCollab/blob/master/README.md)는 제출된 창작물에 비상업·저작자 표시 정책을 안내한다. 하지만 [검사한 이상해씨 credits.txt](https://github.com/PMDCollab/SpriteCollab/blob/master/sprite/0001/credits.txt)는 CHUNSOFT/Unspecified로 표시되어 있다. 저장소 전체를 동일한 팬 제작 CC 라이선스로 간주하면 안 된다.
- 도입 전 종/폼/색상/동작별 보유 여부와 제작자·사용 조건을 조사해 manifest를 만든다. 미확보 종은 현재 이미지와 기본 움직임을 사용하되, 다프레임 지원 완료 종으로 표시하지 않는다. 코드 라이선스와 캐릭터·그림의 이용 조건은 별도로 기록한다.

## 3. 현재 Poketour에서 실제로 부족한 부분

확인한 파일: `songpa-site/src/client/game-ui.js`, `layout.css`, `src/shared/engine.mjs`.

1. `renderMapCombat()`은 공격선과 숫자를 생성한다. 동료와 야생은 같은 정면 이미지를 사용하며 공격/피격 프레임을 바꾸지 않는다. 선의 아군 시작점도 동료의 실제 화면 위치가 아닌 트레이너 좌표다.
2. 최근 로그를 읽어 0.25초 차이로 효과를 겹쳐 표시한다. 공격 준비 → 타격 → HP 감소 → 반격의 독립된 재생 순서가 없다.
3. 새 상태에서 전투가 종료되면 효과 레이어를 바로 비운다. 마지막 일격과 쓰러지는 동작이 생략될 수 있다. 지도 이동 후 이미 만든 효과 좌표도 재투영하는 구조가 필요하다.
4. `renderBattle()`은 양쪽 정면 이미지·HP 텍스트·여러 버튼을 다시 만든다. 본가 스타일의 앞/뒤 구도, 분리된 명령/기술/가방/교체 화면, 결과 재생 중 입력 잠금은 별도 작업이다.
5. 엔진 로그에 actor/target/move/damage는 있으나 모든 HP 변화의 전후 값·종료 시점 장면 정보가 담긴 연출용 사건 규격은 없다. 현재 엔진은 일부 효과를 지원하는 구현이며 UI를 바꿔도 본가의 모든 기술·특성이 완전히 구현되는 것은 아니다.

## 4. 사용자에게 보여 줄 완성 동작

### 지도 자동전투 ON

야생이 실제 지도 좌표에 대기한다. 플레이어가 100m 안으로 지나가거나 눌러 이동하면 현재 규칙에 따라 교전한다. 동료가 적을 향하고 공격 동작을 재생한다. 물리 공격은 짧은 돌진/타격, 원거리 기술은 발사 동작과 기술별 투사체를 사용한다. 맞은 쪽은 피격 동작, 피해 숫자와 HP 감소를 보여 준다. 다음 행동자가 반격하고, 마지막 타격 후 기절 동작과 보상을 표시한다.

행동 순서는 엔진의 우선도·스피드·행동 불가·기절 판정을 따른다. 항상 플레이어 선공이나 무조건 두 번의 공격을 만들지 않는다. 공격 실패에는 피해 연출을 넣지 않는다. 공격자는 트레이너가 아니라 실제 출전 중인 포켓몬이다.

교전 중 경로 일시 정지/종료 후 재개, 6초 행동 간격, 첫 사용 가능한 공격 기술, PP, HP 100배를 유지한다. 공격 애니메이션으로 움직이는 화면 위치와 실제 게임 좌표를 분리한다. 돌진 연출이 100m 판정·출현 구역을 바꾸면 안 된다. 주변 여러 마리가 동시에 들어오면 기존 한 대상 선택 규칙을 유지한다.

HP만 100배인 전투는 오래 걸리는 것이 정상이다. 예를 들어 기본 HP 50, 고정 피해 10, 상대 회복·반동·상태 피해 없이 6초마다 한 대면 HP 5000을 깎는 데 약 50분이다. 실제로는 PP 고갈·발버둥·교체 등이 개입한다. 이번 연출 개선에서 이를 임의로 공격력 배율이나 무한 PP로 바꾸지 않는다. 디버그 재생 속도는 게임 시간/계산과 구분한다.

### 자동전투 OFF / 수동전투

주변에 있다는 이유만으로 전투를 강제하지 않는다. 야생을 선택하고 이동/배틀을 선택해 사거리 안에 도착하면 수동전투 화면으로 들어간다. 기본 HP로 기술 네 개를 선택하며 명령을 내릴 때만 턴을 처리한다.

전투 무대는 상대 정면(우상단), 아군 뒷모습(좌하단), 각 HP/이름/레벨/상태 창, 전투 메시지, `싸운다 · 가방 · 포켓몬 · 도망` 명령창으로 나눈다. 가방에서 볼과 회복 도구를 선택한다. `싸운다`에서 2×2 기술 선택과 PP/타입/위력/명중을 표시한다. 긴 한국어 이름은 정해진 구역 안에서 줄바꿈하며 설명과 버튼이 서로 침범하지 않게 한다.

세로 360×800에서는 전투 무대 위/메시지·명령 아래, 가로 800×360에서는 전투 무대 왼쪽/명령 오른쪽의 두 고정 배치를 설계한다. 실제 사용 가능한 영역은 기존 상단·탭을 제외하고 산출한다. 같은 방향의 크기 변화에는 전체 배율만 적용한다. 수동용 뒷모습 자료를 확보해야 하며 정면 좌우 반전을 뒷모습으로 보고하지 않는다.

전투 중 자동/수동 전환은 현재 행동 묶음의 재생 종료 시점에 적용한다. 그때 HP 비율·PP·상태·UID·상대·일시 정지 경로를 보존하고 화면/배율을 전환한다. 요청이 대기 중임을 UI에 표시하고 중복 턴을 만들지 않는다.

## 5. 공통 결과 재생기 설계

권장 새 모듈(명칭은 구현 시 조정 가능):

- `src/client/combat-playback.js`: 사건 순서/중복 제거/입력 잠금/종료 처리.
- `src/client/pokemon-animator.js`: 종별 스프라이트 프레임, 방향, 발 위치, 대체 동작.
- `src/client/map-combat-view.js`: 지도 위 캐릭터·HP·효과 표시.
- `src/client/manual-battle-view.js`: 수동 무대와 명령·기술·가방·교체 화면.
- `src/client/move-effects.js`: 기술 ID별 효과와 공통 대체 연출.
- `public/combat/`: 필요한 로컬 이미지와 빌드 시 변환한 manifest. 외부 raw GitHub URL을 실행 중 호출하는 방식은 피한다.

연출용 사건에는 최소한 안정적인 `battleId/eventId/turnId/sequence`, 종류, actor/target UID, 기술 ID, 결과(명중/빗나감/무효), HP 변화 전후 값과 최대 HP/배율, 필요한 모습·좌표 스냅샷을 담는다. 회복·반동·상태 피해·교체·기절·포획·종료도 같은 순서에 넣는다. 한국어 로그 문자열을 다시 파싱해서 전투 사실을 추론하지 않는다.

게임의 확정 상태는 기존 IndexedDB 트랜잭션에 저장한다. UI는 별도 표시 HP를 사건의 before→after로 보간한다. 종료된 전투의 스프라이트는 마지막 사건 재생까지 잠깐 유지하고, 연출 종료 후 제거한다. 연출 완료 자체는 저장값을 변경하지 않는다.

새로고침/백업 복원/탭 복귀 시 과거 수십 분의 애니메이션을 전부 재생하지 않는다. 확정 상태로 맞추고 새 사건부터 재생한다. 보상·포획·공격 재적용이 없어야 한다. 중복 사건/다중 탭 revision 충돌 시도 같은 원칙을 적용한다. 초기화 시 기존 재생 큐와 표시 객체까지 폐기한다.

지도 마커의 바깥 transform은 MapLibre가 소유하고, 동작은 내부 자식에 적용한다. 투사체와 HP 위치는 지도 이동·크기 변경·방향 전환 동안 함께 재투영한다. 논리 픽셀과 바깥 전체 확대 배율을 이중 적용하지 않는다. 투명 효과 캔버스는 지도 터치·포켓몬 선택을 막지 않는다.

## 6. Sol에 전달할 5단계 구현 프롬프트

다음 각 단계는 실제 구현 요청을 받은 뒤 순서대로 수행한다. 외부 코드는 참고인지 재사용인지 구분하며, 재사용 파일의 고정 커밋·원래 경로·라이선스·수정 내역을 남긴다. 미확인 에셋을 허용된 것으로 간주하지 않는다.

### 1단계 — 전투 결과와 화면 재생 분리

> AGENTS.md와 이 문서를 읽고 기존 저장·전투 규칙을 보존하라. 엔진이 확정한 각 행동을 안정적인 ID, 실제 행동 순서, HP 전후 값, 공격자/대상 정보로 UI에 전달하라. 기본 공격 외에도 회복·반동·상태 피해·교체·기절·포획·종료를 표현하라. combat-playback을 구현해 중복 실행, 최종타 생략, 새로고침 과거 재생, 두 탭의 중복 보상을 막아라. 애니메이션 완료 콜백에서 전투 수치를 바꾸지 마라.

완료 기준: 실제 엔진 결과와 재생 결과가 일치하고, 선공 기절·빗나감·무효·회복·마지막 일격·초기화가 안정적인 사건 순서로 검증된다.

### 2단계 — 동작 에셋과 기술 효과 준비

> 지도용 Idle/Walk/Attack 또는 Shoot/Hurt/Faint, 수동용 앞/뒤 모습의 보유 현황을 종·폼별로 조사하고 출처/조건 manifest를 작성하라. 사용 조건이 확인된 자료를 로컬에 넣고 프레임·오프셋·HitFrame을 변환하라. 먼저 스타팅과 테스트 야생으로 실제 다프레임 공격/피격을 검증하고 지원 범위를 확장하라. 미확보 자료에는 명시적인 대체 동작을 적용하라. Showdown의 허용된 개별 기술 연출은 의존 동작까지 확인해 선택적으로 변환하고, 물리·불·물·풀·전기 등 공통 효과와 기술별 우선 매핑을 만들라. 모든 종/기술의 전용 애니메이션을 완료했다고 과장하지 마라.

완료 기준: 로컬 자료만으로 동작하며 프레임·크레딧 누락을 검출한다. 지원 종은 이미지 흔들기만이 아니라 실제 공격/피격 프레임이 보인다. 대체 동작 목록이 남는다.

### 3단계 — 지도 위 자동전투 완성

> 기존 renderMapCombat을 공통 재생기에 연결하라. 100m 교전 시 실제 출전 포켓몬이 적을 향해 공격하고, 타격 시점에 피격 모션/HP 감소/피해가 보이며 실제 엔진 순서로 반격하게 하라. HP 100배·첫 공격 기술·PP·6초 행동 간격·경로 일시 정지 규칙을 유지하라. 위치 기준점과 연출 오프셋을 분리하고 지도 이동/방향 전환 중에도 효과를 따라가게 하라. 마지막 타격과 기절 재생 후 전투 객체를 정리하라. HP와 지명·버튼이 겹치지 않도록 두 고정 배치에서 확인하라.

완료 기준: 지나가는 야생과 선택 후 접근한 야생 모두 지도에서 교전하며, 공격 주체가 동료로 보이고 실제 명중/HP/순서와 화면이 일치한다.

### 4단계 — 본가 구도의 수동 턴제 화면 완성

> 자동 OFF에서 사용자가 선택한 전투만 수동으로 시작하게 하라. PokéRogue의 화면 구성과 입력 흐름을 참고해 적 정면/아군 뒷모습, HP·상태 창, 메시지, 네 명령, 네 기술 창을 기존 엔진에 연결하라. 가방/볼/교체/도주 및 기술 선택 후 결과의 순차 재생을 구현하라. 결과를 재생하는 동안 다음 명령을 잠그되 실패·취소·자료 로딩 오류 뒤에는 정상적으로 풀어라. 기본 HP 및 현재 체력 비율을 보존하고 자동/수동 전환은 턴 재생 경계에서 적용하라. 두 고정 배치에서 긴 이름·기술 설명이 잘리지 않게 하라.

완료 기준: 명령 없이 턴이 흐르지 않고 각 명령이 한 번만 반영된다. 공통 엔진을 쓰며 수동 화면만 별도 전투 상태를 만들지 않는다.

### 5단계 — 저장·정적 배포·실제 화면 검증

> 전투 중 재접속, 기존 저장 migration, 백업/복원, 초기화, 두 탭 revision 충돌, 요청/사건 재전송, 모드 전환 체력 보존을 검사하라. songpa-site에서 npm run build 다음 npm test를 수행해 루트 index.html과 assets를 갱신하라. 실제 브라우저에서 세로/가로 공격·피격·기절·기술 선택·회전 중 좌표·글자 겹침을 확인하고, GitHub Pages 하위 경로 및 file:// 빌드의 새 모듈/에셋 경로도 확인하라. 실행하지 못한 검사는 미확인으로 기록하라. 자동 커밋/푸시/배포는 하지 마라.

완료 기준: 자동 검사 결과와 실제 시각 확인 결과를 나누어 보고하고, 사용자가 업로드할 index.html/assets가 최신 원본과 일치한다.

## 조사 범위와 한계

최초 조사는 GitHub README·라이선스·위에 명시한 소스 파일과 로컬 구현의 비교다. 외부 팬게임을 직접 실행하여 플레이하거나 성능 측정을 하지는 않았다. 에셋 전체의 종별 지원/출처 검수도 아직 하지 않았다. 이후 실제 구현·검증 범위는 `COMBAT_IMPLEMENTATION.md`에 구분해 기록한다.
