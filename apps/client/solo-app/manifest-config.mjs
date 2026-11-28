/** Installable Card Duel is landscape-first on devices that honor the PWA
 * manifest. Prefer immersive launch where supported and retain a standalone
 * install fallback, including on devices that do not honor display_override. */
export const soloManifest={
  id:'./',name:'Card Duel · 솔로 랭크',short_name:'Card Duel',lang:'ko',
  start_url:'./',scope:'./',display:'standalone',display_override:['fullscreen','standalone'],orientation:'landscape',
  background_color:'#211b19',theme_color:'#211b19',
  icons:[
    {src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
    {src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
  ],
};
