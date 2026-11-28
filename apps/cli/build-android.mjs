import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,copyFileSync,cpSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const project=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
export const androidPackage='com.cardduel.solo';
const sdkMin=34;
const platformExe=name=>process.platform==='win32'?name+'.exe':name;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function versionCode(version){
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
  const [major,minor,patch]=version.split('.').map(Number);
  const code=major*1000000+minor*1000+patch;
  if(minor>999||patch>999||!Number.isSafeInteger(code)||code<1||code>2100000000)throw Error('Android version code out of range');
  return code;
}
export function prepareAndroid(destination=join(root,'dist/android')){
  const source=join(root,'apps/android'),html=readFileSync(join(root,'solo-offline.html'),'utf8');
  if(!html.includes(`<title>RUNEHALL v${project.version} · 오프라인 솔로</title>`))throw Error('Rebuild solo-offline.html before packaging Android.');
  if(!html.includes('</head>')||/<meta[^>]+Content-Security-Policy/i.test(html.slice(0,html.indexOf('<script type="module">'))))throw Error('Unexpected standalone HTML head');
  const csp="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; worker-src blob:; connect-src 'none'; font-src data:; media-src data: blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const app=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
  if(app===html)throw Error('Android content policy injection failed');
  mkdirSync(join(destination,'assets'),{recursive:true});mkdirSync(join(destination,'res/drawable'),{recursive:true});
  cpSync(join(source,'src'),join(destination,'src'),{recursive:true});
  copyFileSync(join(source,'AndroidManifest.xml'),join(destination,'AndroidManifest.xml'));
  copyFileSync(join(root,'apps/client/solo-app/icon-192.png'),join(destination,'res/drawable/card_duel_icon.png'));
  writeFileSync(join(destination,'assets/index.html'),app);
  const info={version:project.version,versionCode:versionCode(project.version),package:androidPackage,origin:'https://appassets.androidplatform.net/card-duel/index.html',assetSha256:sha256(app),sourceSha256:sha256(html),signed:false};
  writeFileSync(join(destination,'build-info.json'),JSON.stringify(info,null,2));
  return info;
}
export function locateSdk(sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME){
  if(!sdk||!existsSync(sdk))throw Error('Android SDK not found. Set ANDROID_SDK_ROOT to an installed SDK.');
  const platforms=join(sdk,'platforms'),tools=join(sdk,'build-tools');
  if(!existsSync(platforms)||!existsSync(tools))throw Error('Install an Android SDK Platform (API 34+) and SDK Build-Tools.');
  const api=readdirSync(platforms).map(s=>/^android-(\d+)$/.exec(s)).filter(Boolean).map(m=>Number(m[1])).filter(n=>n>=sdkMin&&existsSync(join(platforms,`android-${n}`,'android.jar'))).sort((a,b)=>b-a)[0];
  const versions=readdirSync(tools).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  const version=versions.find(v=>['aapt2','zipalign'].every(x=>existsSync(join(tools,v,platformExe(x))))&&['d8.jar','apksigner.jar'].every(x=>existsSync(join(tools,v,'lib',x))));
  if(!api||!version)throw Error('SDK Platform API 34+ or complete Build-Tools missing.');
  return {androidJar:join(platforms,`android-${api}`,'android.jar'),tools:join(tools,version),api,version};
}
const run=(program,args)=>{const result=spawnSync(program,args,{stdio:'inherit',shell:false});if(result.error)throw result.error;if(result.status!==0)throw Error(`${program} exited with status ${result.status}`);};
function javaExecutable(name){return process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',platformExe(name)):name;}
/** Some OpenJDK installations omit the shell launchers but retain the actual
 * compiler and jar tool modules; use those supported local executables. */
export function toolCommand(name){
  const executable=javaExecutable(name),probe=spawnSync(executable,['--version'],{encoding:'utf8',shell:false});
  if(probe.status===0)return {program:executable,prefix:[]};
  const main=name==='javac'?'jdk.compiler/com.sun.tools.javac.Main':name==='jar'?'jdk.jartool/sun.tools.jar.Main':null;
  if(!main)throw Error(`JDK tool unavailable: ${name}`);
  const java=javaExecutable('java'),version=spawnSync(java,['-m',main,'--version'],{encoding:'utf8',shell:false});
  if(version.status!==0)throw Error(`JDK tool unavailable: ${name}. Install a complete JDK.`);
  return {program:java,prefix:['-m',main]};
}
export function buildAndroid({sdk,keystore,alias,destination=join(root,'dist/android')}){
  const config=locateSdk(sdk);
  if(!keystore||!existsSync(keystore)||!alias)throw Error('Use an existing private signing keystore and alias. Do not create or share keys here.');
  const javac=toolCommand('javac'),jar=toolCommand('jar'),java=javaExecutable('java');
  const info=prepareAndroid(destination);
  const output=join(destination,`card-duel-v${project.version}.apk`);
  if(existsSync(output))throw Error(`APK already exists: ${output}. Keep it or move it before rebuilding.`);
  const work=mkdtempSync(join(tmpdir(),'card-duel-apk-'));
  const classes=join(work,'classes'),dex=join(work,'dex'),resources=join(work,'resources.zip'),unsigned=join(work,'unsigned.apk'),aligned=join(work,'aligned.apk');
  mkdirSync(classes);mkdirSync(dex);
  try{
    const tool=name=>join(config.tools,platformExe(name));
    run(tool('aapt2'),['compile','--dir',join(destination,'res'),'-o',resources]);
    run(tool('aapt2'),['link','-I',config.androidJar,'--manifest',join(destination,'AndroidManifest.xml'),'-A',join(destination,'assets'),'--version-code',String(info.versionCode),'--version-name',info.version,'-o',unsigned,resources]);
    const javaSource=join(destination,'src/com/cardduel/solo'),javaFiles=readdirSync(javaSource).filter(n=>n.endsWith('.java')).map(n=>join(javaSource,n));
    run(javac.program,[...javac.prefix,'-encoding','UTF-8','-source','8','-target','8','-classpath',config.androidJar,'-d',classes,...javaFiles]);
    const classFiles=readdirSync(join(classes,'com/cardduel/solo')).filter(n=>n.endsWith('.class')).map(n=>join(classes,'com/cardduel/solo',n));
    run(java,['-cp',join(config.tools,'lib/d8.jar'),'com.android.tools.r8.D8','--lib',config.androidJar,'--min-api','26','--output',dex,...classFiles]);
    run(jar.program,[...jar.prefix,'--update','--file',unsigned,'--no-manifest','-C',dex,'classes.dex']);
    run(tool('zipalign'),['-f','4',unsigned,aligned]);
    const signed=join(work,'signed.apk');
    // apksigner prompts for the password on the real operator's terminal.
    run(java,['-jar',join(config.tools,'lib/apksigner.jar'),'sign','--ks',resolve(keystore),'--ks-key-alias',alias,'--out',signed,aligned]);
    run(java,['-jar',join(config.tools,'lib/apksigner.jar'),'verify','--verbose','--print-certs',signed]);
    run(tool('zipalign'),['-c','4',signed]);
    copyFileSync(signed,output);
    const apkHash=sha256(readFileSync(output));
    writeFileSync(join(destination,'apk-sha256.txt'),`${apkHash}  ${output.split(/[\\/]/).at(-1)}\n`);
    writeFileSync(join(destination,'apk-info.json'),JSON.stringify({...info,signed:true,apkSha256:apkHash},null,2));
    console.log(`Verified APK: ${output}`);
    return output;
  }finally{rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    const [mode,...args]=process.argv.slice(2);
    if(mode==='--prepare'&&args.length===0)console.log('Android source candidate prepared:',prepareAndroid());
    else if(mode==='--check'&&args.length===0)console.log('Android SDK:',locateSdk(),'JDK tools:',toolCommand('javac'),toolCommand('jar'));
    else if(mode==='--build'&&args.length===4&&args[0]==='--keystore'&&args[2]==='--alias')buildAndroid({keystore:args[1],alias:args[3]});
    else throw Error('Usage: node apps/cli/build-android.mjs --prepare | --check | --build --keystore <path> --alias <alias>');
  }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}
