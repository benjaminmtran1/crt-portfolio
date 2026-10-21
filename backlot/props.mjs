import {pixelText} from './pixels.mjs?v=crew3';
import {lotCamera,scenicStation,workshopLumber} from './world.mjs?v=screw1';
const R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
const P=(c,pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
const L=(c,x,y,xx,yy,col,w=1)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(Math.round(x)+.5,Math.round(y)+.5);c.lineTo(Math.round(xx)+.5,Math.round(yy)+.5);c.stroke();};
export function drawLotCamera(c){
 const {x,y}=lotCamera;c.save();c.translate(x,y);
 R(c,-20,4,42,3,'#08172366');
 // Spreader, telescoping tripod legs and castor feet.
 for(const end of [-17,18]){L(c,0,-12,end,5,'#263946',4);L(c,1,-10,end,4,'#9bafa8',1);R(c,end-3,3,6,4,'#182e3a');R(c,end-2,4,2,1,'#8a9d9b');}
 L(c,0,-10,0,8,'#576f76',3);L(c,-12,0,13,0,'#798f8c');R(c,-4,6,8,3,'#1a303b');
 R(c,-6,-17,12,6,'#738a8b');R(c,-4,-16,8,3,'#b3bdb1');
 // Body, film magazine, rails, focus wheel, lens and flared matte box.
 R(c,-17,-36,29,18,'#102632');R(c,-15,-34,24,13,'#3f5964');R(c,-14,-34,22,2,'#7e9696');R(c,-13,-30,11,8,'#223e4b');R(c,-11,-28,7,1,'#a4b9b2');R(c,-10,-25,5,1,'#617e87');
 R(c,-10,-44,17,8,'#263f4b');R(c,-8,-43,13,2,'#8b9f9a');R(c,-5,-40,8,2,'#425f68');
 R(c,10,-32,12,10,'#607a7f');for(let xx=12;xx<22;xx+=3)R(c,xx,-32,1,10,'#183541');
 P(c,[[22,-34],[30,-37],[30,-18],[22,-21]],'#162c38');R(c,29,-35,3,16,'#869b97');R(c,30,-32,2,10,'#3e7b81');
 R(c,-9,-19,34,2,'#a5b1a9');R(c,-11,-23,6,6,'#d8d9bd');R(c,-10,-22,4,4,'#4b6571');
 L(c,-16,-20,-23,-14,'#a2ada2',2);R(c,-26,-15,7,3,'#233c48');
 // Tilted onboard monitor, eyecup and steady tally lamp.
 R(c,-24,-42,11,9,'#102631');R(c,-22,-40,7,5,'#72a79e');L(c,-18,-33,-17,-37,'#8ba09d',2);R(c,-20,-31,4,5,'#17303b');R(c,-3,-32,2,2,'#eeaa81');
 L(c,-23,-35,-28,-27,'#182c3b');L(c,-28,-27,-24,-7,'#182c3b');
 c.restore();
}
export function drawWrapBell(c){
 const x=392,y=614;c.save();c.translate(x,y);R(c,-13,9,27,3,'#08172477');
 // Weathered timber upright, iron bracket and shaped brass bell.
 R(c,-3,-41,7,51,'#675748');R(c,-2,-40,2,48,'#b49c70');R(c,3,-39,1,48,'#37444a');R(c,-10,8,22,4,'#394d53');R(c,-8,8,18,1,'#a4ad95');
 R(c,-3,-42,19,3,'#9aa79c');R(c,13,-41,3,8,'#627c7c');R(c,8,-34,12,2,'#64523a');
 P(c,[[11,-34],[17,-34],[20,-29],[21,-20],[26,-16],[3,-16],[8,-20],[9,-29]],'#bd8d45');
 P(c,[[11,-32],[15,-32],[14,-21],[11,-18],[7,-18],[10,-23]],'#f0d18a');R(c,17,-28,2,9,'#8c622f');R(c,3,-17,23,3,'#e1b767');R(c,5,-14,19,2,'#765933');R(c,13,-12,4,4,'#d4ad66');
 L(c,14,-8,14,5,'#d9c694');L(c,14,5,11,9,'#d9c694');R(c,10,8,4,4,'#ad7b51');
 R(c,-12,-3,19,8,'#213944');pixelText(c,'WRAP',-3,-1,'#d6c59a',.5,true);c.restore();
}
export function drawFoundScrew(c,x,y,t=0,reduced=false,held=false){
 c.save();c.translate(Math.round(x),Math.round(y));
 if(held){
  c.rotate(-.2);R(c,-8,-12,16,4,'#20323c');R(c,-7,-14,14,4,'#d6ddce');R(c,-5,-13,10,1,'#f8ecc5');
  R(c,-3,-9,6,20,'#82989a');R(c,-2,-8,3,18,'#e1e1cb');
  for(let yy=-5;yy<11;yy+=4){R(c,-5,yy,10,2,'#334b53');R(c,-3,yy,8,1,'#c5d2c6');}
  P(c,[[-3,11],[3,11],[0,17]],'#d8decf');
 }else{
  c.rotate(-.72);R(c,-7,2,14,3,'#0a182666');R(c,-5,-2,10,3,'#a9b7ae');R(c,3,-4,5,6,'#dce1ce');R(c,4,-3,3,1,'#657a7c');
  for(let xx=-4;xx<4;xx+=3)R(c,xx,-3,1,5,'#e6e6cf');
  if(!reduced&&Math.sin(t*4)>-.1){R(c,9,-9,1,5,'#f7dfa0');R(c,7,-7,5,1,'#f7dfa0');}
 }
 c.restore();
}
export function drawWorkProps(c){
 // Scenic practice flat: braced timber back, mottled paint and a mixing pot.
 c.save();c.translate(scenicStation.flat.x-744,scenicStation.flat.y-359);
 R(c,745,336,30,28,'#857c69');R(c,747,338,26,24,'#91a89a');R(c,748,340,11,17,'#b7c6ac');R(c,760,342,11,8,'#698f87');R(c,753,351,15,9,'#91aaa0');
 R(c,744,335,3,31,'#c6a677');R(c,773,335,3,31,'#ad8a5d');L(c,776,340,786,367,'#b79b71',2);L(c,744,365,785,368,'#485957',2);
 c.restore();c.save();c.translate(scenicStation.mix.x-704,scenicStation.mix.y-356);
 R(c,705,340,9,8,'#768d87');R(c,704,339,11,2,'#d8cbae');R(c,707,337,6,2,'#aac2ad');c.restore();
 // Lumber stacked beside the workshop apron, with spaced bearers.
 c.save();c.translate(workshopLumber.x-446,workshopLumber.y-263);
 R(c,449,266,4,11,'#4c5146');R(c,479,266,4,11,'#4c5146');
 for(let y=263;y<273;y+=4){R(c,446,y,40,3,'#bd9563');R(c,446,y,40,1,'#e2c18d');R(c,483,y,3,3,'#8c6c4e');}
 c.restore();
}
