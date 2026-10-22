import {titleBuilds,paintTitleBuild} from './title-builds.mjs?v=fivebuilds1';
import {scenicStation,carpenterStation} from './world.mjs?v=cleanup1';
export const crew=[
 {id:'scenic',name:'Jules',role:'Scenic painter',point:scenicStation.mix,coat:'#a68078',lines:['If it looks like stone, please don’t lean on it until the paint dries.','My finest moss is three shades of green and a very tired sponge.','Look through the camera. That’s where all the separate bits become a place.']},
 {id:'grip',name:'Frankie',role:'Carpenter',point:carpenterStation.measure,coat:'#d5ae69',lines:['It’s level. The rest of the planet is slightly off.','The best camera angle is usually exactly where someone put the lumber.','A whole world in the frame. Three sandbags and a coffee just outside it.']},
 {id:'pa',name:'Kit',role:'Production assistant',point:{x:560,y:608},coat:'#859eaa',lines:['I have four walkies and somehow none of them are on the right channel.','They said one last setup. I’ve written that down for historical purposes.','See that bell by production? Ring it when you’re ready to call wrap.']}
];
export const cameraBuilds=titleBuilds;
export const projectTerms=['deathstalker','nintendo','beast games','cupra','internet','raptors','wicked','yes, chef','ihop'];
export function drawViewfinder(canvas,index,wide=false){
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const plate=document.createElement('canvas');plate.width=360;plate.height=180;paintTitleBuild(plate.getContext('2d'),index);
 c.fillStyle='#091e27';c.fillRect(0,0,720,400);
 // The added cutaway plates keep their full floor footprint in the wide shot.
 // Leave all four approved camera compositions unchanged.
 const added=index>=4&&index<cameraBuilds.length,floor=added&&wide?270:300;
 c.fillStyle='#213c44';c.fillRect(0,floor,720,400-floor);
 if(added){
  const scale=wide?1.4:2,left=wide?108:0,top=wide?76:12,near=top+174*scale;
  c.fillStyle='#192F37';
  for(let yy=-5;yy<=5;yy++){
   const half=Math.floor(135*scale*Math.sqrt(Math.max(0,1-yy*yy/25)));
   c.fillRect(Math.round(left+180*scale-half),Math.round(near-3*scale+yy*scale),half*2,Math.max(1,Math.round(scale)));
  }
 }
 if(wide){c.drawImage(plate,108,76,504,252);c.fillStyle='#101c27';c.fillRect(28,68,12,260);c.fillRect(680,68,12,260);c.fillStyle='#e2bb7f';c.fillRect(12,70,44,24);c.fillRect(664,70,44,24);}
 else c.drawImage(plate,0,12,720,360);
 c.strokeStyle='#d9e5cf';c.lineWidth=2;
 for(const [x,y,sx,sy] of [[24,24,1,1],[696,24,-1,1],[24,376,1,-1],[696,376,-1,-1]]){c.beginPath();c.moveTo(x+sx*26,y);c.lineTo(x,y);c.lineTo(x,y+sy*26);c.stroke();}
 c.beginPath();c.moveTo(350,200);c.lineTo(370,200);c.moveTo(360,190);c.lineTo(360,210);c.stroke();
}
export const wrapChapters=['Last looks','Crew heading home','Lights out','That’s a wrap'];
export function wrapStep(elapsed){return Math.min(3,Math.floor(elapsed/3));}
