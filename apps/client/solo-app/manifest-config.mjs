/** Installable Card Duel is landscape-first on devices that honor the PWA
 * manifest. Browser tabs retain manual rotate/fullscreen fallbacks. Never
 * force `display: fullscreen`: that would obscure OS navigation on some phones. */
export const soloManifest={
  id:'./',name:'Card Duel · 솔로 랭크',short_name:'Card Duel',lang:'ko',
  start_url:'./',scope:'./',display:'standalone',orientation:'landscape',
  background_color:'#211b19',theme_color:'#211b19',
  icons:[
    {src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
    {src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
  ],
};
