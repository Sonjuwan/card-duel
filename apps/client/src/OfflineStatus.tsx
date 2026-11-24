import {useEffect,useState} from 'react';

export function OfflineStatus(){
  const [status,setStatus]=useState('오프라인 솔로 지원');
  const [buttons,setButtons]=useState<{id:string;text:string}[]>([]);
  useEffect(()=>{
    const banner=document.getElementById('solo-app-banner');
    const message=document.getElementById('solo-app-status');
    if(!banner||!message)return;
    const sync=()=>{
      setStatus(message.textContent?.trim()||'오프라인 솔로 지원');
      setButtons(['solo-app-install','solo-app-install-help','solo-app-check-update'].flatMap(id=>{
        const button=document.getElementById(id);
        return button&&!button.hidden?[{id,text:button.textContent?.trim()??''}]:[];
      }));
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(banner,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    return ()=>observer.disconnect();
  },[]);
  return <div className="offline-settings-status">
    <small role="status">{status}</small>
    <div className="controls">{buttons.map(({id,text})=><button key={id} type="button" className="secondary" onClick={()=>document.getElementById(id)?.click()}>{text}</button>)}</div>
  </div>;
}
