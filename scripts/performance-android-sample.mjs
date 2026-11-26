import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const minutes=Number(process.argv[2]??20),pkg=process.argv[3]??'com.android.chrome',out=process.argv[4]??'android-performance-samples.json';
if(!Number.isInteger(minutes)||minutes<1||minutes>120||!/^[a-zA-Z0-9_.]+$/.test(pkg))throw Error('Usage: node scripts/performance-android-sample.mjs <minutes 1..120> <browser package> <new output.json>');
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
adb('get-state');
function optional(...args){try{return adb(...args);}catch{return null;}}
function sample(){
  const battery=optional('shell','dumpsys','battery');
  const fields=Object.fromEntries((battery??'').split('\n').map(x=>x.trim().match(/^(level|scale|temperature|voltage|status|AC powered|USB powered|Wireless powered|Charge counter):\s*(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]));
  const thermal=optional('shell','dumpsys','thermalservice');
  const mem=optional('shell','dumpsys','meminfo',pkg);
  return {timestamp:new Date().toISOString(),battery:fields,thermalStatus:thermal?.match(/(?:Thermal Status|Current thermal status):\s*(\d+)/i)?.[1]??null,browserTotalPssKb:mem?.match(/TOTAL PSS:\s*(\d+)/i)?.[1]??null};
}
const result={package:pkg,minutes,notes:['Physical Android device required; use wireless ADB or another unplugged measurement method.','Keep brightness, network, game scenario, room temperature, sound and battery starting level comparable.','Battery readings are device-wide and PSS is browser-wide, not exclusively Card Duel. Missing fields are not zero.'],samples:[]};
writeFileSync(out,JSON.stringify(result,null,2),{flag:'wx'});
for(let i=0;i<=minutes;i++){
  if(i)await delay(60000);
  result.samples.push(sample());
  writeFileSync(out,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.samples.at(-1)));
}
