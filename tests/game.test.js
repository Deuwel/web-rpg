import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game.js';
import {parse,load,save,validate,KEY,BACKUP} from '../src/storage.js';
const advance=(s,steps)=>{for(let n=0;n<steps;n++)g.tick(s);};
function trained(){const s=g.createGame(71);g.gainXp(s,100000);g.chooseWarrior(s);for(const id of ['shout','cleave','sweep'])g.learn(s,id);g.enter(s);return s;}
test('2-second independent player gauge and frozen pause',()=>{const s=g.createGame(1);g.enter(s);advance(s,39);assert.equal(s.combat.turn,0);g.tick(s);assert.equal(s.combat.turn,1);s.combat.paused=true;const before=structuredClone(s);advance(s,50);assert.deepEqual(s,before);});
test('speed and maximum gauge change interval independently',()=>{const s=g.createGame(3);s.stats.dex=500/3;assert.ok(Math.abs(g.summary(s).interval-4/3)<1e-9);s.stats.dex=0;s.equipment.necklace={template:'charm',level:1,rarity:0,quality:50};assert.equal(g.summary(s).interval,1.84);});
test('candidate eligibility, priority, conditional ties, slot order and fallback',()=>{const s=trained(),c=s.combat;c.enemies=Array.from({length:3},(_,i)=>({...c.enemies[0],id:'enemy-1-'+i,hp:8}));assert.equal(g.selectSkill(s),'shout');c.buffs.shout=10;assert.equal(g.selectSkill(s),'sweep');c.enemies.pop();assert.equal(g.selectSkill(s),'cleave');g.editRule(s,1,{condition:'hp',value:100});g.editRule(s,2,{condition:'mp',value:100});assert.equal(g.selectSkill(s),'cleave');c.cooldowns.cleave=10;assert.equal(g.selectSkill(s),'sweep');c.mp=0;assert.equal(g.selectSkill(s),null);});
test('invalid reservation falls back without extra cost',()=>{const s=trained();s.combat.reserved='sweep';s.combat.cooldowns.sweep=30;const mp=s.combat.mp;g.playerAction(s,[]);assert.equal(s.combat.lastAction,'전투의 함성');assert.equal(s.combat.mp,mp-10);});
test('potion slots share cooldown by kind and spend no turn',()=>{const s=trained(),c=s.combat;c.hp=2;c.mp=0;c.gauge=31;s.potionSlots=['hp','hp'];assert.equal(g.usePotion(s,0),undefined);assert.match(g.usePotion(s,1),/대기/);assert.equal(c.gauge,31);assert.equal(c.turn,0);s.potionSlots[1]='mp';g.usePotion(s,1);assert.deepEqual(s.potionReady,{hp:12,mp:18});});
test('dead enemy loses simultaneous turn and cannot pay twice',()=>{const s=g.createGame(1);g.enter(s);const c=s.combat;c.enemies=[{...c.enemies[0],hp:1,gauge:99,attack:99999}];c.gauge=99;g.tick(s);assert.ok(c.hp>0);assert.equal(s.progress.kills,1);const gold=s.currency.gold;advance(s,10);assert.equal(s.currency.gold,gold);});
test('three AoE kills each pay once and keep overflow',()=>{const s=trained(),c=s.combat;c.reserved='sweep';c.enemies=Array.from({length:3},(_,i)=>({...c.enemies[0],id:'enemy-1-'+i,hp:1,boss:true}));for(let i=0;i<60;i++)s.inventory.push(g.generateItem(s));c.gauge=100;g.tick(s);assert.equal(s.progress.kills,3);assert.equal(s.overflow.length,3);assert.equal(c.paused,true);g.sell(s,s.inventory[0].id);assert.equal(s.inventory.length,60);assert.equal(s.overflow.length,2);});
test('boss needs ten wins in the chosen depth and drops equipment',()=>{const s=g.createGame(2);assert.match(g.enter(s,0,true),/10승/);s.progress.wins[0]=10;g.enter(s,0,true);s.combat.enemies[0].hp=1;s.combat.gauge=100;g.tick(s);assert.equal(s.progress.bosses[0],1);assert.equal(s.inventory.length,1);validate(s);});
test('level gating, swap, armor speed penalty and protected sale',()=>{const s=g.createGame(3);const i={...g.generateItem(s),template:'heavy',level:5};s.inventory.push(i);const before=structuredClone(s);assert.ok(g.equip(s,i.id));assert.deepEqual(s,before);g.gainXp(s,300);g.equip(s,i.id);assert.equal(g.summary(s).total.speed,94);g.unequip(s,'armor');i.protected=true;assert.ok(g.sell(s,i.id));assert.equal(s.inventory.length,1);});
test('level and class point accounting',()=>{const s=g.createGame();g.gainXp(s,100000);assert.equal(s.points,57);assert.equal(s.skillPoints,16);g.chooseWarrior(s);g.learn(s,'cleave');g.allocate(s,'str');g.resetStats(s);assert.equal(s.points,57);assert.equal(s.skillPoints,14);validate(s);});
test('return to town clears stale combat references and saves',()=>{const s=trained();advance(s,80);g.retreat(s);assert.equal(s.combat.target,null);validate(s);});
test('deterministic save round trip',()=>{const s=trained();advance(s,120);const b=parse(JSON.stringify(s));advance(s,500);advance(b,500);assert.deepEqual(s,b);});
test('valid backup recovers corrupt primary; restored battle is paused',()=>{const s=trained(),map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};save(storage,s);save(storage,s);map.set(KEY,'bad');assert.ok(map.get(BACKUP));assert.equal(load(storage).state.combat.paused,true);assert.equal(load(storage).backup,true);});
test('invalid imports reject impossible points and duplicate item ownership',()=>{const s=g.createGame();assert.throws(()=>validate({...s,points:2}));assert.throws(()=>validate({...s,inventory:[s.equipment.weapon]}));assert.throws(()=>validate({...s,currency:{...s.currency,gold:'-1'}}));});
test('currency keeps exact integer units beyond 1e308',()=>{const s=g.createGame();s.currency.gold='1'+'0'.repeat(309);g.add(s,'gold',1);assert.equal(parse(JSON.stringify(s)).currency.gold,'1'+'0'.repeat(308)+'1');});
test('tactic editor bounds thresholds',()=>{const s=g.createGame();g.editRule(s,1,{condition:'enemiesGte',value:40,priority:-2});assert.equal(s.tactics[1].value,3);assert.equal(s.tactics[1].priority,1);});

test('simultaneous hits identify each attacker, recipient and player skill for the HUD', () => {
  const state = trained();
  const combat = state.combat;
  combat.enemies = [{...combat.enemies[0], hp: 10000, maxHp: 10000, gauge: 100}];
  combat.gauge = 100;
  combat.reserved = 'cleave';
  const enemyId = combat.enemies[0].id;
  const hits = g.tick(state).filter(event => event.type === 'hit');
  assert.deepEqual(hits.map(hit => [hit.source, hit.id]), [['player', enemyId], [enemyId, 'player']]);
  assert.equal(hits[0].skill, '가르기');
  assert.ok(hits.every(hit => hit.amount > 0));
});

test('old saves move three equipped pieces into nine slots and reconstruct only owned recent drops', () => {
  const old=g.createGame(4);
  const drop=g.generateItem(old);
  old.inventory.push(drop);
  old.equipment={weapon:old.equipment.weapon,armor:null,necklace:null};
  old.version=1;delete old.recent;delete old.combat.mpCarry;
  old.combat.hp=135.4;old.combat.mp=13.25;
  const restored=parse(JSON.stringify(old));
  assert.equal(restored.version,2);
  assert.equal(Object.keys(restored.equipment).length,9);
  assert.equal(restored.equipment.weapon.id,'item-1');
  assert.deepEqual(restored.recent,[drop]);
  assert.equal(restored.combat.hp,136);
  assert.equal(restored.combat.mp,13);
  assert.equal(restored.combat.mpCarry,.25);
  assert.deepEqual(parse(JSON.stringify(restored)),restored);
});

test('monster level caps equipment requirements for normal and boss loot', () => {
  const state=g.createGame(2);
  for(const level of [1,4,6,11,16])for(const boss of [true,false]){
    for(let roll=0;roll<100;roll++)assert.ok(g.generateItem(state,boss,level).level<=level);
  }
});

test('two rings use separate slots and their integer attributes affect combat', () => {
  const state=g.createGame(8);
  const makeRing=()=>({...g.generateItem(state),template:'ring',rarity:0,level:1});
  const first=makeRing(),second=makeRing(),third=makeRing();
  state.inventory.push(first,second,third);
  for(const ring of [first,second])assert.equal(g.equip(state,ring.id),undefined);
  assert.equal(state.equipment.ring1.id,first.id);
  assert.equal(state.equipment.ring2.id,second.id);
  const stats=g.summary(state);
  assert.deepEqual(stats.primary.int,{invested:0,gear:4,other:0,total:4});
  assert.equal(stats.total.magic,stats.base.magic+4);
  g.equip(state,third.id,'ring2');
  assert.equal(state.equipment.ring2.id,third.id);
  assert.ok(state.inventory.some(i=>i.id===second.id));
  validate(state);
});

test('recent eight rewards stay in acquisition order after a sale and reload', () => {
  const s=g.createGame(83);
  s.progress.wins[0]=10;
  const ids=[];
  for(let n=0;n<10;n++){
    g.enter(s,0,true);s.combat.enemies[0].hp=1;s.combat.gauge=100;
    const drop=g.tick(s).find(event=>event.type==='drop');
    ids.unshift(drop.item.id);
  }
  assert.deepEqual(s.recent.map(i=>i.id),ids.slice(0,8));
  g.sell(s,ids[0]);
  assert.deepEqual(parse(JSON.stringify(s)).recent.map(i=>i.id),ids.slice(0,8));
});

test('integer gear, primary and derived totals match the breakdown shown for battle', () => {
  const state=trained();
  g.retreat(state);
  for(const k of ['str','dex','int','vit','spr'])g.allocate(state,k);
  const boots={...g.generateItem(state),template:'boots',level:5,rarity:2};
  state.inventory.push(boots);g.equip(state,boots.id);
  state.combat.buffs.shout=state.combat.time+5;
  const stats=g.summary(state);
  for(const n of Object.values(g.itemStats(boots)))assert.ok(Number.isInteger(n));
  for(const k of Object.keys(stats.total)){
    for(const bucket of ['base','invested','gear','skills','total'])assert.ok(Number.isInteger(stats[bucket][k]));
    assert.equal(stats.total[k],stats.base[k]+stats.invested[k]+stats.gear[k]+stats.skills[k]);
  }
  g.enter(state);state.combat.mp=0;
  for(let i=0;i<30;i++){g.tick(state);assert.ok(Number.isInteger(state.combat.mp));assert.ok(Number.isInteger(state.combat.hp));}
});
