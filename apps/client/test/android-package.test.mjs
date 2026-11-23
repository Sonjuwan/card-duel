import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {prepareAndroid,versionCode,locateSdk,androidPackage,toolCommand} from '../../cli/build-android.mjs';

test('Android source package embeds exactly the actual standalone game with restrictive content policy',()=>{
  const folder=resolve('dist/android'),info=JSON.parse(readFileSync(join(folder,'build-info.json'),'utf8'));
  const html=readFileSync(join(folder,'assets/index.html'),'utf8'),source=readFileSync('solo-offline.html','utf8');
  const embedded=html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/,'');
  assert.equal(embedded,source);assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src blob:/);assert.match(html,/frame-src 'none'/);
  const hash=text=>createHash('sha256').update(text).digest('hex');assert.equal(hash(html),info.assetSha256);assert.equal(hash(source),info.sourceSha256);
  assert.equal(info.package,androidPackage);assert.equal(info.signed,false);assert.equal(info.origin,'https://appassets.androidplatform.net/card-duel/index.html');
  assert.equal(info.versionCode,versionCode(JSON.parse(readFileSync('package.json','utf8')).version));
});
test('manifest has stable identity, no network or broad storage permission, and a single local launcher',()=>{
  const folder=resolve('dist/android'),manifest=readFileSync(join(folder,'AndroidManifest.xml'),'utf8'),java=readFileSync(join(folder,'src/com/cardduel/solo/MainActivity.java'),'utf8');
  assert.match(manifest,/package="com\.cardduel\.solo"/);assert.doesNotMatch(manifest,/<uses-permission/);assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.equal((manifest.match(/<activity /g)??[]).length,1);
  assert.match(java,/setAllowFileAccess\(false\)/);assert.match(java,/setAllowContentAccess\(false\)/);assert.match(java,/setDomStorageEnabled\(true\)/);assert.match(java,/setBlockNetworkLoads\(true\)/);assert.match(java,/ACTION_CREATE_DOCUMENT/);assert.match(java,/ACTION_OPEN_DOCUMENT/);
  assert.match(java,/JSONObject\.quote\(value\)/);assert.match(java,/compareAndSet\(null,task\)/);assert.match(java,/BackupPayload\.LIMIT/);assert.doesNotMatch(java,/clearHistory|clearCache|deleteAllData/);
});
test('actual native Java payload validator compiles and rejects unsafe names, malformed UTF-8 and excess bytes',t=>{
  const folder=mkdtempSync(join(tmpdir(),'card-duel-java-test-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const executable=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?`${name}.exe`:name):name;
  const javac=toolCommand('javac');const compile=spawnSync(javac.program,[...javac.prefix,'-encoding','UTF-8','-d',folder,'apps/android/src/com/cardduel/solo/BackupPayload.java','apps/android/test/BackupPayloadTest.java'],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=spawnSync(executable('java'),['-cp',folder,'com.cardduel.solo.BackupPayloadTest'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr||String(run.error));assert.match(run.stdout,/passed/);
});
test('version code ordering and absent/incomplete SDK fail before APK signing',t=>{
  assert.equal(versionCode('0.97.0'),97000);assert.ok(versionCode('1.0.0')>versionCode('0.999.999'));assert.throws(()=>versionCode('0.1000.0'));
  const sandbox=mkdtempSync(join(tmpdir(),'android-sdk-test-'));t.after(()=>rmSync(sandbox,{recursive:true,force:true}));
  assert.throws(()=>locateSdk(join(sandbox,'missing')),/not found/);mkdirSync(join(sandbox,'platforms/android-34'),{recursive:true});mkdirSync(join(sandbox,'build-tools/34.0.0/lib'),{recursive:true});
  assert.throws(()=>locateSdk(sandbox),/missing/);
  const fake=join(sandbox,'prepared');const info=prepareAndroid(fake);assert.equal(info.signed,false);assert.ok(!existsSync(join(fake,`card-duel-v${info.version}.apk`)));
});
