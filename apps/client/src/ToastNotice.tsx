import type {ReactNode} from 'react';

export function ToastNotice({kind,children}:{kind:'success'|'info'|'error';children:ReactNode}){
  return <div className="game-toast" data-kind={kind} role={kind==='error'?'alert':'status'}>
    <span aria-hidden="true">{kind==='success'?'✓':kind==='error'?'!':'◆'}</span>{children}
  </div>;
}
