// Original pixel crew: silhouette, clothing, kit and gesture carry the identity.
const R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
const P=(c,points,col)=>{c.fillStyle=col;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
export const crewStyles={
 scenic:{skin:'#b57856',light:'#d59a71',hair:'#352d38',shirt:'#e4d7b4',shade:'#aea28d',pants:'#43545d',height:35,width:7},
 grip:{skin:'#c79979',light:'#dfb48d',hair:'#594136',shirt:'#627c8a',shade:'#3d5867',pants:'#38464c',height:34,width:8},
 pa:{skin:'#9c7355',light:'#c79a75',hair:'#252d3e',shirt:'#c77d65',shade:'#91564e',pants:'#354859',height:32,width:6},
 craft:{skin:'#855b49',light:'#b68462',hair:'#39363a',shirt:'#7f9a85',shade:'#526e63',pants:'#34454b',height:33,width:8}
};
export function drawCrew(c,x,y,id,face='down',step=0,moving=false,task='idle',time=0){
 const s=crewStyles[id]||crewStyles.craft,side=face==='left'||face==='right',back=face==='up',flip=face==='left'?-1:1;
 const feet=moving?Math.round(Math.sin(step)*2):0,bob=moving?Math.round(Math.abs(Math.sin(step))):0;
 c.save();c.translate(Math.round(x),Math.round(y));
 R(c,-7,0,15,2,'#0b19288f');R(c,-5,2,11,1,'#0b19284f');c.translate(0,-bob);
 const w=side?s.width-2:s.width,headY=-s.height+5,shoulder=headY+10;
 // Boots and work trousers. Feet remain at a common ground anchor.
 R(c,-5,-11,4,10-feet,s.pants);R(c,1,-11,4,10+feet,s.pants);
 R(c,-6,-2-feet,6,3,'#182a32');R(c,1,-2+feet,7,3,'#182a32');R(c,-6,0-feet,6,1,'#9b8666');R(c,1,0+feet,7,1,'#9b8666');
 R(c,-w,shoulder,w*2+1,-shoulder-8,s.shirt);R(c,-w,shoulder,3,-shoulder-8,s.shade);
 R(c,-w-2,shoulder+2,3,9-feet,s.shirt);R(c,-w-2,shoulder+10-feet,3,3,s.skin);
 if(id!=='scenic'&&!(id==='pa'&&task==='radio')){R(c,w,shoulder+2,3,9+feet,s.shade);R(c,w,shoulder+10+feet,3,3,s.light);}
 R(c,-5,headY,10,10,s.skin);R(c,-2,headY+2,6,7,s.light);R(c,-5,headY-2,10,4,s.hair);
 if(back){R(c,-5,headY+2,10,7,s.hair);}else if(side){R(c,flip>0?4:-6,headY+5,2,3,s.light);R(c,flip>0?3:-4,headY+4,1,2,'#162a33');}else{R(c,-3,headY+4,1,2,'#162a33');R(c,2,headY+4,1,2,'#162a33');}
 if(id==='scenic'){
  // Curly high bun, rolled sleeves, long paint-flecked apron and brush roll.
  R(c,-6,headY-3,12,5,s.hair);R(c,-2,headY-7,7,5,s.hair);R(c,0,headY-6,4,2,'#6b493f');R(c,-5,headY+1,2,4,s.hair);
  R(c,-w-2,shoulder+6,3,3,'#f1dfb9');R(c,w,shoulder+6,3,3,'#f1dfb9');
  R(c,-4,shoulder+2,9,15,'#b57662');R(c,-3,shoulder+2,1,4,'#e5bc91');R(c,3,shoulder+2,1,4,'#e5bc91');R(c,-3,-13,7,4,'#925749');
  for(const [px,py,col] of [[-2,-17,'#e3ce97'],[3,-14,'#adc1ac'],[0,-9,'#809cb5'],[-3,-7,'#eadcb7']])R(c,px,py,2,2,col);
  if(!back){R(c,-9,-16,5,6,'#b69566');R(c,-8,-15,2,2,'#738e7a');R(c,-6,-12,2,2,'#bb6b56');}
  const painting=task==='paint',mixing=task==='mix',stroke=painting?Math.round(Math.sin(time*3)*3):0;
  R(c,w,shoulder+2,3,6,s.shirt);
  if(mixing){const stir=Math.round(Math.sin(time*3)*2);R(c,3,-17,6,3,s.light);R(c,2+stir,-22,2,9,'#b99967');R(c,1+stir,-14,4,3,'#aab7a4');}
  else{R(c,7,-19+stroke,7,3,s.light);R(c,13,-23+stroke,2,8,'#b99967');R(c,12,-25+stroke,4,3,'#aab7a4');}
 }else if(id==='grip'){
  // Broad denim shoulders, mustard knit cap, beard, braces and tool belt.
  R(c,-6,headY-4,12,6,'#d1ac62');R(c,-7,headY+1,14,3,'#a07f49');R(c,-4,headY-3,1,4,'#f0cd84');R(c,0,headY-3,1,4,'#f0cd84');
  if(!back){R(c,side?(flip>0?1:-5):-4,headY+8,side?5:8,4,'#654b3f');R(c,-1,headY+9,3,1,'#ad7857');}
  R(c,-4,shoulder+1,2,12,'#b69a6e');R(c,3,shoulder+1,2,12,'#b69a6e');R(c,-8,-10,16,3,'#735640');R(c,4,-9,5,6,'#a78555');R(c,6,-8,2,3,'#dfc477');
  if(task==='carry'){
   // Two long pine members, held at shoulder height, with end grain.
   R(c,-22,-27,44,4,'#b98a55');R(c,-22,-27,44,1,'#e8c590');R(c,-19,-22,40,3,'#c89c64');R(c,-19,-22,40,1,'#f0cf96');R(c,19,-26,3,6,'#977047');R(c,-12,-23,4,5,s.light);
  }else{R(c,-10,-15,5,5,'#d8b768');R(c,-9,-14,3,3,'#354957');}
 }else if(id==='pa'){
  // Shorter silhouette, ponytail, headset, coral jacket and swinging lanyard.
  R(c,-6,headY-2,12,4,s.hair);R(c,-7,headY,3,9,s.hair);R(c,-9,headY+5,3,8,s.hair);
  R(c,-6,headY-1,12,1,'#8d9c9e');R(c,4,headY+3,3,6,'#1a3342');R(c,3,headY+8,5,1,'#a4b9b4');
  R(c,-1,shoulder+1,2,9,'#e2cba0');R(c,-2,-12,5,5,'#e7d9b4');R(c,-1,-11,3,1,'#477b87');
  R(c,-9,-17,6,9,'#976e48');R(c,-8,-16,4,6,'#d9d5be');R(c,-7,-15,3,1,'#8c9994');
  const radio=task==='radio';if(radio){R(c,w,shoulder+2,3,5,s.shade);R(c,7,headY+10,3,5,s.light);}R(c,7,radio?headY+6:-16,4,7,'#293a48');R(c,8,radio?headY+2:-20,1,5,'#253540');R(c,8,radio?headY+7:-15,2,1,'#89b7aa');
 }else{
  // Craft's copper headwrap, round glasses, checked shirt and cream apron.
  R(c,-6,headY-3,12,5,'#b87556');R(c,-5,headY-2,10,1,'#e8b17a');R(c,5,headY,3,5,'#b87556');
  if(!back&&!side){R(c,-4,headY+4,4,3,'#bec3b0');R(c,1,headY+4,4,3,'#bec3b0');R(c,-3,headY+5,2,1,'#293b42');R(c,2,headY+5,2,1,'#293b42');R(c,0,headY+5,1,1,'#bec3b0');}
  R(c,-5,shoulder+3,11,15,'#d3c7a6');R(c,-4,-12,9,4,'#b8ae91');R(c,-2,shoulder+4,1,3,'#f2e5bd');R(c,4,shoulder+4,1,3,'#f2e5bd');R(c,9,-14,4,6,'#e3dac3');R(c,9,-15,5,2,'#f0e6c9');
 }
 c.restore();
}
export function drawCrewPortrait(canvas,id){
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#263d46';c.fillRect(0,0,128,128);
 for(let y=8;y<128;y+=8)R(c,8,y,112,1,'#77918b19');
 c.save();c.translate(64,113);c.scale(3,3);drawCrew(c,0,0,id,'down');c.restore();R(c,8,118,112,3,'#c7b387');
}
