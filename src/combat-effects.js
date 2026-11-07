// Sample positions before rendering a victory or defeat, while both actors still exist.
export function showHits(events, arena, player, effects, simplified) {
  const hits=events.filter(e=>e.type==='hit');
  if(!hits.length || !arena.clientWidth)return;
  const box=arena.getBoundingClientRect();
  const reduced=simplified || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moved=new Set();
  function actor(id){return id==='player'?player:arena.querySelector('[data-target="'+id+'"]');}
  function animate(el,keyframes,duration){
    if(!el||reduced)return;
    el.animate(keyframes,{duration,easing:'ease-out'});
  }
  for(const hit of hits){
    const target=actor(hit.id),source=actor(hit.source);
    if(!target)continue;
    const sprite=target.querySelector('.art'),r=sprite.getBoundingClientRect();
    const incoming=hit.id==='player',direction=incoming?-1:1;
    if(source&&!moved.has(source)){
      animate(source.querySelector('.art'),[{translate:'0'},{translate:(direction*19)+'px -3px',offset:.38},{translate:'0'}],310);
      moved.add(source);
    }
    animate(sprite.querySelector('i'),[{translate:'0',filter:'brightness(2.1)'},{translate:direction*8+'px 0'},{translate:-direction*5+'px 2px'},{translate:'0'}],340);
    const lane=Number(target.dataset.hitLane||0);
    target.dataset.hitLane=String((lane+1)%3);
    const x=Math.max(45,Math.min(box.width-45,r.left-box.left+r.width/2+(lane-1)*26));
    const y=Math.max(50,Math.min(box.height-38,r.top-box.top+r.height/2-12+(lane%2)*24));
    const label=document.createElement('div');
    label.className='hit '+(incoming?'incoming':'outgoing')+(hit.critical?' critical':'')+(reduced?' still':'');
    label.style.left=x+'px';label.style.top=y+'px';
    const kind=document.createElement('small'),value=document.createElement('b');
    kind.textContent=hit.critical?(incoming?'강타 피격':'치명타'):incoming?'피격':hit.skill||'적중';
    value.textContent=(incoming?'−':'')+hit.amount;
    label.append(kind,value);effects.append(label);
    if(!reduced){
      const burst=document.createElement('i');burst.className='burst '+(incoming?'incoming':'outgoing');
      burst.style.left=(r.left-box.left+r.width/2)+'px';burst.style.top=(r.top-box.top+r.height/2)+'px';effects.append(burst);
      setTimeout(()=>burst.remove(),460);
    }
    setTimeout(()=>label.remove(),hit.critical?2350:1950);
  }
}
