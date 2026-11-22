import {CardStore} from '../server/card-store.ts';
import {compareBalanceMatches,parseBalanceConfig} from '../admin/balance-analysis.ts';
import {RuleError} from '../../packages/engine/src/index.ts';
const args=process.argv.slice(2),arg=(flag:string)=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const store=new CardStore(),base=store.read(arg('--from')),draft=store.read(arg('--to'));
if(!arg('--from')||!arg('--to'))throw new RuleError('Usage: npm run balance:sim -- --from v0.22.0.json --to v0.23.0.json [--pairs 9] [--level 11] [--seed 20241122] [--focus wolf]');
const config=parseBalanceConfig({pairs:Number(arg('--pairs')??9),seed:Number(arg('--seed')??20241122),level:Number(arg('--level')??11),focus:arg('--focus')},base.catalog,draft.catalog);
// CLI writes only stdout; Ctrl+C is safe because source versions are read-only.
const result=compareBalanceMatches(base.catalog,draft.catalog,config,r=>console.error(`${r.completedPairs}/${config.pairs} · ${r.original.matches+r.draft.matches} games · ${r.changedOutcomes} outcomes changed`));
console.log(JSON.stringify({from:base.version,to:draft.version,...result},null,2));
