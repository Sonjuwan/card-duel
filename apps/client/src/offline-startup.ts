/** The offline game must never strand a player on a blank page if its embedded
 * card catalog fails validation before React can mount. Do not wipe any local
 * progress, and do not insert an exception message as executable HTML. */
export function showOfflineBootFailure(
  documentRoot:Pick<Document,'createElement'>,
  host:Pick<HTMLElement,'replaceChildren'>,
  retry:()=>void
){
  const main=documentRoot.createElement('main');
  const panel=documentRoot.createElement('section');panel.className='panel';panel.setAttribute('role','alert');
  const title=documentRoot.createElement('h2');title.textContent='Card Duel 시작 실패';
  const copy=documentRoot.createElement('p');copy.textContent='게임 데이터를 확인하지 못했습니다. 저장된 경기와 덱은 삭제하지 않았습니다. 인터넷 연결 상태에서 다시 실행해 주세요.';
  const button=documentRoot.createElement('button');button.type='button';button.textContent='다시 실행';button.addEventListener('click',retry);
  panel.append(title,copy,button);main.append(panel);host.replaceChildren(main);
}
