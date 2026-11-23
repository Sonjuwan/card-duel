/** Keep an expanded hand card inside the *visible field* on landscape phones.
 * A symmetric transform clips cards at the first/last hand position even
 * though the compact hand itself fits the screen. The shift moves only the
 * visual preview; its original (small) hit box and card order remain intact. */
export function landscapeHandPreviewShift(slotLeft:number,slotWidth:number,previewWidth:number,fieldLeft:number,fieldRight:number,padding=6):number{
  if(![slotLeft,slotWidth,previewWidth,fieldLeft,fieldRight,padding].every(Number.isFinite)||slotWidth<=0||previewWidth<=0||fieldRight<=fieldLeft)return 0;
  const desired=slotLeft+(slotWidth-previewWidth)/2;
  const min=fieldLeft+Math.max(0,padding);
  const max=fieldRight-Math.max(0,padding)-previewWidth;
  // Extremely small split-screen view: center the preview rather than
  // pinning one edge and hiding all text on the other side.
  const clamped=max<min?(fieldLeft+fieldRight-previewWidth)/2:Math.max(min,Math.min(max,desired));
  return Math.round((clamped-desired)*100)/100;
}

/** A compact hand can have only one inspected card. Keyboard Tab/arrow
 * navigation to a different card dismisses an old unplayable-card peek. */
export function dismissPeekOnHandFocus(peekId:string|null,sourceId:string|undefined):boolean{
  return !!peekId&&sourceId!==`card:${peekId}`;
}
