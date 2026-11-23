// Test-only worker: fail or hang once, then behave like a completed cycle.
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
const args=process.argv.slice(2),output=args[args.indexOf('--output')+1];
mkdirSync(output,{recursive:true});const marker=join(output,'fixture-attempted');
if(!existsSync(marker)){
  writeFileSync(marker,'first attempt');
  if(output.includes('watchdog')){setInterval(()=>{},1000);await new Promise(()=>{});}
  else process.exit(7);
}
await wait(1100);
