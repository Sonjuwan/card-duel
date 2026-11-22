import { isIP } from 'node:net';

/** Bind only to loopback/private LAN/CGNAT (including Tailscale) IP addresses. */
export function privateBindHost(host:string):boolean{
  if(isIP(host)!==4)return false;
  const [a,b]=host.split('.').map(Number);
  return a===127||a===10||(a===192&&b===168)||(a===172&&b>=16&&b<=31)||(a===100&&b>=64&&b<=127)||(a===169&&b===254);
}
/** Public binding is opt-in and requires HTTPS proxy origin plus durable cloud storage. */
export function allowedGameBind(host:string,backend:string|undefined,origin:string|undefined,publicEnabled:string|undefined):boolean{
  if(privateBindHost(host))return true;
  if(host!=='0.0.0.0'||backend!=='supabase'||publicEnabled!=='1'||!origin)return false;
  try{const url=new URL(origin);return url.protocol==='https:'&&url.origin===origin;}catch{return false;}
}
