export const TRAINING_MODES=['quiet','balanced','maximum'] as const;
export type TrainingMode=typeof TRAINING_MODES[number];
export function trainingBudget(cores:number,memoryGb:number,mode:TrainingMode='balanced'){
  if(!TRAINING_MODES.includes(mode))throw Error('Invalid --power (quiet, balanced, maximum)');
  const threads=Math.max(1,Math.floor(cores)||1),memory=Math.max(1,memoryGb||1);
  const memoryCap=Math.max(1,Math.floor((memory-2)/1.5));
  const cpuCap=mode==='quiet'?Math.max(1,Math.floor(threads/3)):mode==='maximum'?Math.max(1,threads-1):Math.max(1,Math.floor(threads/2));
  return{workers:Math.max(1,Math.min(mode==='quiet'?2:mode==='maximum'?8:4,memoryCap,cpuCap)),restMs:mode==='quiet'?180:mode==='balanced'?20:0,checkpointMs:mode==='quiet'?2000:1000};
}
