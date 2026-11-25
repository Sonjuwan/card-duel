import type {Card,Catalog,HeroClass,PlayerId,PlayerView,Target} from '../../../packages/engine/src/index.ts';
import type {BattleAnimation} from '../../../packages/protocol.ts';
import {impactChanges} from './battle-fx-model.ts';
import {className} from './data.ts';

export const EMOTE_LABELS={greet:'인사',thanks:'감사',praise:'칭찬',sorry:'사과',surprise:'놀람',threat:'도발'} as const;
export type Emote=keyof typeof EMOTE_LABELS;
export type DialogueKind='play'|'attack'|'hit'|'death'|'emote';
type VoiceProfile={play:readonly string[];attack:readonly string[];hit:readonly string[];death:readonly string[];pitch:number;rate:number};
type HeroVoice=VoiceProfile&{emotes:Record<Emote,string>};
export const HERO_DIALOGUE:Record<HeroClass,HeroVoice>={
  warrior:{play:['전열을 갖춰라!','강철로 답하겠다.'],attack:['방패를 부숴라!','돌격!'],hit:['큭, 아직이다!','견딜 수 있다!'],death:['명예는 남는다...','전우들이여...'],pitch:.72,rate:.98,emotes:{greet:'좋은 승부를 겨뤄 보자.',thanks:'그 은혜, 기억하겠다.',praise:'훌륭한 일격이군!',sorry:'내 실수다. 다시 간다.',surprise:'이런 전술이라니!',threat:'내 도끼 앞에서 물러서라!'}},
  shaman:{play:['정령이 응답한다.','바람이 길을 열리라!'],attack:['천둥이여!','폭풍의 분노!'],hit:['바람이 흔들리는군.','으윽!'],death:['정령의 곁으로...','폭풍은 잠든다...'],pitch:.89,rate:.95,emotes:{greet:'정령의 축복이 함께하길.',thanks:'대지와 하늘에 감사하오.',praise:'정령도 감탄하겠군!',sorry:'바람의 방향을 잘못 읽었소.',surprise:'정령들이여, 이게 무슨 일이오?',threat:'폭풍이 네 위를 덮으리라!'}},
  rogue:{play:['조용히 처리하지.','그림자 속으로.'],attack:['빈틈 발견!','빠르게 끝내지.'],hit:['쳇!','제법이군.'],death:['그림자로 돌아간다...','이런 실수를...'],pitch:.92,rate:1.14,emotes:{greet:'반갑군. 방심은 금물이야.',thanks:'덕분에 일이 쉬워졌군.',praise:'꽤 깔끔한 수였어.',sorry:'이번엔 내가 속았군.',surprise:'어라, 그건 예상 못 했는데?',threat:'뒤를 조심해.'}},
  paladin:{play:['빛의 깃발 아래!','정의를 위하여!'],attack:['심판의 일격!','빛으로!'],hit:['빛은 꺼지지 않는다!','으윽!'],death:['빛이여, 나를 인도하소서...','사명은 이어지리라.'],pitch:1.02,rate:.94,emotes:{greet:'빛이 그대의 길을 비추기를.',thanks:'그대의 호의에 감사하오.',praise:'참으로 훌륭한 싸움이오!',sorry:'부디 나의 과오를 용서하시오.',surprise:'빛도 놀랄 일이군!',threat:'정의의 심판을 받아라!'}},
  hunter:{play:['사냥 준비 완료.','발자국을 따라가자.'],attack:['표적 확인!','놓치지 마라!'],hit:['상처는 익숙해.','아얏!'],death:['사냥은 끝났다...','숲으로 돌아간다...'],pitch:.88,rate:1.08,emotes:{greet:'좋은 사냥이 되길.',thanks:'유용한 도움이었어.',praise:'정확한 한 방이군!',sorry:'표적을 놓쳤어.',surprise:'이런 함정이 있었군!',threat:'넌 이제 내 사냥감이다.'}},
  druid:{play:['숲이 깨어난다.','생명의 순환이여.'],attack:['대지의 분노!','뿌리여, 일어나라!'],hit:['가지가 꺾여도...','아아, 고통이여.'],death:['씨앗은 다시 자라리라...','자연으로 돌아가리.'],pitch:.66,rate:.87,emotes:{greet:'자연의 평화가 함께하길.',thanks:'숲이 그 호의를 기억하리.',praise:'균형을 읽는 솜씨가 좋군.',sorry:'순환을 어지럽혔군.',surprise:'대지가 떨리는구나!',threat:'오래된 숲의 분노를 보아라!'}},
  warlock:{play:['계약은 성립했다.','심연의 힘을 보아라.'],attack:['영혼을 내놓아라!','고통을 맛봐라!'],hit:['고통쯤이야!','크흐!'],death:['계약은 아직 끝나지...','심연이 나를 부른다...'],pitch:.60,rate:1,emotes:{greet:'계약을 맺으러 왔나?',thanks:'네 호의의 대가는 기억하지.',praise:'놀라운 힘이군, 인정하마.',sorry:'계약서에 작은 실수가 있었군.',surprise:'심연조차 예상 못 했겠군!',threat:'너의 영혼은 곧 내 것이 된다!'}},
  mage:{play:['마력이 모인다!','주문은 준비되었다.'],attack:['마력 폭발!','비전의 힘으로!'],hit:['앗, 집중이 흐트러졌어!','크윽!'],death:['마력이 흩어진다...','주문이... 끊겼어.'],pitch:1.24,rate:1.08,emotes:{greet:'마법과 함께 반가운 인사를!',thanks:'고마워, 멋진 도움이었어.',praise:'완벽한 계산이었어!',sorry:'주문을 잘못 외웠네.',surprise:'이건 정말 마법인가?',threat:'다음 주문은 피할 수 없을걸?'}},
  priest:{play:['기도가 이루어지리라.','고요한 가호를.'],attack:['빛의 권능이여!','정신을 집중하라!'],hit:['믿음은 흔들리지 않아.','아, 고통이군.'],death:['평온 속으로...','빛은 남으리라.'],pitch:1.13,rate:.9,emotes:{greet:'마음에 평화가 깃들기를.',thanks:'가호가 그대에게 돌아가기를.',praise:'참으로 지혜로운 선택입니다.',sorry:'제 판단이 부족했습니다.',surprise:'믿기 어려운 기적이군요!',threat:'그대의 오만이 곧 시험받을 겁니다.'}}
};
const neutral:VoiceProfile={play:['준비됐습니다!','명령을 기다립니다.','제가 앞장서죠.'],attack:['받아라!','돌격!','간다!'],hit:['아야!','크윽!','으윽!'],death:['여기까지인가...','뒤를 부탁해...','끝인가...'],pitch:1,rate:1.05};
const tribes:Partial<Record<string,VoiceProfile>>={
  beast:{play:['크르르!','그르릉!'],attack:['크아아!','캬악!'],hit:['낑!','캥!'],death:['으르르...','낑...'],pitch:.74,rate:1.13},
  demon:{play:['심연에서 왔다.','공포를 가져왔다!'],attack:['무릎 꿇어라!','갈가리 찢어라!'],hit:['끄윽!','감히!'],death:['심연으로 돌아가리...','이럴 수가...'],pitch:.55,rate:.95},
  dragon:{play:['하늘이 나의 영토다.','날개를 펼친다!'],attack:['용의 숨결!','불타라!'],hit:['건방지군!','그르르!'],death:['날개가 꺾이는구나...','하늘이여...'],pitch:.58,rate:.9},
  murloc:{play:['머럭! 머럭!','그르라락!'],attack:['므르글락!','라라락!'],hit:['므악!','끽!'],death:['므르르...','머럭...'],pitch:1.55,rate:1.22},
  pirate:{play:['닻을 올려라!','보물이 보인다!'],attack:['갑판을 점령해!','이거나 받아라!'],hit:['으악, 내 모자!','쳇!'],death:['바다가 부른다...','내 보물...'],pitch:.76,rate:1.12},
  totem:{play:['웅...','정령이 깨어난다.'],attack:['우웅!','정령의 힘!'],hit:['두둥!','으음!'],death:['정령이 잠든다...','웅...'],pitch:.62,rate:.86}
};
const special:Record<string,Partial<Record<'play'|'attack'|'hit'|'death',string>>> ={
  wisp:{play:'반짝! 여기 있어!',attack:'반짝!',hit:'앗!',death:'빛이 사라져...'},
  recruit:{play:'방패는 준비되었습니다!',attack:'전열을 지켜라!',death:'전우들을... 지켜...'},
  wolf:{play:'아우우! 무리를 불러라!',attack:'크르릉!',death:'아우우...'},
  night_cat:{play:'쉿, 발소리를 숨겨.',attack:'캬악!',death:'미야...'},
  ogre:{play:'나 큰 주먹 가져왔다!',attack:'주먹 간다!',hit:'아프다!',death:'나 쓰러진다...'},
  flame_sphere:{play:'불꽃이여, 터져라!'},
  silver_squire:{play:'은빛 맹세를 지키리!',attack:'맹세를 위하여!'},
  deckhand:{play:'선장님, 승선했습니다!',attack:'승선하라!'},
  void_sentinel:{play:'공허의 문을 지킨다.',attack:'심연을 보아라!'},
  snow_brute:{play:'눈보라가 몰려온다!',attack:'얼어붙어라!'},
  grommash_hellscream:{play:'전장의 함성이 내 피를 깨운다!',attack:'분노를 받아라!',hit:'더 세게 와라!',death:'명예로운... 마지막 일격.'},
  alakir:{play:'바람의 모든 길은 나에게 이어진다.',attack:'회오리여, 찢어라!',hit:'폭풍이 흔들린다!',death:'바람은... 흩어진다.'},
  edwin_vancleef:{play:'그림자단은 이미 네 뒤에 있다.',attack:'빈틈을 노려!',hit:'날 알아챘군!',death:'계획은... 계속된다.'},
  tirion_fordring:{play:'검을 들고 빛 앞에 서겠다.',attack:'거짓을 베어라!',hit:'맹세는 굳건하다!',death:'검을... 이어받아라.'},
  king_krush:{play:'쿠오오오!',attack:'크아아아!',hit:'끄르렁!',death:'쿠우우...'},
  cenarius:{play:'숲의 뿌리가 우리를 잇는다.',attack:'대지여, 일어서라!',hit:'숲이 아파하는구나.',death:'새싹은 다시 돋으리.'},
  lord_jaraxxus:{play:'심연의 왕좌가 나를 부른다!',attack:'재가 되어라!',hit:'건방진 필멸자!',death:'심연으로... 돌아가리.'},
  archmage_antonidas:{play:'오래된 주문도 새롭게 피어나는 법.',attack:'불꽃의 공식을 완성한다!',hit:'계산이 어긋났군!',death:'마법은... 끝나지 않네.'},
  prophet_velen:{play:'빛은 먼 별 너머에서도 우리를 찾는다.',attack:'빛의 길을 보아라!',hit:'어둠이 짙어지는군.',death:'다음 빛을... 기다리게.'},
  bloodmage_thalnos:{play:'피 한 방울이면 충분하지.',attack:'생명력이여, 불타라!',hit:'아직 피가 남았어!',death:'마력이... 고갈된다.'},
  lorewalker_cho:{play:'오늘 이야기를 기록해 보세.',attack:'이 대목은 기억해야겠군!',hit:'아이고, 붓이 흔들렸네!',death:'나머지는... 자네가 쓰게.'},
  millhouse_manastorm:{play:'이건 계획된 혼돈이라고!',attack:'마나 폭풍 발사!',hit:'잠깐, 그건 아니지!',death:'폭풍이... 꺼져 가...'},
  nat_pagle:{play:'오늘의 대어는 어디 있나?',attack:'낚싯줄을 당겨!',hit:'앗, 낚싯대가!',death:'한 마리만... 더...'},
  king_mukla:{play:'우호호! 바나나!',attack:'우아아!',hit:'우욱!',death:'우우...'},
  leeroy_jenkins:{play:'계획은 됐고, 먼저 간다!',attack:'돌겨어억!',hit:'앗, 너무 앞섰나!',death:'다음엔... 같이 가자.'},
  cairne_bloodhoof:{play:'대지의 숨결이 나를 이끈다.',attack:'부족을 위하여!',hit:'뿔은 아직 꺾이지 않았다.',death:'선조들이여...'},
  the_black_knight:{play:'검은 망토 아래, 심판을 숨긴다.',attack:'그 방패는 소용없다!',hit:'날카롭군.',death:'어둠에... 잠긴다.'},
  sylvanas_windrunner:{play:'잊힌 자들의 목소리가 들리는가?',attack:'네 의지는 내 것이다!',hit:'죽음은 낯설지 않아.',death:'다시... 침묵 속으로.'},
  hogger:{play:'우리 무리의 땅이다!',attack:'물어뜯어라!',hit:'캥! 으르렁!',death:'무리여... 도망쳐...'},
  illidan_stormrage:{play:'어둠을 견딘 자만이 자유를 안다.',attack:'불꽃의 쌍날을 보아라!',hit:'아직 싸울 수 있다!',death:'내 선택을... 후회하지 않는다.'},
  baron_geddon:{play:'불길이 전장을 집어삼킨다!',attack:'타올라라!',hit:'불꽃은 멈추지 않아!',death:'재만... 남으리.'},
  gruul:{play:'산도 내 앞에서 무너진다!',attack:'으아아! 부숴라!',hit:'더 커진다!',death:'산이... 무너진다.'},
  ragnaros:{play:'화염의 왕좌에서 내려왔다!',attack:'모두 불타리라!',hit:'불길은 꺼지지 않는다!',death:'재 속에서... 기다리리.'}
};
export type DialogueLine={side:PlayerId;speaker:string;text:string;kind:DialogueKind;pitch:number;rate:number;cardId?:string;hero?:HeroClass};
export type DialoguePlan={start:DialogueLine[];impact:DialogueLine[];death:DialogueLine[]};
function variation(id:string,revision:number,lines:readonly string[]){let hash=revision>>>0;for(const c of id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;return lines[hash%lines.length];}
function performanceProfile(p:VoiceProfile,id:string,kind:'play'|'attack'|'hit'|'death',card:boolean){
  let hash=0;for(const c of id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const individual=card?((hash%9)-4)*.018:0,pace=card?(((hash>>>8)%7)-3)*.018:0;
  const emotion={play:[0,0],attack:[.08,.12],hit:[.13,.09],death:[-.12,-.18]}[kind];
  return {pitch:Math.max(.45,Math.min(1.75,p.pitch+individual+emotion[0])),rate:Math.max(.72,Math.min(1.4,p.rate+pace+emotion[1]))};
}
function profile(card:Card|undefined,hero:HeroClass):VoiceProfile{
  if(!card)return HERO_DIALOGUE[hero];
  if(card.kind==='minion'&&tribes[card.tribe])return tribes[card.tribe]!;
  if(card.kind!=='coin'&&card.class!=='neutral')return HERO_DIALOGUE[card.class];
  return neutral;
}
export function cardDialogue(card:Card|undefined,hero:HeroClass,side:PlayerId,kind:'play'|'attack'|'hit'|'death',revision:number,name=(c:Card)=>c.name):DialogueLine{
  const p=profile(card,hero),id=card?.id??hero;
  return {side,speaker:card?name(card):className[hero],text:(card&&special[id]?.[kind])||variation(id,revision,p[kind]),kind,...performanceProfile(p,id,kind,!!card),...(card?{cardId:id}:{hero})};
}
export function heroEmote(hero:HeroClass,side:PlayerId,emote:Emote):DialogueLine{
  const v=HERO_DIALOGUE[hero];return {side,speaker:className[hero],kind:'emote',hero,text:v.emotes[emote],pitch:v.pitch,rate:v.rate};
}
export function dialoguePlan(a:BattleAnimation,before:PlayerView,after:PlayerView,seat:PlayerId,catalog:Catalog,name=(c:Card)=>c.name):DialoguePlan{
  const start:DialogueLine[]=[],impact:DialogueLine[]=[],death:DialogueLine[]=[];
  const hero=(side:PlayerId)=>(side===seat?before.self:before.opponent).heroClass;
  const line=(side:PlayerId,kind:'play'|'attack'|'hit'|'death',card?:Card)=>cardDialogue(card,hero(side),side,kind,a.revision,name);
  if(a.kind==='secret')start.push({...line(a.actor,'play'),speaker:'비밀',text:'쉿... 아직은 비밀이다.'});
  else if(a.kind==='heroAttack')start.push(line(a.actor,'attack'));
  else if(a.kind==='power')start.push(line(a.actor,'play'));
  else if(['summon','spell','weapon','coin'].includes(a.kind)&&a.cardId&&catalog[a.cardId])start.push(line(a.actor,'play',catalog[a.cardId]));
  for(const event of impactChanges(before,after,seat,a.events)){
    if(event.kind==='damage'&&event.target.kind==='hero'&&(event.amount??0)>0)impact.push(line(event.side,'hit'));
  }
  for(const side of [seat,seat===0?1:0] as PlayerId[]){
    const old=side===seat?before.self:before.opponent,next=side===seat?after.self:after.opponent;
    if(old.health>0&&next.health<=0)death.push(line(side,'death'));
  }
  return {start,impact,death};
}
