import {useEffect,useState} from 'react';
import {secondsUntilDeadline,watchDeadlineSeconds} from './battle-clock.ts';

/** Keep presentation ticks out of the battlefield and its input state. */
export function TurnCountdown({deadline}:{deadline:number}){
  const [seconds,setSeconds]=useState(()=>secondsUntilDeadline(deadline,Date.now()));
  useEffect(()=>watchDeadlineSeconds(deadline,value=>setSeconds(value??0),250),[deadline]);
  return <b className="turn-countdown" data-urgent={seconds<=5}>판정 시간 {seconds}초</b>;
}
