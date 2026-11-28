/** Installable RUNEHALL is landscape-first on devices that honor the PWA
 * manifest. Prefer immersive launch where supported and retain a standalone
 * install fallback, including on devices that do not honor display_override. */
export const soloManifest={
  id:'./',name:'RUNEHALL · 룬홀',short_name:'룬홀',lang:'ko',
  start_url:'./',scope:'./',display:'standalone',display_override:['fullscreen','standalone'],orientation:'landscape',
  background_color:'#121722',theme_color:'#121722',
  icons:[
    {src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
    {src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'},
  ],
};
