/// <reference types="vite/client" />
const tracks=loadTracks();
function loadTracks():Record<string,string>{
  try{return import.meta.glob<string>('./assets/music/*.mp3',{eager:true,query:'?inline',import:'default'});}catch{return {};}
}
export type MusicScene='home'|'prepare'|'library'|'deck'|'battle'|'win'|'loss';
const battleTracks=Object.keys(tracks).filter(path=>path.includes('/battle-'));
const fade=1.3;
let context:AudioContext|undefined,bus:GainNode|undefined;
let current:{node:AudioBufferSourceNode;gain:GainNode}|undefined;
let timer:ReturnType<typeof setTimeout>|undefined;
let scene:MusicScene='home',match='',revision=0,loading=false,completed=false;
let bag:string[]=[],lastBattle='';
let level=.4,master=1,muted=false,ducked=false;

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
function nextTrack(){
  if(scene!=='battle')return './assets/music/'+scene+'.mp3';
  const next=drawMusicTrack(battleTracks,bag,lastBattle);
  bag=next.remaining;
  if(next.track)lastBattle=next.track;
  return next.track;
}
function fadeOut(){
  if(!context||!current)return;
  const {node,gain}=current,now=context.currentTime;
  current=undefined;
  if(typeof gain.gain.cancelAndHoldAtTime==='function')gain.gain.cancelAndHoldAtTime(now);
  else{const level=gain.gain.value;gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(level,now);}
  gain.gain.linearRampToValueAtTime(0,now+fade);
  try{node.stop(now+fade);}catch{}
}
function update(){
  if(!bus||!context)return;
  bus.gain.setTargetAtTime(muted?0:level*master*(ducked?.32:1),context.currentTime,.17);
}
export function setMusicMix(music:number,overall:number,silent:boolean){
  level=music/100;master=overall/100;muted=silent;update();
}
export function duckMusic(speaking:boolean){ducked=speaking;update();}
async function advance(){
  const audio=context,output=bus;
  if(!audio||!output||audio.state!=='running'||document.hidden||loading)return;
  const key=nextTrack(),request=++revision;
  if(!key||!tracks[key])return;
  loading=true;
  try{
    const response=await fetch(tracks[key]);
    const buffer=await audio.decodeAudioData(await response.arrayBuffer());
    if(request!==revision||document.hidden||audio!==context)return;
    fadeOut();
    const now=audio.currentTime,node=audio.createBufferSource(),gain=audio.createGain();
    node.buffer=buffer;
    node.connect(gain);gain.connect(output);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(.65,now+fade);
    node.onended=()=>{if(current?.node===node)current=undefined;node.disconnect();gain.disconnect();};
    node.start();current={node,gain};
    if(scene==='win'||scene==='loss')completed=true;
    else timer=setTimeout(()=>void advance(),Math.max(1000,(buffer.duration-fade)*1000));
  }catch{/* Music is optional on devices that cannot decode the track. */}
  finally{if(request===revision)loading=false;}
}
export function beginMusic(audio:AudioContext){
  if(context!==audio){
    stopMusic();
    context=audio;bus=audio.createGain();bus.gain.value=0;bus.connect(audio.destination);update();
  }
  if(!current&&!loading&&!completed)void advance();
}
export function stopMusic(){
  clearTimeout(timer);revision++;loading=false;
  if(current){
    const {node}=current;current=undefined;
    try{node.stop();}catch{}
  }
}
export function chooseMusic(next:MusicScene,code=''){
  if(scene===next&&match===code)return;
  scene=next;match=code;completed=false;
  clearTimeout(timer);revision++;loading=false;
  void advance();
}
