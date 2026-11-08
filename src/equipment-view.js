import { GRADES, ITEMS, LABELS, SLOT_NAMES, STATS } from './data.js';
import { itemName, itemStats, price, potentialCost, summary, targetSlot } from './game.js';

const number = value => Number(value.toFixed(2)).toLocaleString('ko-KR');
const signed = n => (n > 0 ? '+' : '') + number(n);
const specialty = {
  sword: ['물리 공격', '단일 공격의 기본 화력을 높입니다.'],
  axe: ['중량 무기', '물리 공격력이 높고 행동 속도가 감소합니다.'],
  heavy: ['중갑', '최대 HP와 방어력이 높고 행동 속도가 감소합니다.'],
  light: ['경갑', 'HP와 방어력에 물리 공격력을 더합니다.'],
  cloth: ['마법 장비', '최대 MP와 마법 공격력을 함께 높입니다.'],
  helm: ['수호','착용하면 체력과 물리 방어력이 상승합니다.'],
  pants: ['방호','최대 HP와 물리 방어력을 높입니다.'],
  boots: ['기동','속도와 민첩을 높입니다.'],
  shield: ['방패','힘과 물리 방어력을 높이는 보조 장비입니다.'],
  ring: ['별빛','지능과 정신을 높입니다. 두 반지 슬롯에 장착할 수 있습니다.'],
  charm: ['게이지 압축', '속도 게이지 최대량이 줄어 다음 행동이 빨라집니다.']
};
export function art(template) {
  return '<span aria-hidden="true" class="item-art '+template+'"><i></i><em></em></span>';
}
export function itemTile(item, equipped) {
  const info=ITEMS[item.template];
  return '<button class="tile grade'+item.rarity+'" data-item="'+item.id+'" aria-label="'+itemName(item)+' 상세">'
    +'<span class="tile-meta">Lv.'+item.level+'<span>'+(item.protected?'잠금':equipped?'장착':'')+'</span></span>'
    +art(item.template)+'<b>'+info.name+' +'+item.enhancement+'</b><small>'+GRADES[item.rarity]+' | '+info.type+'</small></button>';
}
export function itemCard(state,item,action,preferred) {
  const info=ITEMS[item.template], slot=targetSlot(state,item,preferred), worn=state.equipment[slot], equipped=worn?.id===item.id;
  const before=summary(state),after=summary(state,{...state.equipment,[slot]:equipped?null:item});
  const base=itemStats(item);
  const stats=Object.entries(base).map(([k,n])=>'<div><span>'+(LABELS[k]||STATS[k][0])+'</span><b>'+signed(n)+'</b></div>').join('');
  const deltas=[];
  function compare(label,a,b,smallerBetter=false,unit='') {
    const diff=Number((b-a).toFixed(2));
    if(!diff)return;
    const good=smallerBetter?diff<0:diff>0;
    deltas.push('<tr><th>'+label+'</th><td>'+number(a)+unit+'</td><td>'+number(b)+unit+'</td><td class="'+(good?'up':'down')+'">'+signed(diff)+unit+'</td></tr>');
  }
  for(const k of Object.keys(STATS))compare(STATS[k][0],before.primary[k].total,after.primary[k].total);
  for(const k of Object.keys(LABELS))compare(LABELS[k],before.total[k],after.total[k],k==='gauge');
  compare('행동 간격',before.interval,after.interval,true,'초');
  const bagged=state.inventory.some(i=>i.id===item.id);
  const waiting=state.overflow.some(i=>i.id===item.id);
  const ringChoice=info.slot==='ring1'&&bagged?'<label>비교할 반지 슬롯<select id="ring-choice">'+['ring1','ring2'].map(k=>'<option value="'+k+'"'+(k===slot?' selected':'')+'>'+SLOT_NAMES[k]+'</option>').join('')+'</select></label>':'';
  const [tag,note]=specialty[item.template];
  return '<article class="item-card grade'+item.rarity+'"><div class="card-lead"><div class="artframe">'+art(item.template)+'</div><div><small>'+GRADES[item.rarity]+' | '+SLOT_NAMES[slot]+'</small><h3>'+info.name+' <em>+'+item.enhancement+'</em></h3><span>'+info.type+'　Lv.'+item.level+'</span></div></div>'
    +'<div class="card-meta"><span>품질 <b>'+item.quality+'%</b></span><progress aria-label="품질" max="100" value="'+item.quality+'"></progress><span>'+(equipped?'장착 중':waiting?'임시 획득함':!bagged?'판매 완료':state.level<item.level?'착용 레벨 부족':'가방 보관')+'</span></div>'
    +'<h4>장비 능력치</h4><div class="base-lines">'+stats+'</div><div class="special"><b>'+tag+'</b><span>'+note+'</span></div>'
    +'<h4>잠재능력</h4>'+(item.potential||[]).map((p,i)=>'<div class="potential-line">'+STATS[p.key][0]+' +'+p.value+((equipped||bagged)?action('line-lock',i,p.locked?'잠금 해제':'줄 잠금'):'')+'</div>').join('')
    +((equipped||bagged)?action('reroll','',(item.potential?'재설정':'잠재 개방')+' | 골드 '+potentialCost(item).gold+' | 혼돈 파편 '+potentialCost(item).chaos):'')
    +ringChoice+'<h4>'+(equipped?'해제':'착용')+' 시 변화</h4><small>현재 장비 | '+(worn?itemName(worn):'빈 슬롯')+'</small>'
    +(deltas.length?'<table class="comparison"><thead><tr><th>능력치</th><th>현재</th><th>예상</th><th>차이</th></tr></thead><tbody>'+deltas.join('')+'</tbody></table>':'<p>교체해도 최종 능력치는 같습니다.</p>')
    +((equipped||bagged)?'<div class="actions">'+(equipped?action('unequip',slot,'해제',state.inventory.length>=60):action('equip',item.id,'장착',state.level<item.level))
    +action('lock',item.id,item.protected?'잠금 해제':'잠금')+(equipped?'':action('sell',item.id,'판매 | '+price(item)+' 골드',item.protected))+'</div>':'')+'</article>';
}
