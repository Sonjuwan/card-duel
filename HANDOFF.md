## PERF-20261126 — v0.320.0 로컬 최적화 후보

- 기준 및 공개 안정본은 v0.319.0 `0283a83`이다. 별도 `perf/runtime-20261126` 브랜치에서 검색 정규화 반복, 업데이트 재다운로드, 판정 시간 렌더링 범위, 터치 드래그 중복 조회를 줄였다.
- 기준과 재현 명령은 [성능 기준](PERFORMANCE_BASELINE.md), 후보의 검증과 수치는 [성능 기록](PERFORMANCE_HISTORY.md), 재개 지점은 [작업 순서](DEVELOPMENT_QUEUE.md) 및 [상태](DEVELOPMENT_STATE.json)에 기록한다.
- 다음은 저장·Worker 지연과 장시간 메모리 측정이다. 게임 엔진·AI 학습·카드 데이터 및 기존 로드맵은 유지한다. 공개 배포는 이후 통합 검증을 마친 뒤 진행한다.

## v0.319.0 — D-4. 성기사 포즈 및 최종 초상화 확인

- 검증 기준은 v0.318.0 소스 `17119ac`, Pages `dc3008b`다. 공개 패키지와 실제 도적 전투 초상화를 확인했다.
- 인간 성기사의 외모와 황금 갑옷을 유지했다. 방패를 몸 옆에 세워 지키는 자세와 부드러운 후광을 적용한 새 400×400 래스터로 바꿨다. 얼굴과 가슴 갑옷이 드러나도록 성기사 크롭을 조정했다.
- 자산 규격 검사 7건과 모바일·태블릿·PC 전투 프레임 검사를 통과했다. [최종 9개 직업 전투 비교 이미지](docs/hero-portraits-v0.319.0.png)에 780×360에서 캡처한 아군·상대 프레임을 기록했다. 물리 휴대폰은 검증하지 않았다.
- 요청된 A, B-1~B-3, C, D-1~D-4 구현 범위를 마쳤다. 다음 개발 단계는 지정되지 않았다.

## v0.318.0 — D-3. 도적 포즈

- 검증 기준은 v0.317.0 소스 `492bee5`, Pages `403c591`다. 공개 패키지와 실제 주술사 전투 초상화를 확인했다.
- 블러드 엘프의 금발과 녹색 눈, 붉은 가죽 갑옷을 유지했다. 어깨와 몸통을 비틀어 정면으로 시선을 돌리고, 단검은 서로 다른 높이와 방향으로 배치한 새 400×400 래스터를 적용했다.
- 모바일 실제 전투 프레임에서 눈·얼굴·상체와 양쪽 단검의 위치를 확인했다. 자산 규격과 프레임 회귀를 검사했다.
- 다음 단계는 D-4 성기사 포즈 개선이다.

## v0.317.0 — D-2. 주술사 포즈

- 검증 기준은 v0.316.0 소스 `1cde582`, Pages `57aca1c`다. 실제 공개 전투에서 새 전사 자산과 크롭을 확인했다.
- 기존 청록색 오크 원로와 은빛 수염을 유지하고, 옆으로 시선을 돌려 토템과 정령을 교감하는 모습을 새 래스터로 제작했다. 바람과 번개는 얼굴 바깥에 배치했다.
- 400×400 WebP 자산 규격 검사 7건과 모바일·태블릿·PC 렌더링을 통과했다. 모바일 전투 프레임에서 눈, 얼굴, 토템과 상체를 확인했다.
- 다음 단계는 D-3 도적 포즈 개선이다.

## v0.316.0 — D-1. 전사 포즈

- 검증 기준은 v0.315.0 소스 `94229fe`, Pages `73b6817`다. 공개 패키지와 실제 전사·마법사의 전투 크롭을 확인했다.
- 기존 오크 전사의 외모와 붉은 갑옷을 참고해, 정면을 향한 낮은 시점의 새 래스터를 제작했다. 도끼는 얼굴 바깥의 몸 옆에 두었다. 새 원본에 맞춰 전사 크롭만 조정했다.
- Chromium의 모바일·태블릿·PC에서 프레임을 확인하고 780×360 실제 전투 캡처에서 얼굴, 갑옷과 무기가 구분되는지 확인했다.
- 다음 단계는 D-2 주술사 포즈 개선이다.

## v0.315.0 — C. 영웅 전투 크롭

- 검증 기준은 v0.314.0 소스 `cf8a91c`, Pages `47c1ac1`다. 공개 패키지와 자유 대전에 난이도 19 적용을 확인했다.
- 원본 영웅 래스터와 프레임 크기는 유지했다. 얼굴과 상체 위치를 기준으로 9개 직업에 각각 초점과 111~135% 확대를 지정했다. 아군·상대 모두 같은 직업별 설정을 사용한다.
- Chromium의 모바일 가로·태블릿·PC 5개 해상도에서 기존 프레임 경계와 배치를 확인했다. 780×360 실제 전투 프레임의 아군·상대 18개 캡처를 [영웅 초상화 비교 이미지](docs/hero-portraits-v0.315.0.png)에 기록했다.
- 다음 단계는 D-1 전사 포즈 개선이다.

## v0.314.0 — B-3. 개발자 자유 대전 난이도 및 재대전

- 검증 기준은 v0.313.0 소스 `0a740d1`, Pages `9ff599d`다. 공개 패키지 무결성과 모바일 양측 전략 덱 대전 시작을 확인했다.
- 자유 대전의 AI 난이도 1~25를 양측 직업·덱과 독립 설정한다. AI 가중치와 난이도 정책은 기존 것을 사용한다. 마지막으로 실제 시작한 설정은 슬롯별 개발자 저장소에 기록된다.
- 결과 화면의 같은 설정 재대전은 실제 양측 덱, 상대 직업과 난이도를 유지하면서 새 경기 코드를 생성한다. 일반 AI 설정과 랭크 성장에는 영향을 주지 않는다.
- 모바일 Chromium에서 난이도↔덱 변경 독립성, 실제 전투 난이도, 재대전의 덱 일치, 재시작 후 설정 복원과 성장 데이터 보존을 확인했다.
- 다음 단계는 C. 기존 영웅 아홉 종의 개별 전투 크롭과 비교 이미지 검증이다.

## v0.313.0 — B-2. 개발자 자유 대전 양측 덱 선택

- 검증 기준은 v0.312.0 소스 `dd21cfc`, Pages `f874e7c`다. 실제 공개 v0.311→v0.312 PWA 전환을 두 탭에서 닫거나 재설치하지 않고 적용했으며 기존 일반 저장 경기를 복원했다.
- 각 진영에서 자기 직업의 시험 덱, 추천 덱, 전략 덱, 현재 편집 덱을 선택할 수 있다. AI는 무작위 덱도 선택 가능하다. 편집에는 기존 개발자 덱메이커를 사용하며 복귀 시 선택 상태가 유지된다.
- 전투 워커가 AI 덱의 직업과 편입 규칙을 검증한다. 선택한 AI 덱은 경기 저장 및 재대전에도 사용한다. 일반 모드에서는 이 경로에 접근할 수 없다.
- 전투 워커 검사 37건과 모바일 Chromium에서 서로 다른 도적 시험 덱, 덱메이커 왕복, 전략·무작위 덱 및 실제 경기 입력 일치를 확인했다.
- 다음 단계는 B-3 AI 난이도 독립 설정과 마지막 자유 대전 설정 보존이다.

## v0.312.0 — B-1. 개발자 자유 대전 직업 선택

- 검증 기준은 v0.311.0 소스 `751a227`, Pages `8cd2e34`다. 공개 설정 파일·패키지 해시·780×360 대전 시작을 확인했다. v0.310→v0.311의 기존 설치 전환과 이어하기는 배포본을 사용한 로컬 Chromium에서 통과했으며 공개 주소의 첫 재열기에서는 전환을 확인하지 못했다.
- 개발자 모드에서 양측 9개 직업과 상대 무작위를 선택할 수 있다. 같은 직업끼리 대전할 수 있으며, 선택한 직업의 초상화와 기본 덱이 실제 경기에서 적용된다.
- 개발자 자유 대전용 IndexedDB를 슬롯별로 분리했다. 자유 대전에서 저장·이어하기를 사용할 수 있으며 일반 성장·랭크·전적에는 기록하지 않는다. 기존 개발자 랭크 시험은 별도로 유지한다.
- 모바일 Chromium에서 도적 미러전, 주술사와 무작위 상대, 자유 대전 저장 복원 및 성장 데이터 보존을 확인했다.
- 다음 단계는 B-2 양측 덱 자유 선택이다.

## v0.311.0 — A. 메인 메뉴 게임 업데이트

- 검증 기준은 v0.310.0 소스 `d8dc333`, Pages `365c749`, PWA 릴리스 `84463a47d8c8`이다. 기존 설치 경로와 manifest ID·scope를 유지했다.
- 공개 `version.json`은 설치 캐시 밖에서 조회한다. 메인 메뉴는 현재 빌드와 공개 버전, 파일별 진행률과 적용 준비를 표시한다. 대기 워커는 같은 앱의 모든 창이 안전 상태를 응답한 뒤에만 활성화된다. HTML에 포함된 자산 무결성 서명도 전환 도중 릴리스가 섞이는 것을 막는다. 적용 과정에서 저장소를 초기화하지 않는다.
- v0.310.0의 실행 코드에는 안전 응답 기능이 없다. 이 구버전에서 올라올 때에만 경기를 저장하고 열린 게임 창을 닫은 뒤 다시 열어야 한다. 재설치는 필요 없다. v0.311.0부터는 검증 후 메인 메뉴에서 적용할 수 있다.
- 브라우저 검증은 이전 배포 패키지의 전환, 업데이트 파일 진행률, 오프라인 재실행, 통신 중단, 무결성 실패, 다른 창의 활성 경기 차단, 성장·덱·저장 경기 보존과 복원을 포함한다. 실물 휴대폰은 검증하지 않았다.
- 다음 단계는 B-1 개발자 모드의 양측 직업 자유 선택이다.

## v0.310.0 — 4단계 개발자 카드 도감과 덱메이커

- 검증 기준은 v0.309.0 소스 `1c054ba`, Pages `4a80e93`다. 회귀 테스트와 공개 PWA의 파일 무결성 및 780×360 대전 시작을 확인했다.
- 개발자 메뉴에서 카드 도감과 시험 덱 편집을 열 수 있다. 도감은 덱 구성 카드 382종, 비수집 카드 61종을 각각 표시한다. 비수집 61종에는 활성 JSON의 55종과 런타임의 동전 및 영웅 능력 토큰 5종이 포함된다.
- Chromium에서 직업별 결과 수, 페이지 이동, 생성 카드 필터, 치유 토템·동전 이름 및 효과 검색, 상세 및 종족, 개발자 덱 보존과 유저 모드 복귀를 확인했다.
- 다음 개발 단계는 요청에 명시되지 않았다.

## v0.309.0 — 3단계 개발자 카드 해금

- 검증 기준은 v0.308.0 소스 `2e5a394`, Pages `e2bd824`다. 공개 PWA의 파일 무결성과 780×360 대전 시작을 확인했다.
- 개발자 시험 덱은 활성 수집 카드 382종을 사용한다. 활성 카드 JSON 437종 중 비수집 카드 55종은 편입할 수 없다. 직업, 30장, 편입 제한은 기존 엔진 검사를 사용한다.
- 시험 덱은 별도 라이브러리에 저장된다. 같은 브라우저에서 일반 덱과 성장 기록을 비교해 개발자 시험 대전 및 모드 종료 후에도 보존됨을 확인했다.
- 다음 단계는 개발자 카드 도감 접근과 비수집 카드 열람이다.

## v0.308.0 — 2단계 덱 선택 화면

- 검증 기준은 v0.307.0 소스 `857c601`, Pages `380a7ca`다. CI와 공개 PWA의 780×360 대전 시작을 확인했다.
- 기존 3×3 배치에서 저장 덱, 빈 슬롯, 선택 덱 및 페이지 버튼의 대비를 높였다. 모바일 가로와 1366×768에서 9슬롯 배치, 페이지 전환, 저장 슬롯 격리 및 대전 시작을 확인했다.
- 다음 단계는 개발자 모드의 임시 전체 수집 카드 해금과 일반 진행 저장 분리 검증이다.

## v0.307.0 — 1단계 영웅 프레임

- 검증 기준: v0.306.0 소스 `924d94c`, Pages `12de6ef`. 전투 영웅 이미지에 프레임 내부 좌표와 동일한 곡률을 적용했다.
- 다음 단계: 기존 3×3 덱 선택 슬롯의 가독성 개선.

## 2026-11-25 — v0.306.0 공통 대상 선택과 후속 UI

- v0.305.0 `718ca35`에서 이어 작업했다. 효과 선택 창이 비활성 전장에 포함되면서 터치와 클릭이 모두 막혔다. 대화창과 전장의 비활성 범위를 분리하고 선택한 주문용 화살표를 연결했다.
- 대상 지정 중에는 직접 누른 하수인과 영웅이 근접 보정보다 우선한다. 손패는 카드 예약 후 펼침 상태를 유지하며 전투의 함성·선택 주문을 조준할 때만 잠시 감춘다.
- 하수인 크기를 해상도별로 고정했고 전투 기록 아이콘과 초상화에 별도 칸을 할당했다. 덱 선택은 9슬롯, 덱 편집은 8카드 페이지를 사용한다.
- 영웅 9종의 독창적인 래스터 초상화를 기존 자산 경로에 적용했다. 하수인 고유 음성은 소환에 집중하고, 돌진과 충돌에 서로 다른 시작 시점을 사용한다.
- 변경된 공통 입력 경로는 활성 데이터에서 추출해 검사한다. 카드 목록은 [메커니즘 검사 자료](docs/CARD-MECHANISM-AUDIT.md)에 기록했다.

## 2026-11-25 — v0.305.0 전투 UI와 전투의 함성

- 최신 개발본 `1f22dfd`에서 시작했다. 기존 v0.304 가로 전체화면, 크기 보정과 명령 대기열을 이어받았다. 카드 밸런스, 저장 스키마, AI 학습 자료·난이도는 그대로 사용한다.
- 전장 능력치의 불투명 원형 배지, 하수인 능력과 예약 공격 자세, 마나와 덱의 분리, 행동 기록의 아이콘과 스크롤을 적용했다. 손패 펼침 버튼과 카드 자체의 동작을 분리했다. 공개 행동 기록은 같은 탭에서 대전을 저장하고 이어 할 때도 복원한다.
- 손패·전장 카드의 상세 확인은 터치 300ms 홀드 또는 마우스 호버로 연결했다. 개별 카드의 클릭 확대, 별도 클릭 사용 버튼, 중복 상세 패널을 제거했다. 키보드에서 전장 대상 탐색과 기본 카드 사용을 지원한다.
- 대상 지정 하수인은 소환 위치를 먼저 고정하고, 해당 위치의 임시 초상화에서 드래그해 효과 대상을 지정한다. 대상 확정 이후에만 카드와 마나를 예약하고 최신 판정에서 재검증한다.
- 직접 타격 기본 시점은 준비 700ms, 돌진 120ms, 충돌 180ms, 복귀 300ms다. 이미 예약되어 자세를 잡은 시간은 준비 구간에서 제외한다. 사망·비밀이 포함된 행동은 후속 연출 시간을 확보한다.
- 공개 연출 이벤트에 드로우, 탈진, 죽음의 메아리를 추가했다. 드로우 연출은 카드 뒷면만 사용한다.
- 배포 대상은 이전과 같은 GitHub Pages `/ui-preview/` 경로다.

## 2026-11-25 — v0.304.0 전투 입력과 대상 지정

- 최신 개발 커밋 `ed52433`에서 시작했다. 판정 상태와 시각 재생 프레임을 분리하고, 공개 정보로 예약 마나·손패·공격 횟수·일부 확정 소환 공간을 계산한다. 실행 직전 최신 판정 상태에서 다시 검사한다.
- 직전 연출의 충돌 프레임이 갱신되어도 유효한 드래그를 유지한다. 하수인은 양쪽 전장에 놓을 수 있고, 소환 위치는 아군 행에서 결정된다. 대상 주문은 영웅 위 시전 표식과 화살표로 전환된다.
- 하수인과 영웅 능력치 배지 대비를 높였으며, 양쪽 전장을 리사이즈해도 독립 행동 기록 스크롤이 배치 너비를 차지하지 않는다.
- 소환 직후 Chromium에서 터치의 합성 클릭이 생략되는 경우를 확인했다. 접이식 손패는 유효한 터치 해제에서 즉시 토글하며 마우스와 키보드는 기존 클릭 경로를 사용한다.
- 직접 공격의 투사체를 제거했다. v0.303 재생 시간과 순차 재생을 유지한다. 데이터·가중치 원본과 저장 스키마는 보존하며 토템의 기존 효과 설명을 보강했다.

## 2026-11-25 — v0.303.0 모바일 전장과 전투 재생

- 최신 로컬 및 원격 `d9343d9`에서 시작했다. 카드·성장·학습 데이터, 저장 스키마 및 엔진 규칙에는 변경을 가하지 않았다.
- 메인 메뉴 및 세로 안내에 가로 전체화면 진입 동작을 연결했다. 브라우저가 방향 잠금을 지원하지 않으면 수동 회전을 안내한다.
- 소형 터치 화면에서는 전장을 전체 너비로 펼치고 자원과 턴 종료를 독립 배치한다. 손패는 접이식 오버레이이며, 손패 토글 시 전장 좌표가 유지된다. 공통 하수인 표시는 초상화와 검·핏방울 배지, 상태 아이콘을 사용한다.
- 기존 전투 재생 시간의 두 배를 기준으로 각 행동의 움직임과 충돌 시점을 확장했다. 기존 명령 대기열과 최신 상태 재검증을 재사용하고, 사망과 후속 소환 파티클을 충돌 뒤에 분리한다.
- 배포 대상은 기존 GitHub Pages `/ui-preview/`이다. 브라우저의 터치 및 크기 에뮬레이션과 실제 단말의 방향 잠금은 별도로 구분한다.

## 2026-11-25 — v0.302.0 전투 조작·직업 일러스트 통합 미리보기

- `ui/integrated-main`의 `b9d4084`를 포함하는 `ui/followup-20261125`의 `584c694`에서 이어서 작업했다. 저장 네임스페이스, 카드 ID, 엔진 보상 및 AI 데이터는 기존 구조를 사용한다.
- 전투에서는 카드 앞면이 중간 위치에 표시되고 하수인 초상화가 실제 배치 위치로 이동한다. 영웅 능력은 지정 대상 또는 실제 결과 위치에 연출한다. 무대상 영웅 능력은 아군 필드에 놓을 때만 드래그로 확정한다.
- 카드 도감과 덱 메이커의 직업 책갈피, 직업 선택용 사각형 초상화와 테마 색상, 전투 상태 아이콘, 오디오 설정을 정리했다. 전투 중 홈 이동은 설정의 저장 후 나가기 동작을 사용한다.
- 영웅 9종과 기본 토템 4종을 새로 그리고, 공유되던 카드·토큰 일러스트를 분리했다. 런타임 카드·토큰 443장의 이미지 경로와 SHA-256 중복을 검사한다.
- 배경음악 코드를 제거했다. 지난 배포본의 음원이 포함된 패키지와 새 무음 패키지 사이의 오프라인 업데이트와 롤백을 검증할 수 있다.

## 2026-11-24 — v0.301.0 카드 탐색·전투 연출·성장 화면
- 원격 `ui/integrated-main`의 `7d7f164`에서 이어서 개발. 별도 스크롤 목록으로 덱 선택·보유 목록을 분리하고, 도감에는 상시 필터와 책 가장자리 페이지 조작을 적용했다.
- 멀리건 교체와 영웅 파괴는 서버 또는 기기 AI가 확정한 화면 값에서 연출을 구성한다. 보상의 길과 5등급 문장은 기존 성장 모델을 읽는다.
- FluidSynth와 TimGM6mb로 제작한 일반 OST 11곡과 결과 음악 2곡. 곡 정보 및 원본 렌더 스크립트는 `apps/client/src/assets/music/README.md` 참고. 설치형 빌드는 음원을 개별 MP3로 분리하고 기존 서비스 워커의 무결성 캐시에 포함한다.

## 2026-11-24 — v0.300.0 통합 UI·오디오
- 원격 main의 6411041(v0.91.0)에서 시작해 이를 조상으로 포함하는 최신 UI 커밋 4b7710a까지 fast-forward했다. 공개 Pages 미리보기의 이전 패키지는 v0.297.0이다.
- 전체 카드 프레임, 멀리건과 전장 경계에 맞춘 손패 확대, 능력치 색상, 도감과 덱 편집의 8장 책 펼침, 저장 경기 화면, 알림과 설정을 갱신했다.
- 직업 초상화 9장을 새로 제작했다. 오리지널 합성 악기 녹음 11곡을 오프라인 빌드에도 포함했고, 대전 셔플과 곡 전환, 대사 더킹, 음량 설정을 연결했다.
- 엔진, 카드 카탈로그, AI, 저장 슬롯·키·스키마 변경 없음. 설치 패키지의 캐시 버전은 빌드 산출물 해시로 갱신된다.
- 릴리스 검증: `npm run verify:release-baseline`, `npm run typecheck`, `npm test`, `npm run test:render`, `npm run build:solo-app`. 이전 Pages 산출물에 대해 `CARD_DUEL_PREVIOUS_RELEASE_DIR=<이전 ui-preview 폴더> node --test apps/client/test/solo-app.test.mjs`. 실제 배포 경로와 같은 슬롯 기반 브라우저 시험은 `node --test apps/client/test/integrated-ui-browser.test.mjs`.

## 2026-11-23 — v0.285.0 isolated card-inspector dialog candidate
- Opening the public card inspector previously trapped keyboard Tab inside the dialog but left the original battle and mulligan UI accessible to other input/assistive-technology navigation. While inspection is active, the title, controls, battle arena, options history and mulligan arena are now `inert`; the inspector itself remains an independent accessible modal. Previously focused trigger receives focus **after React removes inert**, via requestAnimationFrame; Escape/close still does not play a card or change selection.
- Updated existing inspector/history focus regressions and added two modal-isolation tests. Playable-core **631/631**, TS/TSX syntax-only **65/65**, catalog/AI hashes unchanged; no Node24 full React production build or live mobile verification.
- Card mechanics, saves, original AI checkpoints and 25-stage difficulty skeleton unchanged.

## 2026-11-23 — v0.284.0 safe save warnings without battlefield reflow candidate
- Hide the previous-save timestamp whenever the currently active local match save is unconfirmed; it could otherwise appear alongside a genuine failed-save warning and mislead the player. Keep the existing warning and retry controls intact.
- Compact landscape phone error and update messages are positioned in a safe-area-aware overlay with internal scrolling and >=44px dismiss/retry controls, so they cannot expand the fixed battlefield or introduce document-level scrolling. Live browser pixel testing is still required.
- Added two targeted regression cases. Dependency-free playable-core **629/629** and frontend syntax **65/65** passed; original 437 catalog entries, original 2 AI champions and hashes unchanged. Source-only candidate, no latest production React/PWA compile. No rules/AI training/save schema changed.

## 2026-11-23 — v0.283.0 compact landscape save-control priority candidate
- Fixed short, touch-landscape header congestion: save retry and Save/Leave now precede secondary record/audio controls, use concise visual labels on small screens while retaining full action-specific `aria-label`s. Preserve a legible save status and 44px+ primary save controls even at 540px or less landscape height. Desktop still shows original full labels. No changed save handler or data schema.
- Added two static source/CSS regressions; **627/627** dependency-free playable-core, **65/65** TS/TSX syntax-only, approved 437 catalog/2 AI champion checksums, 2 short AI game journeys (85 moves, two restores) passed. Full Node24 production React build and physical-device rendering remain unverified; v0.197 binary is the latest compiled verified gameplay.
- No AI strength calibration, training, online connection, card data or engine balance updates.

## 2026-11-23 — v0.282.0 compact audio and dialogue settings menu candidate
- Previously a permanent effect-sound toggle plus full dialogue/FX settings disclosure crowded the small landscape battle header and forced Save/Leave below the usable area. Moved these existing controls **without changing audio state or callbacks** under a single concise '소리·연출' details disclosure. Mobile opener is >=44px; settings live in a safe-area-aware, height-limited independently scrollable popover. A separate background click-catcher closes it without handing the same tap to a card or the end-turn button; Escape and Tab/Shift+Tab maintain keyboard access. Desktop retains all controls behind the same explicit disclosure.
- Added three source/CSS regressions; **625/625 playable-core** and **65/65 TS/TSX syntax** passed, original data hashes unchanged. Full production Node24/React build and real handset audio/UI remain unverified; PWA playtest binary still v0.197 gameplay.
- Card mechanics, AI strength/25-slot policy, rewards and save format unchanged.

## 2026-11-23 — v0.281.0 priority end-turn and safe surrender menu candidate
- Protected the **turn-end button (>=44px)** in compact/coarse landscape while reducing right-hand HUD congestion: the infrequent, dangerous Surrender control is available only inside the v0.280 full-screen "기록" drawer on touch landscapes <=760px height; desktop remains unchanged. Both UI placements call the **same** existing confirmation-and-concede function, with disabled state guarding busy/disconnected games. The match timer/mana rail and original turn action are not changed.
- New tests assert the primary turn control remains independently >=44px and both surrender paths use exactly the same confirmed game action. **622/622 playable-core**, **65/65 TS/TSX syntax**, approved original card/AI checksums unchanged. PWA/React full build and actual mobile game experience remain to be validated outside this environment.
- No AI training/difficulty calibration, balance, save schema or engine rule modifications.

## 2026-11-23 — v0.280.0 immersive battle history drawer candidate
- Saved 44px of precious landscape battle height by moving noncritical match history, card details and bug-report controls into an explicit "기록" disclosure. On touch landscape <=760px height the battle utility region is `display:none` until the dedicated 44px toolbar button opens a safe-area-aware full-viewport, internally scrollable sheet. On desktop with fine pointer, legacy visible history remains. The arena, titles, and action strip become `inert` while the modal is open, Tab/Shift+Tab is contained and Escape/close restores focus only after React removes inert state.
- Two focused source/CSS regressions validate overlay and keyboard behavior. **620/620 playable-core**, **65/65 frontend syntax**, and 2 complete AI test matches (85 actions/two restore cycles) passed; unchanged approved 437-card catalog and existing AI models. No latest Node24 React build/actual device verification, v0.197 compiled playtest remains distinct.
- All game mechanics/save schema/25-rank AI checkpoints unchanged; history is purely a UI presentation change.

## 2026-11-23 — v0.279.0 no document scrolling during landscape battles candidate
- Found a layout conflict: landscape root and screen-content were fixed, but `>.duel-screen` retained an `overflow-y:auto` fallback, allowing the entire arena to pan as action buttons and target pickers grew. Active and completed landscapes now explicitly use `overflow:hidden`, while the battlefield flexes to remaining height. Small devices retain a guaranteed 44px independent battle-history scroll strip; deck-making and setup scroll behavior remain unchanged.
- Two CSS regression cases verify no screen scrolling and independent log scroll. **618/618** playable-core, **65/65** TS/TSX syntax passed; browser pixel-level rendering still unverified due to lack of Node24+Vite dependencies/Chromium privileges. v0.197 remains last fully built gameplay.
- Card mechanics, AI/checkpoints, scores and saved-game format unmodified.

## 2026-11-23 — v0.278.0 readable opening-hand selection candidate
- The original compact 3/4-card mulligan row made full card text effectively illegible in landscape. The right-side, independently scrollable mulligan heading now contains a 44px touch-target card selector and a separate 44px **카드 설명 확대** control, opening the same accessible notch-safe full description dialog used during battle. Choosing a card to read does **not** change the replacement selection; touching a card still toggles only its replacement state and updates the selector. The dialog is rendered outside the clipping mulligan arena; Escape/close restores focus.
- 616/616 dependency-free playable-core regressions (one new mulligan inspection regression), TS/TSX syntax parse 65/65, approved original card/AI data unchanged. No full Node24+React/Vite build or real mobile rendering has been claimed.
- The existing engine, turn rules, card values, original champions, save format and 25 AI difficulty data were not modified.

## 2026-11-23 — v0.277.0 immersive hand-card full description candidate
- Added a dedicated >=44px '카드 설명 확대' action for the currently selected hand card, including otherwise unplayable hand cards revealed by tapping once. It opens the existing notch-safe, independently scrolling, focus-trapped public card inspector without issuing a game command, changing action/target selection, or altering drag targets. Escape and the close button return focus to the trigger; the dialog now has a general '카드 상세' accessible name.
- Core 615/615, frontend TS/TSX syntax 65/65, offline AI game journey 2/2 games (85 actions, two restore cycles), approved 437-entry catalog and original AI checksums passed. Full Node24/Vite production build and physical mobile interaction remain blocked/unverified, thus this is source candidate only and v0.197 remains compiled playtest.
- Original game engine, card balance, saved-game schema and AI policy/training unchanged.

## 2026-11-23 — v0.276.0 reproducible safe PWA playtest packager candidate
- Added a deterministic `scripts/package-pwa-playtest.mjs` for a **hostable HTTPS playtest ZIP**. It fails closed on dirty/wrong Git HEAD, verifies the original v0.197 compiled JS/CSS against the single-file HTML and re-generated PWA shell, calls `loadSoloRelease` to verify all SHA-256 assets and service-worker release id, writes `CHECKSUMS.sha256` and Korean-independent hosting/install guidance clearly labelling v0.197 gameplay + v0.276 installer, then integrity-tests the ZIP. No unbuilt v0.276 React game is falsely labelled playable.
- Added an additional live worker-protocol test demonstrating: initial IndexedDB failure → user plays a valid mulligan → storage recovers → explicit Save/Leave atomically claims the original empty slot and preserves the advanced revision → Resume returns the same match. **614/614 playable-core**, **18/18 PWA**, **65/65 syntax**; offline AI match 2/2, 85 actions, 2 restores. Node24/full browser and physical device not validated. Original AI/card/reward data unchanged.
- Published ZIP is for HTTPS static hosting; an internet public deployment has not been performed.

## 2026-11-23 — v0.275.0 retryable fresh-practice save claim candidate
- Found a genuine save dead end: if the *first* IndexedDB save of a newly started unranked game throws (temporary quota/permission/open failure), the worker has not yet claimed ownership; earlier logic permanently disabled `persist` and `retrySave` even after storage recovers, so continued progress was never durable. Introduced a narrowly scoped, temporary **initial claim retry** using the exact original `replaceSave` version (`null` if the slot was empty). Later actions, Pause and manual Retry can all attempt that fenced claim without starting over.
- An explicit `store.write=false` ownership/version conflict DISABLES retry and refreshes authoritative save; an intervening other tab cannot be overwritten. Ranked-match starts still fail closed if their initial save fails. Two real worker protocol tests prove success after transient outage and rejection when a second tab wins the save; **613/613 playable-core**, **65/65 frontend syntax**, previous validated AI data preserved. Full React/Node24/physical browser still not verified.
- This does not modify card balance, AI policy/training/checkpoints, serialized save schema or XP rules.

## 2026-11-23 — v0.274.0 unsaved completed-match protection candidate
- Found a legitimate lost-result path: an offline match could finish while IndexedDB save was unavailable; `shouldWarnLocalExit` deliberately suppressed browser-close confirmation for a finished *practice* match even though its result was unconfirmed, and the in-game Leave button silently called discard. Now all device matches with unverified final saves trigger the beforeunload protection, and the finished-match Leave button asks explicit permission before abandoning the unconfirmed result.
- Successful finished results still exit/save normally; actively playing games still use their original discard dialog, and server/PvP flows remain unchanged. New pure-behavior test covers unverified/verified finished results, active games and non-device rooms. **611/611 playable-core**, **65/65 syntax**, **2 complete simulated AI games (85 actions, 2 restores)** passed. Actual React/Node24/mobile remains unverified.
- No engine rules, card/AI tuning, game save format or AI checkpoint edits.

## 2026-11-23 — v0.273.0 query-safe offline PWA asset routing candidate
- A valid game URL with a share/install query string (such as `/?source=homescreen` or `index.html?from=friend`) was absent from the service worker's exact asset URL Map, so an otherwise installed offline game could unexpectedly miss its precached entry and attempt network. Normalize the query/hash of SAME-SCOPE requests before matching **only** the listed immutable asset paths; unknown paths/other scopes are never intercepted.
- The PWA install/rollback VM now verifies offline query-bearing root/index navigation, immutable `game.js?build=...` hash and unknown-asset refusal. **18/18 PWA**, **610/610 playable-core**, **65/65 syntax**, verified approved data checksums. No full Node24/browser game build/device tests; shell is verified using unmodified prior v0.197 game bytes.
- Existing game records, AI checkpoints and 382 collectible card stats unchanged.

## 2026-11-23 — v0.272.0 installed-app fullscreen semantics candidate
- Once launched from the Android/iOS Home Screen, the PWA is already an address-bar-free app window. The existing rotation control tried Fullscreen API again, which Safari may refuse, then incorrectly reported fullscreen failure despite a perfectly immersive PWA. Installed standalone/fullscreen display modes (including iOS `navigator.standalone`) now count as already immersive for the orientation-lock request, without skipping the separate orientation attempt.
- Hide redundant browser fullscreen button only for display-mode standalone, preserving it in normal browser tabs and keeping the portrait rotate/lock action. One new runtime capability test covers installed Android, iOS, browser tab, and fullscreen; static CSS source assertion guards HUD layout. **610/610 playable-core**, **65/65 frontend syntax**, functional AI games 2/2 (85 moves, 2 recoveries) and unmodified baseline data verified.
- Physical Android/iOS display-mode, browser rendering, and Node24 production build unverified; stable binary remains v0.197. No AI strength, card stats, save schema changes.

## 2026-11-23 — v0.271.0 early JavaScript startup crash notice candidate
- A downloaded `game.js` could throw during module evaluation before React rendered; resource-load errors do not catch this. The PWA shell now recognizes an early runtime error reported from `game.js` and shows an immediate Korean retry/backup warning without exposing error messages or deleting IndexedDB saves. Errors after React has mounted, unrelated scripts, and normal slow startups are not marked as fatal.
- Three new VM cases guard early game exception, later nonfatal exceptions and unrelated extensions. The tested installer `index.html` is 5,576 bytes (still separate from multi-megabyte art/game assets); documented its 6 KB bound. Initially new tests found a VM helper event-shape mismatch and an escaped regex in embedded template; corrected both, reran **609/609 playable-core, 18/18 full PWA install/update/rollback, 65/65 TS syntax**. No latest Node24 browser build or physical device verification; verified v0.197 gameplay kept untouched.
- No card stats, AI training/25-stage calibration, gameplay rules, or save schema changes.

## 2026-11-23 — v0.270.0 frontend TS/TSX syntax preflight candidate
- Added `npm run check:frontend-syntax`, a fast and explicit **syntax-only** TypeScript parser for 65 game UI `.ts/.tsx` files. It detects malformed JSX/TypeScript despite the sandbox lacking React/Vite and Node24; does NOT claim semantic typecheck, production compilation or real browser rendering.
- The Node24 GitHub validation workflow runs this new preflight *before* the actual `npm run typecheck` and full browser build. One dependency-free static test enforces truthful output and keeps the `test:playable-core` command independent of TypeScript runtime.
- The global TypeScript 5.8.3 parser available in this sandbox parsed 65/65 frontend sources without syntax errors. Full Node24/React test remains blocked by missing dependencies. No card stats, gameplay balance, AI training/performance, or save schema changes.

## 2026-11-23 — v0.269.0 suspended PWA lifecycle candidate
- Mobile browsers can send an already-loaded PWA into a hidden or locked state during the 15-second startup grace timer. Backgrounded React is not obliged to mount. The watchdog now waits for visibility and gives a **new 15-second visible grace period** rather than falsely showing a startup failure while the user was away.
- Focus/online events while hidden no longer initiate service-worker patch downloads; returning visible uses the established one-minute dedupe throttle and never reloads an active game. Two VM lifecycle regressions cover these cases, along with the existing no-hard-error/late-render suite.
- Isolated PWA shell (unchanged verified v0.197 gameplay) passed 18/18 upgrade, rollback and cache tests. Current v0.269 game build not performed; no AI performance or save/schema changes.

## 2026-11-23 — v0.268.0 mid-size landscape compact hand and readable preview candidate
- Corrected a secondary issue in the v0.266 screen-gap fix: in medium landscape 661–940px wide / 541–760px high, the newly constrained battlefield could clip a selected hand card and the previous hover-disabled UI gave no large inline preview. The hand now displays ten compact cost/art card heads; selection, unplayable-card peek and keyboard focus expand a readable card above the dock; attacking/dragging collapses that preview to avoid interfering with drop targeting.
- Extend the existing measured left/right safe-area preview-shift logic to this exact medium landscape interval; responsive CSS still keeps the entire game shell fixed, while the right rail and auxiliary logs retain only their nested scroll. Pure CSS AST parse succeeds and new focus/preview layout regression passes. Core 603/603; no physical mobile/browser render test yet.
- Original rules, cards, 25-level AI policy/checkpoints and game saves unchanged. Latest built gameplay remains v0.197 until Node24 browser build is available.

## 2026-11-23 — v0.267.0 PWA notch-safe viewport candidate
- The previously verified standalone v0.197 HTML has `<meta name="viewport" content="width=device-width,initial-scale=1"/>`, while its landscape shell already budgets `env(safe-area-inset-*)`. The installable shell did not use `viewport-fit=cover`, so a notched mobile PWA could show unused bars instead of safe-area-aligned content.
- The **installable generated index only** now opts into `viewport-fit=cover` while preserving the independent single-file v0.197 HTML byte-for-byte. A packaging regression checks exactly one viewport-fit directive; updated PWA integrity, upgrade and rollback tests pass 18/18. Actual device notch rendering, iPhone fullscreen policy, and latest v0.267 game build remain unverified.
- No balance or AI 25-rank work, no saved data changes.

## 2026-11-23 — v0.266.0 medium landscape battlefield gap candidate
- The landscape responsive rules missed **661–940 CSS px width / 541–760 CSS px height**: neither the short-phone (<=540px high) grid nor the compact-desktop (>=941px wide) rules fit, so a 100dvh page could retain a vertically scrolling fight. Add a dedicated two-column fluid battleground, central opponent/player rows, independent safe scroll in resources and history and a sticky 44px end-turn button; keep the rest of the app/document stationary.
- New source regression for viewport interval, arena grid, 44px action and nested scrolling, plus CSS parser check. Actual browser screenshots/multidevice E2E remain unverified, so this remains a source candidate.
- No changes to engine rules, collectibles, AI training/rank calibration, persistence schema, or previous verified v0.197 compiled HTML.

## 2026-11-23 — v0.265.0 startup-delay recovery candidate
- Diagnosed v0.263 watchdog incorrectly calling an unmounted React root a corrupted `game.js` resource after 15s on low-end phones. Separate *slow startup* from a verified failed resource: show a gentle retry warning, keep local saves, and let an eventual React DOM mount clear the notice via `MutationObserver`.
- Explicit script/style network failures remain hard errors even if a late root appears; service-worker `ready` cannot conceal a genuine blank startup. Five watchdog VM cases plus extra ready-state test cover delayed start, eventual recovery, actual corruption and no false positives.
- Dependency-free core gate 600/600, install/update/rollback VM 18/18 on second isolated run (first encountered intermittent Node22 Response mock `Body has already been read` in one corruption fixture; no product-code failure). Latest v0.265 gameplay not built with Node24; v0.197 previously verified gameplay preserved. No card/AI/save schema changes and no ladder strength tests.

## 2026-11-23 — v0.264.0 mobile PWA resume update polling candidate
- Installed mobile PWAs may resume from background using `visibilitychange` without a window-focus event. The PWA update checker now checks on return to visible, respects the existing 60-second dedupe throttle, and does not run while hidden. It only downloads/checks; it NEVER force-activates a new service worker under an active match.
- Two pure VM tests verify no missed foreground updates, no hidden checks and no duplicate focus/visibility checks. Wrapped updated installer around the unchanged previously verified v0.197 game package and passed 18/18 service-worker/upgrade/rollback tests on Node22.
- This is not a Node24 production build of v0.264 gameplay, and was not tested on physical Android/iPhone. Cards, gameplay/AI/search strength, checkpoint files and save schema remain unchanged.

## 2026-11-23 — v0.263.0 installed PWA blank-screen watchdog candidate
- The PWA HTML now starts a 15-second check after `window.load` and shows a persistent, dismissible recovery warning if `#root` still has no rendered app. Missing `game.js`/`game.css` are still detected immediately by resource error events. A normal/slow React mount before the deadline stays silent.
- The existing startup error flag takes priority over routine service-worker ready notices (v0.262), preventing missing-code failures from being hidden. Added three executable VM regressions. PWA integrity tests 18/18 against v0.197 compiled game and rebuilt v0.263 installer shell, not full latest game.
- No original card/AI/save changes and no 25-rank AI quality tests. Full latest client Node24 build and real phone browser measurements remain pending.

## 2026-11-23 — v0.262.0 PWA error visibility priority candidate
- Regression fixed after v0.259: an installed PWA with failed/missing `game.js` or card-art CSS could receive a later routine `serviceWorker.ready` notice and silently hide the critical asset-corruption warning. A failed resource now takes priority over routine startup success, reopens the banner and cannot be dismissed by the quiet-start branch.
- A rejected ready-state query also reopens the failure warning instead of being silent. Added a fifth VM regression for boot asset failure. Verified 18/18 existing PWA install/rollback scenarios using unchanged **v0.197 game assets** and v0.262 installer script, plus 10/10 targeted UI VM tests.
- This is installer-shell-only verification, NOT a built v0.262 game. No AI training/rank calibration or changes to game rules, 382 collectible cards or persistence format.

## 2026-11-23 — v0.261.0 isolated playable-core gate candidate
- Added `npm run test:playable-core`: deterministic gameplay-engine, offline-save/recovery, mobile input, orientation/PWA and all dependency-free UI/manifest source regressions. It does NOT run the expensive unfinished 25-rank AI performance ladder or require online socket/React runtime dependencies.
- Real local Node22 with `NODE_OPTIONS=--experimental-strip-types` verified **589/589** selected tests without installing network packages; full npm test still has 24 missing-package failures and must only be claimed on Node24/CI once dependencies are restored.
- CI Node24 workflow now performs this independent gate before `npm test`, full browser build, offline PWA integrity checks and artifact generation. Two gate configuration tests added, so the next candidate will have 591 regression assertions in the core gate. No gameplay rules/card stats/AI champion/authoritative save records changed.

## 2026-11-23 — v0.260.0 offline boot failure recovery candidate
- Before React mounts, the offline/PWA entrypoint now catches invalid or corrupted embedded catalog bootstrap and draws a visible Korean recovery panel with an explicit reload button. The notice states that local match/deck records have not been cleared; the retry does not mutate any storage.
- Error content is constructed with DOM nodes rather than untrusted HTML, so failures cannot inject markup. Added 2 executable/entrypoint regressions to npm test. These check the failure path only; successful React render still needs full Node24 build/browser validation.
- Existing v0.197 standalone and offline assets remain unchanged. All original cards, AI checkpoints, saved-game schema and gameplay rules preserved.

## 2026-11-23 — v0.259.0 installed PWA unobstructed startup candidate
- An already-installed standalone PWA no longer displays a large floating success/status toast over the game on every normal launch. A waiting patch, install failure or integrity failure still reopens the warning. Browser tab keeps its manual Home Screen install guidance.
- Fixed an asynchronous registration race: a worker actively installing (or redundant after failure) cannot be reported as a completed offline cache because serviceWorker.ready resolved.
- Four executable VM scenarios added for installed vs tab, waiting update and installing race; existing PWA package built using unchanged verified v0.197 game art/code but updated shell and passed 18/18 upgrade/rollback checks against the verified v0.197 package on Node22. This verifies installer behavior only, not the unbuilt v0.259 game client. Original card/AI/save data unchanged.

## 2026-11-23 — v0.258.0 portrait dialog keyboard isolation candidate
- Portrait rotation guide now traps keyboard Tab/Shift+Tab on its sole landscape/fullscreen request button while it is shown; background header, toolbar, main content and footer are inert on coarse-pointer portrait devices. On rotation back to landscape existing navigation focus restoration remains enabled.
- Two new source regressions added to npm test and checked TSX syntax without type-checking. No gameplay/AI/card data modifications. Full Node24 build and physical iOS/Android keyboard/rotation test pending; v0.197 remains the last verified executable.

## 2026-11-23 — v0.256.0 compact landscape decision dialogs candidate
- Card choice, effect choice and end-of-match result panels fit within short landscape arenas (<=540px tall on touch devices); choice cards pan horizontally within a bounded list, effect choices and results scroll only within their dialogs. Buttons remain >=44px.
- This extends v0.255 focus handling but does not modify game actions. Two CSS source regressions; physical Android/iPhone testing still pending.

## 2026-11-23 — v0.255.0 battle result screen keyboard focus candidate
- Battle result presentation now explicitly announces a modal dialog, focuses the first available result/rematch button after end-of-game playback and traps Tab/Shift+Tab within the result instead of sending keyboard focus to the hidden table. Shares the already-tested `modalTabIndex` function used by choice dialogs.
- Two source+behavior tests. No replay actions, user results, save schema, ranked rewards, cards or AI changed. Full React render/physical keyboard checks remain pending due missing deps.

## 2026-11-23 — v0.254.0 landscape mid-height tablet combat candidate
- The classic desktop/tablet skin enforced a 540px arena on 941+ CSS px landscape windows, causing scrolling when 540px was more than the viewport remaining below HUD. At heights <=760px, the playing/finished duel and tabletop now flex into the remaining 100dvh canvas; hero/board/hand budget scales proportionally.
- Does not change the small-phone <=540px grid rules, tall-desktop classic visuals, data or game logic. Two source regressions added; browser geometry still unverified on actual tablet.

## 2026-11-23 — v0.253.0 original cards and AI checksum guard candidate
- Added checked-in explicit immutable baseline for active card revision (437 raw catalog entries, including game non-collectible entries), progression settings, and both published AI champions. `npm run verify:release-baseline` and GitHub CI fail closed on any unapproved byte drift. The user-facing 382-card collection count is not the raw JSON list length.
- Three regression tests cover exact approved files, tampering, and unexpected paths. The baseline itself must only change with explicit user consent for a balance/AI release, not incidental PWA/UI development. This does NOT compare ignored local training checkpoint history in CI; source ZIP packager verifies ignored checkpoint preservation separately. Full Node24 game build/device still unavailable here.

## 2026-11-23 — v0.252.0 installable PWA prompt candidate
- Added in-game install entry points to PWA shell: native Chromium beforeinstallprompt accepts a real user gesture, while unsupported browsers/iOS receive browser-menu Home Screen steps. Installed standalone app never shows an install button; appinstalled clears both offers.
- Existing offline Service Worker/content hashes repackage new registration script and shell; no React engine/cards/saves affected. Three interactive JavaScript VM tests verify native acceptance, iOS fallback, and installed suppression; 61/61 UI source tests, 18/18 isolated PWA patch/rollback tests between verified v0.197 game and modified installer shell. Actual OS/browser installation and new client game build not verified.

## 2026-11-23 — v0.251.0 minimum mobile tap targets / rotation overlay
- Fixed a short-landscape regression: older CSS made saved-slot buttons only 36px tall and header action buttons 28px, even on a landscape phone wider than 650px. Now the actual tap surfaces for header, fullscreen control, save slots and match launch are at least 44px tall on coarse pointers. Existing locally scrolling lobby content handles the height cost without enabling document scrolling.
- Portrait rotation guide locks underlying page scroll while the guidance itself can still scroll and retains screen-reader/keyboard inert handling. Two dedicated source tests; full Node24 game bundle and physical touch targets still need verification.

## 2026-11-23 — v0.250.0 landscape deck builder and card catalog candidate
- The deck editor and read-only catalog now bound their filters and toolbar to local scrolling control areas while the card collection and live deck/inspector use separate side-by-side scroll panes. The overall game document stays fixed at 100dvh in landscape. 44px touch minimum for workspace navigation and editor control buttons in short coarse-pointer screens.
- Existing game model, cards, original AI champions and save format are unchanged. Added tests to guard bounded viewport, live sidebar and touch targets. Desktop render/mobile Chrome/iOS Safari are not physically verified; native Node24 build still blocked locally. The previous v0.197 standalone executable remains the only verified playable build; new source is a candidate.

## 2026-11-23 — v0.249.0 Node24 verification workflow candidate
- Added `scripts/stamp-candidate-build.mjs`, a fail-closed version stamp for a clean CI checkout. It checks that HEAD explicitly identifies v0.249, then changes only package/lock metadata in CI to `0.249.0` so an unverified candidate cannot be distributed as the previous `0.197.0` build.
- Added opt-in `.github/workflows/validate-playable.yml`: manual GitHub Actions Node24 npm ci → typecheck → engine/client/UI tests → React render → web build → full offline/PWA build/tests → deployment preflight → 7-day downloadable playtest artifact. No production deployment, no installation or app-store submission, no workflow execution yet. Requires uploading current Git branch to GitHub; branch is only in local/Library Git bundle.
- Three version/CI tests passed; no game data, rules, card balance, or AI checkpoints changed. Native Node24 and real mobile-browser test still unavailable in current workspace.

## 2026-11-23 — v0.248.0 landscape PWA status overlay candidate
- Found install/update status banner was an ordinary block before `#root`, pushing a `100dvh` PWA game canvas downward and re-enabling page-level scrolling. Converted it to fixed, notch-safe, bounded, dismissible 44px-tappable toast; new actionable updates/failures reopen the notice. No game document scrolling caused by banner.
- The PWA builder accepts `CARD_DUEL_SOLO_APP_DIST_DIR` for isolated build checks without overwriting the verified v0.197 app. Existing PWA test uses the same opt-in override.
- Corrected test-only fake CacheStorage: responses are stored as immutable bytes, as a real browser cache does. Node22 `Response.clone()` streaming divergence had falsely broken 5 checks (fix verified). From old v0.197 built standalone, the updated **installer shell** passed full 18/18 PWA install/upgrade/rollback tests with the old v0.197 executable as baseline; it is not a v0.248 client binary. Dedicated PWA banner and manifest tests 4/4.
- Native Node24 Vite/typecheck/full latest client bundle and physical phone E2E still unavailable. Existing v0.197 playable app untouched. Cards/AI/save/game rules unchanged.

## 2026-11-23 — v0.247.0 installable landscape PWA candidate (unverified build)
- PWA manifest now specifies `orientation: landscape` and `display: standalone` to request full-width landscape launch without a browser address bar when installed on supporting platforms; iOS web-app-capable/status-bar metadata included. Runtime rotate/fullscreen fallback remains for browser tabs and unsupported devices; no forced orientation claim.
- Added independent manifest source tests; older verified v0.197 executable is NOT upgraded until full Node24 build. No game or save data changed.

## 2026-11-23 — v0.246.0 mulligan landscape candidate (unverified build)
- Mulligan opening-hand screen now fits short landscape smartphone view without a document-level scroll; heroes remain centered, cards scroll horizontally inside the middle row, explanations scroll within the side panel, confirm button reserves at least 44 CSS px.
- No engine/AI/balance/save-schema modifications. 46/46 landscape checks and 371/371 engine checks passed under Node22 type-stripping; full Node24 build, physical phone E2E and PWA upgrade remain pending. Previous fully built executable v0.197 is bundled separately.

## 2026-11-23 — v0.245.0 모바일 가로화면 행동 표시줄 잘림 수정 (정식 배포 전)
- 기존 짧은 가로화면에는 행동 상태 영역 `max-height:35px;overflow:hidden`이 남아 있었지만 실제 대상 선택/확정 버튼은 최소 높이 44px인 충돌 발견. 폭 661px 이상 가로폰에서도 줄바꿈, 최대 `min(22dvh,88px)` 및 **행동 표시줄 내부만** 스크롤해 버튼 전체를 누를 수 있게 함. 44px 대상 선택 요약/버튼 보장, 전장 전체 스크롤 없음.
- v0.244: 비활성 공개 하수인 상세 보기는 모든 화면에서 클릭/키보드로 열리고, `aria-disabled`/상세 보기 안내가 실제 작동과 일치. 배경 닫기는 PointerDown 대신 click 사용해 원치 않는 다음 터치 전달 최소화. 공격 가능/타겟 지정은 기존 행동 우선. 47/47 가로형 관련 정적/순수 검사, 371/371 엔진, 82/82 클라이언트 이전 검증, TSX 파서 오류 0.
- Node24/npm 의존성/모바일 E2E/전체 React·Vite 빌드 여전히 미실행, 최신 실행 검증판 v0.197. v0.245는 소스 후보. AI/카드 원본 및 저장 규칙 변경 없음.

## 2026-11-23 — v0.243.0 하수인 터치 상세 열기 개발 후보 (정식 배포 전)
- 가로형 짧은 화면에서 공개 전장 하수인이 7장까지 작아질 때, 공격·타겟 확정이 불가능한 하수인을 한 번 탭하면 카드 이름·효과·현재 능력치가 포함된 큰 카드 검사 모달을 표시한다. 이미 가능한 공격/대상 지정은 원래 행동 유지.
- 적·아군 공개 전장만 열람 가능, 숨은 카드/AI 상태/게임 엔진 또는 저장 형식 변경 없음. 키보드 Escape·Tab 및 배경 탭 닫기, 원래 포커스 복귀, 노치 안전영역, 44px 닫기 버튼 및 내부 스크롤.
- 검증: 가로형·패키지 후보 정적/순수 45/45, 게임 엔진 371/371, 주요 클라이언트 82/82, 변경 TSX TypeScript 구문 진단 0, git diff --check. 단 React/Vite/Node24 의존성 미설치로 전체 렌더·빌드/PWA/실제 휴대폰 터치 미검증. v0.197은 기존 전체 빌드 검증 실행본으로 유지.
- 이전 v0.242는 360px 이하 가로높이에서 오른쪽 자원 패널만 독립 스크롤하고 턴 종료를 sticky 최상단에 보존(관련 42/42 통과).

## 2026-11-23 — v0.234.0 전체화면 버튼 상태 동기화 후보 (정식 배포 전)
- UI 전환 중 휴대폰 브라우저의 실제 전체화면 진입 상태를 `fullscreenchange`로 감지한다. 전체화면 진입 후 버튼을 '전체화면 종료'로 바꾸고 다시 누르면 실제 `exitFullscreen()` 호출. 브라우저 Esc/뒤로 전체화면 해제도 UI 갱신.
- 세로 화면 안내의 직접 클릭은 기존 요청/수동 회전 폴백을 보존. 접근성 `aria-pressed`, 버튼명 함께 동기화. useState 초기화에서 SSR `document` 즉시 접근 없음.
- TSX 구문 오류 0개, 가로형/접근성 관련 검사 53/53 통과. 엔진/저장/AI 변경 없음. 전체 Vite 빌드 및 실제 휴대폰 fullscreen/rotation은 Node24/의존성 및 브라우저 환경 제약으로 미검증.
- 최신 완전 검증 실행본은 v0.197, 이 버전은 소스 후보.

## 2026-11-23 — v0.233.0 추가 반응형 개선 후보 (정식 배포 전)
- 10장 손패가 좁은 가로폰이나 노치가 큰 휴대폰에서 오른쪽 끝 카드가 숨는 문제 개선. 안전 영역 좌우 `env()`, 자원 레일 폭, 카드 사이 여유를 뺀 실제 가용 가로폭 / 10으로 카드 축소 너비를 계산하고 선택 시 카드는 크게 확대한다.
- 손패 비용 배지도 축소 카드 너비보다 커져 겹치지 않게 제한. 하수인 7개 목표 버튼 너비는 44px 하한 유지하고 필요한 경우 해당 줄에서 가로 스크롤.
- 신규 노치/10장 폭 계산 회귀 검사: CSS/UI 관련 50/50 통과. JS 게임 규칙/저장·AI 원본 불변. Node24 전체 번들/실기 UI 미검증; 이전 v0.197 실행 HTML 유지.

## 2026-11-23 — v0.232.0 반응형 가로 UI 후보 (Node24 전체 빌드 전)
- 사용자 의견 반영: 고정 픽셀 기준 전장이 아니라 실제 가로 화면의 가용 폭과 높이를 사용하는 반응형 게임 UI. `100dvh`, `dvw/dvh`, `clamp()`, 최소/최대 대신 `minmax(0,1fr)`를 조합함.
- 기존 318px 전장 최소 높이와 고정된 54px/51px 영웅·손패 행 제거. 작은 화면에서 메인 메뉴/대상 탐색과 7장 하수인 칸을 비율에 맞춰 재배분. 540px는 *높이 고정값이 아니라 컴팩트 레이아웃 전환 조건*일 뿐임.
- 기존 661px 이하 가로폰에서 전체화면 게임 셸이 빠지는 문제 수정: 가로 방향이면 셸 사용, 짧은 가로 화면의 터치 전장은 별도 조건. 하수인 터치 영역 최소 가로폭 44 CSS px, 필요시 하수인 줄만 가로 스크롤.
- 노치/홈 인디케이터 안전영역 `env(safe-area-inset-*)`, 두 진입 HTML 모두 `viewport-fit=cover` 적용. 650px 이하 가로폰은 저장 슬롯 1열, 세 개 메뉴 버튼은 화면 너비에 맞게 분할, 중요한 터치 버튼 최소 높이 44px.
- 손패 기본 크기와 선택 시 확대 카드도 뷰포트 상대 크기로 변경; 최대 7개 하수인 칸의 행이 나머지 가용 높이를 균등 분배하도록 조정.
- `test/landscape-responsive.test.mjs` 4개 신규 검사. 가로 UI/접근성 검사 49/49, 게임 엔진 371/371, 대표 클라이언트 47/47 (Node22 `NODE_OPTIONS=--experimental-strip-types`); CSS 파서 오류 0, Git whitespace 검사 통과.
- Node24/react/vite 의존성 설치 불가로 전체 Vite/TypeScript/렌더/PWA 업그레이드와 물리 기기 브라우저의 실제 화질·터치/안전영역 검증은 미완료. **v0.197는 최종 완전 검증 실행판**; v0.232는 소스 후보.
- 원본 데이터/382 카드/AI 학습 체크포인트·게임 엔진/저장 스키마 변경 없음.
- 후속: Node24 환경 전체 검증, 소형·중형 가로폰 및 노치·폴더블 실기 검사, 540px 이상 높이 장치의 레이아웃 대비 개선.

## 2026-11-23 — v0.231.0 가로형 게임 로비 개발 후보 (정식 배포 아님)
- v0.229 기반. `play` 화면을 `play-hub` 2열로 재구성: 왼쪽 저장 슬롯/진행상황/이어하기, 오른쪽 직업 및 대전 준비. 각각 독립 스크롤하며 전체 화면과 메뉴는 고정. `decks`/`catalog` 메뉴 클릭 시 플레이 허브를 교체한다.
- 넓고 낮은 휴대폰(가로 CSS 너비 941px 이상, 높이 540px 이하)에서 기존 `classic-table.css`의 절대 배치가 새 중앙 전장/오른쪽 자원 레일을 덮는 문제를 방지: 필드를 상대/내 영웅 중앙 그리드로 다시 배치, 턴 종료/마나/덱 갯수를 오른쪽 열 내부 상대 좌표로 리셋.
- 테스트 Node22 `NODE_OPTIONS=--experimental-strip-types`: CSS, 메뉴 구조, 키보드 및 reduced-motion 포함 42/42; 변경 TSX/TS 6개 구문 검사, tinycss2 파서 오류0, git diff --check 통과. 이전 게임 엔진 371/371, 조작/저장 55/55 회귀도 통과 (v0.229에서 확인, 엔진·규칙·저장 변경 없음).
- Node24/React/Vite/npm 의존성을 다운받을 수 없어 전체 컴파일/렌더/PWA 업그레이드 및 실기 터치 E2E는 여전히 미검증. v0.197 오프라인 실행 HTML 유지. 이 릴리스는 소스 후보.
- 카드382종, 원본 AI/학습 자료, 서버 프로토콜 및 게임 규칙을 변경하지 않음.
- 다음: 전체화면 버튼의 들어가기/나가기 표시 및 접근성, 가로형 창에서 패널 크기 가독성, Node24/의존성 가능한 환경에서 실제 빌드·배포 검증.

## 2026-11-23 — v0.229.0 가로형 웹 게임 화면 개발 후보 (정식 배포 아님)
- 기반 Git v0.226 `6742e0f`와 v0.227 `4a96946`. 모바일 가로 전투에는 중앙 상대/내 영웅, 7개 하수인 칸과 40px 축소 손패의 선택 확대가 포함됨.
- 메인 메뉴, 덱 편집, 카드 도감에 공통 가로형 `100dvh` 게임 셸을 적용. 긴 문서 자체를 스크롤하는 대신 선택한 화면 내부만 스크롤. 3개 게임 메뉴를 클릭해 전환하고 화면 변경 시 내부 스크롤을 상단으로 초기화.
- 모바일 세로 방향에서는 가로로 돌리라는 전체화면 안내를 표시하고, 지원 브라우저의 직접 클릭에 한해 fullscreen/orientation.lock('landscape') 요청. 불가능하면 수동 회전 안내. 아래 화면/설정 조작은 inert 처리해 키보드·보조기기 오조작 방지.
- 가로 휴대폰 높이가 360px 안팎인 상황에서 기존 테마의 최소 540px 전장 크기 제한을 제거하고 한 화면 안에 맞춰 재배치. 44px 턴 종료 버튼 크기는 유지.
- 카드를 낼 마나가 없더라도 손패 카드를 탭하면 전체 텍스트와 이미지가 확대되고, 같은 카드를 다시 탭하면 닫힘. 독립 미리보기 상태만 바뀌며 게임 행동은 실행하지 않음.
- 테스트: Node22 `NODE_OPTIONS=--experimental-strip-types`로 게임 엔진 371/371, 대표 클라이언트 동작 55/55, CSS/가로 셸 40/40; 변경 TSX/TS 6개 TypeScript transpileModule 구문 검사 통과. git diff --check 통과.
- 미검증: Node24 + npm 의존성 미설치 (registry DNS 접근 차단)로 전체 typecheck, Vite 컴파일, PWA 업데이트/롤백 및 실제 모바일/PC 조작 불가. 기존 v0.197 완전 검증 HTML은 반드시 보존. 본 코드는 개발 후보이고 새 실행 HTML은 미생성.
- 카드 382종, AI 체크포인트·학습 원본, 게임 엔진 규칙·저장 스키마 모두 수정하지 않음.
- 후속: 로비에서 전투 입장까지 한 화면에 적합하도록 게임 허브를 2열로 재배치, 카드와 대상 버튼의 사용성 점검, 전체 빌드 가능한 환경에서 재검증.

## v0.226.0 개발 후보 — 2026-11-23 KST (정식 배포 아님)

긴 대상 목록의 요약에 공개된 현재 선택 행동 이름과 합법 대상 수를 스크린리더로 읽을 수 있는 접근성 레이블, PageUp/PageDown 5칸 이동 안내 툴팁을 추가. 선택/엔진/데이터 변경 없음. 행동 회귀 20/20, 키보드 CSS 6/6 통과, TS/TSX 4개 파싱 오류 0. 실제 스크린리더와 브라우저 E2E 미검증. 전체 Node24 빌드 불가(Node22, React/socket.io 등 npm 의존성 미설치). v0.197 실행판을 최신 완전 검증판으로 유지.

## v0.225.0 개발 후보 — 2026-11-23 KST (정식 배포 아님)

대상 선택 목록에 PageDown/PageUp 5칸 이동(양 끝에서 멈춤) 추가. 방향키/홈/엔드/확정/취소는 기존과 동일. 대상 목록의 키보드 E2E 기대값을 추가했고 순수 행동 회귀 20/20, 터치 12/12, 포커스 CSS 6/6, 움직임 감소 CSS 3/3 통과(Node22 --experimental-strip-types). Node24 전체 빌드 및 물리 브라우저는 미검증. 원본 카드·AI·저장 형식 변경 없음.

## v0.217.0 개발 후보 — 2026-11-23 13:45 KST (정식 배포 아님)

`apps/client/test/standalone-browser.test.ts`의 솔로 모바일 마법사 영웅 능력 대상 지정 시나리오에 실기 회귀 절차 추가: 감정표현 열기 시 패널 전체가 화면 안전영역 안에 위치, 닫기 버튼으로 닫고 나서도 영웅 능력 선택 유지, 다시 열어 Esc로 닫아도 기존 공격·주문 선택을 취소하지 않음. 844×390 가로회전 시 턴 종료·항복·카드 상세 펼치기 실제 크기 최소 44px 검사 후 세로 복귀. TypeScript 구문 검사 0 오류. 다만 Chromium socket EPERM/Playwright 의존성 미설치로 **브라우저 실행은 하지 못함**. 앞선 정적 회귀는 별도로 통과했으며 엔진/카드/AI 저장 불변.

## v0.216.0 개발 후보 — 2026-11-23 13:43 KST (정식 배포 아님)

휴대폰에서 직업 감정표현 메뉴가 아래로 잘리거나 닫기가 불편한 문제: 열린 메뉴를 화면 안전영역 하단 고정, 메뉴 내 스크롤과 상단 고정된 44px 닫기 버튼 제공. 효과 버튼 선택 또는 닫기 시 원래 감정표현 요약에 키보드 초점 복귀. 설정/감정표현 상세가 열려 있는 동안 Esc를 누르면 상위 `arena-message` 키보드 capture가 선택 카드까지 취소해버리는 실제 경합을 찾아 우선 보호하고, 상세 자체의 Escape 처리에 맡기도록 수정. 모바일/접근성 정적 23/23 통과, Battle/Dialogue TSX 구문 진단 0. 전체 빌드/실제 브라우저 조작 미검증, 카드·AI·규칙·저장 데이터 불변.

## v0.215.0 개발 후보 — 2026-11-23 13:40 KST (정식 배포 아님)

휴대폰 가로화면 손패 카드 효과 본문이 최악 7px에 불과하던 문제에 대해, 확대해서 읽는 `카드 상세 보기`의 요약 문구에 선택한 본인 손패 카드 이름을 노출(자기 카드만; 상대 비공개 정보 사용 안 함). 상세 내용은 기존 전체 CardInspector를 그대로 사용하고 요약은 줄바꿈하여 긴 이름이 잘리지 않게 함. 44px 터치 크기는 v214 규칙 유지. 모바일/CSS 검사 22/22, Battle TSX 구문 진단 0. 실제 가로화면 UI 확인/Node24 빌드 미검증, 엔진/AI/원본 저장 불변.

## v0.214.0 개발 후보 — 2026-11-23 13:38 KST (정식 배포 아님)

휴대폰 가로화면(높이 540px 이하, 너비 661px 이상)의 버튼이 기존 압축 규칙에 의해 23~36px로 작아져 터치 오류가 발생할 수 있는 문제 보완. 패치·턴 종료·항복·대상 지정 상태 안내·가로화면 카드 상세 펼치기 컨트롤을 최소 높이 44px로 설정하고 안내줄은 줄바꿈 허용. CSS 실제 로드 순서에서 마지막인 `battle-fx.css`의 끝에 override를 위치시켜 앞선 28px 규칙을 다시 덮어쓰지 않도록 확인. 기존 전장 크기·게임 규칙 불변. CSS/모바일 21/21 통과, 실제 가로화면 기기 미검증. 전체 Node24 빌드 미검증.

## v0.213.0 개발 후보 — 2026-11-23 13:37 KST (정식 배포 아님)

덱 편집기에 바로 진입하면 저장소가 차단되거나 데이터 손상으로 덱 목록이 비어 보이더라도 아무 경고가 나오지 않는 초기 표시 누락 수정. 최초 `checkedDeckLibrary([],storage)`로 저장소 무결성을 검사해 오류 시 경고를 표시하고, 안내 텍스트를 `role=status`로 만들어 접근성 개선. 정상 저장소에서는 기존 안내/저장 동작 유지. 모바일/저장 화면 정적 20/20 통과, TSX 구문 진단 0. 전체 빌드/실기 미검증, 카드·AI·저장 형식 불변.

## v0.212.0 개발 후보 — 2026-11-23 13:35 KST (정식 배포 아님)

다른 탭 또는 브라우저 저장소 읽기 오류가 발생했다가 원상복구된 뒤, 저장 덱 내용이 같으면 이전 오류 경고가 영구적으로 남는 문제 해결. 엄격한 읽기 실패 후 정상 읽기가 성공했으나 레코드는 변하지 않은 경우에만 `onRecovered(previousError)`를 한 번 호출하여 정확히 해당 오류 문구가 화면에 남아 있을 때만 '저장 덱 확인 완료'로 전환. 동시에 새로운 덱을 읽으면 기존 변경 알림을 우선하며, 화면에서 사용자가 다른 작업을 했으면 그 상태 메시지를 덮어쓰지 않음. 동기화 7/7 통과, TSX/TS 구문 오류 0. 전체 Node24 빌드 및 실기 미검증, 카드·AI·저장 형식 불변.

## v0.211.0 개발 후보 — 2026-11-23 13:32 KST (정식 배포 아님)

저장 덱 화면으로 직접 진입했을 때 기존 v0.210의 저장소 오류 경고가 누락되던 경로 보완. 저장소 손상 상태에서 화면 시작 시에도 경고를 표시하고, 저장소가 복구돼 다시 목록에 들어왔을 때는 이전 오류 메시지를 정상 확인 안내로 갱신(검증된 저장 덱만 반영). 저장/모바일 정적 39/39, TSX 구문 검사 통과. 전체 빌드/실기 미검증. 카드·AI·원본 저장 데이터 불변.


## v0.210.0 개발 후보 — 2026-11-23 13:31 KST (정식 배포 아님)

별도의 저장 덱 목록 화면을 열 때 storage.getItem이 차단되거나 JSON 손상인 경우 이전에 안전하게 확인된 덱을 표시하면서 '확인할 수 없습니다' 경고를 보여주도록 개선. 저장소가 진짜 비었음이 검증된 경우만 정상 빈 목록으로 갱신하며, 외부 탭에서 유효한 덱이 추가되면 새 목록 반영. 저장 로직 checkedDeckLibrary 순수 함수로 공통화, 오류 이후 기존 카드와 이름 덮어쓰기 없음. 저장/동기화/모바일 43/43, TS 구문 검사 통과. Node24/React/Vite/브라우저 실기 미검증, 최신 검증 실행판 v0.197 유지.


## v0.209.0 개발 후보 — 2026-11-23 13:28 KST (정식 배포 아님)

휴대폰 화면의 대상 목록 설명 글자가 기본 11px·12px로 너무 작던 점 개선. 터치 장치/660px 이하에서 카드/하수인 이름 14px, 능력치 12px, 상태 배지 11px로 조정하고 높이는 스크롤 목록이 감당해 잘리지 않게 함. 관련 CSS 정적 회귀 통과. 실제 기기 화면은 제한으로 미확인. 원본 게임/AI/저장 불변.


## v0.208.0 개발 후보 — 2026-11-23 13:27 KST (정식 배포 아님)

대상 목록 내 도발·천상의 보호막·면역·빙결을 별도 시각 배지로 구분, 작은 화면에서 텍스트 겹침 방지. aria-label 전체 설명은 유지하되 장식 배지는 중복 낭독하지 않음. 모바일/CSS 정적 17/17 및 TSX 구문 검사 통과. 실제 색 대비·스크린리더/모바일 기기 체감은 미검증. 엔진·카드·AI·저장 형식 불변.


## v0.207.0 개발 후보 — 2026-11-23 13:26 KST (정식 배포 아님)

모바일 포인터 드래그를 하는 동안 상태 문구가 위치 변경마다 업데이트될 때 스크린리더 안내를 반복 예약하지 않도록 aria-live를 일시적으로 끔. 드래그가 끝나면 안내를 정상 polite 상태로 되돌리고 텍스트/드롭 상태는 화면에 그대로 유지. 정적 회귀 검사 추가, 실제 스크린리더 음성은 기기 환경 제약으로 미확인. 엔진·카드·AI·저장 데이터 불변.


## v0.206.0 개발 후보 — 2026-11-23 13:25 KST (정식 배포 아님)

대상 선택 패널이 카드/하수인/영웅의 출처를 가리던 문제 완화. 화면 하단 고정된 대상 목록의 sticky 닫기 영역에 현재 선택 행동 이름 표시(긴 카드명 말줄임), 그룹 접근성 설명은 출처 포함, 닫기 버튼 자체의 접근성 이름은 기존 그대로 유지. 공개 카드 이름과 자기 패만 사용하고 엔진/AI/저장 불변. 관련 대상 모델/모바일 CSS 35/35 통과, TSX 파싱 진단 0. 전체 빌드·브라우저/실기 미검증.


## v0.205.0 개발 후보 — 2026-11-23 13:22 KST (정식 배포 아님)

소스 후보 ZIP이 git archive에 추적되지 않는 data/ai 13개와 기검증 PWA dist 8개를 누락할 수 있는 백업 결함 점검. scripts/package-candidate.py에 원래 전체 검증 ZIP과 확정 HEAD의 소스를 결합하는 패키지 생성기 추가. 추적 원본 data/ 및 기존 단일 HTML이 v0.197과 바이트 같을 때만 통과, 미커밋 파일과 경로/데이터 변경·기존 대상 덮어쓰기 거부, AI/검증판 실행 자산 해시 검증 및 UNBUILT 표시. Node24·의존성 없으므로 v0.197 기검증 실행 자산은 후보에 동봉만 하고 미빌드/미배포로 안내. 매시간 자동 실행 OFF.


## v0.204.0 개발 후보 — 2026-11-23 13:20 KST (정식 배포 아님)

모바일 대상 선택 목록에 공개 전장 정보인 도발·천상의 보호막·면역·빙결을 카드 배치 번호와 현재 공격력/체력에 함께 표시. 영웅 면역·빙결도 공개된 상태만 표시하며 기존 합법 대상 필터를 우회하지 않음. 순수 대상 모델/CSS 34/34 검사 통과, TS/TSX 구문 진단 0. 전체 빌드·렌더·실기 미검증, v0.197 완전 검증판 유지. 카드·AI 데이터와 게임·저장 규칙 변경 없음. 매시간 자동 실행 OFF.


# Card Duel 재개 인계 — 2026-11-22

## v0.203.0 개발 후보 — 2026-11-23 13:19 KST (정식 배포 아님)

앞서 구현한 모바일 대상 목록의 열기/닫기, 키보드 화살표·Home/End, 목록의 sticky 닫기 버튼, 첫 Escape 시 행동 유지 및 실제 대상 확정 후 사용을 검사하는 Playwright 실기 E2E 시나리오 확장. 짧은 패널 높이를 강제해 스크롤이 있는 경우 닫기 버튼 좌표 확인, 카드/영웅 능력 선택 보존 확인을 추가. `docs/SOLO-ACCEPTANCE.md`에 v198~v203 단계별 모바일/저장 데이터 보호 실기 확인 절차 기록. TypeScript 구문 파싱 0 오류. 실제 브라우저 실행은 환경 Chromium socket EPERM, 의존성 미설치로 불가하므로 E2E **미실행** 명시. 기존 카드·AI/저장 변경 없음, v0.197 검증 실행판 보존. 매시간 자동 실행 OFF.


## v0.202.0 개발 후보 — 2026-11-23 13:18 KST (정식 배포 아님)

별도 '덱 리스트' 화면도 화면 전환·덱 삭제 오류 시 느슨한 `readDecks()` 반환값으로 기존 목록을 빈 배열로 덮어쓸 수 있음을 발견해 v0.200의 엄격한 검증/마지막 확인 목록 유지 로직을 공통 사용하도록 통합. 정상적인 다른 탭의 저장 변경은 반영, 손상/접근 불가 데이터는 화면 내 유효한 덱을 임의 삭제한 듯 표시하지 않음. 덱 소스·정적 UI 검증 추가, 저장/동기화/모바일 37/37 통과. 실행판/전수/실기 검증 및 새 HTML 배포 미실행; 카드/AI/저장 스키마 원본 보존. 자동 예약 OFF.


## v0.201.0 개발 후보 — 2026-11-23 13:18 KST (정식 배포 아님)

합법 대상 10개 이상인 좁은 폰/가로화면에서 목록을 아래로 스크롤하면 최상단 '대상 목록 닫기' 버튼이 사라지던 문제 완화. CSS 그리드 목록의 닫기 버튼을 sticky 상단으로 유지하고 키보드로 이동한 대상의 초점 테두리가 닫기 버튼 밑에 가려지지 않도록 스크롤 여백 추가. 정적 모바일/CSS·대비·키보드·동작 줄이기 22/22 통과. 실제 모바일 스크롤 위치와 포커스 가시성은 환경 제약으로 미검증. 엔진·저장·카드/AI 불변, v0.197 마지막 전체 검증판 유지, 자동 진행 OFF.


## v0.200.0 개발 후보 — 2026-11-23 13:14 KST (정식 배포 아님)

덱 편집기에서 명명된 덱 저장/삭제 실패 시 `readDecks()`의 느슨한 오류 처리로 기존 화면의 유효한 저장 덱 목록이 빈 목록으로 바뀌던 문제 수정. 실패 후 저장소를 엄격히 재검증하고 실제로 유효한 외부 변경일 때만 갱신, 저장소 접근 거부/손상 시 마지막 확인된 목록을 유지하며 현재 선택 인덱스를 해제. 원본 저장 데이터·스키마 변경 없음. 저장 오류/외부 추가/삭제/변경 없음의 회귀 1개 추가, Node22 순수 저장/다중 탭/모바일 정적검사 35/35 통과. Node24 및 React/Vite 의존성 부재로 전체·타입·웹빌드/실기 미검증, v0.197 마지막 완전 검증판 보존. 자동 실행 OFF.


## v0.199.0 개발 후보 — 2026-11-23 13:12 KST (정식 배포 아님)

모바일/키보드 대상 목록이 확장된 상태에서 화살표·Home·End로 오직 공개된 합법 대상 버튼의 포커스를 순환/이동하도록 개선. Enter/Space를 통한 명시적 선택 전에는 전투 명령을 보내지 않으며, Shift/Alt/Ctrl/Meta와 목록을 닫은 상태는 탐색 대상에서 제외. 기존 Esc 두 단계/선택 취소/모바일 목록 닫기 유지. 기존 키보드 탐색 모델 재사용, 앱 CSS 및 정적 회귀 1개 추가. Node22 실험적 TS 제거로 엔진/조작/저장 관련 453/453과 정적 모바일 검사 통과, TSX 구문 파싱 0 오류. Node24/React/Vite 의존성 부재로 전체 회귀·타입검사·오프라인 빌드/업데이트/실기 미실행. 마지막 전체 검증판 v0.197 유지. 카드·AI/저장 포맷 변경 없음. 매시간 자동 진행 OFF.


## v0.198.0 개발 후보 — 2026-11-23 13:01 KST (정식 배포 아님)

모바일·좁은 화면에서 대상 선택 목록이 전장 아래로 잘리거나 닫기 어려운 조작 문제 완화: 대상 목록을 화면 하단 안전영역 위에 고정하고 스크롤 가능한 높이로 제한, 가로 스크롤 차단, 좁은 가로화면 높이 재제한. 목록 맨 위에 44px '대상 목록 닫기' 버튼 제공. 대상 목록 안에서 첫 Escape는 목록만 접고 기존 카드/공격 선택은 유지하며, 다시 Escape를 누르면 기존대로 행동 선택을 취소하도록 변경. PC 기존 팝오버 배치는 보존. 엔진·카드·AI·저장 규칙 변경 없음.

검증: Node22 실험적 TS 제거 환경에서 엔진 371/371, 클라이언트 순수 로직 74/74, CSS/접근성 정적 회귀 15/15, TSX 구문 파싱 2개 진단 0. **Node24와 npm 의존성 미설치/오프라인 npm 캐시 누락으로 전체 725개 테스트·타입검사·웹빌드·PWA 업데이트·실제 브라우저 시험은 수행하지 못함.** v0.197.0이 최신 전체 검증·실행판이며 v0.198은 소스 후보만 저장. 런타임 배포·기존 standalone HTML 업데이트 금지. 다음 환경에서 Node24/npm ci 설치 후 전체 회귀·렌더·웹/오프라인 빌드·구버전 업데이트 검증과 모바일 실제 탭/키보드 테스트 완료 후 승격할 것. 매시간 자동 진행 OFF 유지.

## 최신 검증 체크포인트 — v0.197.0 (2026-11-23 12:51 KST)

추가 난이도 스트레스 점검에서 개발용 `epic` 덱 생성기가 일부 전설 하수인을 2장 복제해 실제 엔진의 합법 덱 검증에 걸리는 문제 발견 및 수정. 보충 카드는 전설 제외, 카드별 최대 허용 매수 준수, 모든 직업 조합에서 30장 덱 생성. 실제 81개 순서 있는 직업 대진·영웅급 카드 38/38종 사용 확인 및 자동 회귀 테스트 추가. AI 챔피언225게임/13,484합법 행동, Android 검사7/7, 실험 난도3/3 및 일반/전설 스트레스 각각81게임 통과. 전체725/725·타입·렌더61/61·실제 v196 PWA 업데이트/롤백18/18·단일 HTML2/2·웹 빌드·로컬 배포 검증 통과. 실기 미확인, 원본 카드·AI·게임 기록 불변, 자동 정각 진행 OFF.

## 최신 검증 체크포인트 — v0.196.0 (2026-11-23 12:49 KST)

다른 탭 저장 덱 변경이 최초 구독 직전이나 현재 덱 편집·복원 작업 도중 발생한 경우, 첫 구독 및 편집 종료·덱 목록 화면 복귀 시 즉시 엄격 재검사. 새 브라우저 이벤트를 기다리지 않고 놓친 변경을 반영, 편집 중/숨김 상태에는 기존 보호 유지. 시뮬레이션5/5·전체724/724·타입·렌더61/61·v195 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 점검 통과. 실기 미확인, 저장·AI·원본 카드 불변, 자동 정각 진행 OFF.

## 최신 검증 체크포인트 — v0.195.0 (2026-11-23 12:44 KST)

다른 탭의 덱 목록 동기화 이벤트를 순수 가시성/스토리지 감시기로 분리하고 모의 탭으로 검증. 관계없는 저장 키 무시, 실제 변경이 있을 때만 업데이트, 숨김 화면·자체 저장 도중 반영 지연, 손상된 외부 목록 거부, 컴포넌트 제거 시 이벤트 정리. 감시 검사3/3·전체722/722·타입·렌더61/61·실제 v194 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 점검 통과. 실기 미확인, 원본 카드·AI·게임 기록 불변, 자동 정각 진행 OFF.

## 최신 검증 체크포인트 — v0.194.0 (2026-11-23 12:42 KST)

Git 확정본 패키징 시 다음 버전의 오프라인 업그레이드·롤백 시험에서 곧바로 사용할 동일한 `vNNN-solo-app` 폴더도 자동 복사하고 7개 자산의 SHA-256과 SW를 재검증. 기존 결과/폴더를 덮어쓰지 않는 보호 유지. 덱 편집·덱 관리의 기본 저장 슬롯 래퍼를 렌더마다 새로 만들지 않도록 고정하여 포커스 감시 재구독 방지. 타입·전체719/719·렌더61/61·실제 v193 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 검증 통과. 실기 미확인, 새 패키징 명령은 커밋 후 실행 예정. 엔진·카드·AI·저장 기록 불변, 자동 정각 진행 OFF.

## 최신 검증 체크포인트 — v0.193.0 (2026-11-23 12:40 KST)

서로 다른 탭에서 같은 저장 슬롯의 이름 붙인 덱을 추가·삭제·변경할 때 현재 열린 덱 목록을 갱신. 기존 편집 덱은 건드리지 않고, 목록 자체가 바뀐 경우만 이전 선택을 해제하여 잘못된 항목을 선택/삭제할 위험 감소. 손상된 외부 저장 데이터는 기존 화면 목록으로 대체하지 않음. 저장 모델18/18·타입·전체719/719·렌더61/61·실제 v192 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 검증 통과. 브라우저 실기 미확인. 이전 v192 패키징 명령 실제 성공·기존 아카이브 덮어쓰기 거부 확인, AI 225경기 합법 종료/13484 행동 검사 통과, 카드·AI 원본 유지, 정각 자동 진행 OFF.

## 최신 검증 체크포인트 — v0.192.0 (2026-11-23 12:35 KST)

Git 확정 버전이 아닌 다음 작업의 미완성 파일이 ZIP에 섞이지 않도록 배포본 생성 스크립트 도입. 더러운 작업 폴더, 이미 존재하는 결과 파일, 구버전 빌드 또는 자산 해시 오류를 거부. 확정 HEAD 소스와 설치형 PWA·오프라인 HTML·AI 데이터의 무결성 확인 뒤 3개 파일을 생성하며 외부 업로드/배포 없음. 더러운 작업 폴더 안전 거부 확인, 타입·전체718/718·렌더61/61·실제 v191 PWA 업그레이드/롤백18/18·HTML2/2·웹 빌드·로컬 배포 점검 통과. 실제 정식 패키징은 커밋 뒤 확인 예정. 카드·AI·경기 저장·엔진 불변, 정각 자동 진행 OFF.

## 최신 검증 체크포인트 — v0.191.0 (2026-11-23 12:32 KST)

덱에 카드를 넣고 빼거나 검색어/페이지를 바꾸는 동안 고정 카드 목록의 정렬·필터를 매번 새로 하지 않도록 메모이제이션. 직업·고전 카드명·획득 카드 및 필터 조건이 실제로 바뀔 때만 다시 계산. 저장 슬롯 1~3 선택 버튼에 현재 상태·랭크/XP·경기 유무를 음성 설명으로 연결. 타입·전체718/718·렌더61/61·실제 v190 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 검증 통과. 실기 미확인. 기존 카드 정렬 순서·게임 규칙·AI·저장 불변, 정각 자동 진행 OFF.

## 최신 검증 체크포인트 — v0.190.0 (2026-11-23 12:30 KST)

모바일 360px 이하 저장 슬롯이 3열로 눌리던 배치를 2열로 조정. 길어진 오류 문장은 여러 줄로 접되 닫기/복구 버튼은 압축하지 않음. 모바일 첫 화면 주요 버튼·로컬 PWA 설치 알림의 패치/저장 보호 버튼을 최소 44px로 확대. 정적 모바일 스타일 7/7·타입·전체718/718·렌더60/60·실제 v189 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포 점검 통과. 실기 미확인. 카드·AI·게임 규칙·기존 저장 불변, 정각 자동 진행 OFF.

## 최신 검증 체크포인트 — v0.189.0 (2026-11-23 12:27 KST)

상대 재접속 대기 중 화면 읽기 프로그램에 매초 바뀌는 숫자를 라이브 알림으로 반복 전달하던 구조를 개선. '상대 재접속 대기 중'은 안정된 상태로 알리고, 남은 분·초는 읽기 가능한 별도 비실시간 텍스트로 표시. 재접속이 이미 대기 중인 화면은 첫 렌더부터 남은 시간을 계산. 타입·전체716/716·렌더60/60·실제 v188 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·로컬 배포·카드 감사 통과. 실기 미확인. 엔진·서버의 실제 재접속 판정/보관된 게임·카드/AI 불변, 정각 자동 진행 OFF.

## 최신 검증 체크포인트 — v0.188.0 (2026-11-23 12:23 KST)

온라인 개발자 상태 패널의 10초 주기 조회가 앱이 숨겨지면 타이머와 진행 중인 요청을 취소하고, 다시 화면에 보이면 즉시 새 상태를 확인하도록 분리. 오래된 취소 요청의 오류 알림을 버리고 컴포넌트 제거 시 이벤트/타이머 누수 없음. 주기 검사3/3, 타입·전체716/716·렌더59/59·실제 v187 PWA 업데이트/롤백18/18·HTML2/2·웹 빌드·배포 점검 통과. 실기 미확인. 카드/AI/엔진/저장·개인정보 불변, 정각 자동 진행 OFF. 다음: 전투 재접속 카운트다운 화면 읽기 프로그램 알림 빈도 조절.

## 최신 검증 체크포인트 — v0.187.0 (2026-11-23 12:19 KST)

좁은 모바일 화면에서 저장 슬롯 선택 버튼·카드 컬렉션 페이지 전환 버튼·덱 편집 선택/동작 컨트롤에 최소 44px 터치 높이 적용, 저장 슬롯 세부 정보 글씨 크기 12px 유지. CSS 회귀 5/5, 전체713/713, 타입·렌더59/59, 실제 v186 PWA 업데이트/롤백18/18, HTML2/2·웹 빌드·로컬 배포 점검 통과. 게임 규칙·카드·AI·저장 스키마/기록 불변, 정각 자동 진행 OFF. 실기 미확인. 다음: 화면 좁힘에 따른 손가락 제스처 및 UI 경합 확인.

## 최신 검증 체크포인트 — v0.186.0 (2026-11-23 12:16 KST)

전투 턴·재접속 카운트다운이 0초 도달 후에도 도는 표시용 주기 타이머를 자동 해제. 이미 만료한 마감 시각에서는 인터벌 생성 금지, 화면 복귀·중복 가시성 이벤트에서도 0 유지. 엔진/실제 턴 판정/저장 불변. 시계2/2·이전 v185 PWA18/18, 타입·전체710/710·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증 통과. 브라우저 실기 미확인. 카드382/기존 AI 챔피언/스키마 유지, 정각 자동 진행 OFF. 다음: 모바일 작은 버튼 터치 가독성 및 실제 장시간 플레이 점검.

## 최신 검증 체크포인트 — v0.185.0 (2026-11-23 12:13 KST)

전투 턴/재접속 마감 시간 표시용 주기 타이머를 가시성 인지형으로 통합. 백그라운드에서 정지, 복귀 시 실제 마감 시각 재계산·중복 인터벌 방지·컴포넌트 제거 시 해제. 엔진 제한시간·AI·저장 불변. 시계2/2, 타입·전체710/710·렌더59/59·이전 v184 PWA18/18·HTML2/2·웹빌드·로컬 배포 검증 통과. 실기 미확인. 원본 382장/챔피언 AI/저장 스키마 보존, 정각 자동 진행 OFF 유지. 다음: 만료된 화면 시계의 추가 갱신 중단과 알림 부하 점검.

## 최신 검증 체크포인트 — v0.184.0 (2026-11-23 12:11 KST)

모바일/PC 앱 로비에서 다른 저장 슬롯 2개를 순차 조회할 때 중복 포커스 이벤트로 작업을 취소·재시작하지 않게 제한. 배경으로 숨으면 미리보기 작업만 중단하고 복귀하면 재조회, 본 게임/저장 작업 불변. 가시성 상태 검사 복구8/8, 이전 v183 PWA18/18, 타입·전체708/708·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증 통과. 실기 미확인, 카드/AI/엔진/저장 스키마 불변, 자동 정각 진행 OFF. 다음: 좁은 화면 타이머/연출 배경 부하 감축.

## 최신 검증 체크포인트 — v0.183.0 (2026-11-23 12:09 KST)

서비스 워커 미지원·보안 출처 아닌 설치 환경에서 상단에 설치 불가/오프라인 재실행 미보장 안내, 필수 게임 파일 오류 경고가 우선. 실제 이전 v182 업그레이드·롤백 PWA18/18, 타입·전체707/707·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증 통과. 브라우저 실기 미확인. 원본 AI·382 카드·엔진·저장 스키마 불변, 정각 자동 진행 OFF. 다음: 모바일 전환 시 저장 슬롯 조회 작업 중복 방지와 게임 파일 무결성 보강.

## 최신 검증 체크포인트 — v0.182.0 (2026-11-23 12:07 KST)

설치형 시작 문서가 카드 스타일·게임 모듈·설치 관리 스크립트의 로드 실패를 선제 감지하고 실행기 재연결/새로고침·기록 보존 경고 표시. 늦은 정상 설치·패치 메시지는 이 경고 덮어쓰기 금지. 독립 HTML 실행판은 원래 한 파일 그대로. 이전 v181 오프라인 업그레이드·롤백 PWA17/17, 타입·전체707/707·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증. Chromium socket EPERM으로 실기 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF 유지. 다음: 오류 상태 실제 브라우저 확인/패치 등록 일관성 검사.

## 최신 검증 체크포인트 — v0.181.0 (2026-11-23 12:05 KST)

설치 중인 서비스 워커가 해시 검증한 캐시 자산 개수(7개)를 열린 앱에 알리고, 등록 화면에서 같은 작업자의 유효한 설치 중 메시지만 표시. 최종 준비/실패 상태를 오래된 진행 수치로 덮어쓰지 않음. 재설치·알림 미지원에서도 게임/설치 안전. 직전 v180 오프라인 업그레이드·롤백 PWA16/16, 타입·전체707/707·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증 통과. 실기 미실행. 원본 AI/카드/엔진/저장 스키마 불변. 자동 정각 진행 OFF. 다음: 캐시 실패 시 화면 안내 안전성 및 로컬 파일 압축 후 재검증.

## 최신 검증 체크포인트 — v0.180.0 (2026-11-23 12:03 KST)

설치 앱 캐시의 게임 JS·14MB 카드 CSS·시작 HTML 등의 첫 접근을 SHA-256 재검증, 실행 중 정상 확인 결과 재사용, 손상 시 해당 자산만 삭제하고 같은 릴리스 원본 해시 검증 복구. 완전 오프라인에서는 503 제공, 기존 경기·다른 정상 캐시 유지. 직전 v179 업그레이드·롤백 PWA15/15, 타입·전체707/707·렌더59/59·HTML2/2·웹빌드·로컬 배포 검증 통과. 실제 브라우저 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF 유지. 다음: 대용량 카드 아트 첫 표시 비용 측정·오프라인 실패 UI 개선.

## 최신 검증 체크포인트 — v0.179.0 (2026-11-23 12:01 KST)

브라우저 저장 보호의 최초 지연 응답이 사용자가 승인한 최신 결과나 명시적 실패를 덮어쓰지 않도록 요청 세대 보호. 중복 클릭 및 버튼 상태 복구. 실제 이전 v178 오프라인 업그레이드·롤백 PWA14/14, 타입, 전체707/707, 렌더59/59, HTML2/2, 웹빌드·로컬 배포 사전 검증 통과. 브라우저 실기 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF 유지. 다음: 손상된 오프라인 캐시를 실제 접속 시 안전하게 탐지·복구.

## 최신 검증 체크포인트 — v0.178.0 (2026-11-23 12:00 KST)

설치형 앱의 첫 오프라인 캐시 설치 중/실패 안내, 이미 시작된 설치 작업 감지, 대기 패치 메시지 늦은 준비 완료 콜백 덮어쓰기 방지. 중복 상태 리스너 제거. 이전 v177 오프라인 업그레이드·롤백 PWA13/13, 타입, 전체707/707, 렌더59/59, HTML2/2, 웹빌드·로컬 배포 검사 통과. 실제 Playwright 실행은 환경 Chromium socket() EPERM으로 차단. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 실제 설치 상태 지연/오류 회귀 보강, 모바일 카드 그림 확인.

## 최신 검증 체크포인트 — v0.177.0 (2026-11-23 11:59 KST)

설치형 PWA에서 14MB 카드 CSS와 게임 JS를 HTML과 분리, 모두 해시 검증하는 완전 오프라인 자산 7종으로 유지. 독립 `solo-offline.html`은 기존 한 파일 그대로. 실행기 구형 5종/신형 7종 동시 검증 및 실제 v176 → v177 → v176 오프라인 업그레이드·롤백 PWA11/11. 타입, 전체707/707, 렌더59/59, HTML2/2, 웹빌드·로컬 배포 검증. E2E 시나리오 갱신, 브라우저 실기 미실행. 기존 AI/카드/엔진/저장 스키마 불변. 정각 자동 진행 OFF 유지. 다음: 압축/저장 증빙 후 카드 그림 로딩 성능 점검.

## 최신 검증 체크포인트 — v0.176.0 (2026-11-23 11:52 KST)

전투 자막의 개별 만료 타이머를 가장 빠른 자막 기준 단일 타이머로 통합, 새 자막은 원래 노출 기한 유지, 오래된 자막 제거 시 중복 낭독 최소화(aria-relevant additions). 대사 효과/음성 큐 및 공개 정보 규칙 유지. 타입, 전체707/707, 렌더59/59, 실제 이전판 PWA11/11, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실기 자막/스크린리더 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 설치형 PWA를 작은 HTML+별도 해시검증 게임 JS로 분리해 초기 문서 부담 완화, 독립 HTML 그대로 보존.

## 최신 검증 체크포인트 — v0.175.0 (2026-11-23 11:51 KST)

기기 AI 동작·저장·재대전 명령 12초 지연 시 입력 잠금 유지, 중복 명령 금지, 늦게 도착한 현재 요청 응답만 잠금 해제(비동기 AI 화면 제외). 사용자가 확인한 경우에만 작업 스레드를 종료하고 마지막 저장본 재조회; 미확인 행동 손실 안내. 타입, 전체707/707, 복구7/7, 렌더58/58, 실제 이전판 PWA11/11, HTML2/2, 웹빌드·로컬 배포 검증 통과. 브라우저 E2E 작성·실기 미실행. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 전투 자막 만료 타이머 통합 및 모바일 부담 완화.

## 최신 검증 체크포인트 — v0.174.0 (2026-11-23 11:48 KST)

오프라인 패치 활성화 시 메타데이터로 확인된 직전 활성 캐시만 정리, 다른 대기/설치 캐시와 식별 불가 레거시 유지. 동일 릴리스 기존 파일은 해시 재검증 후 오프라인 재설치 가능, 오류 시 정상 파일 보존, 손상 파일만 복구. 기존 게임 IndexedDB/스키마 무변경. 타입, 전체706/706, 렌더58/58, PWA11/11(실제 v173 업그레이드·롤백 포함), HTML2/2, 웹빌드·로컬 배포 검증. 실제 브라우저 미확인. 카드/AI/엔진 불변. 정각 자동 진행 OFF. 다음: 응답 지연된 로컬 작업 중 중복 동작 방지와 명시적 저장 복구.

## 최신 검증 체크포인트 — v0.173.0 (2026-11-23 11:45 KST)

취소된 터치의 지연 합성 클릭 차단 유지, 독립적인 실제 키보드/보조기기 활성화(detail 0, trusted, 비포인터)만 즉시 허용. 키 입력으로 오래된 포인터 차단 해제하지 않음. 우클릭으로 효과 선택 취소 시 원래 카드 포커스 복귀. 타입, 전체706/706, hover9/9, 렌더58/58, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 혼합 입력 E2E 갱신(실기 미실행). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: PWA 활성화 중 다른 대기/설치 캐시 보호.

## 최신 검증 체크포인트 — v0.172.0 (2026-11-23 11:43 KST)

자동 FX 품질에서 연속 느린 프레임 압력을 다음 큐에 8초간 유지(다음 캔버스 DPR/밀도/프레임 감소), 안정되면 자동 복귀, 수동 설정/동작 감소 우선. 캔버스 미지원 시 RAF 미실행(기존 영향 타이밍·음향·진동 보전), 축소 동작/애니메이션 미지원 불필요 복제 제거. 타입, 전체705/705, FX45/45, 렌더58/58, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기 FPS 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 취소한 터치의 합성 클릭만 차단하고 독립 키보드/접근성 활성화 허용.

## 최신 검증 체크포인트 — v0.171.0 (2026-11-23 11:41 KST)

음소거/볼륨 0/방 이탈 시 예약 음원과 하위 오디오 그래프 전부 취소·해제, 중복 해제 방지, 32개 동시 음원 상한. 볼륨 0 불필요 오디오 활성화 금지. 카드책 비탐색 키의 불필요 레이아웃 측정도 제거. 타입, 전체704/704, FX44/44, 렌더58/58, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실기 음향 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 자동 FX 프레임 압력 적응 유지 및 2D 캔버스 미지원 안전 처리.

## 최신 검증 체크포인트 — v0.170.0 (2026-11-23 11:39 KST)

덱 편집기/컬렉션 카드책에서 실제 반응형 배치 기준 방향키·Home/End 탐색. 카드 추가·읽기 동작과 분리, 페이지 전환 화면 읽기 프로그램 안내. 타입, 전체704/704, 시각 모델5/5, 렌더58/58, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. PC/모바일 E2E 추가(실기 미실행). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 음소거/0볼륨/대전 이탈 시 예약된 오디오 그래프 완전 정리.

## 최신 검증 체크포인트 — v0.169.0 (2026-11-23 11:37 KST)

기기 AI 작업 스레드 중단/시작 실패 시 마지막 저장 경기 자동 재확인, 실패한 조회로 이전 확인 기록을 삭제하지 않음, 재확인 중 이어하기·삭제 제한, 조회 실패 시 마지막 확인 기록/이어하기 재시도 구분. 기존 저장 강제 덮어쓰기 없음. 타입, 전체703/703, 복구6/6, 렌더57/57, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 작업 스레드 오류 복구 E2E 추가(실기 미실행). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 덱 편집·컬렉션 반응형 카드책 키보드 이동.

## 최신 검증 체크포인트 — v0.168.0 (2026-11-23 11:34 KST)

내 효과/덱 카드 선택창에 모달 의미, 배경 inert, 활성 버튼만 순환하는 Tab/Shift+Tab, Escape/취소 후 원래 카드 포커스 복구. 강제 선택 중 저장 후 나가기와 일반 나가기 허용, 상대 선택/연결 끊김에는 배경 잠금 없음. 타입, 전체702/702, 액션19/19, 렌더57/57, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 브라우저 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 로컬 작업 실패 시 저장소 재확인 및 복구 안내.

## 최신 검증 체크포인트 — v0.167.0 (2026-11-23 11:30 KST)

키보드로 카드/공격/영웅능력/선택/턴 종료를 승인한 뒤 실제 입력 가능 시 기존 합법 출처 또는 다음 손패·공격원·턴 종료로 포커스 복귀. 사용자의 포인터/Tab/다른 포커스/창 이탈 시 자동 복귀 취소. 기존 명시적 승인 및 포인터 동작 유지. 타입, 전체701/701, 액션18/18, 렌더56/56, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. E2E 갱신(실제 브라우저 미실행). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 효과 선택/덱 카드 선택 모달 포커스 제한 및 취소 복귀.

## 최신 검증 체크포인트 — v0.166.0 (2026-11-23 11:27 KST)

선택 없는 손패/전장 행에서 방향키/HOME/END로 실제 카드와 하수인 사이 탐색, 비활성 카드도 조회 가능. 손패 키보드 활성화 시 명시적 내기 버튼으로 포커스 이동, 두 번째 명시적 확인 전 마나/카드 불변, Escape 원래 카드로 복귀. 기존 합법 대상 탐색 우선 및 포인터 동작 유지. 타입, 전체700/700, 렌더56/56, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증. 브라우저 E2E 작성(소켓 제한으로 미실행). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 키보드 행동 종료 후 원래/다음 합법 조작으로 포커스 복귀.

## 최신 검증 체크포인트 — v0.165.0 (2026-11-23 11:24 KST)

최근 전투 결과에 기존 하수인 행동 전 왼쪽부터 배치 번호, 신생 하수인 행동 후 번호 표시. 동일 이름 및 사망 후 밀린 위치 구분, 강화 시 실제 공격/최대 체력 변화, 변신 후 공개 카드명 표시. 공개 스냅샷만 사용, 실제 피해 및 비밀 정보 보호 유지. 타입, 전체700/700, FX44/44, 렌더55/55, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 키보드 손패/전장 빠른 이동과 명시적인 내기 버튼 포커스.

## 최신 검증 체크포인트 — v0.164.0 (2026-11-23 11:21 KST)

재생 중 전장 스크롤 발생 시 오래된 공간 이동/복제 연출 취소, 실제 가시 대상 앵커를 다음 페인트에서 갱신해 숫자/가려짐 표시 재계산. 사라진 대상의 옛 좌표 사용 금지, 크기 변경 시 기존 캔버스 정리. 피해·엔진·연출 승인 타이밍·음향/진동 유지, 리스너/옵저버 해제, 화면 밖 표시 안정 시 캐시. 타입, 전체699/699, FX43/43, 렌더55/55, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 전투 기록 동일 카드 위치 및 실제 스탯/변신 정보.

## 최신 검증 체크포인트 — v0.163.0 (2026-11-23 11:19 KST)

가로 스크롤로 부분 가시인 하수인의 FX 앵커를 실제 가시 교차 영역으로 제한, 완전히 가려진 대상은 행 가장자리 방향·고유 대상 수 표시. 가려진 하수인 복제 연출 및 잘못된 숫자 위치 제거, 실제 수치·대상은 기존 전투 기록 유지. 소환 예상 위치도 스크롤 범위 반영. 타입, 전체697/697, FX41/41, 렌더55/55, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기 미확인. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 재생 중 전장 스크롤/리사이즈의 앵커 갱신과 오래된 공간 연출 정리.

## 최신 검증 체크포인트 — v0.162.0 (2026-11-23 11:16 KST)

전투 상단에는 즉시 효과음 끄기만 두고 효과음 볼륨/대사 음성/자막/연출 품질/진동을 하나의 설정 메뉴에 모아 작은 화면 세로 공간을 확보. 스크롤 제한 메뉴, 44px 터치 대상, Escape 닫기/요약 포커스 반환. 동일 브라우저 설정 키 보존. 타입, 전체695/695, 렌더55/55, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 모바일 E2E 갱신(실제 브라우저 소켓 차단). 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 가로 스크롤 전장 FX 앵커, 클리핑 및 가려진 효과 안내.

## 최신 검증 체크포인트 — v0.161.0 (2026-11-23 11:13 KST)

로컬 대전의 저장 확인 중/완료/실패 상태 구분 및 현재 경기의 실제 마지막 저장 시각 표시. 저장이 확인되지 않은 로컬 경기에서만 브라우저 beforeunload 경고 요청, 저장된 경기·온라인 대전에는 경고 없음(브라우저 지원에 따름). 오프라인판 AI 오류에 서버 선택 대신 저장소/브라우저 안내. 타입, 전체695/695, 렌더54/54, 세션5/5, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 브라우저 미검증. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 설정 컨트롤 통합 및 좁은 화면 가독성.

## 최신 검증 체크포인트 — v0.160.0 (2026-11-23 11:11 KST)

저장 오류가 일시적이고 기존 쓰기 소유권이 있는 경우 대전 화면을 유지한 채 저장 재시도 가능. 성공 시 동일 경기/리비전, 이미 복구된 경우 중복 쓰기 없이 응답, 타 탭 소유권 변경 후 재획득 금지. 이전 `저장 재시도 후 나가기` 유지. 조작 잠금 시 리비전 변경 없이도 드래그·캡처·자동 스크롤 정리. 타입, 전체694/694, 렌더53/53, 로컬 저장32/32, 실제 이전판 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기·브라우저 미검증. 카드/AI/엔진/저장 스키마 불변. 정각 자동 진행 OFF. 다음: 저장되지 않은 경기에서 의도치 않은 새로고침 경고, 오프라인 오류 안내.

## 최신 검증 체크포인트 — v0.159.0 (2026-11-23 11:09 KST)

하수인 선택 시 2개 이상 배치 틈의 번호와 양옆 카드 이름을 표시하는 네이티브 선택 메뉴 추가. 좁은 화면/터치에서 44px 높이, 키보드도 사용 가능. 해당 슬롯으로 가로 스크롤하고 이미 대상을 선택 중인 하수인도 같은 위치를 실제 승인 명령까지 유지. 이동은 카드 사용 없이 상태만 변경. 전체693/693, 렌더52/52, 실제 이전판 PWA9/9, HTML2/2, 타입·웹빌드·로컬 배포 점검 통과. 실제 기기 미확인. 카드/AI/엔진 불변. 정각 자동 실행 OFF 유지. 다음: 저장 실패 시 경기 종료 없이 재시도, 입력 잠금 개선.

## 최신 검증 체크포인트 — v0.158.0 (2026-11-23 11:06 KST)

정각 자동 실행에서 저장된 미검증 후보의 좁은 화면 전장 CSS를 원본 Git에 통합. 660px 이하에서 양쪽 하수인 행의 가로 스크롤 및 안전한 중앙 정렬 복원, 네이티브 가로 터치 이동 지원, CSS 회귀 검사 2개 전체 검사에 추가. 타입, 전체692/692, 렌더51/51, 실제 v0.157→v0.158 PWA9/9, HTML2/2, 웹 빌드·로컬 배포 점검 통과. 실제 브라우저·기기 검증은 미실행. 카드/AI/엔진 원본 불변. 11:02 KST 사용자가 정각 자동 진행 OFF 및 직접 2시간 개발을 요청하여 자동 실행 비활성화 완료. 다음: 넓은 선택 컨트롤로 하수인 배치 위치를 안전하게 변경.

## 최신 검증 체크포인트 — v0.157.0 (2026-11-23 10:59 KST)

넘치는 아군 전장에 하수인 카드를 터치 드래그할 때 가시 가장자리 24px 이내에서 140ms 유지하면 가까운 방향으로 점진적 자동 스크롤. 스크롤 범위 및 프레임 시간 제한, 중앙/전장 밖/끝 도달/취소/리비전 변경/숨김/화면 해제 시 즉시 중단. 움직인 뒤 실제 보이는 배치 슬롯과 드롭 피드백 재계산. 타입, 전체690/690, 렌더51/51, 실제 v0.156→v0.157 PWA9/9, HTML2/2, 웹 빌드·로컬 배포 검증 통과. 기하 및 취소 관련 자동 검사, 실제 브라우저·음향·FPS는 소켓 제한으로 미검증. 카드/AI/엔진 원본 불변. 다음: 좁은 화면 배치 버튼 선택·키보드/터치 피드백, 전장 HUD 가독성 및 오프라인 저장 품질. 사용자 10:41~12:41 두 시간 개발 요청, 11시 및 12시 정각 자동 실행에서 최신 검증판으로 이어 개발.

## 최신 검증 체크포인트 — v0.156.0 (2026-11-23 10:56 KST)

전장 가로 스크롤 가능 여부를 실제 CSS overflow, 가시/전체 너비로 판정하고 화면·리비전·자식 크기 변경 시 재측정한다. 넘치는 아군 전장에서만 하수인의 가로 터치 이동은 네이티브 스크롤, 세로 이동은 공격 드래그, 방향 전환 후에도 스크롤은 드롭하지 않음. 양쪽 넘치는 전장에 좌우 이동 힌트. 타입, 전체689/689, 렌더51/51, 실제 v0.155→v0.156 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 리사이즈 브라우저 E2E 작성(소켓 제한으로 미실행). 카드/AI/엔진 불변. 다음: 하수인 카드를 드래그하며 실제 가시 전장 가장자리에서 자동 스크롤, 모호/취소 시 안전 정리. 기존 정각 재개 및 10:41~12:41 개발 요청 유지.

## 최신 검증 체크포인트 — v0.155.0 (2026-11-23 10:54 KST)

실제로 승인될 드래그 명령의 대상 이름·내/상대·동일 하수인 구분 위치를 상태 메시지에 표시, 하수인 효과 배치 위치도 함께 표시. 유효하지 않은 드롭에 대상 이름을 표시하지 않음. 선택된 손패 카드 재터치 시 보유/대상 지정/효과 선택을 일관되게 취소, 기존 명시적인 내기 확인 유지. 모바일 키보드 안내 숨김. 타입, 전체688/688, 렌더51/51, 실제 v0.154→v0.155 PWA9/9, HTML2/2, 웹빌드·로컬 배포 검증 통과. 실제 기기/오디오/FPS는 미검증. 데이터·엔진 불변. 다음: 가로 스크롤이 필요한 전장에서 공격과 스크롤 제스처 명확히 분리, 좁은 전장 가독성. 10:41~12:41 개발 및 기존 정각 재개 유지.

## 최신 검증 체크포인트 — v0.154.0 (2026-11-23 10:51 KST)

좁은 전장의 대상 지정 중 선택적으로 열 수 있는 합법 대상 목록 추가. 44px 이상 버튼에 내/상대, 영웅 생명력/방어도 또는 하수인 공격/체력/전장 위치를 표시, 중복 카드 구분. 직접 클릭과 동일한 공개 대상 판정 및 승인 경로, 드래그에는 목록 미노출하고 선택/리비전 변경 시 닫힘. 타입, 전체686/686, 렌더51/51, 실제 v0.153→v0.154 PWA9/9, HTML2/2, 웹 빌드 및 로컬 배포 점검 통과. 모바일 E2E 추가 작성(소켓 권한 차단으로 미실행). 카드/AI/엔진 데이터 불변. 다음: 드래그 대상 이름 및 배치 피드백, 카드 재선택 취소 일관성, 작은 화면 가독성. 사용자의 10:41~12:41 개발 요청과 기존 정각 자동 재개 유지.

## 최신 검증 체크포인트 — v0.153.0 (2026-11-23 10:48 KST)

대상 지정 중 방향키로 합법 대상만 순환 탐색, Home/End 처음·마지막 대상, Enter/Space 기존 명시적 확정. 키보드로 카드 내기/효과를 선택하면 첫 합법 대상 또는 효과 버튼에 포커스, Esc는 취소 후 원래 카드·공격원·영웅 능력에 복귀. 마우스/터치 포커스 및 기존 선택/드래그 판정 유지. 타입, 전체685/685, 렌더50/50, 실제 v0.152→v0.153 PWA9/9, HTML2/2, 웹 빌드·로컬 배포 점검 통과. 키보드 브라우저 E2E 시나리오 보강(소켓 권한 차단으로 미실행). 카드/AI/엔진 원본 불변. 다음: 밀집 전장에서 넓은 합법 대상 선택 목록과 모바일 가독성, 피드백 개선. 새 모드/온라인/장시간 학습 보류.

## 최신 검증 체크포인트 — v0.152.0 (2026-11-23 10:45 KST)

v0.151 ZIP 및 원본 Git 이력 복구, Node24 npm 의존성 재설치. 터치 드래그 공격/대상 주문에만 명확한 가시 대상 10px 이내 보정, 두 후보 거리 차가 4px 미만이거나 가장 가까운 대상이 불법이면 보정 없음. 직접 맞춘 대상·조작 버튼·손패·하수인 배치·마우스 드롭의 기존 판정 유지. 실제 실행될 드롭 대상을 유효 후보들과 다른 실선으로 표시, 드래그 종료/취소/이탈 시 제거. 타입, 전체684/684, 렌더50/50, 실제 v0.151→0.152 PWA9/9, HTML2/2, 웹 빌드 및 로컬 배포 검증 통과. Chromium 터치 E2E 두 건은 소켓 권한 제한으로 실행 전 차단. 실제 음질/FPS/물리 기기 미검증. 카드/AI/엔진 원본 불변. 다음: 키보드 대상 탐색 및 밀집 전장 터치 가독성, 피드백/접근성. 새 모드/온라인/장시간 AI 학습 보류.

## 최신 검증 체크포인트 — v0.151.0 (2026-11-23 10:37 KST)

하수인/영웅의 공격 및 대상 지정형 영웅 능력을 같은 입력원에서 재선택하면 취소되고, 다른 공격원 선택은 즉시 전환한다. 이미 유효한 효과 대상은 기존 대상 처리 우선, 비대상 영웅 능력 즉시 사용 유지. 입력원의 접근성 눌림 상태와 실제 대상 설명을 구분. 모바일 영웅 능력 재탭 E2E 추가(실기 미확인). 타입, 전체683/683(동시 빌드 중 기존 HTTP/AI 워커 시간 초과 2건은 단독 전체 재실행에서 모두 통과), 렌더50/50, 실제 v0.150→v0.151 PWA9/9, HTML2/2, 웹 빌드와 로컬 배포 사전 검증 통과. 카드/AI/엔진 원본 불변. 다음: 전장 선택/대상 키보드 및 모바일 가독성, 과밀 화면의 터치 목표 크기와 피드백, 실기 가능 환경 검증. 새 모드/온라인/장시간 학습 보류.

## 최신 검증 체크포인트 — v0.150.0 (2026-11-23)

가시 범위 밖으로 잘린 배치 슬롯을 제외하고 부분적으로 보이는 슬롯의 가시 부분 중앙을 기준으로 가까운 위치를 판정한다. 유효 가시 슬롯이 하나도 없으면 하수인 드롭을 거부한다. 대상/선택형 하수인의 배치 위치를 표시와 실제 행동에 동기화하고, 효과 대상 선택 도중 슬롯 변경 가능, 선택 상태에서 배치 번호 안내, 새 revision/연결 상태에서 기본 끝 배치로 초기화. 타입, 전체 682/682, 렌더49/49, 실제 v0.149→v0.150 PWA9/9, HTML2/2, 웹 빌드·로컬 배포 사전 점검 통과. 모바일 탭 E2E 보강(실기 미확인). 카드/AI/엔진 불변. 다음: 조작 가독성/선택 취소와 전장 과밀 화면 개선, 물리 기기 실기 가능한 환경에서 검증. 새 모드/온라인/추가 장시간 학습 보류.

## 최신 검증 체크포인트 — v0.149.0 (2026-11-23)

승인된 행동의 명시적 사망은 묵직한 하강음, 손패 복귀 등 명시적 비사망 이탈은 가벼운 상승음으로 분리했다. 불명확한 이탈은 추가 음향을 재생하지 않으며, 복수 이탈 시 사망을 우선해 한 번만 재생한다. 즉시·빠름·일반 속도의 공통 분류 및 숨김 시 예약 WebAudio 중지 유지. 타입, 전체 680/680, 렌더49/49, PWA9/9, 독립 HTML2/2, 웹 빌드 및 로컬 배포 점검 통과. 카드/AI/엔진 데이터 불변. 실제 음향·모바일/PC 조작은 미검증. 다음: 좁은 화면에서 드래그 배치 슬롯의 가시 영역 정확성, 카드 선택 및 배치 조작 개선. 새로운 모드/온라인/장시간 AI 학습 보류.

## 최신 검증 체크포인트 — v0.148.0 (2026-11-23 10:21 KST)

모바일 화면 전환·탭 숨김·PC 창 포커스 상실·pagehide에서 미완료 드래그와 손패 선택, 카드 미리보기, 조준선·배치 슬롯 강조를 모두 취소. 전장이 보유한 터치 포인터를 안전하게 해제하고, 지연된 이전 pointerup/합성 click은 방지하며 새 물리 입력은 즉시 가능. 취소가 실제 카드·마나·턴을 바꾸지 않도록 기존 승인 경로 유지. 새 터치 가드 단위 테스트 및 CDP 모바일 드래그 중 blur→옛 pointerup→새 드래그 E2E 시나리오 추가. 타입 검사, 전체 679/679, 렌더49/49, 실제 v0.147→v0.148 PWA9/9, 독립 HTML2/2, 웹 빌드 및 로컬 배포 검증 통과. 실제 Chromium 실행은 이전 v0.144 시험에서 소켓 권한 제한으로 시작 차단, 신규 E2E 실기 미실행. 카드 382종/AI 원본·규칙·저장 스키마 불변. 다음: 카드 선택/배치·스크롤 등 작은 화면 실전 UI 품질, 사망/이탈 음향 구분, PC·모바일 물리 기기 및 실제 소리/FPS 확인. 기존 외부 학습 도구를 제외한 장시간 AI 학습/온라인 계정/PvP/배포 보류. v0.121 전체 Git bundle 및 7f011af 기반 최신 누적 증분으로 원본 이력 보존. 매시간 가장 최신 완전 검증 ZIP/Git에서 이어서 개발.

## 최신 검증 체크포인트 — v0.147.0 (2026-11-23 10:18 KST)

하수인 직접 소환 시 카드 시각 테마와 일치하는 10개 합성 음향(금속·불·얼음·번개·비전·그림자·신성·자연·금화·모래)을 구현. 공통 착지음, 테마별 고유 음색/상승·하강/질감, 최대 5개 음향 레이어 및 0.5초 내 재생, 기존 음량 설정·오프라인·백그라운드 중지 연동. 주문으로 발생하는 복수 소환에 별도 과도한 음향을 중첩하지 않음. 실제 음향 청취/음질은 미검증이며 성우 음성 아님. 타입 검사, 전체 678/678, 렌더49/49, 실제 v0.146→v0.147 PWA9/9, 독립 HTML2/2, 웹 빌드 및 로컬 배포 점검(225 합법 AI 덱) 통과. 이전 전투·카드·AI·저장 데이터 원본 보존. 다음: 사망과 비사망 이탈의 음향을 안전하게 구분하고, 전장 카드 선택/배치의 UI 반응 및 작은 화면 가독성 개선, 물리 기기가 가능한 환경에서 조작·오디오·FPS 실기. 매시간 최신 검증판에서 재개.

## 최신 검증 체크포인트 — v0.146.0 (2026-11-23 10:16 KST)

화면이 숨겨지면 진행 중 및 대기 중 시각 연출 타이머를 비우고 최신 승인 상태로 즉시 이동한다. 숨은 탭의 후속 상태는 순서대로 갱신하되 오래된 revision은 거절하며, 복귀 시 새 행동만 정상 연출. 캔버스·말풍선·지연 음성·진동·WebAudio 예약 소스를 중지하여 이전 효과가 복귀 후 재생되지 않도록 한다. 사용자 음량·대사 설정 및 게임/저장 상태 불변. 타입 검사, 전체 677/677, 렌더49/49, 실제 v0.145→v0.146 PWA9/9, HTML2/2, 웹 빌드 및 로컬 배포 사전 검증 통과. 가상 시계 및 모의 음성 장치 검증; 실제 모바일 앱 전환/PC 브라우저·음향·FPS 실기 필요. 다음: 테마별 소환 음향 차별화와 타격감/접근성 개선, 최신 검증본에서 이어 개발.

## 최신 검증 체크포인트 — v0.145.0 (2026-11-23 10:12 KST)

밀집 전장의 효과 렌더 루프 최적화. 승인된 행동마다 동일 입자 난수·각도·삼각함수·초기 크기를 캐시하고 품질 자동 저하 시 같은 입자 배열의 앞부분만 사용. 피해 레이블 그룹 및 배치를 최초/앵커가 변화할 때만 계산하며 새 하수인 DOM이 나타날 때까지 최대 6번 위치를 재확인한다. 기존 배치·입자 수·시간·실제 피해값 보존. 120번 반복 프레임에서 배열 재사용, 앵커 변화와 입자 수 변경 동등성 테스트 추가. 타입 검사, 전체 676/676, 렌더 49/49, 실제 v0.144→v0.145 PWA 9/9, 독립 HTML 2/2, 웹 빌드 통과. 실제 FPS·전력·오디오·물리 PC/모바일 성능 미측정. 카드·AI 원본 불변. 다음: 백그라운드 탭/앱 전환 중 불필요한 전투 연출·음성 대기열 정리 및 최신 상태 즉시 복귀, 실기 수용 검증.

## 최신 검증 체크포인트 — v0.144.0 (2026-11-23 10:09 KST)

v0.144 후보를 v0.143 전체 검증 ZIP에서 복원하고 v0.121 전체 Git 번들 및 v0.143 증분을 통해 원본 이력 `de6cbbc`에 다시 연결했다. 실제 소환 카드의 시각 테마, 양측 주문/죽음의 메아리에서 복수 하수인의 공개 카드별 고유 색상과 실제/예상 배치 슬롯을 사용한다. 명시적 사망만 죽음 처리하며, 불명확한 이탈은 중립적인 이탈로 처리한다. 타입 검사, 전체 674/674, 렌더 49/49, 실제 v0.143→v0.144 PWA 업데이트/롤백 9/9, 독립 HTML 2/2 통과. Chromium 모바일/PC 드래그 테스트는 실행 단계에서 소켓 권한 제한으로 중단(실기 미검증). 카드·AI·엔진 데이터 불변. 다음: 전투 효과 렌더 루프 최적화, 실제 FPS/오디오/모바일 조작 검증 가능한 환경에서 수행. 게임 정상 AI 및 독립 학습 프로그램 유지.

## 최신 검증 체크포인트 — v0.143.0 (2026-11-23 09:44 KST)

전장 아래 펼칠 수 있는 최근 전투 결과 패널 추가. 정상/빠른/즉시 연출에서 화면에 적용된 연속 승인 revision만 기록, 최신 대상별 결과 한 줄 및 추가 결과 개수, 최근 5개 행동의 대상별 피해/회복/방어도/보호막/연타/소환/사망/이탈/능력치 변화/변신/빙결/차단 표시. 음성이나 캔버스 연출에 의존하지 않는 읽기 가능한 HTML, 44px 모바일 터치 및 aria-live 요약. 미발동 비밀 및 숨은 카드 명칭 기록 금지, 저장/재연결/새 경기/누락 revision에서 이전 효과 재생 금지. 별도 영구 데이터 추가 없음. 타입, 전체671/671, 렌더49/49, 실제 v0.142→v0.143 PWA9/9, HTML2/2, 웹 빌드·배포 검증 통과. 카드 및 AI 원본 불변. 다음: 카드 등장/사망 시각 효과의 주제별 구분 및 그래픽, 저사양 성능, 실제 모바일/PC 브라우저 환경 검증. 사용자의 외부 AI 학습 프로그램 및 기존 저장 방식 유지. 매시간 정각 최신 검증본에서 계속 개발.

## 최신 검증 체크포인트 — v0.142.0 (2026-11-23 09:40 KST)

밀집 전장의 피해 레이블을 대상별 가로 경계로 분리, 화면 너비 및 인접 대상 위치에 따라 글자 폭·크기 제한. 연타/피해/회복/방어도/보호막 동시 결과는 세로로 정렬하고 화면 상하 경계 및 떠오르는 애니메이션 범위를 보정. 좁은 영역 보호막 축약 표시, 색상 유지. 320px 폭 7하수인 동시 피해 및 화면 끝 5개 혼합 레이블 테스트. 타입, 전체670/670, 렌더48/48, 실제 v0.141→v0.142 PWA9/9, HTML2/2, 웹 빌드·로컬 배포 점검 통과. 카드·AI·엔진 원본 변경 없음. 실제 기기 캔버스 가독성은 별도 확인 필요. 다음: 화면에서 실제 전투 결과를 놓치지 않는 접근성/최근 결과 표시, 카드 등장·사망 연출 및 성능 개선. 매 회 가용 시간 최대 활용, 여러 기능을 구현·검증·백업하고 다음 단계 자동 진행.

## 최신 검증 체크포인트 — v0.141.0 (2026-11-23 09:37 KST)

전투 연출 품질 자동/절전/풍부 설정. 자동은 모바일/저코어 예산 유지 및 연속 50ms+ 지연 3회 시 파티클 밀도 60%·30fps 제한으로 적응. 절전은 80만 픽셀/최대 DPR 1.1/35% 파티클, 풍부는 지원 기기에서 모바일 최대 180만 픽셀·DPR1.75, 데스크톱 320만 픽셀·DPR2 및 파티클 125%. 저코어와 움직임 감소 안전한도는 풍부 설정에서도 준수, 실제 적용 시점·피해 숫자·게임 규칙은 동일. 새 로컬 설정 저장. 타입, 전체669/669, 렌더48/48, v0.140→0.141 PWA9/9, HTML2/2 및 빌드·배포 검증. 실기 프레임 개선 수치는 미검증. 다음: 밀집 전장의 피해/방어/연타 레이블 가독성 및 화면 경계 보정, 그래픽과 성능 향상.

## 최신 검증 체크포인트 — v0.140.0 (2026-11-23 09:34 KST)

기본 꺼짐의 모바일 전투 진동 설정·미리 체험. 지원되는 터치 기기에서만 승인된 전투 효과(일반/강한 체력 피해, 방어도 및 보호막, 반복 타격, 자기 소환)별 짧은 진동, 240ms 재시작 제한, 비활성 기기/숨은 페이지에서 호출 안 함. 즉시/일반 연출 모드 공통 사용, 설정 저장 및 종료시 취소. 게임 규칙·저장 상태·카드/AI 데이터 변경 없음. 타입, 전체 668/668, 렌더48/48, 실제 v0.139→0.140 PWA9/9, HTML2/2, 웹 빌드·배포 검증. 물리 진동 실기 미확인(모바일 대전 진동 API 호출 E2E 추가). 다음: 저사양 대비 연출 품질 설정 및 화면 가독성, 계속 실제 개선/검증·백업.

## 최신 검증 체크포인트 — v0.139.0 (2026-11-23 09:31 KST)

PC HTML drag/drop과 모바일 pointer drag의 판정·가까운 배치 슬롯·미리보기/드롭을 공통 `pointerDrop`으로 통합. 마우스도 아군 하수인 사이 정확한 배치 위치 선택, 카드/대상 추가 선택/효과 선택/불가능/취소 메시지와 색상 표시. 손패 또는 일반 UI 컨트롤에 놓아도 실제 행동 없음. 기기 입력·게임 규칙/저장/카드/AI 원본 불변. 타입, 전체 667/667(382카드 2207개 공개 인터페이스 액션 검증 포함), 렌더48/48, 실제 v0.138→v0.139 PWA9/9, HTML2/2, 웹 빌드 및 배포 검증 통과. PC native drag와 모바일 실제 터치 E2E 추가, Chromium 소켓 권한 실행 전 제한. 다음: 모바일 선택형 진동 피드백 및 타격/전장 시각효과 개선, 저사양 최적화, 계속 다음 개선 개발.

## 최신 검증 체크포인트 — v0.138.0 (2026-11-23 09:27 KST)

전투 중 대사 설정 메뉴 추가: 모든 대사/감정표현만/끄기 선택, 대사 볼륨 독립 조절, 로컬 한국어 음성 수 표시(클라우드 제외), 내 영웅 인사 음성 미리듣기, 음소거·미지원·요청 실패 안내. 기존 마스터 효과음 설정 연동, 대사 볼륨 0이면 대기·재생 취소. 두 신규 로컬 설정 키는 기존 저장/패치와 독립이며 기본값 기존 동작 유지. 자막 설정은 음성/실제 게임 규칙과 분리. 모바일 상세 설정 시 44px 터치 영역. 검증: 타입, 전체 665/665, 렌더48/48, v0.137→v0.138 PWA 9/9, 독립 HTML2/2, 웹 빌드·배포 검증. 실기 E2E는 추가했으나 권한 제한 미확인. 카드·AI 및 게임 엔진 원본 변경 없음. 다음: PC와 모바일 하수인 배치 판정을 일치시키고 드래그 가능/불가 위치 시각 및 안내 강화, 이어서 그래픽과 타격감.

## 최신 검증 체크포인트 — v0.137.0 (2026-11-23 09:24 KST)

09시 방어도 연출 후보(b72bb68)를 복원·검토하고 원본 Git 이력에 기능을 재구현하여 통합 검증. 공개 전투 시각 trace에 선택적 `armorAbsorbed` 메타데이터만 추가(게임 규칙/상태 저장 불변). 순수 방어도 타격 금속음·금색 감소 표시, 혼합 피격 금속음+체력 피해 표시, 실제 반복 타격 수와 제한된 추가 충돌음, 전투 대사 거짓 피격 제거. 구형 trace/영웅 변신 호환. 23종 전설 카드에 4단계 전용 대사 92개 추가, 공격·피격·사망 속도와 음높이 차별화, 기기 내 한국어 TTS 여러 개 설치 시 카드/영웅별 고정 목소리 할당. 카드·영웅 초상화와 상황별 테두리로 말풍선 시각 개선, 비밀 정체 숨김. 음성은 로컬 TTS이며 실제 성우 녹음이 아님.
검증: 타입, 전체 664/664, 렌더 47/47, 실제 v0.136→v0.137 PWA 업그레이드/롤백9/9, 독립 HTML2/2, 웹 빌드 및 배포 검증. 카드/기존 AI 데이터 변경 없음. 실제 모바일 감정표현 및 PC 조작 E2E는 Chromium socket 권한 제한으로 실행 전 차단. 다음: 전투 입력을 막지 않는 대사 표시 설정 및 로컬 음성 미리듣기, 상황별 음향 피드백, 모바일/PC 화면 가독성과 성능 개선. 매 회 가용 시간 최대 활용, 한 단계 종료 후 다음 구현 착수하고 종료 전 체크포인트 보존.

## 최신 검증 체크포인트 — v0.136.0 (2026-11-23 08:48 KST)

오전 8시 자동 실행의 드래그 시인성 후보를 검토하여 통합. 모바일 하수인 배치 슬롯에 실제 `data-drop-position`을 부여하고 터치가 아군 전장에 있으면 가장 가까운 유효 슬롯을 계산하여 이동 중 강조 및 놓는 순간 동일 위치 사용. 이전 클릭 선택 위치에 잘못 배치되는 문제 수정. PC/모바일 드래그 대상·아군 전장 황금색 점선, 드래그 카드 그림자, 가까운 배치 위치 강조. 슬롯 폭을 일정하게 유지하여 강조로 인해 하수인이 밀리지 않도록 함. 기존 목표/턴/취소 검증 및 움직임 감소 옵션 유지. 카드·AI·엔진 원본과 저장 형식 변경 없음.
검증: 타입 검사, 전체 660/660, 렌더 46/46, 실제 v0.135→v0.136 PWA 업그레이드 및 롤백 9/9, 독립 HTML 2/2, 웹 빌드 및 배포 무결성 검증 통과. 카드·AI·AI 배포 데이터의 원본 바이트 비교 일치. 실제 모바일 터치 CDP 재시험은 Chromium의 socket 권한 제한으로 실행 전 차단됨; 실기 확인 필요. 다음 개발 우선순위: 전투 행동별 시각/음향 타격감(방어막·방어도·연속 타격 등의 구별), 이어서 대사/직업별 목소리 개성 및 그래픽. 실제 음성 녹음 파일이나 외부 음성 서비스는 현재 없음. 사용자 중단 요청 전까지 매시간 정각 자동 재개(종료일 없음); 각 실행에서 최신 검증본 확인, 가능한 실제 개발, 검증 및 Git/ZIP 보존.

## 최신 UI 체크포인트 — v0.135.0 (2026-11-23 07:12 KST)

사용자 요청: 카드 사용/공격/피격/사망 대사, 직업 고유 감정표현. `battle-dialogue.ts`에 9직업 × 6종(인사·감사·칭찬·사과·놀람·도발) 고유 대사 54개 및 직업/종족별 전투 말투, 대표 카드 10종 전용 대사. 382종 카드의 공통 대사 모델 및 카드명 표시. 실제 승인된 전투 이벤트, 히트 및 사망 trace를 기반으로 등장/공격/피격/사망 자막과 음성 요청을 재생. 비밀 설치는 카드명 숨김, 보호막/공격 차단/손패 복귀에 거짓 피격·사망 대사 없음. 솔로 감정표현 버튼과 AI 직업별 응답, 3초 제한, 게임 규칙·AI 행동 무변경. `dialogue-voice.ts`는 설치된 로컬 한국어 TTS만 사용, 미지원 환경은 자막만, 음성 독립 설정 및 기존 효과음 음소거/볼륨 준수, 짧고 제한된 음성 큐. 외부 음성 서비스 및 녹음 음원은 없음. 실제 음성 재생·브라우저 실기 검증은 필요.
검증: 타입, 전체 657/657, 렌더45/45, PWA v0.134→v0.135 업그레이드/롤백9/9, 독립 HTML2/2, 웹 빌드 및 데이터 원본 바이트 동일. 모바일 감정표현 E2E 추가(기존 Chromium socket 권한 제한으로 실기 미실행). 이전 07시 자동 실행 v0.134 후보는 동일한 3개 UI 요청의 별도 미검증 구현이며 이미 전체 검증판 v0.134에서 반영됨; 후보로 되돌리지 말 것. 다음: 상황별 더 세밀한 카드 전용 대사·음성 다양화, 실제 모바일/PC 음성 확인, 그래픽·타격감 강화.

## 최신 UI 체크포인트 — v0.134.0 (2026-11-23 07:05 KST)

사용자 요청: 모바일에서도 손가락 드래그로 카드 사용, 카드 도감/덱메이커 설명 잘림 해소, 덱메이커 카드 목록과 내 덱 동시 표시. 터치 implicit pointer capture가 카드→전장으로 이전될 때 자식에서 발생하는 lostpointercapture를 실제 취소와 구분해 드래그를 유지한다. 진짜 pointercancel·캡처 유실·가로 손패 스크롤·오래된 revision은 기존대로 취소. 카드책에서만 카드 프레임을 설명 길이에 따라 세로 확장하고 텍스트를 줄바꿈해 표시. 모바일/태블릿 덱 편집을 좌측 카드 목록·우측 고정 스크롤 덱으로 분할, 실시간 장수/줄바꿈 이름/44px 제거 조작 및 상세 모달. 전투 카드 크기·카드 효과·저장 형식·AI 원본 및 외부 학습 프로그램 불변.
검증: 타입 검사, 전체 653/653, 렌더 44/44, 실제 v0.132→v0.134 PWA 업그레이드/롤백 9/9, 독립 HTML 2/2. 카드/AI 3개 데이터 디렉터리 원본과 바이트 비교 일치. 모바일 실제 터치 CDP와 320/393/768/1280px 레이아웃 E2E를 추가했으나 Chromium socket 권한 제한으로 미실행. 사용자 실기에서 드래그·스크롤·덱 편집을 확인 후 필요 시 조정. 다음 단계: 전장 드래그 목표 시인성·터치 타격감·전투 연출/음향 강화, 실제 PC/모바일 확인.

## 최신 UI 체크포인트 — v0.133.0 (2026-11-23 06:45 KST)

사용자 최신 피드백: UI와 플레이 조작감 우선, 솔로 전투의 선택·드래그·대상 지정·취소·턴 전환의 반응과 정확성에 집중. PC에도 선택 카드 내기 버튼을 노출하고 모바일 선택/취소 터치 높이를 44px로 확대. 기존 드래그와 클릭 선택→명시적 내기 판정 유지. 새 실제 primary pointerdown은 이전 스크롤/드래그의 250ms 합성 클릭 차단을 즉시 해제하고 합성 클릭 자체는 계속 차단. 선택 카드명·가능 대상 수·효과 선택 안내와 라이브 상태를 별도 표시. 타입 검사, 자동 650/650, 렌더 43/43, v0.132 업그레이드/롤백 PWA 9/9, 독립 HTML 2/2. PC·모바일 E2E 보완했으나 Chromium 소켓 권한 제한으로 미실행(실기 미검증). 카드/AI 원본 바이트 동일. 다음: 전투 대상 강조·카드 드래그 취소·입력 피드백을 개선하고, 전장 그래픽/타격감/사운드를 차례로 강화. 외부 학습 프로그램 v0.132은 독립적으로 유지.

## 최신 검증 체크포인트 — v0.132.0 (2026-11-23 06:15 KST)

사용자 최신 우선순위: 외출 중 노트북에서 무기한 자기 대전·오류 재시작·정상 종료·단일 결과 파일 업로드가 가능한 독립 학습 프로그램 최우선. v0.132에 `START-AI-TRAINING.cmd`, `STOP-AI-TRAINING.cmd`, `AI-TRAINING-STATUS.cmd`, `AI-TRAINING-QUICKSTART.txt` 도입. Node24만 필요한 독립 ZIP으로 제공. 30분 주기 재개, 비정상 종료 30초 재시도, 20분 정체 감시 및 3분 유예, 반복 실패 시험/손상 체크포인트 보관 후 정상 챔피언 기반 회복, 중복 실행 금지 및 사용자의 중단 의사 유지. `ai-training-session/AI-TRAINING-RESULT.json`을 매분 및 종료에 저장하고 SHA-256·카드 해시·챔피언/체크포인트 일치 확인. 업로드 후 `ai-training-result.ts` 읽기 전용 확인 및 `benchmark-strength.ts ... file:<path> current`로 독립 비교 후 반영 판단. 실제 학습 실력 상승이나 물리 Windows 노트북 장시간 검증은 아직 확정하지 않음.

이전 야간 v0.127~131 후보 다섯 Git 증분 (`606b61d`~`9ec67cb`)을 원본 이력 그대로 병합했다. 마나 자원 접근성, 덱 분포 읽기, 키보드 포커스, 고대비 및 움직임 감소 개선을 Node24 환경에서 전체 검증. 타입 검사, 자동 649/649 (신규 학습 6개 및 후보 정적 검사 포함), 렌더 43/43, 실제 v0.126 배포 업그레이드/롤백 PWA 9/9, 독립 HTML 2/2. 별도 압축 해제된 학습 전용 ZIP(의존성 없음)에서 실제 6,848→6,852경기, 연속 2주기, 별도 STOP, 결과 검사 및 저단계 비교 실행까지 확인. 카드·기존 AI 학습·배포 원본은 바이트 비교 동일. 기존 로컬 저장 형식·계정/PvP 미변경. 아래 미검증 후보 기록은 역사적 기록으로 보존하며 이 버전의 통합 검증이 우선한다.

다음 단계: 사용자 노트북 실제 학습 결과 수신 시 검증/기존 챔피언과 독립 강도 대전 및 보존 후 게임 반영. 그 전에는 솔로 UI·타격감·이미지·사운드·실기 호환 개선을 이어가되 학습 프로그램의 안정성 결함을 우선한다.

사용자 규칙: `ㄱㄱ` 입력 시 실제 개발하고, 단계 완료 시 다음 단계에 착수한다. 최신 요청에 따라 야간 정각은 중간보고·체크포인트로 사용하고 가능한 계속 개발한다. 작업 시작·구현·테스트·백업 및 전환의 실제 한국시간과 상태를 표시한다. 중단 요청 시 즉시 중단. 실행 환경 제약으로 먼저 종료되면 실제 시각과 미완료 지점을 기록한다. 솔로 AI 대전 우선, 기존 기능/밸런스/AI 데이터 보존, 자동 회귀 검사 및 Git/ZIP 체크포인트 필수. 새로운 대형 모드는 사용자와 합의 후 개발한다.

## v0.130.0 미검증 후보 — 2026-11-23 05시 KST
Windows 고대비 모드(forced-colors)에서 키보드 포커스, 선택 카드, 공격 대상, 준비 상태의 시각적 윤곽을 시스템 Highlight 색으로 유지하도록 CSS 보완. 신규 정적 회귀 2/2 통과(Node22). Node24 없음, npm ci --offline은 xmlhttprequest-ssl 캐시 누락으로 실패. 전체 회귀/타입검사/웹 빌드 미실행. v0.126.0이 마지막 전체 검증 버전. 기존 카드/AI/저장 포맷 불변. 다음은 의존성 확보 후 전체 검증, 실기 고대비/모바일 검증, 전투 효과와 이미지 품질 개선.

## 상태
- **v0.129.0 미검증 후보 (2026-11-23 03:58 KST):** 키보드로 접근하는 커스텀 role=button/option 요소의 focus-visible 테두리를 공통 스타일에 추가. 신규 정적 회귀 1/1 및 v0.128 덱 분포 단위 3/3 통과(Node22 실험적 TS 제거). 전체 테스트/타입검사/웹 빌드는 Node24·npm 의존성 부재로 미실행. v0.126 마지막 전체 검증 버전 유지. 카드/AI/저장 포맷 변경 없음.

- **v0.127.0 미검증 후보 (2026-11-23 01:59 KST):** 마나 자원 영역의 스크린리더 설명에 사용한 마나·잠긴 마나·추가 마나·다음 턴 과부하를 구분해 표시하고 렌더 테스트 기대값을 추가. Node.js 22만 존재하고 의존성 설치가 실패하여 타입 검사/렌더/전체 테스트/빌드 미실행. v0.126.0이 마지막 검증 완료 버전이며 이 변경은 별도 후보로 유지. 기존 AI·카드 데이터 변경 없음. 다음 실행은 Node24 및 의존성 확보 후 검증하거나 기존 검증 버전에서 다른 작업 진행.

- **v0.126.0 개발 후보:** 전투의 실제 턴 소유자와 조작 가능 상태를 분리. 자기 턴에도 행동 처리/효과 재생/카드 선택/연결 대기 중이면 턴 종료 버튼은 기존대로 잠기지만 AI 턴으로 잘못 표시하지 않음. 손패 및 상태 안내도 실제 상황에 맞춤. 타입 검사, 자동 634/634, 렌더 43/43, 실제 v0.125 배포 롤백 포함 PWA 9/9, 독립 HTML 2/2. 모바일/PC 실기 미검증. v0.125 ZIP: https://chatgpt.com/library?file_id=libfile_a3a47e0bfb588191890a3731b51f4413&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_6c5b963006b88191b60c89eb268c35b1&account_id=personal . 다음: 전투 자원/상태의 가독성 및 타격감, 일러스트 실제 품질, 실기·오디오·FPS 검증. 카드와 AI 원본 보존.
- **v0.125.0 개발 후보:** 덱 편집의 카드 추가/제거 성공 및 30장/동일 카드 제한을 즉시 알림으로 표시. 화면 읽기용 상태와 명시적 추가 접근성 라벨, 이전 덱 상태의 알림 자동 무효화. 타입 검사, 자동 634/634, 렌더 42/42, 실제 v0.124 배포 롤백 포함 PWA 9/9, 독립 HTML 2/2. PC/모바일 실기 미검증. 이전 v0.124 ZIP: https://chatgpt.com/library?file_id=libfile_92995a59ec788191aa7f40e78308157f&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_af50e79ca7c081918856d6c6045f6957&account_id=personal . 다음: 전투 상태 가독성과 타격감, 이미지·오디오 검증. AI·카드 원본 및 저장 형식 보존.
- **v0.124.0 개발 후보:** 모바일 덱 편집에서 카드 그림의 추가 동작과 별도 상세 버튼을 분리, 내 덱 카드명 클릭은 상세 확인, 명시적 − 버튼만 한 장 제거. 도감/덱 편집 확대 모달 공통화, 44px 모바일 터치 동작. 타입 검사, 자동 633/633, 렌더 41/41, 실제 v0.123 롤백 포함 PWA 9/9, 독립 HTML 2/2. 393px 브라우저 조작 테스트 작성 및 시스템 Chromium 시도했으나 socket 권한으로 시작 실패(실제 상호작용 미검증). v0.123 ZIP: https://chatgpt.com/library?file_id=libfile_6247c4efae608191af25a64574ae26c3&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_ed5a3a921950819190d85c6602fcd1c6&account_id=personal . 다음: 덱 추가/제거 피드백 및 전투 연출·성장 이벤트 구분, 이미지 품질 확인. AI·카드 원본 및 로컬 저장 형식 불변.
- **v0.123.0 개발 후보:** 실제 방어도 증가·천상의 보호막 획득·소모를 각각 구분하여 표시 및 음향 추가(침묵 시 소모 오인 방지, 공용 판정/AI 불변). 또한 솔로 성장의 다음 랭크 승리 및 XP 조건을 각각 진행 막대/남은 수치로 표시하고 승급 판정 시점·최고 랭크 안내. 01시 예약 실행은 v0.122.0 성장 개선 커밋 `f3f3922`를 보고했으나 해당 원본 ZIP/Git이 현재 개발 환경이나 지속 백업에서 확인되지 않아 이 기능의 동등한 동작을 v0.123에서 재구현하고 전투 효과와 함께 검증했다(원본 커밋 병합은 아님). 타입 검사, 자동 633/633, 전투 집중 18/18, 렌더 40/40, 실제 v0.121 배포 롤백 포함 PWA 9/9, 독립 HTML 2/2. 최신 v0.121 ZIP: https://chatgpt.com/library?file_id=libfile_a77a6537255c8191a71270bfb2ddf96c&account_id=personal ; 전체 Git: https://chatgpt.com/library?file_id=libfile_07c16af0afb08191aa97efb1c8584df0&account_id=personal . 다음: 모바일 덱 편집에서 카드 추가/확대 상세 조작 분리. 실기/오디오/프레임 검증 미완료.
- **v0.121.0 개발 후보:** 카드 상세에 희귀도 및 기본 능력 태그, 실시간 하수인의 원래 공격/체력 표시 추가. 침묵 상태에는 원래 능력을 현재 능력으로 노출하지 않음. 타입 검사, 자동 631/631, 렌더 39/39, 실제 v0.120 배포 롤백 포함 PWA 9/9, 독립 HTML 2/2. 실제 기기/오디오/FPS 검증 미완료. v0.120 ZIP: https://chatgpt.com/library?file_id=libfile_2d0ed1672ab48191a39d3b78ddda873e&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_793510583d04819180a63103c15b8303&account_id=personal . 다음 단계는 `docs/ROADMAP.md`의 v0.121 이후: 솔로 성장 화면, 모바일 덱 편집, 전투 피드백·그림 품질, 실기/패치. 카드 및 정규 AI 유지, 추가 25단계 조정과 장시간 학습은 외부로 분리. 01:00 KST 예약 실행부터 실시간 작업 상태 보고를 요청해 설정함.
- **v0.120.0 개발 후보:** 솔로 연습 기록의 저장된 최근 100경기를 모두 10경기씩 조회. 현재/이전 밸런스, 승/패/무 필터와 검색 결과 집계, 페이지 범위 안전 보정. 저장 형식·랭크 성장·AI 데이터 변경 없음. 타입 검사, 자동 631/631, 렌더 38/38, 실제 v0.119 배포의 롤백 포함 PWA 9/9, 독립 HTML 2/2. v0.119 ZIP: https://chatgpt.com/library?file_id=libfile_18f1e39f3a748191a39d5251414dd421&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_5fced6687d5c8191b7801c2cb793466f&account_id=personal . 다음: 카드 상세의 희귀도/고유 능력 및 실시간 상태를 읽기 쉽게 개선, 이어서 솔로 성장 진행과 저장 UX 점검. 실제 한국시간과 버전·작업·테스트/백업 상태를 진행 중 표시.
- **v0.119.0 개발 후보:** 좁은 도감(570px 이하)에서 카드 탭 시 기본 그림을 확대하고 카드 상세를 네이티브 모달로 바로 표시, 닫기/키보드 복귀 및 이전 브라우저의 인라인 상세 폴백. PC 상세 유지. 타입 검사, 자동 630/630, 렌더 37/37, PWA 9/9(실제 v0.118 배포 롤백 포함), 독립 HTML 2/2. 393px 및 PC E2E 추가(실행 환경 제약으로 미실행). v0.118 ZIP: https://chatgpt.com/library?file_id=libfile_699884d9c37c819196fa76b147613faa&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_9d7c0ac4d7a881919f3210edb350f0a1&account_id=personal . 다음: 솔로 연습 대전 기록의 필터 및 전체 조회 개선. 실제 개발 중 시각·버전·구현·검사·백업의 진행을 표시한다.
- **v0.118.0 개발 후보:** 덱 편집/도감/성장 컬렉션에 원래 이름과 클래식 이름 동시 검색, 띄어쓰기 차이·순서 없는 여러 단어·종족/능력 검색. 검색 입력 접근성 추가. 타입 검사, 자동 630/630, 렌더 37/37, PWA 9/9(실제 v0.117 배포 캐시와 업그레이드/롤백), 독립 HTML 2/2. 브라우저 검색 재현 테스트 추가(미실행). v0.117 ZIP: https://chatgpt.com/library?file_id=libfile_acd0bf95b26c819182870236a2e6e2a5&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_e953be9259788191af925fac845b0157&account_id=personal . 다음: 좁은 화면에서 도감 상세 바로 확인, 카드 확대·성장 및 장시간 솔로 UX. 기존 카드·AI 원본 보존.
- **v0.117.0 개발 후보:** 즉시 전투 속도에서도 같은 경기·같은 좌석의 연속 승인 revision에 한해 실제 타격 효과음을 재생한다. 중복·재접속·과거 상태·결과음 겹침 차단 및 300ms 간격 제한. 타입 검사, 자동 629/629, 전투 효과 17/17, 렌더 37/37, PWA 9/9, 독립 HTML 2/2. 실제 기기 오디오와 브라우저 미검증. v0.116 ZIP: https://chatgpt.com/library?file_id=libfile_55ef18844d308191b498bf48d38c45c1&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_62777211f91c8191a23e9107984d3ea3&account_id=personal ; 전체 Git: https://chatgpt.com/library?file_id=libfile_b988d694ad2081919acfcf9d655198e3&account_id=personal (독립 복제/fsck 완료). 다음: 덱 편집·도감 검색 및 필터, 솔로 성장·저장 UI, 모바일 카드 상세. 외부 AI 학습·25단계 차등·계정/PvP 보류.
- **v0.116.0 개발 후보:** Web Audio의 오래 대기 중인 재개 요청이 다음 실제 클릭을 막지 않도록 재시도, 기존 Safari 호환 생성자 폴백, 일반/독립 HTML 클릭 활성화 추가. 기존 음량·음소거 유지. 타입 검사, 자동 629/629, 효과 집중 17/17, 렌더 37/37, PWA 9/9, 독립 HTML 2/2. 실제 iOS/갤럭시 스피커 미검증. v0.115 ZIP: https://chatgpt.com/library?file_id=libfile_ae79558022e481919362c82462744f57&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_7d647e9288bc8191a5f66702f833dc35&account_id=personal . 다음: 카드 상세/도감·전투 상태 피드백, 장시간 솔로 성장/저장 UX 개선. 사용자의 외부 AI 학습/25단계 차등 연구는 보류.
- **v0.115.0 개발 후보:** 실제 동일 경기 내 종료 전환에서만 승리/패배/무승부 전용 합성 사운드 한 번 재생. 저장 결과 다시 열기 및 중복 수신/다른 경기 코드 제외, 효과음 설정 유지. 즉시/모션 감소 설정의 결과 이동 애니메이션 생략. 타입 검사, 자동 629/629, 전투 효과 집중 17/17, 렌더 37/37, PWA 9/9, 독립 HTML 2/2. 실제 스피커·기기 체감 미검증. v0.114 실행 ZIP: https://chatgpt.com/library?file_id=libfile_d09737605fe88191aa9f3c6bbce34757&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_25610fdfc1e081919aea37e7df78de77&account_id=personal . 다음: 모바일 오디오 재개 실패의 복구, 카드 가독성·상태 피드백·솔로 플레이 흐름 강화.
- **v0.114.0 개발 후보:** 장착 무기 상세에 현재 공격/내구 및 기본 수치 구분, 무기 터치/길게 누르기/키보드 상세, 하수인 현재/최대 체력, 가로형 모바일에서 별도 카드 상세 펼치기 제공. 타입 검사, 자동 628/628, 렌더 37/37, PWA 9/9, 독립 HTML 2/2. 실제 Windows/모바일·음향/FPS 미검증. v0.113 ZIP: https://chatgpt.com/library?file_id=libfile_8386e760f3288191a73a2031f5b9b89b&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_1e9d38cfbf7481918563db255e7cc900&account_id=personal . 다음: 카드 상세/도감과 모바일 접근성, 전투 상태 피드백·장시간 솔로 UX 개선. 외부 AI 학습 및 정규 정책은 변경하지 않는다.
- **v0.113.0 개발 후보:** 전투 상단 모드/저장 표시와 조작 버튼은 별도 그룹, 좁은 세로 화면에서 줄을 나눠 겹침/잘림 위험 완화. 저장 상태는 라이브 상태로 접근성 전달. 타입 검사, 자동 628/628, 렌더 36/36, PWA 9/9, 독립 HTML 2/2. 393px 화면 버튼 경계 브라우저 시험 추가(미실행). 기존 WebP 427개 파일 전체 디코딩/중복 SHA 검사 정상(일러스트 수정 없음). v0.112 실행 ZIP: https://chatgpt.com/library?file_id=libfile_10e06f24f17c81919033a696fc17908e&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_195b93aaeab48191ac1a91349419e99b&account_id=personal . 다음: 카드 상세/정보 표시 가독성과 실제 카드 전투 결과/연출 UX 개선, 원본 카드 및 AI 유지.
- **v0.112.0 개발 후보:** 공통 카드 터치 미리보기에서 이동/스크롤·취소·긴 누르기의 합성 클릭 차단, 새 터치·마우스·키보드 입력은 즉시 정상 처리. 첫 손패/도감/덱 편집 공통 보호. 타입 검사, 자동 628/628, 미리보기 집중 8/8, 렌더 35/35, PWA 9/9, 독립 HTML 2/2. 실제 모바일 브라우저 재현 시험 추가 미실행. v0.111 실행 ZIP: https://chatgpt.com/library?file_id=libfile_1894984969b08191a4eeaecd0802dcfd&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_2c3f723b6e2881919326d82acbe265fa&account_id=personal . 다음 단계: 실제 작은 화면의 게임 상태/버튼 가독성, 카드 상세 접근성, 시각 효과/일러스트 품질 검토.
- **v0.111.0 개발 후보:** 모바일 660px 이하/저코어 기기의 전투 효과 캔버스 해상도·파티클·렌더 주기 비용 제한, 모션 감소 설정에서는 피해 숫자를 정적으로 표시. 실제 전투 타이밍 및 공개 결과 보존. 타입 검사, 자동 627/627, 효과 집중 16/16, 렌더 35/35, PWA 9/9, 독립 HTML 2/2. 실제 휴대폰 FPS·발열 및 음향 미측정. v0.110 실행 ZIP: https://chatgpt.com/library?file_id=libfile_8c5a3f74708c8191ac0011ecc9b3062f&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_cdf4dd36e6e48191851ada681586a3b7&account_id=personal . 다음은 UI 가독성·화면 이동·카드 조작 접근성 및 시각 효과 향상.
- **v0.110.0 개발 후보:** 실제 공개 피해량과 대상 수 기반 충격 강도(상한), 차단/보호막/회복/무기 장착 별도 효과음, 피해가 없는 회복과 보호막의 화면 흔들림 제거. 타입 검사, 자동 626/626, 전투 효과 집중 15/15, 렌더 35/35, PWA 9/9, 독립 HTML 2/2. 실기 미검증. v0.109 ZIP: https://chatgpt.com/library?file_id=libfile_e41c051f7df481919e0d8d6049b7a7c1&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_702339f848088191ad1f9c65e6ddfbc0&account_id=personal . 카드/정규 AI 원본 불변. 다음은 모바일 연출 비용 및 화면 가독성 개선.
- **v0.109.0 개발 후보:** 전투 효과음 0~100% 볼륨, 기존 음소거 독립 유지, 설정 영구 저장, 닫힌 AudioContext 재생성 및 재개 중복 방지, 재생 종료 노드 정리. 키보드 접근 가능한 범위 조절 UI. 타입 검사, 자동 625/625, 효과 집중 14/14, 렌더 35/35, PWA 9/9, 독립 HTML 2/2. 실제 브라우저/오디오 실기는 미검증. 종료된 AI 비교(독립 인접 432경기·13단계 기준 96경기) 원본 보존하고 정상 AI는 미변경, 추가 차등 연구 보류.
- **2026-11-23 최신 방향:** AI 25단계 차등 조정보다 독립 외부 학습 프로그램에서 최대 실력 확보 우선. 게임 개발은 솔로 웹플레이 및 저장·패치·PC/모바일 호환, UI/이미지/사운드/타격감·접근성·성능을 계속 강화한다. 새 AI 학습·카드 밸런스 변경과 계정/PvP 개발은 보류한다. 독립 실험이 끝나면 정상 랭크에 적용하지 않고 기록 보존. v0.108 ZIP: https://chatgpt.com/library?file_id=libfile_090d63f5e4e08191a3dc34a07ec1bf02&account_id=personal ; Git 증분: https://chatgpt.com/library?file_id=libfile_fc99b587a7ec81918aa028a1730f4b9c&account_id=personal .
- **v0.108.0 개발 후보:** 손상된 IndexedDB 엔트리를 빈 슬롯으로 오인하지 않고 일반 저장 조회와 슬롯 미리보기에서도 카드 해시·경기 식별자·상태 요약 일치 검사. 읽기 실패로 표시하고 원본 유지. 타입 검사, 자동 624/624, 로컬 경기 집중 30/30, 렌더 34/34, PWA 9/9, 독립 HTML 2/2. v0.107 전체 ZIP: https://chatgpt.com/library?file_id=libfile_a4f8e7ac941c81919d8198038f3a6471&account_id=personal ; Git 증분(기준 7f011af): https://chatgpt.com/library?file_id=libfile_bf03551967c4819196ce2fcf287762b5&account_id=personal . 독립 AI 구간 검사 및 중간 단계(13) 기준 추가 실험 진행 중, 정규 미적용.
- **v0.107.0 개발 후보:** 모바일 손패 가로 스크롤 및 revision 변경/비활성/취소된 드래그가 합성 클릭으로 카드 선택을 유발하지 않도록 보호. 취소된 포인터는 실제 종료까지 기억한다. 자동 623/623, 렌더 34/34, PWA 9/9. 모바일 합성 이벤트 재현 E2E 추가(실기 및 Chromium 실행 제한으로 미실행). 독립 시드 9000 인접 AI 시험은 완료 JSON부터 재사용하여 진행 중. v0.106 전체 ZIP: https://chatgpt.com/library?file_id=libfile_df47a795e1c08191aaa3d37be3bd09c2&account_id=personal ; Git 증분(기준 7f011af): https://chatgpt.com/library?file_id=libfile_b67bbf9ea3288191a58203cc77fc67e8&account_id=personal .
- **v0.106.0 개발 후보:** 솔로 로비에 저장소 다시 확인 버튼, 실패 시 기존 경기/성장 표시 보존, 최신 성장 및 과거 카드 경기 검사 전 랭크/복원 보호. 지연된 probe 응답 무시 및 Worker 정리. 잠금 대기 제한 회귀 추가. 타입 검사, 자동 622/622, 저장 집중 17/17, 렌더 34/34, 실제 v0.102→v0.106 PWA 파일 모의 캐시 업그레이드/롤백 포함 PWA 9/9, 독립 HTML 2/2, 미리보기 7/7, 기존 온라인 회귀 9/9. 행동 단위 실험 인접 24/24구간 432경기 246승 186패(우세 16/동률 5/열세 3), 독립 대표 5구간 90경기 72승 18패. 정규 및 턴 혼합과 같은 조건 비교 완료, 엄격한 순서 미입증/정규 적용 보류. 다음 독립 인접 검사 `npm run benchmark:ladder-grid -- 9 9000 decision docs/audits/ladder-decision-9000-9` 시작(2/24구간 완료, 잔여 자동 재개). 기존 v0.105 실행 ZIP: https://chatgpt.com/library?file_id=libfile_4d58fdddbef48191a00af323e2ab4c76&account_id=personal ; Git 증분(기준 7f011af, 끝 7bdc64b): https://chatgpt.com/library?file_id=libfile_763e3131655c8191a4d865dbefc5c819&account_id=personal .
- **v0.105.0 개발 후보:** 지원 브라우저에서 덱 저장·삭제·개별/통합 백업 덱 복원에 출처별 Web Locks 적용(4초 대기 제한, 거절 시 잠금 없는 쓰기 금지). 미지원 브라우저에서는 v0.104의 최신 목록/대상 재검사 유지. 대기 중 동일 버튼 중복 조작 방지. 타입 검사, 자동 621/621, 저장 집중 16/16, 렌더 34/34, PWA 8/8, 독립 HTML 2/2, 미리보기 7/7, 기존 온라인 회귀 9/9. 실기 미검증, 카드·AI 원본 동일. `benchmark:ladder-grid` 재개 도구: 완료 구간을 별도 JSON에 저장, 카드/가중치/시드/실험/쌍별 결과 검증 후 재사용, 실패 구간은 건너뛰고 다른 구간 계속. 행동 단위 혼합 인접 비교 19/24구간(342경기) 저장, 196승 146패(상위 우세 13/동률 4/열세 2), **미완료 표본**. `npm run benchmark:ladder-grid -- 9 3500 decision docs/audits/ladder-decision-3500-9`로 잔여 이어가기. 기존 정규 AI는 그대로. v0.104 전체 ZIP: https://chatgpt.com/library?file_id=libfile_52086df08dd48191898dcd0b272c41d3&account_id=personal .
- **v0.104.0 개발 후보:** 일반 덱 저장·삭제도 복원과 동일한 엄격한 기존 기록 검사 사용. 확인 창 뒤 최신 덱 목록을 다시 읽고 선택한 대상의 카드가 달라졌으면 거절한다. 다른 이름으로 추가된 덱을 보존하며 손상된 기존 JSON, 중복 이름, 최대 용량 초과 시 쓰지 않는다. localStorage의 다중 탭 동시 쓰기는 원자적 트랜잭션이 아니므로 완전한 동시 잠금은 추후 검토. 타입 검사, 자동 620/620, 저장 집중 15/15, 렌더 34/34, PWA 8/8. 카드/AI 원본 보존. v0.103 체크포인트: https://chatgpt.com/library?file_id=libfile_5646c2afe6148191b8bbd401bd917241&account_id=personal . 행동 단위 AI 인접 실험은 별도 진행 중이며 정규 랭크에는 적용하지 않는다.
- **v0.103.0 개발 후보 (2026-11-23 00시 이후):** 일시적인 IndexedDB 연결 오류·차단 후 재시도, 늦게 열린 연결 종료, 버전 변경/비정상 종료 후 연결 무효화. 소유권이 남은 경기만 일시 저장 실패 후 재시도하며 다른 탭이 가져간 경기는 계속 차단한다. 경기 중·종료 후 저장 재시도 UI 제공 및 실패 중 재대전 차단. 타입 검사, 자동 618/618, 렌더 34/34, PWA 8/8, 집중 29/29, 독립 HTML 2/2, 미리보기 7/7, 기존 온라인 로컬 회귀 9/9. 동일 카드/AI 데이터 원본 보존. Chromium 실행 재시도는 socket() 권한 오류로 실패(실기 미검증). 개발자 벤치마크 전용 행동 단위 혼합 AI 후보를 추가하고 동일 432경기 비교를 시작했다. 정상 랭크 정책 변경 없음. 사용자 요청으로 밤에는 짝수 정각 개발 중단 규칙을 일시 해제하고 막히는 단계는 기록 후 다음 단계 진행. `node apps/cli/benchmark-ladder.ts 9 <하위> 3500 <상위> decision`을 각 인접 구간에서 실행하며 완료 후 기존 v0.102 비교표와 대조한다.
- **v0.102 검증 보강:** PWA 8/8(독립 두 릴리스의 대기/활성/오프라인 캐시 분리), Android 후보 7/7, AI 실험 규칙 2/2. 실제 엔진 성장 96+144경기와 독립 25랭크 25경기 정상 완료(265경기, 경기 체크포인트 497회, 성장 JSON 28회). 독립 144경기에서 109번째 경기 다이아1, 103경기 시점 382종 해금, 최종 24,086 XP/퀘스트 14회. 현재 정규 AI 및 혼합 실험을 동일 인접 24구간·9쌍(각 432경기)으로 비교: 정규 231승 201패/우세 10 동률 8 열세 6, 실험 236승 194패 2무/우세 16 동률 5 열세 3; 실험 인접 누적 624경기, 엄격한 순서 미입증·정규 적용 보류. `docs/SOLO-JOURNEY-AUDIT.md`, `docs/AI-DIFFICULTY-AUDIT.md`, 원본 JSON `docs/audits/`에 저장. 코드/게임 런타임 버전 v0.102 그대로, 검사 도구 및 문서만 추가. 다음 작업은 실제 PC/갤럭시 실기이며 환경 Chromium socket 제한 및 Android SDK 없음, 외부 게시 승인 없음. v0.102 최초 전체 복원 ZIP: https://chatgpt.com/library?file_id=libfile_ee6a16f302248191a1851ef1170b91d5&account_id=personal . 별도 검증된 PWA 정적 6파일 ZIP(미게시): https://chatgpt.com/library?file_id=libfile_c55e8eae110c8191abc69fc106db58f2&account_id=personal .
- **v0.102.0 개발 후보:** 미진행 슬롯에서 성장+저장 덱 통합 파일 한 번으로 순차 복원. 양 구성 및 알려진 덱 용량을 먼저 검증, 원본/대상 슬롯과 추가 예정 덱 수 확인, 성장 확정 후 최신 덱 목록에 안전 추가. 덱 저장만 실패하면 기존 성장 보존 및 별도 덱 추가 재시도 안내(공통 트랜잭션 없음). 손상 경기 메타데이터는 교체·신규 랭크/성장 복원을 허용하지 않고 저장 오류 처리. 타입 검사, 자동 616/616, 집중 40/40, 렌더 33/33, 독립 HTML 2/2, PWA 7/7, 미리보기 7/7, 기존 온라인 로컬 회귀 9/9. 원본 카드/AI 데이터 무변경. 브라우저 실기·모바일 HTTPS 게시 보류. v0.101 전체 복원 ZIP: https://chatgpt.com/library?file_id=libfile_fb397186ad9c8191a8ce1abf199e6943&account_id=personal .
- **v0.101.0 개발 후보:** 이전 카드 해시의 미완료 랭크를 보존하고 같은 슬롯의 신규 랭크를 Worker/IndexedDB 트랜잭션에서 차단(이전 버전 복귀·경기 완료로 해제, 다른 슬롯 및 백업 사용 가능). 다른 슬롯 조회 Worker 순차 처리, 수동 패치 확인/복귀·온라인 이벤트 검사, 부분/실패 패치에서 기존 게임 유지. PC 실행기는 전체 릴리스 해시 검사 후 불변 파일 제공, 새 릴리스는 재실행. 대표 AI 구간 80경기 56승 24패, 독립 최고 비교 144경기 121승 23패, 인접 192경기 101승 91패(상위 우세 5/동률 18/열세 1구간, 적용 보류). 저사양 예산 800판단 호스트 모의 측정 시간 초과/대체 0. 타입 검사, 자동 614/614, 렌더 33/33, 독립 HTML 2/2, PWA 7/7, Android 후보 7/7, 미리보기 7/7, 온라인 로컬 회귀 9/9, AI 실험 2/2. 카드/AI 원본 무변경, 실제 브라우저·물리 기기 미검증. v0.100 전체 복원 ZIP: https://chatgpt.com/library?file_id=libfile_24acd9a661548191b9b2265868c25917&account_id=personal .
- **v0.100.0 개발 후보:** 선택 슬롯의 성장+저장 덱 통합 JSON 백업, 두 구성 모두 검증 후 성장/덱 각각 기존 안전 복원 경로 사용(별도 두 작업, 덮어쓰기 없음, 이전 개별 백업 호환). 진행 중 경기·미저장 편집 덱·연습 전적 미포함. `docs/PWA-PAGE.md` PC 로컬 실행/모바일 정적 페이지 연결 가이드, 외부 게시 없음. 타입 검사, 자동 612/612, 렌더 32/32, 독립 HTML 2/2, PWA 5/5, Android 후보 7/7, 미리보기 7/7, 기존 온라인 로컬 회귀 9/9. 실제 브라우저 검증은 환경 제한으로 미완료. v0.99 복원 ZIP: https://chatgpt.com/library?file_id=libfile_2244030bb2f881919cc63dbc903266b4&account_id=personal .
- **v0.99.0 개발 후보:** 3개 저장 슬롯 선택 화면에 랭크·XP·현재 경기/이전 카드 버전 경기 유무를 표시. 다른 슬롯의 조회는 성장/경기 레코드를 수정하지 않는 readonly 트랜잭션 사용. 조회 실패/기존 기록/다른 버전 경기/로컬 덱·설정이 존재하면 빈 슬롯으로 간주하지 않음. 확인된 빈 슬롯에만 '새로 시작' 버튼, 기존 슬롯 초기화/삭제 없음. 탭 포커스/로비 복귀 시 미리보기 갱신, 늦은 조회 무시. 타입 검사, 자동 611/611, 렌더 32/32, 독립 HTML 2/2, PWA 5/5, 미리보기 7/7, 기존 온라인 로컬 회귀 9/9. 실제 IndexedDB 실기 미검증. v0.98 전체 복원 체크포인트: https://chatgpt.com/library?file_id=libfile_b8ace34fb29c8191b96f3878b43bdacc&account_id=personal .
- **v0.98.0 개발 후보 (PWA 로컬 저장 확정):** 사용자 승인으로 PWA 웹앱+로컬 저장 우선, APK/계정/외부 온라인 배포 보류. 3개 독립 저장 슬롯(1번 기존 키/DB 유지), XP·랭크·해금·퀘스트·활성 경기·덱·설정·연습 전적 분리, 현재 슬롯 선택 유지, 새 슬롯은 초기 기록, 삭제/리셋 없음. 고정 DB/키 바인딩으로 다른 탭의 슬롯 전환이 기존 작업을 바꾸지 않음. 개발자 전용 AI 혼합 실험(보상 없음, 정규 랭크 미적용) 200경기, 167승 33패(기존 최고 AI 기준), 인접 25단계 강도 구분 미입증. 기존 원본 카드/AI 동일. 타입 검사, 자동 610/610, 렌더 32/32, 독립 HTML 2/2, 미리보기 7/7, PWA 5/5, Android 후보 7/7, 온라인 로컬 통합 9/9; 실험 선택 규칙 별도 검사 2/2. 실제 슬롯별 IndexedDB 및 실기 PWA는 브라우저 실행 제한으로 미검증. 이전 전체 체크포인트 v0.97: https://chatgpt.com/library?file_id=libfile_e17b21858ffc81919ac789837d7ce72e&account_id=personal .
- **v0.97.0 개발 후보:** Android 오프라인 앱 소스 및 SDK 명령행 빌드/검증 후보, 고정 앱 ID/저장 원점, Android 문서 선택기로 성장/덱 JSON 저장 및 복원(취소/실패 처리), 콘텐츠 정책·네트워크 권한 미부여. `docs/ANDROID-APK.md` 및 `build-android-apk.cmd`. Android 백업 JS/패키지 7/7(순수 Java 검증 실제 컴파일 포함), 타입 검사, 자동 607/607, 렌더 32/32, 독립 HTML 2/2, 미리보기 7/7, 온라인 로컬 통합 9/9. 전체 Android Activity SDK 컴파일·서명·설치 미완료(현 환경 SDK 없음), Chromium 재시험도 socket() 권한 제한. 사용자 키는 생성/보관하지 않음. v0.96 전체 체크포인트: https://chatgpt.com/library?file_id=libfile_2b30697c02cc8191b10a942e06a198bf&account_id=personal .
- **v0.96.0 개발 후보:** 설치 후보 앱 버전 표시, 클릭으로 브라우저 지속 저장 보호 요청 및 승인/미승인 안내, 캐시 누락 시 동일 릴리스 해시 확인 후 복구(다른 버전 파일은 거절). 144개 합성 경기 성장 원장 시험으로 25랭크/382카드/9직업 14회 퀘스트/백업 보존. 타입 검사, 자동 607/607, 렌더 32/32, 독립 HTML 2/2, 미리보기 7/7, 앱 5/5, 온라인 로컬 통합 9/9, 225/900 덱 검사 통과. AI 최고 대 1~24단계 비교 192경기 99승 93패, 엄격한 난이도 순서 미입증(`docs/AI-DIFFICULTY-AUDIT.md`). 카드/AI 원본 동일. PC/모바일 실기 체크리스트 `docs/SOLO-ACCEPTANCE.md`. 실제 Windows/Galaxy 및 APK 미완료. v0.95 실행 및 전체 소스 체크포인트: https://chatgpt.com/library?file_id=libfile_e0b5b3204074819185c568506c322ce9&account_id=personal .
- **v0.95.0 개발 후보:** PC 고정 주소 `http://127.0.0.1:4179/` 로컬 전용 앱 실행기, Web App Manifest와 오프라인 서비스 워커 설치 후보. 새 릴리스 전체 파일 해시 확인, 불완전한 캐시 제거 및 기존 버전 보존, 기존 게임 창 닫은 후 적용. 생성 파일 `dist/solo-app`, 시작 `start-offline-app.cmd`. PC 또는 모바일 실기 설치/Chromium 검증은 미완료, Android APK 미생성. PC 파일 실행본의 성장/덱은 별도 JSON 백업으로 새 고정 주소에 이관해야 한다. v0.94 전체 체크포인트: https://chatgpt.com/library?file_id=libfile_055afbe70e4881919f3feb9d3af4032c&account_id=personal .
- **v0.94.0 개발 후보:** 오프라인 성장 화면에 25랭크 승급표, 카드 전력별 현황, 382종 컬렉션 검색/필터/페이지, 9직업 순환표, 다음 카드 XP 및 최근 30경기 기록 추가. 개발자 절전 설정은 유저 랭크 AI에 적용되지 않는다. 타입 검사, 자동 606/606, 렌더 32/32, 오프라인 2/2, 미리보기 7/7 통과. AI 기기 벤치마크 300판단(최대 129ms), AI 비교 78경기. 지능의 엄격한 단조 승률 상승 및 실제 Galaxy/Windows 성능은 미확인. 카드/AI 원본 유지.
- **v0.93.0 개발 후보:** 오프라인 유저/개발자 모드 화면·편집 덱 분리. 개발자 실제 랭크 AI 시험은 보상을 지급하지 않는다. 저장 덱 JSON 백업/안전한 추가 복원(동일 덱 중복·충돌 이름·20개 용량·손상 저장소 방어). 타입 검사, 자동 606/606, 렌더 32/32, 오프라인 2/2, 미리보기 7/7 통과. 카드/AI 원본 보존. v0.92 소스/실행 체크포인트: https://chatgpt.com/library?file_id=libfile_9d8f2a49bdcc81918664b1bca2300bd0&account_id=personal .
- **2026-11-22 22시 이후 개발 방향 변경(사용자 승인):** 외부 온라인 배포 보류, 설치형 솔로 성장 완성 우선. v0.91 온라인 기능과 카드/AI 원본을 유지한다. 로컬 진행 데이터를 온라인 계정 데이터로 신뢰해 업로드하지 않는다.
- **v0.92.0 개발 후보:** 오프라인 25랭크·보유 덱 및 순차 해금, XP/직업 퀘스트/전적 저장, IndexedDB v1→v2 보존 업그레이드, 경기와 원장의 동일 트랜잭션, 보상 중복 방지/진행 중 랭크 저장 경기 덮어쓰기 차단, 새 설치 전용 성장 백업 JSON. 전체 카드 자유 연습 보존. 타입 검사, 자동 602/602, 렌더 32/32, 오프라인 2/2, 미리보기 7/7 통과. 기존 카드/AI 원본 일치. 실제 IndexedDB Chromium 시험은 환경 socket() 권한 제한으로 미검증이며 Windows/Android 실기와 APK는 미완료.
- **v0.91.0 개발 후보:** SQL 006 읽기 전용 실제 서버 역할 및 RLS 우회 검사, 준비 RPC의 일반/인증 권한 차단, 스키마 6 미만 공개 시작 거절. 실제 PostgreSQL 미연결(모의/정적 및 공식 문서 검토). 타입 검사, 자동 테스트 598/598, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 기존 카드/학습 데이터 원본 유지. 최신 누적 소스 `v091-source.patch`.
- v0.90 누적 패치: https://chatgpt.com/library?file_id=libfile_80419ac473048191ba16aa5947df3031&account_id=personal .
- **v0.90.0 개발 후보:** 실제 SQLite 원장 144개 합성 결과(50% 승리), 25랭크 전부 실제 방 설정/AI 덱 검사, 전체 카드 382장(122경기), 9직업 퀘스트 14회, 18,860 XP, 두 로그인 세션·30경기마다 재시작, 오래된 경기 중복 방지·저장 덱·XP 기준 패치/원복 보유 카드 유지 검증. 실제 승률 측정 아님. 타입 검사, 자동 테스트 597/597, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 최신 누적 소스 `v090-source.patch`.
- v0.89 누적 패치: https://chatgpt.com/library?file_id=libfile_6bb75ae7fd8c8191967d1943080d473b&account_id=personal .
- **v0.89.0 개발 후보:** 실제 반환된 영웅 소환물의 AI 손패 재사용 시험 및 개발자 분석 전투 카탈로그 통일, 9직업·최고 AI 6경기 포함 12 AI+1 PvP 동시 부하 시험. 영웅 능력 73회, 기대 계정·PvP 양측 정산 확인, 227 소켓 ACK p95 88ms, 104 HTTP p95 7ms, RSS 332MiB(로컬 서버+클라이언트). 타입 검사, 자동 테스트 596/596, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 외부/물리 미검증. 최신 누적 소스 `v089-source.patch`.
- v0.88 전체 소스: https://chatgpt.com/library?file_id=libfile_910bbd0d11d88191870313ac043aba94&account_id=personal . v0.88 누적 패치: https://chatgpt.com/library?file_id=libfile_74a1dd2e60f08191895b593c21c9bb5d&account_id=personal . 전체 복원 폴더 타입 검사·빌드·사전 검사 및 AI 원본 일치 확인.
- **v0.88.0 개발 후보:** 성기사·주술사 영웅 능력 하수인 포함 불변 전투 카탈로그 통일, 실제 AI 작업 스레드 검사 및 서버 다중 경기 카드 정의 재사용. 개별 경기 상태·후속 카드 변경 분리. 타입 검사, 자동 테스트 595/595, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 최신 누적 소스 `v088-source.patch`.
- v0.87 누적 패치: https://chatgpt.com/library?file_id=libfile_a642da03cbf88191b2f71c7b84546da9&account_id=personal .
- **v0.87.0 개발 후보:** SQL 005 읽기 전용 스키마 준비 함수, 경기 원장 RPC와 서버 필수 권한·anon/authenticated 접근 차단·RLS 검사 및 공개 시작 실패 닫힘. 실제 PostgreSQL 미연결(모의 및 공식 문서 검토). 타입 검사, 자동 테스트 593/593, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v087-source.patch`.
- v0.86 누적 패치: https://chatgpt.com/library?file_id=libfile_72e9a46a26388191968f1b89423973d9&account_id=personal .
- **v0.86.0 개발 후보:** 계정 프로필 공통 검증, v0.46 누락 rankWins 호환, DB revision 우선, 과거 카드/덱 유지, 손상 저장본 미덮어쓰기 및 소유자 확인 로그아웃. 모의 클라우드 보상 재시도 시 원장 중복 방지 유지. 타입 검사, 자동 테스트 592/592, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v086-source.patch`.
- v0.85 누적 패치: https://chatgpt.com/library?file_id=libfile_3dfe97ed416c8191bc738e516b6e0519&account_id=personal .
- **v0.85.0 개발 후보:** 실제 배포 승인 도구가 앱과 동일한 응답 검증 및 기대 계정 ID 적용. 읽기 시험의 잘못된 계정 기록 조회, 신규 폐기 가능 두 계정 승인 시험의 타계정 덱 저장/대전 진입 거절과 진행 불변 검증. `identityBound: true`, 기존 쓰기 범위 그대로. 타입 검사, 자동 테스트 590/590, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v085-source.patch`.
- v0.84 전체 소스: https://chatgpt.com/library?file_id=libfile_1e2405766b30819195cc79de758e1578&account_id=personal . v0.84 누적 패치: https://chatgpt.com/library?file_id=libfile_692646cdcd1c8191be176f9a8ab6ae45&account_id=personal . 전체 복원 폴더 타입 검사·빌드·사전 검사 및 AI 원본 비교 통과.
- **v0.84.0 개발 후보:** 서버 경기 복원 시 신규 게임과 동일한 영웅 능력 생성 하수인 5종 복원, 호환 저장 방 모드/참가/카탈로그/게임 상태/결과 관계 검증, 비정상 데이터 부분 삽입 방지. 성기사·주술사 실제 생성→복원→재소환 시험. 타입 검사, 자동 테스트 590/590, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v084-source.patch`.
- v0.83 누적 패치: https://chatgpt.com/library?file_id=libfile_995a523bd0708191a831603ce0bd2e69&account_id=personal .
- **v0.83.0 개발 후보:** 인증 요청 제한 Retry-After 표시, 공급자 429 유지, 자동 재시도 없음. 비밀번호 변경·복구 세션 폐기 직후 소켓 인증 캐시 폐기 및 부분 실패 처리. 변경 전 비동기 세션/소켓 조회 재활성화 차단, 계정별 입력 초기화. 타입 검사, 자동 테스트 588/588, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v083-source.patch`.
- v0.82 누적 패치: https://chatgpt.com/library?file_id=libfile_68d3501c1f288191aed1b8db59764b91&account_id=personal .
- **v0.82.0 개발 후보:** 브라우저 다른 탭의 계정 쿠키 전환 시 이전 계정 요청의 읽기/덱·비밀번호·점검 변경/로그아웃/다운로드를 409로 거절. 6가지 계정 대전 진입에 표시 계정과 소켓 인증 계정 일치 확인, 잘못된 요청의 티켓/방 미생성, 새 계정 조회/재연결. 타입 검사, 자동 테스트 584/584, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v082-source.patch`.
- v0.81 누적 패치: https://chatgpt.com/library?file_id=libfile_3ec2c69ac3c88191a62bbf11cca94699&account_id=personal .
- **v0.81.0 개발 후보:** 현재 계정·성장 버전·재접속·포커스 키에 맞는 성장 응답만 표시, 25랭크·XP 순서·카드 중복·9직업 퀘스트 검증, 운영 응답 권한/런타임 계수/점검/AI 모델 검증 및 최신 계정 확인 전 준비 상태·점검 변경 제한. 타입 검사, 자동 테스트 581/581, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 및 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v081-source.patch`.
- v0.80 전체 소스: https://chatgpt.com/library?file_id=libfile_6b020baed1b481918d3d10d757bf515f&account_id=personal . v0.80 누적 패치: https://chatgpt.com/library?file_id=libfile_cbb6f3a7d7e48191adffb4eb9a75d925&account_id=personal . 전체 소스 복원 폴더 타입 검사·빌드·사전 검사 및 AI 원본 일치 확인.
- **v0.80.0 개발 후보:** 계정/활성 경기 최신 조회 키 및 응답 형식 확인, 이전/실패/확인 중 신규 대전 차단. 유효한 활성 경기만 이어하기 및 성장 조회 독립, 계정 연속 클릭 잠금·실제 401만 세션 만료. 타입 검사, 자동 테스트 579/579, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱과 900개 전력 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v080-source.patch`.
- v0.79 누적 패치: https://chatgpt.com/library?file_id=libfile_cb46ed1cd7c481918df88f498c83bc0b&account_id=personal .
- **v0.79.0 개발 후보:** 유효한 저장 방이 서버 용량보다 많으면 일부 폐기하지 않고 시작 거절. 중복 방/활성 계정/정산 원장 키와 잘못된 결과 형식 차단, 만료 및 카드 호환 정책 유지. 타입 검사, 자동 테스트 576/576, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 기본 225 덱 및 900개 덱 전력/864개 증가 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v079-source.patch`.
- v0.78 누적 패치: https://chatgpt.com/library?file_id=libfile_8f87bb1910008191b4810013820071ca&account_id=personal .
- **v0.78.0 개발 후보:** 개발자 /growth 및 배포 CLI 4시드 × 9직업 × 25랭크 = 900개 생성 덱 검사, 전력 합 범위/평균, 인접 비교 864/864 증가(동일/하락 0), 실제 AI 지능 검색 설정 및 사용자 정의 역전 경고. 초안 변경 시 마지막 검사 표 stale 표시. 카드 수치/AI 가중치 미변경, 실제 승률 아님. 타입 검사, 자동 테스트 574/574, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 기본 사전 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v078-source.patch`.
- v0.77 누적 패치: https://chatgpt.com/library?file_id=libfile_1b4cda8f8bcc81919e82dffd9d78b201&account_id=personal .
- **v0.77.0 개발 후보:** 클라우드 저장 경기 기본 키 페이지를 끝까지 복원(모의 235건/37건 페이지), 중복·식별자·응답 형식 오류 시 시작 거절. Supabase 실제 이메일 확인 대기 bare user 및 nested user 수용(토큰 없이 게임 계정 미발급), 비정상 인증·세션·프로필 데이터 임시 저장소 오류로 분리. 타입 검사, 자동 테스트 572/572, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 사전 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v077-source.patch`.
- v0.76 전체 소스: https://chatgpt.com/library?file_id=libfile_fe649e3678e08191b6e88ebf55e5b19c&account_id=personal . v0.76 누적 패치: https://chatgpt.com/library?file_id=libfile_0272ed4297448191be78aee484ee0dac&account_id=personal .
- 2026-11-22 19:00 KST 중간보고 수행(사용자 요청 20:00 KST까지 계속). v0.76 전체 실행본 복원 폴더 타입 검사/빌드/사전 검증 통과. 원본 AI 데이터 v0.56과 동일.
- **v0.76.0 개발 후보:** 최초 최신 카드 요청 25초 제한·재시도·HTTPS 본문 해시 확인. 자동 패치 갱신은 탭당 1회, 버전과 카드 해시 모두 일치할 때 해제. 불일치 시 서버 대전·복원·stale 상태 수신/계정 패널 제한, 경기 티켓 보존. 타입 검사, 자동 테스트 568/568, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 사전 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v076-source.patch`.
- v0.75 누적 패치: https://chatgpt.com/library?file_id=libfile_b2294a62cb78819182c91e00b1a2b731&account_id=personal .
- **v0.75.0 개발 후보:** 정확한 게임 WebSocket 출처, HSTS(HTTPS만), 동일 출처 자산 및 폼 보호/불필요 권한 차단. 실제 로컬 운영 출처 보안 쿠키·중복 거절·외부 출처·본문·정규화 로그인 제한과 배포 CLI 보안 헤더 확인. 타입 검사, 자동 테스트 564/564, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 9/9, 225 덱 사전 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v075-source.patch`.
- v0.74 누적 패치: https://chatgpt.com/library?file_id=libfile_9b2b6fc4d3fc8191928e361e9a4e3324&account_id=personal .
- **v0.74.0 개발 후보:** 계정 HTTP 요청 25초 제한·취소, 프록시 비정상 응답 및 통신 실패 안내, 결과 유실 시 저장 여부 재확인, 인증 상태 불명확 시 신규 경기 차단 및 재시도. 타입 검사, 자동 테스트 562/562, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 8/8, 225 덱 사전 검사 통과. 실제 외부/물리 미검증. 최신 누적 소스 `v074-source.patch`.
- v0.73 누적 패치: https://chatgpt.com/library?file_id=libfile_1a4f867bf83c8191a7a664bb73148067&account_id=personal .
- **v0.73.0 개발 후보:** 점검 중 신규 서버 덱 저장·삭제와 비밀번호 변경·복구 완료 차단, 기존 접수 요청 종료 및 경기 정산 대기. 두 변경 카운터 및 `--ready` 검사/UI 반영, 로그인·가입·로컬 편집·기존 경기 유지. 타입 검사, 자동 테스트 559/559, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 8/8, 225 덱 사전 검사 통과. 외부/물리 미검증. 최신 누적 소스 `v073-source.patch`.
- v0.72 전체 소스: https://chatgpt.com/library?file_id=libfile_5f40c23f65fc8191b66267d1f74c0c58&account_id=personal . v0.72 누적 패치: https://chatgpt.com/library?file_id=libfile_57c1c442cfcc81919e7940867780bd70&account_id=personal .
- **v0.72.0 개발 후보:** 모바일 계정 패널 접기/랭크·XP 요약, 전력별 25단계 카드 해금 진행, 동일 서버 공식 정규/퀘스트 XP, 성장·활성 경기 오류 재시도 및 개발자 상태 자동 갱신·stale 표시. 타입 검사, 자동 테스트 557/557, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 8/8, 225 덱 사전 검사 통과. 실브라우저 및 외부 미검증. 최신 누적 소스 `v072-source.patch`.
- v0.71 누적 패치: https://chatgpt.com/library?file_id=libfile_6a5dac7ad50c819189b249cb9ca1c3fd&account_id=personal .
- **v0.71.0 개발 후보:** 격리 소스의 실제 운영 프로세스 구버전→새 카드/성장/버전→롤백 세 차례 실행, 기존 계정 진행 및 신규 카드 영구 보존 확인. 타입 검사, 자동 테스트 554/554, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 8/8, 225 덱 사전 검사 통과. 로컬 14연결·12AI·1PvP 5라운드 부하 검사 성공(소켓 118건 p95 116ms, HTTP 95건 p95 4ms, RSS 325MiB). 실제 외부/물리 기기 미검증. 최신 누적 소스 `v071-source.patch`.
- v0.70 누적 패치: https://chatgpt.com/library?file_id=libfile_527bb384fdd0819196c2134b155d8dcf&account_id=personal .
- **v0.70.0 개발 후보:** 명시적 신규 폐기 가능 시험 유저 2명/세션 3개 배포 쓰기 승인 CLI, 덱 동기화·기기 이전·랭크 XP/퀘스트·PvP 양측 정산. 기존 진행 계정·개발자·점검 중은 사전 거절. 타입 검사, 자동 테스트 554/554, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스·승인 7/7, 225 덱 사전 검사 통과. 실제 브라우저는 재시도 시 socket() 권한 제한, 이메일 대기·동시 덱 저장 E2E 코드는 보완했으나 실행하지 못함. 외부 서비스 미검증. 최신 누적 소스 `v070-source.patch`.
- v0.69 누적 패치: https://chatgpt.com/library?file_id=libfile_20c65522657c8191a66263698823bd8e&account_id=personal .
- **v0.69.0 개발 후보:** 계정 덱 하나 단위 변경 비교 및 안전 재시도. 다른 기기의 별도 덱·XP 동시 변경을 합치고 같은 이름 stale 수정/삭제 거절, 유실 응답 중복 저장 방지, 20개 제한 및 과거 덱 보존. 타입 검사, 자동 테스트 554/554, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 5/5, 225 덱 사전 검사 통과. 외부 및 실기 미검증. 최신 누적 소스 `v069-source.patch`.
- v0.68 전체 소스: https://chatgpt.com/library?file_id=libfile_0ce9069f1e78819197e2cebcdd3e4a0e&account_id=personal . v0.68 누적 패치: https://chatgpt.com/library?file_id=libfile_760695926374819194fad3624fd89042&account_id=personal .
- **v0.68.0 개발 후보:** 읽기 전용 `online:smoke -- <HTTPS 출처> --ready` 배포 준비 검사. 개발자 권한·저장된 점검·활성 경기·저장 실패·미정산 결과가 모두 안전해야 성공하며 임시 세션만 폐기한다. 타입 검사, 자동 테스트 553/553, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 5/5, 225 덱 사전 검사 통과. 외부 배포 미검증. 최신 누적 소스 `v068-source.patch`.
- v0.67 누적 패치: https://chatgpt.com/library?file_id=libfile_caf66351aeec8191acec692321fa00b7&account_id=personal .
- **v0.67.0 개발 후보:** 승인 Git 체크아웃의 카드·성장 해시와 배포용 AI 모델의 세대·가중치를 실제 서버와 대조한다. 동일한 버전 번호라도 불일치하면 로그인 전에 거절한다. 타입 검사, 자동 테스트 553/553, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 4/4, 225 덱 사전 검사 통과. 외부 배포 미검증. 최신 누적 소스 `v067-source.patch`.
- v0.66 누적 패치: https://chatgpt.com/library?file_id=libfile_a728ecb92978819193400ca4f7bacb94&account_id=personal .
- **v0.66.0 개발 후보:** PC/휴대폰 LAN 시험 전용 실행기, 현재 PC에 할당된 사설 IPv4만 허용, 운영 DB·클라우드 키 및 이메일 복구 분리. 타입 검사, 자동 테스트 553/553, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 3/3, 225 덱 사전 검사 통과. 별도 Git 작업트리의 루프백 프로세스에서 헬스 및 테스트 DB만 생성·정상 종료 확인. 실제 사설망 물리 기기 미검증. 최신 누적 소스 `v066-source.patch`.
- v0.65 누적 패치: https://chatgpt.com/library?file_id=libfile_cc62e31598d08191a936271905a4bf1e&account_id=personal .
- **v0.65.0 개발 후보:** 이메일 확인이 필요한 가입을 HTTP 202 대기 상태로 명시하고 인증 전 세션·게임 프로필 미발급, 확인 후 로그인 안내. 타입 검사, 자동 테스트 550/550, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 3/3, 225 덱 사전 검사 통과. 실제 이메일 발송 및 외부 배포 미검증. 최신 누적 소스 `v065-source.patch`.
- v0.64 전체 소스: https://chatgpt.com/library?file_id=libfile_4092ccc465ec8191ac0324afdb7b5cd5&account_id=personal . v0.64 누적 패치: https://chatgpt.com/library?file_id=libfile_8baa3fa377ac81919777dc3609340ee2&account_id=personal .
- **v0.64.0 개발 후보:** 장기 연결에서 계정 세션·개발자 권한 재검증, 만료/권한 변경 시 활성 좌석 해제 및 기존 경기 저장 유지, 단기 인증 캐시. 타입 검사, 자동 테스트 549/549, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 3/3, 225 덱 사전 검사 통과. 최신 누적 소스 `v064-source.patch`.
- 사용자 요청에 따라 2026-11-22 18:00 KST 중간보고 수행. 19:00 KST까지 계속 개발 요청. 실제 외부 서버 연결·물리 브라우저 시험은 보류, 카드 밸런스 및 학습 원본 보존.
- v0.63 누적 패치: https://chatgpt.com/library?file_id=libfile_4a67ab35a3c88191a1a1f1794c8acc5a&account_id=personal .
- **v0.63.0 개발 후보:** 실제 운영 엔트리 프로세스 3회 시작/종료, 임시 SQLite에서 점검 상태 및 덱·XP·진행 경기 보존, 독립 로그인 기기에서 이어하기 및 정산 시험. 타입 검사, 자동 테스트 546/546, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결·프로세스 3/3, 225 덱 사전 검사 통과. 외부 및 물리 기기는 미검증. 최신 누적 소스 `v063-source.patch`.
- v0.62 누적 패치: https://chatgpt.com/library?file_id=libfile_d0cf336fad4481918e13131bee92b93c&account_id=personal .
- **v0.62.0 개발 후보:** 기기 AI 도중 서버 최신 버전 감지 시 안내 및 게임 유지, 로비 복귀 후 자동 적용, 카드 해시 변경 시 저장 경기 경고. 타입 검사, 자동 테스트 546/546, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결 2/2, 225 덱 사전 검사 통과. 실제 브라우저·외부 서비스 미검증. 최신 누적 소스 `v062-source.patch`.
- v0.61 전체 실행 소스: https://chatgpt.com/library?file_id=libfile_f05149566ef88191bb1996f4c90acc50&account_id=personal . 이전 AI 원본 동일 및 복원 폴더 타입 검사/빌드/사전 검사 통과(기존 설치 의존성 사용). v0.61 누적 패치: https://chatgpt.com/library?file_id=libfile_0d07a0ca6f4c8191ba686155067be92f&account_id=personal .
- **v0.61.0 개발 후보:** SQLite/Supabase 저장소의 점검 상태 보존, 실패 시 신규 경기 차단 및 패치 준비 거절, 재시작/백업 복원 검사. SQL 004 추가. Render는 검증된 수동 배포·첫 시작 점검 기본값. 타입 검사, 자동 테스트 545/545, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결 2/2, 225 덱 사전 검사 통과(외부 클라우드 미연결). 최신 누적 소스 `v061-source.patch`.
- v0.60 누적 소스 백업: https://chatgpt.com/library?file_id=libfile_a858e88df0608191b5d9a38678824e4d&account_id=personal .
- **v0.60.0 개발 후보:** 배포 URL 검증 CLI, 게스트 및 기존 테스트 계정의 두 세션과 역할/진행 기록/성장 버전 확인, 임시 세션만 폐기. 물리 기기와 실제 외부 계정 등록·배포 시험 체크리스트. 타입 검사, 자동 테스트 544/544, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 배포 연결 2/2, 225 덱 사전 검사 통과(로컬 합성 서버). 최신 누적 소스 `v060-source.patch`.
- v0.59 누적 소스 백업: https://chatgpt.com/library?file_id=libfile_b9e3bdc626a4819190d253d756cd3575&account_id=personal .
- **v0.59.0 개발 후보:** 같은 계정의 활성 방 상태 자동 표시 및 계정별 실시간 알림. 저장 확정 뒤에만 반영하며 방 코드·토큰·상대 정보는 제공하지 않는다. 자동 테스트 544/544, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 검사 통과. 실제 브라우저 시험 미검증. 최신 누적 소스 `v059-source.patch`.
- v0.58 누적 소스 백업: https://chatgpt.com/library?file_id=libfile_5a4aedb8d6e48191b9e7275b1681eaee&account_id=personal . 원본 학습 폴더가 없는 새 Git 작업트리 빌드/사전 검사에서 6,848게임 배포 모델 선택 확인.
- **v0.58.0 개발 후보:** 기존 2개 AI 챔피언의 카드 해시별 배포 스냅숏, 게임/오프라인 호환 모델 선택, 개발자 및 사전 검사 출처 표시. 타입 검사, 자동 테스트 543/543, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 기존 학습 데이터 파일은 v0.56 전체 소스와 동일. 실제 외부 배포·기기 미검증. 최신 누적 소스 `v058-source.patch`.
- v0.57 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_3bd4d69663988191bb9df347514c81a2&account_id=personal .
- **v0.57.0 개발 후보:** 실제 보유 카드로 생성하는 성장 추천 덱, 카드 검색·전력 필터·XP 진행률, 성장 설정 이전 백업 초안 복원. 타입 검사, 자동 테스트 541/541, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 외부 및 물리 기기 미검증. 최신 누적 소스 `v057-source.patch`.
- v0.56 전체 소스(오프라인 실행 및 기존 AI 데이터 포함): https://chatgpt.com/library?file_id=libfile_20c2cb32ce408191b5869f8a55353e7d&account_id=personal . ZIP 무결성 및 AI 파일 일치, 복원 폴더 타입 검사/빌드/사전 점검 통과(기존 설치 의존성 사용; 네트워크 제한으로 새 오프라인 npm 설치는 불가).
- v0.56 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_8c64a047ffa0819190883add8827aa14&account_id=personal .
- **v0.56.0 개발 후보:** 개발자 계정 점검/신규 경기 차단, 기존 대전 및 정산 유지, 계정 패치 준비 확인. 타입 검사, 자동 테스트 540/540, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 실제 클라우드·기기 미검증. 최신 누적 소스 `v056-source.patch`.
- v0.55 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_e6dd6a0dd9688191a710c1587e77715c&account_id=personal .
- **v0.55.0 개발 후보:** AI 취소·큐 대기 제한·안전 작업 스레드 교체, 개발자 운영 집계, 로컬 14소켓·12AI·1PvP 동시 대전 5라운드 시험. 타입 검사, 자동 테스트 539/539, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 동시 부하 소켓 119건 및 계정 조회 94건 성공. 실제 무료 서버와 실기는 미검증. 최신 누적 소스 `v055-source.patch`.
- v0.54 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_f7ae7f243d748191b3c8756b43fbc245&account_id=personal .
- **v0.54.0 개발 후보:** 실계정 로컬 DB 안전 백업/무결성 검사, 복원 후 기존 세션 재활성 방지, 합성 계정의 원장·덱·XP·미정산 방 복원 시험, 본인 성장 기록 다운로드. 타입 검사, 자동 테스트 536/536, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 실제 클라우드 및 실기 미검증. 최신 누적 소스 `v054-source.patch`.
- v0.53 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_345545e4b85c819193006b7485ba5917&account_id=personal .
- **v0.53.0 개발 후보:** 성장 속도 가상 예측과 로컬 개발자 결과표, 카드·성장 패치 225 덱 호환 검증, 충돌 사전 차단 및 시작 검사. 타입 검사, 자동 테스트 534/534, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 외부 서비스·실기 미검증. 최신 누적 소스 `v053-source.patch`.
- v0.52 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_d816126813588191bb093d7e1cb0cfbb&account_id=personal .
- **v0.52.0 개발 후보:** 서버 원장과 동일한 실제 대전 XP·보너스 및 신규 해금 카드·승급 표시, 25랭크 승급 기준과 9직업 퀘스트 진행표. 타입 검사, 자동 테스트 531/531, 렌더 31/31, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 실제 외부 서버 및 물리 기기는 미검증. 최신 누적 소스는 `v052-source.patch`.
- v0.51 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_1f79e6af28d48191af156b863b7fb4ee&account_id=personal .
- **v0.51.0 개발 후보:** 서버 AI 작업 스레드, 패치 뒤 비호환 과거 덱 유지 및 복원, 실제 랭크 AI 개발자 시험 모드(계정 성장 무변경). 17:04경 환경 복구 후 v0.51 작업을 이어갔다. 타입 검사, 자동 테스트 529/529, 렌더 30/30, 오프라인 2/2, 미리보기 7/7, 225 덱 사전 점검 통과. 실제 Chromium 브라우저 재시도는 환경의 socket() 권한 제한으로 시작 실패. 최신 누적 소스 `v051-source.patch`.
- v0.50 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_6c9bc900a9588191b8378ae1883da80c&account_id=personal .
- **v0.50.0 개발 후보:** 동일 계정 실시간 덱·XP·전적 동기화, 타계정 소켓 격리, 성장 패치 해시, 클라우드 시작 사전 점검, 랭크/연습 기록 분리. 타입 검사, 자동 테스트 525/525, 렌더 30/30, 오프라인 2/2, 미리보기 7/7, 배포 사전 자체 검사(225 합법 덱) 통과. 최신 누적 소스 패치는 `v050-source.patch`.
- v0.49 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_33f7f1f12500819191c71192933853ff&account_id=personal .
- **v0.49.0 개발 후보:** v0.48 위에 로컬 개발자 성장 설정 화면(`/growth`), 설정 변경 전 검증·백업, 패치로 획득한 카드 영구 지급, 계정 전적 AI/PvP 기록, 랭크별 XP 진입 조건과 해금 비용 조정 추가. 타입 검사, 자동 테스트 522/522, 렌더 30/30, 오프라인 2/2, 미리보기 7/7 통과. 최신 누적 소스 패치는 v0.45에서 `v049-source.patch`를 적용한다.
- v0.48 누적 소스 패치 백업: https://chatgpt.com/library?file_id=libfile_fccf5b9f7f708191bee4050094aaa034&account_id=personal .
- **v0.48.0 개발 후보:** v0.47 계정/랭크/PvP 기반 위에 계정방 DB 체크포인트, 저장 응답 전 지속 저장, 재시작/기기 이전/랭크 AI 저장 후 나가기, 미정산 결과 재처리, 비밀번호 변경 및 세션 일괄 폐기, SMTP 설정 전 꺼진 이메일 코드 복구, 랭크 덱 전력 누적 강화, 저용량 `/healthz`를 추가했다. 타입 검사, 자동 테스트 517/517, 렌더 30/30, 오프라인 2/2, 미리보기 7/7 통과. 실제 클라우드와 실기만 미검증이며 외부 계정은 만들지 않았다.
- v0.47 누적 전체 패치 백업: https://chatgpt.com/library?file_id=libfile_ef8351130d7c8191ad9b1ce3e931894e&account_id=personal . v0.48 최신 **소스 패치**는 기존 v0.45 기반에서 누적 적용하고 생성 HTML 파일은 `npm run test:offline-built`, `npm run test:preview`로 다시 생성한다.
- **2026-11-22 새 우선순위**: 카드 밸런스/AI 학습은 보류하고 계정·서버 동기화·성장 시스템을 먼저 개발한다. 사용자 승인 방향 및 설정/후속 단계는 `docs/ONLINE_PROGRESSION.md`에 기록했다. 기존 AI 데이터와 오프라인 기능을 보존한다.
- **v0.47.0 개발 후보**: 로컬 SQLite, 계정 등록/로그인/로그아웃, 여러 기기 덱·XP·랭크·퀘스트·보유 카드 동기화, 25단계 랭크 AI, 권한 분리, 보유 카드 PvP(친구 방/자동 매칭), 계정 대전 기기 이전, Supabase REST/Auth 어댑터 및 SQL/Render 설정 작성. 카드 밸런스/AI 학습 데이터는 변경하지 않았다. 실제 클라우드 배포 및 물리 기기 검증은 미완료. 진행 중인 계정 대전 및 미정산 기록은 서버가 재시작되면 유실될 수 있다. `docs/ONLINE_PROGRESSION.md` 참조.
- v0.47 검증: TypeScript 검사 통과, 자동 테스트 513/513, 렌더 30/30, 오프라인 빌드 2/2, 미리보기 7/7. 신규 브라우저 E2E는 Playwright 브라우저 미설치 및 시스템 Chromium socket() 권한 제한으로 미실행. 실제 Supabase SQL/Render 운영 연결 확인은 미완료.
- v0.45.0 후보 전체 ZIP: https://chatgpt.com/library?file_id=libfile_5947f3fd99548191ae76a6412aa44cf4&account_id=personal . 오프라인 실행 파일: https://chatgpt.com/library?file_id=libfile_183387165cec819188c1be7fb72e0e05&account_id=personal . 전체 ZIP에는 AI 학습 데이터와 Git bundle이 있다. v0.47 인계 패치는 이 v0.45 기반에서 누적 적용한다.
- 작업 디렉터리가 없으면 최신 `card-duel-v102-verified-source-and-play.zip` 전체 소스·실행 ZIP부터 별도 폴더에 복원한다. 기존 v0.91 이하 누적 패치는 과거 이력 복구용이며 최신 전체 소스에 다시 적용하지 않는다. 생성 HTML 미리보기는 재빌드한다. Git 상태와 기존 사용자 변경을 먼저 확인한다.
- v0.44.0 안정판을 인계받아 v0.45.0 자동 저장/이어하기 검증 후보 구현 완료. Git 기반으로 재구성(원래 안정판 1d23d99의 소스 복원). `docs/PROGRESS.md`, `docs/ROADMAP.md`, `README.md` 참조.
- 새 검증: 타입 검사, 자동 테스트 499/499, 렌더 30/30, 오프라인 2/2, 미리보기 7/7. 실제 Chromium 실행 권한 제한으로 IndexedDB 브라우저 E2E 미완료. v0.44 안정판도 유지한다.
- 9직업, 덱 카드 382개, 시스템 포함 443개, AI 1~25단계, 카드 관리/온라인 기능 그대로 유지.
- `data/ai` 백업 두 모델 전체 복원, 기존 체크포인트/챔피언 보존. 자동 학습은 별도의 재개 요청 전까지 실행하지 않는다.

## 다음 순서
PWA 웹페이지 + 로컬 저장 솔로 우선. 유저/개발자 모드, 25랭크, 독립 저장 슬롯 3개, 성장/덱 백업, 고정 주소 오프라인 앱 구조는 구현 후보 완료. 외부 서버 배포와 설치형 APK는 사용자 재개 요청까지 보류한다. 기존 온라인 기능 문서는 `docs/ONLINE_PROGRESSION.md`를 유지한다.
1. `npm ci`, `npm run typecheck`, `npm test`, `npm run test:render`, `npm run test:offline-built`, `npm run test:preview`, `npm run test:solo-app`, `npm run test:online-smoke`로 복원 상태를 검증한다.
2. `docs/SOLO-ACCEPTANCE.md` 순서대로 Windows PC 실기: `start-offline-app.cmd`의 고정 주소, 앱 설치, 실제 IndexedDB 저장/이어하기, 다운로드/복원, 슬롯 전환 및 다중 탭과 패치 데이터 보존 시험. 브라우저 제약 없는 환경에서 `npm run test:offline-browser`, `npm run test:solo-app-browser` 실행. 기존 브라우저/파일 저장 데이터 지우지 않는다.
3. PWA 모바일 화면/터치 및 로컬 저장 시험, 안전한 HTTPS 정적 배포 경로는 별도 승인 후에만 연결한다. Android APK 개발 후보 소스 `docs/ANDROID-APK.md`는 장기 보류(현재 SDK 없음, APK 미생성). PC/모바일 동기화는 향후 계정 온라인 기능으로 연결하며 로컬 백업을 경쟁 온라인 보상으로 신뢰하지 않는다.
4. AI 난이도 독립 시드 교차 검증 및 실제 구간별 실력 차 개선 계획. 현재 25개 탐색 설정과 설정상 덱 전력은 구분되지만 실전 승률은 엄격히 단조 증가한다는 증거가 없다. 원본 학습 데이터/카드 능력치 변경은 사용자와 합의할 때만 한다. 카드 밸런스와 온라인 배포는 후순위.

최신 전체 ZIP에는 `data/ai`, `solo-offline.html`, `dist/solo-app/` 및 추적 소스가 포함되며 `.git`/node_modules/재생성용 미리보기는 포함하지 않는다. 이전 저장본에 덮어쓰지 않는다. 다른 환경의 AI 데이터는 `import-ai-data.cmd`를 이용한다. 기존 Git 작업트리가 없으면 동일 소스 위에서 새 기록을 시작한다.

## 2026-11-23 03:00 KST — v0.128.0 후보 인계
- 기반: v0.127 Git `606b61d`, 원본 Git 전체 이력 + 증분으로 복원.
- 덱 편집 마나 분포 스크린리더 설명 및 3개 단위 테스트 추가. 카드 밸런스/AI 원본/학습 파일 변경 없음.
- Node 22에서 순수 함수 3/3 통과, Node 24/의존성 없음으로 전체 회귀·빌드 미실행. 최종 전체 검증판 v0.126 유지.
- 다음 실행은 이 후보 Git 번들과 소스 ZIP을 우선 확인하고 더 최신 검증 체크포인트가 있으면 그쪽에서 재개.

## v0.131.0 candidate — 2026-11-23 06:00 KST
- Restored v0.130 Git HEAD 85578f4 from v0.121 full history and incremental bundles. Existing AI, card stats, save schema untouched.
- Fixed classic hand-card hover/focus translating 34px even under prefers-reduced-motion: reduce; focus now retains a visible outline without motion.
- Added `scripts/test-reduced-motion.mjs`: 3/3 static CSS checks under Node 22.
- Node 24 and dependencies not available here; full regression, typecheck, render and build NOT run. v0.126 remains last fully verified release.
- Next: restore Node24/dependencies, full regression; physical reduced-motion/mobile/audio/FPS acceptance.

## 2026-11-23 10:01 KST — v0.144.0 candidate (NOT fully verified)
- Base: Library v0.143.0 verified ZIP `libfile_fa061a7cc4048191980400e7c2491301` (671/671, render49/49, PWA9/9, HTML2/2). Original ZIP has no `.git`; its full history was not reconstructed. Keep the v0.143 Git increment bundle `libfile_227550cc06ac8191aeed249016181f74` and older base history for integration; the candidate's temporary local Git is NOT the original lineage.
- Changed: `apps/client/src/battle-fx-model.ts`, `apps/client/src/battle-fx.tsx`, `apps/client/test/battle-fx.test.ts`.
- A summon with known card now inherits card theme instead of dust. Death particle/departure style requires explicit `death:true`; unknown or non-death removals receive exit styling. Added two focused tests.
- Blocked: runtime has Node v22.16.0 (requires Node24), no node_modules (React missing), full tests/build/browser not run. Existing v0.143 remains the latest fully verified release. Candidate must be tested on Node24 before promotion.
- No card/AI data or game rule edits. No online/PvP/AI training performed.

### 2026-11-23 13:47 KST candidate v0.218 — animated attack/death ghost snapshots made inert and aria-hidden; remove cloned nested duplicate IDs, faux target/action identifiers and tab stops. Two focused pure tests pass. Source-only candidate, Node24/browser build unavailable. Original card/AI/save rules untouched.

### 2026-11-23 13:48 KST candidate v0.219 — effect-choice dialog Escape now calls cancelCardChoice, restoring original hand-card focus rather than the generic window reset. Keyboard focus/CSS 6/6. Full Node24/browser build pending. Card/AI unchanged.

### 2026-11-23 13:49 KST candidate v0.220 — shared canvas particle painter saves/restores once for fire, shadow, steel and other unrotated types instead of per particle; nature retains per-leaf transforms. Deterministic positions verified 2/2 standalone tests; no card/engine changes. Native Vite/browser build pending Node24.

### 2026-11-23 13:52 KST candidate v0.221 — refinement of inert FX ghosts: SVG gradient/clip/mask ids are now uniquely namespaced and their internal URL/href/ARIA references rewritten instead of deleting ids, preserving animated art. Dedicated pure 3/3 regression tests. Node24 full build pending, data unchanged.

### 2026-11-23 13:53 KST candidate v0.222 — conflicting deck-backup rename now preserves complete surrogate pairs (emoji) at 40-char boundary, never creates broken name; original saved deck untouched. Focused storage tests 21/21 pass. All existing save schemas/card/AI data unchanged; full Node24 build pending.

### 2026-11-23 13:54 KST candidate v0.223 — offscreen accepted-combat markers name allied/enemy side and count, remain fully inside short phone canvas without revealing hidden card identities; pure focused tests 2/2, TS syntax okay. Game data/engine/save schemas unchanged. Node24 build pending.

### 2026-11-23 13:56 KST candidate v0.224 — omit high-DPR canvas allocation and requestAnimationFrame for ordinary turn/choice cues without public events, retain scheduled impact audio and any actual public effects; pure tests 3/3 and TS parser pass. No game-rule/card/save changes. Native Node24 build pending.

### 2026-11-23 16:46 KST — v0.235 candidate (source-only)
- `landscape-hand-preview.ts`: clamp expanded card geometry to the actual current arena field on narrow landscape devices. React layout effect refreshes on selection, focus, resize; cleanup listeners/observer.
- CSS both landscape layers use `--landscape-preview-shift` so border cards are visible without moving hit boxes. `test/landscape-hand-preview.test.mjs` 3/3; all landscape checks 25/25; engine 371/371 Node22 strip-types.
- Full Node24 and real phone E2E pending; do not promote v0.197 runnable HTML. Preserve all card/AI/save data. Next: touch/keyboard preview closure, portrait focus and safe-screen behavior, small-height battle toolbar and menu fit.

### 2026-11-23 16:48 KST — v0.236 candidate (source-only)
- Tap a non-playable card to read; Escape closes it even when `active` is false. Tapping away closes without swallowing the other action. `BattleCard` reports selected hand card expanded (`aria-expanded`), but not the mulligan selection.
- All landscape tests 28/28 (incl. regression update); engine 371/371 inherited from v0.235. No production build/real device testing on Node22 environment. Next: focus recovery when in landscape card picker, 44px controls across narrow canvas, orientation portrait lock fallback handling.

### 2026-11-23 16:52 KST — v0.237 candidate (source-only)
- Narrow touch-landscape rule now guarantees >=44px clickable action controls even at <=660px; the classic rule only covered >=661px. Bounded action strip scrolls independently and preserves the fluid arena. 30/30 landscape static/geometry checks.
- All card/AI/save data unchanged. Still no Node24 dependencies or physical E2E. Next: portrait/fullscreen fallback resilience and action overlay focus; then audit PWA upgrade/prebuilt readiness.

### 2026-11-23 16:55 KST — v0.238 candidate (source-only)
- Landscape/fullscreen capability attempts no longer share one catch; attempts independent and report manual-rotation fallback. Native fullscreen state still controls toggle; orientation unlock on exit/unmount; request ref fences double taps. Pure `landscape-mode.ts` tested for denial/unavailable branches.
- All landscape checks 34/34; engine 371/371 remains unchanged; missing Node24/dependencies and browser socket limits prevent new HTML build/real mobile verification. Next prioritize safe landscape overlay visibility, browser settings handoff, continued UI behavior regressions. Rebuild before promoting v0.197 executable.

### 2026-11-23 16:58 KST — v0.239 candidate (source-only)
- `dismissPeekOnHandFocus` plus hand focus/blur capture keeps only one landscape hand preview open when tabbing/arrows move focus. Touch previews remain direct taps; no battle actions added.
- Landscape tests 35/35; game data and engine unchanged. Next: inspect actual dynamic safe-area behavior, accessible focus on overlay after manual rotation, and persistent backups. Production HTML still v0.197.

### 2026-11-23 17:00 KST — v0.240 candidate (source-only)
- Mobile short landscape: `.battle.is-dragging` collapses selected/focused hand card visual to dock and hides inline copy, leaving the real drag source and pointer capture intact; prevents visual preview from covering a drop row. Tests 37/37 landscape; 82/82 client pure logic inherited.
- Full Node24/Vite build and actual mobile browser E2E still unavailable. Source-only vs verified v0.197 runtime labels must remain clear. Next: improve offline save resilience / focus after return to game and package Git/ZIP safely.

### 2026-11-23 17:03 KST — v0.241 candidate
- New dependency-free packager: `node scripts/package-source-candidate.mjs 241 /mnt/data/card_duel_output` after a clean Git commit. It includes `data/ai` gitignored champions/checkpoints (13 files), previous verified `dist/solo-app` and standalone `solo-offline.html`, verifies archive data SHA-256 and Git increment integrity. Explicit source-only release status prevents claiming v0.241 executable.
- IMPORTANT CORRECTION: v0.236 hand-packed candidate ZIP did not contain the 13 untracked AI training files; its originals are still intact in the working directory and earlier Library v0.234 backups. Use v0.241+ corrected ZIP, not v0.236 alone, to restore complete history. The cards and AI contents were NOT changed.
- Full Node24 build/real browser E2E still missing; v0.197 remains last runnable verified release.

### 2026-11-23 17:58 KST — v0.257 source candidate: bounded full-engine solo journey gate
- Added `npm run test:solo-journey`: a 90-second-bounded execution of 2 **real local engine** ranked AI games, checking accepted actions, final eligible results, in-battle checkpoint restores, rewards/progression settlement and growth backup round-trip. CI gate executes after unit tests and before build.
- Actual run: 2/2 matches complete, 85 accepted actions, 2 in-match restores, 1 backup round-trip. Parser failure regressions 3/3 pass. This is NOT human win-rate data or browser physical UX verification.
- An optional 25-rank exhaustive test progressed through rank 23 in output but timed out before completion. No 25/25 pass claim; prioritize bounded smoke in CI and separately schedule long diagnostics.
- No card/AI/champion/balance/save format changed. Node24 production build not available locally; last verified runnable remains v0.197.0.

### 2026-11-23 20:xx KST — v0.286 candidate (source-only)
- Installed PWA now hides redundant browser-fullscreen toggle; independent portrait rotation guide remains accessible. Displays resync on standalone/fullscreen media changes and window focus, with cleanup.
- Dedicated 2/2 static tests plus existing fullscreen and installed-display tests. Card/AI/checkpoints/save format untouched. Full Node24 build and physical-device UI are still pending; v0.197 is the last verified executable.

### 2026-11-23 — v0.287 candidate (source-only)
- Failed browser fullscreen requests on an already-rotated landscape screen now show an actionable and dismissible on-screen explanation (including installable PWA alternative), rather than only updating a hidden portrait guide. Feedback stays in a safe-area fixed overlay without expanding the game canvas.
- Focused tests 2/2; card/AI/balance/save data unchanged. The UI feedback has NOT been physically tested on a phone; verified executable is still v0.197.

### 2026-11-23 — v0.288 candidate (source-only)
- Returning from deck maker or opening it from within the play panel restores keyboard focus to the persistent corresponding game-menu tab on the next animation frame. Previously a disappearing in-panel button could strand keyboard and screen-reader users on the document body. Normal tab clicks keep their existing focus.
- Added identifiable menu-tab attributes and two focused tests. No card, AI, gameplay, or local-save schema change. Full Node24 build and phone E2E not available here; v0.197 remains last verified binary.

### 2026-11-23 — v0.289 candidate (source-only)
- When Battle unmounts after saving, leaving or completing a match, keyboard focus returns to the selected persistent lobby tab after React mounts the lobby. Initial lobby startup remains untouched; fast rematches cancel stale focus frames.
- Focused source tests 2/2; no gameplay, AI, card, or storage schema changes. Still source-only pending Node24/native-browser verification.

### 2026-11-23 — v0.290 candidate (source-only)
- The mandatory portrait rotation guide now stacks above the PWA update/install banner (70,000 vs 60,000), preventing a cache/update toast from intercepting the rotation action before the phone is turned sideways. Dedicated regression checks the real two stylesheets. No game-rule/AI/save change.
- Full latest Node24 build and physical mobile UI are still unverified; previously verified v0.197 game binary remains the standalone PWA fallback.

### 2026-11-23 — v0.291 candidate (source-only)
- Installable PWA update/install banner is visually deferred while `.game-main .duel-screen` is visible; `visibility:hidden;pointer-events:none` keeps it from covering attack/turn and choice controls and automatically reveals the same queued status on return to the lobby. No active patch is forced, no user save is erased. Modern `:has()` feature required; older browsers retain the dismiss button.
- Standalone PWA wrapper for the VERIFIED old game executable v0.197 rebuilt with new release hash; real old v0.197 package upgrade and rollback tests 18/18 passed, CSS source tests 2/2. New v0.291 React game source remains NOT COMPILED (Node24/dependencies unavailable). No card/AI/save schema changes.

### 2026-11-23 — v0.292 candidate (source-only)
- Hide noncritical denied-browser-fullscreen notice while a duel is mounted; it reappears on lobby, and the current match is never blocked by the feedback bubble. Portrait rotation guide and patch-error text unaffected. Focused regression added. No card/AI/balance/save change. Native Node24 build and real phone test still pending.

- Tightened legacy drag regression scope to its actual CSS rule; unrelated PWA overlays now safely use pointer-events:none without causing false failures.

### 2026-11-23 — v0.293 candidate (source-only)
- PWA defers ordinary installation and patch-ready banners during matches but keeps critical asset integrity, install failure and cache validation warnings visible with data-urgent. Asset-load watchdog flags critical failures. This prevents hidden corruption notices during an active match; controls and data unchanged. PWA installer v0.197 requires rebuild for this shell change.

### 2026-11-23 — v0.294 candidate (source-only)
- Added dependency-free reproducible `scripts/package-playable-pwa.mjs`: validates content-addressed service worker hashes for all 7 cached assets, confirms real v0.197.0 compiled JS/CSS byte equality with verified standalone, checks landscape PWA manifest and refuses archive overwrite. Produces ZIP with only verified 8 PWA assets plus explicit install instructions; does NOT claim v0.294 React source is built. 2 focused packaging tests. Saved-card/AI/checkpoint contents untouched.

### 2026-11-23 — v0.295 candidate (source-only)
- Integrated reproducible playable-PWA integrity ZIP into Node24 CI only AFTER full typecheck, gameplay tests, React build, PWA upgrade tests, and preflight succeed. Packager tests now use the real stamped package version instead of hardcoding v0.197, allowing eventual fully compiled candidate releases. CI automatically uploads standalone HTML, PWA folder and verified PWA ZIP as one 7-day test artifact; does not publish or install on devices. Existing v0.197 binary remains unchanged locally; no online deployment.


### 2026-11-23 21:19 KST — v0.296 source candidate: make real-browser playability a release gate
- Prioritized obtaining a genuinely usable installed landscape PWA, rather than new cards or AI 25-level tuning.
- Added compiled-PWA Chromium release test covering landscape lobby → mulligan → first turn, no whole-document horizontal/vertical scroll at 844×390, 667×375 and 1024×600, vertically aligned heroes, a usable Turn End button and no page JS errors.
- Updated existing PWA offline-save-and-resume browser test from portrait to landscape to match the new rotation policy.
- CI now installs Chromium and runs both browser tests after fresh Node24 build/PWA verification and before preflight/artifact publication; a browser failure blocks publishing test artifacts.
- Locally verified: playable core 646/646, PWA emulator 17 passed/1 skipped, frontend syntax 65 files and data baseline intact. In actual Chromium, previously compiled v0.197 launched an AI battle, completed starting hand and reached turn 1 with no page exceptions; its 844×390 document still has vertical overflow (not the v0.296 code).
- Blockers: Node24 + pinned React/Vite npm packages unavailable in this isolated runtime, so v0.296 full build and new HTTP/Chromium E2E have NOT run. Existing executable v0.197 must remain separate. No external deployment or live phone test.
- Next: push complete latest candidate source to GitHub then run .github/workflows/validate-playable.yml; fix failures and publish HTTPS PWA only after a complete passing build; verify phone touch, install and persistent saves.

### 2026-11-23 candidate v0.296 — finish a playable build, do not add features
- User priority explicitly changed to producing a **real playable landscape PWA** before AI-25 tuning, fresh cards, cosmetics, or additional UI micro-patches.
- Added a safe **gitless source ZIP build path** (`BUILD-PLAYABLE.cmd`, `BUILD-PLAYABLE.sh`, `scripts/build-local-playable.mjs`) for a computer with Node24/npm registry access. It reads the source-only `RELEASE-STATUS.txt` marker, verifies pinned release-baseline data, stamps the actual candidate version, runs all build/test/render/PWA/upgrade checks, and only then exports standalone HTML, installable PWA ZIP and SHA-256 validation report.
- If Node24/network/dependencies/tests are unavailable, the builder refuses promotion and restores the previous verified game.js/CSS/PWA, original package version metadata and standalone file. Local preflight tests 4/4, combined packaging/CI tests 9/9, frontend parser 65 source files, immutable data checks all passed.
- In the tool environment, Node 22.16.0, no npm cache and registry DNS disabled: `npm ci --offline` fails (`xmlhttprequest-ssl` missing). A full `NODE_OPTIONS=--experimental-strip-types npm test` ran 703 cases: 679 passed, 24 test files failed solely due `ERR_MODULE_NOT_FOUND` for react/socket.io; **not a Node24 full pass**. The dependency-free playable-core subset 650/650 passed and two engine-vs-AI matches/85 actions/2 saves plus progression backup passed. Standalone prebuilt PWA tests passed with 1 expected browser skip.
- Real mobile physical UX, current candidate React render, Vite compilation, and deployed HTTPS PWA remain unverified. **Do not call v0.296 an executable.** v0.197 remains last compiled/verified player binary.
- Next action: on Node24/npm network-capable machine extract candidate ZIP and run `BUILD-PLAYABLE.cmd` (Windows) or `sh BUILD-PLAYABLE.sh` (Mac/Linux), inspect generated `playable-release/` outputs, run Android/PC real-device playthrough, only then promote newest release and deploy HTTPS. Save original on-device IndexedDB before changing app origin. Existing card/AI data preserved; final AI 25-stage quality tuning postponed.


### 2026-11-23 21:24 KST — v0.297 integrated source candidate (two v0.296 branches merged)
- Reconciled concurrent v0.296 source branches; preserved both the gitless Node24 local build helper (6ecafe0) and the compiled-PWA real Chromium landscape release gate (4a4f914).
- Local builder now installs Chromium and requires both complete offline PWA save/resume browser test and landscape no-scroll/hero-alignment test before promoting a new compiled playable artifact. Failed build retains old compiled executable.
- Build remains source-only on this isolated Node22 host without npm/React/Vite dependencies; a device/online release must not be claimed until full Node24 CI/local build and human phone testing pass.

### UI battle overhaul · Phase 1

- Added standalone home navigation and focused battle setup, with slot, progression, settings, and account dialogs.
- Node 24 typecheck, 4 navigation/focus checks, and Chromium landscape PWA first-turn test passed.

### UI battle overhaul · Phase 2

- Added class-to-neutral book navigation, responsive spreads, filter dialogs, and paginated deck lists.
- Eight focused checks passed. Real Chromium verified the class boundary in both directions and card detail on desktop.

### UI battle overhaul · Phase 3

- Removed the name switch and always display classic card names, including public battle history. All 443 cards and tokens have mappings.
- Added 100 ms mouse hand enlargement and 120 ms sibling movement. Removed the always-open arena inspector while keeping explicit card details. Typecheck and 21 focused tests passed.

### UI battle overhaul · Phase 4

- Added cancellable FIFO reservations, a four-intent limit, duplicate suppression, and revalidation against the latest approved view before each worker/server request.
- Three queue tests passed. Chromium accepted and cancelled an end-turn reservation during a summon, then saved and resumed the approved position.

### UI battle overhaul · Phase 5

- Normal summons now reveal the public card, draw a summoning circle, and land over 2 seconds on either side. Reused the serial playback timeline and tied FX cleanup to each cue. Fast and instant modes remain available.
- Chromium observed a single FX layer, a two-second summon, a reserved end turn, and the AI card reveal.

### UI battle overhaul · Phase 6

- Added illustrated public-action history, with source and target portraits, damage and defense details, desktop hover and keyboard focus, and a compact landscape history drawer.
- Chromium verified two queued commands during a summon, then summon → summon → end turn with one active FX layer. Offline PWA save continuity, separate slots, and combined backup/restore passed.
- The candidate build stamps v0.298.0 in an isolated build copy. Verify physical Android/iOS touch and audio plus a direct update from the original v0.197 build before any release.

## v0.299.0 candidate follow-up for specification 1618575

- Base implementation for steps 1–5 is in b5cea3e through f4d80be. a184698 adds the history rail and offline regression coverage. c877855 adds immediate deck row and mana-cost feedback in `App.tsx` and `landscape-shell.css`.
- Step 6 follow-up f25a874 adds pending card/attack numbers in `Battle.tsx` and ordered public-event captions in `battle-sequence.ts`. A timed turn can submit a validated reservation after acknowledgement while the old animation is playing. The displayed adjudication deadline comes from the latest worker/server view. Untimed duels use the existing presentation gate. No clock or save rule was changed.
- Step 7 follow-up 6b590a6 adds the empty approved embedded-voice registry and integrity gate in `voice-clips.ts`, playback/stop in `dialogue-voice.ts` and `battle-sound.ts`, and action-bound cancellation in `battle-dialogue-ui.tsx`. Existing nine hero profiles, tribe defaults and unique card lines are retained. Effects are original Web Audio synthesis. No original recording, third-party audio or music was added. The candidate uses device-local Korean speech then captions and effects.
- To add an approved clip, record its source, license and redistribution approval, encode the bytes in the registry, and use key `hero:<class>:<kind>` or `card:<id>:<kind>` with the SHA-256 of the decoded bytes. Verify rights separately from the metadata checker. Verify the sound and decode fallback on target devices with effects at 0, dialogue at 0, mute, tab hidden, fast and instant playback, and during two reserved summons. Verify the gesture unlock with effects pre-set to 0 after adding clips. The unlock path now allows this when the registry is populated. No licensed clip or real-device listening was available.
- The sequence renderer shows public combat, damage, shield, healing, death and secret activation in trace order. Newly present public units can be labeled at the end. The trace lacks explicit trigger ownership/order for deathrattles and intermediate summons, including units summoned and removed within the same action. The current renderer keeps aggregate particles and board commits at the impact beat. Next, extend the presentation-only trace and its redaction tests before staging individual state/particle beats. Do not derive causes from a final-board diff.
- Reservation badges currently mark the visible source card or attacker. To add target badges and an explicit per-action accepted/denied/canceled treatment, bind each badge to the pending intent and clear it on the corresponding acknowledged revision. Never use future unpublished target art.
- Timed multiplayer still has a presentation/authority edge case when an opponent's queued effects are still on screen as the new authoritative turn starts. An already visible legal reservation can be dispatched promptly, while newly available controls depend on the visible revision. Reproduce with an 8-second turn in two local browser contexts and an opponent combo, record authoritative and visible timestamps, then decide a playback catch-up policy without extending the server deadline. Add a Chromium matrix for targeting/cancel and mulligan focus, 1–10 cards, 0–7 minions, reconnect, save failure, and multi-hit chains. Unit checks cover applicable existing engine and UI paths. This session does not certify the exhaustive browser matrix.
- Steps 7–8 real Android/iOS installation, physical touch and real listening, a direct v0.197 upgrade (original binary unavailable), and live remote PvP remain open. Review third-party names and all assets before a public release. Keep approved v0.297 artifacts and all baseline data untouched.
- To reproduce the v0.299.0 candidate locally, export the work branch to an isolated directory with `git archive HEAD`. In that copy set the first line of `RELEASE-STATUS.txt` to `v0.299.0 is a SOURCE-ONLY candidate; combat feedback and offline audio.` and its baseline line to `Build baseline: PREVIOUS VERIFIED v0.297.0.` Run Node.js 24.22.3 and `npm run build:playable-local -- <output-directory>`. To rerun the real prior-cache test, point `CARD_DUEL_PREVIOUS_RELEASE_DIR` at the complete v0.298.0 PWA distribution. Same-origin browser save continuity is separate from cache integrity and should be tested with a throwaway Chromium profile.
- Final verification used source c726c63. The local release gate passed with 843 full tests, 653 core tests, 61 React render tests, 18 PWA cache and rollback tests with the v0.298.0 PWA as the previous release, two Chromium PWA tests and two package tests. Standalone checks passed twice (structure and complete worker exchange). Chromium also passed five viewport deck checks, mouse targeting/Escape/mulligan focus, touch-emulated summon and history, A→B→C playback, and a real local-worker fixture with two commands accepted in a 1.85-second remaining turn. The final v0.298.0 → v0.299.0 same-origin upgrade preserved the ranked hand during offline resume. The device-voice path was exercised with emulated speech voices, not auditioned.
