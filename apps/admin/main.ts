import { createAdminServer } from './admin-server.ts';
const port=Number(process.env.BALANCE_PORT??3001);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('잘못된 BALANCE_PORT');
createAdminServer().listen(port,'127.0.0.1',()=>console.log(`밸런스 편집기: http://127.0.0.1:${port} (내 컴퓨터 전용)`));
