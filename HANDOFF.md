# Card Duel 재개 인계 — 2026-11-22

사용자 규칙: `ㄱㄱ` 입력 시 다음 한국 시간 짝수 정각까지 실제 개발하고, 단계 완료 시 다음 단계에 착수한다. 중단 요청 시 즉시 중단. 실행 환경 제약으로 먼저 종료되면 실제 시각과 미완료 지점을 기록한다. 솔로 AI 대전 우선, 기존 기능/밸런스/AI 데이터 보존, 자동 회귀 검사 및 Git/ZIP 체크포인트 필수. 새로운 대형 모드는 사용자와 합의 후 개발한다.

## 상태
- **2026-11-22 21:39 KST, GitHub 배포 소스 업로드 완료 (v0.91.0 유지):** `Sonjuwan/card-duel`의 비공개 `main`에 원본 로컬 커밋 `f823e82446e552c5844badcb5479408dedfdb8cf`에서 생성한 배포 소스 717개(텍스트 290, WebP 427) 반영. 원격 커밋 `b7e92084a0fc3055459e62375612ce10ea8d4b08`, 배포 트리 `a9bb45f8cfbda59d93731fdd5c25308ad462cf3b`는 로컬 필터링 트리와 정확히 일치한다. 생성 미리보기 HTML/스크린샷 19개는 배포에 불필요하여 제외했고 원본은 로컬과 ZIP에 보존. 활성 카드 SHA-256 동일, 원본 학습 폴더 변경 없음, 두 배포용 AI 챔피언 포함. 원격 main 및 package/version, render.yaml, SQL 006, 카드, 챔피언 파일을 다시 조회했다. CLI 기기인증은 실행 네트워크 정책으로 실패하여 연결된 GitHub 권한으로 원본과 일치하는 트리 및 새 원격 커밋을 만들었으며, 기존 전체 Git 기록은 로컬에 남아 있다.
- **정확한 배포용 트리 복원 검증:** 기존 설치 의존성을 사용한 별도 로컬 작업 폴더에서 타입 검사, 프로덕션 빌드, 배포 사전 점검(225 덱 / 900 전력, release AI 6848게임), 회귀 테스트 598/598, 로컬 온라인 승인/프로세스 시험 9/9 통과. 실제 Render `npm ci`, Supabase PostgreSQL 실행, 외부 HTTPS 접속 및 물리 기기 시험은 미확인. Supabase/Render ChatGPT 앱은 21:39 KST 조회 기준 미설치라 관리 API에 연결할 수 없다. 사용자 앱 연결이 필요하다. 다음: 실제 무료 프로젝트 확인 및 SQL 001~006 적용, Render 무료 수동 배포, 온라인 승인 실행. 현재까지 비용 발생 작업 없음. 22시 보고 예약 유지.
- **2026-11-22 20:58 KST, 실제 클라우드 연결 재개 (v0.91.0 유지):** 이전 작업의 로컬 Git `db439042f707cde2a585b5a6ea099e6f0456e14d`를 `/workspace/scratch/64dfd91f5913/card-duel`로 복원했다. `data/ai` 원본 비교는 차이 없음, 활성 카드 SHA-256 `37a046b416aeb55c2b4afd1a85662c069bfa30f442c8c411895ba4646eb9b94e` 동일. 실제 재실행 타입 검사, 자동 테스트 598/598, 빌드, 배포 사전 검사(225 덱, 900 전력), 로컬 온라인 승인/프로세스 시험 9/9 통과. 외부/물리 시험은 아님.
- GitHub `Sonjuwan/card-duel` 비공개 저장소 읽기/쓰기 권한 확인. 빈 저장소에 `.gitignore` 초기 커밋 `3ce3bef3deaa517a124cef46ae8ded32ad079d15` 생성. 원본 Git 객체 다수 바이트 업로드 시도는 중단했으며 `package.json` 404로 확인: 전체 소스 브랜치 동기화 미완료. 원래 로컬 Git 기록과 ZIP 보존. 직접 Git 푸시는 현재 CLI 인증 없음(비밀 값을 채팅에 받지 말 것). 다음 단계 정상 인증 경로에서 전체 소스 및 Git 기록을 동기화하고 검증한다.
- Supabase 관리 대시보드에 새 작업 브라우저 로그인 필요; 사용자가 GitHub 로그인 방법을 선택했으나 GitHub에서 아이디/비밀번호 오류 반환. 사용자 로그인 확인 전 SQL 001~006 미실행, Render 서비스/환경 설정 미확인, 공개 HTTPS URL 없음. 비용 발생 작업 없음. 권한 연결 후 무료 플랜 확인, SQL 001~006 순서 적용, Render 웹서비스 수동 무료 배포, `online:smoke`, 폐기 가능 계정 `online:acceptance`, 실기 PC/모바일 시험 실시. 기존 카드/학습 AI 재학습 금지. 오늘 22시 KST 중간보고 예약 활성 상태 확인.
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
- 작업 디렉터리가 없으면 위 v0.45 ZIP의 `card-duel`를 복원하고, 최신 v0.91 인계 ZIP의 `v091-source.patch`를 프로젝트 루트에서 `git apply --check` 후 `git apply` 한다. 누적 패치에는 v0.46~v0.91 작업도 포함돼 있다. 생성된 HTML 미리보기와 오프라인 파일은 재빌드한다. 이미 반영된 변경은 중복 적용하지 않는다. Git 상태와 기존 사용자 변경을 먼저 확인한다.
- v0.44.0 안정판을 인계받아 v0.45.0 자동 저장/이어하기 검증 후보 구현 완료. Git 기반으로 재구성(원래 안정판 1d23d99의 소스 복원). `docs/PROGRESS.md`, `docs/ROADMAP.md`, `README.md` 참조.
- 새 검증: 타입 검사, 자동 테스트 499/499, 렌더 30/30, 오프라인 2/2, 미리보기 7/7. 실제 Chromium 실행 권한 제한으로 IndexedDB 브라우저 E2E 미완료. v0.44 안정판도 유지한다.
- 9직업, 덱 카드 382개, 시스템 포함 443개, AI 1~25단계, 카드 관리/온라인 기능 그대로 유지.
- `data/ai` 백업 두 모델 전체 복원, 기존 체크포인트/챔피언 보존. 자동 학습은 별도의 재개 요청 전까지 실행하지 않는다.

## 다음 순서
새 방향의 다음 순서는 `docs/ONLINE_PROGRESSION.md`를 우선한다. 아래 v0.46 AI 평가 작업은 후순위로 보류한다.
1. `npm ci`, `npm run typecheck`, `npm test`, `npm run test:render`, `npm run test:offline-built`, `npm run test:preview`로 복원 상태를 검증한다.
2. 실제 Windows/Galaxy S24 브라우저에서 `solo-offline.html` 직접 실행 및 로컬 서버 기기 AI에서 저장/새로고침/이어하기/다중 탭/리매치 시험. 파일 직접 열기에서 IndexedDB를 차단하면 저장 불가 표시 확인 및 로컬 서버 방식 제안. `npm run test:offline-browser` 실행.
3. v0.46 작업의 독립 AI 강도 평가 및 후보 풀 개선: 강화된 벤치마크와 과거 챔피언 이식 후보, 실험 정책 3 포함. TypeScript/자동 테스트 502/502. 정책 3은 정책 2 대비 8승 10패로 채택하지 않았다. 이어서 더 많은 독립 시드로 기존 모델/정책 비교, 전술별 실패 위치 추출 및 후보 개선을 한다. `docs/PROGRESS.md` 및 `docs/AI_TRAINING.md` 참조. 실기 성능 측정 및 솔로 UX는 별도 진행. 현재 호스트 벤치마크 결과는 물리 기기의 결과가 아니다.
4. 카드 판정 세부 회귀 검사. 온라인은 후순위.

ZIP을 복원한 경우 `data/ai`가 제공되어 있으며 이전 저장본에 덮어쓰지 않는다. 다른 환경의 데이터는 `import-ai-data.cmd`를 이용한다. Git 기록은 ZIP의 Git bundle을 이용하거나 동일 소스 위에서 새 기록을 시작한다.

## 차세대 독립 AI 연구 재개 지점

- 브랜치 `ai-research-foundation`. 원본 기준 `641104107a1306c99c78487f57f355dec407889d`(v0.91.0). 재개 시 이 브랜치의 최신 검증 커밋과 `git status`를 확인한다.
- 계획은 `MASTER_PLAN.md`, 항목 상태는 `docs/PROGRESS.md`, 실행 결과는 `docs/TEST_RESULTS.md`를 읽는다.
- 연구 베이스라인을 재현하려면 `npm run benchmark:research -- 9 release`를 실행한다.
- 최종 수정 명령은 `MASTER_PLAN.md`에 통합했다. 연구 풀은 현재 합법 카드 전체이며 카드 점수는 기본 카드 전체 평균 100점의 단일 척도다. 실제 게임 진행·보유 카드 자료는 별도로 회귀 검사한다.
- 공개 추론 검증을 재현하려면 `npm run benchmark:inference -- holdout 18` 및 `npm run benchmark:inference -- holdout 18 actions cards`를 실행한다. 카드 평가를 재현하려면 `npm run benchmark:card-value -- --card blizzard --card wisp`를 실행한다.
- 정책 4의 공개 치명 반격과 연구 승격은 `npm run train:matchups -- --groups 16`으로 재현한다. 같은 경로에서 이어서 실행하면 유효 묶음 수와 후보 상태가 유지된다. 검증 결과는 `docs/TEST_RESULTS.md`에 있다.
- 다음 핵심 작업의 권장 추론 수준은 Extra High다. 장기 실경기에서 독립 후보의 승격과 통합 배포 전 검증 결과를 확인한다. 기존 후보만 마무리할 때는 `train:matchups -- --finish-validation`, 통합 결과를 확인할 때는 `verify:integrated-ai`를 사용한다. 더 넓은 전술군 및 상대 집단 일반화, 통합 관리 화면과 Windows 검증이 남았다.
- 재개 입력 예시 — “Card Duel 차세대 AI 연구를 ai-research-foundation의 HANDOFF.md부터 이어서 개발하고 검증해 주세요.”

### 컨트롤 연구 인계 (2026-11-28 KST)

`c88ff2c`에서 시작해 미드레인지 정책 4를 고정했다. 컨트롤의 10가지 설정을 개발 2,160경기로 비교했고 정책 4·혼합 0%를 고정했다. 독립 576경기에서 전체 +1.04%p와 p=.500, 컨트롤 −4.17%p 및 어그로 −8.33%p였다. 검증 기준을 통과하지 못해 승격·배포 승인을 보류했다. 동일한 덱과 시드에서 기존 컨트롤과 비교한 차이는 −1.39%p였다. 이후 공개 반격, 추론, 평가 계수를 별도 연구로 이어갔다.

같은 작업 공간에서는 `/workspace/work/matchup-smoke-c657ced/matchups-v1/4fda1c70ee9d13b2bafdc894021b7d550081b92c524d5b9aa100904d48307afb/checkpoint.json`과 `/workspace/work/control-{development,confirmation}-v1.json`으로 재검증할 수 있다. 보고서 생성과 판정 명령은 `docs/AI_TRAINING.md`, 실측과 후속 방향은 `docs/TEST_RESULTS.md`에 있다. 사용자가 1시간 단위를 지정한 경우 판정을 마친 실험에서 다음 구현·검증으로 이어간다.
