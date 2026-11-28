const dayMs=86_400_000;
const dateFormats=new Map<string,Intl.DateTimeFormat>();

export function questTimeZone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}

export function questDay(instant:number,zone:string){
  let format=dateFormats.get(zone);
  if(!format){
    format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,calendar:'iso8601',numberingSystem:'latn',year:'numeric',month:'numeric',day:'numeric'});
    dateFormats.set(zone,format);
  }
  const parts=format.formatToParts(instant);
  const part=(type:'year'|'month'|'day')=>Number(parts.find(p=>p.type===type)?.value);
  return Math.floor(Date.UTC(part('year'),part('month')-1,part('day'))/dayMs);
}

/** Zone is pinned per save. Resolve civil midnight even across a 23- or 25-hour day. */
export function nextQuestMidnight(lastDay:number,zone:string){
  const estimate=(lastDay+1)*dayMs;
  let low=estimate-2*dayMs,high=estimate+2*dayMs;
  while(high-low>1){
    const middle=Math.floor((high+low)/2);
    if(questDay(middle,zone)<=lastDay)low=middle;
    else high=middle;
  }
  return high;
}
