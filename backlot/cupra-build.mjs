/** Cupra — The Chosen One. Pixel scenery from Ben's photographed builds.
 * Stair: img_0131.jpg, img_0129.jpg, img_7148.dng.jpg and img_7107.dng.jpg.
 * Hall: img_7176.dng.jpg. Both pieces share one cutaway scenic platform.
 * Raster primitives keep every edge on the 360 × 180 pixel grid.
 */
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function P(c,points,color){
 const pts=points.map(([x,y])=>[Math.round(x),Math.round(y)]);
 for(let y=Math.min(...pts.map(p=>p[1]));y<Math.max(...pts.map(p=>p[1]));y++){
  const xs=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)R(c,Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,color);
 }
}
function L(c,x,y,xx,yy,color,w=1){
 x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);
 const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let e=dx+dy;
 for(;;){R(c,x,y,w,w,color);if(x===xx&&y===yy)break;const ee=e*2;if(ee>=dy){e+=dy;x+=sx;}if(ee<=dx){e+=dx;y+=sy;}}
}
const mix=(a,b,t)=>a+(b-a)*t;
function wheel(c,x,y){
 for(let yy=-4;yy<=4;yy++)for(let xx=-4;xx<=4;xx++){const d=xx*xx+yy*yy;if(d>=9&&d<=20)R(c,x+xx,y+yy,1,1,'#352F28');}
 L(c,x-3,y,x+3,y,'#41392F');L(c,x,y,x,y+3,'#41392F');R(c,x-1,y-1,3,2,'#5B4A35');R(c,x-3,y+6,7,1,'#D5AF79');
}
function museum(c){
 // The real curved display wall: warm wheel niches, walnut cabinets, grey frame.
 for(let x=27;x<198;x++){
  const curve=Math.round(7*Math.sin((x-27)/171*Math.PI));
  R(c,x,48+curve,1,86,'#5E4A37');R(c,x,48+curve,1,3,'#A0A295');
  R(c,x,53+curve,1,43,'#B18B58');R(c,x,54+curve,1,2,'#E4C08A');
  R(c,x,75+curve,1,2,'#373B35');R(c,x,96+curve,1,3,'#353B36');
  R(c,x,130+curve,1,4,'#272E2A');
 }
 for(let x=36;x<195;x+=17){const curve=Math.round(7*Math.sin((x-27)/171*Math.PI));for(const y of [63,84])wheel(c,x,y+curve);}
 for(let x=30;x<196;x+=17){const curve=Math.round(7*Math.sin((x-27)/171*Math.PI));
  L(c,x,101+curve,x,130+curve,'#352E26');L(c,x+3,103+curve,x+3,127+curve,'#796044');
  R(c,x+9,110+curve,4,1,'#A9926A');R(c,x+10,113+curve,3,2,'#C8B08A');
 }
 // The diagonal grey cabinet dividers are characteristic of the photographed set.
 P(c,[[27,111],[78,54],[85,55],[27,122]],'#9A9C8F');L(c,27,110,78,54,'#C2C0AD');
}
function hallway(c){
 // A forced-perspective slice of the wood hall, open to the soundstage overhead.
 const left=207,right=330,backL=253,backR=285;
 P(c,[[left,31],[right,31],[backR,78],[backL,78]],'#D8D0B3');
 P(c,[[left,31],[backL,78],[backL,135],[left,166]],'#493D2F');
 P(c,[[right,31],[backR,78],[backR,135],[right,166]],'#342D25');
 R(c,backL,77,backR-backL,59,'#51432F');
 // Lit floorboards recede to the back door and continue to the platform edge.
 P(c,[[backL,132],[backR,132],[right,169],[left,169]],'#968263');
 for(let i=0;i<=8;i++)L(c,mix(backL,backR,i/8),133,mix(left,right,i/8),169,i%2?'#B49A75':'#73634D');
 for(const [t,w] of [[.2,1],[.45,1],[.73,1]]){const y=mix(133,169,t);L(c,mix(backL,left,t),y,mix(backR,right,t),y,'#786C55',w);}
 // Recessed rectangular panels, chair rails and layered skirting, in perspective.
 for(const side of [-1,1]){
  const front=side<0?left:right,back=side<0?backL:backR;
  const point=(t,v)=>[mix(front,back,t),mix(40,79,t)+v*mix(121,54,t)];
  for(const [a,b] of [[.04,.39],[.43,.69],[.73,.94]])for(const [top,bottom] of [[.05,.61],[.69,.92]]){
   const quad=[point(a,top),point(b,top),point(b,bottom),point(a,bottom)];P(c,quad,side<0?'#514431':'#40382B');
   for(let i=0;i<4;i++)L(c,...quad[i],...quad[(i+1)%4],i<2?'#887355':'#211F1B');
   const inset=[point(a+.025,top+.025),point(b-.025,top+.025),point(b-.025,bottom-.025),point(a+.025,bottom-.025)];
   for(let i=0;i<4;i++)L(c,...inset[i],...inset[(i+1)%4],i<2?'#302B21':'#6A5942');
   for(const t of [a+.07,a+.12,a+.18])if(t<b-.03)L(c,...point(t,top+.08),...point(t,bottom-.07),side<0?'#5C4B35':'#4A3F2E');
  }
  for(const [v,color] of [[0,'#A08964'],[.025,'#28271F'],[.64,'#9C8561'],[.66,'#211F1B'],[.95,'#9A8361'],[.98,'#26251F']])L(c,...point(0,v),...point(1,v),color);
 }
 // Narrow deep door, two raised panels, brass latch and a sliver of daylight.
 R(c,255,85,28,49,'#25251F');R(c,258,88,22,46,'#584833');R(c,260,91,18,25,'#322D23');R(c,261,92,16,23,'#514330');
 R(c,260,119,18,11,'#2D2920');R(c,261,120,16,9,'#584833');R(c,257,90,1,44,'#C6B994');R(c,277,116,2,2,'#D4AF63');
 for(const [x,y,w,h,col] of [[252,81,34,2,'#9C8866'],[254,84,30,1,'#B2A07A'],[251,84,2,51,'#827052'],[283,84,2,51,'#74654B']])R(c,x,y,w,h,col);
 // Cream arch with a dark walnut reveal; open centre shows the rear hall.
 for(let x=left;x<=right;x++){
  const dx=(x-268.5)/53,outer=Math.abs(dx)<=1?79-46*Math.sqrt(1-dx*dx):80;
  const dx2=(x-268.5)/46,inner=Math.abs(dx2)<=1?80-41*Math.sqrt(1-dx2*dx2):89;
  R(c,x,26,1,Math.max(0,Math.round(outer)-26),'#DCD4B9');
  R(c,x,Math.round(outer),1,Math.max(1,Math.round(inner)-Math.round(outer)),'#473B2E');
  if(Math.abs(dx)<.99)R(c,x,Math.round(outer),1,1,'#B29C78');
 }
 R(c,left,26,4,141,'#9D906F');R(c,left+4,89,4,77,'#6D5B41');R(c,left+4,89,6,3,'#B39A73');
 R(c,right-3,26,4,141,'#5D5543');R(c,right-7,89,4,77,'#4B402F');R(c,right-9,89,6,3,'#9A8461');
 L(c,left,26,right,26,'#F0E6C9');L(c,left+1,28,right-1,28,'#BDB294');
}
function stairs(c){
 // A sweeping flight with tall solid cheeks, flared upper ends and grey nosings.
 // It follows the actual curving stair, rather than inventing a spiral balustrade.
 const levels=Array.from({length:15},(_,i)=>{const t=i/14;return{x:59+109*Math.sin(t*Math.PI/2),y:166-116*t,w:45-17*t};});
 const side=(sign,raised)=>levels.map((p,i)=>[p.x+sign*(p.w/2+4+(i>12?(i-12)*4:0)),p.y-(raised?13+(i>11?(i-11)*2:0):-4)]);
 P(c,[...side(-1,true),...side(-1,false).reverse()],'#92968C');
 const far=side(-1,true);for(let i=0;i<far.length-1;i++)L(c,...far[i],...far[i+1],'#E0DFCB',2);
 for(let i=levels.length-2;i>=0;i--){const a=levels[i],b=levels[i+1];
  P(c,[[a.x-a.w/2,a.y-4],[b.x-b.w/2,b.y],[b.x+b.w/2,b.y],[a.x+a.w/2,a.y-4]],i%2?'#A8AA9C':'#B4B6A6');
  P(c,[[a.x-a.w/2,a.y-4],[a.x+a.w/2,a.y-4],[a.x+a.w/2,a.y+1],[a.x-a.w/2,a.y+1]],'#727B73');
  L(c,a.x-a.w/2,a.y-5,a.x+a.w/2,a.y-5,'#DFDFCC');
  L(c,a.x-a.w/2+3,a.y-2,a.x+a.w/2-3,a.y-2,'#8E958A');
 }
 const upper=side(1,true),lower=side(1,false);
 P(c,[...upper,...lower.slice().reverse()],'#BFC0AD');
 // Quiet vertical scenic washes suggest the concrete finish in the photographs.
 for(let i=1;i<upper.length-1;i++){L(c,upper[i][0],upper[i][1]+2,lower[i][0],lower[i][1]-2,i%2?'#ADB2A2':'#CDD0BC');}
 for(let i=0;i<upper.length-1;i++){L(c,...upper[i],...upper[i+1],'#ECE9D1',2);L(c,...lower[i],...lower[i+1],'#686F66');}
 // The flared landing terminates cleanly, with the dark underside visible.
 P(c,[[181,32],[197,29],[188,49],[181,54]],'#8F988C');L(c,181,32,197,29,'#E4E4CF',2);
}
export function paintCupra(c){
 P(c,[[27,134],[197,136],[207,131],[330,159],[330,174],[30,174],[23,166]],'#444B40');
 P(c,[[27,134],[198,134],[207,133],[330,165],[330,170],[30,170],[23,164]],'#A29778');
 P(c,[[30,140],[177,139],[209,164],[193,169],[31,169]],'#816C4E');
 for(let y=143;y<170;y+=6)L(c,31,y,180+(y-143)*.6,y,'#AA9068');
 for(let x=43;x<180;x+=18)L(c,x,140,x+14,169,'#685B43');
 museum(c);hallway(c);stairs(c);
 L(c,30,170,330,170,'#C0B398');R(c,30,172,300,2,'#555D51');
}
