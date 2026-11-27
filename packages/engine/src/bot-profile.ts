/** Tunable, interpretable evaluation coefficients. Evolution optimizes these
 * through complete legal games; no private data or external model is needed. */
export const BOT_WEIGHT_KEYS=['health','lowHealth','criticalHealth','body','attack','durability','ability','keyword','weapon','hand','handQuality','secret','mana','overload','fatigue','pressure','initiative','trade','face'] as const;
export type BotWeightKey=typeof BOT_WEIGHT_KEYS[number];
export type BotWeights=Record<BotWeightKey,number>;
export const DEFAULT_BOT_WEIGHTS:Readonly<BotWeights>=Object.freeze({
  health:.72,lowHealth:1.10,criticalHealth:2.15,body:1.15,attack:1.17,durability:.83,ability:1.03,keyword:1.10,weapon:1.05,
  hand:1.65,handQuality:.30,secret:1.50,mana:.65,overload:.92,fatigue:.45,pressure:1.24,initiative:.20,trade:.10,face:.10,
});
export function validateBotWeights(input:unknown):BotWeights|null{
  if(typeof input!=='object'||input===null||Array.isArray(input))return null;
  const raw=input as Record<string,unknown>,weights={} as BotWeights;
  for(const key of BOT_WEIGHT_KEYS){const x=raw[key];if(typeof x!=='number'||!Number.isFinite(x)||x<DEFAULT_BOT_WEIGHTS[key]*.25||x>DEFAULT_BOT_WEIGHTS[key]*4)return null;weights[key]=x;}
  return weights;
}
export interface BotSearchConfig{depth:number;beam:number;nodes:number;responses:number;responseNodes:number;}
/** Difficulty 6-25 increases the search budget and depth monotonically.
 * The maximum is deliberately bounded so online games remain responsive. */
export function botSearchConfig(level:number):BotSearchConfig{
  const n=Math.max(0,Math.min(19,level-6));
  return {depth:Math.min(8,2+Math.floor(n/3)),beam:4+n,nodes:90+n*44,responses:n<6?0:Math.min(5,1+Math.floor((n-6)/3)),responseNodes:n<6?0:16+(n-6)*7};
}
export interface BotOptions{
  weights?:Readonly<BotWeights>;
  /** Training and benchmark override only; public difficulty uses its budget. */
  nodeLimit?:number;
  deadlineMs?:number;
  responseLimit?:number;
  /** Pin exact training/benchmark decision semantics across engine releases. */
  policyVersion?:1|2|3|4;
}
