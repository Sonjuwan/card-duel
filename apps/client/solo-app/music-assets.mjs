const names=['home','prepare','library','deck','battle-1','battle-2','battle-3','battle-4','battle-5','battle-6','progress','win','loss'];
export const musicAssets=names.map(name=>'music-'+name+'.mp3');

export function splitSoloMusic(script,read){
  const files=Object.fromEntries(names.map((name,index)=>{
    const bytes=read(name+'.mp3');
    const embedded='data:audio/mpeg;base64,'+bytes.toString('base64');
    if(!script.includes(embedded))throw Error('Standalone soundtrack is missing '+name);
    script=script.replaceAll(embedded,'./'+musicAssets[index]);
    return [musicAssets[index],bytes];
  }));
  return {script,files};
}

export function restoreSoloMusic(script,read,available=musicAssets){
  for(const name of available){
    const path='./'+name;
    if(script.includes(path))script=script.replaceAll(path,'data:audio/mpeg;base64,'+read(name).toString('base64'));
  }
  return script;
}
