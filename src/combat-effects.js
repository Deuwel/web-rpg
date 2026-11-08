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
    const x=Math.max(45,Math.min(box.width-45,r.left-box.left+r.width/2+(incoming?-1:1)*(r.width/2+6)+(lane-1)*10));
    const y=Math.max(50,Math.min(box.height-38,r.top-box.top+13+(lane%2)*15));
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
    setTimeout(()=>label.remove(),hit.critical?1300:1050);
  }
}

// Capture the defeated sprite before the wave renderer removes it.
export function dropOrigins(events,arena){
  const drops=[];
  for(const event of events){
    if(event.type!=='drop')continue;
    const actor=arena.querySelector('[data-target="'+event.id+'"] .art');
    if(actor)drops.push({item:event.item,from:actor.getBoundingClientRect()});
  }
  return drops;
}
export function flyDrops(drops,recent,icon,reduced){
  if(reduced||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const {item,from} of drops){
    const target=recent.querySelector('[data-item="'+item.id+'"]');
    if(!target)continue;
    const to=target.getBoundingClientRect();
    const x=from.left+from.width/2-19,y=from.top+from.height/2-19;
    const dx=to.left+to.width/2-19-x,dy=to.top+to.height/2-19-y;
    const token=document.createElement('div');
    token.className='drop-token grade'+item.rarity;
    token.setAttribute('aria-hidden','true');
    token.innerHTML=icon(item.template);
    token.style.left=x+'px';token.style.top=y+'px';document.body.append(token);
    const anim=token.animate([
      {transform:'translate(0,0) scale(.5)',opacity:0},
      {transform:'translate(0,-22px) scale(1.18)',opacity:1,offset:.25},
      {transform:'translate(0,4px) scale(1)',opacity:1,offset:.49},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.65)',opacity:.7}
    ],{duration:920,easing:'ease-in-out'});
    anim.onfinish=()=>{token.remove();if(target.isConnected)target.animate([{filter:'brightness(1.6)'},{filter:'brightness(1)'}],240);};
    anim.oncancel=()=>token.remove();
  }
}
