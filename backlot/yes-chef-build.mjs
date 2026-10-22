/** Yes, Chef! — segmented challenge table, drawn from img_2634.dng.jpg
 * (fabrication photograph) and img_2629.jpg (design reference).
 * One 360 × 180 pixel plate, with the metal feet grounded at y174.
 */
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const L=(c,x,y,xx,yy,color,w=1)=>{x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let e=dx+dy;for(;;){R(c,x,y,w,w,color);if(x===xx&&y===yy)break;const d=2*e;if(d>=dy){e+=dy;x+=sx;}if(d<=dx){e+=dx;y+=sy;}}};
const E=(c,x,y,rx,ry,color)=>{for(let yy=-ry;yy<=ry;yy++){const half=Math.floor(rx*Math.sqrt(Math.max(0,1-yy*yy/(ry*ry))));R(c,x-half,y+yy,half*2+1,1,color);}};
const P=(c,pts,color)=>{const p=pts.map(([x,y])=>[Math.round(x),Math.round(y)]);for(let y=Math.min(...p.map(v=>v[1]));y<=Math.max(...p.map(v=>v[1]));y++){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)R(c,Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,color);}};
function jar(c,x,y){
 R(c,x-7,y-19,15,21,'#8BACA8');R(c,x-5,y-18,11,20,'#395C61');E(c,x,y+1,7,3,'#ACC0B1');R(c,x-6,y-17,2,15,'#D9D9BD');R(c,x+4,y-16,1,14,'#7C9B96');E(c,x,y-19,7,3,'#D1D0AF');R(c,x-7,y-19,15,2,'#748B85');L(c,x-5,y-21,x+5,y-21,'#E7DFC2');
}
function tin(c,x,y){
 R(c,x-6,y-18,13,19,'#7A896A');R(c,x-4,y-17,8,18,'#A4AE83');R(c,x-4,y-13,8,11,'#D3C6A0');R(c,x-2,y-10,5,3,'#986C50');R(c,x-2,y-5,4,1,'#75684B');L(c,x-6,y-18,x-6,y,'#D7D1AB');E(c,x,y-18,6,3,'#C1C6A0');E(c,x,y-18,4,1,'#81967E');L(c,x+5,y-15,x+5,y-3,'#4C665B');
}
function glyph(c,text,x,y){const chars={Y:['101','101','010','010','010'],E:['111','100','110','100','111'],S:['111','100','111','001','111'],C:['111','100','100','100','111'],H:['101','101','111','101','101'],F:['111','100','110','100','100'],'!':['010','010','010','000','010']};for(const ch of text){for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(chars[ch]?.[row][col]==='1')R(c,x+col,y+row,1,1,'#D8B957');x+=4;}}
export function paintYesChef(c){
 // The actual table stands on a slim metal pedestal, not a solid scenic cube.
 P(c,[[177,125],[186,125],[188,162],[181,168],[175,160]],'#536D6D');L(c,178,126,179,162,'#C4D0B7',2);L(c,185,128,186,163,'#9DABA0');
 for(const [x,y] of [[98,166],[265,165],[181,170]]){L(c,181,159,x,y,'#233D42',5);L(c,181,158,x,y-1,'#A3B5A5',3);L(c,181,158,x,y-2,'#CBD1B5');R(c,x-7,y,15,2,'#152E37');}
 // Lift the tabletop above its fixed feet so the actual metal pedestal stays
 // visible from the stage angle. Offset native drawing coordinates, not the
 // whole plate: the near foot remains on the shared y174 floor contact.
 const floorContext=c;c={set fillStyle(value){floorContext.fillStyle=value;},fillRect(x,y,w,h){floorContext.fillRect(x,y-12,w,h);}};
 // A low circular apron and eight separate timber wedges. Both materials and
 // radial gaps are sampled from the fabrication/design photographs.
 E(c,180,104,140,50,'#2D2D27');E(c,180,100,139,50,'#68533B');E(c,180,98,139,49,'#B78B61');
 const tones=['#B98C63','#836244','#BE956D','#7D5D40','#AD825A','#806044','#B68A61','#8E6948'];
 for(let yy=-47;yy<=47;yy++)for(let xx=-137;xx<=137;xx++){
  const nx=xx/137,ny=yy/47,d=nx*nx+ny*ny;if(d>1)continue;
  const a=(Math.atan2(ny,nx)+Math.PI*2)%(Math.PI*2),wedge=Math.floor((a+Math.PI/8)/(Math.PI/4))%8;
  let col=tones[wedge];
  const grain=Math.sin(xx*.21+Math.sin(yy*.23)*2)+Math.sin(xx*.075-yy*.16);
  if(grain>1.6)col=wedge%2?'#A38057':'#CEA17A';if(grain< -1.7)col=wedge%2?'#75583E':'#A47753';
  R(c,180+xx,97+yy,1,1,col);
 }
 for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/8;const xx=180+137*Math.cos(a),yy=97+47*Math.sin(a);L(c,180+34*Math.cos(a),97+12*Math.sin(a),xx,yy,'#292E28',2);L(c,180+36*Math.cos(a),98+13*Math.sin(a),xx,yy+1,'#D0AA77');}
 for(let x=46;x<315;x++){const yy=97+47*Math.sqrt(Math.max(0,1-((x-180)/137)**2));R(c,x,yy,1,2,'#D1AD80');R(c,x,yy+5,1,2,'#3F3A2D');}
 // A handful of the photographed challenge props, not a crowded kitchen set.
 // Rear basket with apples and its characteristic bent-wire handle.
 E(c,111,66,22,8,'#456B50');E(c,111,62,21,9,'#A39D65');
 for(const [x,y,col] of [[102,57,'#99AD56'],[116,54,'#B1BD69'],[121,61,'#8D9F48'],[108,63,'#C2C877']]){E(c,x,y,7,6,col);R(c,x,y-7,1,3,'#65573A');}
 for(let i=0;i<5;i++){const x=94+i*9;L(c,x,61,101+i*5,72,'#577750');}L(c,91,61,97,43,'#9BBD88');L(c,97,43,122,40,'#9BBD88');L(c,122,40,132,60,'#9BBD88');
 // Rear-right mixing bowl and a utensil are the strongest metal silhouettes.
 E(c,267,69,23,10,'#708A84');P(c,[[244,68],[249,82],[258,87],[275,87],[286,79],[291,68]],'#69837D');E(c,267,67,23,8,'#D1D6BD');E(c,267,67,19,6,'#34545C');E(c,270,69,12,3,'#80988E');L(c,274,65,289,43,'#D4DAC0',2);L(c,286,44,290,43,'#7E968C');
 // Left wooden carrier holds two glass jars like the fabrication photograph.
 jar(c,76,102);jar(c,99,105);P(c,[[57,102],[112,106],[113,119],[58,114]],'#5D4934');P(c,[[58,99],[111,103],[111,107],[58,103]],'#C29B6C');R(c,58,90,3,22,'#A57A4D');R(c,110,93,3,24,'#826044');L(c,59,91,110,94,'#D6B07F',2);
 // Right-front tins sit on their own wedge; the near board remains legible.
 tin(c,262,111);tin(c,282,103);tin(c,283,126);
 P(c,[[145,122],[196,113],[226,129],[174,142]],'#544532');P(c,[[145,118],[197,109],[226,125],[174,138]],'#A07C4E');P(c,[[145,118],[174,138],[174,142],[145,122]],'#695036');L(c,148,118,197,111,'#C6A06B');for(let i=0;i<7;i++)L(c,151+i*7,119-i*.7,179+i*6,134-i*.7,i%2?'#80613D':'#BC925B');
 // The design's centre disc is the focal point, above the segmented leaves.
 E(c,180,97,35,15,'#443E2C');E(c,180,94,35,14,'#C9B464');E(c,180,94,32,12,'#172C2D');glyph(c,'YES',175,86);glyph(c,'CHEF!',171,94);
}
