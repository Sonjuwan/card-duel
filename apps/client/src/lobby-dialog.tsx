import {useRef} from 'react';
import type {ReactNode} from 'react';

export function LobbyDialog({label,children}:{label:string;children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="secondary" onClick={()=>dialog.current?.showModal()}>{label}</button>
    <dialog ref={dialog} className="lobby-dialog" aria-label={label}>
      <form method="dialog"><button className="secondary" autoFocus>닫기</button></form>
      {children}
    </dialog>
  </>;
}
