# Server

Node.js + Socket.IO 서버. 방 코드, 인증된 플레이어 식별, 재접속 토큰, 행동 순서 및 revision 검증, 플레이어별 상태 투영을 담당한다. `GameState`는 서버 내부에만 유지하고 `getPlayerView`의 결과만 전송한다. `npm run server`를 실행하면 이전에 빌드된 웹 화면을 제공한다. 기본 127.0.0.1, 지정한 사설 IP(`CARD_DUEL_HOST`) 또는 지정한 사설 HTTPS 프록시 출처(`CARD_DUEL_PUBLIC_ORIGIN`)로만 운영한다. 별도 보안 검토 전에는 공인망에 직접 공개하지 않는다.
