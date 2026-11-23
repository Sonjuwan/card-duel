import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');

test('installed PWA hides redundant browser fullscreen control but keeps portrait rotate guide',()=>{
  assert.match(ui,/const \[isInstalled,setIsInstalled\]=useState\(false\)/);
  assert.match(ui,/const sync=\(\)=>setIsInstalled\(alreadyAppWindow\(\)\)/);
  assert.match(ui,/\{!isInstalled&&<button type="button" className="landscape-fullscreen-control secondary"/);
  assert.match(ui,/className="rotate-device-message" role="dialog"/);
  assert.match(ui,/onClick=\{\(\)=>void requestLandscape\(\)\}/);
});
test('standalone/fullscreen display transitions and return-to-browser focus resync install state',()=>{
  assert.match(ui,/window\.matchMedia\('\(display-mode: standalone\)'\)/);
  assert.match(ui,/window\.matchMedia\('\(display-mode: fullscreen\)'\)/);
  assert.match(ui,/standalone\.addEventListener\?\.\('change',sync\)/);
  assert.match(ui,/fullDisplay\.addEventListener\?\.\('change',sync\)/);
  assert.match(ui,/window\.addEventListener\('focus',sync\)/);
  assert.match(ui,/window\.removeEventListener\('focus',sync\)/);
});
