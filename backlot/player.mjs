// Ben's playable sprite, drawn from the current About portrait (img_2997.jpg).
// The pixel-sized likeness keeps the existing feet anchor and 34px world scale.
// Trousers and boots are retained workwear, not details inferred from the portrait.
export const playerPalette=Object.freeze({
 h:'#202830', H:'#30353a', L:'#434749',
 s:'#c48d6c', S:'#dfa783', n:'#ad725b', r:'#9e745f',
 e:'#292f34', m:'#493a33', l:'#bc7d65', p:'#dfddd0',
 b:'#8aa6b9', B:'#5b798f', w:'#d6ded6', W:'#f0e9d6',
 t:'#35505e', T:'#476270', k:'#1b2e39', K:'#34454b', a:'#bdb7a0'
});

// Asymmetric waves, parted fringe, moustache, light jaw stubble and a single
// silver hoop pixel. Directional profiles keep the portrait hair silhouette.
const front=[
 '.....hh..hhh....',
 '...hhHLhhHHHh...',
 '..hHHLhHHLLHHh..',
 '.hHHLhssshHHHHh.',
 '.hHHhssSSsshHHh.',
 '.hHhssSSSSsshHh.',
 '.hHssmssssmssHh.',
 '.hhSsesSSesSshh.',
 '..hsSSSnsSSsh...',
 '..hsSSSnpSSsh...',
 '..hsSmmsmmSsh...',
 '..hrsSlllSsrh...',
 '...hrsSSSsrhh...',
 '....hrrsrr.hh...',
 '......sss.......'
];
const back=[
 '.....hh..hhh....',
 '...hhHLhhHHHh...',
 '..hHHLhHHLLHHh..',
 '.hHHHLhHHLHHHHh.',
 '.hHHLhHHHHHHHHh.',
 '.hHLhHHHLhHHHHh.',
 '.hHhHHHHLhHHHhh.',
 '.hhHHHHLhHHHHHh.',
 '..hHHHHLHHHHHh..',
 '..hHHHHhHHHHHh..',
 '..hhHHHhHHHHhh..',
 '...hHHHhHHHhh...',
 '...hhHHhHHhh....',
 '.....hsssh......',
 '......sss.......'
];
const right=[
 '.....hhh.hh.....',
 '...hhHHLhHHh....',
 '..hHHHLhLLHHh...',
 '..hHHHHhHHHHhh..',
 '.hHHHLhHhssSsh..',
 '.hHHHLhHssSSSs..',
 '.hHHHHHhssSmss..',
 '.hHHHHhssSSesS..',
 '.hHHHHhsSSSnSSs.',
 '..hHHHhsSSSnpss.',
 '..hHHHhnsSSmmm..',
 '..hhHHhnsSlls...',
 '...hHHhrssSsr...',
 '....hhssrrsr....',
 '......sss.......'
];
const left=right.map(row=>[...row].reverse().join('').replaceAll('p','s'));
const heads=Object.freeze({down:front,up:back,left,right});

function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function stamp(c,rows,x,y){
 for(let yy=0;yy<rows.length;yy++)for(let xx=0;xx<rows[yy].length;xx++){
  const color=playerPalette[rows[yy][xx]];
  if(color)rect(c,x+xx,y+yy,1,1,color);
 }
}
export function playerPose(step=0,moving=false){
 if(!moving)return {frame:0,stride:0,bob:0};
 const frame=((Math.floor(step/(Math.PI/2))%4)+4)%4;
 return {frame,stride:[0,2,0,-2][frame],bob:[-1,0,-1,0][frame]};
}
function legs(c,x,y,stride,side){
 const p=playerPalette;
 if(side){
  // Opposing legs silhouette clearly at each contact; the boots still pivot
  // about the original ground point rather than moving the actor's position.
  const reach=stride,backX=x-3-reach,frontX=x-2+reach;
  rect(c,backX,y-10,4,9,p.t);rect(c,backX-1,y-2,6,3,p.k);
  rect(c,frontX,y-10,4,9,p.T);rect(c,frontX-1,y-2,7,3,p.k);
  rect(c,frontX,y-2,5,1,p.K);
 }else{
  rect(c,x-5,y-10,4,9+stride,p.t);rect(c,x+1,y-10,4,9-stride,p.T);
  rect(c,x-6,y-2+stride,5,3,p.k);rect(c,x+1,y-2-stride,6,3,p.k);
  rect(c,x-5,y-2+stride,3,1,p.K);rect(c,x+2,y-2-stride,4,1,p.K);
 }
}
function frontBody(c,x,y,stride,back){
 const p=playerPalette;
 // Loose rolled sleeves and relaxed hands swing opposite the legs.
 for(const [sx,offset]of [[-8,-stride],[6,stride]]){
  rect(c,x+sx,y-18,3,8+offset,p.B);
  rect(c,x+sx+(sx<0?1:0),y-17,2,7+offset,p.w);
  rect(c,x+sx,y-11+offset,3,2,p.b);
  rect(c,x+sx,y-9+offset,3,3,p.s);
  rect(c,x+sx+1,y-9+offset,1,2,p.S);
 }
 rect(c,x-6,y-20,12,13,p.B);
 rect(c,x-5,y-20,10,13,p.b);
 for(const xx of [-5,-3,2,4])rect(c,x+xx,y-19,1,11,p.w);
 rect(c,x-6,y-8,12,1,p.B);
 if(back){
  rect(c,x-5,y-19,10,1,p.w);rect(c,x-1,y-18,1,10,p.w);
  rect(c,x+4,y-17,1,8,p.b);
 }else{
  rect(c,x-2,y-20,4,12,p.W);
  rect(c,x-2,y-21,4,4,p.s);rect(c,x-1,y-20,2,3,p.S);
  rect(c,x-1,y-17,2,1,p.a); // restrained chain highlight above the tank
  rect(c,x-3,y-20,1,5,p.w);rect(c,x+2,y-20,1,5,p.w);
  rect(c,x-4,y-20,1,3,p.b);rect(c,x+3,y-20,1,3,p.b);
  rect(c,x+3,y-13,1,1,p.W);rect(c,x+3,y-10,1,1,p.W);
 }
}
function sideBody(c,x,y,stride,rightFacing){
 const p=playerPalette,dir=rightFacing?1:-1;
 rect(c,x-4,y-20,9,13,p.B);rect(c,x-3,y-19,7,12,p.b);
 for(const xx of [-3,-1,1,3])rect(c,x+xx,y-19,1,11,p.w);
 rect(c,x+(rightFacing?4:-4),y-18,1,10,p.W);
 rect(c,x-3,y-8,7,1,p.B);
 // Forearm travels fore/aft; a stripe and rolled cuff keep the outfit legible.
 const armX=x-1-stride*dir;
 rect(c,armX,y-18,3,8,p.B);rect(c,armX+1,y-17,2,6,p.w);
 rect(c,armX,y-11,3,2,p.b);rect(c,armX,y-9,3,3,p.s);
 rect(c,armX+1,y-9,1,2,p.S);
}
export function drawPlayer(c,x,y,face='down',step=0,moving=false){
 x=Math.round(x);y=Math.round(y);
 if(!Object.hasOwn(heads,face))face='down';
 const {stride,bob}=playerPose(step,moving),side=face==='left'||face==='right';
 // Ground shadow is deliberately independent of the gait and face direction.
 c.fillStyle='#0916228f';c.beginPath();c.ellipse(x+1,y+1,8,3,0,0,Math.PI*2);c.fill();
 legs(c,x,y,stride,side);
 const bodyY=y+bob;
 if(side)sideBody(c,x,bodyY,stride,face==='right');else frontBody(c,x,bodyY,stride,face==='up');
 stamp(c,heads[face],x-8,bodyY-34);
}
