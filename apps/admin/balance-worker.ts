import {parentPort,workerData} from 'node:worker_threads';
import {compareBalanceMatches} from './balance-analysis.ts';
import type {BalanceConfig} from './balance-analysis.ts';
import type {Catalog} from '../../packages/engine/src/index.ts';
const {base,draft,config}=workerData as {base:Catalog;draft:Catalog;config:BalanceConfig};
const result=compareBalanceMatches(base,draft,config,result=>parentPort!.postMessage({kind:'progress',result}));
parentPort!.postMessage({kind:'complete',result});
