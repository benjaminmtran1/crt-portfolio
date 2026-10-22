/** Two hand-rastered, freestanding scenic builds on the native 360 × 180 plate.
 * Internet: assets/img_4642.jpg (construction), assets/img_9344.jpg (on set).
 * Raptors: assets/img_2242.dng.jpg (nested timber hexes), img_0336.jpg
 * (dark shell and radial strips), screenshot-2026-08-20-at-2.09.04-pm.jpg
 * (the finished warm light). There are no runtime images or cast shadows.
 */
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function P(c,points,color){
 const pts=points.map(([x,y])=>[Math.round(x),Math.round(y)]);
 for(let y=Math.min(...pts.map(p=>p[1]));y<Math.max(...pts.map(p=>p[1]));y++){
  const xs=[];
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length];
   if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }
  xs.sort((a,b)=>a-b);
  for(let i=0;i+1<xs.length;i+=2)R(c,Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,color);
 }
}
function L(c,x,y,xx,yy,color,w=1){
 x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);
 const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let err=dx+dy;
 for(;;){R(c,x,y,w,w,color);if(x===xx&&y===yy)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
}
function E(c,x,y,rx,ry,color){
 for(let yy=-ry;yy<=ry;yy++){const half=Math.floor(rx*Math.sqrt(1-yy*yy/(ry*ry)));R(c,x-half,y+yy,half*2+1,1,color);}
}
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
function outline(c,pts,color,w=1){for(let i=0;i<pts.length;i++)L(c,...pts[i],...pts[(i+1)%pts.length],color,w);}
function button(c,x,y,color,light,rx=5,ry=3){
 E(c,x,y+2,rx+2,ry+1,'#352C22');E(c,x,y,rx+1,ry+1,'#534C32');
 E(c,x,y,rx,ry,color);L(c,x-rx+2,y-ry+1,x+rx-2,y-ry+1,light);R(c,x-rx+1,y,2,1,light);
}
function squareButton(c,x,y,color,light){
 P(c,[[x,y],[x+7,y],[x+9,y+4],[x+1,y+4]],'#74664C');
 P(c,[[x,y-1],[x+6,y-1],[x+7,y+2],[x,y+2]],color);L(c,x+1,y-1,x+5,y-1,light);
}
function stick(c,x,y,height=9,color='#BA3924'){
 E(c,x,y,4,2,'#A59364');E(c,x,y-1,3,1,'#E1D4A6');
 L(c,x,y-2,x,y-height,'#E7D6A0',2);L(c,x+1,y-3,x+1,y-height,'#776342');
 E(c,x,y-height-2,3,4,color);R(c,x-1,y-height-4,2,2,'#E9A77A');
}

export function paintInternet(c){
 // Compact scenic mounting plate, with its own edge rather than a cast shadow.
 P(c,[[34,151],[318,151],[332,164],[332,170],[317,174],[43,174],[28,168],[28,162]],'#39433A');
 P(c,[[35,151],[317,151],[331,163],[317,169],[43,169],[29,163]],'#6C6E52');
 L(c,43,169,317,169,'#9B9671');R(c,44,171,273,2,'#4D5747');
 // Timber legs are visible below the curved fascia in the construction photo.
 for(const [x,slant] of [[53,4],[88,-2],[271,2],[301,-4]]){
  P(c,[[x,129],[x+9,129],[x+slant+9,162],[x+slant,162]],'#9F875B');
  L(c,x+1,132,x+slant+1,160,'#C9B589',2);L(c,x+7,134,x+slant+7,160,'#6C6046');
  R(c,x+slant,162,10,2,'#383F31');
 }
 L(c,61,153,303,153,'#665A3C',4);L(c,62,152,302,152,'#A38F61');
 // The front is one continuous, bowed red-brown panel, not separate cabinets.
 for(let x=41;x<=319;x++){
  const t=(x-180)/139,curve=1-t*t,front=Math.round(94+17*curve),bottom=Math.round(142+14*curve);
  R(c,x,front,1,bottom-front,'#783B23');
  R(c,x,front+3,1,bottom-front-5,x<89?'#8E482A':x>279?'#69351F':'#874326');
  R(c,x,front+4,1,2,'#9F5630');R(c,x,bottom-2,1,2,'#572E20');
  if(x%34===0)R(c,x,front+10,1,bottom-front-16,'#834327');
 }
 // Mustard worktop: concave back and convex front, with forward-raking wings.
 P(c,[[31,74],[78,47],[115,60],[151,64],[197,65],[245,60],[285,47],[330,75],[319,94],[292,102],[253,108],[211,113],[161,114],[112,110],[73,103],[41,94]],'#A38231');
 P(c,[[31,71],[78,44],[115,57],[151,61],[197,62],[245,57],[285,44],[330,72],[319,89],[292,97],[253,103],[211,108],[161,109],[112,105],[73,98],[41,89]],'#B89C49');
 P(c,[[40,72],[80,49],[116,61],[153,65],[197,66],[245,61],[283,49],[321,73],[310,87],[286,94],[250,100],[210,104],[162,105],[116,101],[79,94],[47,86]],'#BEA153');
 for(let x=41;x<=319;x++){
  const curve=1-((x-180)/139)**2,y=Math.round(90+18*curve);
  R(c,x,y,1,2,'#D0B35F');R(c,x,y+2,1,4,'#9D7C2D');
 }
 // Four red-brown rails are the distinctive dividers of the real console.
 for(const [a,b] of [[[31,67],[78,40]],[[64,77],[106,51]],[[257,51],[300,77]],[[284,40],[330,67]]]){
  P(c,[[a[0],a[1]],[b[0],b[1]],[b[0],b[1]+6],[a[0],a[1]+6]],'#733B29');
  L(c,...a,...b,'#AF7151',2);L(c,a[0],a[1]+6,b[0],b[1]+6,'#653321');
 }
 // Small end-wing hardware, including the cream roller switches.
 P(c,[[43,69],[57,61],[65,64],[52,73]],'#D6C48A');E(c,53,66,5,3,'#9F8651');L(c,51,65,56,63,'#4F6C55',3);
 P(c,[[72,54],[83,48],[91,51],[80,58]],'#D4C18B');L(c,78,53,85,50,'#813D2B',2);R(c,82,47,2,4,'#A4472D');
 P(c,[[290,54],[299,58],[311,67],[301,70],[287,60]],'#D1BD82');E(c,295,58,5,3,'#E2CB89');L(c,296,53,299,56,'#9E3E27',2);
 E(c,310,70,2,1,'#EBDBAE');E(c,315,73,2,1,'#CFC6A0');
 // Left bank: lit square matrix and three long sliding faders.
 P(c,[[72,78],[102,72],[115,83],[81,91]],'#E3D2A1');L(c,81,91,115,83,'#8B7647');
 const bulbs=[['#DE3D2C','#FFA980'],['#34AFA0','#BFF5CB'],['#517BD1','#BFDEED'],['#D9E5D4','#FFFFFF']];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const k=(row*2+col)%4;squareButton(c,77+col*9+row*2,78+row*4-col*2,...bulbs[k]);
 }
 P(c,[[122,77],[145,80],[145,94],[139,99],[118,97],[114,92]],'#DCCB96');
 P(c,[[124,81],[140,83],[140,92],[135,95],[120,93],[119,90]],'#8E4A2A');
 for(let i=0;i<3;i++){const yy=84+i*4;L(c,121,yy,139,yy+1,'#D7B071');L(c,122,yy+1,139,yy+2,'#593721');const xx=[130,136,125][i];L(c,xx,yy,xx,yy-4,'#813721',2);R(c,xx-1,yy-5,4,3,'#B75B36');}
 // Cream rear strip with joystick, toggles and the three white piano keys.
 P(c,[[107,61],[125,62],[131,72],[109,71]],'#D8CB9A');stick(c,117,68,9);
 P(c,[[134,65],[177,67],[178,77],[132,74]],'#D7C694');
 for(const x of [138,145,152]){E(c,x,72,3,2,'#E6DEB8');E(c,x,71,2,1,'#4B555A');}
 L(c,141,69,140,64,'#754124',2);L(c,148,69,148,65,'#794329',2);
 for(let i=0;i<3;i++){R(c,160+i*5,69,4,5,'#97794C');R(c,161+i*5,69,3,4,'#EFE1B5');R(c,161+i*5,73,3,1,'#B8A277');}
 button(c,191,75,'#30B6AA','#B9F1CC',6,3);
 // Central red emergency button island with two green square lamps.
 P(c,[[155,83],[178,84],[180,98],[175,103],[158,102],[153,98]],'#DFCD99');
 squareButton(c,158,87,'#43C16D','#C5F7B7');squareButton(c,168,87,'#49BF7C','#D7FAD4');
 button(c,167,97,'#DD3B26','#FFA35D',7,4);
 // Broad, horseshoe-shaped lever path on the right, visible in both references.
 P(c,[[198,83],[211,85],[216,89],[235,91],[251,86],[256,82],[267,84],[271,93],[263,101],[248,106],[222,107],[204,102],[193,95]],'#E0CE9B');
 P(c,[[202,87],[209,88],[215,93],[235,95],[252,91],[259,87],[264,88],[265,92],[258,97],[245,101],[223,102],[208,98],[199,93]],'#B99A46');
 const arc=[[207,95],[217,99],[232,101],[246,100],[259,95]];
 for(let i=0;i<arc.length-1;i++){L(c,...arc[i],...arc[i+1],'#6C4F27');L(c,arc[i][0],arc[i][1]+1,arc[i+1][0],arc[i+1][1]+1,'#D6B86C');}
 stick(c,220,99,8);stick(c,226,82,7,'#D6B642');
 // Rear green pair, wooden round plate and right-hand illuminated controls.
 E(c,234,69,9,4,'#96602C');E(c,234,68,9,3,'#A96E32');
 for(const [x,y] of [[257,67],[263,69]]){P(c,[[x-2,y],[x+2,y+1],[x+4,y+4],[x,y+3]],'#496947');L(c,x,y+1,x,y-3,'#804A2A',2);R(c,x-1,y-4,3,3,'#B35135');}
 E(c,284,82,10,4,'#E2D3A3');button(c,284,81,'#5DBD55','#CDF2A0',5,3);
 P(c,[[280,94],[304,88],[313,95],[288,102]],'#DDC894');
 squareButton(c,286,95,'#4BC47C','#BDF5B8');squareButton(c,295,93,'#DA432D','#FFB28A');squareButton(c,304,91,'#D8E8DB','#FFFFFF');
}

function hex(cx,cy,rx,ry){return[[cx-rx*.5,cy-ry],[cx+rx*.5,cy-ry],[cx+rx,cy],[cx+rx*.5,cy+ry],[cx-rx*.5,cy+ry],[cx-rx,cy]];}
export function paintRaptors(c){
 // The discreet physical platform makes the booth a build sitting on the stage.
 P(c,[[58,151],[303,151],[326,163],[326,170],[312,174],[46,174],[34,168],[34,162]],'#292E2B');
 P(c,[[58,150],[302,150],[325,162],[312,168],[47,168],[35,162]],'#4A4940');
 L(c,47,168,312,168,'#807456');R(c,48,170,263,2,'#3B3E34');
 const front=hex(170,85,111,75),back=front.map(([x,y])=>[x+26,y-1]);
 // Visible top and right extrusions give the black shell real scenic depth.
 P(c,[front[0],back[0],back[1],front[1]],'#5A5A50');
 P(c,[front[1],back[1],back[2],front[2]],'#4B4F49');
 P(c,[front[2],back[2],back[3],front[3]],'#343B37');
 P(c,[front[3],back[3],[back[3][0],163],[front[3][0],164]],'#292E29');
 L(c,...back[1],...back[2],'#6F7061');L(c,...back[2],...back[3],'#484F44');
 P(c,front,'#383D37');
 const mouth=hex(171,86,90,59),inner=hex(175,86,80,53),end=hex(191,86,28,23);
 const bevel=['#54564A','#484C42','#282F2B','#47483B','#595749','#353B33'];
 for(let i=0;i<6;i++){const j=(i+1)%6;P(c,[front[i],front[j],mouth[j],mouth[i]],bevel[i]);}
 outline(c,front,'#606454');L(c,...front[0],...front[1],'#8A8670');
 // A substantial unlit reveal surrounds the small, deep illuminated tunnel.
 P(c,mouth,'#161F1D');
 const walls=['#3C3625','#292E24','#292C22','#413A27','#3A3625','#2A3026'];
 for(let i=0;i<6;i++){const j=(i+1)%6;P(c,[inner[i],inner[j],end[j],end[i]],walls[i]);}
 // Successive plywood hexagonal frames retain the construction photograph's
 // stepped tunnel, instead of replacing it with one graphic hexagonal ring.
 for(const t of [0,.18,.35,.51,.65,.78]){
  const ring=inner.map((p,i)=>point(p,end[i],t));
  const next=inner.map((p,i)=>point(p,end[i],Math.min(.96,t+.045)));
  for(let i=0;i<6;i++){const j=(i+1)%6;P(c,[ring[i],ring[j],next[j],next[i]],i<3?'#4B4530':'#5B4C2C');}
  outline(c,ring,'#1E2720');outline(c,next,'#796137');
 }
 // Warm gold light strips radiate along the six built surfaces to the back.
 // Every strip is integer-rastered; none emits a halo outside the structure.
 for(let side=0;side<6;side++){
  const j=(side+1)%6;
  for(let n=0;n<7;n++){
   const t=(n+.5)/7,a=point(inner[side],inner[j],t),b=point(end[side],end[j],t);
   L(c,a[0]+1,a[1]+1,b[0]+1,b[1]+1,'#8E6127',2);
   L(c,...a,...b,side===0||side===4?'#E1BC63':'#CBA650');
   const brightA=point(a,b,.36),brightB=point(a,b,.96);
   L(c,...brightA,...brightB,side===0?'#FAE6A4':'#F1D58A');
  }
 }
 // The rear is a tangible gold panel, deliberately without an invented logo.
 P(c,end,'#A68A42');P(c,[[177,63],[204,63],[215,83],[202,106],[179,106],[167,86]],'#B39B53');
 L(c,177,63,204,63,'#DEC278');L(c,167,86,179,106,'#CBB166');L(c,204,63,219,85,'#82763F');
 // Bottom threshold connects to the actual floor. Thin lit floor ribs stop at
 // the front reveal, and dark feet are part of the booth, not floating scenery.
 P(c,[[128,145],[214,145],[225,160],[115,160]],'#575446');
 P(c,[[129,146],[213,146],[220,156],[122,156]],'#696044');
 for(const x of [133,147,161,177,193,207])L(c,x,147,x+(x-170)*.09,155,'#A28A4F');
 L(c,116,160,225,160,'#958A68');R(c,116,161,110,3,'#343C32');
 R(c,110,161,18,4,'#242E27');R(c,218,161,18,4,'#242E27');
 // Fine joinery and restrained warm reflections on the charcoal shell.
 L(c,...mouth[0],...mouth[1],'#776B45');L(c,...mouth[4],...mouth[5],'#766449');
 L(c,83,89,126,143,'#59523B');L(c,216,144,258,89,'#514B34');
 for(const [x,y] of [[114,14],[223,14],[63,85],[277,85],[115,156],[223,156]])R(c,x,y,2,2,'#868169');
}
