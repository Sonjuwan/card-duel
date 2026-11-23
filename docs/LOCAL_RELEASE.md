# 오프라인 로컬 배포본 제작

원본 카드·AI·저장 데이터는 이 과정에서 수정하지 않는다. 외부 서버로 배포하거나 운영 계정 정보를 내보내지 않는다.

## 검증 후 패키징

1. Node 24, npm 의존성, `git`, `zip`, `unzip` 명령을 준비한다. `npm run typecheck`, `npm test`, `npm run test:render`를 실행한다.
2. 직전 실제 배포본의 `dist/solo-app` 복사본이 있으면 `CARD_DUEL_PREVIOUS_RELEASE_DIR=../v193-solo-app npm run test:solo-app`처럼 업데이트/롤백 검사를 실행한다. 이 예제의 경로는 **v0.194.0 기준**이므로 이후 버전은 직전 버전 경로로 바꾼다.
3. `node --test apps/client/test/standalone-build.test.ts`, `npm run build`, `npm run verify:deployment`을 실행한다. Chromium E2E의 실제 구동 여부는 별도로 명시해야 한다.
4. 변경된 소스, 버전, 기록, 빌드 산출물 `solo-offline.html`을 하나의 Git 커밋으로 확정한다. `git status --short`가 비어 있어야 한다.
5. `npm run package:local-release`을 실행한다. 생성할 파일이 이미 존재하면 안전하게 거부한다.

스크립트는 작업 폴더가 아닌 **Git `HEAD`에 확정된 소스**만 소스 ZIP에 넣는다. 큰 미리보기 HTML 네 개는 제외하며, 테스트한 `dist/solo-app`의 8개 리소스와 `data/ai`를 추가한다. 단독 HTML과 설치형 게임 JS/CSS 일치, 서비스 워커 리소스 SHA-256, ZIP 무결성 및 Git 변경분 번들을 확인한 뒤 상위 폴더에 다음 파일 세 개와 검사 전용 폴더 하나를 만든다.

- `card-duel-v194-source-and-play.zip`: 소스 + 설치형 오프라인 실행 파일 + 보존된 AI 데이터
- `card-duel-v194-git-increment.bundle`: 정해진 공통 Git 기준점에서 이어지는 증분 이력(단독 Git 전체 저장소가 아님)
- `Card-Duel-v0.194.0.html`: 별도 서버 없이 열 수 있는 단일 HTML 실행판
- `v194-solo-app/`: 같은 설치형 릴리스의 검사 전용 스냅숏. 다음 버전의 `CARD_DUEL_PREVIOUS_RELEASE_DIR`로 사용하며 소스 ZIP에 이미 포함되어 있어 별도 공유할 필요가 없다.

모바일/Windows 실기 실행, 사용자의 현재 로컬 저장 기록, 외부 배포/클라우드 서비스 연결은 이 로컬 패키징에 포함되지 않는다.
