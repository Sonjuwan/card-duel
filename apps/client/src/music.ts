// Background soundtrack intentionally disabled; retain compatibility for existing audio callers.
export type MusicScene='home'|'prepare'|'library'|'deck'|'battle'|'progress'|'win'|'loss';
export function drawMusicTrack(pool:readonly string[],remaining:readonly string[],last:string,random=Math.random){
  const bag=[...(remaining.length?remaining:pool)];
  if(!remaining.length){
    for(let i=bag.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [bag[i],bag[j]]=[bag[j],bag[i]];
    }
    if(bag.length>1&&bag[0]===last)[bag[0],bag[1]]=[bag[1],bag[0]];
  }
  return {track:bag.shift(),remaining:bag};
}

export function setMusicMix(_music:number,_overall:number,_silent:boolean){}
export function duckMusic(_speaking:boolean){}
export function duckMusicForCelebration(_milliseconds:number){}
export function beginMusic(_audio:AudioContext){}
export function stopMusic(){}
export function chooseMusic(_next:MusicScene,_code=''){}
