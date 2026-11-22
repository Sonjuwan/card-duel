/** A single explicit websocket source for browsers that do not map 'self'
 * from HTTP(S) to WS(S). Never echo arbitrary CSP syntax from Host. */
export function websocketSource(trustedOrigin?:string,host?:string):string{
  const origin=trustedOrigin||(host?'http://'+host:'');
  try{
    const url=new URL(origin);
    if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||!/^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i.test(url.host))return '';
    return (url.protocol==='https:'?'wss://':'ws://')+url.host;
  }catch{return '';}
}

export function gameSecurityHeaders(trustedOrigin?:string,host?:string):Record<string,string>{
  const source=websocketSource(trustedOrigin,host);
  return {
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy':"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'self'"+(source?' '+source:'')+"; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
    ...(trustedOrigin?.startsWith('https://')?{'Strict-Transport-Security':'max-age=31536000'}:{})
  };
}
