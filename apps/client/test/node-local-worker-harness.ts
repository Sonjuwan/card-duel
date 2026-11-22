// Node test bridge for the browser worker's message interface.
import {parentPort,workerData} from 'node:worker_threads';
const scope=globalThis as unknown as {postMessage:(data:unknown)=>void;onmessage:(event:{data:unknown})=>void};
scope.postMessage=data=>parentPort!.postMessage(data);
await import(workerData.url);
parentPort!.on('message',data=>scope.onmessage({data}));
