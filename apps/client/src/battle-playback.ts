import { useEffect, useRef, useState } from 'react';
import { scaledBattleTiming } from '../../../packages/protocol.ts';
import type { BattleAnimation, RoomView } from '../../../packages/protocol.ts';

export type PlaybackCue={animation:BattleAnimation;before:RoomView;after:RoomView;duration:number;impact:number};
export function freshAcceptedAnimation(before:RoomView,after:RoomView):BattleAnimation|null{
  if(before.code!==after.code||before.seat!==after.seat||before.state?.phase!=='playing'||!after.state||after.state.revision!==before.state.revision+1||after.animation?.revision!==after.state.revision)return null;
  return after.animation;
}
export function nextPlayback(before:RoomView,after:RoomView):PlaybackCue|null{
  if(after.animationSpeed==='instant')return null;const animation=freshAcceptedAnimation(before,after);if(!animation)return null;
  return {animation,before,after,...scaledBattleTiming(animation,after.animationSpeed)};
}
type PlaybackClock={schedule:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;cancel:(timer:ReturnType<typeof setTimeout>)=>void};
const realClock:PlaybackClock={schedule:(fn,ms)=>setTimeout(fn,ms),cancel:timer=>clearTimeout(timer)};
/** A deterministic, testable timeline. Rendering is driven by the server's
 * accepted revision, not by the local click, and queued cues never overlap. */
export class PlaybackTimeline {
  private current:RoomView;
  private latest:RoomView;
  private pending:RoomView[]=[];
  private running=false;
  private visible=true;
  private timers:ReturnType<typeof setTimeout>[]=[];
  private onView:(view:RoomView)=>void;
  private onCue:(cue:PlaybackCue|null)=>void;
  private clock:PlaybackClock;
  constructor(initial:RoomView,onView:(view:RoomView)=>void,onCue:(cue:PlaybackCue|null)=>void,clock:PlaybackClock=realClock){
    this.current=initial;this.latest=initial;this.onView=onView;this.onCue=onCue;this.clock=clock;
  }
  dispose(){for(const t of this.timers)this.clock.cancel(t);this.timers=[];this.pending=[];this.running=false;}
  /** Background tabs may throttle timers. Skip only presentation, not any
   * accepted game state; resuming never replays the skipped animations. */
  setVisible(visible:boolean){
    if(this.visible===visible)return;this.visible=visible;
    if(!visible){this.dispose();this.show(this.latest);this.onCue(null);}
  }
  private show(view:RoomView){
    const frame=view.opponentConnected===this.latest.opponentConnected?view:{...view,opponentConnected:this.latest.opponentConnected};
    this.current=frame;this.onView(frame);
  }
  private process(){
    if(this.running)return;
    const next=this.pending.shift();if(!next)return;
    const playback=nextPlayback(this.current,next);
    if(!playback){this.show(next);this.process();return;}
    this.running=true;this.onCue(playback);
    this.timers.push(this.clock.schedule(()=>this.show(next),playback.impact));
    this.timers.push(this.clock.schedule(()=>{
      this.onCue(null);this.timers=[];this.running=false;this.process();
    },playback.duration));
  }
  receive(incoming:RoomView,connected:boolean){
    const previous=this.latest;
    if(!connected||previous.code!==incoming.code||!incoming.state||!previous.state){
      this.dispose();this.latest=incoming;this.show(incoming);this.onCue(null);return;
    }
    if(incoming.state.revision<previous.state.revision)return;
    if(!this.visible){this.dispose();this.latest=incoming;this.show(incoming);this.onCue(null);return;}
    if(previous.state.revision===incoming.state.revision){
      this.latest=incoming;
      if(previous.opponentConnected!==incoming.opponentConnected||previous.opponentReconnectDeadlineMs!==incoming.opponentReconnectDeadlineMs){this.dispose();this.show(incoming);this.onCue(null);}
      else if(!this.running)this.show(incoming);
      else if(this.current.opponentConnected!==incoming.opponentConnected)this.show(this.current);
      return;
    }
    this.latest=incoming;
    if(incoming.state.revision!==previous.state.revision+1||this.pending.length>=8){
      this.dispose();this.show(incoming);this.onCue(null);return;
    }
    this.pending.push(incoming);this.process();
  }
}
/** Preserve authoritative snapshots but display them at their impact beat. */
export function useBattlePlayback(incoming:RoomView,connected:boolean){
  const [shown,setShown]=useState(incoming),[cue,setCue]=useState<PlaybackCue|null>(null);
  const timeline=useRef<PlaybackTimeline|null>(null);
  if(!timeline.current)timeline.current=new PlaybackTimeline(incoming,setShown,setCue);
  useEffect(()=>{timeline.current!.setVisible(!globalThis.document?.hidden);timeline.current!.receive(incoming,connected);},[incoming,connected]);
  useEffect(()=>{const visibility=()=>timeline.current?.setVisible(!globalThis.document?.hidden);document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('visibilitychange',visibility);timeline.current?.dispose();};},[]);
  return {room:shown,cue,playing:!!cue||shown.state?.revision!==incoming.state?.revision};
}
