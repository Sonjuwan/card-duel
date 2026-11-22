import {networkInterfaces} from 'node:os';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateBindHost} from '../server/config.ts';

export type LanAddress={name:string;address:string;internal:boolean};
export function lanAddresses(readInterfaces=networkInterfaces):LanAddress[]{
  try{return Object.entries(readInterfaces()).flatMap(([name,items])=>(items??[]).filter(item=>item.family==='IPv4'&&privateBindHost(item.address)).map(item=>({name,address:item.address,internal:item.internal})));}
  catch{return [{name:'Loopback (adapter enumeration unavailable)',address:'127.0.0.1',internal:true}];}
}
export function parseLanTestArgs(args:string[],addresses:LanAddress[]){
  if(args.length===0||args.length===1&&args[0]==='--list')return {mode:'list' as const};
  if(args.length!==2&&args.length!==4||args[0]!=='--host'||args.length===4&&args[2]!=='--port')throw new Error('사용법: npm run lan:test -- --list 또는 --host 사설IPv4 [--port 3000]');
  const host=args[1],port=Number(args[3]??3000);
  if(!privateBindHost(host)||!addresses.some(item=>item.address===host))throw new Error('현재 PC의 사설 IPv4 주소만 사용할 수 있습니다. --list로 확인하세요.');
  if(!Number.isInteger(port)||port<1024||port>65535||args[3]!==undefined&&!/^\d+$/.test(args[3]))throw new Error('포트는 1024~65535의 정수여야 합니다.');
  return {mode:'start' as const,host,port};
}
/** Never inherit a configured production account backend or account DB. */
export function lanTestEnv(base:NodeJS.ProcessEnv,root:string,host:string,port:number):NodeJS.ProcessEnv{
  const env:NodeJS.ProcessEnv={...base,CARD_DUEL_HOST:host,PORT:String(port),CARD_DUEL_ACCOUNT_BACKEND:'local',CARD_DUEL_ACCOUNT_DB:resolve(root,'data/accounts/lan-test.sqlite'),CARD_DUEL_PUBLIC_DEPLOY:'0',CARD_DUEL_PUBLIC_ORIGIN:'',CARD_DUEL_EMAIL_RECOVERY:'0',CARD_DUEL_MAINTENANCE:'0'};
  for(const key of Object.keys(env))if(key.toUpperCase().startsWith('SUPABASE_'))delete env[key];
  return env;
}
if(import.meta.main){
  try{
    const addresses=lanAddresses(),selection=parseLanTestArgs(process.argv.slice(2),addresses);
    if(selection.mode==='list'){
      console.log('This PC: private IPv4 adapters (choose trusted Wi-Fi/Ethernet, not a public network).');
      for(const item of addresses)console.log(`${item.address}  ${item.name}${item.internal?' (PC only)':''}`);
    }else{
      const root=fileURLToPath(new URL('../../',import.meta.url));
      if(!existsSync(resolve(root,'dist/client/index.html')))throw new Error('먼저 npm run build를 실행하세요.');
      console.log(`LAN test URL: http://${selection.host}:${selection.port}`);
      console.log('TEST ONLY: unencrypted private LAN HTTP; use fictional test credentials. No port forwarding. Separate local test DB: data/accounts/lan-test.sqlite');
      const child=spawn(process.execPath,['apps/server/main.ts'],{cwd:root,env:lanTestEnv(process.env,root,selection.host,selection.port),stdio:'inherit'});
      const stop=()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');};
      process.once('SIGINT',stop);process.once('SIGTERM',stop);
      child.once('error',()=>{console.error('테스트 서버 시작 실패');process.exitCode=1;});
      child.once('exit',(code,signal)=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);process.exitCode=code??(signal==='SIGTERM'?0:1);});
    }
  }catch(error){console.error(error instanceof Error?error.message:'LAN 시험 실행 실패');process.exitCode=1;}
}
