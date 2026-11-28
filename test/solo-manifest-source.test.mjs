import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {soloManifest} from '../apps/client/solo-app/manifest-config.mjs';
const builder=readFileSync(new URL('../apps/client/test/build-solo-app.mjs',import.meta.url),'utf8');

test('installable PWA launches independently, without address bar, in landscape on supported platforms',()=>{
  assert.equal(soloManifest.display,'standalone');
  assert.deepEqual(soloManifest.display_override,['fullscreen','standalone']);
  assert.equal(soloManifest.orientation,'landscape');
  assert.equal(soloManifest.start_url,'./');
  assert.equal(soloManifest.scope,'./');
  assert.equal(soloManifest.id,'./');
  assert.equal(soloManifest.lang,'ko');
  assert.deepEqual(soloManifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
});
test('builder uses the shared manifest and iOS standalone metadata without promising forced browser rotation',()=>{
  assert.match(builder,/import \{soloManifest as manifest\} from '\.\.\/solo-app\/manifest-config\.mjs'/);
  assert.match(builder,/apple-mobile-web-app-capable/);
  assert.match(builder,/apple-mobile-web-app-status-bar-style/);
  assert.match(builder,/JSON\.stringify\(manifest,null,2\)/);
});
