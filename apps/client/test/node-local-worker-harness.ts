// Node test bridge for the browser worker's message interface.
import {parentPort,workerData} from 'node:worker_threads';
const scope=globalThis as unknown as {postMessage:(data:unknown)=>void;onmessage:(event:{data:unknown})=>void};
scope.postMessage=data=>parentPort!.postMessage(data);
if(workerData.inspectDatabase){
  Object.defineProperty(globalThis,'indexedDB',{value:{open(name:string,version:number){parentPort!.postMessage({type:'databaseOpened',name,version});const request={error:Error('test database unavailable'),onerror:()=>{}};queueMicrotask(()=>request.onerror());return request;}}});
}
await import(workerData.url);
parentPort!.on('message',data=>scope.onmessage({data}));
