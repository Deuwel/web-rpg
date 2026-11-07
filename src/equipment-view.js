import { GRADES, ITEMS, LABELS, SLOT_NAMES } from './data.js';
import { itemName, itemStats, price, summary } from './game.js';

const number = value => Number(value.toFixed(2)).toLocaleString('ko-KR');
const signed = n => (n > 0 ? '+' : '') + number(n);
const specialty = {
  sword: ['물리 공격', '단일 공격의 기본 화력을 높입니다.'],
  axe: ['중량 무기', '물리 공격력이 높고 행동 속도가 감소합니다.'],
  heavy: ['중갑', '최대 HP와 방어력이 높고 행동 속도가 감소합니다.'],
  light: ['경갑', 'HP와 방어력에 물리 공격력을 더합니다.'],
  cloth: ['마법 장비', '최대 MP와 마법 공격력을 함께 높입니다.'],
  charm: ['게이지 압축', '속도 게이지 최대량이 줄어 다음 행동이 빨라집니다.']
};
function art(template) {
  return '<span aria-hidden="true" class="item-art '+template+'"><i></i><em></em></span>';
}
export function itemTile(item, equipped) {
  const info=ITEMS[item.template];
  return '<button class="tile grade'+item.rarity+'" data-item="'+item.id+'" aria-label="'+itemName(item)+' 상세">'
    +'<span class="tile-meta">Lv.'+item.level+'<span>'+(item.protected?'잠금':equipped?'장착':'')+'</span></span>'
    +art(item.template)+'<b>'+info.name+'</b><small>'+GRADES[item.rarity]+' | '+info.type+'</small></button>';
}
export function itemCard(state,item,action) {
  const info=ITEMS[item.template], worn=state.equipment[info.slot], equipped=worn?.id===item.id;
  const before=summary(state),after=summary(state,{...state.equipment,[info.slot]:equipped?null:item});
  const base=itemStats(item);
  const stats=Object.entries(base).map(([k,n])=>'<div><span>'+LABELS[k]+'</span><b>'+signed(n)+'</b></div>').join('');
  const deltas=[];
  function compare(label,a,b,smallerBetter=false,unit='') {
    const diff=Number((b-a).toFixed(2));
    if(!diff)return;
    const good=smallerBetter?diff<0:diff>0;
    deltas.push('<tr><th>'+label+'</th><td>'+number(a)+unit+'</td><td>'+number(b)+unit+'</td><td class="'+(good?'up':'down')+'">'+signed(diff)+unit+'</td></tr>');
  }
  for(const k of Object.keys(LABELS))compare(LABELS[k],before.total[k],after.total[k],k==='gauge');
  compare('행동 간격',before.interval,after.interval,true,'초');
  const [tag,note]=specialty[item.template];
  return '<article class="item-card grade'+item.rarity+'"><div class="card-lead"><div class="artframe">'+art(item.template)+'</div><div><small>'+GRADES[item.rarity]+' | '+SLOT_NAMES[info.slot]+'</small><h3>'+info.name+'</h3><span>'+info.type+'　Lv.'+item.level+'</span></div></div>'
    +'<div class="card-meta"><span>품질 <b>'+item.quality+'%</b></span><span>강화 <b>+'+item.enhancement+'</b></span><span>'+(equipped?'장착 중':state.level<item.level?'착용 레벨 부족':'가방 보관')+'</span></div>'
    +'<h4>장비 능력치</h4><div class="statcells">'+stats+'</div><div class="special"><b>'+tag+'</b><span>'+note+'</span></div>'
    +'<h4>'+(equipped?'해제':'착용')+' 시 변화</h4><small>현재 장비 | '+(worn?itemName(worn):'빈 슬롯')+'</small>'
    +(deltas.length?'<table class="comparison"><thead><tr><th>능력치</th><th>현재</th><th>예상</th><th>차이</th></tr></thead><tbody>'+deltas.join('')+'</tbody></table>':'<p>교체해도 최종 능력치는 같습니다.</p>')
    +'<div class="actions">'+(equipped?action('unequip',info.slot,'해제',state.combat.active):action('equip',item.id,'장착',state.combat.active||state.level<item.level))
    +action('lock',item.id,item.protected?'잠금 해제':'잠금')+(equipped?'':action('sell',item.id,'판매 | '+price(item)+' 골드',item.protected))+'</div></article>';
}
