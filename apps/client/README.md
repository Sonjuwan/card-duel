# Client

React + TypeScript UI. `npm run web`으로 빌드 및 서버를 시작한다. 덱 편집/저장, 로비, 멀리건, 전장, 공격/대상/효과 선택, 영웅 능력, 턴 종료, 항복, 재접속을 제공한다. 서버의 `/api/catalog`로 공개 카드 정의를 받고 `PlayerView`만 렌더링한다. 사용자 행동을 Socket.IO로 서버에 전달하며 화면에서 승패를 독자적으로 판정하지 않는다.
