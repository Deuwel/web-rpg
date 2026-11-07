export const RULES = {maxLevel:20, capacity:60, bossWins:10, step:0.05, dropRate:0.28, stoneRate:0.06, chaosRate:0.002, bossChaosRate:0.15};
export const STATS = {
  str:['힘','물리 공격 +1 | 방어 +0.1'], dex:['민첩','속도 +0.3 | 치명타 +0.03%p'],
  int:['지능','마법 공격 +1 | MP +2'], vit:['체력','HP +8 | 방어 +0.25 | 저항 +0.15'],
  spr:['정신','MP +4 | 저항 +0.25 | 초당 MP 회복 +0.05']
};
export const LABELS = {hp:'최대 HP',mp:'최대 MP',attack:'물리 공격',magic:'마법 공격',defense:'물리 방어',resist:'마법 저항',speed:'속도',crit:'치명타 확률(%)',regen:'MP 회복/초',gauge:'게이지 최대량'};
export const GRADES = ['일반','고급','희귀'];
export const SLOT_NAMES={weapon:'무기',armor:'갑옷',necklace:'목걸이'};
export const ITEMS = {
  sword:{name:'척후자의 검',slot:'weapon',type:'한손검',stats:{attack:9}},
  axe:{name:'개척자의 장검',slot:'weapon',type:'한손검',stats:{attack:12,speed:-3}},
  heavy:{name:'수호자의 흉갑',slot:'armor',type:'중갑',stats:{hp:55,defense:8,speed:-6}},
  light:{name:'길잡이 가죽옷',slot:'armor',type:'경갑',stats:{hp:30,defense:5,attack:3}},
  cloth:{name:'별빛 로브',slot:'armor',type:'천',stats:{hp:15,defense:2,mp:25,magic:6}},
  charm:{name:'순환의 목걸이',slot:'necklace',type:'목걸이',stats:{mp:10,gauge:-8}}
};
export const SKILLS = {
  cleave:{name:'가르기',level:5,cost:2,mp:6,cd:1,power:1.9,desc:'단일 대상에게 물리 공격력의 190% 피해'},
  shout:{name:'전투의 함성',level:10,cost:2,mp:10,cd:5,duration:10,desc:'10초 동안 물리 공격력 30% 증가'},
  sweep:{name:'휩쓸기',level:20,cost:2,mp:14,cd:3,power:1.35,desc:'모든 적에게 물리 공격력의 135% 피해'},
  endurance:{name:'단련된 육체',level:10,cost:3,passive:true,desc:'최대 HP와 물리 방어력 15% 증가'}
};
export const CONDITIONS={always:'조건 없음',hp:'HP N% 이하',mp:'MP N% 이하',unbuffed:'버프 미적용',enemiesGte:'적 N명 이상',enemiesLte:'적 N명 이하'};
export const POTIONS={hp:{name:'회복 포션',fraction:.45,cd:12,price:12},mp:{name:'마나 포션',fraction:.5,cd:18,price:10}};
export const ENEMIES=[
  {name:'이끼 슬라임',shape:'slime',hp:24,attack:4,speed:65,defense:1},
  {name:'가시 벌레',shape:'spike',hp:19,attack:5,speed:85,defense:0},
  {name:'유적 파수체',shape:'sentinel',hp:30,attack:4,speed:55,defense:4}
];
export const DEPTHS=['I. 외곽','II. 오솔길','III. 흔적','IV. 경계'];
