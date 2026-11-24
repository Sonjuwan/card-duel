import {useRef} from 'react';
import type {ReactNode} from 'react';

export function LobbyDialog({label,children,icon}:{label:string;children:ReactNode;icon?:string}){
  const dialog=useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="secondary" aria-label={label} onClick={()=>dialog.current?.showModal()}>{icon??label}</button>
    <dialog ref={dialog} className="lobby-dialog" aria-label={label}>
      <form method="dialog"><button className="secondary" autoFocus>닫기</button></form>
      {children}
    </dialog>
  </>;
}
