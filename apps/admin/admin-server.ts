import { createServer } from 'node:http';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { RuleError } from '../../packages/engine/src/index.ts';
import { CardStore } from '../server/card-store.ts';
import {analyzeBalance,parseBalanceConfig} from './balance-analysis.ts';
import {BalanceLab} from './balance-lab.ts';
import {CARD_KIND_MECHANICS} from '../../packages/engine/src/card-schema.ts';
import {GrowthConfigStore} from '../server/growth-store.ts';
import {buildGrowth,DEFAULT_UNLOCK_XP} from '../../packages/progression.ts';
import {simulateGrowth} from '../../packages/progression-simulation.ts';
import {auditRankedDecks} from '../../packages/progression-audit.ts';
import type {GrowthView} from '../../packages/account-protocol.ts';
const forecast=(growth:GrowthView)=>[35,50,70].flatMap(win=>[true,false].map(quest=>simulateGrowth(growth,win,quest)));
function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(data));}
async function body(req:IncomingMessage):Promise<Record<string,unknown>>{
  if(!req.headers['content-type']?.startsWith('application/json'))throw new RuleError('JSON 요청만 허용합니다.');
  let length=0;const chunks:Buffer[]=[];for await(const chunk of req){const b=Buffer.from(chunk);length+=b.length;if(length>512*1024)throw new RuleError('요청이 너무 큽니다.');chunks.push(b);}
  const data:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new RuleError('잘못된 요청');return data as Record<string,unknown>;
}
export function createAdminServer(store=new CardStore(),growthStore=new GrowthConfigStore()){
  const lab=new BalanceLab();
  const server=createServer(async(req,res)=>{
    try{
      // Loopback-only server plus Host and Origin checks, not reachable from game server.
      const port=req.socket.localPort,host=req.headers.host;
      if(host!==`127.0.0.1:${port}`&&host!==`localhost:${port}`){json(res,403,{error:'로컬 주소에서만 접속 가능합니다.'});return;}
      if(req.headers.origin&&req.headers.origin!==`http://${host}`){json(res,403,{error:'허용되지 않는 출처입니다.'});return;}
      const path=(req.url??'/').split('?')[0];
      if(req.method==='GET'&&['/','/admin.js','/growth','/growth.js'].includes(path)){
        const file=path==='/'?'index.html':path==='/growth'?'growth.html':path.slice(1);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"}).end(readFileSync(new URL(file,import.meta.url)));return;
      }
      if(req.method==='GET'&&path==='/api/growth'){const loaded=store.read(),current=growthStore.read(loaded.catalog);json(res,200,{...current,deckAudit:auditRankedDecks(loaded.catalog,current.growth),forecast:forecast(current.growth),history:growthStore.listHistory(),defaults:buildGrowth(loaded.catalog),defaultUnlockXp:DEFAULT_UNLOCK_XP,cardVersion:loaded.version,cards:loaded.cards.filter(c=>c.collectible!==false).map(({id,name,kind,cost,class:heroClass})=>({id,name,kind,cost,heroClass}))});return;}
      if(req.method==='POST'&&path==='/api/growth/history-preview'){const input=await body(req),loaded=store.read();if(input.cardVersion!==loaded.version)throw new RuleError('카드 버전이 변경되었습니다. 새로고침하세요.');const result=growthStore.previewHistory(input.baseHash,input.backup,loaded.catalog);json(res,200,{...result,forecast:forecast(result.growth)});return;}
      if(req.method==='POST'&&(path==='/api/growth/validate'||path==='/api/growth/save')){const input=await body(req),loaded=store.read();if(input.cardVersion!==loaded.version)throw new RuleError('카드 버전이 변경되었습니다. 새로고침하세요.');const result=path.endsWith('/save')?growthStore.save(input.baseHash,input.config,loaded.catalog):growthStore.check(input.baseHash,input.config,loaded.catalog);json(res,200,{...result,forecast:forecast(result.growth),history:growthStore.listHistory()});return;}
      if(req.method==='GET'&&path==='/api/cards'){const loaded=store.read();json(res,200,{version:loaded.version,cards:loaded.cards,versions:store.list(),mechanics:CARD_KIND_MECHANICS});return;}
      if(req.method==='POST'&&path==='/api/validate'){const input=await body(req),draft=store.readDraft(input.baseVersion,input.cards),rankedDecks=growthStore.checkCatalog(draft);json(res,200,{...store.checkDraft(input.baseVersion,input.cards),rankedDecks});return;}
      if(req.method==='POST'&&path==='/api/compare'){const input=await body(req);json(res,200,store.compareVersions(input.from,input.to));return;}
      if(req.method==='POST'&&path==='/api/analysis'){const input=await body(req),draft=store.readDraft(input.baseVersion,input.cards);json(res,200,analyzeBalance(store.read().catalog,draft));return;}
      if(req.method==='POST'&&path==='/api/lab/start'){const input=await body(req),draft=store.readDraft(input.baseVersion,input.cards),base=store.read();json(res,202,lab.start(base.version,base.catalog,draft,parseBalanceConfig(input,base.catalog,draft)));return;}
      if(req.method==='GET'&&path==='/api/lab/status'){json(res,200,lab.get());return;}
      if(req.method==='POST'&&path==='/api/lab/cancel'){const input=await body(req);json(res,200,lab.cancel(input.id));return;}
      if(req.method==='POST'&&path==='/api/save'){const input=await body(req),draft=store.readDraft(input.baseVersion,input.cards);growthStore.checkCatalog(draft);const version=store.save(input.baseVersion,input.cards);json(res,200,{version});return;}
      if(req.method==='POST'&&path==='/api/activate'){const input=await body(req);if(typeof input.version!=='string')throw new RuleError('잘못된 버전 파일 이름입니다.');growthStore.checkCatalog(store.read(input.version).catalog);const version=store.activate(input.baseVersion,input.version);json(res,200,{version});return;}
      json(res,404,{error:'존재하지 않는 경로'});
    }catch(e){json(res,e instanceof RuleError||e instanceof SyntaxError?400:500,{error:e instanceof RuleError||e instanceof SyntaxError?e.message:'저장 오류가 발생했습니다.'});}
  });
  server.on('close',()=>lab.close());return server;
}
