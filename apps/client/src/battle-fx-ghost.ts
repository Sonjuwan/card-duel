/** Animated attack/departure copies must be visual-only: never become
 * keyboard/assistive controls, actions, or duplicate live target identities.
 * SVG art can reference ids in gradients/clips; namespace instead of dropping
 * those ids, or the clone's artwork may disappear during its animation. */
let nextGhostId=0;
const IDREF_ATTRS=new Set(['aria-labelledby','aria-describedby','aria-controls','aria-owns','aria-activedescendant','for']);

export function prepareFxGhost(ghost:HTMLElement):void{
  ghost.setAttribute('aria-hidden','true');
  ghost.setAttribute('inert','');
  ghost.setAttribute('tabindex','-1');
  const descendants=[...ghost.querySelectorAll('*')],nodes=[ghost,...descendants];
  const prefix=`fx-ghost-${++nextGhostId}-`,references=new Map<string,string>();
  for(const node of nodes){
    const old=node.getAttribute('id');
    if(old){const next=prefix+old;references.set(old,next);node.setAttribute('id',next);}
  }
  // Fix references after all ids are renamed. Preserve SVG gradients, clips,
  // masks and <use href="#id"> references in the otherwise inert snapshot.
  if(references.size)for(const node of nodes){
    for(const attribute of node.getAttributeNames()){
      const old=node.getAttribute(attribute);if(!old)continue;
      let next=old.replace(/url\(\s*(['"]?)#([^\s)'"/]+)\1\s*\)/g,(match,quote:string,id:string)=>references.has(id)?`url(${quote}#${references.get(id)}${quote})`:match);
      if((attribute==='href'||attribute==='xlink:href')&&next.startsWith('#')){const mapped=references.get(next.slice(1));if(mapped)next='#'+mapped;}
      else if(IDREF_ATTRS.has(attribute))next=next.split(/(\s+)/).map(token=>references.get(token)??token).join('');
      if(next!==old)node.setAttribute(attribute,next);
    }
  }
  for(const node of nodes){
    node.removeAttribute('data-preview-minion');
    node.removeAttribute('data-preview-card');
    node.removeAttribute('data-action-source');
    if(node!==ghost&&node.matches('[tabindex], a[href], button, input, select, textarea, [contenteditable]'))node.setAttribute('tabindex','-1');
    if(node.hasAttribute('contenteditable'))node.setAttribute('contenteditable','false');
  }
}
