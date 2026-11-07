import {RULES, ITEMS, SKILLS, POTIONS, ENEMIES, GRADES, STATS, CONDITIONS} from './data.js';

export const xpRequired = level => 18 + level*7;
export const itemName = item => GRADES[item.rarity]+' '+ITEMS[item.template].name;
export const price = item => Math.ceil((6+item.level*3)*[1,1.3,1.7][item.rarity]);
export function random(s,channel='combat'){
  let x=s.rng[channel]>>>0;
  x^=x<<13; x^=x>>>17; x^=x<<5;
  s.rng[channel]=x>>>0;
  return s.rng[channel]/4294967296;
}
export function log(s,text,kind='system'){
  s.logs.unshift({id:s.nextId++,text,kind,time:s.combat.time});
  s.logs.length=Math.min(s.logs.length,45);
}
export function add(s,key,value){s.currency[key]=(BigInt(s.currency[key])+BigInt(value)).toString();}
export function createGame(seed=Date.now()>>>0){
  const state={
    version:1,nickname:'여행자',level:1,xp:0,classId:null,points:0,skillPoints:0,
    stats:{str:0,dex:0,int:0,vit:0,spr:0},learned:[],currency:{gold:'0',stone:'0',chaos:'0'},
    inventory:[],overflow:[],equipment:{weapon:{id:'item-1',template:'sword',level:1,rarity:0,quality:50,enhancement:0,protected:false},armor:null,necklace:null},
    potions:{hp:6,mp:4},potionSlots:['hp','mp'],potionReady:{hp:0,mp:0},
    tactics:[{skill:'shout',priority:1,condition:'unbuffed',value:30},{skill:'cleave',priority:2,condition:'always',value:30},{skill:'sweep',priority:2,condition:'enemiesGte',value:3}],
    settings:{abbreviate:false,reducedMotion:false},progress:{wins:[0,0,0,0],bosses:[0,0,0,0],kills:0},
    rng:{combat:seed>>>0||1,loot:(seed^0x9e3779b9)>>>0||2},nextId:2,revision:0,logs:[],
    combat:{active:false,paused:false,time:0,turn:0,battleId:0,depth:0,boss:false,enemies:[],target:null,reserved:null,gauge:0,hp:150,mp:40,buffs:{},cooldowns:{},intermission:0,lastAction:'탐험 대기'}
  };
  log(state,'윈드해븐에 도착했습니다. 변두리 들판을 탐험하세요.');
  return state;
}
export function itemStats(item){
  const scale=[1,1.3,1.7][item.rarity]*(1+(item.level-1)*.16)*(.8+.004*item.quality);
  return Object.fromEntries(Object.entries(ITEMS[item.template].stats).map(([key,value])=>[key,['speed','gauge'].includes(key)?value:value*scale]));
}
export function summary(s,equipment=s.equipment){
  const a=s.stats,l=s.level-1;
  const base={hp:150+8*l,mp:40+2*l,attack:12+1.5*l,magic:8+l,defense:3+.4*l,resist:2+.3*l,speed:100,crit:5,regen:.6,gauge:100};
  const invested={hp:8*a.vit,mp:2*a.int+4*a.spr,attack:a.str,magic:a.int,defense:.1*a.str+.25*a.vit,resist:.15*a.vit+.25*a.spr,speed:.3*a.dex,crit:.03*a.dex,regen:.05*a.spr,gauge:0};
  const gear=Object.fromEntries(Object.keys(base).map(k=>[k,0]));
  const skills={...gear};
  for(const item of Object.values(equipment).filter(Boolean)){
    for(const [key,value] of Object.entries(itemStats(item)))gear[key]+=value;
  }
  const total=Object.fromEntries(Object.keys(base).map(k=>[k,base[k]+invested[k]+gear[k]]));
  if(s.classId==='warrior'&&s.learned.includes('endurance')){
    skills.hp=total.hp*.15;skills.defense=total.defense*.15;
  }
  if(s.combat.buffs.shout>s.combat.time)skills.attack=total.attack*.3;
  for(const key of Object.keys(total))total[key]+=skills[key];
  total.hp=Math.floor(total.hp);total.mp=Math.floor(total.mp);
  const interval=Math.min(5,Math.max(.5,2*total.gauge/total.speed));
  return {base,invested,gear,skills,total,interval};
}
function recover(s){const {hp,mp}=summary(s).total;s.combat.hp=hp;s.combat.mp=mp;}
export function gainXp(s,amount,events=[]){
  if(s.level===RULES.maxLevel)return;
  s.xp+=amount;
  while(s.level<RULES.maxLevel&&s.xp>=xpRequired(s.level)){
    s.xp-=xpRequired(s.level);s.level++;s.points+=3;
    if(s.level>=5)s.skillPoints++;
    recover(s);log(s,'레벨 '+s.level+' 달성 | 스탯 +3','level');events.push({type:'level'});
  }
  if(s.level===RULES.maxLevel)s.xp=0;
}
export function qualifies(s,rule){
  const c=s.combat,t=summary(s).total,count=c.enemies.filter(e=>e.hp>0).length;
  switch(rule.condition){
    case 'always':return true;
    case 'hp':case 'mp':return 100*c[rule.condition]/t[rule.condition]<=rule.value;
    case 'unbuffed':return !(c.buffs[rule.skill]>c.time);
    case 'enemiesGte':return count>=rule.value;
    case 'enemiesLte':return count<=rule.value;
    default:return false;
  }
}
export function available(s,id,turn=s.combat.turn){
  const skill=SKILLS[id],c=s.combat;
  return skill&&!skill.passive&&s.classId==='warrior'&&s.learned.includes(id)&&c.mp>=skill.mp&&(c.cooldowns[id]||0)<=turn;
}
export function selectSkill(s){
  return s.tactics.map((rule,index)=>({...rule,index})).filter(r=>available(s,r.skill)&&qualifies(s,r))
    .sort((a,b)=>a.priority-b.priority||Number(a.condition==='always')-Number(b.condition==='always')||a.index-b.index)[0]?.skill||null;
}
export function generateItem(s,boss=false){
  const roll=random(s,'loot'),rarity=boss?(roll<.28?2:1):(roll<.7?0:roll<.95?1:2);
  const pool=Object.keys(ITEMS),template=pool[Math.floor(random(s,'loot')*pool.length)];
  const level=s.combat.depth*5||(random(s,'loot')<.7?1:5);
  return {id:'item-'+s.nextId++,template,level,rarity,quality:50,enhancement:0,protected:false};
}
function reward(s,enemy,events){
  if(enemy.rewarded)return;
  enemy.rewarded=true;s.progress.kills++;
  const gold=enemy.boss?60+8*enemy.level:5+2*enemy.level;
  add(s,'gold',gold);gainXp(s,enemy.boss?45+8*enemy.level:7+3*enemy.level,events);
  if(random(s,'loot')<RULES.stoneRate)add(s,'stone',1);
  if(random(s,'loot')<(enemy.boss?RULES.bossChaosRate:RULES.chaosRate))add(s,'chaos',1);
  log(s,enemy.name+' 처치 | 골드 +'+gold,'kill');
  if(enemy.boss||random(s,'loot')<RULES.dropRate){
    const item=generateItem(s,enemy.boss);
    (s.inventory.length<RULES.capacity?s.inventory:s.overflow).push(item);
    log(s,itemName(item)+' 획득','loot');
  }
  events.push({type:'kill',id:enemy.id});
}
export const damage=(attack,defense,power=1,critical=false)=>Math.max(1,Math.floor(attack*power*100/(100+Math.max(0,defense))*(critical?1.5:1)));
export function playerAction(s,events){
  const c=s.combat,alive=c.enemies.filter(e=>e.hp>0);
  const target=alive.find(e=>e.id===c.target)||alive[0];
  if(!target)return;
  c.turn++;c.target=target.id;
  const reserved=c.reserved&&available(s,c.reserved)?c.reserved:null;
  if(c.reserved&&!reserved)log(s,'예약 조건을 충족하지 않아 자동 전술로 복귀했습니다.');
  const id=reserved||selectSkill(s),skill=SKILLS[id];
  c.reserved=null;c.lastAction=skill?.name||'기본 공격';
  if(skill){
    c.mp-=skill.mp;c.cooldowns[id]=c.turn+skill.cd;log(s,skill.name+' 사용','skill');
  }
  if(id==='shout'){c.buffs.shout=c.time+skill.duration;return;}
  const t=summary(s).total;
  for(const enemy of id==='sweep'?alive:[target]){
    const critical=random(s)*100<t.crit,amount=damage(t.attack,enemy.defense,skill?.power||1,critical);
    enemy.hp=Math.max(0,enemy.hp-amount);
    events.push({type:'hit',id:enemy.id,amount,critical});
    if(enemy.hp===0)reward(s,enemy,events);
  }
  if(!target.hp)c.target=c.enemies.find(e=>e.hp>0)?.id||null;
}
export function spawn(s,boss=false){
  const c=s.combat,count=boss?1:1+Math.floor(random(s)*3),scale=1+c.depth*1.8;
  c.battleId++;c.boss=boss;c.intermission=0;c.reserved=null;
  c.enemies=Array.from({length:count},(_,index)=>{
    const t=ENEMIES[Math.floor(random(s)*ENEMIES.length)],hp=Math.round((boss?125:t.hp)*scale);
    return {id:'enemy-'+c.battleId+'-'+index,name:boss?'들판의 감시자':t.name,shape:boss?'boss':t.shape,level:1+c.depth*5,hp,maxHp:hp,
      attack:(boss?11:t.attack)*scale,defense:(boss?8:t.defense)+c.depth*4,speed:boss?65:t.speed,gauge:0,turn:0,boss,rewarded:false};
  });
  c.target=c.enemies[0].id;
}
export function enter(s,depth=0,boss=false){
  if(s.combat.active)return '마을로 귀환한 후 도전하세요.';
  if(!Number.isInteger(depth)||depth<0||depth>3||s.level<depth*5)return '진입 레벨이 부족합니다.';
  if(s.overflow.length)return '가방을 비워 임시 획득함의 장비를 수령하세요.';
  if(boss&&s.progress.wins[depth]<RULES.bossWins)return '이 깊이에서 일반 전투 10승이 필요합니다.';
  Object.assign(s.combat,{active:true,paused:false,depth,gauge:0,turn:0,buffs:{},cooldowns:{},lastAction:'행동 준비'});
  recover(s);spawn(s,boss);log(s,boss?'들판의 감시자에게 도전합니다.':'변두리 들판에 진입했습니다.');
}
export function retreat(s){
  Object.assign(s.combat,{active:false,paused:false,boss:false,reserved:null,enemies:[],target:null,intermission:0,buffs:{},gauge:0,lastAction:'마을 정비'});
  recover(s);log(s,'윈드해븐 귀환 | 획득한 보상을 보관했습니다.');
}
// A fixed simulation step makes the fastest actor win ties independently of rendering.
export function tick(s){
  const events=[],c=s.combat,dt=RULES.step;
  if(!c.active||c.paused)return events;
  c.time+=dt;
  const {total,interval}=summary(s);
  c.mp=Math.min(total.mp,c.mp+total.regen*dt);
  if(c.intermission>0){
    c.intermission=Math.max(0,c.intermission-dt);
    if(!c.intermission)spawn(s);
    return events;
  }
  c.gauge+=total.gauge/interval*dt;
  for(const enemy of c.enemies)if(enemy.hp>0)enemy.gauge+=enemy.speed/2*dt;
  if(c.gauge+1e-8>=total.gauge){
    c.gauge=Math.max(0,c.gauge-total.gauge);playerAction(s,events);
  }
  for(const enemy of c.enemies){
    if(enemy.hp===0||enemy.gauge+1e-8<100)continue;
    enemy.gauge=Math.max(0,enemy.gauge-100);enemy.turn++;
    const heavy=enemy.boss&&enemy.turn%3===0,amount=damage(enemy.attack,summary(s).total.defense,heavy?2:1);
    c.hp=Math.max(0,c.hp-amount);events.push({type:'hit',id:'player',amount,critical:heavy});
    if(heavy)log(s,'감시자의 붕괴 강타','danger');
    if(!c.hp){
      c.active=false;c.reserved=null;c.buffs={};log(s,'패배 | 획득한 보상은 유지됩니다.','danger');events.push({type:'death'});return events;
    }
  }
  if(c.enemies.every(e=>e.hp===0)){
    if(c.boss){
      s.progress.bosses[c.depth]++;c.active=false;c.buffs={};
      log(s,'들판의 감시자 격파 | 장비를 확인하세요.','level');
    }else{
      s.progress.wins[c.depth]++;c.intermission=1.3;
      const max=summary(s).total.hp;c.hp=Math.min(max,c.hp+.06*max);
    }
    if(s.overflow.length){c.paused=true;log(s,'가방이 가득 차 탐험을 멈췄습니다.','danger');}
    events.push({type:'wave'});
  }
  return events;
}
export function usePotion(s,slot){
  const id=s.potionSlots[slot],p=POTIONS[id],c=s.combat;
  if(!p||!s.potions[id])return '등록한 포션이 없습니다.';
  if(!c.active||c.paused)return '전투 진행 중 사용할 수 있습니다.';
  if(s.potionReady[id]>c.time)return '재사용 대기 중입니다.';
  const max=summary(s).total[id];
  if(c[id]>=max)return '이미 가득 찼습니다.';
  s.potions[id]--;c[id]=Math.min(max,c[id]+max*p.fraction);s.potionReady[id]=c.time+p.cd;log(s,p.name+' 사용','heal');
}
export function buyPotion(s,id){
  const p=POTIONS[id];
  if(s.combat.active)return '마을에서 구입하세요.';
  if(!p||BigInt(s.currency.gold)<BigInt(p.price))return '골드가 부족합니다.';
  add(s,'gold',-p.price);s.potions[id]++;
}
export function allocate(s,key){
  if(s.combat.active)return '마을에서 투자하세요.';
  if(!Object.hasOwn(STATS,key)||!s.points)return '남은 포인트가 없습니다.';
  s.stats[key]++;s.points--;recover(s);
}
export function resetStats(s){
  if(s.combat.active)return '마을에서 재분배하세요.';
  for(const k of Object.keys(STATS))s.stats[k]=0;
  s.points=(s.level-1)*3;recover(s);
}
export function chooseWarrior(s){
  if(s.combat.active||s.level<5)return '레벨 5 이상일 때 마을에서 선택하세요.';
  s.classId='warrior';log(s,'전사의 길을 선택했습니다.','level');
}
export function learn(s,id){
  const skill=SKILLS[id];
  if(s.combat.active||s.classId!=='warrior'||!skill||s.level<skill.level)return '마을에서 직업과 레벨 조건을 확인하세요.';
  if(s.learned.includes(id)||s.skillPoints<skill.cost)return '습득 여부와 스킬 포인트를 확인하세요.';
  s.learned.push(id);s.skillPoints-=skill.cost;recover(s);
}
export function equip(s,id){
  const index=s.inventory.findIndex(i=>i.id===id),item=s.inventory[index];
  if(s.combat.active||!item||item.level>s.level)return '마을에서 착용 레벨을 확인하세요.';
  const slot=ITEMS[item.template].slot,old=s.equipment[slot];
  s.inventory.splice(index,1);s.equipment[slot]=item;
  if(old)s.inventory.push(old);
  collectOverflow(s);recover(s);
}
export function unequip(s,slot){
  if(s.combat.active||!s.equipment[slot]||s.inventory.length>=RULES.capacity)return '마을에서 가방 공간을 확보하세요.';
  s.inventory.push(s.equipment[slot]);s.equipment[slot]=null;recover(s);
}
export function collectOverflow(s){
  while(s.inventory.length<RULES.capacity&&s.overflow.length)s.inventory.push(s.overflow.shift());
}
export function sell(s,id){
  const index=s.inventory.findIndex(i=>i.id===id),item=s.inventory[index];
  if(!item||item.protected)return '잠금이 해제된 가방 장비만 판매할 수 있습니다.';
  add(s,'gold',price(item));s.inventory.splice(index,1);collectOverflow(s);
}
export function editRule(s,index,patch){
  const rule={...s.tactics[index],...patch};
  if(!Object.hasOwn(SKILLS,rule.skill)||SKILLS[rule.skill].passive||!Object.hasOwn(CONDITIONS,rule.condition))return '전술 조건을 확인하세요.';
  rule.priority=Math.min(9,Math.max(1,Math.round(Number(rule.priority)||1)));
  rule.value=Math.min(rule.condition.startsWith('enemies')?3:100,Math.max(1,Math.round(Number(rule.value)||1)));
  s.tactics[index]=rule;
}
