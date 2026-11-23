/** Browser capabilities are independent: a denied fullscreen request must not
 * prevent a separately supported orientation lock. Neither is required to
 * play after the user rotates the phone manually. */
export async function requestLandscapeFeatures(fullscreen:()=>Promise<boolean>,lockOrientation:()=>Promise<boolean>){
  let full=false,landscape=false,fullscreenDenied=false,orientationDenied=false;
  try{full=await fullscreen();}catch{fullscreenDenied=true;}
  try{landscape=await lockOrientation();}catch{orientationDenied=true;}
  return{fullscreen:full,landscape,fullscreenDenied,orientationDenied};
}

/** A Home Screen PWA is already a browser-chrome-free game window.
 * Fullscreen API may be unavailable there (notably Safari), so the rotation
 * action should not report failure just because it cannot enter fullscreen
 * again. The orientation lock still gets its own independent attempt. */
export function isInstalledGameDisplay(matches:(query:string)=>boolean,navigatorStandalone=false){
  return !!navigatorStandalone||matches('(display-mode: standalone)')||matches('(display-mode: fullscreen)');
}
