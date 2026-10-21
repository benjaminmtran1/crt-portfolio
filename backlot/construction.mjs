import {clamp} from './world.mjs?v=cleanup1';
import {pixelText} from './pixels.mjs?v=crew3';
import {buildSteps} from './departments.mjs?v=drafting1';

// Every piece of the miniature uses this same axonometric basis, including the
// pad, floor plan, chalk, wall rails, wall surfaces and filming equipment.
export const constructionBasis=Object.freeze({
 origin:Object.freeze([128,256]),x:Object.freeze([1,.1]),y:Object.freeze([.8,-.4]),z:Object.freeze([0,-1])
});
export function constructionPoint(x,y,z=0){
 const b=constructionBasis;
 return [b.origin[0]+x*b.x[0]+y*b.y[0]+z*b.z[0],b.origin[1]+x*b.x[1]+y*b.y[1]+z*b.z[1]];
}
export const constructionPad=Object.freeze([[0,0,0],[360,0,0],[360,180,0],[0,180,0]].map(Object.freeze));
export const constructionFootprint=Object.freeze([[50,42,0],[310,42,0],[310,147,0],[50,147,0]].map(Object.freeze));
const phase=(n,start,end)=>clamp((n-start)/(end-start),0,1);
export function constructionState(sequence){
 const build=sequence.progress(2);
 return {design:sequence.progress(0),mark:sequence.progress(1),frame:phase(build,0,.4),skin:phase(build,.32,.78),finish:phase(build,.7,1),shoot:sequence.progress(3)};
}
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ink='#d9d4b2',timber='#d4b17a';
function polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function segment(c,a,b,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='butt';c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
function surface(c,points,color){polygon(c,points.map(p=>constructionPoint(...p)),color);}
function edge(c,a,b,color,width=1,progress=1){if(progress>0)segment(c,constructionPoint(...a),constructionPoint(...mix(a,b,progress)),color,width);}
function path(c,points,color,width,progress=1){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j]))),total=lengths.reduce((a,b)=>a+b,0);let remaining=total*progress;
 for(let i=0;i<lengths.length;i++){edge(c,points[i],points[i+1],color,width,clamp(remaining/lengths[i],0,1));remaining-=lengths[i];}
}
function box(c,x,y,z,w,d,h,front,side,top){
 surface(c,[[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],side);
 surface(c,[[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],front);
 surface(c,[[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);
}
function frontPanel(c,x,w,z,h,color,p=1){if(p>0)surface(c,[[x,42,z],[x+w,42,z],[x+w,42,z+h*p],[x,42,z+h*p]],color);}
function rightPanel(c,y,d,z,h,color,p=1){if(p>0)surface(c,[[310,y,z],[310,y+d,z],[310,y+d,z+h*p],[310,y,z+h*p]],color);}
function blueprint(c,design,mark){
 if(mark>=.22)return;c.save();c.globalAlpha=1-phase(mark,0,.22);
 surface(c,[[27,24,.8],[332,24,.8],[332,163,.8],[27,163,.8]],'#82a9a5');
 for(let x=35;x<332;x+=15)edge(c,[x,24,1],[x,163,1],'#c7dfca38');
 for(let y=28;y<163;y+=15)edge(c,[27,y,1],[332,y,1],'#c7dfca38');
 const outline=constructionFootprint.map(([x,y])=>[x,y,2]);path(c,[...outline,outline[0]],'#eef0cf',2,design);
 path(c,[[50,48,2],[155,48,2],[155,42,2],[210,42,2],[210,48,2],[304,48,2],[304,147,2]],'#e6ecd0',1,phase(design,.2,.9));
 if(design>.45){edge(c,[50,126,2],[310,126,2],'#e5edcf',1,phase(design,.45,.7));for(const x of [50,155,210,310])edge(c,[x,121,2],[x,132,2],'#e5edcf');}
 if(design>.7){path(c,[[155,42,2],[155,92,2],[210,92,2]],'#e8e7c2',1,phase(design,.7,1));edge(c,[45,42,2],[45,147,2],'#e5edcf');}
 // A pencil follows a measured line, then rests on the drawing. No screen-flat elevation.
 const x=50+260*design;edge(c,[x,126,3],[x+24,145,13],'#e9bd74',4);edge(c,[x-3,123,2],[x,126,3],'#233b46',2);
 c.restore();
}
function markOut(c,progress){
 if(progress<=0)return;
 const outline=constructionFootprint.map(([x,y])=>[x,y,1]);path(c,[...outline,outline[0]],ink,2,progress);
 for(const x of [50,95,140,155,210,265,310])edge(c,[x,36,1],[x,48,1],ink,1,phase(progress,.45,1));
 edge(c,[155,32,1],[210,32,1],'#e7b879',3,phase(progress,.55,.9));
 // Chalk reel, tape and a square all rest on the pad, not a different plane.
 box(c,18,54,1,14,11,6,'#b9b699','#718e88','#e2d6ac');
 path(c,[[318,80,1],[341,80,1],[341,115,1]],'#d1b37c',3,phase(progress,.5,1));
}
function frame(c,p){
 if(p<=0)return;
 // Rear braces are drawn first; all feet land inside the same pad footprint.
 for(const x of [68,290]){
  box(c,x-10,124,0,25,16,5,'#6f7d68','#4f685f','#949c79');
  edge(c,[x,136,5],[x,45,128],timber,5,p);
 }
 // Right return: vertical posts, base, top and middle rails.
 for(const y of [42,77,112,147])edge(c,[310,y,0],[310,y,150],timber,5,p);
 for(const z of [3,76,147])edge(c,[310,42,z*p],[310,147,z*p],z===147?'#edd096':'#baa173',5,p);
 // Front: two flats, a doorway and a supported header.
 for(const x of [50,95,140,155,210,265,310])edge(c,[x,42,0],[x,42,150],timber,5,p);
 for(const z of [3,75])for(const [a,b]of [[50,155],[210,310]])edge(c,[a,42,z*p],[b,42,z*p],timber,5,p);
 edge(c,[50,42,150*p],[310,42,150*p],'#ecd095',6,p);
 edge(c,[155,42,104*p],[210,42,104*p],'#ecd095',6,p);
 edge(c,[181,42,104*p],[181,42,150*p],timber,5,p);
}
function skin(c,p){
 if(p<=0)return;
 rightPanel(c,42,105,0,150,'#8c8263',p);
 frontPanel(c,50,105,0,150,'#baa579',p);frontPanel(c,210,100,0,150,'#baa579',p);frontPanel(c,155,55,104,46,'#cbb58a',p);
 for(const x of [95,140,265])edge(c,[x,42,3],[x,42,147*p],'#8c7d5d66',1,p);
 for(const y of [77,112])edge(c,[310,y,3],[310,y,147*p],'#c6af7e55',1,p);
}
function finish(c,p){
 if(p<=0)return;
 c.save();c.globalAlpha=p;
 rightPanel(c,42,105,0,150,'#56716a');
 frontPanel(c,50,105,0,150,'#ad7b62');frontPanel(c,210,100,0,150,'#ad7b62');frontPanel(c,155,55,104,46,'#ad7b62');
 // Brick courses follow the x-axis of the pad; none are screen-horizontal.
 for(let z=9;z<150;z+=12){
  const spans=z<104?[[50,155],[210,310]]:[[50,310]];
  for(const [a,b]of spans){edge(c,[a,41.8,z],[b,41.8,z],'#795c50',1);for(let x=a+((z-9)%24?12:24);x<b;x+=24)edge(c,[x,41.8,z],[x,41.8,Math.min(z+12,150)],'#795c50',1);}
 }
 // Cornice, doorway, window and practical lamp share the wall's local plane.
 box(c,47,38,147,266,7,8,'#dac7a3','#9a9f87','#eee0bc');
 edge(c,[310,42,151],[310,147,151],'#a3b098',6);
 frontPanel(c,155,55,0,104,'#203c43');frontPanel(c,160,45,0,99,'#3f6d67');
 for(const x of [154,210])edge(c,[x,41,0],[x,41,106],'#dac8a2',5);
 edge(c,[152,41,106],[213,41,106],'#eadcb6',6);
 frontPanel(c,165,35,55,38,'#b7ccb3');edge(c,[182,41,55],[182,41,93],'#416d65',3);edge(c,[165,41,74],[200,41,74],'#416d65',3);
 frontPanel(c,165,35,9,35,'#2e554f');frontPanel(c,198,3,45,4,'#f1d290');
 box(c,236,34,83,10,8,13,'#f1cc82','#b99560','#f9dfa4');edge(c,[241,41,100],[241,41,79],'#263e43',2);
 box(c,77,28,0,19,17,19,'#9f7763','#765c4f','#c49b7c');
 for(const [x,y,z]of [[81,31,20],[89,35,27],[85,39,33],[92,39,22]])box(c,x,y,z,7,6,8,'#6b8b71','#456b5e','#8ea17b');
 c.restore();
}
function filming(c,p){
 if(p<=0)return;
 const enter=phase(p,0,.35),dolly=phase(p,.35,1),x=105+dolly*65,y=5;
 c.save();c.globalAlpha=enter;
 // Dolly track runs parallel to the same x-axis as the front wall and pad.
 for(const yy of [-2,12])edge(c,[85,yy,1],[211,yy,1],'#9aada7',2);
 for(let xx=91;xx<210;xx+=22)edge(c,[xx,-2,1],[xx,12,1],'#667f7e',2);
 // Camera on a tripod, aimed along +y into the set.
 for(const [dx,dy]of [[-13,-7],[12,-7],[0,14]])edge(c,[x+dx,y+dy,3],[x,y,47],'#b1bdb0',3);
 box(c,x-12,y-6,44,24,16,17,'#233c49','#162e3b','#4e6b70');
 box(c,x-5,y+10,47,10,11,10,'#59777b','#172f3c','#78918c');
 for(const xx of [x-8,x+5])box(c,xx,y-1,61,6,6,6,'#263e48','#152e3a','#72918b');
 box(c,x-10,y-7,51,3,1,3,'#ec9a75','#ec9a75','#ec9a75');
 // A warm key light and visible beam make the final phase a filmed take.
 const lx=349,ly=26;
 for(const [dx,dy]of [[-12,-8],[12,-8],[0,15]])edge(c,[lx,ly,9],[lx+dx,ly+dy,0],'#879e98',2);
 edge(c,[lx,ly,0],[lx,ly,108],'#8ca49d',3);
 surface(c,[[lx,ly,104],[lx-3,ly,96],[210,42,12],[155,42,12]],'#efd29a1d');
 box(c,lx-10,ly-5,99,20,10,12,'#223d46','#152d3b','#80928a');frontPanel(c,239,6,86,7,'#ffe3a1');
 edge(c,[lx-8,ly-6,102],[lx+8,ly-6,102],'#f3d998',5);
 // Clapper rests beside the camera, clear of the doorway.
 box(c,245,-7,1,31,5,22,'#243c46','#152c36','#d5d6b8');
 for(let xx=248;xx<274;xx+=9)edge(c,[xx,-8,19],[xx+4,-8,23],'#e4dec1',3);
 c.restore();
 const [rx,ry]=constructionPoint(245,-8,12);if(p>.35)pixelText(c,'TAKE 01',rx+3,ry,'#e7d2a3',1,true);
 if(p>.35){c.fillStyle='#e49d79';c.fillRect(583,53,5,5);pixelText(c,'ROLLING',598,52,'#e5c78f');}
}
export function drawConstructionScene(canvas,sequence){
 const c=canvas.getContext('2d'),state=constructionState(sequence);
 c.imageSmoothingEnabled=false;c.save();c.scale(canvas.width/720,canvas.height/340);
 c.fillStyle='#233842';c.fillRect(0,0,720,340);
 for(let y=30;y<340;y+=22)segment(c,[0,y],[720,y],'#81998813');
 for(let x=-340;x<720;x+=40)segment(c,[x,340],[x+340,0],'#81998813');
 pixelText(c,'WORKSHOP / MINIATURE 01',28,22,'#93aca1');pixelText(c,'FROM PLAN TO PICTURE',550,22,'#c7b58c',1,true);
 surface(c,constructionPad.map(([x,y])=>[x+5,y-4,-5]),'#122b36');
 surface(c,[[0,0,0],[360,0,0],[360,0,-7],[0,0,-7]],'#2c494b');
 surface(c,[[360,0,0],[360,180,0],[360,180,-7],[360,0,-7]],'#355451');
 surface(c,constructionPad,'#45605d');
 for(let x=30;x<360;x+=30)edge(c,[x,0,.1],[x,180,.1],'#99ad9411');
 for(let y=30;y<180;y+=30)edge(c,[0,y,.1],[360,y,.1],'#99ad9411');
 blueprint(c,state.design,state.mark);markOut(c,state.mark);frame(c,state.frame);skin(c,state.skin);finish(c,state.finish);filming(c,state.shoot);
 // Workshop materials stay outside the build footprint.
 box(c,-43,5,0,27,23,20,'#8a7658','#605d4c','#b4a078');
 for(let z=2;z<=20;z+=6)edge(c,[-43,4,z],[-16,4,z],'#d0ad77',2);
 const step=sequence.step,label=['DRAWING THE PLAN','CHALK LINES + MEASUREMENTS','FRAME / SKIN / FINISH','CAMERA + LIGHTS / ACTION'][step];
 pixelText(c,label,360,310,'#c5c6a6',1,true);
 for(let i=0;i<4;i++){
  const x=28+i*173;c.fillStyle=i<=step?'#d8b77b':'#536c68';c.fillRect(x,328,160*sequence.progress(i),2);
 }
 pixelText(c,String(step+1).padStart(2,'0')+' / '+buildSteps[step].title.toUpperCase(),28,53,'#e4c58e');
 c.restore();
}
