import { itemTile, itemCard, art } from './equipment-view.js';
import { showHits, dropOrigins, flyDrops } from './combat-effects.js';
import * as game from './game.js';
import { RULES, STATS, LABELS, ITEMS, SLOT_NAMES, SKILLS, CONDITIONS, POTIONS, DEPTHS, CATEGORIES, itemCategory } from './data.js';
import { KEY, load, parse, save } from './storage.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num = value => Number(value.toFixed(2)).toLocaleString('ko-KR');
const clock = t => [Math.floor(t/60),Math.floor(t%60)].map(n=>String(n).padStart(2,'0')).join(':');
const txt = (id,value) => {if($(id).textContent !== String(value)) $(id).textContent=value;};
const meter = (el,n,max) => {el.style.width=Math.min(100,Math.max(0,100*n/max))+'%';};
const option = (v,n,selected) => '<option value="'+escape(v)+'"'+(selected===v?' selected':'')+'>'+escape(n)+'</option>';
const action = (id,value,label,disabled=false) => '<button data-cmd="'+id+'" data-value="'+escape(value)+'"'+(disabled?' disabled':'')+'>'+escape(label)+'</button>';
const row = (title,detail,control='') => '<div class="row"><div><b>'+escape(title)+'</b><small>'+escape(detail)+'</small></div>'+control+'</div>';
const names = {gold:'골드',stone:'강화석',chaos:'혼돈 파편'};
let category='';
let s=game.createGame(), writable=false, persistent=true, damaged=false, ringSlot='', view='', subject='', pending=null;
let lastEnemies='', lastLog=-1, selectedDepth=0, toastTimer, lockRelease;
function notice(message){txt('notice',message);$('notice').hidden=!message;}
function toast(message){const id=$('dialog').open?'dialog-feedback':'toast';txt(id,message);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{txt('toast','');txt('dialog-feedback','');},2400);}
function retrieve(){
  try{
    const result=load(localStorage);
    if(result.state){s=result.state;selectedDepth=s.combat.depth;damaged=false;}
    else if(result.error){damaged=true;notice('저장을 읽을 수 없습니다. 설정에서 정상 JSON 파일을 불러오세요.');}
    if(result.backup)notice('직전 백업으로 복구했습니다.');
  }catch{persistent=false;notice('브라우저 저장 공간을 사용할 수 없습니다. 설정에서 파일로 저장하세요.');}
}
function persist(){
  if(!writable||!persistent||damaged)return;
  try{save(localStorage,s);txt('saved','자동 저장 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));}
  catch(e){notice('자동 저장 실패 | '+e.message);txt('saved','파일로 저장 필요');}
}
const amount = n => new Intl.NumberFormat('ko-KR',s.settings.abbreviate?{notation:'compact',maximumFractionDigits:1}:{}).format(BigInt(n));
function condition(r){return CONDITIONS[r.condition].replace('N',r.value);}
function displayEnemies(){
  const c=s.combat, list=c.active?c.enemies:[];
  const key=list.map(e=>e.id).join('/');
  if(lastEnemies!==key){
    $('enemies').innerHTML=list.map(e=>'<button class="fighter enemy" data-target="'+e.id+'" data-count="'+list.length+'"><small>Lv.'+e.level+'</small><strong>'+escape(e.name)+'</strong><div class="art"><i class="'+e.shape+'"></i></div><div class="vitals"><span>HP</span><b></b></div><div class="bar"><i></i></div><div class="bar gauge"><i></i></div><span class="warn"></span></button>').join('');
    lastEnemies=key;
  }
  for(const [index,e] of list.entries()){
    const node=$('enemies').children[index];
    node.disabled=!e.hp;node.setAttribute('aria-pressed',e.id===c.target);
    node.querySelector('.vitals b').textContent=e.hp+'/'+e.maxHp;
    const bars=node.querySelectorAll('.bar i');meter(bars[0],e.hp,e.maxHp);meter(bars[1],e.gauge,100);
    node.querySelector('.warn').textContent=e.boss&&e.turn%3===2?'⚠ 다음 행동 | 붕괴 강타':'';
  }
}
function renderLive(){
  const c=s.combat,{total,interval}=game.summary(s);
  txt('status',c.active?(c.paused?'탐험 일시정지':'변두리 들판 탐험 중'):'마을 정비 중');
  txt('live',c.active?(c.boss?'보스':'전투'):'대기');txt('pause',c.paused?'계속하기':'일시정지');
  $('pause').disabled=!c.active;$('retreat').disabled=!c.active;$('arena').classList.toggle('paused',c.active&&c.paused);
  txt('hp-count',Math.ceil(c.hp)+'/'+total.hp);meter($('hp'),c.hp,total.hp);meter($('mp'),c.mp,total.mp);meter($('gauge'),c.gauge,total.gauge);
  txt('buff',c.buffs.shout>c.time?'함성 '+Math.ceil(c.buffs.shout-c.time)+'초':'');
  txt('last-action',c.lastAction);txt('encounter',c.active?'조우 '+c.battleId+' | 생존 '+c.enemies.filter(e=>e.hp>0).length:'');
  txt('mp-count','MP '+Math.floor(c.mp)+' / '+total.mp);txt('interval','행동 간격 '+num(interval)+'초');txt('kills','누적 처치 '+s.progress.kills);
  txt('clock',clock(c.time));displayEnemies();$('portal').hidden=c.active;
  txt('portal-title',!c.hp?'탐험 종료':c.boss?'감시자 격파':'들판 입구');
  txt('portal-note',!c.hp?'보상을 보관했습니다. 다시 도전할 수 있습니다.':c.boss?'가방에서 획득한 장비를 확인하세요.':'탐험을 시작하면 적이 등장합니다.');
  for(const b of $('potions').children){
    const id=s.potionSlots[Number(b.dataset.potion)],left=id?Math.max(0,Math.ceil(s.potionReady[id]-c.time)):0;
    b.disabled=!id||!c.active||c.paused||left>0||!s.potions[id]||c[id]>=total[id];
    b.querySelector('small').textContent=id?(left?left+'초':s.potions[id]+'개'):'미등록';
  }
  for(const b of $('reservations').children){
    const id=b.dataset.reserve;
    b.disabled=!c.active||!s.learned.includes(id);b.setAttribute('aria-pressed',c.reserved===id);
    const wait=Math.max(0,(c.cooldowns[id]||0)-c.turn-1);
    b.title=SKILLS[id].name+' | '+(!s.learned.includes(id)?'미습득':wait?'대기 '+wait+'턴':c.mp<SKILLS[id].mp?'MP 부족':'다음 차례 예약');
  }
  if(lastLog!==s.logs[0]?.id){
    const rewards=s.logs.filter(l=>l.kind==='kill'||l.kind==='loot').slice(0,3);
    $('field-rewards').innerHTML=rewards.map(l=>'<span class="'+l.kind+'">'+escape(l.text)+'</span>').join('')||'<small>첫 처치 후 표시됩니다.</small>';
    $('logs').innerHTML=s.logs.map(l=>'<li class="'+l.kind+'"><time>'+clock(l.time)+'</time>'+escape(l.text)+'</li>').join('');
    lastLog=s.logs[0]?.id;
  }
}
function renderBag(){
  for(const b of document.querySelectorAll('[data-category]'))b.setAttribute('aria-pressed',b.dataset.category===category);
  txt('bag-count',s.inventory.length+' / '+RULES.capacity+'칸');
  const items=s.inventory.filter(i=>!category||itemCategory(ITEMS[i.template].slot)===category)
    .sort((a,b)=>Number(b.id.slice(5))-Number(a.id.slice(5)));
  if($('sort').value==='rarity')items.sort((a,b)=>b.rarity-a.rarity);
  if($('sort').value==='level')items.sort((a,b)=>b.level-a.level);
  $('overflow').hidden=!s.overflow.length;txt('overflow','임시 획득함 '+s.overflow.length+'개 | 공간 확보 시 자동 수령');
  txt('item-status',(CATEGORIES[category]||'전체')+' | '+items.length+'개');
  const empty='<div class="empty-slot" aria-hidden="true"></div>';
  $('items').innerHTML=items.map(i=>itemTile(i,false)).join('')+
    empty.repeat(category?0:RULES.capacity-items.length);
  txt('equipped-count',Object.values(s.equipment).filter(Boolean).length+' / 9');
  $('equipped').innerHTML=Object.entries(SLOT_NAMES).map(([slot,label])=>{
    const i=s.equipment[slot];
    return '<div class="wear-slot" data-slot-name="'+slot+'"><small>'+label+'</small>'+
      (i?itemTile(i,true):'<div class="wear-empty">'+art(({weapon:'sword',offhand:'shield',armor:'heavy',necklace:'charm',ring1:'ring',ring2:'ring'})[slot]||slot)+'</div>')+'</div>';
  }).join('')+'<div class="doll-core" aria-hidden="true"><i class="hero-shape"></i></div>';
  $('recent-items').innerHTML=s.recent.map(i=>itemTile(findItem(i.id)||i,false)).join('')+empty.repeat(8-s.recent.length);
  const stats=game.summary(s);
  $('loadout-stats').innerHTML=Object.entries(LABELS).map(([k,label])=>'<span>'+label+'<b>'+stats.total[k]+'</b></span>').join('');
}
function primaryRows(v,town){
  return Object.entries(STATS).map(([k,[name,desc]])=>{
    const a=v.primary[k];
    return '<div class="row"><div><b>'+name+' <strong>'+a.total+'</strong></b> <span class="sources">('+a.invested+' + <em class="gearcol">'+a.gear+'</em> + <em class="skillcol">'+a.other+'</em>)</span><small>'+desc+'</small></div>'+'<div class="point-controls">'+[-1,-10,1,10].map(n=>action('allocate',k+'/'+n,n>0?'+'+n:n,s.points<n||s.stats[k]+n<0)).join('')+'</div>'+'</div>';
  }).join('');
}
function render(){
  const c=s.combat,{total}=game.summary(s);
  document.body.classList.toggle('no-motion',s.settings.reducedMotion);
  for(const k of Object.keys(names)){txt(k,amount(s.currency[k]));$(k).parentElement.title=names[k]+' '+s.currency[k];}
  for(const id of ['name','hero-name'])txt(id,s.nickname);
  txt('hero-level','Lv.'+s.level);txt('level',s.level);txt('class-name',s.classId?'전사':'모험가');txt('points','스탯 포인트 '+s.points+' | 분배 →');
  txt('xp',s.level===RULES.maxLevel?'최대 레벨':s.xp+' / '+game.xpRequired(s.level));meter($('xp-bar'),s.level===RULES.maxLevel?1:s.xp,s.level===RULES.maxLevel?1:game.xpRequired(s.level));
  $('overview').innerHTML=['attack','defense','speed'].map(k=>'<span><small>'+LABELS[k]+'</small><b>'+num(total[k])+'</b></span>').join('');
  $('depth').innerHTML=DEPTHS.map((d,i)=>'<option value="'+i+'"'+(i===selectedDepth?' selected':'')+(s.level<i*5?' disabled':'')+'>'+d+(i?' | Lv.'+i*5:'')+'</option>').join('');
  $('depth').disabled=c.active;
  const wins=s.progress.wins[selectedDepth];txt('progress',Math.min(wins,10)+' / 10승');meter($('progress-bar'),wins,10);
  txt('boss-count','누적 '+wins+'승 | 감시자 격파 '+s.progress.bosses[selectedDepth]+'회');$('boss').disabled=c.active||wins<10;$('start').disabled=c.active;
  const levels=[...new Set(Object.values(SKILLS).map(v=>v.level))].sort((a,b)=>a-b);
  const node=([k,v])=>'<div class="skill-node"><span class="skill-mark" aria-hidden="true">'+({cleave:'╱',shout:'◎',sweep:'≋',endurance:'⬡'})[k]+'</span><b>'+v.name+'</b><small>'+v.desc+'</small>'+action('learn',k,s.learned.includes(k)?'습득 완료':v.cost+' SP 습득',c.active||!s.classId||s.level<v.level||s.skillPoints<v.cost||s.learned.includes(k))+'</div>';
  $('skill-tree').innerHTML='<h2>전사</h2><p>물리 공격과 생존에 특화 | Lv.5 전직 | 보유 SP '+s.skillPoints+'</p>'+action('warrior','',s.classId?'전직 완료':'마을에서 전사 선택',c.active||!!s.classId||s.level<5)+'<div class="tree-row"><b>레벨</b><b>액티브</b><b>패시브</b></div>'+levels.map(l=>'<div class="tree-row"><strong>Lv.'+l+'</strong>'+[false,true].map(passive=>'<div>'+Object.entries(SKILLS).filter(([,v])=>v.level===l&&!!v.passive===passive).map(node).join('')+'</div>').join('')+'</div>').join('');
  const groups=ruleGroups();
  $('rule-list').innerHTML=groups.map((group,g)=>'<section class="rule-group"><h3>'+['먼저 사용','다음에 사용','마지막에 사용'][g]+'</h3>'+group.map(i=>{
    const r=s.tactics[i];
    return '<div class="rule-edit"><button data-rule="'+i+'"><b>'+SKILLS[r.skill].name+'</b> | '+condition(r)+'</button><div>'+action('earlier',i,'↑',g===0&&group.length===1)+action('later',i,'↓',g===groups.length-1&&group.length===1)+action('tie',i,'위와 동순위',!g)+'</div></div>';
  }).join('')+'</section>').join('');
  $('reservations').innerHTML=Object.keys(SKILLS).filter(k=>!SKILLS[k].passive).map(id=>'<button data-reserve="'+id+'">'+SKILLS[id].name.replace('전투의 ','')+'</button>').join('');
  $('potions').innerHTML=s.potionSlots.map((k,i)=>'<button data-potion="'+i+'" aria-label="'+(POTIONS[k]?.name||'빈 포션 슬롯')+'">'+(k?k.toUpperCase():'—')+'<small></small></button>').join('');
  renderBag();renderLive();
}
function findItem(id){return [...s.inventory,...s.overflow,...Object.values(s.equipment),...s.recent].find(i=>i?.id===id);}
function modal(which,arg=''){

  view=which;subject=arg;txt('dialog-feedback','');
  const content=modalContent();
  txt('dialog-title',content[0]);$('dialog-body').innerHTML=content[1];
  if(!$('dialog').open)$('dialog').showModal();
}
function modalContent(){
  const town=!s.combat.active;
  if(view==='stats'){
    const v=game.summary(s), rows=Object.keys(LABELS).map(k=>'<tr><td>'+LABELS[k]+'</td><td>'+num(v.base[k]+v.invested[k])+'</td><td class="gearcol">'+num(v.gear[k])+'</td><td class="skillcol">'+num(v.skills[k])+'</td><td>'+num(v.total[k])+'</td></tr>').join('');
    return ['스탯 상세','<h3>남은 스탯 포인트 '+s.points+'</h3>'+'<p>최종 (투자 + <span class="gearcol">장비</span> + <span class="skillcol">기타</span>)</p>'+primaryRows(v,town)+'<div class="actions">'+action('reset','','무료 재분배',!town||!Object.values(s.stats).some(Boolean))+'</div><p>기본 열에는 레벨 성장과 투자한 포인트가 포함됩니다.</p><table><thead><tr><th>능력치</th><th>기본</th><th class="gearcol">장비</th><th class="skillcol">스킬</th><th>합계</th></tr></thead><tbody>'+rows+'</tbody></table>'];
  }
  if(view==='rates')return ['처치당 드롭률',row('장비','일반 '+RULES.dropRate*100+'% | 보스 100%')+row('강화석','일반 및 보스 '+RULES.stoneRate*100+'%')+row('혼돈 파편','일반 '+RULES.chaosRate*100+'% | 보스 '+RULES.bossChaosRate*100+'%')];
  if(view==='rule'){
    const r=s.tactics[subject];
    return ['전술 슬롯 '+(Number(subject)+1),'<div class="formgrid"><label>스킬<select id="r-skill">'+Object.entries(SKILLS).filter(([,v])=>!v.passive).map(([k,v])=>option(k,v.name,r.skill)).join('')+'</select></label><label>발동 조건<select id="r-cond">'+Object.entries(CONDITIONS).map(([k,v])=>option(k,v,r.condition)).join('')+'</select></label><label>N 값<input type="number" id="r-value" min="1" max="100" value="'+r.value+'"></label></div><p>작은 우선순위부터 판정합니다. 동순위에서는 조건을 만족한 스킬, 그다음은 위쪽 슬롯이 먼저입니다. 사용할 수 있는 스킬이 없으면 기본 공격합니다.</p><div class="actions">'+action('apply-rule','','적용')+'</div>'];
  }
  if(view==='item'){
    const i=findItem(subject);if(!i)return ['장비 상세','처리한 장비입니다.'];
    return ['장비 상세',itemCard(s,i,action,ringSlot)];
  }
  if(view==='settings'){
    return ['설정','<label>플레이어 닉네임<input id="nickname" type="text" maxlength="20" value="'+escape(s.nickname)+'"></label><div class="actions">'+action('nickname','','닉네임 적용')+'</div>'+row('큰 수 축약','기본값 OFF','<input type="checkbox" data-setting="abbreviate" aria-label="큰 수 축약" '+(s.settings.abbreviate?'checked':'')+'>')+row('전투 효과 줄이기','','<input type="checkbox" data-setting="reducedMotion" aria-label="전투 효과 줄이기" '+(s.settings.reducedMotion?'checked':'')+'>')+'<h3>포션 등록</h3><div class="formgrid">'+s.potionSlots.map((k,i)=>'<label>슬롯 '+(i+1)+'<select data-slot="'+i+'">'+option('','미등록',k||'')+Object.entries(POTIONS).map(([id,p])=>option(id,p.name,k)).join('')+'</select></label>').join('')+'</div>'+Object.entries(POTIONS).map(([k,p])=>row(p.name+' ×'+s.potions[k],Math.round(p.fraction*100)+'% 회복 | 쿨타임 '+p.cd+'초',action('buy',k,p.price+' 골드 구입',!town||BigInt(s.currency.gold)<p.price))).join('')+'<div class="actions">'+action('export','','저장 파일 받기')+action('import','','저장 파일 불러오기')+action('help','','도움말')+'</div><input type="file" id="file" accept=".json,application/json" hidden>'];
  }
  if(view==='import')return ['저장 파일 불러오기','<p>'+escape(pending.nickname)+' | Lv.'+pending.level+' | '+pending.progress.kills+'마리 처치</p><p>현재 진행을 이 파일의 진행으로 교체합니다.</p><div class="actions">'+action('confirm-import','','이 진행 불러오기')+'</div>'];
  if(view==='money')return [names[subject],'<p class="wallet-full">'+escape(BigInt(s.currency[subject]).toLocaleString('ko-KR'))+'</p><p>'+({gold:'몬스터 처치와 장비 판매로 얻습니다. 마을에서 포션을 구입할 수 있습니다.',stone:'몬스터 처치 시 낮은 확률로 획득합니다.',chaos:'일반 몬스터에게서 매우 낮은 확률로, 보스에게서 더 높은 확률로 획득합니다.'}[subject])+'</p>'];
  return ['탐험 도움말',row('탐험과 귀환','일반 전투에서는 적 1~3명이 등장합니다. 적을 눌러 공격 대상을 고를 수 있습니다. 같은 깊이에서 10승을 거두고 귀환하면 보스에게 도전할 수 있습니다.')+row('행동과 포션','노란 게이지가 차면 행동합니다. 스킬 버튼은 다음 행동을 예약하고 포션은 즉시 소비합니다. 같은 포션을 두 칸에 등록하면 수량과 쿨타임을 공유합니다.')+row('스탯 읽는 법','최종 스탯은 직접 투자한 포인트, 파란색 장비 보너스, 보라색 기타 보너스의 합입니다. 장비로 오른 힘과 민첩도 전투에 반영됩니다. 파생 능력치는 출처별 누적 보너스를 정수로 계산합니다.')+row('일시정지와 저장','가방이나 다른 탭을 확인하는 동안에도 전투가 이어집니다. 일시정지 버튼으로 직접 멈출 수 있습니다. 창을 닫고 저장을 다시 열면 일시정지 상태로 복원됩니다.')+row('장비와 성장','탐험 중에도 장비를 교체하고 스탯을 분배할 수 있습니다. 중갑은 속도가 감소하고 순환의 목걸이는 행동에 필요한 게이지를 줄입니다.')+row('이번 단계','최대 Lv.20 | 전사 | 변두리 들판 4개 깊이. 쌍수는 후속 단계에서 열립니다. 주무기 100% → 보조무기 60% 순으로 개별 치명타를 판정하고, 첫 타격으로 처치하면 두 번째 타격은 취소합니다.')];
}
function finish(error,refresh=true){
  if(error){toast(error);return;}
  persist();render();
  if(refresh&&$('dialog').open)modal(view,subject);
}
function download(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='re-rpg-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function ruleGroups(){
  const priorities=[...new Set(s.tactics.map(r=>r.priority))].sort((a,b)=>a-b);
  return priorities.map(p=>s.tactics.map((r,i)=>r.priority===p?i:-1).filter(i=>i>=0));
}
function moveRule(i,cmd){
  const groups=ruleGroups(),g=groups.findIndex(group=>group.includes(i));
  const original=groups[g];
  original.splice(original.indexOf(i),1);
  if(cmd==='tie')groups[g-1].push(i);
  else{
    const index=cmd==='earlier'?(original.length?g:g-1):(original.length?g+1:g+2);
    groups.splice(index,0,[i]);
  }
  s.tactics=groups.filter(group=>group.length).flatMap((group,rank)=>group.map(id=>({...s.tactics[id],priority:rank+1})));
}
function command(cmd,value){
  switch(cmd){
    case 'export':return download();
    case 'help':return modal('help');
    case 'import':return $('file').click();
    case 'confirm-import':
      if(!pending)return;s=pending;pending=null;damaged=false;
      if(s.combat.active)s.combat.paused=true;
      selectedDepth=s.combat.depth;lastEnemies='!';lastLog=-1;notice('');$('dialog').close();return finish();
    case 'nickname':{
      const n=$('nickname').value.trim();if(!n)return toast('닉네임을 입력하세요.');s.nickname=n;break;
    }
    case 'apply-rule':{
      const err=game.editRule(s,Number(subject),{skill:$('r-skill').value,priority:s.tactics[subject].priority,condition:$('r-cond').value,value:$('r-value').value});
      if(!err)$('dialog').close();return finish(err);
    }
    case 'warrior':return finish(game.chooseWarrior(s));
    case 'reset':return finish(game.resetStats(s));
    case 'learn':return finish(game.learn(s,value));
    case 'buy':return finish(game.buyPotion(s,value));
    case 'earlier':case 'later':case 'tie':moveRule(Number(value),cmd);return finish();
    case 'allocate':{const [key,n]=value.split('/');return finish(game.allocate(s,key,Number(n)));}
    case 'line-lock':case 'reroll':{
      const item=[...s.inventory,...Object.values(s.equipment)].find(i=>i?.id===subject);
      if(!item)return;
      if(cmd==='reroll')return finish(game.reroll(s,item));
      item.potential[value].locked=!item.potential[value].locked;return finish();
    }
    case 'equip':return finish(game.equip(s,value,ringSlot));
    case 'unequip':return finish(game.unequip(s,value));
    case 'lock':{const i=findItem(value);if(i)i.protected=!i.protected;break;}
    case 'sell':{
      const err=game.sell(s,value);if(!err)$('dialog').close();return finish(err);
    }
  }
  finish();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const d=b.dataset;
  if(b.id==='close'){pending=null;return $('dialog').close();}
  if(d.category!==undefined){category=d.category;return renderBag();}
  if(d.open)return modal(d.open);
  if(d.money)return modal('money',d.money);
  if(d.item){ringSlot='';return modal('item',d.item);}
  if(d.rule!==undefined)return modal('rule',d.rule);
  if(d.cmd==='export')return download();
  if(!writable)return toast('다른 탭의 게임을 닫은 뒤 새로고침하세요.');
  if(damaged&&!['import','confirm-import','help'].includes(d.cmd))return toast('먼저 정상 저장 파일을 불러오세요.');
  if(d.cmd)return command(d.cmd,d.value);
  if(d.target){s.combat.target=d.target;return finish();}
  if(d.reserve){s.combat.reserved=s.combat.reserved===d.reserve?null:d.reserve;return finish();}
  if(d.potion!==undefined)return finish(game.usePotion(s,Number(d.potion)));
  switch(b.id){
    case 'start':case 'quick-start':case 'boss':{
      const error=game.enter(s,selectedDepth,b.id==='boss');
      if(!error){previous=performance.now();accumulated=0;$('effects').replaceChildren();txt('hit-dealt','—');txt('hit-taken','—');}
      return finish(error);
    }
    case 'pause':
      if(s.combat.paused&&s.overflow.length)return toast('가방 장비를 판매하거나 마을로 귀환하세요.');
      if(s.combat.paused){previous=performance.now();accumulated=0;}
      s.combat.paused=!s.combat.paused;return finish();
    case 'retreat':game.retreat(s);return finish();
  }
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='ring-choice'){ringSlot=el.value;return modal(view,subject);}
  if(el.id==='depth'){selectedDepth=Number(el.value);return render();}
  if(el.id==='sort')return renderBag();
  if(!writable)return;
  if(el.id==='file'){
    const file=el.files[0];if(!file)return;
    try{if(file.size>500000)throw Error('파일 크기 초과');pending=parse(await file.text());modal('import');}
    catch(err){toast(err.message);}return;
  }
  if(damaged)return;
  if(el.dataset.slot!==undefined){s.potionSlots[Number(el.dataset.slot)]=el.value||null;return finish();}
  if(el.dataset.setting){s.settings[el.dataset.setting]=el.checked;return finish();}
});
document.addEventListener('visibilitychange',()=>{advanceClock();if(document.hidden)persist();else render();});
window.addEventListener('pagehide',()=>{advanceClock();persist();lockRelease?.();writable=false;});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(!writable&&e.key===KEY){retrieve();lastEnemies='!';lastLog=-1;render();}});
function navigate(focus=false){
  const hash=location.hash.slice(1),page=hash==='inventory'?hash:['skills','tactics'].includes(hash)?'skills':'battle';
  $('skill-tree').hidden=hash==='tactics';$('tactic-editor').hidden=hash!=='tactics';

  for(const section of document.querySelectorAll('main .page'))section.hidden=section.id!==page+'-page';
  for(const link of document.querySelectorAll('nav a')){
    if(link.hash==='#'+page)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  const card=$('profile-card');
  if(page==='battle')$('profile-home').append(card);
  else $(page+'-page').querySelector('.heading').after(card);
  if(focus){window.scrollTo(0,0);$(page+'-page').querySelector('h1').focus({preventScroll:true});}
}
window.addEventListener('hashchange',()=>navigate(true));
function init(writer){
  writable=writer;retrieve();render();navigate();
  if(!writer)notice('다른 탭에서 진행 중입니다. 이 탭에서 플레이하려면 다른 탭을 닫고 새로고침하세요.');
}
if(navigator.locks){
  navigator.locks.request(KEY,{ifAvailable:true},async lock=>{
    init(!!lock);if(lock)await new Promise(resolve=>{lockRelease=resolve;});
  }).catch(()=>{persistent=false;init(true);notice('파일 저장 모드 | 설정에서 진행 파일을 받으세요.');});
}else{persistent=false;init(true);notice('파일 저장 모드 | 설정에서 진행 파일을 받으세요.');}
let previous=performance.now(),accumulated=0,lastSave=0,lastPaint=0;
function advanceClock(){
  const now=performance.now(),delta=(now-previous)/1000;previous=now;
  if(!writable||!s.combat.active||s.combat.paused){accumulated=0;return;}
  const hadShout=s.combat.buffs.shout>s.combat.time;
  accumulated+=delta;
  const events=[];
  // Limit work per callback, retaining elapsed time when a background timer was throttled.
  const steps=Math.min(600,Math.floor(accumulated/RULES.step));
  for(let n=0;n<steps&&s.combat.active&&!s.combat.paused;n++){
    events.push(...game.tick(s));accumulated-=RULES.step;
  }
  if(!s.combat.active||s.combat.paused)accumulated=0;
  const live=!document.hidden&&!$('battle-page').hidden&&delta<1&&!$('dialog').open;
  const drops=live?dropOrigins(events,$('arena')):[];
  for(const e of events){
    if(e.type==='hit')txt(e.id==='player'?'hit-taken':'hit-dealt',e.amount+(e.critical?(e.id==='player'?' 강타':' 치명타'):''));
  }
  if(live)showHits(events,$('arena'),$('player'),$('effects'),s.settings.reducedMotion);
  const reward=events.some(e=>e.type!=='hit');
  if(!document.hidden){
    if(reward||hadShout!==(s.combat.buffs.shout>s.combat.time)){
      render();flyDrops(drops,$('recent-items'),art,s.settings.reducedMotion);
      if($('dialog').open&&['stats','item','skills'].includes(view))modal(view,subject);
    }else if(now-lastPaint>=95){renderLive();lastPaint=now;}
  }
  if(reward||now-lastSave>4000){persist();lastSave=now;}
}
setInterval(advanceClock,50);
