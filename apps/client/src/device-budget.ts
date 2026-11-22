import type {BotDifficulty} from '../../../packages/engine/src/index.ts';
import {botSearchConfig} from '../../../packages/engine/src/index.ts';
export const DEVICE_MODES=['auto','fast','strong'] as const;
export type DeviceMode=typeof DEVICE_MODES[number];
export interface DeviceInfo{cores?:number;memoryGb?:number;}
/** Time bounds are design targets, not measured S24 results. A worker keeps
 * expensive AI search off the UI thread, and a weaker device may search less. */
export function deviceBudget(difficulty:BotDifficulty,mode:DeviceMode='auto',info:DeviceInfo={}){
  const cores=Number.isFinite(info.cores)?Math.max(1,info.cores!):4;
  const memory=Number.isFinite(info.memoryGb)?Math.max(.5,info.memoryGb!):4;
  const constrained=cores<=4||memory<4;
  const scale=mode==='fast'?.55:mode==='strong'?1.25:constrained?.72:1;
  const config=botSearchConfig(difficulty);
  return {
    deadlineMs:Math.round(Math.min(3000,(difficulty<=5?400:450+(difficulty-6)*100)*scale)),
    nodeLimit:Math.max(20,Math.round(config.nodes*scale)),
    responseLimit:mode==='fast'?Math.min(1,config.responses):constrained&&mode==='auto'?Math.min(3,config.responses):config.responses,
  };
}
