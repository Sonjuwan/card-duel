/** Seat-swapped games share a fixture, so uncertainty is calculated over pairs,
 * not over supposedly independent games. The bootstrap is deterministic. */
export function pairedScoreStats(pairs:readonly (readonly [number,number])[],samples=4000){
  if(!pairs.length||!Number.isSafeInteger(samples)||samples<100)throw Error('Invalid benchmark sample');
  if(pairs.some(p=>p.length!==2||p.some(n=>![0,.5,1].includes(n))))throw Error('Invalid score');
  const scores=pairs.map(([a,b])=>(a+b)/2),mean=scores.reduce((a,b)=>a+b,0)/scores.length;
  let rng=0x2468ace1;const boot:number[]=[];
  for(let i=0;i<samples;i++){let sum=0;for(let j=0;j<scores.length;j++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;sum+=scores[Math.floor(rng/4294967296*scores.length)];}boot.push(sum/scores.length);}
  boot.sort((a,b)=>a-b);
  return {scoreRate:mean,bootstrap95:[boot[Math.floor(samples*.025)],boot[Math.min(samples-1,Math.ceil(samples*.975)-1)]] as [number,number],pairs:scores.length,sweeps:scores.filter(s=>s===1).length,split:scores.filter(s=>s===.5).length,lossSweeps:scores.filter(s=>s===0).length};
}
