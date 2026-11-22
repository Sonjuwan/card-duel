import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createCatalog,HERO_CLASSES,RuleError,starterDeck } from '../../packages/engine/src/index.ts';
import type { Card,Catalog } from '../../packages/engine/src/index.ts';
const DEFAULT_DIR=fileURLToPath(new URL('../../data/cards/',import.meta.url));
const VERSION=/^(v\d+\.\d+\.\d+|balance-[0-9TZ-]+-[a-f0-9]{8})\.json$/;
type EditableCard=Exclude<Card,{kind:'coin'}>;
type CardChange={id:string;name:string;fields:{field:string;before:unknown;after:unknown}[]};
export class CardStore{
  readonly dir:string;
  constructor(dir=DEFAULT_DIR){this.dir=dir;}
  private checkVersion(name:unknown):string{if(typeof name!=='string'||!VERSION.test(name))throw new RuleError('잘못된 버전 파일 이름입니다.');return name;}
  private validate(raw:unknown):Catalog{
    const catalog=createCatalog(raw);for(const cls of HERO_CLASSES)starterDeck(catalog,cls);return catalog;
  }
  private activeFile(){const manifest=JSON.parse(readFileSync(join(this.dir,'active.json'),'utf8'));return this.checkVersion(manifest.file);}
  list():string[]{return readdirSync(this.dir).filter(name=>VERSION.test(name)).sort((a,b)=>b.localeCompare(a,'en',{numeric:true}));}
  read(version=this.activeFile()):{version:string;cards:EditableCard[];catalog:Catalog}{
    const file=this.checkVersion(version);if(!existsSync(join(this.dir,file)))throw new RuleError('해당 버전이 존재하지 않습니다.');
    const raw:unknown=JSON.parse(readFileSync(join(this.dir,file),'utf8'));const catalog=this.validate(raw);
    return{version:file,cards:Object.values(catalog).filter((c):c is EditableCard=>c.kind!=='coin'),catalog};
  }
  private activateFile(version:string){
    const tmp=join(this.dir,`.active-${randomUUID()}.tmp`);
    writeFileSync(tmp,JSON.stringify({file:version})+'\n',{flag:'wx'});renameSync(tmp,join(this.dir,'active.json'));
  }
  private ensureCurrent(base:unknown){if(base!==this.activeFile())throw new RuleError('다른 편집에서 버전이 변경됐습니다. 새로고침 후 다시 시도하세요.');}
  checkDraft(base:unknown,raw:unknown):{total:number;collectible:number}{
    const catalog=this.readDraft(base,raw),cards=Object.values(catalog).filter(c=>c.kind!=='coin');return{total:cards.length,collectible:cards.filter(c=>c.collectible!==false).length};
  }
  /** Validate without writing or promoting a version. */
  readDraft(base:unknown,raw:unknown):Catalog{this.ensureCurrent(base);return this.validate(raw);}
  /** Read-only comparison for the administrator. The active pointer never changes. */
  compareVersions(from:unknown,to:unknown):{from:string;to:string;added:{id:string;name:string}[];removed:{id:string;name:string}[];changed:CardChange[]}{
    const previous=this.read(this.checkVersion(from)),next=this.read(this.checkVersion(to));
    const added:{id:string;name:string}[]=[],removed:{id:string;name:string}[]=[],changed:CardChange[]=[];
    const old=new Map(previous.cards.map(c=>[c.id,c])),now=new Map(next.cards.map(c=>[c.id,c]));
    for(const c of next.cards){
      const before=old.get(c.id);if(!before){added.push({id:c.id,name:c.name});continue;}
      const fields:CardChange['fields']=[];const left=before as unknown as Record<string,unknown>,right=c as unknown as Record<string,unknown>;
      for(const field of new Set([...Object.keys(left),...Object.keys(right)]))if(JSON.stringify(left[field])!==JSON.stringify(right[field]))fields.push({field,before:left[field]??null,after:right[field]??null});
      if(fields.length)changed.push({id:c.id,name:c.name,fields});
    }
    for(const c of previous.cards)if(!now.has(c.id))removed.push({id:c.id,name:c.name});
    return{from:previous.version,to:next.version,added,removed,changed};
  }
  save(base:unknown,raw:unknown):string{
    this.ensureCurrent(base);const catalog=this.validate(raw),cards=Object.values(catalog).filter(c=>c.kind!=='coin');
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');const version=`balance-${stamp}-${randomUUID().slice(0,8)}.json`;
    writeFileSync(join(this.dir,version),JSON.stringify(cards,null,2)+'\n',{flag:'wx'});this.activateFile(version);return version;
  }
  activate(base:unknown,version:unknown):string{this.ensureCurrent(base);const valid=this.checkVersion(version);this.read(valid);this.activateFile(valid);return valid;}
}
