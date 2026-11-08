import {RULES,STATS,SKILLS,ITEMS,CONDITIONS,SLOT_NAMES} from './data.js';
import {summary,xpRequired} from './game.js';
export const KEY='re-rpg.stage-a.v1', BACKUP=KEY+'.backup';
const finite=(n,min=0,max=1e12)=>Number.isFinite(n)&&n>=min&&n<=max;
const integer=(n,min=0,max=1e12)=>Number.isInteger(n)&&finite(n,min,max);
function check(ok,field){if(!ok)throw Error('저장 파일 오류 | '+field);}
export function validate(s){
  check(s?.version===2,'버전');
  check(typeof s.nickname==='string'&&s.nickname.trim()&&[...s.nickname].length<=20,'닉네임');
  check(integer(s.level,1,RULES.maxLevel)&&integer(s.xp,0,xpRequired(s.level)-1),'레벨');
  check(s.classId===null||(s.classId==='warrior'&&s.level>=5),'직업');
  const keys=Object.keys(STATS);
  check(keys.every(k=>integer(s.stats?.[k],0,57))&&integer(s.points)&&keys.reduce((sum,k)=>sum+s.stats[k],s.points)===(s.level-1)*3,'스탯 포인트');
  check(Array.isArray(s.learned)&&s.learned.length===new Set(s.learned).size&&s.learned.every(k=>Object.hasOwn(SKILLS,k)&&s.level>=SKILLS[k].level&&s.classId==='warrior'),'스킬');
  check(integer(s.skillPoints)&&s.learned.reduce((n,k)=>n+SKILLS[k].cost,s.skillPoints)===Math.max(0,s.level-4),'스킬 포인트');
  check(['gold','stone','chaos'].every(k=>typeof s.currency?.[k]==='string'&&/^(0|[1-9]\d{0,999})$/.test(s.currency[k])),'재화');
  const seen=new Set();
  function item(i,ids=seen){
    check(i&&Object.hasOwn(ITEMS,i.template)&&/^item-\d+$/.test(i.id)&&!ids.has(i.id)&&Number(i.id.slice(5))<s.nextId,'장비 소유권');
    check([1,5,10,15,20].includes(i.level)&&integer(i.rarity,0,2)&&i.quality===50&&i.enhancement===0&&typeof i.protected==='boolean','장비 수치');
    if(i.potential!==undefined)check(Array.isArray(i.potential)&&i.potential.length===i.rarity+1&&i.potential.every(p=>p&&Object.hasOwn(STATS,p.key)&&integer(p.value,1,1+i.rarity+Math.ceil(i.level/5))&&typeof p.locked==='boolean'),'잠재능력');
    ids.add(i.id);
  }
  check(integer(s.nextId,1)&&integer(s.revision),'저장 번호');
  check(Array.isArray(s.inventory)&&s.inventory.length<=60&&Array.isArray(s.overflow)&&s.overflow.length<=3,'가방');
  s.inventory.forEach(i=>item(i));s.overflow.forEach(i=>item(i));
  check(Array.isArray(s.recent)&&s.recent.length<=8,'최근 장비');
  const recentIds=new Set();s.recent.forEach(i=>item(i,recentIds));
  check(Object.keys(s.equipment).sort().join(',')===Object.keys(SLOT_NAMES).sort().join(','),'슬롯');
  for(const [slot,i] of Object.entries(s.equipment))if(i!==null){item(i);check((ITEMS[i.template].slot===slot||(slot==='ring2'&&ITEMS[i.template].slot==='ring1'))&&s.level>=i.level,'장착 조건');}
  check(['loot','combat'].every(k=>integer(s.rng[k],1,4294967295)),'난수 상태');
  check(['hp','mp'].every(k=>integer(s.potions[k])&&finite(s.potionReady[k]))&&s.potionSlots.length===2&&s.potionSlots.every(k=>k===null||['hp','mp'].includes(k)),'포션');
  check(s.tactics.length===3&&s.tactics.every(r=>Object.hasOwn(SKILLS,r.skill)&&!SKILLS[r.skill].passive&&Object.hasOwn(CONDITIONS,r.condition)&&integer(r.priority,1,9)&&integer(r.value,1,r.condition.startsWith('enemies')?3:100)),'전술');
  check(typeof s.settings.abbreviate==='boolean'&&typeof s.settings.reducedMotion==='boolean','설정');
  check(integer(s.progress.kills)&&['wins','bosses'].every(k=>Array.isArray(s.progress[k])&&s.progress[k].length===4&&s.progress[k].every(n=>integer(n))),'진행도');
  const c=s.combat;
  check(['active','paused','boss'].every(k=>typeof c[k]==='boolean')&&integer(c.depth,0,3)&&integer(c.turn)&&integer(c.battleId),'전투');
  check(finite(c.time)&&finite(c.intermission,0,1.31)&&typeof c.lastAction==='string'&&c.lastAction.length<100,'전투 시간');
  check(Object.entries(c.buffs).every(([k,n])=>k==='shout'&&finite(n))&&Object.entries(c.cooldowns).every(([k,n])=>Object.hasOwn(SKILLS,k)&&integer(n)),'버프와 쿨타임');
  check(c.reserved===null||(s.learned.includes(c.reserved)&&!SKILLS[c.reserved].passive),'예약');
  check(Array.isArray(c.enemies)&&c.enemies.length<=3&&(!c.active||c.enemies.length>0),'적 수');
  const ids=new Set();
  for(const e of c.enemies){
    check(/^enemy-\d+-[012]$/.test(e.id)&&!ids.has(e.id)&&['slime','spike','sentinel','boss'].includes(e.shape)&&typeof e.name==='string'&&e.name.length<=40,'적');
    ids.add(e.id);
    check(['hp','maxHp','speed','attack','defense','turn','level','gauge'].every(k=>finite(e[k],0,1e6))&&e.hp<=e.maxHp&&e.maxHp>0&&typeof e.boss==='boolean'&&e.rewarded===(e.hp===0),'적 상태');
  }
  check(c.target===null||ids.has(c.target),'대상');
  const t=summary(s).total;
  check(integer(c.hp,0,t.hp)&&integer(c.mp,0,t.mp)&&finite(c.mpCarry,0,1)&&finite(c.gauge,0,t.gauge+1)&&(!c.active||c.hp>0),'플레이어 상태');
  check(Array.isArray(s.logs)&&s.logs.length<=45&&s.logs.every(l=>integer(l.id)&&finite(l.time)&&typeof l.text==='string'&&l.text.length<400&&['system','kill','loot','skill','level','danger','heal'].includes(l.kind)),'전투 기록');
  return s;
}
export function parse(text){check(typeof text==='string'&&text.length<=500000,'크기');const s=JSON.parse(text);
  if(s?.version===1){
    check(Object.keys(s.equipment).sort().join(',')==='armor,necklace,weapon','이전 슬롯');
    for(const slot of Object.keys(SLOT_NAMES))if(!(slot in s.equipment))s.equipment[slot]=null;
    s.recent=[...s.inventory,...s.overflow,...Object.values(s.equipment)].filter(i=>i&&i.id!=='item-1')
      .sort((a,b)=>Number(b.id.slice(5))-Number(a.id.slice(5))).slice(0,8).map(i=>({...i}));
    const c=s.combat,max=summary(s).total;
    c.mpCarry=c.mp%1;c.hp=Math.min(max.hp,Math.ceil(c.hp));c.mp=Math.min(max.mp,Math.floor(c.mp));
    for(const e of c.enemies)e.attack=Math.round(e.attack);
    s.version=2;
  }
  return validate(s);}
export function load(storage){
  let error=null;
  for(const key of [KEY,BACKUP]){
    try{
      const text=storage.getItem(key);if(!text)continue;
      const state=parse(text);
      if(state.combat.active)state.combat.paused=true;
      return {state,backup:key===BACKUP};
    }catch(e){error=e.message;}
  }
  return {state:null,error};
}
export function save(storage,state){
  validate(state);
  const previous=storage.getItem(KEY);
  if(previous){let valid=false;try{parse(previous);valid=true;}catch{}if(valid)storage.setItem(BACKUP,previous);}
  const revision=state.revision+1;
  storage.setItem(KEY,JSON.stringify({...state,revision}));
  state.revision=revision;
}
