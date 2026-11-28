// Developer-only optional tool: render the generated SVG layout posters and
// contact sheets for users who cannot open HTML in the chat viewer.
// Requires ImageMagick and Inkscape, not needed to install/play RUNEHALL.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const output=resolve('previews');
mkdirSync(output,{recursive:true});
const temp=mkdtempSync(join(tmpdir(),'card-duel-preview-'));
const cache=new Map();
try{
  for(const [source,target] of [['interface-layout','battle-layout'],['interface-hover','card-hover'],['card-frame-comparison','card-frame-comparison'],['duplicate-art-comparison','duplicate-art-comparison']]){
    let svg=readFileSync('dist/'+source+'.svg','utf8');
    // Inkscape cannot decode embedded WebP on some systems, although browsers
    // can. Transcode only the embedded images for this PNG layout export.
    svg=svg.replace(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g,(_,b)=>{
      if(!cache.has(b))cache.set(b,execFileSync('magick',['webp:-','png:-'],{input:Buffer.from(b,'base64'),maxBuffer:10000000}).toString('base64'));
      return 'data:image/png;base64,'+cache.get(b);
    });
    const temporary=join(temp,source+'.svg');
    writeFileSync(temporary,svg);
    execFileSync('inkscape',[temporary,'--export-type=png','--export-filename='+join(output,target+'.png'),'--export-width=1600'],{stdio:'inherit'});
  }
  const dir=resolve('apps/client/src/assets/illustrations');
  const selected=['epic-brawl','epic-earth-elemental','epic-assassin','epic-lay-on-hands','epic-force-nature','epic-lore','epic-pit-lord','epic-pyroblast','epic-ice-block','epic-spellbender','epic-faceless','epic-murloc','epic-pirate','epic-crab','epic-sea-giant','epic-mountain-giant','epic-molten-giant','epic-parrot','epic-blood-knight','epic-doomsayer'];
  execFileSync('magick',['montage',...selected.map(n=>join(dir,n+'.webp')),'-tile','5x4','-geometry','240x240+6+6','-background','#221b19','-bordercolor','#927b5e','-border','1','-quality','92',join(output,'illustrations.jpg')]);
  execFileSync('magick',['montage',...readdirSync(dir).filter(n=>n.endsWith('.webp')).sort().map(n=>join(dir,n)),'-tile','10x','-geometry','115x115+2+2','-background','#231e1b','-quality','85',join(output,'illustrations-all.jpg')]);
  for(const [prefix,name] of [['epic-','illustrations-epics-all.jpg'],['classic-','illustrations-classic.jpg'],['distinct-','illustrations-distinct.jpg']]){
    execFileSync('magick',['montage',...readdirSync(dir).filter(n=>n.startsWith(prefix)).sort().map(n=>join(dir,n)),'-tile','8x','-geometry','180x180+4+4','-background','#231e1b','-quality','90',join(output,name)]);
  }
  const varied='classic-field-medic classic-herb-doctor classic-dawn-cleric classic-moon-healer classic-temple-guardian classic-young-priestess classic-sun-protector classic-spell-tutor classic-wind-oracle classic-earth-mage classic-ether-mage classic-wind-farseer classic-spell-breaker classic-mana-addict classic-tiny-summoner classic-healing-scholar classic-crowd-recruiter classic-tower-mage classic-high-mage classic-pain-scholar classic-cult-master classic-kirin-mage classic-night-cat classic-raging-wolf classic-plague-gnome foot-soldier warhorse banner-commander goblin-bomber gladiator blacksmith peacekeeper red-templar shieldbearer injured-fighter crusader adventurer auctioneer rocket-pilot frost-commander squire rogue-assassin priest-healer archer-falcon dwarf-tinkerer brute-frost brute-lava brute-tauren brute-troll ice-spear fire ice lightning holy nature shadow arcane shield sword axe dagger bow hammer book coin trap eye storm arrow blood nature-gem arcane-missiles holy-healing shadow-curse fire-wall'.split(' ');
  execFileSync('magick',['montage',...varied.map(n=>join(dir,n+'.webp')),'-tile','5x','-geometry','230x230+4+4','-background','#231e1b','-quality','91',join(output,'illustrations-variety-v032.jpg')]);
  console.log('Rendered 4 layout/comparison PNGs and art contact sheets.');
}finally{
  // Only the private temporary folder created above; never touches game data.
  rmSync(temp,{recursive:true,force:true});
}
