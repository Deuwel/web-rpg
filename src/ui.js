import * as game from './game.js';
import { RULES, STATS, LABELS, ITEMS, SLOT_NAMES, SKILLS, CONDITIONS, POTIONS, DEPTHS } from './data.js';
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
const icons = {weapon:'†',armor:'⬡',necklace:'◇'};
let s=game.createGame(), writable=false, persistent=true, damaged=false, tab='bag', view='', subject='', pending=null;
let lastEnemies='', lastLog=-1, selectedDepth=0, toastTimer, lockRelease;
function notice(message){txt('notice',message);$('notice').hidden=!message;}
function toast(message){txt('toast',message);clearTimeout(toastTimer);toastTimer=setTimeout(()=>txt('toast',''),2400);}
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
    $('logs').innerHTML=s.logs.map(l=>'<li class="'+l.kind+'"><time>'+clock(l.time)+'</time>'+escape(l.text)+'</li>').join('');
    lastLog=s.logs[0]?.id;
  }
}
function renderBag(){
  const gear=tab==='gear',filter=$('filter').value;
  $('bag-tab').setAttribute('aria-selected',!gear);$('gear-tab').setAttribute('aria-selected',gear);
  txt('bag-count',s.inventory.length+' / '+RULES.capacity);
  const arr=(gear?Object.values(s.equipment).filter(Boolean):[...s.inventory].reverse()).filter(i=>!filter||ITEMS[i.template].slot===filter);
  if($('sort').value==='rarity')arr.sort((a,b)=>b.rarity-a.rarity);
  if($('sort').value==='level')arr.sort((a,b)=>b.level-a.level);
  $('overflow').hidden=!s.overflow.length;txt('overflow','임시 획득함 '+s.overflow.length+'개 | 가방에 자리가 생기면 자동 수령');
  $('items').innerHTML=arr.map(i=>'<button class="item grade'+i.rarity+'" data-item="'+i.id+'"><i>'+icons[ITEMS[i.template].slot]+'</i><span>'+game.itemName(i)+'<small>'+ITEMS[i.template].type+' | Lv.'+i.level+'</small></span><span>'+(i.protected?'잠금':'상세 →')+'</span></button>').join('')||'<div class="empty"><b>◇</b>'+(gear?'해당하는 장착 장비가 없습니다.':'획득한 장비가 여기에 표시됩니다.')+'</div>';
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
  $('rule-list').innerHTML=s.tactics.map((r,i)=>'<button class="rule" data-rule="'+i+'"><span class="spread"><span class="priority">P'+String(r.priority).padStart(2,'0')+'</span><span class="rule-state">'+(s.learned.includes(r.skill)?'등록됨':'미습득')+'</span></span><b>'+SKILLS[r.skill].name+'</b><small>'+condition(r)+'　↗</small></button>').join('');
  $('reservations').innerHTML=Object.keys(SKILLS).filter(k=>!SKILLS[k].passive).map(id=>'<button data-reserve="'+id+'">'+SKILLS[id].name.replace('전투의 ','')+'</button>').join('');
  $('potions').innerHTML=s.potionSlots.map((k,i)=>'<button data-potion="'+i+'" aria-label="'+(POTIONS[k]?.name||'빈 포션 슬롯')+'">'+(k?k.toUpperCase():'—')+'<small></small></button>').join('');
  renderBag();renderLive();
}
function drawHits(events){
  if(s.settings.reducedMotion)return;
  const arena=$('arena').getBoundingClientRect();
  for(const e of events.filter(e=>e.type==='hit')){
    const actor=e.id==='player'?$('player'):document.querySelector('[data-target="'+e.id+'"]');
    if(!actor)continue;
    const box=actor.getBoundingClientRect(),hit=document.createElement('i');hit.className='hit'+(e.critical?' critical':'');hit.textContent='−'+e.amount;
    hit.style.left=(box.left-arena.left+box.width/2)+'px';hit.style.top=(box.top-arena.top+box.height/2)+'px';
    $('effects').append(hit);setTimeout(()=>hit.remove(),760);
  }
}
function findItem(id){return [...s.inventory,...Object.values(s.equipment)].find(i=>i?.id===id);}
function modal(which,arg=''){
  if(s.combat.active&&!s.combat.paused&&writable){s.combat.paused=true;persist();renderLive();}
  view=which;subject=arg;
  const content=modalContent();
  txt('dialog-title',content[0]);$('dialog-body').innerHTML=content[1];
  if(!$('dialog').open)$('dialog').showModal();
}
function modalContent(){
  const town=!s.combat.active;
  if(view==='stats'){
    const v=game.summary(s), rows=Object.keys(LABELS).map(k=>'<tr><td>'+LABELS[k]+'</td><td>'+num(v.base[k]+v.invested[k])+'</td><td class="gearcol">'+num(v.gear[k])+'</td><td class="skillcol">'+num(v.skills[k])+'</td><td>'+num(v.total[k])+'</td></tr>').join('');
    return ['스탯 상세','<h3>남은 스탯 포인트 '+s.points+'</h3>'+Object.entries(STATS).map(([k,[name,desc]])=>row(name+' '+s.stats[k],desc,action('allocate',k,'+1',!town||!s.points))).join('')+'<div class="actions">'+action('reset','','무료 재분배',!town||!Object.values(s.stats).some(Boolean))+'</div><p>기본 열에는 레벨 성장과 투자한 포인트가 포함됩니다.</p><table><thead><tr><th>능력치</th><th>기본</th><th class="gearcol">장비</th><th class="skillcol">스킬</th><th>합계</th></tr></thead><tbody>'+rows+'</tbody></table>'];
  }
  if(view==='skills'){
    return ['직업과 스킬',row(s.classId?'전사':'모험가','Lv.5부터 마을에서 전사를 선택할 수 있습니다.',action('warrior','','전사 선택',!town||!!s.classId||s.level<5))+'<p>보유 SP '+s.skillPoints+' | Lv.5부터 레벨마다 1 SP를 얻습니다.</p>'+Object.entries(SKILLS).map(([k,v])=>row(v.name+' | Lv.'+v.level,v.desc+(v.passive?' | 패시브':' | MP '+v.mp+' | '+v.cd+'턴'),action('learn',k,s.learned.includes(k)?'습득 완료':v.cost+' SP 습득',!town||!s.classId||s.level<v.level||s.skillPoints<v.cost||s.learned.includes(k)))).join('')];
  }
  if(view==='rule'){
    const r=s.tactics[subject];
    return ['전술 슬롯 '+(Number(subject)+1),'<div class="formgrid"><label>스킬<select id="r-skill">'+Object.entries(SKILLS).filter(([,v])=>!v.passive).map(([k,v])=>option(k,v.name,r.skill)).join('')+'</select></label><label>우선순위<input type="number" id="r-priority" min="1" max="9" value="'+r.priority+'"></label><label>발동 조건<select id="r-cond">'+Object.entries(CONDITIONS).map(([k,v])=>option(k,v,r.condition)).join('')+'</select></label><label>N 값<input type="number" id="r-value" min="1" max="100" value="'+r.value+'"></label></div><p>작은 우선순위부터 판정합니다. 동순위에서는 조건을 만족한 스킬, 그다음은 위쪽 슬롯이 먼저입니다. 사용할 수 있는 스킬이 없으면 기본 공격합니다.</p><div class="actions">'+action('apply-rule','','적용')+'</div>'];
  }
  if(view==='item'){
    const i=findItem(subject);if(!i)return ['장비 상세','처리한 장비입니다.'];
    const kind=ITEMS[i.template],equipped=s.equipment[kind.slot]?.id===i.id;
    const current=game.summary(s).total,next=game.summary(s,{...s.equipment,[kind.slot]:equipped?null:i}).total;
    return [game.itemName(i),'<p>'+kind.type+' | 착용 Lv.'+i.level+' | 품질 '+i.quality+'% | +'+i.enhancement+'</p>'+Object.entries(game.itemStats(i)).map(([k,n])=>row(LABELS[k],num(n))).join('')+'<h3>'+(equipped?'해제':'교체')+' 후 비교</h3>'+Object.keys(current).filter(k=>current[k]!==next[k]).map(k=>row(LABELS[k],num(current[k])+' → '+num(next[k]))).join('')+'<div class="actions">'+(equipped?action('unequip',kind.slot,'해제',!town):action('equip',i.id,'장착',!town||s.level<i.level))+action('lock',i.id,i.protected?'잠금 해제':'잠금')+(equipped?'':action('sell',i.id,'판매 | '+game.price(i)+' 골드',i.protected))+'</div>'];
  }
  if(view==='settings'){
    return ['설정','<label>플레이어 닉네임<input id="nickname" type="text" maxlength="20" value="'+escape(s.nickname)+'"></label><div class="actions">'+action('nickname','','닉네임 적용')+'</div>'+row('큰 수 축약','기본값 OFF','<input type="checkbox" data-setting="abbreviate" aria-label="큰 수 축약" '+(s.settings.abbreviate?'checked':'')+'>')+row('전투 효과 줄이기','','<input type="checkbox" data-setting="reducedMotion" aria-label="전투 효과 줄이기" '+(s.settings.reducedMotion?'checked':'')+'>')+'<h3>포션 등록</h3><div class="formgrid">'+s.potionSlots.map((k,i)=>'<label>슬롯 '+(i+1)+'<select data-slot="'+i+'">'+option('','미등록',k||'')+Object.entries(POTIONS).map(([id,p])=>option(id,p.name,k)).join('')+'</select></label>').join('')+'</div>'+Object.entries(POTIONS).map(([k,p])=>row(p.name+' ×'+s.potions[k],Math.round(p.fraction*100)+'% 회복 | 쿨타임 '+p.cd+'초',action('buy',k,p.price+' 골드 구입',!town||BigInt(s.currency.gold)<p.price))).join('')+'<div class="actions">'+action('export','','저장 파일 받기')+action('import','','저장 파일 불러오기')+action('help','','도움말')+'</div><input type="file" id="file" accept=".json,application/json" hidden>'];
  }
  if(view==='import')return ['저장 파일 불러오기','<p>'+escape(pending.nickname)+' | Lv.'+pending.level+' | '+pending.progress.kills+'마리 처치</p><p>현재 진행을 이 파일의 진행으로 교체합니다.</p><div class="actions">'+action('confirm-import','','이 진행 불러오기')+'</div>'];
  if(view==='money')return [names[subject],'<p class="wallet-full">'+escape(BigInt(s.currency[subject]).toLocaleString('ko-KR'))+'</p><p>'+({gold:'몬스터 처치와 장비 판매로 얻습니다. 마을에서 포션을 구입할 수 있습니다.',stone:'몬스터 처치 시 낮은 확률로 획득합니다.',chaos:'일반 몬스터에게서 매우 낮은 확률로, 보스에게서 더 높은 확률로 획득합니다.'}[subject])+'</p>'];
  return ['탐험 도움말',row('탐험과 귀환','일반 전투에서는 적 1~3명이 등장합니다. 적을 눌러 공격 대상을 고를 수 있습니다. 같은 깊이에서 10승을 거두고 귀환하면 보스에게 도전할 수 있습니다.')+row('행동과 포션','노란 게이지가 차면 행동합니다. 스킬 버튼은 다음 행동을 예약하고 포션은 즉시 소비합니다. 같은 포션을 두 칸에 등록하면 수량과 쿨타임을 공유합니다.')+row('일시정지와 저장','상세 창을 열거나 게임 탭을 벗어나면 전투가 멈춥니다. 계속하기로 재개하세요. 새로고침한 전투도 일시정지 상태에서 이어집니다.')+row('장비와 성장','마을에서 장비를 교체하고 스탯을 분배합니다. 중갑은 속도가 감소하고 순환의 목걸이는 행동에 필요한 게이지를 줄입니다.')+row('이번 단계','최대 Lv.20 | 전사 | 변두리 들판 4개 깊이. 쌍수는 후속 단계에서 열립니다. 주무기 100% → 보조무기 60% 순으로 개별 치명타를 판정하고, 첫 타격으로 처치하면 두 번째 타격은 취소합니다.')];
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
      const err=game.editRule(s,Number(subject),{skill:$('r-skill').value,priority:$('r-priority').value,condition:$('r-cond').value,value:$('r-value').value});
      if(!err)$('dialog').close();return finish(err);
    }
    case 'warrior':return finish(game.chooseWarrior(s));
    case 'reset':return finish(game.resetStats(s));
    case 'learn':return finish(game.learn(s,value));
    case 'buy':return finish(game.buyPotion(s,value));
    case 'allocate':return finish(game.allocate(s,value));
    case 'equip':return finish(game.equip(s,value));
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
  if(d.open)return modal(d.open);
  if(d.money)return modal('money',d.money);
  if(d.item)return modal('item',d.item);
  if(d.rule!==undefined)return modal('rule',d.rule);
  if(['bag-tab','gear-tab'].includes(b.id)){tab=b.id.split('-')[0];return renderBag();}
  if(d.cmd==='export')return download();
  if(!writable)return toast('다른 탭의 게임을 닫은 뒤 새로고침하세요.');
  if(damaged&&!['import','confirm-import','help'].includes(d.cmd))return toast('먼저 정상 저장 파일을 불러오세요.');
  if(d.cmd)return command(d.cmd,d.value);
  if(d.target){s.combat.target=d.target;return finish();}
  if(d.reserve){s.combat.reserved=s.combat.reserved===d.reserve?null:d.reserve;return finish();}
  if(d.potion!==undefined)return finish(game.usePotion(s,Number(d.potion)));
  switch(b.id){
    case 'start':case 'quick-start':case 'boss':return finish(game.enter(s,selectedDepth,b.id==='boss'));
    case 'pause':
      if(s.combat.paused&&s.overflow.length)return toast('가방 장비를 판매하거나 마을로 귀환하세요.');
      s.combat.paused=!s.combat.paused;return finish();
    case 'retreat':game.retreat(s);return finish();
  }
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='depth'){selectedDepth=Number(el.value);return render();}
  if(['filter','sort'].includes(el.id))return renderBag();
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
function suspend(){
  if(writable&&s.combat.active){s.combat.paused=true;persist();renderLive();}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
window.addEventListener('pagehide',()=>{suspend();lockRelease?.();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(!writable&&e.key===KEY){retrieve();lastEnemies='!';lastLog=-1;render();}});
function init(writer){
  writable=writer;retrieve();render();
  if(!writer)notice('다른 탭에서 진행 중입니다. 이 탭에서 플레이하려면 다른 탭을 닫고 새로고침하세요.');
}
if(navigator.locks){
  navigator.locks.request(KEY,{ifAvailable:true},async lock=>{
    init(!!lock);if(lock)await new Promise(resolve=>{lockRelease=resolve;});
  }).catch(()=>{persistent=false;init(true);notice('파일 저장 모드 | 설정에서 진행 파일을 받으세요.');});
}else{persistent=false;init(true);notice('파일 저장 모드 | 설정에서 진행 파일을 받으세요.');}
let previous=performance.now(),accumulated=0,lastSave=0,lastPaint=0;
setInterval(()=>{
  const now=performance.now(),delta=(now-previous)/1000;previous=now;
  if(!writable||!s.combat.active||s.combat.paused||document.hidden){accumulated=0;return;}
  if(delta>1){suspend();accumulated=0;return;}
  accumulated+=delta;
  const events=[];
  while(accumulated>=RULES.step){events.push(...game.tick(s));accumulated-=RULES.step;}
  const reward=events.some(e=>e.type!=='hit');
  if(reward){render();}else if(now-lastPaint>=95){renderLive();lastPaint=now;}
  drawHits(events);
  if(reward||now-lastSave>4000){persist();lastSave=now;}
},50);
