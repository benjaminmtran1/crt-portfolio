import {paintCupra} from './cupra-build.mjs?v=cupra1';
/**
 * Hand-drawn pixel interpretations of Ben's own portfolio photographs.
 * This is scenic art, not a franchise logo or a generic game-world backdrop.
 * Deathstalker: assets/img_0809.jpg + img_0814.jpg + img_0773.jpg.
 * Nintendo x Donkey Kong: assets/img_3311.jpg + img_3337.jpg.
 * Beast Games: assets/img_7886.jpg (built) + img_0236.jpg (construction CAD).
 * Cupra: curved stair + dark wooden hall; see cupra-build.mjs references.
 * A single 360 × 180 plate is drawn at a time. No photo data is loaded at runtime.
 */
export const titleBuilds = Object.freeze([
  Object.freeze({ id: 'deathstalker', title: 'DEATHSTALKER', detail: 'THE GRAVEYARD', description: 'A mossy stone graveyard set with a peaked gatehouse, rusty iron gate, crooked bare trees and headstones.', accent: '#D6B88C' }),
  Object.freeze({ id: 'donkey-kong', title: 'NINTENDO × DONKEY KONG', detail: 'SUBWAY ENTRANCE', description: 'The green, rounded SUBWAY entrance build, with cream panels, hanging vines, globe lamps and dark green railings.', accent: '#A6CB9A' }),
  Object.freeze({ id: 'beast-games', title: 'BEAST GAMES', detail: 'THE CASH BUILD', description: 'A black-and-silver square build grounded on the stage, with a giant stepped pile of green cash bundles in its centre.', accent: '#9DC9D8' }),
  Object.freeze({ id: 'cupra', title: 'CUPRA', detail: 'THE STAIR & WOODEN HALL', description: 'The Cupra build: a sweeping concrete staircase beside warm display niches and a dark, wood-panelled hallway with an arched opening.', accent: '#D5BE92' })
]);
export const BUILD_HOLD_MS = 8500;
export const BUILD_FADE_MS = 650;
export const BUILD_DARK_MS = 240;
export const BUILD_CYCLE_MS = BUILD_HOLD_MS + BUILD_FADE_MS * 2 + BUILD_DARK_MS;
const clamp = n => Math.min(1, Math.max(0, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Absolute timeline: a full opaque darkness interval separates every set. */
export function showcaseAt(time = 0, selected = null) {
  if (selected !== null) return { index: ((Math.trunc(selected) % titleBuilds.length) + titleBuilds.length) % titleBuilds.length, light: 1, phase: 'hold' };
  const safe = Math.max(0, Number(time) || 0), cycle = Math.floor(safe / BUILD_CYCLE_MS);
  const t = safe % BUILD_CYCLE_MS;
  let index = cycle % titleBuilds.length, light = 1, phase = 'hold';
  if (t >= BUILD_HOLD_MS && t < BUILD_HOLD_MS + BUILD_FADE_MS) {
    light = 1 - smooth((t - BUILD_HOLD_MS) / BUILD_FADE_MS); phase = 'out';
  } else if (t >= BUILD_HOLD_MS + BUILD_FADE_MS) {
    index = (index + 1) % titleBuilds.length;
    const relight = t - BUILD_HOLD_MS - BUILD_FADE_MS - BUILD_DARK_MS;
    light = smooth(relight / BUILD_FADE_MS); phase = relight < 0 ? 'dark' : 'in';
  }
  return { index, light, phase };
}
const R = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const P = (c, points, color) => { c.fillStyle = color; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y))); c.closePath(); c.fill(); };
const L = (c, x, y, xx, yy, color, weight = 1) => {
  x=Math.round(x); y=Math.round(y); xx=Math.round(xx); yy=Math.round(yy);
  const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let e=dx+dy;
  for(;;){R(c,x,y,weight,weight,color);if(x===xx&&y===yy)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}
};
const E = (c,x,y,rx,ry,color) => { for(let i=-ry;i<=ry;i++){const half=Math.round(rx*Math.sqrt(1-i*i/(ry*ry)));R(c,x-half,y+i,half*2+1,1,color);} };
const random = seed => () => { seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296; };
const ink='#091E27';
const glyphs = {
  '$':['111','110','111','011','111'], '1':['010','110','010','010','111'], '0':['111','101','101','101','111'], ',':['000','000','000','010','100'],
  S:['111','100','111','001','111'], U:['101','101','101','101','111'], B:['110','101','110','101','110'],
  W:['101','101','101','111','101'], A:['010','101','111','101','101'], Y:['101','101','010','010','010'],
  R:['110','101','110','101','101'], I:['111','010','010','010','111'], P:['110','101','110','100','100']
};
function label(c,text,x,y,scale,color){for(const ch of text){for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyphs[ch]?.[row]?.[col]==='1')R(c,x+col*scale,y+row*scale,scale,scale,color);x+=4*scale;}}
function stoneWall(c,x,y,w,h,seed=7){
  R(c,x,y,w,h,'#48504A');const r=random(seed);
  for(let row=0;row<Math.ceil(h/9);row++)for(let col=0;col<Math.ceil(w/16)+1;col++){
    const xx=x+col*16-(row%2)*8, yy=y+row*9;
    const left=Math.max(x,xx),right=Math.min(x+w,xx+14);
    if(right<=left)continue;
    const ww=right-left,hh=Math.min(7,y+h-yy);if(hh<=0)continue;
    R(c,left,yy,ww,hh,['#777E6E','#6A756A','#7C8170','#606B63'][Math.floor(r()*4)]);
    L(c,left,yy,right-1,yy,'#969B83');R(c,left,yy+hh-1,ww,1,'#394B49');
    if(r()>.6)R(c,left+2,yy+2,Math.max(1,ww-6),1,'#87907B');
  }
}
function bareTree(c,x,y,s,flip=1){
  const tr=(a,b)=>[x+a*s*flip,y+b*s];
  for(const [a,b,d,e,k] of [[0,0,-3,-35,5],[-3,-35,4,-64,4],[4,-64,1,-104,3],[1,-104,-8,-123,1],[-2,-34,-25,-61,3],[-25,-61,-32,-89,2],[-32,-89,-47,-100,1],[-25,-61,-42,-68,2],[-42,-68,-51,-83,1],[3,-62,27,-80,3],[27,-80,35,-108,2],[27,-80,45,-89,1],[3,-83,-14,-91,2],[-14,-91,-21,-113,1],[4,-101,16,-117,1],[16,-117,13,-131,1]]){
    const p=tr(a,b),q=tr(d,e);L(c,...p,...q,'#3E3E3A',Math.max(1,Math.round(k*s)));L(c,p[0],p[1],q[0],q[1],'#929181',Math.max(1,Math.round(k*s*.35)));
  }
  P(c,[tr(-9,2),tr(-3,-13),tr(3,-13),tr(11,1)],'#53574A');
}
function evergreen(c,x,y,s){
  for(let i=0;i<5;i++)P(c,[[x,y-52*s+i*9*s],[x-8*s-i*3*s,y-32*s+i*10*s],[x+8*s+i*3*s,y-32*s+i*10*s]],i%2?'#3F5B42':'#304C3B');
  for(let i=0;i<4;i++)L(c,x-i*2*s,y-44*s+i*12*s,x+7*s,y-34*s+i*12*s,'#71836A');
}
function grave(c,x,y,s=1){
  P(c,[[x-12*s,y],[x-12*s,y-28*s],[x-8*s,y-36*s],[x,y-40*s],[x+8*s,y-36*s],[x+12*s,y-28*s],[x+12*s,y]],'#A4AA8E');
  P(c,[[x-9*s,y-2*s],[x-9*s,y-27*s],[x-5*s,y-33*s],[x+2*s,y-36*s],[x+9*s,y-29*s],[x+9*s,y-2*s]],'#727C6B');
  L(c,x-5*s,y-27*s,x+4*s,y-27*s,'#CBD0AD');L(c,x,y-33*s,x,y-18*s,'#414F48',Math.max(1,2*s));L(c,x-6*s,y-27*s,x+6*s,y-27*s,'#414F48',Math.max(1,2*s));
  L(c,x-5*s,y-10*s,x+5*s,y-10*s,'#4A584F');
}
function deathstalker(c){
  P(c,[[31,152],[73,137],[260,137],[326,156],[308,168],[57,171]],'#39473C');
  // Left broken wall and right gatehouse share the slightly blue stonework.
  P(c,[[39,145],[39,69],[46,69],[46,49],[60,42],[78,51],[82,74],[91,79],[91,145]],'#3C514E');
  stoneWall(c,44,65,42,82);P(c,[[42,64],[53,45],[67,43],[82,61],[84,68]],'#839588');
  P(c,[[80,146],[80,109],[91,102],[97,108],[104,95],[113,103],[122,96],[134,108],[134,147]],'#566D5A');
  stoneWall(c,86,114,48,33,12);R(c,90,110,8,4,'#8D9A76');R(c,117,106,12,5,'#879575');
  // Peaked gable, stepped roof coping and deeply recessed arched opening.
  P(c,[[164,149],[164,66],[159,64],[169,57],[190,45],[211,29],[231,41],[250,53],[262,61],[257,68],[257,149]],'#374B48');
  stoneWall(c,169,64,84,85,19);
  P(c,[[166,62],[190,47],[211,32],[251,60],[249,70],[173,70]],'#7B806D');
  L(c,164,62,211,30,'#B6B69A',2);L(c,211,30,259,62,'#9FA88C',2);L(c,165,66,211,35,'#52665C',2);
  for(const [x,y,w] of [[179,60,18],[195,49,17],[215,48,12],[211,61,22],[232,62,16]]){R(c,x,y,w,2,'#4C5A50');R(c,x+2,y+2,w-4,1,'#A5AA8C');}
  P(c,[[185,148],[185,84],[189,76],[197,70],[210,66],[224,71],[233,79],[236,87],[236,148]],'#293B38');
  P(c,[[193,148],[193,85],[198,77],[210,73],[222,78],[228,86],[228,148]],'#102728');
  L(c,185,88,185,147,'#B1B398',3);L(c,234,88,234,148,'#929A80',3);
  for(const [a,b,d,e] of [[186,82,192,73],[194,71,202,67],[205,66,215,66],[219,68,229,74],[231,76,236,84]])L(c,a,b,d,e,'#B4B392',3);
  // The photographed rust-coloured curved gate, not a fantasy castle door.
  P(c,[[195,145],[195,94],[200,91],[210,88],[221,91],[226,95],[226,145]],'#412F28');
  for(let x=197;x<227;x+=5)L(c,x,94-Math.max(0,4-Math.abs(211-x)*.23),x,145,'#B67B4E',1);
  L(c,195,96,195,145,'#BD8B57',2);L(c,226,96,226,145,'#9C643E',2);
  L(c,197,95,210,90,'#D3A16B',2);L(c,210,90,225,95,'#B6804E',2);L(c,195,124,226,124,'#AD794B',2);L(c,195,145,226,145,'#A67547',2);
  R(c,211,115,2,4,'#D1AC75');
  evergreen(c,157,151,.85);evergreen(c,268,151,.64);evergreen(c,94,145,.45);
  bareTree(c,121,153,.92);bareTree(c,298,153,.86,-1);bareTree(c,49,151,.68);
  grave(c,83,163,.85);grave(c,274,161,.65);grave(c,145,159,.51);
  // Moss and leaf litter are stable, seeded texture rather than motion/noise.
  const r=random(92);for(let i=0;i<180;i++){
    const x=33+r()*291,y=145+r()*22;R(c,x,y,1+r()*3,1,['#A88351','#6E7C4A','#4F5E43','#9D9B6C','#2C4037'][i%5]);
  }
  for(const [x,y] of [[47,91],[74,65],[84,125],[170,80],[171,132],[242,70],[245,142],[122,124]]){
    R(c,x,y,5,3,'#69845A');R(c,x+3,y+2,4,4,'#526C47');R(c,x+1,y-1,2,2,'#A0A46C');
  }
}
function foliage(c,x,y,span,seed){const r=random(seed);for(let i=0;i<span*2;i++){const xx=x+r()*span,yy=y+r()*10;R(c,xx,yy,2+r()*4,2+r()*3,['#183F32','#325C39','#5B7B47','#6F9256'][i%4]);}}
function vine(c,x,y,length,flip=1){let px=x,py=y;for(let i=0;i<length;i+=3){const xx=x+Math.sin(i*.18)*4*flip,yy=y+i;L(c,px,py,xx,yy,'#547C47');R(c,xx+(i%2?1:-3),yy,3,2,i%2?'#87A766':'#426B3E');px=xx;py=yy;}}
function donkeyKong(c){
  P(c,[[37,148],[79,129],[278,129],[326,150],[291,168],[62,168]],'#576E6A');
  P(c,[[37,148],[62,159],[291,159],[326,150],[326,158],[291,174],[62,174],[37,157]],'#687B74');
  L(c,62,159,291,159,'#A5B09A');L(c,63,166,292,166,'#829589');
  // Curved front canopy: segmented translucent roof over cream wall panels.
  P(c,[[71,143],[71,62],[77,48],[89,38],[103,33],[243,33],[261,39],[273,49],[279,63],[279,143]],'#193D33');
  P(c,[[76,141],[76,63],[82,49],[94,40],[105,37],[243,37],[258,41],[269,51],[274,63],[274,141]],'#B2BC9D');
  P(c,[[77,67],[81,53],[90,44],[104,38],[242,38],[257,43],[266,52],[273,66]],'#789488');
  P(c,[[85,61],[91,49],[106,42],[243,42],[256,47],[264,57],[266,63]],'#92ACA0');
  R(c,106,42,135,3,'#ADC0AB');
  for(const x of [103,140,181,223,248]){R(c,x,38,3,103,'#3C7555');L(c,x,41,x+2,62,'#73A676',1);}
  R(c,75,66,202,19,'#386B4B');R(c,75,66,202,2,'#719169');R(c,76,83,201,2,'#153E31');
  label(c,'SUBWAY',129,70,2,'#173B33');label(c,'SUBWAY',128,69,2,'#C3CCB4');
  for(const [x,w] of [[80,22],[107,32],[144,36],[185,36],[227,19],[252,19]]){
    R(c,x,87,w,53,'#BCC3A7');R(c,x+1,88,w-2,2,'#D2D4B6');R(c,x+w-2,90,2,50,'#91A58E');
  }
  foliage(c,91,28,167,42);foliage(c,112,25,102,39);
  for(const [x,y,len,flip] of [[94,41,58,1],[139,83,44,-1],[219,38,62,1],[258,74,65,-1]])vine(c,x,y,len,flip);
  // Dark railings wrap the front and keep the subway-plaza silhouette.
  for(let x=61;x<=300;x+=9){R(c,x,129,2,30,'#224F3D');R(c,x,128,1,28,'#578566');}
  R(c,59,123,246,4,'#255E46');R(c,60,123,245,1,'#89AC80');R(c,59,156,246,5,'#25513C');R(c,60,156,244,1,'#608665');
  for(const x of [59,117,239,300]){R(c,x-2,122,5,39,'#214C39');R(c,x-3,120,7,5,'#527C59');R(c,x-1,123,1,33,'#86A67A');}
  for(const x of [58,301]){
    R(c,x-2,30,5,96,'#204F3E');R(c,x-1,32,1,91,'#85A57A');R(c,x-5,30,11,3,'#416C51');
    E(c,x,23,9,9,'#CED6B9');E(c,x-2,20,6,6,'#ECEDD1');R(c,x-5,31,10,2,'#6E8B67');
  }
  foliage(c,82,145,25,13);foliage(c,255,142,35,23);
  // Low gray step plinths in the actual plaza, not unrelated game props.
  P(c,[[19,158],[39,149],[59,155],[39,166]],'#AEB7A4');P(c,[[19,158],[39,166],[39,174],[19,166]],'#6E8078');P(c,[[39,166],[59,155],[59,164],[39,174]],'#8D9D8B');
  P(c,[[303,160],[320,151],[339,159],[321,169]],'#C0C6AE');P(c,[[303,160],[321,169],[321,176],[303,167]],'#6A8077');P(c,[[321,169],[339,159],[339,166],[321,176]],'#91A391');
}
// The supplied cash-display reference uses a stepped, tightly packed mound.
// This stays inside the existing construction-reference box, not a new set.
function cashPile(c){
  const project=(x,y,z)=>[177+x*2.9-y*2.45,80+x*.8+y*.9-z];
  const faces=['#647847','#70854D','#788F55','#81995B','#93A66B'];
  for(let tier=0;tier<5;tier++){
    const half=14-tier*2.5,z=tier*15,height=13;
    const A=project(-half,-half,z+height),B=project(half,-half,z+height),C=project(half,half,z+height),D=project(-half,half,z+height);
    const b=project(half,-half,z),cc=project(half,half,z),d=project(-half,half,z);
    P(c,[B,C,cc,b],'#4A6038');P(c,[D,C,cc,d],faces[tier]);
    // Closely spaced bill edges and staggered bundle divisions on the faces.
    for(let dz=2;dz<height;dz+=3){L(c,...project(half,-half,z+dz),...project(half,half,z+dz),'#80905C');L(c,...project(-half,half,z+dz),...project(half,half,z+dz),'#A0AE75');}
    for(let n=-half+4;n<half;n+=5){L(c,...project(n,half,z+1),...project(n,half,z+height-1),'#3F5532');L(c,...project(half,n,z+1),...project(half,n,z+height-1),'#344D31');}
    P(c,[A,B,C,D],'#B9C491');
    // The visible top is made of individual notes/bundles, with pale bands.
    for(let xx=-half+.8;xx<half-1;xx+=5)for(let yy=-half+.6;yy<half-1;yy+=4){
      const ex=Math.min(half-.5,xx+4.4),ey=Math.min(half-.5,yy+3.3);
      P(c,[project(xx,yy,z+height),project(ex,yy,z+height),project(ex,ey,z+height),project(xx,ey,z+height)],'#849D5C');
      P(c,[project(xx+1.7,yy,z+height),project(xx+2.7,yy,z+height),project(xx+2.7,ey,z+height),project(xx+1.7,ey,z+height)],'#D5D2AB');
      const mark=project((xx+ex)/2,(yy+ey)/2,z+height);R(c,mark[0]-1,mark[1],2,1,'#506B3E');
    }
    L(c,...D,...C,'#DBD9AF');L(c,...A,...D,'#CBCEA2');
  }
}
function beastGames(c){
  // A three-quarter view follows the construction reference. The pale lines
  // are metal trim; the actual inset panel faces remain dark, never white.
  const A=[44,76],B=[169,27],C=[314,67],D=[191,120],a=[44,126],b=[169,77],cc=[314,117],d=[191,174];
  P(c,[A,D,d,a],'#121F26');P(c,[D,C,cc,d],'#0A1921');
  P(c,[[47,80],[187,123],[187,169],[47,123]],'#1A2D34');P(c,[[195,123],[309,75],[309,113],[195,166]],'#10262F');
  P(c,[[57,88],[179,125],[179,157],[57,120]],'#8DABA7');
  P(c,[[61,92],[175,127],[175,152],[61,117]],'#344C53');
  P(c,[[64,94],[172,128],[172,148],[64,115]],'#2B4149');
  L(c,58,88,178,125,'#C2D0BD',2);L(c,58,88,58,120,'#B7CBB9',2);L(c,60,119,177,155,'#718E90');
  for(const x of [90,121,151]){const y=94+(x-64)*.31;L(c,x,y,x,y+20,'#3B545B');L(c,x+2,y+1,x+2,y+19,'#203A43');}
  P(c,[[206,124],[299,85],[299,109],[206,151]],'#89A6A4');
  P(c,[[210,125],[295,89],[295,107],[210,146]],'#274550');
  L(c,207,124,299,85,'#C2D0BF',2);L(c,207,124,207,151,'#B0C4B2',2);L(c,211,144,294,107,'#456672');
  for(const x of [235,262,282]){const y=125-(x-210)*.42;L(c,x,y,x,y+17,'#45646C');}
  // Wide outer perimeter, timber edge, and the unmistakable open square well.
  P(c,[A,B,C,D],'#8DA3A0');
  P(c,[[54,76],[169,33],[302,68],[191,114]],'#C2BD9F');
  P(c,[[61,76],[170,37],[293,68],[190,109]],'#18303B');
  P(c,[[75,78],[170,44],[279,72],[190,107]],'#7E9393');
  P(c,[[82,77],[170,47],[270,72],[190,102]],'#B6B899');
  P(c,[[91,77],[170,51],[261,73],[190,96]],'#0B1D27');
  P(c,[[91,77],[170,51],[170,76],[190,96]],'#172B33');
  P(c,[[170,51],[261,73],[190,96],[170,76]],'#0B1D25');
  L(c,44,76,169,27,'#B8CAC0',3);L(c,169,27,314,67,'#A8BCB3',3);L(c,44,76,191,120,'#D4D8BF',3);L(c,191,120,314,67,'#ADC3BA',3);
  L(c,44,126,191,174,'#63858B',4);L(c,191,174,314,117,'#6C9095',4);L(c,45,125,190,171,'#A8BDB0');
  for(const [x,y] of [[49,80],[185,122],[197,123],[309,75],[49,121],[185,164],[199,160],[307,111]])R(c,x,y,2,2,'#BAC8B8');
  // The value plaque follows the left panel's perspective instead of floating.
  let tx=68;for(const ch of '$1,000,000'){
    for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyphs[ch]?.[row]?.[col]==='1')R(c,tx+col*2,99+(tx-68+col*2)*.31+row*2,2,2,'#D0D5BD');
    tx+=9;
  }
  cashPile(c);
}
export function paintTitleBuild(c,index){
  c.clearRect(0,0,360,180);
  const painters=[deathstalker,donkeyKong,beastGames,paintCupra];
  painters[((Math.trunc(index)%painters.length)+painters.length)%painters.length](c);
}
